import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { alignImportedBlaster } from '../src/blaster-alignment.js';

const assets = [
  { id: 'standard', file: 'blaster', barrel: 'Cylinder011_24', chamber: 'Cylinder002_12', grip: 'Cube_2' },
  { id: 'breaker', file: 'x-duty', barrel: 'Cylinder014_17', chamber: 'Cylinder_12', grip: 'Cylinder013_7' },
  { id: 'rapid', file: 'renegade', barrel: 'Cylinder002_13', chamber: 'Cube001_5', grip: 'Mag_3' },
];

// Load the real geometry and hierarchy without decoding texture images: Node
// has no ImageBitmap, and image decoding is unrelated to the barrel direction.
async function geometryScene(file) {
  const bytes = await readFile(new URL(`../src/assets/models/runtime/${file}.glb`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  document.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
  delete document.images; delete document.textures;
  const removeTextures = value => {
    for (const key of Object.keys(value)) {
      if (/texture/i.test(key)) delete value[key];
      else if (value[key] && typeof value[key] === 'object') removeTextures(value[key]);
    }
  };
  for (const material of document.materials || []) removeTextures(material);
  const nativeProgressEvent = globalThis.ProgressEvent;
  if (!nativeProgressEvent) globalThis.ProgressEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  try { return (await new GLTFLoader().parseAsync(JSON.stringify(document), '')).scene; }
  finally { if (!nativeProgressEvent) delete globalThis.ProgressEvent; }
}

for (const asset of assets) test(`${asset.id} real uploaded barrel faces forward in first- and third-person mounts`, async () => {
  const scene = await geometryScene(asset.file), weapon = alignImportedBlaster(scene, asset.id);
  const barrel = scene.getObjectByName(asset.barrel), chamber = scene.getObjectByName(asset.chamber), grip = scene.getObjectByName(asset.grip);
  assert.ok(barrel && chamber && grip, 'the authored barrel/chamber/grip anchors must exist');
  weapon.updateMatrixWorld(true);
  const at = object => object.getWorldPosition(new THREE.Vector3());
  assert.ok(at(barrel).z < at(grip).z - 0.2, 'barrel must be ahead of the grip, away from the player');
  assert.ok(at(barrel).sub(at(chamber)).normalize().dot(new THREE.Vector3(0, 0, -1)) > 0.9999);
  const size = new THREE.Box3().setFromObject(weapon).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.z - 0.72) < 1e-5, 'existing weapon scale is preserved');
  assert.deepEqual(weapon.userData.muzzle, { x: 0, y: 0.055, z: -0.553 });
  // A camera mount and the player-avatar hand both rotate this same -Z front.
  for (const [yaw, pitch] of [[0.45, 0.2], [Math.PI, 0], [-1.1, -0.35]]) {
    const mount = new THREE.Group(); mount.rotation.set(pitch, yaw, 0, 'YXZ'); mount.add(weapon); mount.updateMatrixWorld(true);
    const actual = at(barrel).sub(at(chamber)).normalize();
    const expected = new THREE.Vector3(0, 0, -1).applyQuaternion(mount.quaternion);
    assert.ok(actual.dot(expected) > 0.9999, 'authored barrel must follow the mount aim at every heading');
    mount.remove(weapon);
  }
});
