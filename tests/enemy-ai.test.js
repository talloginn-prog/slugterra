import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemyBrain } from '../src/enemy-ai.js';

const position = { x: 0, z: 0 };
const target = { x: 6, y: 1.8, z: 0 };
const input = { position, target, lineOfSight: true };
const step = (brain, seconds, data = input, rate = 120) => {
  const events = [];
  for (let i = 0; i < Math.ceil(seconds * rate); i++) events.push(brain.update(1 / rate, data));
  return events;
};
const until = (brain, predicate, data = input, maxSeconds = 5, rate = 120) => {
  for (let i = 0; i < maxSeconds * rate; i++) {
    const intent = brain.update(1 / rate, data);
    if (predicate(intent)) return intent;
  }
  assert.fail('Enemy did not reach the expected state');
};

test('an enemy visibly winds up, fires once, and offers a recovery window', () => {
  const brain = createEnemyBrain();
  assert.equal(brain.update(1 / 120, input).phase, 'alert');
  const windup = until(brain, intent => intent.phase === 'windup');
  assert.equal(windup.telegraph, 0);
  assert.equal(windup.fire, false);
  const buildup = step(brain, brain.tuning.windup - 0.04);
  assert.ok(buildup.every(intent => !intent.fire));
  assert.ok(buildup.at(-1).telegraph > 0.8);
  const shot = until(brain, intent => intent.fire);
  assert.equal(shot.phase, 'recovery');
  assert.deepEqual(shot.aimPoint, target);
  const recovery = step(brain, brain.tuning.recovery - 0.04);
  assert.ok(recovery.every(intent => intent.phase === 'recovery' && !intent.fire));
  assert.ok(recovery.some(intent => Math.hypot(intent.move.x, intent.move.z) > 0), 'recovery keeps the guard mobile without firing');
  assert.ok(recovery.every(intent => Math.hypot(intent.move.x, intent.move.z) <= .5));
  const next = until(brain, intent => intent.fire);
  assert.equal(next.fire, true);
});

test('locked aim makes a windup dodgeable instead of tracking a strafing player', () => {
  const brain = createEnemyBrain();
  until(brain, intent => intent.phase === 'windup');
  const movingTarget = { ...input, target: { x: 5, y: 2.5, z: 4 } };
  const shot = until(brain, intent => intent.fire, movingTarget);
  assert.deepEqual(shot.aimPoint, target);
  assert.notDeepEqual(shot.aimPoint, movingTarget.target);
  shot.aimPoint.x = 999;
  assert.equal(brain.update(1 / 120, movingTarget).aimPoint, null);
});

test('cover blocks attacks and cancels a committed tell into recovery', () => {
  const brain = createEnemyBrain();
  const covered = { ...input, lineOfSight: false };
  const attempts = step(brain, 4, covered);
  assert.ok(attempts.every(intent => !intent.fire));
  assert.equal(attempts.at(-1).phase, 'patrol', 'unseen targets do not grant omniscient pursuit');
  until(brain, intent => intent.phase === 'windup');
  const interrupted = brain.update(1 / 120, covered);
  assert.equal(interrupted.phase, 'recovery');
  assert.equal(interrupted.fire, false);
  assert.equal(interrupted.telegraph, 0);
  const afterCover = step(brain, brain.tuning.recovery - 0.04);
  assert.ok(afterCover.every(intent => !intent.fire));
  assert.equal(afterCover.at(-1).phase, 'recovery');
});

test('leashed enemies return home without attacking a player along the route', () => {
  const brain = createEnemyBrain({ home: { x: 4, z: 3 } });
  const outside = { position: { x: 29, z: 3 }, target: { x: 28, y: 2, z: 3 }, lineOfSight: true };
  const retreat = brain.update(1 / 120, outside);
  assert.equal(retreat.phase, 'return');
  assert.deepEqual(retreat.move, { x: -1, z: 0 });
  assert.equal(retreat.fire, false);
  const midway = { ...outside, position: { x: 10, z: 3 } };
  assert.ok(step(brain, 4, midway).every(intent => intent.phase === 'return' && !intent.fire));
  const home = { position: { x: 4, z: 3 }, target: { x: 8, y: 2, z: 3 }, lineOfSight: true };
  assert.notEqual(brain.update(1 / 120, home).phase, 'return');
  const reengaged = until(brain, intent => intent.fire, home);
  assert.equal(reengaged.fire, true);
});

test('stagger interrupts windup and retains a full recovery rather than a free immediate shot', () => {
  const brain = createEnemyBrain();
  until(brain, intent => intent.phase === 'windup');
  const stunned = brain.update(1 / 120, { ...input, stagger: 0.5 });
  assert.equal(stunned.phase, 'stagger');
  assert.equal(stunned.telegraph, 0);
  assert.ok(step(brain, 0.45).every(intent => intent.phase === 'stagger' && !intent.fire));
  until(brain, intent => intent.phase === 'recovery');
  assert.ok(step(brain, brain.tuning.recovery - 0.04).every(intent => !intent.fire));
  assert.equal(until(brain, intent => intent.fire).fire, true);
});

