import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GLB = document.getElementById('valve').dataset.glb;

const cv = document.getElementById('valve');
const story = document.querySelector('.story');
if (cv && story) {

// the fill is the story's ground colour (it only hides the edges behind it)
const CREAM = 0xAFB696, FOREST = 0xB3222A;   // FOREST: the line colour, now the heart's red

const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setClearAlpha(0);
const scene = new THREE.Scene();
// Orthographic, not perspective: a technical drawing is a parallel projection. It also
// means the framing is a frustum size, with no vanishing point to fight.
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);

// the opening pose: isometric axonometric seen from the upper-left corner
const AXO_X = Math.atan(Math.SQRT1_2);   // 35.264 deg, the isometric tilt
const AXO_Y = Math.PI / 4;               // 45 deg, bringing the left face forward
const pivot = new THREE.Group();
scene.add(pivot);

// Each part gets its own fade. The fill is the page colour and never shows: its only
// job is to occupy the depth buffer so the edges behind the solid are hidden. That is
// what separates a technical drawing from a wireframe.
const parts = {};          // name -> {fill, lines, mats}
let ready = false, rLeaf = 1, rAll = 1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
// 0 before `from`, 1 after `to`, smoothstepped in between
function ramp(p, from, to) {
  const t = clamp((p - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

new GLTFLoader().load(GLB, gltf => {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const name = o.name.toLowerCase().replace(/\..*$/, '');
    const fillMat = new THREE.MeshBasicMaterial({
      color: CREAM, side: THREE.DoubleSide, transparent: true, opacity: 1,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    const lineMat = new THREE.LineBasicMaterial({
      color: FOREST, transparent: true, opacity: 1
    });
    const fill = new THREE.Mesh(o.geometry, fillMat);
    // 30 deg measured on this mesh: keeps the creases, drops the tessellation
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), lineMat);
    pivot.add(fill, lines);
    parts[name] = { fill, lines, mats: [fillMat, lineMat] };
  });

  // Two framings, not one. At the start only the leaflets are on screen (30mm); framing
  // on the assembled implant (82mm) from the first frame would show them as a speck.
  // The camera pulls back as the parts arrive.
  const all = new THREE.Box3().setFromObject(pivot).getBoundingSphere(new THREE.Sphere());
  pivot.position.sub(all.center);                       // spin about the real centre
  rAll = all.radius;
  const leaf = new THREE.Box3()
    .setFromObject(parts.leaflets ? parts.leaflets.fill : pivot)
    .getBoundingSphere(new THREE.Sphere());
  rLeaf = leaf.radius;
  cam.position.set(0, 0, rAll * 4);      // distance is irrelevant under ortho, only clipping
  cam.far = rAll * 8;
  cam.lookAt(0, 0, 0);

  ready = true;
  size();
  draw();
});

// How far off-centre the valve sits. Measured from the beat grid's own column, not from
// the window edges: the point is to land on the column opposite the cards, not to go as
// far out as the viewport allows.
let travel = 0;
function measureTravel() {
  const ref = document.querySelector('.beat-col');
  if (!ref) return;
  const r = ref.getBoundingClientRect();
  travel = Math.abs((r.left + r.width / 2) - innerWidth / 2);
}

function size() {
  measureTravel();
  const b = cv.getBoundingClientRect();
  if (!b.width) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,
    (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 2));
  renderer.setSize(b.width, b.height, false);
  // the ortho frustum depends on scroll as well as size, so draw() owns it
}

// how far we are through the pinned run: 0 as the first beat reaches the top (the hero
// stays pinned over its first card), 1 once it releases
const firstBeat = story.querySelector('.beat');
function progress() {
  const top = firstBeat.getBoundingClientRect().top;
  const span = story.getBoundingClientRect().bottom - top - innerHeight;
  return span <= 0 ? 0 : clamp(-top / span, 0, 1);
}

function setOpacity(name, v) {
  const p = parts[name];
  if (!p) return;
  for (const m of p.mats) m.opacity = v;
  p.fill.visible = p.lines.visible = v > 0.004;
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

function draw() {
  fadeText();
  if (!ready) return;
  const p = progress();

  // --- the parts arrive in the order the discourse needs them, and leave together ---
  const exit = 1 - ramp(p, 0.88, 1);
  const leaflets = exit;                                       // present from the start
  const arms     = ramp(p, 0.20, 0.34) * exit;
  const flange   = ramp(p, 0.56, 0.70) * exit;

  // --- crossing the page: fade out on the right, reappear on the left ---
  // the swap happens inside the invisible window, so nothing is seen sliding across
  const out = ramp(p, 0.40, 0.47);            // 0 -> 1 fade out
  const back = ramp(p, 0.47, 0.56);           // 0 -> 1 fade back in
  const vis = Math.min(1 - out + back, 1);

  const onLeft = p >= 0.47;
  const tx = (onLeft ? -1 : 1) * travel;
  cv.style.transform = 'translateX(' + tx.toFixed(1) + 'px)';
  cv.style.opacity = vis.toFixed(3);

  setOpacity('leaflets', leaflets);
  setOpacity('arms', arms);
  setOpacity('flange', flange);

  // --- the camera retreats as the implant grows, so each part arrives framed ---
  // It must lead the arms slightly: they reach the full 41mm radius, so a retreat
  // slower than their fade-in leaves them clipped against the canvas edge.
  const r = lerp(rLeaf, rAll, ramp(p, 0.17, 0.35)) * 1.06;
  const b = cv.getBoundingClientRect();
  const asp = b.height ? b.width / b.height : 1;
  cam.left = -r * asp; cam.right = r * asp;
  cam.top = r; cam.bottom = -r;
  cam.updateProjectionMatrix();

  // --- continuous evolution: from the opening axo, turning as you go down ---
  pivot.parent.rotation.y = AXO_Y + p * Math.PI * 1.6;
  pivot.parent.rotation.x = lerp(AXO_X, 0.12, ramp(p, 0.08, 0.75));

  renderer.render(scene, cam);
}

let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; draw(); });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { size(); draw(); });
draw();   // the text must be lit even if the GLB never arrives

}
