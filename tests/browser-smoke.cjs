/* End-to-end checks run against real WebGL, input, projectile collisions and saves. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  const baseURL = process.env.GAME_URL || 'http://127.0.0.1:4175';
  const server = process.env.GAME_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(baseURL)).ok) break; } catch { /* Server is starting. */ }
      if (attempt === 99) throw new Error('Vite did not become ready');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Exercise the supported drag-to-look fallback; headless cursor capture varies by host.
    await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__SLUGTERRA__);
    assert.equal(await page.title(), 'Slugterra — The Luminous Deep');
    assert.equal(await page.locator('#begin-button').isVisible(), true);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/title.png') });
    await page.setViewportSize({ width: 1000, height: 700 });
    console.log('PASS: WebGL title screen renders without application errors');

    await page.getByRole('button', { name: 'How to play' }).click();
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#setting-quality').selectOption('low');
    const tone=Buffer.alloc(44+4410);tone.write('RIFF',0);tone.writeUInt32LE(tone.length-8,4);tone.write('WAVEfmt ',8);tone.writeUInt32LE(16,16);tone.writeUInt16LE(1,20);tone.writeUInt16LE(1,22);tone.writeUInt32LE(22050,24);tone.writeUInt32LE(44100,28);tone.writeUInt16LE(2,32);tone.writeUInt16LE(16,34);tone.write('data',36);tone.writeUInt32LE(4410,40);
    for(let i=0;i<2205;i++)tone.writeInt16LE(Math.round(Math.sin(i/22050*Math.PI*880)*8000),44+i*2);
    await page.locator('[data-audio-slot="blaster"]').setInputFiles({name:'test-only-tone.wav',mimeType:'audio/wav',buffer:tone});
    await page.waitForFunction(()=>document.querySelector('[data-audio-status="blaster"]').textContent==='Imported clip');
    assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.audio.getStatus().clips.includes('blaster')),true);
    await page.locator('#clear-audio-pack').click();
    await page.waitForFunction(()=>window.__SLUGTERRA__.audio.getStatus().clips.length===0);
    console.log('PASS: Settings imports a supplied sound clip and removes it without bundling show audio');
    await page.locator('#setting-sound').uncheck();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    // Settings may create a save; Begin then correctly offers a fresh-journey confirmation.
    await page.locator('#begin-button').click();
    if (await page.locator('#confirm-restart').isVisible()) await page.locator('#confirm-restart').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing');
    const initialZ = await page.evaluate(() => window.__SLUGTERRA__.player.z);
    await page.keyboard.down('w');
    await page.waitForFunction(z => window.__SLUGTERRA__.player.z > z + 3.5, initialZ, { timeout: 20000 });
    await page.keyboard.up('w');
    await page.waitForFunction(() => !document.querySelector('#interact-prompt').hidden);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.quest.stage === 'shards');
    const floorY = await page.evaluate(()=>window.__SLUGTERRA__.player.y);
    await page.keyboard.press('Space');
    await page.waitForFunction(y=>window.__SLUGTERRA__.player.y>y+0.2,floorY,{timeout:10000});
    await page.waitForFunction(()=>window.__SLUGTERRA__.character.grounded,undefined,{timeout:10000});
    await page.keyboard.press('2');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.selectedSlug), 1);
    console.log('PASS: real keyboard movement, ranger interaction, quest briefing and slug selection');

    await page.keyboard.press('j');
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.mouse.move(500, 380);
    await page.mouse.down({ button: 'right' });
    await page.waitForFunction(() => window.__SLUGTERRA__.camera.fov < 55, undefined, { timeout: 20000 });
    const beforeAim = await page.evaluate(() => ({ yaw: window.__SLUGTERRA__.yaw, shots: window.__SLUGTERRA__.combatStats.shots }));
    await page.mouse.move(545, 390, { steps: 4 });
    assert.notEqual(await page.evaluate(() => window.__SLUGTERRA__.yaw), beforeAim.yaw);
    await page.mouse.down({ button: 'left' });
    await page.waitForFunction(n => window.__SLUGTERRA__.combatStats.shots > n, beforeAim.shots);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.aiming && window.__SLUGTERRA__.mouse.firing), true);
    const chordYaw = await page.evaluate(() => window.__SLUGTERRA__.yaw);
    await page.mouse.move(575, 400, { steps: 3 });
    assert.notEqual(await page.evaluate(() => window.__SLUGTERRA__.yaw), chordYaw);
    await page.mouse.up({ button: 'left' });
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.aiming), true);
    await page.mouse.up({ button: 'right' });
    await page.keyboard.press('c');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.aiming), true);
    await page.keyboard.press('c');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.aiming), false);
    // Reverse chord order: release right while left remains held.
    await page.mouse.down({ button: 'left' });
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.mouse.firing && !window.__SLUGTERRA__.aiming), true);
    await page.mouse.up({ button: 'left' });
    console.log('PASS: focus, turning and firing together; both button chord orders; C focus toggle');

    // Fire into open sky and observe actual speed-triggered transformation and return.
    await page.waitForFunction(() => !window.__SLUGTERRA__.game.state.slugs[1].inFlight);
    await page.evaluate(() => { const g=window.__SLUGTERRA__; g.teleport(8,25); g.lookAt(8,g.player.y+15,5); });
    const morphsBefore = await page.evaluate(() => window.__SLUGTERRA__.combatStats.morphs);
    await page.keyboard.down('f');
    await page.waitForFunction(n => window.__SLUGTERRA__.combatStats.morphs > n, morphsBefore, { timeout:20000 });
    await page.keyboard.up('f');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.projectiles.some(p=>!p.hostile && p.morphed && p.morph.visible && !p.proto.visible && p.speed>=44.7)),true);
    await page.screenshot({path:path.join(root,'test-results/velocimorph-flight.png')});
    // Software WebGL can run near 1 frame/second while simulation advances at
    // most 0.2 seconds per frame. Allow the unchanged outward + return flight
    // to finish on that renderer; the phase/speed assertions above still apply.
    await page.waitForFunction(() => !window.__SLUGTERRA__.game.state.slugs[1].inFlight, undefined,{timeout:60000});
    assert.ok(await page.evaluate(()=>window.__SLUGTERRA__.combatStats.returns)>0);
    console.log('PASS: accelerating protoform transforms at100mph, renders battle form and returns to blaster');

    // Position near each camp through the dev harness; combat and collection use real input.
    for (const id of ['shard-west', 'shard-east', 'shard-depths']) {
      const indices = await page.evaluate(id => window.__SLUGTERRA__.enemies.flatMap((e, i) => e.camp === id ? [i] : []), id);
      for (const index of indices) {
        for (let shot = 0; shot < 7; shot++) {
          const status = await page.evaluate(async index => {
            const g = window.__SLUGTERRA__, enemy = g.enemies[index];
            if (enemy.dead) return { dead: true };
            const physics=await import('/src/physics.js');
            // Pick a clear firing lane; trees now correctly block projectiles.
            let clear=false;
            for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4]) {
              g.teleport(enemy.root.position.x+Math.sin(angle)*6,enemy.root.position.z+Math.cos(angle)*6);
              g.lookAt(enemy.root.position.x,enemy.root.position.y,enemy.root.position.z);
              g.launcher.updateWorldMatrix(true,false);
              const start=g.launcher.localToWorld(g.blaster.muzzle.clone()),end=enemy.root.position;
              const blocked=physics.firstTerrainHit(start,end,g.world.groundHeight,.12)!==null || (g.world.collisionReady ? g.world.collisionWorld.segmentHit(start,end)!==null : g.colliders.some(c=>physics.segmentCapsuleHit(start,end,{x:c.x,y:(c.bottom+c.top)/2,z:c.z},c.radius+.12,(c.top-c.bottom)/2)!==null));
              if(!blocked) {clear=true;break;}
            }
            if(!clear) throw new Error('No clear firing lane to sentinel');
            return { hp: enemy.hp };
          }, index);
          if (status.dead) break;
          await page.keyboard.down('f');
          await page.waitForFunction(({ index, hp }) => window.__SLUGTERRA__.enemies[index].hp < hp, { index, hp: status.hp }, { timeout: 20000 });
          await page.keyboard.up('f');
        }
        assert.equal(await page.evaluate(i => window.__SLUGTERRA__.enemies[i].dead, index), true);
      }
      await page.evaluate(id => { const g = window.__SLUGTERRA__, l = g.world.landmarks.find(l => l.id === id); g.teleport(l.position.x, l.position.z + 1.5); }, id);
      await page.keyboard.press('e');
      await page.waitForFunction(id => window.__SLUGTERRA__.game.state.collected.includes(id), id);
      console.log(`PASS: projectile hits, enemy defeats and shard collection at ${id}`);
    }
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.quest.stage), 'boss');
    const bossIndex = await page.evaluate(() => window.__SLUGTERRA__.enemies.findIndex(e => e.boss));
    for (let shot = 0; shot < 25; shot++) {
      const status = await page.evaluate(index => {
        const g = window.__SLUGTERRA__, enemy = g.enemies[index];
        if (enemy.dead) return { dead: true };
        g.teleport(enemy.root.position.x, enemy.root.position.z + 9);
        g.lookAt(enemy.root.position.x, enemy.root.position.y, enemy.root.position.z);
        return { hp: enemy.hp };
      }, bossIndex);
      if (status.dead) break;
      await page.keyboard.down('f');
      await page.waitForFunction(({ index, hp }) => window.__SLUGTERRA__.enemies[index].hp < hp, { index: bossIndex, hp: status.hp }, { timeout: 20000 });
      await page.keyboard.up('f');
    }
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.quest.stage), 'return');
    await page.evaluate(() => window.__SLUGTERRA__.teleport(0, 32));
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__SLUGTERRA__.game.state.won);
    assert.match(await page.locator('#dialog-title').innerText(), /the light/);
    await page.screenshot({ path: path.join(root, 'test-results/victory.png') });
    console.log('PASS: Hollow Warden combat and complete expedition ending');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__SLUGTERRA__);
    assert.equal(await page.locator('#continue-button').isVisible(), true);
    await page.locator('#begin-button').click();
    await page.locator('#cancel-restart').click();
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.mode), 'menu');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    await page.locator('#continue-button').click();
    await page.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing');
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.won), true);
    assert.equal(await page.evaluate(() => window.__SLUGTERRA__.game.state.shards), 3);
    await page.screenshot({ path: path.join(root, 'test-results/gameplay.png') });
    console.log('PASS: save/restore, title-screen restart cancellation, continued free exploration');

    // Release the desktop software-WebGL context before opening the mobile context.
    await page.close();
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    mobile.on('pageerror', error => errors.push(error.message));
    mobile.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await mobile.goto(baseURL, { waitUntil: 'networkidle' });
    await mobile.waitForFunction(() => !!window.__SLUGTERRA__);
    assert.equal(await mobile.locator('#begin-button').isVisible(), true);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.screenshot({ path: path.join(root, 'test-results/mobile.png') });
    await mobile.locator('#begin-button').tap();
    await mobile.waitForFunction(() => window.__SLUGTERRA__.mode === 'playing');
    const moveButton = await mobile.getByRole('button', { name: 'Move forward', exact: true }).boundingBox();
    assert.ok(moveButton, 'Touch movement controls are visible');
    const touch = await mobile.context().newCDPSession(mobile);
    const mobileZ = await mobile.evaluate(() => window.__SLUGTERRA__.player.z);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: moveButton.x + moveButton.width / 2, y: moveButton.y + moveButton.height / 2, id: 1 }] });
    await mobile.waitForFunction(z => window.__SLUGTERRA__.player.z > z + 0.8, mobileZ, { timeout: 20000 });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.evaluate(() => window.__SLUGTERRA__.teleport(0, 32));
    await mobile.getByRole('button', { name: 'Interact', exact: true }).tap();
    await mobile.waitForFunction(() => window.__SLUGTERRA__.game.state.quest.stage === 'shards');
    await mobile.close();
    assert.deepEqual(errors, []);
    console.log('PASS: responsive mobile layout, real touch movement and interaction; no browser application errors');
  } finally {
    await browser?.close();
    server?.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
