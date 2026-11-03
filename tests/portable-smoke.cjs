/* Exercise the shipped self-contained production HTML with networking off.
 * Prefer file://; managed browsers can require the documented loopback fallback.
 * Neither path uses development hooks or imports application source modules. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createServer } = require('node:http');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, '.local/downloads/Slugterra.html');
const imageNames = [
  'burpy-protoform.png', 'burpy-velocimorph.png',
  'joules-protoform.png', 'joules-velocimorph.png',
  'doc-protoform.png', 'doc-velocimorph.png',
  'frost-protoform.png', 'frost-velocimorph.png',
  'glow-protoform.png', 'glow-velocimorph.png',
  'dark-spores-cavern.webp', 'pyrite-cavern.webp',
  'rammstone-protoform.png', 'rammstone-velocimorph.png',
  'arachnet-protoform.png', 'arachnet-velocimorph.png',
  'fandango-protoform.png', 'fandango-velocimorph.png',
];
const timeout = 60000;

function verifyEmbeddedAssets() {
  assert.ok(fs.existsSync(packagePath), 'Run npm run package:game before testing the portable file.');
  const html = fs.readFileSync(packagePath, 'utf8');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, 'portable HTML must embed its executable entry');
  assert.doesNotMatch(html, /<link\b[^>]*\brel=["']stylesheet["']/i, 'portable HTML must embed its styles');
  for (const name of imageNames) {
    const source = fs.readFileSync(path.join(root, 'src/assets/references', name));
    assert.ok(html.includes(source.toString('base64')), `${name} must be embedded byte-for-byte in the portable HTML`);
  }
  const mp3 = fs.readFileSync(path.join(root, 'src/assets/audio/slugterra-metamorphosis-shot.mp3'));
  assert.ok(html.includes(mp3.toString('base64')), 'supplied metamorphosis MP3 must be embedded byte-for-byte');
  const models = fs.readdirSync(path.join(root, 'src/assets/models/runtime')).filter(name => name.endsWith('.glb'));
  assert.equal(models.length, 7);
  for (const name of models) {
    const source = fs.readFileSync(path.join(root, 'src/assets/models/runtime', name));
    assert.ok(html.includes(source.toString('base64')), `${name} must be embedded byte-for-byte in the portable HTML`);
  }
  console.log(`PASS: all ${imageNames.length} runtime reference images, seven runtime models and the supplied MP3 are embedded unchanged`);
}

async function imagesDecoded(page, selector, expected) {
  assert.equal(await page.locator(selector).count(), expected);
  await page.waitForFunction(({ selector, expected }) => {
    const images = [...document.querySelectorAll(selector)];
    return images.length === expected && images.every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  }, { selector, expected }, { timeout });
  await page.locator(selector).evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
  });
}

async function main() {
  verifyEmbeddedAssets();
  let browser, server;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const requests = [], errors = [];
    let loopbackOrigin = null, offlineGameplay = false;
    async function openContext(offline) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, hasTouch: true, offline });
      await context.route(/^https?:\/\//i, route => {
        const url = route.request().url();
        if (loopbackOrigin && new URL(url).origin === loopbackOrigin && !offlineGameplay) return route.continue();
        if (!requests.includes(url)) requests.push(url);
        return route.abort('internetdisconnected');
      });
      context.on('request', request => {
        const url = request.url();
        if (/^https?:\/\//i.test(url) && (offlineGameplay || new URL(url).origin !== loopbackOrigin) && !requests.includes(url)) requests.push(url);
      });
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
      return { context, page };
    }
    let { context, page } = await openContext(true);
    try {
      await page.goto(pathToFileURL(packagePath).href, { waitUntil: 'load', timeout });
    } catch (error) {
      if (!String(error.message).includes('ERR_BLOCKED_BY_ADMINISTRATOR')) throw error;
      await context.close(); errors.length = 0;
      const html = fs.readFileSync(packagePath);
      server = createServer((request, response) => {
        if (request.url === '/Slugterra.html') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); }
        else { response.writeHead(204); response.end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      loopbackOrigin = `http://127.0.0.1:${server.address().port}`;
      ({ context, page } = await openContext(false));
      await page.goto(`${loopbackOrigin}/Slugterra.html`, { waitUntil: 'networkidle', timeout });
      console.log('NOTE: managed file-URL policy requires the documented local-server fallback; identical portable bytes served over loopback');
    }
    await page.waitForSelector('#loading-status.loaded', { timeout });
    await context.setOffline(true); offlineGameplay = true;
    assert.equal(await page.title(), 'Slugterra — The Luminous Deep');
    assert.equal(await page.locator('#begin-button').isVisible(), true);
    assert.equal(await page.evaluate(() => '__SLUGTERRA__' in window), false, 'production file must not expose development hooks');
    assert.equal(await page.locator('#game-canvas').evaluate(canvas => Boolean(canvas.getContext('webgl2'))), true, 'production file creates a real WebGL2 context');
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/portable-menu.png'), timeout });

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#setting-quality').selectOption('low');
    await page.locator('#setting-sound').uncheck();
    assert.equal(await page.locator('[data-audio-slot]').count(), 8, 'portable production UI retains every imported-audio slot');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.locator('#begin-button').click();
    if (await page.locator('#confirm-restart').isVisible()) await page.locator('#confirm-restart').click();
    await page.waitForFunction(() => document.body.dataset.mode === 'playing', undefined, { timeout });
    assert.equal(await page.locator('#loadout button').count(), 3);
    assert.equal(await page.locator('#touch-stick').isVisible(), true);
    await page.locator('[data-touch-action="view"]').tap();
    await page.waitForFunction(() => document.querySelector('#view-toggle').getAttribute('aria-label').includes('first-person'), undefined, { timeout });
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('#view-toggle').getAttribute('aria-label').includes('third-person'), undefined, { timeout });
    const touchSession = await context.newCDPSession(page), stick = await page.locator('#touch-stick').boundingBox();
    const point = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y - 28 }] });
    await page.waitForFunction(() => document.querySelector('#touch-stick').classList.contains('pressed'));
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => !document.querySelector('#touch-stick').classList.contains('pressed'));
    console.log('PASS: offline portable WebGL and bundled touchscreen stick/view controls work without development hooks');

    await page.keyboard.press('i');
    await page.waitForSelector('.campaign-collection', { timeout });
    assert.equal(await page.locator('.collection-card').count(), 9);
    assert.equal(await page.locator('.collection-art [data-form="protoform"]').count(), 9);
    await page.locator('[data-ready-slug="1"]').click();
    assert.equal(await page.locator('#loadout .slug-slot.selected strong').innerText(), 'Joules', 'arsenal retains selection of an already equipped companion');
    await imagesDecoded(page, '.collection-art img', 8);
    await page.locator('[data-form-toggle="velocimorph"]').click();
    assert.equal(await page.locator('.collection-art [data-form="velocimorph"]').count(), 9);
    await imagesDecoded(page, '.collection-art img', 8);
    await page.screenshot({ path: path.join(root, 'test-results/portable-collection.png'), timeout });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.dataset.mode === 'playing', undefined, { timeout });
    await page.locator('.cavern-status-button').click();
    await page.waitForSelector('.cavern-atlas', { timeout });
    assert.equal(await page.locator('.cavern-atlas-card').count(), 5);
    await imagesDecoded(page, '.atlas-image img', 2);
    assert.deepEqual(requests, [], 'portable gameplay must not attempt any HTTP(S) request');
    assert.deepEqual(errors, [], 'portable production experience must not report application or loading errors');
    console.log('PASS: offline collection renders all nine species and both forms; atlas reference images decode with no network requests');
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
