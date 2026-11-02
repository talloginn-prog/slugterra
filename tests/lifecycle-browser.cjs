/* Regression checks for live quality changes, cavern GPU cleanup, and surfaces.
 * Run separately from other SwiftShader suites to avoid renderer contention. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const baseURL = process.env.LIFECYCLE_GAME_URL || 'http://127.0.0.1:4178';
const timeout = 60000;

async function main() {
  const server = process.env.LIFECYCLE_GAME_URL ? null : spawn(process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'],
    { cwd: root, stdio: 'ignore' });
  let browser;
  const errors = [];
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(baseURL)).ok) break; } catch { /* Server is starting. */ }
      if (attempt === 99) throw new Error('Lifecycle Vite server did not become ready');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 720, height: 520 } });
    page.setDefaultTimeout(timeout);
    await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__SLUGTERRA__);
    await page.waitForFunction(() => window.__SLUGTERRA__.importedModels.ready === 7);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#setting-quality').selectOption('low');
    await page.locator('#setting-sound').uncheck();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.locator('#begin-button').click();
    if (await page.locator('#confirm-restart').isVisible()) await page.locator('#confirm-restart').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing');

    // Launch a real companion before opening Settings. Pause freezes simulation
    // while the quality input rebuilds scenery; it must not reset combat.
    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      g.teleport(8, 25); g.lookAt(8, g.player.y + 50, -45);
    });
    await page.keyboard.press('f');
    await page.waitForFunction(() => window.__SLUGTERRA__.projectiles.some(p => !p.hostile));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'paused');
    const before = await page.evaluate(() => {
      const g = window.__SLUGTERRA__, enemy = g.enemies.find(e => !e.dead);
      if (!enemy) throw new Error('Expected a live sentinel');
      enemy.hp = 63;
      const projectile = g.projectiles.find(p => !p.hostile);
      if (!projectile) throw new Error('Expected the launched companion to remain in flight');
      const guide = g.world.importedGuide;
      if (!guide) throw new Error('Expected the uploaded Eli contact');
      const skeletons = new Set(), sharedGeometry = new Set(), sharedMaterials = new Set();
      guide.traverse(object => {
        if (object.isSkinnedMesh) skeletons.add(object.skeleton);
        if (object.isMesh) {
          sharedGeometry.add(object.geometry);
          for (const material of (Array.isArray(object.material) ? object.material : [object.material])) sharedMaterials.add(material);
        }
      });
      window.__lifecycle = { enemy, brain: enemy.brain, projectile, world: g.world, audio: g.audio, disposed: 0, instances: 0,
        skeletons, sharedGeometry, disposedBoneTextures: 0, disposedSharedResources: 0 };
      for (const skeleton of skeletons) {
        // A contact outside the camera frustum might not yet have rendered.
        // Allocate its owned texture so cleanup is checked in either case.
        if (!skeleton.boneTexture) skeleton.computeBoneTexture();
        skeleton.boneTexture.addEventListener('dispose', () => { window.__lifecycle.disposedBoneTextures++; });
      }
      for (const resource of [...sharedGeometry, ...sharedMaterials]) resource.addEventListener('dispose', () => { window.__lifecycle.disposedSharedResources++; });
      g.world.group.traverse(object => {
        if (object.isInstancedMesh) {
          window.__lifecycle.instances++;
          object.addEventListener('dispose', () => { window.__lifecycle.disposed++; });
        }
      });
      return {
        hp: enemy.hp, enemyPosition: enemy.root.position.toArray(), phase: enemy.brain.phase,
        projectileLife: projectile.life, projectilePosition: projectile.mesh.position.toArray(),
        playerPosition: g.player.toArray(), savedPosition: { ...g.game.state.position },
        instances: window.__lifecycle.instances,
        skeletons: skeletons.size,
      };
    });
    assert.ok(before.instances > 0, 'The departing scenery contains instanced GPU buffers');
    assert.ok(before.skeletons > 0, 'The uploaded Eli has independently owned skin resources');
    await page.locator('#setting-quality').selectOption('medium');
    const after = await page.evaluate(() => {
      const g = window.__SLUGTERRA__, prior = window.__lifecycle;
      const nextGeometry = new Set();
      g.world.importedGuide.traverse(object => { if (object.isMesh) nextGeometry.add(object.geometry); });
      return {
        newWorld: g.world !== prior.world, sameEnemy: g.enemies.includes(prior.enemy),
        sameBrain: prior.enemy.brain === prior.brain, hp: prior.enemy.hp,
        enemyPosition: prior.enemy.root.position.toArray(), phase: prior.enemy.brain.phase,
        sameProjectile: g.projectiles.includes(prior.projectile), projectileLife: prior.projectile.life,
        projectilePosition: prior.projectile.mesh.position.toArray(),
        inFlight: g.game.state.slugs.find(s => s.id === prior.projectile.slug.id).inFlight,
        playerPosition: g.player.toArray(), savedPosition: { ...g.game.state.position },
        sameAudio: g.audio === prior.audio, disposed: prior.disposed,
        disposedBoneTextures: prior.disposedBoneTextures,
        oldBoneTexturesCleared: [...prior.skeletons].every(skeleton => skeleton.boneTexture === null),
        disposedSharedResources: prior.disposedSharedResources,
        sameImportedGeometry: nextGeometry.size === prior.sharedGeometry.size && [...nextGeometry].every(geometry => prior.sharedGeometry.has(geometry)),
      };
    });
    assert.equal(after.newWorld, true);
    assert.equal(after.sameEnemy, true);
    assert.equal(after.sameBrain, true);
    assert.equal(after.hp, before.hp);
    assert.deepEqual(after.enemyPosition, before.enemyPosition);
    assert.equal(after.phase, before.phase);
    assert.equal(after.sameProjectile, true);
    assert.equal(after.projectileLife, before.projectileLife);
    assert.deepEqual(after.projectilePosition, before.projectilePosition);
    assert.equal(after.inFlight, true);
    assert.deepEqual(after.playerPosition, before.playerPosition);
    assert.deepEqual(after.savedPosition, before.savedPosition);
    assert.equal(after.sameAudio, true);
    assert.equal(after.disposed, before.instances, 'Every old InstancedMesh releases its matrix/color buffers');
    assert.equal(after.disposedBoneTextures, before.skeletons, 'Every old Eli skeleton releases its owned bone texture');
    assert.equal(after.oldBoneTexturesCleared, true);
    assert.equal(after.disposedSharedResources, 0, 'Scene cleanup must retain imported cache geometry and materials');
    assert.equal(after.sameImportedGeometry, true, 'Replacement Eli reuses the still-valid imported geometry cache');
    await page.locator('#setting-quality').selectOption('low');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.slugs.every(s => !s.inFlight), undefined, { timeout });
    console.log('PASS: quality changes preserve combat, position, saves and audio; instance buffers and owned Eli bone textures disposed while shared imported resources survive');

    const instances = await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      window.__lifecycle.disposed = 0; window.__lifecycle.instances = 0;
      g.world.group.traverse(object => {
        if (object.isInstancedMesh) {
          window.__lifecycle.instances++;
          object.addEventListener('dispose', () => { window.__lifecycle.disposed++; });
        }
      });
      return window.__lifecycle.instances;
    });
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.loadCavern('dark-spores')), true);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.world.id), 'dark-spores');
    assert.equal(await page.evaluate(() => window.__lifecycle.disposed), instances);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.audio === window.__lifecycle.audio), true);
    console.log('PASS: cavern travel releases prior instance buffers and retains the audio engine');

    await page.evaluate(() => {
      const g = window.__SLUGTERRA__, native = g.audio.footstep;
      window.__lifecycleFootsteps = [];
      g.audio.footstep = (surface, ...args) => { window.__lifecycleFootsteps.push(surface); return native(surface, ...args); };
    });
    for (const surface of ['water', 'stone']) {
      const coordinates = await page.evaluate(surface => {
        const g = window.__SLUGTERRA__, z = 28;
        const river = g.world.map.river.reduce((best, p) => !best || Math.abs(p.z - z) < Math.abs(best.z - z) ? p : best, null);
        const legacyCenter = -7 + Math.sin(z * 0.035) * 13;
        const x = surface === 'water' ? river.x : legacyCenter;
        window.__lifecycleFootsteps.length = 0;
        g.teleport(x, z); g.lookAt(x, g.player.y, z + 10);
        return { river: river.x, legacyCenter };
      }, surface);
      assert.ok(Math.abs(coordinates.river - coordinates.legacyCenter) > 6, 'Fixture separates the current and legacy river locations');
      await page.keyboard.down('w');
      try {
        await page.waitForFunction(() => window.__lifecycleFootsteps.length > 0, undefined, { timeout });
      } finally { await page.keyboard.up('w'); }
      assert.equal(await page.evaluate(() => window.__lifecycleFootsteps[0]), surface);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: real walking uses water audio at the current river and stone at dry legacy-river coordinates; no browser errors');
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
