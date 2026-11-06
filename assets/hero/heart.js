import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeSection } from './section.js';

const GLB = document.getElementById('heart').dataset.glb;
const SECTION = document.getElementById('heart').dataset.section;

const cv = document.getElementById('heart');
const hero = document.querySelector('.hero');
const run = hero && hero.closest('.hero-run');
if (cv && hero && run) {

const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setClearAlpha(0);
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, 0.005, 1000);

const WHITE = 0xffffff, RED = 0xB3222A;
const EDGE = 30;   // crease angle (deg) that draws a line; lower it for more lines
// soft light only, so the white still reads as a volume behind its red edges
scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a88, 2.2));

const spin = new THREE.Group();
const tilt = new THREE.Group();
tilt.rotation.z = Math.PI / 6;   // leans 30 deg; the spin above it stays on the vertical
const beat = new THREE.Group();
spin.add(tilt);
tilt.add(beat);
scene.add(spin);
let ready = false, R = 1, low = 0, far = 1, near = 1, section = null;

const loader = new GLTFLoader();
loader.loadAsync(GLB).then(gltf => {
  const s = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());
  // untextured: a white body, pushed back a hair so its red creases draw on top
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshLambertMaterial({
      color: WHITE, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, EDGE),
      new THREE.LineBasicMaterial({ color: RED })));
  });
  gltf.scene.position.sub(s.center);           // beat and spin about the real centre
  beat.add(gltf.scene);
  R = s.radius;
  // the spin is about the vertical, so the tilted heart's lowest point never moves
  tilt.updateMatrixWorld(true);
  low = new THREE.Box3().setFromObject(tilt, true).min.y;
  ready = true;
  size();
  // scene 1's section only once the hero is up: it is not needed on the first screen
  return loader.loadAsync(SECTION).then(sec => { section = makeSection(beat, gltf.scene, sec.scene); });
});

const center = new THREE.Vector3(), target = new THREE.Vector3(), valve = new THREE.Vector3();

function size() {
  const b = cv.getBoundingClientRect();
  if (!b.width) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,
    (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 2));
  renderer.setSize(b.width, b.height, false);
  cam.aspect = b.width / b.height;
  // the heart takes ~85% of the height, or of the width on a portrait screen
  const fit = Math.min(1, cam.aspect);
  far = R / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / (0.85 * fit);
  // scene 1: close enough that the left heart fills the middle and the rest runs off the edges
  near = 0.2 / Math.max(fit, 0.6);
  cam.position.set(0, 0, far);
  cam.lookAt(0, 0, 0);
  // slide the view so the heart lands two thirds across, where the flow leaves from
  cam.setViewOffset(b.width, b.height, -b.width / 6, 0, b.width, b.height);
  cam.updateProjectionMatrix();
  const y = new THREE.Vector3(0, low, 0).project(cam).y;
  hero.style.setProperty('--heart-bottom', ((1 - y) / 2 * b.height).toFixed(1) + 'px');
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const gl = document.getElementById('gl');   // hero-shader.js publishes its beat count on it
const TAU = Math.PI * 2;
const ease = t => t * t * t * (t * (6 * t - 15) + 10);
let onScreen = true, turn = 0, last = 0;
new IntersectionObserver(e => { onScreen = e[0].isIntersecting; }).observe(hero);

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
  last = ts;
  if (!ready || !onScreen || hero.style.visibility === 'hidden') return;

  // 0 on the hero, 1 one screen down: the heart has turned to face us, been cut open,
  // and the camera has closed in on the mitral valve
  const k = ease(THREE.MathUtils.clamp(-run.getBoundingClientRect().top / innerHeight, 0, 1));

  // the hero's spin runs only on the hero; leaving it, the heart turns back to its
  // front by the shorter way round, so the cut faces the camera
  if (!reduced && k === 0) turn += dt * 0.25;
  spin.rotation.y = THREE.MathUtils.lerp(turn, Math.round(turn / TAU) * TAU,
    THREE.MathUtils.smoothstep(k, 0, 0.6));

  // the same beat that sends the surge out of the centre: a quick swell, a slow ebb.
  // It dies out with the zoom: scene 1 holds still
  const fp = ((gl && gl.beat) || 0) % 1;
  beat.scale.setScalar(1 + 0.05 * Math.exp(-fp * 7) * (1 - k));
  if (section) section.update(k);

  // the camera slides from the heart's centre onto the valve, which therefore lands
  // where the heart was: two thirds across, mid-height
  spin.updateMatrixWorld(true);
  beat.localToWorld(valve.copy(section ? section.mitral : center));
  target.lerpVectors(center, valve, k);
  cam.position.set(target.x, target.y, target.z + THREE.MathUtils.lerp(far, near, k));
  cam.lookAt(target);
  renderer.render(scene, cam);

  // the label rides just above the annulus
  if (k > 0) {
    const p = valve.project(cam), b = cv.getBoundingClientRect();
    hero.style.setProperty('--mx', ((p.x + 1) / 2 * b.width).toFixed(1) + 'px');
    hero.style.setProperty('--my', ((1 - p.y) / 2 * b.height).toFixed(1) + 'px');
  }
}

addEventListener('resize', size);
requestAnimationFrame(frame);

}
