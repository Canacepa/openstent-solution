import * as THREE from 'three';

// Scene 1 cuts the hero heart open onto a real one: heart-anatomy.glb (HuBMAP's 3D
// reference heart, from the Visible Human), whose parts are named and modelled with
// their wall thickness: chambers, septum, valves, papillary muscles. It is stood up like
// the hero heart and set inside it; one knife plane, sweeping in from the front, cuts
// both and comes to rest just in front of the mitral valve. Everything is in the frame
// of the heart's `beat` group: hero heart centred, +z towards the camera.

const SIZE = 1.3, DROP = -0.025;           // anatomy -> beat frame, fitted on the hero heart
const AHEAD = 0.007;                       // where the knife stops, in front of the valve
const WHITE = 0xffffff, RED = 0xB3222A, CREAM = 0xF3F0E6;

const find = (root, part) => {
  let hit = null;
  root.traverse(o => { if (o.isMesh && o.name.includes(part)) hit = o; });
  return hit;
};
const centre = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());

// The model comes in body coordinates, where the heart lies on its side. Stand it up
// from its own anatomy: the axis from the mitral valve to the apex points down, and the
// right ventricle sits to the left of the left one, as on the hero heart seen from the front.
function stand(model) {
  model.updateMatrixWorld(true);
  const valve = centre(find(model, 'mitral_valve'));
  const lv = find(model, 'heart_left_ventricle');
  const pos = lv.geometry.attributes.position, v = new THREE.Vector3(), apex = new THREE.Vector3();
  let far = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(lv.matrixWorld);
    const d = v.distanceTo(valve);
    if (d > far) { far = d; apex.copy(v); }
  }
  const down = new THREE.Quaternion().setFromUnitVectors(apex.sub(valve).normalize(), new THREE.Vector3(0, -1, 0));
  const across = centre(find(model, 'heart_right_ventricle')).sub(centre(lv)).applyQuaternion(down);
  across.y = 0;
  return new THREE.Quaternion().setFromUnitVectors(across.normalize(), new THREE.Vector3(-1, 0, 0)).multiply(down);
}

export function makeSection(beat, heart, anatomy) {
  const plane = new THREE.Plane();                        // world space, refreshed each frame
  const local = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);   // keeps z <= constant

  // the hero heart: only its outer faces draw, so once the knife has taken its front off
  // its back half (seen from inside) vanishes and the anatomy shows through the opening
  const fade = [];
  heart.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [o.material, ...o.children.map(c => c.material)]) {
      m.clippingPlanes = [plane];
      m.transparent = true;
      fade.push(m);
    }
    o.material.side = THREE.FrontSide;
  });

  // the anatomy, stood up and fitted inside the hero heart
  const turn = new THREE.Group();
  turn.quaternion.copy(stand(anatomy));
  turn.add(anatomy);
  turn.position.sub(new THREE.Box3().setFromObject(turn).getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(turn);
  holder.scale.setScalar(SIZE);
  holder.position.y = DROP;
  beat.add(holder);

  // Lit white outside like the hero heart. The walls are solid shells, so where the knife
  // opens one, its inside faces show: those are drawn flat red, and read as the cut
  // muscle. The mitral valve is cream on both sides, outlined in red.
  const meshes = [];
  anatomy.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const valve = /mitral_valve/.test(o.name);
    o.material = new THREE.MeshLambertMaterial({ color: valve ? CREAM : WHITE, clippingPlanes: [plane] });
    o.add(new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({
      color: valve ? CREAM : RED, side: THREE.BackSide, clippingPlanes: [plane]
    })));
    if (valve) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25),
      new THREE.LineBasicMaterial({ color: RED, clippingPlanes: [plane] })));
  }

  // the camera's target, and the knife's travel: from in front of both hearts to just
  // in front of the valve
  beat.updateMatrixWorld(true);
  const toBeat = new THREE.Matrix4().copy(beat.matrixWorld).invert();
  const mitral = centre(find(anatomy, 'mitral_valve')).applyMatrix4(toBeat);
  const front = Math.max(new THREE.Box3().setFromObject(heart).applyMatrix4(toBeat).max.z,
    new THREE.Box3().setFromObject(holder).applyMatrix4(toBeat).max.z) + 0.005;
  const rest = mitral.z + AHEAD;

  function update(e) {
    const k = THREE.MathUtils.smoothstep(e, 0.12, 0.75);
    local.constant = THREE.MathUtils.lerp(front, rest, k);
    beat.updateMatrixWorld(true);
    plane.copy(local).applyMatrix4(beat.matrixWorld);
    // what the knife leaves of the hero heart (its creases, a sliver here and there)
    // fades out behind it
    for (const m of fade) m.opacity = 1 - THREE.MathUtils.smoothstep(k, 0.2, 0.8);
    holder.visible = e > 0.02;
  }

  update(0);
  return { update, mitral };
}
