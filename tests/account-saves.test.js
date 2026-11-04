import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createAccountSaves } from '../src/account-saves.js';
import { createGameState, CAMPAIGN_SAVE_KEY } from '../src/game-state.js';
import { handleProgressAPI, normalizeProgress } from '../server/progress-api.js';

const origin = 'https://game.test';
const fixtureAccount = request => { const id = request.headers.get('oai-authenticated-user-id'); return id ? { id, name: id } : null; };
function memory() { const map = new Map(); return { map, getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) }; }
function progress(level = 1) { const local = memory(), game = createGameState(local); game.state.level = level; game.save(); return JSON.parse(local.getItem(CAMPAIGN_SAVE_KEY)); }
function service() {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../drizzle/0000_player_progress.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { return { bind(...params) { return { async first() { return db.prepare(sql).get(...params) || null; }, async run() { return { meta: { changes: db.prepare(sql).run(...params).changes } }; } }; } }; } };
  const call = (user = 'player-one') => async (path, options = {}) => {
    const headers = new Headers(options.headers); if (user) { headers.set('oai-authenticated-user-id',user); headers.set('oai-authenticated-user-email',`${user}@test.invalid`); }
    if (options.method === 'PUT') { headers.set('Origin',origin); if (!headers.has('X-Slugterra-Account')) headers.set('X-Slugterra-Account', user || 'anonymous'); }
    return handleProgressAPI(new Request(origin + path,{...options,headers}),{DB},{ account: fixtureAccount });
  };
  return { DB, call, close: () => db.close() };
}
const put = (revision,data) => ({ method:'PUT', headers:{'Content-Type':'application/json','X-Slugterra-Save':'1',Origin:origin}, body:JSON.stringify({revision,progress:data}) });

test('account API rejects anonymous writes, cross-origin writes, malformed saves and oversized streams', async t => {
  const api=service();t.after(api.close);
  assert.equal((await api.call(null)('/api/progress',put(0,progress()))).status,401);
  const auth={'oai-authenticated-user-id':'one','X-Slugterra-Account':'one'};
  const bad=put(0,progress());bad.headers.Origin='https://evil.test';
  assert.equal((await handleProgressAPI(new Request(origin+'/api/progress',{...bad,headers:{...bad.headers,...auth}}),{DB:api.DB},{ account: fixtureAccount })).status,403);
  assert.equal((await handleProgressAPI(new Request(origin+'/api/progress',{headers:auth}),{DB:api.DB})).status,401);
  assert.equal((await api.call()('/api/progress',put(0,{version:2}))).status,400);
  assert.equal((await api.call()('/api/progress',put(0,{...progress(),currentCavern:'not-a-cavern'}))).status,400);
  const huge=put(0,progress());huge.body=' '.repeat(128*1024+1);
  assert.equal((await api.call()('/api/progress',huge)).status,413);
  const clean=normalizeProgress({...progress(),coins:Infinity,ownedSlugs:['bad'],equippedSlugs:['bad','bad','bad'],userId:'victim'});
  assert.equal(clean.coins,100);assert.equal(clean.userId,undefined);assert.deepEqual(clean.equippedSlugs,['ember','volt','tide']);
});

test('SQL saves are account scoped and compare revisions atomically across devices',async t=>{
  const api=service();t.after(api.close);
  const one=api.call('one'),two=api.call('two');
  assert.equal((await one('/api/progress',put(0,progress(4)))).status,200);
  assert.equal((await two('/api/progress')).status,200);
  assert.equal((await (await two('/api/progress')).json()).progress,null);
  const race=await Promise.all([one('/api/progress',put(1,progress(5))),one('/api/progress',put(1,progress(6)))]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const cloud=await (await one('/api/progress')).json();assert.equal(cloud.revision,2);assert.equal(cloud.progress.level,5);
  assert.match((await one('/api/progress')).headers.get('cache-control'),/no-store/);
});

test('guest progress stays separate; signed-in progress resumes on a fresh device',async t=>{
  const api=service();t.after(api.close);const local=memory();local.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(7)));
  const guest=createAccountSaves({local,fetcher:api.call(null)});t.after(()=>guest.stop());await guest.initialize();assert.equal(guest.status.phase,'guest');assert.equal(await guest.flush(),false);
  const account=createAccountSaves({local,fetcher:api.call(),delay:1e6});t.after(()=>account.stop());await account.initialize();
  assert.equal(account.storage.getItem(CAMPAIGN_SAVE_KEY),null);assert.equal(account.status.guestAvailable,true);
  assert.equal(account.importGuest(),true);assert.equal(await account.flush(),true);
  assert.equal(JSON.parse(local.getItem(CAMPAIGN_SAVE_KEY)).level,7);
  const other=createAccountSaves({local:memory(),fetcher:api.call()});t.after(()=>other.stop());await other.initialize();assert.equal(JSON.parse(other.storage.getItem(CAMPAIGN_SAVE_KEY)).level,7);
  const second=createAccountSaves({local,fetcher:api.call('different')});t.after(()=>second.stop());await second.initialize();assert.equal(second.storage.getItem(CAMPAIGN_SAVE_KEY),null);
});

