import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, CAMPAIGN_SAVE_KEY } from '../src/game-state.js';
import { CAVERNS, SLUG_CATALOG } from '../src/content.js';
import { calculateDisplay } from '../src/display.js';

function storage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; }

test('expanded routes are reciprocal and retain old campaign progress across both new caverns', () => {
  for (const [id, cavern] of Object.entries(CAVERNS)) for (const connected of cavern.connections) assert.ok(CAVERNS[connected]?.connections.includes(id), `${id} must have a return route from ${connected}`);
  const save = storage(), game = createGameState(save); game.start(); game.interact('guide');
  for (const id of ['dark-spores', 'quiet-lawn', 'snowdance', 'pyrite', 'luminous']) assert.equal(game.travel(id).ok, true);
  assert.equal(game.state.questStarted, true);
  assert.deepEqual(game.state.visitedCaverns, ['luminous', 'dark-spores', 'quiet-lawn', 'snowdance', 'pyrite']);
  const restored = createGameState(save);
  assert.deepEqual(restored.state.visitedCaverns, game.state.visitedCaverns);
  assert.equal(restored.state.currentCavern, 'luminous');
});

test('new companion discoveries can be equipped, restored and fired with their distinct support properties', () => {
  const save = storage(), game = createGameState(save); game.start();
  for (const [slot, id] of ['rammstone', 'arachnet', 'fandango'].entries()) {
    assert.equal(game.discoverSlug(id).ok, true); assert.equal(game.equipSlug(id, slot).ok, true);
  }
  const earnedCoins = game.state.coins, earnedXP = game.state.xp;
  assert.equal(game.discoverSlug('rammstone').event, 'already-discovered');
  assert.equal(game.state.coins, earnedCoins); assert.equal(game.state.xp, earnedXP);
  const restored = createGameState(save); restored.start();
  assert.deepEqual(restored.state.equippedSlugs, ['rammstone', 'arachnet', 'fandango']);
  for (const [slot, id] of restored.state.equippedSlugs.entries()) {
    restored.selectSlug(slot); const shot = restored.fire();
    assert.equal(shot.id, id); assert.equal(shot.morphSpeed, 44.7);
    assert.equal(shot.element, SLUG_CATALOG[id].element);
    if (id === 'rammstone') assert.equal(shot.knockback, 2.8);
    if (id === 'arachnet') assert.equal(shot.rootDuration, 2.6);
  }
  assert.ok(SLUG_CATALOG.rammstone.knockback > 0);
  assert.ok(SLUG_CATALOG.arachnet.rootDuration > 0);
});

test('a rejected shot does not consume Fandango support and an energy shot never boosts itself', () => {
  const game = createGameState(storage()); game.start();
  game.discoverSlug('fandango'); game.equipSlug('fandango', 0);
  game.selectSlug(1); game.fire(); // Joules is recovering when support starts.
  game.selectSlug(0); const firstSupport = game.fire();
  assert.equal(firstSupport.damage, SLUG_CATALOG.fandango.damage);
  assert.equal(firstSupport.energyBoosted, false);
  game.selectSlug(1); assert.equal(game.fire(), null);
  assert.equal(game.state.energyBoost, 6, 'a cooldown rejection must retain support for a successful shot');
  game.tick(1); game.tick(1);
  game.selectSlug(0); const renewedSupport = game.fire();
  assert.equal(renewedSupport.energyBoosted, false);
  assert.equal(renewedSupport.damage, SLUG_CATALOG.fandango.damage);
  assert.equal(game.state.energyBoost, 6, 'support refreshes its window without stacking');
  game.selectSlug(1); assert.equal(game.fire().damage, SLUG_CATALOG.volt.damage * 1.25);
  assert.equal(game.state.energyBoost, 0);
});

