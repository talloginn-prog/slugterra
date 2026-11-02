/* Real P-key and camera-obstruction checks. Run alone with software WebGL. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const timeout = 120000;
const baseURL = process.env.CAMERA_GAME_URL || 'http://127.0.0.1:4180';

async function main() {
  const server = process.env.CAMERA_GAME_URL ? null : spawn(process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4180', '--strictPort'],
    { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(baseURL)).ok) break; } catch { /* Server is starting. */ }
      if (attempt === 99) throw new Error('Camera test server did not become ready');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    page.setDefaultTimeout(timeout);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
    await page.goto(baseURL, { waitUntil: 'load', timeout });
    await page.waitForFunction(() => !!window.__SLUGTERRA__);
    await page.waitForFunction(() => window.__SLUGTERRA__.importedModels.ready === 7, undefined, { timeout });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#setting-quality').selectOption('low');
    await page.locator('#setting-sound').uncheck();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.locator('#begin-button').click();
    if (await page.locator('#confirm-restart').isVisible()) await page.locator('#confirm-restart').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing');

    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.viewMode), 'first-person');
    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      g.teleport(0, 28); g.lookAt(0, g.player.y, 42);
      window.__cameraAudio = g.audio;
      window.__cameraProgress = JSON.stringify({ collected: g.game.state.collected, quest: g.game.state.quest, coins: g.game.state.coins, owned: g.game.state.ownedSlugs });
    });
    await page.keyboard.down('p');
    await page.waitForFunction(() => window.__SLUGTERRA__.viewMode === 'third-person');
    await page.keyboard.down('p'); // Repeated keydown must not flip again.
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.viewMode), 'third-person');
    await page.keyboard.up('p');
    await page.waitForFunction(() => window.__SLUGTERRA__.playerAvatar.visible);
    const view = await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      const body = g.playerAvatar.children[0];
      g.playerAvatar.updateMatrixWorld(true);
      let bounds;
      body.traverse(object => {
        if (object.skeleton) object.skeleton.update();
        if (!bounds && object.geometry) { object.geometry.computeBoundingBox(); bounds = object.geometry.boundingBox.clone(); }
      });
      bounds.setFromObject(body, true);
      return {
        distance: g.camera.position.distanceTo(g.player),
        foot: g.playerAvatar.position.y - (g.player.y - 1.85),
        avatarId: g.playerAvatar.userData.importedModelId,
        weaponVisible: g.launcher.visible,
        sameAudio: g.audio === window.__cameraAudio,
        bodyHeight: bounds.max.y - bounds.min.y,
        bodyFoot: bounds.min.y - (g.player.y - 1.85),
      };
    });
    assert.ok(view.distance > 0.65 && view.distance < 4.5);
    assert.ok(Math.abs(view.foot) < 1e-5);
    assert.equal(view.avatarId, 'eli');
    assert.equal(view.weaponVisible, false);
    assert.equal(view.sameAudio, true);
    assert.ok(Math.abs(view.bodyHeight - 1.85) < 0.025, `actual deformed Eli height: ${view.bodyHeight}`);
    assert.ok(Math.abs(view.bodyFoot) < 0.025, `actual deformed Eli feet offset: ${view.bodyFoot}`);
    assert.match(await page.locator('#view-toggle').getAttribute('aria-label'), /first-person/);
    console.log('PASS: P switches to the uploaded third-person avatar; held-key repeat is ignored and the first-person weapon is hidden');

    const startZ = await page.evaluate(() => window.__SLUGTERRA__.player.z);
    await page.keyboard.down('w');
    try { await page.waitForFunction(z => window.__SLUGTERRA__.player.z > z + 0.7, startZ, { timeout }); }
    finally { await page.keyboard.up('w'); }
    await page.mouse.move(320, 240);
    await page.mouse.down({ button: 'right' });
    await page.waitForFunction(() => window.__SLUGTERRA__.aiming && window.__SLUGTERRA__.camera.fov < 60, undefined, { timeout });
    await page.mouse.up({ button: 'right' });
    // The spawn view has a root in the foreground. Arrange a genuinely clear
    // follow view for the visual screenshot, separately from obstruction tests.
    const clearView = await page.evaluate(async () => {
      const g = window.__SLUGTERRA__;
      const { createViewController } = await import('/src/camera-view.js');
      const { firstTerrainHit } = await import('/src/physics.js');
      const view = createViewController(); view.toggle();
      for (const [x, z] of [[28, 48], [55, 60], [-50, 64], [50, 5], [-64, -6], [20, -65]]) {
        g.teleport(x, z); g.lookAt(g.player.x, g.player.y, g.player.z - 12);
        const eye = g.player;
        const camera = view.cameraPosition(eye, g.yaw, 0, (a, b) => {
          const structure = g.world.collisionWorld.segmentHit(a, b), terrain = firstTerrainHit(a, b, g.world.groundHeight, 0.22);
          return structure === null ? terrain : terrain === null ? structure : Math.min(structure, terrain);
        });
        if (Math.hypot(camera.x - eye.x, camera.y - eye.y, camera.z - eye.z) < 4.1) continue;
        const visible = [[0, 0], [0, -0.8], [0, -1.7], [-0.35, -0.7], [0.35, -0.7]].every(([dx, dy]) => {
          const t = g.world.collisionWorld.segmentHit(camera, { x: eye.x + dx, y: eye.y + dy, z: eye.z });
          return t === null || t > 0.99;
        });
        if (visible) return { x: eye.x, z: eye.z };
      }
      return null;
    });
    assert.ok(clearView, 'visual fixture must have full follow distance and unobstructed avatar sightlines');
    await page.waitForFunction(() => window.__SLUGTERRA__.camera.position.distanceTo(window.__SLUGTERRA__.player) > 4.1 && window.__SLUGTERRA__.camera.fov > 63);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/third-person.png'), timeout });
    console.log('PASS: actual keyboard movement and right-button aiming remain available in third person');

    // Keep the source's real flight/update logic. Only its starting position and
    // aim are arranged so the first shot has room to remain visibly in flight.
    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      g.teleport(8, 25); g.lookAt(8, g.player.y + 20, 5);
    });
    const shotsBefore = await page.evaluate(() => window.__SLUGTERRA__.combatStats.shots);
    await page.keyboard.press('f');
    await page.waitForFunction(n => window.__SLUGTERRA__.combatStats.shots > n && window.__SLUGTERRA__.projectiles.some(p => !p.hostile), shotsBefore, { timeout });
    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      window.__cameraFlight = g.projectiles.find(p => !p.hostile);
      window.__cameraFlightId = window.__cameraFlight.slug.id;
    });
    await page.keyboard.press('p');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.viewMode), 'first-person');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.projectiles.includes(window.__cameraFlight)), true, 'switching view must not replace or clear a live companion');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.slugs.find(s => s.id === window.__cameraFlightId).inFlight), true);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.audio === window.__cameraAudio), true);
    assert.equal(await page.evaluate(() => JSON.stringify({ collected: window.__SLUGTERRA__.game.state.collected, quest: window.__SLUGTERRA__.game.state.quest, coins: window.__SLUGTERRA__.game.state.coins, owned: window.__SLUGTERRA__.game.state.ownedSlugs }) === window.__cameraProgress), true);
    await page.waitForFunction(() => window.__SLUGTERRA__.launcher.visible && !window.__SLUGTERRA__.playerAvatar.visible);
    assert.ok(await page.evaluate(() => window.__SLUGTERRA__.camera.position.distanceTo(window.__SLUGTERRA__.player) < 0.1));
    await page.waitForFunction(() => !window.__SLUGTERRA__.game.state.slugs.find(s => s.id === window.__cameraFlightId).inFlight, undefined, { timeout });
    console.log('PASS: switching view mid-flight keeps the live projectile, companion state, audio and campaign progress; first person restores the weapon');

    await page.keyboard.press('p');
    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      g.teleport(11, 36.2); g.lookAt(g.player.x, g.player.y + 6, g.player.z + 10);
    });
    await page.waitForFunction(() => window.__SLUGTERRA__.camera.position.distanceTo(window.__SLUGTERRA__.player) > 0.05);
    const wall = await page.evaluate(async () => {
      const g = window.__SLUGTERRA__;
      const { createViewController } = await import('/src/camera-view.js');
      const { firstTerrainHit } = await import('/src/physics.js');
      const view = createViewController(); view.toggle();
      const unblocked = view.cameraPosition(g.player, g.yaw, g.camera.rotation.x);
      return {
        obstacle: g.world.collisionWorld.segmentHit(g.player, unblocked),
        actualHit: g.world.collisionWorld.segmentHit(g.player, g.camera.position),
        terrainHit: firstTerrainHit(g.player, g.camera.position, g.world.groundHeight, 0.22),
        actualDistance: g.camera.position.distanceTo(g.player),
        fullDistance: Math.hypot(unblocked.x - g.player.x, unblocked.y - g.player.y, unblocked.z - g.player.z),
      };
    });
    assert.notEqual(wall.obstacle, null, 'the arranged rear-camera path must actually intersect the merchant counter');
    assert.ok(wall.actualDistance < wall.fullDistance - 0.1);
    assert.ok(wall.actualHit === null || wall.actualHit > 0.999);
    assert.ok(wall.terrainHit === null || wall.terrainHit > 0.999);

    await page.evaluate(() => {
      const g = window.__SLUGTERRA__;
      g.teleport(0, 28); g.lookAt(g.player.x, g.player.y + 40, g.player.z + 2);
    });
    await page.waitForFunction(() => window.__SLUGTERRA__.camera.position.distanceTo(window.__SLUGTERRA__.player) > 0.05);
    const terrain = await page.evaluate(async () => {
      const g = window.__SLUGTERRA__, { firstTerrainHit } = await import('/src/physics.js');
      return { hit: firstTerrainHit(g.player, g.camera.position, g.world.groundHeight, 0.22), distance: g.camera.position.distanceTo(g.player) };
    });
    assert.ok(terrain.hit === null || terrain.hit > 0.999);
    assert.ok(terrain.distance < 2.2, 'looking upward must retract the rear camera before it crosses the terrain');
    await page.locator('#view-toggle').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.viewMode === 'first-person');
    assert.deepEqual(errors, []);
    console.log('PASS: rear camera retracts around actual structural cover and terrain; HUD button also switches back without application errors');
  } finally {
    await browser?.close(); server?.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
