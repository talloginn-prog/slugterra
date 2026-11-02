/**
 * Synthesized effects, bundled recordings, and optional personal SFX overrides.
 * Bundled data is decoded locally; personal imports take precedence.
 */
export const AUDIO_SLOTS = Object.freeze([
  'blaster', 'morph-fire', 'morph-electric', 'morph-water',
  'impact-fire', 'impact-electric', 'impact-water', 'reload',
]);

// The supplied 1.824 s recording contains the launch and transformation as one
// sequence. Skip its measured leading silence without modifying the asset.
export const SHOT_AUDIO_OFFSET = 0.09;

const MAX_CLIP_BYTES = 8 * 1024 * 1024;
const MAX_CLIP_SECONDS = 15;

export function createAudio({ bundledClips = {} } = {}) {
  let context = null;
  let master = null;
  let effects = null;
  let ambientBus = null;
  let breezeLevel = null;
  let enabled = true;
  let disposed = false;
  let unlocked = false;
  let elapsed = 0;
  let nextDrip = 5;
  let ambienceUpdate = 0;
  let databasePromise = null;
  let restorePromise = null;
  let clipRevision = 0;
  let storageAvailable = typeof globalThis.indexedDB !== 'undefined';
  const buffers = {};
  const persistent = [];
  const voices = new Set();
  const clips = new Map();
  const bundled = new Map();
  const shotVoices = new WeakMap();
  let shotSerial = 0, lastShot = null;
  const bundledFailures = new Set();
  const bundledEntries = Object.entries(bundledClips).filter(([slot]) => AUDIO_SLOTS.includes(slot));

  const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value) || 0));
  const kind = element => /volt|electric|tazer|lightning/i.test(String(element)) ? 'electric'
    : /tide|water|aqua/i.test(String(element)) ? 'water' : 'fire';
  const audible = () => !disposed && enabled && context?.state === 'running';

  function safeClose(audioContext) {
    try { Promise.resolve(audioContext?.close()).catch(() => {}); } catch { /* Already closed. */ }
  }

  function disconnectVoice(voice) {
    try { voice.source.stop(); } catch { /* Ended or not started. */ }
    voice.nodes.forEach(node => { try { node.disconnect(); } catch { /* Disposed. */ } });
    voices.delete(voice);
  }

  function track(source, nodes) {
    // Bound rapid-fire polyphony, including imported recordings with long tails.
    if (voices.size >= 144) disconnectVoice(voices.values().next().value);
    const voice = { source, nodes };
    voices.add(voice);
    source.onended = () => {
      voices.delete(voice);
      nodes.forEach(node => { try { node.disconnect(); } catch { /* Disposed. */ } });
    };
    return source;
  }

  function clearVoices() {
    [...voices].forEach(disconnectVoice);
  }

  function envelope(node, now, duration, level, attack) {
    node.gain.setValueAtTime(0, now);
    node.gain.linearRampToValueAtTime(level, now + Math.min(attack, duration * 0.3));
    node.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  function tone(frequency, to, duration, level, type = 'sine', delay = 0, attack = 0.005) {
    if (!audible()) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    envelope(gain, now, duration, level, attack);
    oscillator.connect(gain).connect(effects);
    track(oscillator, [oscillator, gain]);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.025);
  }

  function noise(duration, level, frequency, options = {}) {
    if (!audible()) return;
    const now = context.currentTime + (options.delay || 0);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffers[options.color || 'white'];
    source.playbackRate.value = options.rate || 1;
    filter.type = options.type || 'lowpass';
    filter.Q.value = options.q ?? 0.7;
    filter.frequency.setValueAtTime(frequency, now);
    if (options.to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), now + duration);
    envelope(gain, now, duration, level, options.attack ?? 0.003);
    source.connect(filter).connect(gain).connect(effects);
    track(source, [source, filter, gain]);
    source.start(now, Math.random() * 0.8);
    source.stop(now + duration + 0.025);
  }

  /** A brief, voiced creature chirp, separate from its elemental effect. */
  function chirp(element, delay = 0, strength = 1) {
    const k = kind(element);
    const base = k === 'electric' ? 800 : k === 'water' ? 450 : 590;
    tone(base, base * 1.62, 0.085, 0.062 * strength, 'triangle', delay, 0.012);
    tone(base * 1.68, base * 0.9, 0.13, 0.045 * strength, 'sine', delay + 0.065, 0.009);
    tone(base * 2.03, base * 2.8, 0.07, 0.012 * strength, 'sine', delay + 0.018);
  }

  function mechanicalRelease() {
    // Catch, pneumatic piston, resonant barrel, then the returning breech.
    noise(0.025, 0.13, 3900, { type: 'highpass' });
    tone(1510, 560, 0.034, 0.055, 'triangle');
    noise(0.135, 0.32, 1700, { type: 'bandpass', q: 0.65, to: 180, color: 'brown', delay: 0.008 });
    noise(0.1, 0.11, 2100, { to: 380, delay: 0.015 });
    tone(158, 46, 0.13, 0.24, 'sine', 0.005);
    noise(0.028, 0.08, 3400, { type: 'bandpass', q: 2, delay: 0.083 });
    tone(740, 390, 0.045, 0.035, 'triangle', 0.09);
  }

  function elementalBurst(element, scale = 1, delay = 0) {
    const k = kind(element);
    if (k === 'electric') {
      noise(0.12, 0.13 * scale, 2700, { type: 'bandpass', q: 1.6, to: 700, delay });
      tone(1340, 120, 0.16, 0.09 * scale, 'sawtooth', delay);
      for (let i = 0; i < 3; i++) {
        noise(0.018, 0.15 * scale, 4700, { type: 'highpass', delay: delay + i * 0.038 });
        tone(1900 - i * 310, 410, 0.035, 0.045 * scale, 'square', delay + i * 0.037);
      }
    } else if (k === 'water') {
      noise(0.31, 0.23 * scale, 1700, { type: 'bandpass', q: 0.6, to: 420, delay, attack: 0.014 });
      noise(0.17, 0.11 * scale, 4200, { type: 'highpass', delay: delay + 0.025 });
      for (let i = 0; i < 4; i++) {
        tone(390 + i * 133, 160 + i * 66, 0.09, 0.055 * scale, 'sine', delay + i * 0.035);
      }
    } else {
      noise(0.28, 0.28 * scale, 2300, { to: 190, color: 'brown', delay });
      noise(0.16, 0.14 * scale, 2400, { type: 'highpass', to: 800, delay: delay + 0.018 });
      tone(110, 36, 0.22, 0.18 * scale, 'triangle', delay);
      for (let i = 0; i < 4; i++) {
        noise(0.018, 0.07 * scale, 2200 + i * 630, { type: 'bandpass', q: 1, delay: delay + 0.04 + i * 0.043 });
      }
    }
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (!globalThis.indexedDB || disposed) {
      storageAvailable = false;
      return Promise.resolve(null);
    }
    databasePromise = new Promise(resolve => {
      let settled = false;
      let timer;
      const finish = result => {
        if (settled) { result?.close(); return; }
        settled = true;
        clearTimeout(timer);
        storageAvailable = Boolean(result);
        resolve(result);
      };
      try {
        const request = globalThis.indexedDB.open('slugterra-recorded-audio-v1', 1);
        timer = setTimeout(() => finish(null), 2500);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('clips')) {
            request.result.createObjectStore('clips', { keyPath: 'id' });
          }
        };
        request.onsuccess = () => finish(request.result);
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
      } catch {
        finish(null);
      }
    });
    return databasePromise;
  }

  async function storedOperation(mode, operation) {
    const db = await openDatabase();
    if (!db) throw new Error('Local audio storage is unavailable.');
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction('clips', mode);
        const request = operation(transaction.objectStore('clips'));
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => { storageAvailable = false; reject(new Error('Local audio storage failed.')); };
        transaction.onabort = () => { storageAvailable = false; reject(new Error('Local audio storage was cancelled.')); };
      } catch (error) {
        storageAvailable = false;
        reject(error);
      }
    });
  }

  async function restoreClips() {
    const revision = clipRevision;
    try {
      const rows = await storedOperation('readonly', store => store.getAll());
      for (const row of rows || []) {
        if (disposed || revision !== clipRevision) break;
        if (!AUDIO_SLOTS.includes(row.id) || !(row.data instanceof ArrayBuffer)
          || !row.data.byteLength || row.data.byteLength > MAX_CLIP_BYTES) continue;
        try {
          const decoded = await context.decodeAudioData(row.data.slice(0));
          if (!disposed && revision === clipRevision && decoded.duration > 0 && decoded.duration <= MAX_CLIP_SECONDS) {
            clips.set(row.id, decoded);
          }
        } catch { /* A damaged or unsupported saved clip does not block game audio. */ }
      }
    } catch { /* Effects still work in memory if browser persistence is disabled. */ }
  }

  /** Decode bundled data without a network request or browser-storage dependency. */
  async function restoreBundledClips() {
    const decodedAssets = new Map();
    await Promise.all(bundledEntries.map(async ([slot, entry]) => {
      const descriptor = entry && typeof entry === 'object' && 'data' in entry ? entry : { data: entry };
      const data = descriptor.data;
      try {
        if (!decodedAssets.has(data)) {
          decodedAssets.set(data, (async () => {
            let bytes;
            if (data instanceof ArrayBuffer) bytes = data.slice(0);
            else if (ArrayBuffer.isView(data)) bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            else if (typeof data === 'string' && /^data:audio\/[\w.+-]+;base64,/i.test(data)) {
              const raw = globalThis.atob(data.slice(data.indexOf(',') + 1));
              bytes = Uint8Array.from(raw, character => character.charCodeAt(0)).buffer;
            }
            if (!bytes?.byteLength || bytes.byteLength > MAX_CLIP_BYTES) throw new Error('Invalid bundled recording.');
            const buffer = await context.decodeAudioData(bytes);
            if (!buffer.duration || buffer.duration > MAX_CLIP_SECONDS) throw new Error('Bundled effect is too long.');
            return buffer;
          })());
        }
        const buffer = await decodedAssets.get(data);
        if (!disposed) bundled.set(slot, { buffer, offset: clamp(descriptor.offset, 0, Math.max(0, buffer.duration - 0.01)), sequence: descriptor.sequence === true });
      } catch {
        if (!disposed) bundledFailures.add(slot);
      }
    }));
  }

  /** Personal override > included recording > synthesized effect. */
  function playClip(slot) {
    const imported = clips.get(slot);
    const recording = bundled.get(slot);
    const buffer = imported || recording?.buffer;
    if (!buffer || !audible()) return false;
    const offset = imported ? 0 : recording.offset;
    const duration = buffer.duration - offset;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.9, now + Math.min(0.004, duration * 0.1));
    gain.gain.setValueAtTime(0.9, now + Math.max(0.004, duration - 0.008));
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(gain).connect(effects);
    track(source, [source, gain]);
    source.start(now, offset);
    return source;
  }

  function initialize() {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass || disposed) return false;
    try {
      context = new AudioContextClass({ latencyHint: 'interactive' });
      master = context.createGain();
      effects = context.createGain();
      ambientBus = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const limiter = context.createDynamicsCompressor();
      master.gain.value = enabled ? 0.72 : 0;
      effects.gain.value = 0.72;
      ambientBus.gain.value = 0.32;
      compressor.threshold.value = -19;
      compressor.knee.value = 15;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.15;
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      effects.connect(master);
      ambientBus.connect(master);
      master.connect(compressor).connect(limiter).connect(context.destination);
      persistent.push(master, effects, ambientBus, compressor, limiter);

      for (const color of ['white', 'brown']) {
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          brown = (brown + white * 0.035) / 1.035;
          data[i] = color === 'white' ? white : brown * 5;
        }
        buffers[color] = buffer;
      }

      // Restrained stereo cave reflection; the dry transient remains clear.
      if (context.createConvolver) {
        const reverb = context.createConvolver();
        const wet = context.createGain();
        const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 0.64), context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          for (let i = 0; i < data.length; i++) {
            const progress = i / data.length;
            data[i] = i < context.sampleRate * 0.025 ? 0 : (Math.random() * 2 - 1) * (1 - progress) ** 3;
          }
        }
        reverb.buffer = impulse;
        wet.gain.value = 0.085;
        effects.connect(reverb).connect(wet).connect(master);
        persistent.push(reverb, wet);
      }

      const breeze = context.createBufferSource();
      const airFilter = context.createBiquadFilter();
      breezeLevel = context.createGain();
      breeze.buffer = buffers.brown;
      breeze.loop = true;
      breeze.playbackRate.value = 0.65;
      airFilter.type = 'lowpass';
      airFilter.frequency.value = 640;
      breezeLevel.gain.value = 0.075;
      breeze.connect(airFilter).connect(breezeLevel).connect(ambientBus);
      breeze.start();
      persistent.push(breeze, airFilter, breezeLevel);

      for (const [frequency, level] of [[65.406, 0.019], [98, 0.008], [130.9, 0.004]]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.value = level;
        oscillator.connect(gain).connect(ambientBus);
        oscillator.start();
        persistent.push(oscillator, gain);
      }
      return true;
    } catch {
      persistent.forEach(node => {
        try { node.stop?.(); } catch { /* Partial initialization. */ }
        try { node.disconnect(); } catch { /* Partial initialization. */ }
      });
      persistent.length = 0;
      safeClose(context);
      context = null;
      master = null;
      effects = null;
      ambientBus = null;
      return false;
    }
  }

  async function unlock() {
    if (disposed) return false;
    if (!context && !initialize()) return false;
    try {
      await context.resume();
      unlocked = context?.state === 'running';
      if (!restorePromise) restorePromise = Promise.all([restoreBundledClips(), restoreClips()]);
      await restorePromise;
      return unlocked;
    } catch {
      return false;
    }
  }

  return {
    unlock,
    setEnabled(value) {
      enabled = Boolean(value);
      if (!master || !context) return;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      // Immediate mute also silences reverb and cancels pending recorded/effect tails.
      master.gain.setValueAtTime(0, now);
      if (enabled) master.gain.linearRampToValueAtTime(0.72, now + 0.075);
      else clearVoices();
    },
    shoot(element) {
      const receipt = { id: ++shotSerial, shotTime: context?.currentTime ?? null, morphTime: null, sequenceStarted: false, cancelled: false };
      lastShot = receipt;
      const morphSlot = 'morph-' + kind(element);
      // Personal launch and transformation slots replace the combined default
      // for this shot, so its later recorded cue cannot play under an override.
      if (clips.has('blaster') && playClip('blaster')) return receipt;
      if (bundled.get(morphSlot)?.sequence && !clips.has(morphSlot)) {
        const source = playClip(morphSlot);
        if (source) {
          receipt.sequenceStarted = true;
          shotVoices.set(receipt, source);
          return receipt;
        }
      }
      if (playClip('blaster')) return receipt;
      mechanicalRelease();
      chirp(element, 0.025, 0.75);
      elementalBurst(element, 0.65, 0.025);
      return receipt;
    },
    morph(element, receipt) {
      if (receipt && typeof receipt === 'object') receipt.morphTime = context?.currentTime ?? null;
      const slot = 'morph-' + kind(element);
      if (clips.has(slot) && playClip(slot)) return;
      // A combined recording already started at the muzzle. Replaying it here
      // produces the delayed second launch that this per-shot receipt avoids.
      if (receipt?.sequenceStarted) return;
      if (!bundled.get(slot)?.sequence && playClip(slot)) return;
      noise(0.24, 0.16, 300, { type: 'bandpass', q: 1.2, to: 3800, attack: 0.03 });
      tone(180, 1170, 0.22, 0.095, 'triangle', 0, 0.035);
      tone(270, 1755, 0.21, 0.045, 'sine', 0.01, 0.03);
      chirp(element, 0.015, 0.55);
      elementalBurst(element, 0.8, 0.16);
      tone(185, 43, 0.22, 0.21, 'sine', 0.17);
    },
    cancelShot(receipt) {
      // A companion stopped by nearby cover never transforms. Stop its pending
      // recorded sequence; an already transformed shot keeps its effect tail.
      if (!receipt || receipt.morphTime !== null || receipt.cancelled) return false;
      const source = shotVoices.get(receipt);
      if (!source) return false;
      // Keep a short launch transient even if collision is detected in the same
      // simulation batch as firing; nearby cover must not make the gun silent.
      try { source.stop(Math.max(context?.currentTime ?? 0, receipt.shotTime + 0.08)); } catch { /* The short recording may have ended. */ }
      shotVoices.delete(receipt);
      receipt.cancelled = true;
      return true;
    },
    reload(element) {
      if (playClip('reload')) return;
      for (let i = 0; i < 3; i++) {
        noise(0.026, 0.1, 1800 + i * 700, { type: 'bandpass', q: 2.7, delay: i * 0.075 });
        tone(910 - i * 110, 550 - i * 80, 0.04, 0.035, 'triangle', i * 0.075);
      }
      noise(0.12, 0.09, 900, { type: 'bandpass', to: 2300, delay: 0.11 });
      chirp(element, 0.23, 0.55);
    },
    impact(element) {
      if (playClip('impact-' + kind(element))) return;
      noise(0.075, 0.19, 1400, { type: 'bandpass', q: 0.65 });
      tone(95, 28, 0.24, 0.23);
      elementalBurst(element, 1.05, 0.008);
    },
    footstep(surface = 'stone', speed = 1) {
      const force = clamp(speed, 0.4, 1.7);
      if (/water/i.test(String(surface))) {
        noise(0.17, 0.18 * force, 1800, { type: 'bandpass', q: 0.5, to: 500 });
        tone(270, 95, 0.09, 0.035 * force);
        noise(0.055, 0.07 * force, 3900, { type: 'highpass', delay: 0.035 });
      } else if (/grass|moss|leaf/i.test(String(surface))) {
        noise(0.115, 0.09 * force, 2700, { type: 'bandpass', q: 0.5, to: 900 });
        tone(85, 42, 0.085, 0.07 * force);
      } else {
        tone(125 + Math.random() * 25, 43, 0.105, 0.11 * force);
        noise(0.052, 0.13 * force, 1300, { type: 'bandpass', q: 0.6, to: 460 });
        noise(0.09, 0.038 * force, 2900, { type: 'highpass', delay: 0.025 });
      }
    },
    jump() {
      noise(0.12, 0.095, 1400, { type: 'bandpass', to: 3000 });
      tone(110, 190, 0.1, 0.055, 'triangle');
    },
    land(intensity = 1) {
      const force = clamp(intensity, 0.25, 2);
      tone(145, 32, 0.19, 0.15 * force);
      noise(0.115, 0.15 * force, 1200, { to: 250, color: 'brown' });
      noise(0.055, 0.07 * force, 2600, { type: 'bandpass', q: 0.8, delay: 0.02 });
    },
    collect() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(frequency, frequency, 0.64, 0.08, 'sine', index * 0.08, 0.008);
        tone(frequency * 2.01, frequency * 2, 0.22, 0.015, 'sine', index * 0.08);
      });
      noise(0.3, 0.025, 5200, { type: 'highpass', attack: 0.03 });
    },
    hurt() {
      tone(105, 36, 0.24, 0.2, 'triangle');
      noise(0.17, 0.13, 630, { to: 100, color: 'brown' });
      noise(0.025, 0.08, 1700, { type: 'bandpass' });
    },
    win() {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(frequency, frequency, 1.8, 0.065, 'sine', index * 0.14, 0.04);
        tone(frequency * 2, frequency * 2, 0.6, 0.008, 'triangle', index * 0.14, 0.025);
      });
    },
    update(dt) {
      if (!audible()) return;
      const step = clamp(dt, 0, 0.25);
      elapsed += step;
      ambienceUpdate += step;
      if (ambienceUpdate > 0.5) {
        ambienceUpdate = 0;
        breezeLevel?.gain.setTargetAtTime(0.065 + Math.sin(elapsed * 0.17) * 0.018, context.currentTime, 0.7);
      }
      if (elapsed > nextDrip) {
        const frequency = [740, 880, 1046.5, 1318.5][Math.floor(Math.random() * 4)];
        tone(frequency, frequency * 0.72, 0.14, 0.016, 'sine');
        tone(frequency * 0.5, frequency * 0.49, 0.8, 0.006, 'sine', 0.08);
        nextDrip = elapsed + 5 + Math.random() * 9;
      }
    },
    async loadClip(slot, fileOrArrayBuffer) {
      if (!AUDIO_SLOTS.includes(slot)) return { ok: false, message: 'Unknown audio slot.' };
      if (disposed) return { ok: false, message: 'The audio engine has been closed.' };
      const fileSize = fileOrArrayBuffer?.size ?? fileOrArrayBuffer?.byteLength ?? 0;
      if (!fileSize || fileSize > MAX_CLIP_BYTES) {
        return { ok: false, message: 'Choose an audio clip smaller than 8 MB.' };
      }
      try {
        if (!await unlock()) return { ok: false, message: 'Audio could not start. Enable audio in your browser and try again.' };
        let bytes;
        if (fileOrArrayBuffer instanceof ArrayBuffer) bytes = fileOrArrayBuffer.slice(0);
        else if (ArrayBuffer.isView(fileOrArrayBuffer)) {
          bytes = fileOrArrayBuffer.buffer.slice(fileOrArrayBuffer.byteOffset, fileOrArrayBuffer.byteOffset + fileOrArrayBuffer.byteLength);
        } else if (typeof fileOrArrayBuffer.arrayBuffer === 'function') {
          bytes = await fileOrArrayBuffer.arrayBuffer();
        }
        if (!(bytes instanceof ArrayBuffer) || !bytes.byteLength || bytes.byteLength > MAX_CLIP_BYTES) {
          return { ok: false, message: 'Choose an audio clip smaller than 8 MB.' };
        }
        const revision = clipRevision;
        const decoded = await context.decodeAudioData(bytes.slice(0));
        if (!decoded.duration || decoded.duration > MAX_CLIP_SECONDS) {
          return { ok: false, message: 'Use a short sound effect of 15 seconds or less.' };
        }
        if (disposed || revision !== clipRevision) return { ok: false, message: 'Audio import was cancelled.' };
        clips.set(slot, decoded);
        try {
          await storedOperation('readwrite', store => store.put({ id: slot, data: bytes }));
          return { ok: true, message: 'Recorded clip imported and saved on this device.' };
        } catch {
          return { ok: true, message: 'Recorded clip imported for this session; browser storage is unavailable.' };
        }
      } catch {
        return { ok: false, message: 'Could not decode this file. Try a supported WAV, MP3, OGG, or M4A audio clip.' };
      }
    },
    async clearClips() {
      clipRevision++;
      clips.clear();
      clearVoices();
      try {
        await storedOperation('readwrite', store => store.clear());
        return { ok: true, message: 'Imported clips removed. Included recordings and original effects restored.' };
      } catch {
        return { ok: false, message: 'Clips cleared for this session; saved browser audio could not be removed.' };
      }
    },
    getStatus() {
      return {
        enabled, unlocked: unlocked && context?.state === 'running',
        contextState: context?.state || 'uninitialized', activeVoices: voices.size,
        clips: AUDIO_SLOTS.filter(slot => clips.has(slot)), storageAvailable,
        bundledClips: bundledEntries.map(([slot]) => slot).filter(slot => !bundledFailures.has(slot)),
        readyBundledClips: AUDIO_SLOTS.filter(slot => bundled.has(slot)),
        failedBundledClips: AUDIO_SLOTS.filter(slot => bundledFailures.has(slot)),
        lastShot: lastShot ? { ...lastShot } : null,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unlocked = false;
      clipRevision++;
      clearVoices();
      clips.clear();
      bundled.clear();
      persistent.forEach(node => {
        try { node.stop?.(); } catch { /* Source already stopped. */ }
        try { node.disconnect(); } catch { /* Node already disconnected. */ }
      });
      persistent.length = 0;
      databasePromise?.then(db => db?.close()).catch(() => {});
      safeClose(context);
      context = null;
      master = null;
      effects = null;
      ambientBus = null;
      breezeLevel = null;
    },
  };
}
