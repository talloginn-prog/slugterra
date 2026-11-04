import { CAMPAIGN_SAVE_KEY, SAVE_KEY } from './game-state.js';

/** Local writes are synchronous. Account synchronization is serialized and revision checked. */
export function createAccountSaves({ local, fetcher = globalThis.fetch?.bind(globalThis), onChange = () => {}, delay = 1500 } = {}) {
  if (local === undefined) { try { local = globalThis.localStorage; } catch { local = null; } }
  const memory = new Map();
  const read = key => { if (memory.has(key)) return memory.get(key); try { return local?.getItem(key) ?? null; } catch { return null; } };
  const write = (key, value) => { memory.set(key, value); const progress = key.endsWith(CAMPAIGN_SAVE_KEY) || key.endsWith(SAVE_KEY); try { if (!local) throw new Error('Device storage unavailable'); local.setItem(key, value); if (progress) status.deviceSaved = local.getItem(key) === value; } catch { if (progress) status.deviceSaved = false; } };
  const remove = key => { memory.set(key, null); try { local?.removeItem(key); } catch { /* Device storage may be unavailable. */ } };
  const parse = text => { try { return JSON.parse(text); } catch { return null; } };
  const status = { user: null, providers: { google: false, microsoft: false }, phase: 'checking', revision: 0, updatedAt: null, conflict: null, guestAvailable: false, deviceSaved: null };
  let prefix = '', dirty = false, timer = null, inFlight = null, stopped = false, enabled = false, initializedId;
  const key = name => prefix + name;
  const metadataKey = () => key('slugterra.sync.v1');
  const metadata = () => write(metadataKey(), JSON.stringify({ revision: status.revision, dirty, updatedAt: status.updatedAt }));
  const notify = () => onChange({ ...status });
  const schedule = () => { clearTimeout(timer); if (enabled && !stopped && !status.conflict) timer = setTimeout(() => { timer = null; void flush(); }, delay); };
  const request = async (path, options = {}) => {
    const response = await fetcher(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(6000), ...options });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Account service unavailable');
    const body = await response.json(); return { response, body };
  };
  const storage = {
    getItem: name => read(key(name)),
    setItem(name, value) { write(key(name), value); if (name === CAMPAIGN_SAVE_KEY && status.user) { dirty = true; metadata(); if (!status.conflict && status.phase !== 'expired') status.phase = 'pending'; notify(); schedule(); } },
    removeItem(name) { remove(key(name)); },
  };
  async function initialize() {
    try {
      const { response, body } = await request('/api/account');
      if (!response.ok) throw new Error('Account service unavailable');
      status.providers = { google: body.providers?.google === true, microsoft: body.providers?.microsoft === true };
      const user = body.user || null;
      if (initializedId !== undefined && (user?.id || null) !== initializedId) {
        enabled = false; status.phase = 'expired'; notify(); return status;
      }
      status.user = user; initializedId = user?.id || null;
      if (!status.user) { status.phase = 'guest'; notify(); return status; }
      prefix = `slugterra.account.${encodeURIComponent(status.user.id)}.`;
      status.guestAvailable = Boolean(read(CAMPAIGN_SAVE_KEY) || read(SAVE_KEY));
      const meta = parse(read(metadataKey()));
      status.revision = meta?.revision || 0; status.updatedAt = meta?.updatedAt || null; dirty = meta?.dirty === true;
      const cloud = await request('/api/progress', { headers: { 'X-Slugterra-Account': status.user.id } });
      if (!cloud.response.ok) throw new Error('Account storage unavailable');
      enabled = true;
      if (cloud.body.progress && dirty && cloud.body.revision !== status.revision) {
        status.conflict = cloud.body; status.phase = 'conflict';
      } else if (cloud.body.progress && !dirty) {
        write(key(CAMPAIGN_SAVE_KEY), JSON.stringify(cloud.body.progress));
        status.revision = cloud.body.revision; status.updatedAt = cloud.body.updatedAt; status.phase = 'saved'; metadata();
      } else { status.phase = dirty ? 'pending' : 'ready'; if (dirty) schedule(); }
    } catch { status.phase = status.user ? 'offline' : 'unavailable'; }
    notify(); return status;
  }
  async function flush() {
    clearTimeout(timer); timer = null;
    if (inFlight) return inFlight;
    if (!status.user || !enabled || status.conflict || !dirty || stopped) return false;
    const snapshot = read(key(CAMPAIGN_SAVE_KEY)); if (!snapshot) return false;
    const revision = status.revision;
    status.phase = 'saving'; notify();
    inFlight = (async () => {
      try {
        const serialized = JSON.stringify({ revision, progress: parse(snapshot) });
        const { response, body } = await request('/api/progress', { method: 'PUT', keepalive: new TextEncoder().encode(serialized).length < 60 * 1024, headers: { 'Content-Type': 'application/json', 'X-Slugterra-Save': '1', 'X-Slugterra-Account': status.user.id }, body: serialized });
        if (response.status === 409) { status.conflict = body; status.phase = 'conflict'; notify(); return false; }
        if (response.status === 401) { enabled = false; status.phase = 'expired'; notify(); return false; }
        if (!response.ok) throw new Error('Save failed');
        status.revision = body.revision; status.updatedAt = body.updatedAt;
        dirty = snapshot !== read(key(CAMPAIGN_SAVE_KEY)); metadata(); status.phase = dirty ? 'pending' : 'saved'; notify();
        return true;
      } catch { status.phase = 'offline'; notify(); return false; }
      finally { inFlight = null; if (dirty && status.phase === 'pending') schedule(); }
    })();
    return inFlight;
  }
  function useCloud() {
    if (!status.conflict?.progress) return false;
    // Keep the displaced device copy available for recovery.
    const previous = read(key(CAMPAIGN_SAVE_KEY)); if (previous) write(key('slugterra.previous-local.v1'), previous);
    write(key(CAMPAIGN_SAVE_KEY), JSON.stringify(status.conflict.progress));
    status.revision = status.conflict.revision; status.updatedAt = status.conflict.updatedAt;
    status.conflict = null; dirty = false; metadata(); status.phase = 'saved'; notify(); return true;
  }
  function keepLocal() {
    if (!status.conflict) return false;
    status.revision = status.conflict.revision; status.conflict = null; dirty = true; metadata(); status.phase = 'pending'; notify(); schedule(); return true;
  }
  function importGuest() {
    if (!status.user || status.conflict) return false;
    const campaign = read(CAMPAIGN_SAVE_KEY), legacy = read(SAVE_KEY);
    const previous = read(key(CAMPAIGN_SAVE_KEY)); if (previous) write(key('slugterra.previous-local.v1'), previous);
    if (campaign) storage.setItem(CAMPAIGN_SAVE_KEY, campaign);
    else if (legacy) { remove(key(CAMPAIGN_SAVE_KEY)); write(key(SAVE_KEY), legacy); }
    else return false;
    return true;
  }
  return { storage, status, initialize, flush, useCloud, keepLocal, importGuest,
    async retry() { if (status.user && !enabled) { await initialize(); } else await flush(); },
    stop() { stopped = true; clearTimeout(timer); },
  };
}