test('difficulty changes counterplay timings and damage, while bosses retain a longer tell', () => {
  const easy = createEnemyBrain({ difficulty: 'easy' });
  const normal = createEnemyBrain();
  const hard = createEnemyBrain({ difficulty: 'hard' });
  assert.ok(easy.tuning.windup > normal.tuning.windup);
  assert.ok(hard.tuning.windup < normal.tuning.windup);
  assert.ok(easy.update(0, input).damageMultiplier < 1);
  assert.ok(hard.update(0, input).damageMultiplier > 1);
  assert.ok(easy.tuning.recovery > hard.tuning.recovery);
  const boss = createEnemyBrain({ boss: true });
  assert.ok(boss.tuning.windup > normal.tuning.windup);
  assert.ok(boss.tuning.leashRadius > normal.tuning.leashRadius);
  assert.equal(createEnemyBrain({ difficulty: 'unknown' }).tuning.windup, normal.tuning.windup);
});

test('first-shot timing is stable at 30, 60 and 120Hz, and no hostile target means no shot', () => {
  const times = [30, 60, 120].map(rate => {
    const brain = createEnemyBrain();
    for (let i = 1; i <= 3 * rate; i++) if (brain.update(1 / rate, input).fire) return i / rate;
    assert.fail('No shot');
  });
  assert.ok(Math.max(...times) - Math.min(...times) < 0.045);
  const brain = createEnemyBrain();
  assert.ok(step(brain, 5, { position, target: { x: 90, z: 0 }, lineOfSight: true }).every(intent => !intent.fire));
  assert.ok(step(brain, 5, { position, target: null, lineOfSight: true }).every(intent => !intent.fire));
});

test('invalid time and positions cannot advance an attack or produce invalid movement', () => {
  const brain = createEnemyBrain({ home: { x: NaN, z: Infinity } });
  until(brain, intent => intent.phase === 'windup');
  for (const dt of [NaN, Infinity, -1, undefined]) {
    const intent = brain.update(dt, { ...input, position: { x: NaN, z: Infinity } });
    assert.equal(intent.fire, false);
    assert.equal(intent.telegraph, 0);
    assert.ok(Number.isFinite(intent.move.x) && Number.isFinite(intent.move.z));
  }
  brain.reset();
  assert.equal(brain.phase, 'patrol');
  assert.equal(brain.update(0, { position }).fire, false);
});


test('unengaged guards actually traverse a bounded patrol circuit', () => {
  const home = { x: 7, z: -4 }, brain = createEnemyBrain({ home });
  const position = { ...home }, positions = [];
  for (let tick = 0; tick < 120 * 24; tick++) {
    const intent = brain.update(1 / 120, { position, target: { x: 90, z: 90 }, lineOfSight: false });
    assert.equal(intent.phase, 'patrol'); assert.equal(intent.fire, false);
    position.x += intent.move.x * 3 / 120; position.z += intent.move.z * 3 / 120;
    positions.push({ ...position });
    assert.ok(Math.hypot(position.x - home.x, position.z - home.z) <= brain.tuning.patrolRadius + .1);
  }
  assert.ok(positions.some(p => Math.hypot(p.x - home.x, p.z - home.z) > 3));
  assert.ok(Math.max(...positions.map(p => p.z)) - Math.min(...positions.map(p => p.z)) > 4);
});

test('guards close distant targets, sidestep at combat range and back away from close threats', () => {
  const far = createEnemyBrain().update(1 / 120, { position, target: { x: 17, y: 2, z: 0 }, lineOfSight: true });
  assert.ok(far.move.x > .9);
  const lateral = createEnemyBrain().update(1 / 120, { position, target: { x: 8, y: 2, z: 0 }, lineOfSight: true });
  assert.ok(Math.abs(lateral.move.z) > .5); assert.equal(lateral.move.x, 0);
  const retreat = createEnemyBrain().update(1 / 120, { position, target: { x: 2, y: 2, z: 0 }, lineOfSight: true });
  assert.ok(retreat.move.x < -.5);
});

test('a guard searches its last sighting without tracking a hidden player through cover', () => {
  const brain = createEnemyBrain(); brain.update(1 / 120, input);
  const hidden = { position, target: { x: -6, y: 2, z: 8 }, lineOfSight: false };
  const searching = brain.update(1 / 120, hidden);
  assert.equal(searching.phase, 'search'); assert.ok(searching.move.x > 0);
  assert.deepEqual(searching.lookAt, target);
  assert.ok(step(brain, brain.tuning.searchDuration + .1, hidden).every(intent => !intent.fire));
  assert.equal(brain.phase, 'patrol');
});

test('blocked patrol feedback selects another route instead of walking into the same wall forever', () => {
  const brain = createEnemyBrain();
  const initial = brain.update(1 / 120, { position, lineOfSight: false });
  const attempts = step(brain, .8, { position, blocked: true, lineOfSight: false });
  const rerouted = attempts.at(-1);
  assert.equal(rerouted.phase, 'patrol');
  assert.ok(Math.abs(initial.move.x - rerouted.move.x) + Math.abs(initial.move.z - rerouted.move.z) > .3);
});
