import { createGameState, CAMPAIGN_SAVE_KEY } from '../src/game-state.js';
import { configuredProviders, getSocialAccount } from './social-auth.js';

const MAX_BYTES = 128 * 1024;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' } });

export function normalizeProgress(value) {
  if (!value || value.version !== 2 || !Array.isArray(value.collected) || !Array.isArray(value.ownedSlugs) || !Array.isArray(value.equippedSlugs) || value.equippedSlugs.length !== 3) return null;
  const records = new Map([[CAMPAIGN_SAVE_KEY, JSON.stringify(value)]]);
  const game = createGameState({ getItem: key => records.get(key) || null, setItem: (key, data) => records.set(key, data) });
  if (!game.hasSave() || !game.save()) return null;
  return JSON.parse(records.get(CAMPAIGN_SAVE_KEY));
}

const record = row => row ? { progress: JSON.parse(row.progress), revision: row.revision, updatedAt: row.updated_at } : { progress: null, revision: 0, updatedAt: null };

export async function handleProgressAPI(request, env, { account = getSocialAccount } = {}) {
  const url = new URL(request.url);
  if (!['/api/account', '/api/progress'].includes(url.pathname)) return null;
  const user = await account(request, env);
  if (url.pathname === '/api/account') return request.method === 'GET' ? json({ user, providers: configuredProviders(env) }) : json({ error: 'Method not allowed' }, 405);
  if (!user) return json({ error: 'Sign in to save progress to your account.' }, 401);
  const expectedAccount = request.headers.get('X-Slugterra-Account');
  if ((expectedAccount && expectedAccount !== user.id) || (request.method === 'PUT' && !expectedAccount)) return json({ error: 'Your account session changed. Reload before syncing.' }, 401);
  if (!env.DB) return json({ error: 'Account saves are temporarily unavailable.' }, 503);
  const read = () => env.DB.prepare('SELECT progress, revision, updated_at FROM player_progress WHERE user_id = ?').bind(user.id).first();
  try {
    if (request.method === 'GET') return json(record(await read()));
    if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
    if (request.headers.get('Origin') !== url.origin || request.headers.get('X-Slugterra-Save') !== '1') return json({ error: 'Invalid save origin.' }, 403);
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
    if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return json({ error: 'Save is too large.' }, 413);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Missing save.' }, 400);
    const chunks = []; let length = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > MAX_BYTES) { await reader.cancel(); return json({ error: 'Save is too large.' }, 413); } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!Number.isSafeInteger(body?.revision) || body.revision < 0) return json({ error: 'Invalid save revision.' }, 400);
    const progress = normalizeProgress(body.progress);
    if (!progress) return json({ error: 'Invalid expedition save.' }, 400);
    const data = JSON.stringify(progress), updatedAt = new Date().toISOString();
    const result = body.revision === 0
      ? await env.DB.prepare('INSERT OR IGNORE INTO player_progress (user_id, progress, revision, updated_at) VALUES (?, ?, 1, ?)').bind(user.id, data, updatedAt).run()
      : await env.DB.prepare('UPDATE player_progress SET progress = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(data, updatedAt, user.id, body.revision).run();
    if (result.meta.changes !== 1) return json({ error: 'Another device saved a newer expedition.', ...record(await read()) }, 409);
    return json({ revision: body.revision + 1, updatedAt });
  } catch { return json({ error: 'Could not reach account storage. Your local save is safe.' }, 503); }
}
