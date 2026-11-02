import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewController } from '../src/camera-view.js';

test('P-style toggling returns to the original first-person eye position', () => {
  const view = createViewController(), eye = { x: 3, y: 4, z: 5 };
  assert.equal(view.mode, 'first-person');
  assert.deepEqual(view.cameraPosition(eye, 0, 0, () => { throw Error('first person needs no camera sweep'); }), eye);
  assert.equal(view.toggle(), true); assert.equal(view.mode, 'third-person');
  assert.equal(view.toggle(), false);
  assert.deepEqual(view.cameraPosition(eye), eye);
  assert.notEqual(view.cameraPosition(eye), eye, 'placement must not mutate the player vector');
  assert.equal(view.setThirdPerson(true), true);
  assert.equal(view.setThirdPerson(false), false);
});

test('third-person camera follows behind the look direction at different headings', () => {
  const view = createViewController(); view.toggle();
  const north = view.cameraPosition({ x: 0, y: 2, z: 0 }, 0, 0);
  assert.deepEqual(north, { x: 0, y: 2.45, z: 4.2 });
  const west = view.cameraPosition({ x: 0, y: 2, z: 0 }, Math.PI / 2, 0);
  assert.ok(Math.abs(west.x - 4.2) < 1e-9 && Math.abs(west.z) < 1e-9);
  const raisedAim = view.cameraPosition({ x: 0, y: 2, z: 0 }, 0, Math.PI / 4);
  assert.ok(raisedAim.z > 0 && raisedAim.z < north.z);
  assert.ok(raisedAim.y < north.y);
});

test('a solid wall retracts the camera with clearance and a close wall overrides minimum distance', () => {
  const view = createViewController({ minDistance: 0.35, padding: 0.22 }); view.toggle();
  const eye = { x: 0, y: 2, z: 0 };
  const blocked = view.cameraPosition(eye, 0, 0, () => 0.5);
  assert.ok(blocked.z < 2.1 && blocked.z > 1.7);
  const veryClose = view.cameraPosition(eye, 0, 0, () => 0.01);
  assert.deepEqual(veryClose, eye);
  assert.deepEqual(view.cameraPosition(eye, 0, 0, () => 0), eye);
});

test('near-plane edge probes prevent clipping a corner missed by the center ray', () => {
  const view = createViewController(); view.toggle();
  let centerClear = false, edgeHit = false;
  const camera = view.cameraPosition({ x: 0, y: 2, z: 0 }, 0, 0, (start, end) => {
    // A wall begins at z=3 and extends to the right of x=.1.
    const t = 3 / end.z;
    if (t < 0 || t > 1) return null;
    if (end.x * t >= 0.1) { edgeHit = true; return t; }
    if (end.x === 0 && end.y === 2.45) centerClear = true;
    return null;
  });
  assert.equal(centerClear, true); assert.equal(edgeHit, true);
  assert.ok(camera.z < 3, 'camera must remain in front of the corner');
});

test('clear space recovers full follow distance immediately without interpolation through walls', () => {
  const view = createViewController(); view.toggle();
  const eye = { x: 1, y: 2, z: 3 };
  assert.deepEqual(view.cameraPosition(eye, 0, 0, () => 0), eye);
  assert.deepEqual(view.cameraPosition(eye, 0, 0, () => null), { x: 1, y: 2.45, z: 7.2 });
});

test('edge probes stay in the camera near-plane when aiming upward at an angle', () => {
  const view = createViewController(); view.toggle();
  const ends = [];
  view.cameraPosition({ x: 0, y: 0, z: 0 }, 0.8, 0.7, (start, end) => { ends.push(end); return null; });
  const center = ends[0];
  for (const end of ends.slice(1)) {
    const offset = { x: end.x - center.x, y: end.y - center.y, z: end.z - center.z };
    assert.ok(Math.abs(offset.x * center.x + offset.y * center.y + offset.z * center.z) < 1e-9);
    assert.ok(Math.abs(Math.hypot(offset.x, offset.y, offset.z) - 0.22) < 1e-9);
  }
});

test('invalid positions, angles and callback fractions cannot produce a nonfinite camera', () => {
  const view = createViewController({ distance: Infinity, minDistance: NaN, padding: -10 }); view.toggle();
  for (const fraction of [null, undefined, NaN, Infinity, -1, 2]) {
    const camera = view.cameraPosition({ x: Infinity, y: NaN, z: -Infinity }, Infinity, NaN, () => fraction);
    assert.ok(Object.values(camera).every(Number.isFinite));
    assert.ok(Math.hypot(camera.x, camera.y, camera.z) <= 5);
  }
  assert.deepEqual(createViewController(null).cameraPosition(null), { x: 0, y: 0, z: 0 });
});
