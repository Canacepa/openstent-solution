/* Hero canvas, after the acitechnology.eu .liquid-webgl effect.

   Not a particle system. A fullscreen quad runs a fragment shader that:
     1. snaps every pixel to a block of u_cell device pixels,
     2. builds a horizontal "hourglass" band, pinched at the centre and nearly full
        height at the edges, its centreline displaced by a sine plus simplex noise,
     3. fills it with a plasma field (five iterations of sin/cos domain warping),
     4. cuts the band's density into four flat tones, opaque on the band and clear
        everywhere else, so the ground shows through around it.

   Adapted for a cream ground: on a dark page the dense end of the ramp has to be the
   bright one, here it has to be the dark one. So the tone is driven by the band's
   own density rather than by the colour's luminance, and the ramp runs pale sage at
   the thin edges to deep forest at the core.

   Simplex noise is Ashima's webgl-noise (MIT). */

import { FLUID, TONES, rgb } from './fluid-glsl.js';

(function () {
  var cv = document.getElementById('gl');
  var gl = cv && cv.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false });
  var stage = document.getElementById('stage');
  if (!gl) { stage.style.display = 'none'; return; }

  var VERT = `#version 300 es
in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  var FRAG = `#version 300 es
precision highp float;
precision highp int;

uniform float u_time;
uniform vec2  u_resolution;
uniform float u_width;       // domain-warp amplitude
uniform float u_mul;         // domain-warp frequency
uniform float u_speed;
uniform vec3  u_beige;       // the outermost stratum, just off the ground
uniform vec3  u_pale;        // the band's thin edges
uniform vec3  u_deep;        // the band's core
uniform vec3  u_lensCol;
uniform vec2  u_mouse;       // device pixels, y measured from the bottom
uniform float u_lensR;
uniform float u_lensAmp;
uniform float u_cell;
uniform float u_gain;
uniform float u_offset;    // pushes the band down, clear of the copy
uniform float u_clear;     // fraction of the width the copy column keeps quiet
uniform float u_beat;      // heartbeats elapsed
uniform float u_swell;     // how far the band bulges as a beat passes
uniform float u_spread;    // how long the bulge is along the band
uniform vec2  u_valve;     // the 3D valve's centre, device pixels, y from the bottom

out vec4 fragColor;

