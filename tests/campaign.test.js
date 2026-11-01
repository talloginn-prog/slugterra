import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, SAVE_KEY, CAMPAIGN_SAVE_KEY } from '../src/game-state.js';
import { BLASTERS, SKILLS } from '../src/content.js';

function memoryStorage(initial = []) {
  const map = new Map(initial);
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
const legacy = () => JSON.stringify({ version: 1, collected: ['shard-west'], level: 3, health: 112, shield: 22, xp: 27, selectedSlug: 2, questStarted: true, settings: { sound: false, quality: 'low', sensitivity: 1.4 }, position: { x: 12, y: 5, z: -20 } });

test('campaign migration preserves exact v1 data while restoring legacy progress and defaults', () => {
  const original = legacy();
  const storage = memoryStorage([[SAVE_KEY, original]]);
  const game = createGameState(storage);
  assert.equal(game.start().event, 'restored');
  assert.equal(game.state.currentCavern, 'luminous');
  assert.deepEqual(game.state.equippedSlugs, ['ember', 'volt', 'tide']);
  assert.equal(game.state.shards, 1);
  assert.equal(game.state.level, 3);
  assert.equal(game.state.settings.sound, false);
  assert.equal(game.state.settings.sensitivity, 1.4);
  assert.deepEqual(game.state.position, { x: 12, y: 5, z: -20 });
  assert.equal(storage.getItem(SAVE_KEY), original);
  assert.equal(JSON.parse(storage.getItem(CAMPAIGN_SAVE_KEY)).version, 2);
  game.travel('dark-spores');
  assert.equal(storage.getItem(SAVE_KEY), original);
  assert.equal(createGameState(storage).state.currentCavern, 'dark-spores');
});

test('failed or silently dropped campaign writes keep a legacy save recoverable', () => {
  for (const write of [() => { throw new Error('quota'); }, () => {}]) {
    const original = legacy();
    const storage = { getItem: key => key === SAVE_KEY ? original : null, setItem: write, removeItem() { throw new Error('must not remove legacy'); } };
    const game = createGameState(storage);
    assert.doesNotThrow(() => game.start());
    assert.equal(game.save(), false);
    assert.equal(storage.getItem(SAVE_KEY), original);
    assert.equal(createGameState(storage).state.shards, 1);
  }
});

test('corrupted campaign data falls back to v1 and hostile campaign fields are bounded', () => {
  const storage = memoryStorage([[SAVE_KEY, legacy()], [CAMPAIGN_SAVE_KEY, '{broken']]);
  const game = createGameState(storage);
  assert.equal(game.state.shards, 1);
  game.start();
  const valid = JSON.parse(storage.getItem(CAMPAIGN_SAVE_KEY));
  Object.assign(valid, { coins: -999, ownedSlugs: ['__proto__', 'frost'], equippedSlugs: ['frost', 'frost', 'unknown'], currentCavern: 'pyrite', skills: ['mastery'], skillCooldowns: { mastery: -100 }, position: { x: 1e20, y: -1e20, z: 'bad' }, cavernProgress: { pyrite: { defeated: ['good:encounter', '__proto__', {}], discoveries: ['glow', 'fake'] } } });
  storage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(valid));
  const restored = createGameState(storage);
  assert.equal(restored.state.coins, 0);
  assert.equal(restored.state.slugs.length, 3);
  assert.equal(new Set(restored.state.equippedSlugs).size, 3);
  assert.equal(restored.state.ownedSlugs.includes('__proto__'), false);
  assert.deepEqual(restored.state.skills, []);
  assert.equal(restored.state.position.x, 94);
  assert.equal(restored.state.position.y, -10);
  assert.equal(restored.state.position.z, 35);
});

test('travel persists per-cavern positions, discoveries and checkpoint respawn without resetting legacy shards', () => {
  const storage = memoryStorage();
  const game = createGameState(storage);
  game.interact('guide'); game.interact('shard-west');
  game.save({ x: 8, y: 4, z: 14 });
  assert.equal(game.travel('unknown').ok, false);
  assert.equal(game.travel('dark-spores', { x: -2, y: 5, z: 18 }).ok, true);
  game.discoverSlug('doc');
  game.setCheckpoint('dark-spores', { x: -3, y: 7, z: 11 });
  assert.equal(game.setCheckpoint('pyrite', { x: 0, y: 0, z: 0 }).ok, false);
  game.travel('pyrite');
  game.save({ x: 17, y: 3, z: -11 });
  game.travel('luminous');
  assert.deepEqual(game.state.position, { x: 8, y: 4, z: 14 });
  assert.equal(game.state.shards, 1);
  game.travel('pyrite');
  assert.deepEqual(game.state.position, { x: 17, y: 3, z: -11 });
  const event = game.damage(999);
  assert.equal(event.event, 'respawn');
  assert.equal(event.cavernId, 'dark-spores');
  assert.deepEqual(event.position, { x: -3, y: 7, z: 11 });
  const restored = createGameState(storage);
  assert.equal(restored.state.currentCavern, 'dark-spores');
  assert.equal(restored.state.ownedSlugs.includes('doc'), true);
  assert.equal(restored.state.shards, 1);
  assert.equal(restored.state.cavernProgress.pyrite.position.x, 17);
});