test('reloading retains the support companion but cannot restore a temporary active boost', () => {
  const save = storage(), game = createGameState(save); game.start();
  game.discoverSlug('fandango'); game.equipSlug('fandango', 0); game.fire(); game.save();
  assert.equal(game.state.energyBoost, 6);
  const restored = createGameState(save); restored.start();
  assert.equal(restored.state.equippedSlugs[0], 'fandango');
  assert.equal(restored.state.energyBoost, 0);
  restored.selectSlug(1); assert.equal(restored.fire().energyBoosted, false);
});

test('Fandango restores shield and boosts exactly the next other shot within its support window', () => {
  const game = createGameState(storage()); game.start();
  for (const id of ['fandango', 'rammstone']) assert.equal(game.discoverSlug(id).ok, true);
  game.equipSlug('fandango', 0); game.equipSlug('rammstone', 1); game.state.shield = 5;
  game.selectSlug(0); const support = game.fire();
  assert.equal(support.energyBoosted, false); assert.equal(game.state.energyBoost, 6); assert.equal(game.state.shield, 19);
  game.selectSlug(1); const boosted = game.fire();
  assert.equal(boosted.energyBoosted, true); assert.equal(boosted.damage, SLUG_CATALOG.rammstone.damage * 1.25); assert.equal(game.state.energyBoost, 0);
  game.selectSlug(2); assert.equal(game.fire().energyBoosted, false);
  for (let second = 0; second < 2; second++) game.tick(1);
  game.selectSlug(0); game.state.shield = game.state.maxShield - 2; game.fire();
  assert.equal(game.state.shield, game.state.maxShield);
  for (let second = 0; second < 7; second++) game.tick(1);
  game.selectSlug(1); assert.equal(game.fire().energyBoosted, false, 'expired support must not strengthen a later shot');
});

test('ultrawide framing and render-limit preferences survive saves and reject unsupported settings', () => {
  const save = storage(), game = createGameState(save); game.start();
  game.setSetting('aspectRatio', '21:9'); game.setSetting('resolution', '3440x1440');
  const restored = createGameState(save); assert.equal(restored.state.settings.aspectRatio, '21:9'); assert.equal(restored.state.settings.resolution, '3440x1440');
  const display = calculateDisplay({ width: 5120, height: 2160, pixelRatio: 2, ...restored.state.settings });
  assert.equal(display.width, 3440); assert.equal(display.height, 1440); assert.equal(display.bufferWidth, 3440); assert.equal(display.bufferHeight, 1440);
  restored.setSetting('aspectRatio', '32:9'); restored.setSetting('resolution', '99999x99999');
  assert.equal(restored.state.settings.aspectRatio, '21:9'); assert.equal(restored.state.settings.resolution, '3440x1440');
  const payload = JSON.parse(save.getItem(CAMPAIGN_SAVE_KEY)); payload.settings.aspectRatio = 'broken'; payload.settings.resolution = 'broken'; save.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(payload));
  const sanitized = createGameState(save); assert.equal(sanitized.state.settings.aspectRatio, 'auto'); assert.equal(sanitized.state.settings.resolution, 'auto');
});

test('every supported display preference persists independently of quality and survives a fresh journey', () => {
  for (const aspectRatio of ['auto', '16:9', '21:9']) for (const resolution of ['auto', '1920x1080', '2560x1080', '3440x1440']) {
    const save = storage(), game = createGameState(save); game.start();
    assert.equal(game.setSetting('quality', 'low'), true);
    assert.equal(game.setSetting('aspectRatio', aspectRatio), true);
    assert.equal(game.setSetting('resolution', resolution), true);
    const restored = createGameState(save); restored.start();
    assert.equal(restored.state.settings.aspectRatio, aspectRatio);
    assert.equal(restored.state.settings.resolution, resolution);
    assert.equal(restored.state.settings.quality, 'low');
    restored.start({ fresh: true });
    assert.equal(restored.state.settings.aspectRatio, aspectRatio);
    assert.equal(restored.state.settings.resolution, resolution);
  }
});
