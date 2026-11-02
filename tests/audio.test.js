import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createAudio } from '../src/audio.js';

test('audio degrades safely without a browser AudioContext', async () => {
  const audio = createAudio();
  assert.equal(await audio.unlock(), false);
  audio.shoot('fire'); audio.morph('electric'); audio.reload('water');
  audio.impact('water'); audio.footstep(); audio.jump(); audio.land(1.5);
  audio.collect(); audio.hurt(); audio.win(); audio.update(1);
  audio.setEnabled(false);
  assert.equal(audio.getStatus().enabled, false);
  assert.deepEqual(audio.getStatus().clips, []);
  assert.equal((await audio.loadClip('not-a-slot', new ArrayBuffer(20))).ok, false);
  assert.equal((await audio.loadClip('blaster', new ArrayBuffer(9 * 1024 * 1024))).ok, false);
  audio.dispose(); audio.dispose();
  assert.equal(await audio.unlock(), false);
});

test('real Web Audio renders effects, mutes tails, decodes imported clips and restores local recordings', { timeout: 30000 }, async () => {
  const source = await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/audio.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/audio.js' ? source : '<!doctype html><title>Audio test</title>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const result = await page.evaluate(async () => {
      const { createAudio, AUDIO_SLOTS } = await import('/audio.js');
      const NativeAudioContext = window.AudioContext;
      const contexts = [];
      window.AudioContext = class extends NativeAudioContext {
        constructor(options) { super(options); this.compressors = []; contexts.push(this); }
        createDynamicsCompressor() { const node = super.createDynamicsCompressor(); this.compressors.push(node); return node; }
      };
      const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      const audio = createAudio();
      const started = await audio.unlock();
      const analyser = contexts[0].createAnalyser();
      analyser.fftSize = 2048;
      contexts[0].compressors.at(-1).connect(analyser);
      audio.shoot('fire'); audio.shoot('electric'); audio.shoot('water');
      audio.morph('fire'); audio.reload('electric'); audio.impact('water');
      audio.footstep('stone'); audio.footstep('water'); audio.jump(); audio.land(1.5);
      await pause(130);
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      const audiblePeak = Math.max(...samples.map(Math.abs));
      const activeBeforeMute = audio.getStatus().activeVoices;
      audio.setEnabled(false);
      await pause(100);
      analyser.getFloatTimeDomainData(samples);
      const mutedPeak = Math.max(...samples.map(Math.abs));
      const mutedVoices = audio.getStatus().activeVoices;
      audio.setEnabled(true);

      function wav(seconds) {
        const rate = 8000, count = Math.floor(rate * seconds);
        const bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes);
        const word = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
        word(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); word(8, 'WAVE');
        word(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        word(36, 'data'); view.setUint32(40, count * 2, true);
        for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.sin(i / rate * Math.PI * 880) * 10000, true);
        return bytes;
      }
      const invalid = await audio.loadClip('blaster', new Uint8Array([1, 2, 3]));
      const tooLong = await audio.loadClip('blaster', wav(16));
      const imported = await audio.loadClip('blaster', new File([wav(0.18)], 'test-tone.wav', { type: 'audio/wav' }));
      const importedStatus = audio.getStatus();
      audio.setEnabled(false); audio.setEnabled(true);
      audio.shoot('fire');
      const recordedVoiceCount = audio.getStatus().activeVoices;
      audio.dispose();

      // A new engine reads the persisted recording from the same browser origin.
      const restored = createAudio();
      await restored.unlock();
      const restoredStatus = restored.getStatus();
      const cleared = await restored.clearClips();
      const afterClear = restored.getStatus();
      restored.dispose();
      const third = createAudio(); await third.unlock();
      const afterRestart = third.getStatus(); third.dispose();
      return { started, slots: AUDIO_SLOTS, audiblePeak, mutedPeak, activeBeforeMute, mutedVoices, invalid, tooLong, imported, importedStatus, recordedVoiceCount, restoredStatus, cleared, afterClear, afterRestart };
    });
    assert.equal(result.started, true);
    assert.ok(result.audiblePeak > 0.005, 'effect graph produces audible native PCM');
    assert.ok(result.audiblePeak < 1, 'compressor and limiter keep stacked effects below full scale');
    assert.ok(result.activeBeforeMute > 5);
    assert.equal(result.mutedVoices, 0);
    assert.ok(result.mutedPeak < 0.0001, 'mute silences active effects and cave reverb');
    assert.equal(result.invalid.ok, false);
    assert.equal(result.tooLong.ok, false);
    assert.equal(result.imported.ok, true);
    assert.equal(result.importedStatus.storageAvailable, true);
    assert.deepEqual(result.importedStatus.clips, ['blaster']);
    assert.equal(result.recordedVoiceCount, 1, 'recording replaces synthesized launch instead of layering both');
    assert.deepEqual(result.restoredStatus.clips, ['blaster']);
    assert.equal(result.cleared.ok, true);
    assert.deepEqual(result.afterClear.clips, []);
    assert.deepEqual(result.afterRestart.clips, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('the supplied MP3 is the automatic morph sound, survives clearing imports and works without local storage', { timeout: 30000 }, async () => {
  const source = await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
  const mp3 = await readFile(new URL('../src/assets/audio/slugterra-metamorphosis-shot.mp3', import.meta.url));
  const server = createServer((request, response) => {
    if (request.url === '/audio.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(source);
    } else if (request.url === '/clip.mp3') {
      response.setHeader('Content-Type', 'audio/mpeg'); response.end(mp3);
    } else {
      response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Bundled audio test</title>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const result = await page.evaluate(async dataURL => {
      const { createAudio } = await import('/audio.js');
      const NativeAudioContext = window.AudioContext;
      const contexts = [];
      window.AudioContext = class extends NativeAudioContext {
        constructor(options) { super(options); this.decodeCalls = 0; this.recordedStarts = []; contexts.push(this); }
        decodeAudioData(...args) { this.decodeCalls++; return super.decodeAudioData(...args); }
        createBufferSource() {
          const source = super.createBufferSource(), start = source.start.bind(source);
          source.start = (...args) => { this.recordedStarts.push({ buffer: source.buffer, offset: args[1] || 0 }); return start(...args); };
          return source;
        }
      };
      const slots = ['morph-fire', 'morph-electric', 'morph-water'];
      const defaults = data => Object.fromEntries(slots.map(slot => [slot, { data, offset: 0.085, label: 'Provided metamorphosis recording' }]));
      const audio = createAudio({ bundledClips: defaults(dataURL) });
      const beforeUnlock = audio.getStatus();
      const unlocked = await audio.unlock(), audioContext = contexts.at(-1);
      const ready = audio.getStatus(), decodeCalls = audioContext.decodeCalls;
      const starts = [];
      for (const element of ['fire', 'electric', 'water']) {
        audio.setEnabled(false); audio.setEnabled(true);
        const before = audioContext.recordedStarts.length;
        audio.morph(element);
        const recordings = audioContext.recordedStarts.slice(before);
        starts.push({ count: recordings.length, duration: recordings[0]?.buffer?.duration, channels: recordings[0]?.buffer?.numberOfChannels, offset: recordings[0]?.offset, voices: audio.getStatus().activeVoices });
      }
      const sampleBuffers = audioContext.recordedStarts.filter(record => record.offset > 0).map(record => record.buffer);
      const sharedDecodedBuffer = sampleBuffers.length === 3 && sampleBuffers.every(buffer => buffer === sampleBuffers[0]);
      audio.setEnabled(false); audio.morph('fire');
      const mutedVoices = audio.getStatus().activeVoices;
      audio.setEnabled(true);

      // An unmistakably shorter WAV proves import precedence by inspecting the source buffer.
      const rate = 8000, samples = 1440, bytes = new ArrayBuffer(44 + samples * 2), wav = new DataView(bytes);
      const word = (offset, text) => [...text].forEach((char, index) => wav.setUint8(offset + index, char.charCodeAt(0)));
      word(0, 'RIFF'); wav.setUint32(4, 36 + samples * 2, true); word(8, 'WAVE'); word(12, 'fmt ');
      wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, rate, true);
      wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); word(36, 'data'); wav.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++) wav.setInt16(44 + i * 2, Math.sin(i / rate * Math.PI * 880) * 10000, true);
      const imported = await audio.loadClip('morph-fire', bytes);
      audio.setEnabled(false); audio.setEnabled(true); audio.morph('fire');
      const importedDuration = audioContext.recordedStarts.at(-1).buffer.duration;
      const importedVoices = audio.getStatus().activeVoices;
      const importedStatus = audio.getStatus();
      const cleared = await audio.clearClips();
      audio.morph('fire');
      const restoredDuration = audioContext.recordedStarts.at(-1).buffer.duration;
      const restoredOffset = audioContext.recordedStarts.at(-1).offset;
      const afterClear = audio.getStatus(); audio.dispose();

      const fresh = createAudio({ bundledClips: defaults(dataURL) });
      await fresh.unlock();
      const freshStatus = fresh.getStatus(); fresh.dispose();

      // Browser storage is optional; bundled byte data must decode independently.
      const descriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
      const mp3Bytes = await (await fetch('/clip.mp3')).arrayBuffer();
      const noStorage = createAudio({ bundledClips: defaults(mp3Bytes) });
      const withoutStorageUnlocked = await noStorage.unlock();
      noStorage.morph('water');
      const noStorageStatus = noStorage.getStatus();
      const noStorageDuration = contexts.at(-1).recordedStarts.at(-1).buffer.duration;
      const noStorageDecodeCalls = contexts.at(-1).decodeCalls; noStorage.dispose();
      if (descriptor) Object.defineProperty(window, 'indexedDB', descriptor);
      else delete window.indexedDB;

      const malformed = createAudio({ bundledClips: { 'morph-fire': { data: 'data:audio/mpeg;base64,AAECAwQ=', offset: 0.085 } } });
      const malformedUnlocked = await malformed.unlock();
      malformed.morph('fire');
      const malformedStatus = malformed.getStatus(); malformed.dispose();
      return { beforeUnlock, unlocked, ready, decodeCalls, starts, sharedDecodedBuffer, mutedVoices, imported, importedDuration, importedVoices, importedStatus, cleared, restoredDuration, restoredOffset, afterClear, freshStatus, withoutStorageUnlocked, noStorageStatus, noStorageDuration, noStorageDecodeCalls, malformedUnlocked, malformedStatus };
    }, 'data:audio/mpeg;base64,' + mp3.toString('base64'));
    const slots = ['morph-fire', 'morph-electric', 'morph-water'];
    const isMP3Duration = duration => duration > 1.75 && duration < 1.85;
    assert.deepEqual(result.beforeUnlock.bundledClips, slots, 'default recordings are configured without uploading');
    assert.deepEqual(result.beforeUnlock.readyBundledClips, []);
    assert.equal(result.unlocked, true);
    assert.deepEqual(result.ready.readyBundledClips, slots);
    assert.deepEqual(result.ready.clips, [], 'bundled audio is distinguished from user imports');
    assert.equal(result.decodeCalls, 1, 'the same MP3 shared by three slots is decoded once');
    assert.equal(result.sharedDecodedBuffer, true);
    for (const start of result.starts) {
      assert.equal(start.count, 1, 'each morph plays one recording with no synthesized duplicate');
      assert.equal(start.voices, 1);
      assert.equal(start.channels, 2, 'the provided stereo clip is preserved');
      assert.ok(isMP3Duration(start.duration), 'the playing buffer is the real 1.824-second MP3');
      assert.equal(start.offset, 0.085, 'leading silence is skipped at playback without editing the asset');
    }
    assert.equal(result.mutedVoices, 0);
    assert.equal(result.imported.ok, true);
    assert.ok(Math.abs(result.importedDuration - 0.18) < 0.01);
    assert.equal(result.importedVoices, 1);
    assert.deepEqual(result.importedStatus.clips, ['morph-fire']);
    assert.equal(result.cleared.ok, true);
    assert.ok(isMP3Duration(result.restoredDuration), 'clearing an override restores the supplied recording');
    assert.equal(result.restoredOffset, 0.085);
    assert.deepEqual(result.afterClear.clips, []);
    assert.deepEqual(result.afterClear.readyBundledClips, slots);
    assert.deepEqual(result.freshStatus.clips, []);
    assert.deepEqual(result.freshStatus.readyBundledClips, slots);
    assert.equal(result.withoutStorageUnlocked, true);
    assert.equal(result.noStorageStatus.storageAvailable, false);
    assert.deepEqual(result.noStorageStatus.readyBundledClips, slots);
    assert.equal(result.noStorageStatus.activeVoices, 1);
    assert.ok(isMP3Duration(result.noStorageDuration));
    assert.equal(result.noStorageDecodeCalls, 1, 'shared ArrayBuffer defaults are also decoded once');
    assert.equal(result.malformedUnlocked, true, 'bad recorded data does not break the audio engine');
    assert.deepEqual(result.malformedStatus.failedBundledClips, ['morph-fire']);
    assert.deepEqual(result.malformedStatus.readyBundledClips, []);
    assert.ok(result.malformedStatus.activeVoices > 1, 'malformed recording falls back to synthesized effects');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
