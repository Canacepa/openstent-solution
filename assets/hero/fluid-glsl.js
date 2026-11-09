// The fluid's look, shared by the hero's flow and the blood inside the heart. The host
// shader declares u_time, u_speed, u_width, u_mul, u_beige, u_pale and u_deep.

export const TONES = { beige: '#2A1219', pale: '#7F1426', deep: '#EF233C', lens: '#FF5A6E' };

export const rgb = hex => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
};

export const FLUID = /* glsl */`
/* --- Ashima 2D simplex noise (MIT) --- */
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* --- scalar plasma: iterative sin/cos domain warp, 0..1 --- */
float plasmaField(vec2 p0){
  float t = u_time * u_speed;
  vec2 p = p0;
  for (int i = 1; i <= 5; i++) {
    float fi = float(i);
    p.x += u_width / fi * sin(fi * u_mul * p.y + t);
    p.y += u_width / fi * cos(fi * u_mul * p.x + t);
  }
  return sin(p.x * 3.0) * cos(p.y * 3.0) * 0.5 + 0.5;
}

/* --- five strata, beige at the rim, then pale to deep at the core. The steps are soft
   and the raw density is blended back in, so each tone carries its own gradient --- */
vec3 fluidTone(float dens){
  float lv = smoothstep(0.26, 0.34, dens) + smoothstep(0.44, 0.54, dens)
           + smoothstep(0.62, 0.72, dens) + smoothstep(0.80, 0.90, dens);
  float k  = mix(lv / 4.0, dens, 0.3);
  return k < 0.25 ? mix(u_beige, u_pale, k * 4.0)
                  : mix(u_pale, u_deep, (k - 0.25) / 0.75);
}
`;
