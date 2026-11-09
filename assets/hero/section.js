import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Scene 1 cuts the hero heart open onto a beating one: beating-heart.glb, already cut on
// its four-chamber plane (its cut face towards +z), skinned, with a one-second beat. It is
// fitted inside the hero heart. A knife plane sweeps in from the front and comes to rest on
// its cut face: the hero heart's section is filled, a solid wall around the beating heart,
// which shows only through the opening the knife makes. Then the hero heart fades away,
// the beating heart is shown whole, and the camera closes in
// on the mitral valve. Everything is in the frame of the heart's `beat` group: hero heart
// centred, +z towards the camera once it faces front.

const GLB = document.getElementById('heart').dataset.section;
const BODY = 0xDFE5EB, RED = 0xEF233C;
const FIT = 0.92;                          // of the largest size that fits inside the hero heart
// red lines on the beating heart: the outline of its cut face, and the sharpest creases
const CREASE = Math.cos(THREE.MathUtils.degToRad(75));
const CUT_Z = 0.0195;                      // its cut face, in the mesh's own frame (m), left without lines
// the beat's own clock: systole over its first half (the aortic valve opens, the mitral
// leaflets meet), diastole over its second. The page's beats run diastole first
const PHASE = 0.5;
// the mitral leaflets ride two joints that slide towards each other to close the valve.
// Held this far apart (joint units), they never meet: the valve leaks
const LEFT_MIN = 2.88, RIGHT_MAX = 2.5;