test('discoveries and encounter rewards are idempotent across travel and reload', () => {
  const storage = memoryStorage();
  const game = createGameState(storage);
  game.travel('dark-spores');
  assert.equal(game.discoverSlug('doc').ok, true);
  const afterDiscovery = { coins: game.state.coins, xp: game.state.xp };
  assert.equal(game.discoverSlug('doc').event, 'already-discovered');
  assert.deepEqual({ coins: game.state.coins, xp: game.state.xp }, afterDiscovery);
  assert.equal(game.completeEncounter('dark-spores:guard-1', { coins: 17, xp: 20 }).ok, true);
  const afterEncounter = { coins: game.state.coins, xp: game.state.xp };
  game.travel('pyrite');
  assert.equal(game.completeEncounter('dark-spores:guard-1', { coins: 17, xp: 20 }).ok, false);
  assert.deepEqual({ coins: game.state.coins, xp: game.state.xp }, afterEncounter);
  const restored = createGameState(storage);
  assert.equal(restored.completeEncounter('dark-spores:guard-1', { coins: 17, xp: 20 }).ok, false);
  assert.equal(restored.state.cavernProgress['dark-spores'].defeated.includes('dark-spores:guard-1'), true);
  const kills = restored.state.kills;
  restored.addKill({ encounterId: 'pyrite:guard-1' });
  restored.addKill({ encounterId: 'pyrite:guard-1' });
  assert.equal(restored.state.kills, kills + 1);
});

test('loadout ownership, flight locks and identity recovery cannot be bypassed by swapping slots', () => {
  const game = createGameState(null);
  assert.equal(game.equipSlug('frost', 0).ok, false);
  game.discoverSlug('frost');
  game.fire();
  const emberCooldown = game.state.slugs[0].cooldown;
  game.state.slugs[0].inFlight = true;
  assert.equal(game.equipSlug('frost', 0).event, 'companion-in-flight');
  assert.equal(game.travel('pyrite').event, 'companion-in-flight');
  game.state.slugs[0].inFlight = false;
  assert.equal(game.equipSlug('frost', 0).ok, true);
  game.tick(0.2);
  assert.equal(game.equipSlug('ember', 0).ok, true);
  assert.ok(Math.abs(game.state.slugs[0].cooldown - (emberCooldown - 0.2)) < 1e-9);
  assert.equal(game.fire(), null);
  assert.equal(game.equipSlug('volt', 0).ok, false);
  assert.equal(game.equipSlug('frost', 3).ok, false);
  assert.equal(game.state.slugs.length, 3);
});

test('blaster purchases enforce prices and ownership, then provide actual damage/recovery tradeoffs', () => {
  const game = createGameState(null);
  assert.equal(game.equipBlaster('breaker').ok, false);
  assert.equal(game.buyBlaster('unknown').ok, false);
  const breaker = BLASTERS.find(item => item.id === 'breaker');
  assert.equal(game.buyBlaster('breaker').ok, true);
  assert.equal(game.state.coins, 100 - breaker.price);
  assert.equal(game.buyBlaster('breaker').event, 'already-owned');
  assert.equal(game.buyBlaster('rapid').event, 'insufficient-coins');
  const shot = game.fire();
  assert.equal(shot.damage, 34 * breaker.damageMultiplier);
  assert.equal(game.state.slugs[0].cooldown, 0.7 * breaker.cooldownMultiplier);
  assert.equal(game.equipBlaster('standard').ok, true);
});

test('skill prerequisites, payment, timed activation and recovery survive saves', () => {
  const storage = memoryStorage();
  const game = createGameState(storage);
  assert.equal(game.useSkill('slug-fu').event, 'skill-not-learned');
  assert.equal(game.learnSkill('mastery').event, 'prerequisite-required');
  assert.equal(game.learnSkill('slug-fu').ok, true);
  const balance = game.state.coins;
  assert.equal(game.learnSkill('slug-fu').ok, false);
  assert.equal(game.state.coins, balance);
  assert.equal(game.useSkill('slug-fu').ok, true);
  const skill = SKILLS.find(item => item.id === 'slug-fu');
  assert.equal(game.state.activeSkills['slug-fu'], skill.duration);
  assert.equal(game.useSkill('slug-fu').event, 'skill-cooling');
  for (let i = 0; i < 4; i++) game.tick(1);
  assert.equal(game.state.activeSkills['slug-fu'], 0);
  assert.equal(game.state.skillCooldowns['slug-fu'], 8);
  game.save();
  const restored = createGameState(storage);
  assert.equal(restored.state.skillCooldowns['slug-fu'], 8);
  assert.equal(restored.state.activeSkills['slug-fu'], undefined);
  for (let i = 0; i < 8; i++) restored.tick(1);
  assert.equal(restored.useSkill('slug-fu').ok, true);
});

test('campaign reset retains settings, and unsupported settings leave them unchanged', () => {
  const game = createGameState(memoryStorage());
  assert.equal(game.setSetting('quality', 'ultra'), true);
  assert.equal(game.setSetting('difficulty', 'hard'), true);
  assert.equal(game.setSetting('difficulty', 'nightmare'), false);
  game.discoverSlug('glow'); game.travel('pyrite');
  game.start({ fresh: true });
  assert.equal(game.state.currentCavern, 'luminous');
  assert.deepEqual(game.state.ownedSlugs, ['ember', 'volt', 'tide']);
  assert.equal(game.state.settings.quality, 'ultra');
  assert.equal(game.state.settings.difficulty, 'hard');
});
