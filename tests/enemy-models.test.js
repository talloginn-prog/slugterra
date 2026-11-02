import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEnemyVisual } from '../src/enemy-models.js';

test('outlaw geometry is grounded at its declared combat center and weapon points forward', () => {
  const visual = createEnemyVisual(THREE);
  visual.root.remove(visual.hpGroup);
  const bounds = new THREE.Box3().setFromObject(visual.root);
  assert.ok(Math.abs(bounds.min.y + visual.centerHeight) < .025);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - visual.height) < .1);
  visual.root.updateMatrixWorld(true);
  const muzzle = visual.muzzle.getWorldPosition(new THREE.Vector3());
  assert.ok(muzzle.z < -.6, 'muzzle must point along local -Z in front of the body');
  assert.ok(muzzle.y > 0 && muzzle.y < 1);
  assert.equal(visual.root.userData.enemyType, 'slinger');
});

test('walking articulates limbs without moving the actor root off its physical ground position', () => {
  const visual = createEnemyVisual(THREE);
  const original = visual.root.position.clone();
  const transforms = () => {
    const values = []; visual.root.traverse(node => { if (node.isGroup) values.push(...node.rotation.toArray().slice(0, 3)); }); return values;
  };
  const before = transforms();
  for (let frame = 0; frame < 20; frame++) visual.updatePose({ dt: 1 / 60, speed: 2.4, time: frame / 60, phase: 'patrol' });
  assert.notDeepEqual(transforms(), before);
  assert.deepEqual(visual.root.position, original);
  visual.updatePose({ speed: 0, phase: 'windup', telegraph: .8, aimPitch: .2 });
  assert.ok(visual.eye.material.emissiveIntensity > 3);
});

test('the Warden keeps a distinct large body and grounded articulated legs', () => {
  const visual = createEnemyVisual(THREE, { boss: true });
  visual.root.remove(visual.hpGroup);
  const bounds = new THREE.Box3().setFromObject(visual.root);
  assert.equal(visual.root.userData.enemyType, 'warden');
  assert.ok(Math.abs(bounds.min.y + visual.centerHeight) < .05);
  assert.ok(visual.height > 5 && visual.radius > 2);
  assert.doesNotThrow(() => visual.updatePose({ dt: 1 / 60, speed: 2, time: 1, telegraph: .5 }));
});
