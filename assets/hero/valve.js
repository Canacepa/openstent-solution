import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// resolved and fingerprinted at build time, not a bare runtime path
const GLB = document.getElementById('valve').dataset.glb;

// The solution: the implant exploded along its axis and drawn in isometric axonometric,
// each part turning on that axis. The cards walk through it: an overview, then one card
// per part, which lights up while the others dim to a hidden-line ghost, then the parts
// close back onto each other.

const cv = document.getElementById('valve');
const wrap = cv && cv.parentElement;
const story = document.querySelector('.story');
if (cv && story) {

const BODY = 0xDFE5EB, RED = 0xEF233C, GROUND = 0x111217, GHOST = 0x3A3E48;
// top to bottom, in the order of the cards: 01 leaflets, 02 arms, 03 flange.
// Gap between parts along the axis, in mm (the GLB's unit)
const STACK = { leaflets: 1, arms: 0, flange: -1 };
const GAP = 50;
// which card lights which part (the first card is the overview, the last the assembly)
const CARD = { leaflets: 1, arms: 2, flange: 3 };
const SPIN = 0.35;                               // rad/s
// the axis leans this far from vertical, in the picture plane: the parts keep their
// isometric look, the stack runs diagonally, its top away from the labels
const TILT = THREE.MathUtils.degToRad(30);

const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setClearAlpha(0);
const scene = new THREE.Scene();
// orthographic: a technical drawing is a parallel projection
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
cam.position.set(200, 200, 200);                 // the isometric diagonal
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();
const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
const tilt = new THREE.Group();
tilt.quaternion.setFromAxisAngle(cam.getWorldDirection(new THREE.Vector3()), -TILT);
scene.add(tilt);
const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(tilt.quaternion);

const parts = {};          // name -> {spin, fill, line, r, note, at}
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let ready = false;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function ramp(p, from, to) {
  const t = clamp((p - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

new GLTFLoader().load(GLB, gltf => {
  const all = new THREE.Box3().setFromObject(gltf.scene);
  const mid = all.getCenter(new THREE.Vector3());
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const name = o.name.toLowerCase().replace(/\..*$/, '');
    if (!(name in STACK)) return;
    o.geometry.translate(-mid.x, -mid.y, -mid.z);      // every part turns on the implant's axis
    // the fill never shows as a colour of its own: it hides the edges behind the solid,
    // which is what separates a technical drawing from a wireframe
    const fill = new THREE.MeshBasicMaterial({
      color: BODY, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    const line = new THREE.LineBasicMaterial({ color: RED });
    const spin = new THREE.Group();
    // 30 deg measured on this mesh: keeps the creases, drops the tessellation
    spin.add(new THREE.Mesh(o.geometry, fill), new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), line));
    tilt.add(spin);
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    parts[name] = {
      spin, fill, line,
      r: Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z),
      note: wrap.querySelector(`.note[data-part="${name}"]`)
    };
  });
  ready = true;
  size();
});

// the drawing sits over the column opposite the cards
function size() {
  const col = document.querySelector('#solution .beat-col');
  if (col) {
    const r = col.getBoundingClientRect();
    wrap.style.transform = `translateX(${(innerWidth / 2 - (r.left + r.width / 2)).toFixed(1)}px)`;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 2));
  renderer.setSize(cv.clientWidth, cv.clientHeight, false);
}

// where the cards are: 0 with the first centred on screen, 1 the next, and so on
const slots = [...document.querySelectorAll('#solution .slot')];
function cardAt() {
  if (!slots.length) return -1;
  const r = slots[0].getBoundingClientRect();
  return (innerHeight / 2 - (r.top + r.height / 2)) / r.height;
}