// red lines that follow the skin: a second skinned mesh on the same skeleton, drawn as a
// wireframe of degenerate triangles (a, b, b), one per line
function outline(mesh) {
  const pos = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const key = i => `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
  const weld = new Map(), id = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    if (!weld.has(k)) weld.set(k, i);
    id[i] = weld.get(k);
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normals = [], cut = [], edges = new Map();
  for (let t = 0; t < index.count / 3; t++) {
    const v = [0, 1, 2].map(k => index.getX(t * 3 + k));
    a.fromBufferAttribute(pos, v[0]); b.fromBufferAttribute(pos, v[1]); c.fromBufferAttribute(pos, v[2]);
    const n = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    normals.push(n);
    cut.push(n.z > 0.9 && (a.z + b.z + c.z) / 3 > CUT_Z);
    for (let k = 0; k < 3; k++) {
      const p = id[v[k]], q = id[v[(k + 1) % 3]], e = p < q ? p + ':' + q : q + ':' + p;
      (edges.get(e) || edges.set(e, []).get(e)).push(t);
    }
  }
  const out = [];
  for (const [e, faces] of edges) {
    if (faces.length !== 2) continue;
    const [f, g] = faces;
    if (cut[f] || cut[g]) continue;
    if (normals[f].dot(normals[g]) > CREASE) continue;
    const [p, q] = e.split(':').map(Number);
    out.push(p, q, q);
  }
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'skinIndex', 'skinWeight']) geo.setAttribute(name, mesh.geometry.attributes[name]);
  geo.setIndex(out);
  const lines = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial({
    color: RED, wireframe: true, stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc
  }));
  lines.bind(mesh.skeleton, mesh.bindMatrix);
  lines.frustumCulled = false;
  lines.renderOrder = 1.5;                 // before the body, which clears the stencil it covers
  return lines;
}

// heart: the hero heart; volume: a closed copy of its surface, for its section
export function makeSection(beat, heart, volume) {
  const plane = new THREE.Plane();                        // world space, refreshed each frame
  const local = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);   // keeps z <= constant
  const toBeat = () => new THREE.Matrix4().copy(beat.matrixWorld).invert();

  // the hero heart: only its outer faces draw, so once the knife has taken its front off,
  // its back half (seen from inside) vanishes
  const fade = [];
  heart.traverse(o => {
    if (!o.isMesh || o === volume) return;
    for (const m of [o.material, ...o.children.map(c => c.material)]) {
      m.clippingPlanes = [plane];
      m.transparent = true;
      fade.push(m);
    }
    o.material.side = THREE.FrontSide;
  });

  // its section: the stencil counts the closed volume's faces behind the knife, so it is set
  // just where the knife has opened the hero heart. The beating heart draws only there (it
  // is not quite the hero heart's shape, and would show through its sides), then a second,
  // invisible pass of it zeroes the stencil wherever it ended up on top; the cap fills what
  // is left: the wall around it
  const count = (side, op) => new THREE.MeshBasicMaterial({
    side, clippingPlanes: [plane], depthWrite: false, depthTest: false, colorWrite: false,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op
  });
  volume.visible = false;
  for (const m of [count(THREE.BackSide, THREE.IncrementWrapStencilOp), count(THREE.FrontSide, THREE.DecrementWrapStencilOp)]) {
    const o = new THREE.Mesh(volume.geometry, m);
    o.renderOrder = 1;
    volume.parent.add(o);
  }
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({
    color: BODY, fog: false, transparent: true,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp
  }));
  cap.renderOrder = 3;
  cap.onAfterRender = r => r.clearStencil();
  beat.add(cap);
  fade.push(cap.material);

  beat.updateMatrixWorld(true);
  const start = new THREE.Box3().setFromObject(heart).applyMatrix4(toBeat());
  const top = start.max.z + 0.005;

  const holder = new THREE.Group();
  holder.visible = false;
  beat.add(holder);
  const s = { mitral: new THREE.Vector3(), rest: top, mixer: null, clip: null, left: null, right: null, masked: [] };

  new GLTFLoader().loadAsync(GLB).then(gltf => {
    const model = gltf.scene, skins = [];
    model.traverse(o => {
      if (o.isBone && /left_mitral_valve/.test(o.name)) s.left = o;
      if (o.isBone && /right_mitral_valve/.test(o.name)) s.right = o;
      if (o.isSkinnedMesh) skins.push(o);
    });
    for (const o of skins) {
      // opaque, and drawn before the cap: where it shows, the section stays open
      // white, with only the tissue's relief from the model's normal map
      o.material = new THREE.MeshLambertMaterial({
        color: BODY, side: THREE.DoubleSide, normalMap: o.material.normalMap,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc
      });
      o.renderOrder = 2;
      o.frustumCulled = false;
      const lines = outline(o);
      const cover = new THREE.SkinnedMesh(o.geometry, new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide, colorWrite: false, depthWrite: false, depthFunc: THREE.LessEqualDepth,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ZeroStencilOp
      }));
      cover.bind(o.skeleton, o.bindMatrix);
      cover.renderOrder = 2.5;
      cover.frustumCulled = false;
      o.parent.add(lines, cover);
      s.masked.push(o.material, lines.material);
    }
    s.mixer = new THREE.AnimationMixer(model);
    s.clip = gltf.animations[0];
    s.mixer.clipAction(s.clip).play();
    s.mixer.setTime(0);

    // fitted inside the hero heart, centre on centre, so the knife finds it there
    holder.add(model);
    const fit = () => {
      holder.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(model, true).applyMatrix4(toBeat());
    };
    let box = fit();
    const room = start.getSize(new THREE.Vector3()).divide(box.getSize(new THREE.Vector3()));
    holder.scale.setScalar(FIT * Math.min(room.x, room.y, room.z));
    box = fit();
    holder.position.sub(box.getCenter(new THREE.Vector3()).sub(start.getCenter(new THREE.Vector3())));
    box = fit();

    // the knife rests on the cut face; the camera aims between the leaflets' joints
    s.rest = box.max.z + 0.001;
    const m = toBeat();
    s.mitral.copy(s.left.getWorldPosition(new THREE.Vector3()).applyMatrix4(m))
      .add(s.right.getWorldPosition(new THREE.Vector3()).applyMatrix4(m)).multiplyScalar(0.5);
  });

  // e: the zoom, 0..1. beats: heartbeats elapsed
  function update(e, beats) {
    const k = THREE.MathUtils.smoothstep(e, 0.12, 0.6);
    local.constant = THREE.MathUtils.lerp(top, s.rest, k);
    beat.updateMatrixWorld(true);
    plane.copy(local).applyMatrix4(beat.matrixWorld);
    cap.position.z = local.constant;
    // once the cut is made, the hero heart and its section fade away. Fading, they stop
    // writing depth, or the hero heart's folds would hide the beating heart
    const op = 1 - THREE.MathUtils.smoothstep(e, 0.62, 0.78);
    for (const m of fade) { m.opacity = op; m.depthWrite = op > 0.99; }
    heart.visible = op > 0;
    cap.visible = op > 0 && k > 0;
    if (!s.mixer) return;
    holder.visible = e > 0.02;
    const whole = op < 0.99;               // the hero heart is going: no more opening to look through
    for (const m of s.masked) m.stencilFunc = whole ? THREE.AlwaysStencilFunc : THREE.NotEqualStencilFunc;
    s.mixer.setTime(((beats + PHASE) % 1) * s.clip.duration);
    s.left.position.x = Math.max(s.left.position.x, LEFT_MIN);
    s.right.position.x = Math.min(s.right.position.x, RIGHT_MAX);
  }

  update(0, 0, 0);
  return { update, mitral: s.mitral };
}
