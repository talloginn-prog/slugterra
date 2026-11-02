import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { CAVERNS, SLUG_CATALOG } from '../src/content.js';
import { createCavern } from '../src/caverns.js';
import { createSlugModel } from '../src/models.js';
import { createSceneCollision } from '../src/collision.js';
import { createCharacterPhysics } from '../src/physics.js';

function solidFingerprint(world) {
  const hash = createHash('sha256'); world.group.updateMatrixWorld(true);
  world.group.traverse(object => {
    if (!object.isMesh || object.userData.collisionSolid !== true) return;
    hash.update(JSON.stringify(object.matrixWorld.elements));
    const positions = object.geometry.attributes.position.array;
    hash.update(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength));
    if (object.isInstancedMesh) { const instances = object.instanceMatrix.array; hash.update(new Uint8Array(instances.buffer, instances.byteOffset, instances.byteLength)); }
  });
  return hash.digest('hex');
}

test('Quiet Lawn and Snowdance have distinct complete expeditions and reciprocal lift routes', () => {
  for (const id of ['quiet-lawn', 'snowdance']) {
    const world = createCavern(THREE, { id, quality: 'low' });
    try {
      assert.equal(world.id, id);
      assert.equal(world.collisionReady, true);
      const portals = world.interactables.filter(item => item.type === 'portal');
      assert.deepEqual(portals.map(item => item.target).sort(), [...CAVERNS[id].connections].sort());
      for (const gate of portals) assert.ok(CAVERNS[gate.target].connections.includes(id));
      assert.equal(world.interactables.filter(item => item.type === 'checkpoint').length, 1);
      assert.equal(world.interactables.filter(item => item.type === 'survey').length, 1);
      assert.equal(world.enemySpawns.length, 4);
      for (const spawn of world.enemySpawns) assert.ok(Number.isFinite(world.groundHeight(spawn.x, spawn.z)));
      const discoveries = world.interactables.filter(item => item.type === 'discovery').map(item => item.slugId);
      assert.deepEqual(discoveries, id === 'snowdance' ? ['rammstone'] : ['arachnet', 'fandango']);
      for (const slugId of discoveries) assert.ok(SLUG_CATALOG[slugId]);
    } finally { world.dispose(); }
  }
});

test('new lift centers allow a real capsule to walk through while their frames remain solid', () => {
  for (const id of ['quiet-lawn', 'snowdance']) {
    const world = createCavern(THREE, { id, quality: 'low' });
    const collision = createSceneCollision(world.group);
    try {
      for (const gate of world.interactables.filter(item => item.type === 'portal')) {
        const { x, z } = gate.position;
        const position = { x, y: world.groundHeight(x, z - 2) + 1.85, z: z - 2 };
        const actor = createCharacterPhysics({ position, groundHeight: world.groundHeight, getCollisionWorld: () => collision });
        for (let frame = 0; frame < 120; frame++) actor.step(1 / 120, { z: 1 });
        assert.ok(position.z > z + 1.5, `${id}/${gate.id} has a passable doorway`);
        const side = { x: x + 1.75, y: gate.position.y + 1, z: z - 1 };
        assert.notEqual(collision.segmentHit(side, { ...side, z: z + 1 }), null);
      }
    } finally { collision.dispose(); world.dispose(); }
  }
});

test('new-cavern quality settings retain exactly the same physical layout', () => {
  for (const id of ['quiet-lawn', 'snowdance']) {
    const low = createCavern(THREE, { id, quality: 'low' });
    const ultra = createCavern(THREE, { id, quality: 'ultra' });
    try { assert.equal(solidFingerprint(low), solidFingerprint(ultra), `${id} solids must not move around a saved player`); }
    finally { low.dispose(); ultra.dispose(); }
  }
});

test('new species retain distinct protoform and Velocimorph geometry', () => {
  const fingerprints = new Set();
  for (const id of ['rammstone', 'arachnet', 'fandango']) for (const morphed of [false, true]) {
    const model = createSlugModel(THREE, SLUG_CATALOG[id], { morphed });
    assert.equal(model.userData.archetype, id);
    assert.equal(model.userData.form, morphed ? 'velocimorph' : 'protoform');
    const hash = createHash('sha256');
    model.traverse(object => { if (object.isMesh) { const data = object.geometry.attributes.position.array; assert.ok(data.every(Number.isFinite)); hash.update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)); } });
    fingerprints.add(hash.digest('hex'));
    const bounds = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    assert.ok(morphed ? bounds.z > .9 : bounds.y > .7);
    const seen = new Set(); model.traverse(object => { for (const resource of [object.geometry, object.material]) if (resource && !seen.has(resource)) { seen.add(resource); resource.dispose(); } });
  }
  assert.equal(fingerprints.size, 6);
});