// Without a card background, two texts overlapping at the same spot would be unreadable,
// so only one is ever lit: full opacity exactly when its slot straddles the viewport
// centre, fading as the next one takes over.
const says = [...document.querySelectorAll('.say')];
function fadeText() {
  const mid = innerHeight / 2;
  for (const el of says) {
    const r = el.parentElement.getBoundingClientRect();   // the slot, not the sticky box
    const d = Math.max(r.top - mid, mid - r.bottom);      // <0 while the centre is inside
    el.style.opacity = clamp(1 - d / (innerHeight * 0.3), 0, 1).toFixed(3);
  }
}

const p = new THREE.Vector3(), ground = new THREE.Color(GROUND), ghost = new THREE.Color(GHOST);
function draw(time) {
  fadeText();
  const s = cardAt();
  if (!ready || s < -1.3 || s > slots.length) return;   // under the hero, or scrolled past

  // exploded from the first card, closed again on the last
  const ex = ramp(s, -0.8, 0) * (1 - ramp(s, slots.length - 2, slots.length - 1));
  // how far into the part cards we are: 0 on the overview and the assembly
  const focus = clamp(Math.min(s, slots.length - 1 - s), 0, 1);

  // framed on the stack as it stands, tall or wide; while the labels show, the axis
  // stands a little left of centre to leave them room on the right
  const labels = ramp(ex, 0.5, 0.9);
  const w = cv.clientWidth, h = cv.clientHeight, f = 0.5 - 0.1 * labels;
  // room right of the axis, on screen, for a leader and the widest label
  const room = innerWidth - wrap.getBoundingClientRect().left - f * w - 56
    - Math.max(0, ...Object.values(parts).map(q => q.note ? q.note.offsetWidth - q.note.firstChild.offsetWidth : 0));
  // each part, wherever it is turned, stays inside a sphere of its radius about its centre
  let half = 0;
  for (const name in parts) {
    const q = parts[name];
    q.at = axis.clone().multiplyScalar(STACK[name] * GAP * ex);
    const x = q.at.dot(right), y = q.at.dot(up);
    half = Math.max(half,
      (Math.abs(y) + q.r) * 1.15,
      (q.r - x) * 1.1 / (2 * f * w / h),
      labels ? (x + q.r) * h / (2 * Math.max(room, 40)) : 0);
  }
  const W = 2 * half * w / h;
  cam.left = -f * W; cam.right = (1 - f) * W; cam.top = half; cam.bottom = -half;
  cam.updateProjectionMatrix();

  const turn = reduced.matches ? s * 1.2 : time / 1000 * SPIN;
  const anchors = {};
  let column = 0;
  for (const name in parts) {
    const q = parts[name];
    q.spin.position.y = STACK[name] * GAP * ex;     // along the tilted axis
    q.spin.rotation.y = turn;
    const lit = clamp(1 - Math.abs(s - CARD[name]), 0, 1);
    const dim = focus * (1 - lit);
    q.fill.color.set(BODY).lerp(ground, dim);
    q.line.color.set(RED).lerp(ghost, dim);
    // the label hangs off the part's right-hand edge as the camera sees it
    p.copy(right).multiplyScalar(q.r).add(q.at).project(cam);
    anchors[name] = { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, lit, dim };
    column = Math.max(column, anchors[name].x);
  }
  column += 32;
  for (const name in parts) {
    const { note } = parts[name], a = anchors[name];
    if (!note) continue;
    note.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translateY(-50%)`;
    note.style.setProperty('--lead', (column - a.x).toFixed(1) + 'px');
    note.style.opacity = (labels * (1 - 0.65 * a.dim)).toFixed(3);
    note.classList.toggle('on', a.lit > 0.5);
  }
  renderer.render(scene, cam);
}

// turning on their axis needs a frame loop; with reduced motion, the scroll alone drives it
function loop(t) {
  draw(t);
  if (!reduced.matches) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
addEventListener('scroll', () => { if (reduced.matches) requestAnimationFrame(draw); }, { passive: true });
addEventListener('resize', () => { size(); draw(performance.now()); });

}