test('conflicts retain both saves and require a choice before another write',async t=>{
  const api=service();t.after(api.close);
  const first=createAccountSaves({local:memory(),fetcher:api.call(),delay:1e6}), second=createAccountSaves({local:memory(),fetcher:api.call(),delay:1e6});
  t.after(()=>{first.stop();second.stop();});await first.initialize();await second.initialize();
  first.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(2)));await first.flush();
  second.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(3)));assert.equal(await second.flush(),false);
  assert.equal(second.status.phase,'conflict');assert.equal(second.status.conflict.progress.level,2);assert.equal(JSON.parse(second.storage.getItem(CAMPAIGN_SAVE_KEY)).level,3);
  assert.equal(await second.flush(),false);second.keepLocal();assert.equal(await second.flush(),true);
  first.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(4)));await first.flush();assert.equal(first.status.phase,'conflict');
  first.useCloud();assert.equal(JSON.parse(first.storage.getItem(CAMPAIGN_SAVE_KEY)).level,3);assert.equal(first.status.phase,'saved');
});

test('offline writes and quota failures recover; writes during an upload are not lost',async t=>{
  const api=service();t.after(api.close);let offline=false,release=null,hold=false;
  const fetcher=async(path,opts)=>{if(offline)throw Error('offline');if(hold&&opts?.method==='PUT'){hold=false;await new Promise(r=>release=r);}return api.call()(path,opts);};
  const local=memory();local.setItem=()=>{throw Error('quota');};
  const saves=createAccountSaves({local,fetcher,delay:1e6});t.after(()=>saves.stop());await saves.initialize();offline=true;
  saves.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(3)));await saves.flush();assert.equal(saves.status.phase,'offline');assert.equal(saves.status.deviceSaved,false);assert.equal(JSON.parse(saves.storage.getItem(CAMPAIGN_SAVE_KEY)).level,3);
  offline=false;hold=true;const upload=saves.flush();await Promise.resolve();saves.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(4)));release();await upload;assert.equal(saves.status.phase,'pending');
  await saves.flush();const cloud=await(await api.call()('/api/progress')).json();assert.equal(cloud.progress.level,4);assert.equal(cloud.revision,2);
});

test('expired or switched sessions never move a running expedition into another account',async t=>{
  const api=service();t.after(api.close);let user='one';
  const saves=createAccountSaves({local:memory(),fetcher:(path,opts)=>api.call(user)(path,opts),delay:1e6});t.after(()=>saves.stop());
  await saves.initialize();saves.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(6)));await saves.flush();
  user='two';saves.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(7)));await saves.flush();assert.equal(saves.status.phase,'expired');
  await saves.initialize();assert.equal(saves.status.phase,'expired');
  saves.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(7)));assert.equal(await saves.flush(),false);assert.equal(saves.status.phase,'expired');
  assert.equal((await(await api.call('two')('/api/progress')).json()).progress,null);
  assert.equal((await(await api.call('one')('/api/progress')).json()).progress.level,6);
});

test('reopening an offline device detects a newer account revision before uploading',async t=>{
  const api=service();t.after(api.close);const local=memory();let offline=false;
  const first=createAccountSaves({local,fetcher:(p,o)=>offline?Promise.reject(Error('offline')):api.call()(p,o),delay:1e6});t.after(()=>first.stop());
  await first.initialize();first.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(2)));await first.flush();
  offline=true;first.storage.setItem(CAMPAIGN_SAVE_KEY,JSON.stringify(progress(3)));await first.flush();
  await api.call()('/api/progress',put(1,progress(4)));
  const reopened=createAccountSaves({local,fetcher:api.call(),delay:1e6});t.after(()=>reopened.stop());await reopened.initialize();
  assert.equal(reopened.status.phase,'conflict');assert.equal(reopened.status.conflict.progress.level,4);assert.equal(JSON.parse(reopened.storage.getItem(CAMPAIGN_SAVE_KEY)).level,3);
});
