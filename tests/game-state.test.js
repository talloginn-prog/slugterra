import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, SAVE_KEY } from '../src/game-state.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}

test('the complete quest requires briefing, three unique shards, the Warden and returning home', () => {
  const game = createGameState(memoryStorage());
  assert.equal(game.state.quest.stage, 'briefing');
  assert.equal(game.interact('shard-west').event, 'briefing-required');
  assert.equal(game.state.shards, 0);
  assert.equal(game.interact('guide').event, 'quest-started');
  game.interact('shard-west');
  assert.equal(game.interact('shard-west').event, 'already-collected');
  game.interact('shard-east');
  assert.equal(game.state.quest.stage, 'shards');
  assert.equal(game.interact('shard-depths').event, 'boss-unlocked');
  assert.equal(game.state.shards, 3);
  assert.equal(game.state.quest.stage, 'boss');
  assert.equal(game.addKill({ boss: true }).event, 'boss-defeated');
  assert.equal(game.state.won, false);
  assert.equal(game.state.quest.stage, 'return');
  assert.equal(game.interact('guide').event, 'quest-complete');
  assert.equal(game.state.won, true);
  assert.equal(game.state.quest.stage, 'complete');
  assert.ok(game.state.level >= 3);
});

test('slug cooldowns recover independently, and Tide restores shield and vitality', () => {
  const game = createGameState(null);
  assert.equal(game.fire().damage, 34);
  assert.equal(game.fire(), null);
  game.tick(0.7);
  assert.ok(game.fire());
  game.selectSlug(1);
  assert.equal(game.fire().element, 'electric');
  game.damage(60);
  assert.equal(game.state.shield, 0);
  assert.equal(game.state.health, 80);
  game.selectSlug(2);
  assert.equal(game.fire().element, 'water');
  assert.equal(game.state.health, 84);
  assert.equal(game.state.shield, 8);
  assert.equal(game.selectSlug(999), false);
});

test('fatal damage returns a respawn event and retains quest progress', () => {
  const game = createGameState(null);
  game.interact('guide');
  game.interact('shard-east');
  const event = game.damage(999);
  assert.equal(event.event, 'respawn');
  assert.equal(game.state.deaths, 1);
  assert.equal(game.state.health, game.state.maxHealth);
  assert.equal(game.state.shards, 1);
  assert.equal(game.state.position.z, 35);
});

test('progress survives reloading with settings and a bounded player position', () => {
  const storage = memoryStorage();
  const game = createGameState(storage);
  game.start();
  game.interact('guide');
  game.interact('shard-west');
  game.selectSlug(2);
  game.setSetting('sensitivity', 1.5);
  game.save({ x: 20, y: 4, z: -15 });
  const restored = createGameState(storage);
  assert.equal(restored.hasSave(), true);
  assert.equal(restored.start().event, 'restored');
  assert.equal(restored.state.shards, 1);
  assert.equal(restored.state.selectedSlug, 2);
  assert.equal(restored.state.settings.sensitivity, 1.5);
  assert.deepEqual(restored.state.position, { x: 20, y: 4, z: -15 });
  restored.start({ fresh: true });
  assert.equal(restored.state.shards, 0);
  assert.equal(restored.state.quest.stage, 'briefing');
});

test('corrupt, incompatible and hostile saves cannot break startup', () => {
  const storage = memoryStorage();
  for (const data of ['not-json', 'null', '[]', '{"version":2,"collected":[]}', '{"version":1}']) {
    storage.setItem(SAVE_KEY, data);
    const game = createGameState(storage);
    assert.equal(game.hasSave(), false);
    assert.doesNotThrow(() => game.start());
    assert.equal(game.state.level, 1);
  }
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, collected: ['shard-west', 'shard-west', 'fake'], level: -100, health: -12, won: true, selectedSlug: 900, settings: { sensitivity: 'huge' }, position: { x: 1e99, z: 'bad' } }));
  const game = createGameState(storage);
  game.start();
  assert.equal(game.state.level, 1);
  assert.equal(game.state.health, 1);
  assert.equal(game.state.shards, 1);
  assert.equal(game.state.won, false);
  assert.equal(game.state.selectedSlug, 2);
  assert.deepEqual(game.state.position, { x: 94, y: 3, z: 35 });
});

test('denied storage remains playable and shield regenerates only after taking a break', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
  const game = createGameState(storage);
  assert.doesNotThrow(() => game.start());
  assert.equal(game.save(), false);
  game.damage(10);
  const shield = game.state.shield;
  for (let i = 0; i < 6; i++) game.tick(1);
  assert.equal(game.state.shield, shield);
  for (let i = 0; i < 4; i++) game.tick(1);
  assert.ok(game.state.shield > shield);
});

test('changing title-screen settings preserves a previous expedition', () => {
  const storage = memoryStorage();
  const original = createGameState(storage);
  original.start();
  original.interact('guide');
  original.interact('shard-depths');
  original.save({ x: 12, y: 4, z: -22 });
  const titleScreen = createGameState(storage);
  titleScreen.setSetting('sound', false);
  const resumed = createGameState(storage);
  resumed.start();
  assert.equal(resumed.state.shards, 1);
  assert.equal(resumed.state.quest.stage, 'shards');
  assert.equal(resumed.state.settings.sound, false);
  assert.equal(resumed.state.position.z, -22);
});
