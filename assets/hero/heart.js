import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeSection } from './section.js';

const GLB = document.getElementById('heart').dataset.glb;

const cv = document.getElementById('heart');
const hero = document.querySelector('.hero');
const run = hero && hero.closest('.hero-run');
if (cv && hero && run) {

const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, stencil: true });
renderer.setClearAlpha(0);
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(42, 1, 0.005, 1000);

const BODY = 0xDFE5EB, RED = 0xEF233C;
const EDGE = 30;   // crease angle (deg) that draws a line; lower it for more lines
// a soft ground and one key from the upper left, together reaching the body's own colour
// where they meet; what turns away falls off, and fog sinks what lies deep into the ground
scene.add(new THREE.HemisphereLight(0xffffff, 0x8E949A, 1.9));
const key = new THREE.DirectionalLight(0xffffff, 1.3);
key.position.set(-0.5, 0.7, 1);
scene.add(key);
scene.fog = new THREE.Fog(0x111217, 1, 2);

const spin = new THREE.Group();
const tilt = new THREE.Group();
tilt.rotation.z = Math.PI / 6;   // leans 30 deg; the spin above it stays on the vertical
const beat = new THREE.Group();
spin.add(tilt);
tilt.add(beat);
scene.add(spin);
let ready = false, R = 1, low = 0, far = 1, near = 1, section;

new GLTFLoader().loadAsync(GLB).then(gltf => {
  const s = new THREE.Box3().setFromObject(gltf.scene).getBoundingSphere(new THREE.Sphere());
  // only its outer surface, and the closed copy of it that fills its section in scene 1:
  // the inside of the heart is scene 1's beating heart. Untextured, a pale body, pushed
  // back a hair so its red creases draw on top
  const inside = [];
  let volume;
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    if (o.name === 'Epicardium_cap') { volume = o; return; }
    if (!/^Epicardium/.test(o.name)) { inside.push(o); return; }
    o.material = new THREE.MeshLambertMaterial({
      color: BODY, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, EDGE),
      new THREE.LineBasicMaterial({ color: RED })));
  });
  for (const o of inside) o.removeFromParent();
  gltf.scene.position.sub(s.center);           // beat and spin about the real centre
  beat.add(gltf.scene);
  R = s.radius;
  // the spin is about the vertical, so the tilted heart's lowest point never moves
  tilt.updateMatrixWorld(true);
  low = new THREE.Box3().setFromObject(tilt, true).min.y;
  section = makeSection(beat, gltf.scene, volume);
  ready = true;
  size();
});

const center = new THREE.Vector3(), target = new THREE.Vector3(), valve = new THREE.Vector3();

function size() {
  const b = cv.getBoundingClientRect();
  if (!b.width) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,
    (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 2));
  renderer.setSize(b.width, b.height, false);
  cam.aspect = b.width / b.height;
  // the heart takes ~100% of the height, or of the width on a portrait screen
  const fit = Math.min(1, cam.aspect);
  far = R / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / fit;
  // scene 1: close on the mitral valve, the left atrium above it, the ventricle below
  near = 0.15 / Math.max(fit, 0.6);
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
  // It dies out with the zoom, where the beating heart takes the beat over
  const beats = (gl && gl.beat) || 0, fp = beats % 1;
  // reduced motion: one still frame, with the valve leaking
  section.update(k, reduced ? 0.75 : beats);
  beat.scale.setScalar(1 + 0.05 * Math.exp(-fp * 7) * (1 - k));

  // the camera slides from the heart's centre onto the valve, which therefore lands
  // where the heart was: two thirds across, mid-height
  spin.updateMatrixWorld(true);
  beat.localToWorld(valve.copy(section.mitral));
  target.lerpVectors(center, valve, k);
  const dist = THREE.MathUtils.lerp(far, near, k);
  cam.position.set(target.x, target.y, target.z + dist);
  scene.fog.near = dist + THREE.MathUtils.lerp(-0.06, 0, k);
  scene.fog.far = dist + THREE.MathUtils.lerp(0.2, 0.16, k);
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
