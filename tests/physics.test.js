import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterPhysics, segmentSphereHit, segmentCapsuleHit, firstTerrainHit } from '../src/physics.js';

function make(options = {}) {
  const position = options.position || { x: 0, y: 1.85, z: 0 };
  return { position, controller: createCharacterPhysics({ position, groundHeight: () => 0, ...options }) };
}

test('jump keeps momentum, permits air control and lands stably without held-key bunny hops', () => {
  const { position, controller } = make();
  for (let i = 0; i < 60; i++) controller.step(1 / 120, { x: 1 });
  const before = position.x;
  controller.step(1 / 120, { x: 1, jump: true });
  assert.equal(controller.grounded, false);
  assert.ok(controller.velocity.y > 0);
  for (let i = 0; i < 120; i++) controller.step(1 / 120, { z: 1, jump: true });
  assert.ok(position.x > before + 0.5);
  assert.ok(position.z > 2);
  assert.equal(controller.grounded, true);
  assert.equal(position.y, 1.85);
  controller.step(1 / 120, { jump: true });
  assert.equal(controller.grounded, true);
  controller.step(1 / 120, { jump: false });
  controller.step(1 / 120, { jump: true });
  assert.equal(controller.grounded, false);
});

test('movement and friction agree at 30, 60 and 144Hz', () => {
  const outcomes = [30, 60, 144].map(rate => {
    const { position, controller } = make();
    for (let i = 0; i < rate * 2; i++) controller.step(1 / rate, { x: 1, z: -1, sprint: true });
    for (let i = 0; i < rate / 2; i++) controller.step(1 / rate, {});
    assert.ok(Math.hypot(controller.velocity.x, controller.velocity.z) < 0.01);
    return position;
  });
  for (const result of outcomes) assert.ok(Math.hypot(result.x - outcomes[0].x, result.z - outcomes[0].z) < 0.005);
});

test('swept character collisions stop high-speed tunneling and allow wall sliding', () => {
  const { position, controller } = make({ colliders: [{ x: 4, z: 0, radius: 0.5 }] });
  controller.velocity.x = 1000;
  controller.step(1 / 120, {});
  assert.ok(position.x <= 4 - 0.5 - 0.38 + 0.001);
  assert.ok(position.x > 2.5);
  assert.equal(controller.velocity.x, 0);
  const sliding = make({ colliders: [{ x: 3, z: 0, radius: 1 }] });
  for (let i = 0; i < 120; i++) sliding.controller.step(1 / 120, { x: 1, z: 0.4 });
  assert.ok(sliding.position.z > 1);
  assert.ok(Math.hypot(sliding.position.x - 3, sliding.position.z) >= 1.38 - 0.001);
});

test('ground follows a walkable slope but refuses an abrupt high ledge', () => {
  const slope = make({ groundHeight: x => x * 0.3 });
  for (let i = 0; i < 120; i++) slope.controller.step(1 / 120, { x: 1 });
  assert.equal(slope.controller.grounded, true);
  assert.ok(Math.abs(slope.position.y - (slope.position.x * 0.3 + 1.85)) < 1e-6);
  const ledge = make({ groundHeight: x => x >= 2 ? 2 : 0 });
  for (let i = 0; i < 120; i++) ledge.controller.step(1 / 120, { x: 1 });
  assert.ok(ledge.position.x < 2);
  assert.equal(ledge.position.y, 1.85);
  const stair = make({ groundHeight: x => x >= 2 ? 0.3 : 0 });
  for (let i = 0; i < 120; i++) stair.controller.step(1 / 120, { x: 1 });
  assert.ok(stair.position.x > 2);
  assert.equal(stair.position.y, 2.15);
});

test('height filtering permits jumping over low obstacles and bounds contain the capsule', () => {
  const high = make({ position: { x: 0, y: 6, z: 0 }, colliders: [{ x: 1, z: 0, radius: 0.5, top: 1 }], bounds: 3 });
  high.controller.velocity.x = 300;
  high.controller.step(1 / 120, { x: 1 });
  assert.ok(high.position.x > 1.5);
  for (let i = 0; i < 120; i++) high.controller.step(1 / 120, { x: 1 });
  assert.ok(Math.hypot(high.position.x, high.position.z) <= 3 - 0.38 + 1e-6);
});

test('jumping against a tall terrain wall cannot snap the character onto its top', () => {
  const wall = make({ groundHeight: x => x >= 2 ? 5 : 0 });
  wall.controller.step(1 / 120, { x: 1, jump: true });
  for (let i = 0; i < 120; i++) wall.controller.step(1 / 120, { x: 1 });
  assert.ok(wall.position.x < 2);
  assert.equal(wall.position.y, 1.85);
});

test('segment intersections return earliest fractions, initial overlaps and exact misses', () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 20, y: 0, z: 0 };
  const near = segmentSphereHit(a, b, { x: 5, y: 0, z: 0 }, 1);
  const far = segmentSphereHit(a, b, { x: 12, y: 0, z: 0 }, 2);
  assert.equal(near, 0.2);
  assert.equal(far, 0.5);
  assert.ok(near < far);
  assert.equal(segmentSphereHit(a, a, a, 1), 0);
  assert.equal(segmentSphereHit(a, b, { x: 5, y: 2, z: 0 }, 1), null);
  assert.equal(segmentCapsuleHit({ x: -5, y: 1, z: 0 }, { x: 5, y: 1, z: 0 }, a, 0.5, 1.5), 0.45);
  assert.equal(segmentCapsuleHit({ x: 0, y: 4, z: 0 }, { x: 0, y: -4, z: 0 }, a, 0.5, 1.5), 0.25);
  assert.equal(segmentCapsuleHit(a, b, a, 0.5, 1.5), 0);
});

test('terrain sweep catches a narrow ridge between projectile endpoints and refines impact', () => {
  const terrain = x => Math.abs(x - 3) <= 0.11 ? 3 : 0;
  const hit = firstTerrainHit({ x: 0, y: 2, z: 0 }, { x: 10, y: 2, z: 0 }, terrain);
  assert.ok(hit !== null && hit >= 0.288 && hit <= 0.29);
  assert.equal(firstTerrainHit({ x: 0, y: 0, z: 0 }, { x: 10, y: 2, z: 0 }, terrain), 0);
  assert.equal(firstTerrainHit({ x: 0, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }, terrain), null);
});
