import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCavern } from '../src/caverns.js';
import { CAVERNS } from '../src/content.js';

function solids(world) {
  const result = [];
  world.group.updateMatrixWorld(true);
  world.group.traverse(object => { if (object.isMesh && object.userData.collisionSolid === true) result.push(object); });
  return result;
}
function cast(objects, origin, direction, distance = 150) {
  return new THREE.Raycaster(origin, direction, 0, distance).intersectObjects(objects, false);
}

test('each cavern exposes physical structures without turning terrain, water or foliage into walls', () => {
  for (const id of Object.keys(CAVERNS)) {
    const world = createCavern(THREE, { id, quality: 'low' });
    try {
      assert.equal(world.collisionReady, true);
      const physical = solids(world);
      assert.ok(physical.length >= 15, `${id} needs full structure coverage`);
      assert.ok(physical.some(object => object.isInstancedMesh), `${id} instanced solids must collide`);
      assert.ok(physical.some(object => object.geometry.type === 'BufferGeometry'), `${id} merged structures must collide`);
      world.group.traverse(object => {
        if (!object.isMesh) return;
        if (object.geometry.type === 'PlaneGeometry' || object.material?.transparent) assert.notEqual(object.userData.collisionSolid, true);
      });
      const origin = new THREE.Vector3(world.spawn.x, world.groundHeight(world.spawn.x, world.spawn.z) + 2, world.spawn.z);
      assert.ok(cast(physical, origin, new THREE.Vector3(0, 1, 0)).length > 0, `${id} has a physical overhead enclosure`);
    } finally { world.dispose(); }
  }
});

test('passage gates have physical frames and open centers instead of filled collision cylinders', () => {
  for (const id of Object.keys(CAVERNS)) {
    const world = createCavern(THREE, { id, quality: 'low' });
    try {
      const physical = solids(world);
      for (const gate of world.interactables.filter(item => item.type === 'portal')) {
        const { x, y, z } = gate.position;
        const direction = new THREE.Vector3(0, 0, 1);
        assert.equal(cast(physical, new THREE.Vector3(x, y + 1, z - 1), direction, 2).length, 0, `${id}/${gate.id} doorway stays open`);
        assert.ok(cast(physical, new THREE.Vector3(x + 1.75, y + 1, z - 1), direction, 2).length > 0, `${id}/${gate.id} support is solid`);
      }
    } finally { world.dispose(); }
  }
});

test('legacy rocks and the merchant counter supply real visible collision surfaces', () => {
  const world = createCavern(THREE, { id: 'luminous', quality: 'low' });
  try {
    const physical = solids(world);
    const rocks = physical.find(object => object.isInstancedMesh && object.geometry.type === 'DodecahedronGeometry' && object.count > 200);
    assert.ok(rocks, 'river rocks and stepping stones are physical, including their instance transforms');
    const matrix = new THREE.Matrix4(); rocks.getMatrixAt(0, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    assert.ok(cast([rocks], position.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0), 20).length > 0);
    const x = 11, z = 34.6, floor = world.groundHeight(x, 37);
    const hits = cast(physical, new THREE.Vector3(x, floor + 2, z), new THREE.Vector3(0, -1, 0), 2);
    assert.ok(hits.length > 0, 'the blaster stall counter has a top surface');
    assert.ok(hits[0].point.y > floor + 0.9);
  } finally { world.dispose(); }
});

test('befriending a discovery hides the companion display but keeps its physical pedestal visible', () => {
  const world = createCavern(THREE, { id: 'dark-spores', quality: 'low' });
  try {
    const discovery = world.interactables.find(item => item.type === 'discovery');
    const physical = solids(world);
    const pedestal = physical.find(object => object.geometry.type === 'CylinderGeometry' && object.geometry.parameters.radiusTop === 0.7);
    assert.ok(pedestal);
    discovery.object.visible = false;
    assert.equal(pedestal.visible, true);
    assert.equal(pedestal.parent, world.group, 'no invisible solid remains inside the hidden display');
  } finally { world.dispose(); }
});
