/* Real WebGL coverage for the additive campaign. Existing browser-smoke.cjs
 * retains the complete original expedition/combat/input/touch checks. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baseURL = process.env.CAMPAIGN_GAME_URL || 'http://127.0.0.1:4177';
const timeout = 45000;

function testRecording() {
  const samples = 2205, bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(22050, 24); bytes.writeUInt32LE(44100, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(i / 22050 * Math.PI * 1100) * 6000), 44 + i * 2);
  return bytes;
}

async function approach(page, type, match = {}) {
  const target = await page.evaluate(({ type, match }) => {
    const g = window.__SLUGTERRA__;
    const entry = g.world.interactables.find(item => item.type === type && Object.entries(match).every(([key, value]) => item[key] === value));
    if (!entry) throw new Error(`No ${type} interactable ${JSON.stringify(match)} in ${g.world.id}`);
    g.teleport(entry.position.x, entry.position.z + 2.6);
    g.lookAt(entry.position.x, entry.position.y + 1.7, entry.position.z);
    return { id: entry.id, name: entry.name };
  }, { type, match });
  await page.waitForFunction(() => !document.querySelector('#interact-prompt').hidden, undefined, { timeout });
  await page.keyboard.press('e');
  return target;
}

async function gate(page, target) {
  const previous = await page.evaluate(() => window.__SLUGTERRA__.world.id);
  await approach(page, 'portal', { target });
  await page.waitForFunction(id => window.__SLUGTERRA__.world.id === id && window.__SLUGTERRA__.game.state.currentCavern === id, target, { timeout });
  assert.notEqual(previous, target);
  assert.equal(await page.evaluate(() => window.__SLUGTERRA__.audio === window.__campaignAudio), true);
  assert.equal(await page.evaluate(() => window.__SLUGTERRA__.audio.getStatus().clips.includes('blaster')), true);
}

async function shootMorph(page, id, expectedAlias) {
  await page.waitForFunction(() => window.__SLUGTERRA__.game.state.slugs.every(slug => !slug.inFlight && slug.cooldown === 0), undefined, { timeout });
  const before = await page.evaluate(() => {
    const g = window.__SLUGTERRA__;
    // The old (3,28) fixture faces a now-solid root only ~1 m from the
    // muzzle. Test transformation in a clear lane; cover is tested separately.
    g.teleport(8, 25); g.lookAt(8, g.player.y + 50, -45);
    g.launcher.updateWorldMatrix(true, false);
    const start = g.launcher.localToWorld(g.blaster.muzzle.clone());
    const direction = g.camera.getWorldDirection(g.player.clone());
    if (g.world.collisionWorld.segmentHit(start, start.clone().addScaledVector(direction, 12)) !== null) throw new Error('Transformation fixture must have a clear acceleration lane');
    return { shots: g.combatStats.shots, morphs: g.combatStats.morphs, aliases: window.__campaignMorphAliases.length };
  });
  await page.keyboard.press('1');
  await page.keyboard.press('f');
  await page.waitForFunction(({ id, morphs }) => {
    const g = window.__SLUGTERRA__;
    return g.combatStats.morphs > morphs && g.projectiles.some(p => !p.hostile && p.slug.id === id && p.morphed && p.morph.visible && !p.proto.visible && p.speed >= 44.7);
  }, { id, morphs: before.morphs }, { timeout });
  assert.ok(await page.evaluate(n => window.__SLUGTERRA__.combatStats.shots > n, before.shots));
  assert.equal(await page.evaluate(n => window.__campaignMorphAliases.slice(n).includes('water'), before.aliases), expectedAlias === 'water');
  if (expectedAlias !== 'water') assert.equal(await page.evaluate(({ n, alias }) => window.__campaignMorphAliases.slice(n).includes(alias), { n: before.aliases, alias: expectedAlias }), true);
  await page.waitForFunction(() => window.__SLUGTERRA__.game.state.slugs.every(slug => !slug.inFlight), undefined, { timeout });
}

async function equipSlotOne(page, id) {
  await page.keyboard.press('i');
  await page.waitForFunction(() => document.querySelector('[data-equip-slug]'), undefined, { timeout });
  await page.locator(`[data-equip-slug="${id}"][data-equip-slot="0"]`).click();
  await page.waitForFunction(id => window.__SLUGTERRA__.game.state.equippedSlugs[0] === id && window.__SLUGTERRA__.launcher.userData.loadedSlugId === id, id, { timeout });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing', undefined, { timeout });
}

async function clearEncounter(page, cave) {
  // One enemy per new cavern must be defeated by an actual input-generated shot.
  // Reduce only its HP to bound software-WebGL runtime; movement, aiming,
  // projectile acceleration, sweeps, impact and reward handling remain real.
  const targetId = await page.evaluate(() => {
    const g = window.__SLUGTERRA__, enemy = g.enemies.find(e => !e.dead);
    if (!enemy) throw new Error('Expected a live encounter');
    enemy.hp = 1;
    g.teleport(enemy.root.position.x, enemy.root.position.z + 6.5);
    g.lookAt(enemy.root.position.x, enemy.root.position.y, enemy.root.position.z);
    window.__campaignPhases = [];
    const observe = () => {
      if (!enemy.dead) { if (!window.__campaignPhases.includes(enemy.phase)) window.__campaignPhases.push(enemy.phase); requestAnimationFrame(observe); }
    };
    requestAnimationFrame(observe);
    return enemy.encounterId;
  });
  await page.waitForFunction(() => window.__campaignPhases.includes('windup') && window.__campaignPhases.includes('recovery'), undefined, { timeout });
  await page.keyboard.down('f');
  try {
    await page.waitForFunction(id => window.__SLUGTERRA__.game.state.completedEncounters.includes(id), targetId, { timeout });
  } finally { await page.keyboard.up('f'); }
  await page.waitForFunction(() => window.__SLUGTERRA__.game.state.slugs.every(slug => !slug.inFlight), undefined, { timeout });
  assert.equal(await page.evaluate(({ cave, id }) => window.__SLUGTERRA__.game.state.cavernProgress[cave].defeated.includes(id), { cave, id: targetId }), true);
  // Remaining guards are fixture setup, not claimed as additional combat wins.
  await page.evaluate(() => {
    const g = window.__SLUGTERRA__;
    for (const enemy of g.enemies) if (!enemy.dead) {
      enemy.dead = true; enemy.root.visible = false;
      g.game.completeEncounter(enemy.encounterId, { coins: 0, xp: 0 });
    }
    g.teleport(0, 28); g.game.save(g.player);
  });
  return targetId;
}

async function main() {
  const server = process.env.CAMPAIGN_GAME_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  const errors = [];
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(baseURL)).ok) break; } catch { /* Dev server is starting. */ }
      if (attempt === 99) throw new Error('Campaign Vite server did not become ready');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.setDefaultTimeout(timeout);
    await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__SLUGTERRA__, undefined, { timeout });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#setting-quality').selectOption('low');
    await page.locator('#setting-difficulty').selectOption('easy');
    await page.locator('[data-audio-slot="blaster"]').setInputFiles({ name: 'campaign-test-tone.wav', mimeType: 'audio/wav', buffer: testRecording() });
    await page.waitForFunction(() => window.__SLUGTERRA__.audio.getStatus().clips.includes('blaster') && window.__SLUGTERRA__.audio.getStatus().readyBundledClips.length === 3, undefined, { timeout });
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.locator('#begin-button').click();
    if (await page.locator('#confirm-restart').isVisible()) await page.locator('#confirm-restart').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing', undefined, { timeout });
    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      window.__campaignAudio = g.audio; window.__campaignMorphAliases = [];
      const morph = g.audio.morph;
      g.audio.morph = element => { window.__campaignMorphAliases.push(element); return morph(element); };
    });
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

    await approach(page, 'npc', { role: 'trainer' });
    await page.locator('[data-learn-skill="slug-fu"]').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.skills.includes('slug-fu') && window.__SLUGTERRA__.game.state.coins === 60, undefined, { timeout });
    await page.keyboard.press('Escape');
    await approach(page, 'npc', { role: 'merchant' });
    await page.locator('[data-blaster="breaker"]').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.equippedBlaster === 'breaker' && window.__SLUGTERRA__.game.state.coins === 0, undefined, { timeout });
    await page.keyboard.press('Escape');
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.activeSkills['slug-fu'] > 0 && window.__SLUGTERRA__.mode === 'playing', undefined, { timeout });
    console.log('PASS: E conversations open trainer/merchant; real purchases, ownership and R skill activation');

    await approach(page, 'discovery', { slugId: 'frost' });
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.ownedSlugs.includes('frost'), undefined, { timeout });
    await equipSlotOne(page, 'frost');
    await shootMorph(page, 'frost', 'water');
    console.log('PASS: Frostcrawler rescue, slot equipment, chamber identity and actual ice Velocimorph with mapped bundled audio');

    await gate(page, 'dark-spores');
    await approach(page, 'checkpoint');
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.checkpoint.cavernId === 'dark-spores', undefined, { timeout });
    const forestEnemy = await clearEncounter(page, 'dark-spores');
    await approach(page, 'discovery', { slugId: 'doc' });
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.ownedSlugs.includes('doc'), undefined, { timeout });
    await equipSlotOne(page, 'doc');
    await shootMorph(page, 'doc', 'electric');
    await approach(page, 'survey');
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.cavernProgress['dark-spores'].completed, undefined, { timeout });
    const forestCoins = await page.evaluate(() => window.__SLUGTERRA__.game.state.coins);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.completeCavern('dark-spores').ok), false);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.coins), forestCoins);
    await page.screenshot({ path: path.join(root, 'test-results/campaign-dark-spores.png') });
    console.log('PASS: Dark Spores real combat windup/recovery, checkpoint, Doc discovery/morph and idempotent survey');

    await gate(page, 'pyrite');
    const pyriteEnemy = await clearEncounter(page, 'pyrite');
    await approach(page, 'discovery', { slugId: 'glow' });
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.ownedSlugs.includes('glow'), undefined, { timeout });
    await equipSlotOne(page, 'glow');
    await shootMorph(page, 'glow', 'electric');
    await approach(page, 'survey');
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.cavernProgress.pyrite.completed, undefined, { timeout });
    await page.screenshot({ path: path.join(root, 'test-results/campaign-pyrite.png') });
    await gate(page, 'luminous');
    await gate(page, 'dark-spores');
    assert.equal(await page.evaluate(id => !window.__SLUGTERRA__.enemies.some(e => e.encounterId === id), forestEnemy), true);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.world.interactables.find(i => i.slugId === 'doc').object.visible), false);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.cavernProgress.pyrite.completed), true);
    assert.equal(await page.evaluate(id => window.__SLUGTERRA__.game.state.cavernProgress.pyrite.defeated.includes(id), pyriteEnemy), true);
    console.log('PASS: Pyrite combat/discovery/morph, real gates both directions, persistent defeated IDs, ownership and original audio instance');

    await approach(page, 'checkpoint');
    await page.evaluate(() => window.__SLUGTERRA__.game.save(window.__SLUGTERRA__.player));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__SLUGTERRA__?.world.id === 'dark-spores', undefined, { timeout });
    await page.locator('#continue-button').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing' && window.__SLUGTERRA__.audio.getStatus().clips.includes('blaster'), undefined, { timeout });
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.checkpoint.cavernId), 'dark-spores');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.launcher.userData.loadedSlugId), 'glow');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.ownedBlasters.includes('breaker')), true);
    console.log('PASS: reload boots directly in a saved non-Haven cavern; checkpoint, collection, blaster and imported audio restore');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('i');
    await page.waitForFunction(() => document.querySelector('.campaign-collection'), undefined, { timeout });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await page.locator('[data-equip-slug="frost"][data-equip-slot="1"]').isVisible(), true);
    await page.screenshot({ path: path.join(root, 'test-results/campaign-mobile-collection.png') });
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    await page.waitForFunction(() => document.querySelector('.cavern-atlas'), undefined, { timeout });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await page.locator('.cavern-atlas-card').count(), 3);
    await page.screenshot({ path: path.join(root, 'test-results/campaign-mobile-atlas.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: low quality and mobile-width collection/atlas dialogs fit without horizontal overflow; no browser application errors');
  } finally {
    await browser?.close();
    server?.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