${FLUID}
void main(){
  vec2 pix = gl_FragCoord.xy;
  vec2 blockPix = floor(pix / u_cell) * u_cell;

  vec2 dm = blockPix - u_mouse;
  float lens = exp(-dot(dm, dm) / (u_lensR * u_lensR)) * u_lensAmp;

  vec2 centered = (blockPix - 0.5 * u_resolution.xy + vec2(0.0, u_offset)) / u_resolution.y;
  float nx = centered.x * u_resolution.y / u_resolution.x * 2.0;
  // the valve in the same frame (without the drop, so the slider still moves the band)
  vec2 vc  = (u_valve - 0.5 * u_resolution.xy) / u_resolution.y;
  float vx = vc.x * u_resolution.y / u_resolution.x * 2.0;
  centered.y -= vc.y;
  float tw = u_time * u_speed;

  float waveY  = 0.05 * sin(nx * 2.4 + 0.4 + tw * 0.5);
        waveY += 0.04 * snoise(vec2(nx * 0.9 + tw * 0.12, tw * 0.18));
  float ny = centered.y - waveY;
        ny += 0.02 * snoise(vec2(nx * 2.8 - tw * 0.2, tw * 0.26 + 9.0));

  // the flow leaves the valve, wherever the axo sits on screen, and runs out towards
  // both edges; the hourglass pinches there too. u_beat counts beats (accumulated on the CPU so a BPM
  // change never jumps the phase); ph falls with the distance, so each surge
  // reaches the far edges last
  float d     = abs(nx - vx);
  float ph    = u_beat - d * 0.6;
  float fp    = fract(ph);
  // an arrival, not a blip: a quick soft rise at the front, then a long ebb behind
  // it, faded out before the cycle wraps. u_spread stretches both along the band
  float rise  = 0.06 * u_spread;
  float pulse = fp < rise ? smoothstep(0.0, rise, fp)
                          : exp(-(fp - rise) / (0.18 * u_spread));
  pulse *= 1.0 - smoothstep(0.85, 1.0, fp);
  // the texture is carried outward in surges: it moves with the front, coasts after
  float flow  = (floor(ph) + smoothstep(0.0, 0.32, fp)) * 0.35 + tw * 0.08;

  float env   = 0.11 + 0.40 * pow(d, 1.7);
  float thick = max(env + 0.05 * snoise(vec2(nx * 1.6 + tw * 0.15, tw * 0.21 + 4.0)), 0.05);
  thick *= 1.0 + u_swell * pulse;       // the vessel swells as the beat passes

  float across = 1.0 - smoothstep(0.0, thick, abs(ny));
  float tex    = plasmaField(vec2(d * 1.3 - flow, ny * 3.5));

  // density: 0 off the band, ~1 along its centreline
  float dens = across * (0.45 + 0.55 * tex) * u_gain * (0.80 + 0.40 * pulse);

  // the band enters from the right and thins out before it reaches the copy,
  // never to nothing: a faint texture behind text is fine, mid-density is not
  float cx = u_clear * u_resolution.x;
  dens *= mix(0.16, 1.0, smoothstep(cx * 0.40, cx, pix.x));

  // the pointer thickens the band locally as well as tinting it
  float wtex = plasmaField(centered * 2.4 + vec2(3.7, 1.3));
  float halo = lens * (0.3 + 0.7 * wtex);
  dens = clamp(dens + halo * 0.85, 0.0, 1.0);

  vec3 col = fluidTone(dens);
  col = mix(col, u_lensCol, smoothstep(0.25, 0.5, halo));

  // the beige rim dissolves into transparency across its whole stratum, so the band
  // has no outline: it simply thins out into the ground
  fragColor = vec4(col, smoothstep(0.34, 0.46, dens));   // only the bright strata are drawn: no dark-red haze over the ground
}`;

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null;
    }
    return sh;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  // No blending: one opaque pass over a cleared buffer. Blending onto (0,0,0,0) would
  // multiply the colour by alpha a second time, and the page would see a grey fringe
  // wherever the band fades out.
  gl.clearColor(0, 0, 0, 0);

  var U = {};
  ['u_time','u_resolution','u_width','u_mul','u_speed','u_beige','u_pale','u_deep','u_lensCol',
   'u_mouse','u_lensR','u_lensAmp','u_cell','u_gain','u_offset','u_clear','u_beat','u_swell','u_spread','u_valve'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  // on the dark ground the dense core is the BRIGHT end: rim near the ground, core blood red
  var BEIGE_HEX = TONES.beige, PALE_HEX = TONES.pale, DEEP_HEX = TONES.deep, LENS_HEX = TONES.lens;
  var BEIGE = rgb(BEIGE_HEX), PALE = rgb(PALE_HEX), DEEP = rgb(DEEP_HEX), LENS = rgb(LENS_HEX);

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slow = (navigator.hardwareConcurrency || 4) <= 4;
  var dpr = 1, W = 0, H = 0;

  function size() {
    // native resolution for clean edges, capped at 2; weak machines stay at 1
    dpr = slow ? 1 : Math.min(2, devicePixelRatio || 1);
    var r = cv.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H;
    gl.viewport(0, 0, W, H);
  }

  var mx = -9999, my = -9999, amp = 0, moving = 0;
  addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    mx = (e.clientX - r.left) * dpr;
    my = (r.height - (e.clientY - r.top)) * dpr;   // gl_FragCoord counts y from the bottom
    moving = 1;
  }, { passive: true });
  addEventListener('pointerleave', function () { moving = 0; });

  // the settings that used to come from the hidden dev panel
  var P = { sp: 0.30, bpm: 18, swell: 1.20, spread: 2.0, wd: 0.46, cell: 1, gain: 0.80, off: 10, clr: 0.00 };
  var running = true, onScreen = true;

  var t = 0, beat = 0, last = 0;
  function frame(ts) {
    if (running) requestAnimationFrame(frame);
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!onScreen) return;                    // stop drawing once the hero is scrolled past
    t += dt;
    if (!reduced) beat += dt * P.bpm / 60;
    cv.beat = beat;                           // heart.js swells on the same beat
    if (stage.style.opacity === '0.000') return;   // stepped aside for scene 1

    amp += ((moving ? 1 : 0) - amp) * Math.min(1, dt * 4.5);
    moving = 0;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.u_time, t);
    gl.uniform2f(U.u_resolution, W, H);
    gl.uniform1f(U.u_width, P.wd);
    gl.uniform1f(U.u_mul, 1.0);
    gl.uniform1f(U.u_speed, reduced ? 0 : P.sp);
    gl.uniform3fv(U.u_beige, BEIGE);
    gl.uniform3fv(U.u_pale, PALE);
    gl.uniform3fv(U.u_deep, DEEP);
    gl.uniform3fv(U.u_lensCol, LENS);
    gl.uniform2f(U.u_mouse, mx, my);
    gl.uniform1f(U.u_lensR, (W >= 1200 ? 100 : 70) * dpr);
    gl.uniform1f(U.u_lensAmp, amp * 0.9);
    gl.uniform1f(U.u_cell, P.cell * dpr);
    gl.uniform1f(U.u_gain, P.gain);
    gl.uniform1f(U.u_offset, P.off * dpr);
    gl.uniform1f(U.u_clear, W < 900 * dpr ? 0.0 : P.clr);
    gl.uniform1f(U.u_beat, beat);
    gl.uniform1f(U.u_swell, P.swell);
    gl.uniform1f(U.u_spread, P.spread);
    gl.uniform2f(U.u_valve, W * 2 / 3, H / 2);   // the flow leaves the heart, two thirds across
    gl.drawArrays(gl.TRIANGLES, 0, 3);

  }

  size();
  addEventListener('resize', size);
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; })
      .observe(document.querySelector('.hero'));
  }
  requestAnimationFrame(frame);
})();

/* ---- the frost fades in with the scroll, and the cue fades out ---- */
(function () {
  var bar = document.getElementById('bar'), cue = document.getElementById('cue');
  var ticking = false;
  function update() {
    var y = scrollY;
    bar.classList.toggle('frosted', y > 24);
    cue.classList.toggle('gone', y > 120);
    ticking = false;
  }
  addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

/* ---- the word spans the hero edge to edge, less its margin, whatever the font's metrics ---- */
(function () {
  var h = document.querySelector('.hero .word'), w = h && h.firstElementChild;
  if (!w) return;
  function fit() {
    var cs = getComputedStyle(h);
    var room = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    h.style.fontSize = '100px';
    h.style.fontSize = (100 * room / w.getBoundingClientRect().width) + 'px';
  }
  fit();
  addEventListener('resize', fit);
  document.fonts.ready.then(fit);   // Cal Sans arrives after first paint
})();

/* ---- leaving the hero: heart.js cuts the heart open and closes in on its valve
   (scene 1) while the word, the hook and the flow step aside; a screen later the
   hero fades onto the implant and its first card ---- */
(function () {
  var run = document.querySelector('.hero-run'), hero = run && run.querySelector('.hero');
  if (!hero) return;
  var aside = hero.querySelectorAll('.word, .hook, #stage');
  var ticking = false;
  function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
  function update() {
    ticking = false;
    var s = -run.getBoundingClientRect().top / innerHeight;   // screens into the run
    var away = (1 - smooth(s / 0.4)).toFixed(3);
    for (var i = 0; i < aside.length; i++) aside[i].style.opacity = away;
    // the card lands with the zoom and leaves before the hero fades, so it never
    // crosses the next card
    hero.style.setProperty('--scene', (smooth((s - 0.7) / 0.3) * (1 - smooth((s - 1.05) / 0.25))).toFixed(3));
    var f = smooth((s - 1.2) / 0.7);
    hero.style.opacity = (1 - f).toFixed(3);
    hero.style.visibility = f >= 1 ? 'hidden' : '';
  }
  addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  update();
})();
