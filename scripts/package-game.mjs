import { readFile, writeFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(root, '.local/downloads');
const entry = resolve(dist, 'index.html');

function fail(message) { throw new Error(message); }
function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? null;
}
function localAsset(url) {
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) fail(`Cannot embed a nonlocal build asset: ${url}`);
  const path = resolve(dist, decodeURIComponent(url.split(/[?#]/)[0].replace(/^\/+/, '')));
  const location = relative(dist, path);
  if (location === '..' || location.startsWith('../') || isAbsolute(location)) fail('Build asset escapes dist/.');
  return path;
}

try {
  let html;
  try { html = await readFile(entry, 'utf8'); }
  catch { fail('No dist/index.html found. Run npm run build before packaging the game.'); }

  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["']).*?\1[^>]*>\s*<\/script\s*>/gi)];
  const styles = [...html.matchAll(/<link\b[^>]*>/gi)].filter(([tag]) => attribute(tag, 'rel')?.toLowerCase() === 'stylesheet');
  if (scripts.length !== 1 || attribute(scripts[0][0], 'type') !== 'module') {
    fail('Expected one bundled ES module entry. Rebuild with a single Vite entry before packaging.');
  }
  if (!styles.length) fail('No stylesheet found in dist/index.html; the build appears incomplete.');

  const js = await readFile(localAsset(attribute(scripts[0][0], 'src')), 'utf8');
  if (/\bimport\s*(?:\(|["'{*])|\bexport\s+[^;]*\bfrom\s*["']/m.test(js)) {
    fail('The build still imports external JavaScript chunks. Bundle them into the entry before making a portable file.');
  }
  html = html.replace(scripts[0][0], () => `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);
  for (const [tag] of styles) {
    const css = await readFile(localAsset(attribute(tag, 'href')), 'utf8');
    const urls = [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map(match => match[2]);
    if (urls.some(url => !/^(?:data:|#)/i.test(url))) fail('The CSS references external assets; embed them before making a portable file.');
    html = html.replace(tag, () => `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
  }
  // The entry is self-contained; speculative network hints are unnecessary.
  html = html.replace(/<link\b[^>]*>/gi, tag => ['modulepreload', 'preload', 'prefetch'].includes(attribute(tag, 'rel')?.toLowerCase()) ? '' : tag);
  html = html.replace(/<!doctype html>/i, '<!doctype html>\n<!-- Portable game build: JavaScript and styles embedded locally. -->');
  if (/<script\b[^>]*\bsrc\s*=/i.test(html) || /<link\b[^>]*\brel=["']stylesheet["']/i.test(html)) fail('A linked script or stylesheet remains after packaging.');

  const startHere = `SLUGTERRA: THE LUMINOUS DEEP
PORTABLE BROWSER EDITION

1. Extract this ZIP into a folder.
2. Open Slugterra.html with a modern Chrome, Edge, Firefox, or Safari browser.
3. Enable browser hardware acceleration/WebGL 2 if the cavern cannot render.
4. Click Begin expedition; click the world to capture the cursor and start audio.

The HTML embeds the game, models, artwork, JavaScript, styles and the supplied
metamorphosis MP3. It needs no Node.js installation, backend account, API key,
or Internet connection to play.
A keyboard and mouse are recommended. Performance depends on your device.
If your browser restricts local-file storage or WebGL, serve this folder using
a local static web server. Site saves and imported audio belong to the browser
origin; moving the file or changing the server address may use a different save.

CONTROLS
WASD/arrows move; Shift sprint; Space jump; mouse look.
Left click/F fires. Hold right click to aim; C toggles focus.
Right-click aim and left-click fire can be pressed in either order.
Without pointer lock, right-drag turns without firing; left-drag also turns.
E speaks/rests/collects; 1/2/3 select Burpy/Joules/AquaBeek.
Q scans; J journal; M map; I/Tab arsenal; Esc pauses/releases the cursor.

EXPEDITION
Speak to Ranger Kael at Haven. Defeat the sentinels and collect the three
heartshards at Luminous Grove, Violet Falls and Ancient Roots. Face the Hollow
Warden at the northern Heartstone, then return to Haven to complete the quest.
Shots launch at 18 m/s, accelerate and morph at 100 mph (44.7 m/s). Morphed hits
deal 1.6x damage. Each companion remains busy until it returns to the blaster.

SOUND AND SAVES
The supplied slugterra-metamorphosis-shot.mp3 is included in this HTML and plays
automatically for all three transformations. No manual import is needed. Its
1.824-second recording starts about 85 milliseconds in to skip leading silence
and synchronize playback. The recording was supplied by the user. Separate
blaster and impact recordings have not been supplied; those effects use original
synthesis.
Settings > Show audio pack accepts your own local effect clips for eight
blaster, transformation, impact and return/reload slots. Use a browser-supported
audio file (WAV/MP3/OGG/M4A/etc), at most 8 MiB and 15 seconds. Playback priority:
matching imported override, then included transformation clip, then synthesis.
Imported overrides stay in this browser's IndexedDB when storage is available;
they are not uploaded or added to this ZIP. The supplied default MP3 is embedded
separately. The Remove imported clips control restores the included transformation
recording and original synthesis for the other effects.
Save progress/settings use localStorage key slugterra.luminous-deep.v1. Clearing
site data removes local progress/audio. Saves do not synchronize across devices.
Settings > Visual quality > Performance reduces render resolution.

This is an original procedural Slugterra-inspired playable vertical slice with
one complete quest, not a commercial AAA game. This package is a local build
artifact. It does not publish a website or change the repository's remote.
`;

  await mkdir(output, { recursive: true });
  const htmlPath = resolve(output, 'Slugterra.html');
  const textPath = resolve(output, 'START-HERE.txt');
  const zipPath = resolve(output, 'Slugterra-The-Luminous-Deep.zip');
  const suffix = `.tmp-${process.pid}`;
  const temporary = [htmlPath + suffix, textPath + suffix, zipPath + suffix];
  try {
    await writeFile(temporary[0], html, 'utf8');
    await writeFile(temporary[1], startHere, 'utf8');
    // Python's standard library keeps packaging dependency-free. Fixed ZIP entry
    // timestamps and permissions make repeated packages byte-for-byte stable.
    const python = spawnSync('python3', ['-c', `import json,sys,zipfile
spec=json.load(sys.stdin)
with zipfile.ZipFile(spec['zip'], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path,name in spec['files']:
        entry=zipfile.ZipInfo(name, date_time=(2026,1,1,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        entry.external_attr=0o100644 << 16
        with open(path,'rb') as source:
            archive.writestr(entry,source.read(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
with zipfile.ZipFile(spec['zip']) as archive:
    bad=archive.testzip()
    if bad: raise RuntimeError('Corrupt archive member: '+bad)
`], {
      input: JSON.stringify({ zip: temporary[2], files: [[temporary[0], 'Slugterra.html'], [temporary[1], 'START-HERE.txt']] }),
      encoding: 'utf8', maxBuffer: 1024 * 1024,
    });
    if (python.error) fail(`Python 3 is needed for ZIP packaging: ${python.error.message}`);
    if (python.status !== 0) fail(`ZIP packaging failed: ${python.stderr.trim() || `exit ${python.status}`}`);
    for (let i = 0; i < temporary.length; i++) await rename(temporary[i], [htmlPath, textPath, zipPath][i]);
    const htmlDigest = createHash('sha256').update(html).digest('hex');
    const zipInfo = await stat(zipPath);
    console.log(`Portable HTML: ${relative(root, htmlPath)} (${Buffer.byteLength(html).toLocaleString()} bytes)`);
    console.log(`Archive: ${relative(root, zipPath)} (${zipInfo.size.toLocaleString()} bytes; includes START-HERE.txt)`);
    console.log(`HTML SHA-256: ${htmlDigest}`);
    console.log('Local package refreshed. No website, remote commit, or environment snapshot was published.');
  } finally {
    await Promise.all(temporary.map(path => rm(path, { force: true })));
  }
} catch (error) {
  console.error(`Game packaging failed: ${error.message}`);
  process.exitCode = 1;
}
