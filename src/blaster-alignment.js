import * as THREE from 'three';

// These three uploaded exports all have their barrel pointing along source -X.
// Their grip is on +X. The sign is verified from the authored barrel/chamber
// nodes, rather than guessed from whichever bounding-box dimension is longest.
const SOURCE_YAW = Object.freeze({
  standard: -Math.PI / 2,
  breaker: -Math.PI / 2,
  rapid: -Math.PI / 2,
});

export function alignImportedBlaster(scene, id) {
  if (!scene || !Object.hasOwn(SOURCE_YAW, id)) return null;
  const group = new THREE.Group(), content = new THREE.Group();
  content.rotation.y = SOURCE_YAW[id]; content.add(scene); group.add(content);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(content), size = box.getSize(new THREE.Vector3());
  const ratio = 0.72 / Math.max(size.z, 0.0001);
  const tip = new THREE.Vector3(), point = new THREE.Vector3(); let count = 0;
  content.traverse(object => {
    if (!object.isMesh || !object.geometry.attributes.position) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (point.z <= box.min.z + size.z * 0.025) { tip.add(point); count++; }
    }
  });
  if (count) tip.divideScalar(count); else tip.set(0, box.getCenter(new THREE.Vector3()).y, box.min.z);
  content.scale.setScalar(ratio);
  content.position.set(-tip.x * ratio, 0.055 - tip.y * ratio, -0.553 - tip.z * ratio);
  group.updateMatrixWorld(true);
  group.name = `Uploaded ${id} blaster`; group.userData.importedModelId = id;
  group.userData.muzzle = { x: 0, y: 0.055, z: -0.553 };
  const chamberName = { standard: 'Object_47', breaker: 'Object_34', rapid: 'Object_37' }[id];
  const chamber = scene.getObjectByName(chamberName);
  if (chamber) {
    const bounds = new THREE.Box3().setFromObject(chamber), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    group.userData.cartridge = { center: center.toArray(), size: size.toArray(), node: chamberName };
  }
  return group;
}
