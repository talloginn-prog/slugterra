export const SAVE_KEY = 'slugterra.luminous-deep.v1';

export const SLUGS = Object.freeze([
  Object.freeze({ id: 'ember', name: 'Burpy', species: 'Infurnus', element: 'fire', color: '#f58a36', description: 'An orange Infurnus with a red flamecrest and yellow belly. Burpy launches searing fire; his Velocimorph grows a blazing mane and deals heavier damage.', damage: 34, speed: 58, morphSpeed: 44.7, morphMultiplier: 1.6, cooldownMax: 0.7 }),
  Object.freeze({ id: 'volt', name: 'Joules', species: 'Tazerling', element: 'electric', color: '#5aa9ed', description: 'A blue Tazerling with yellow lightning antennae. Joules fires rapid electric shots that stagger targets, then gains jagged lightning fins as a Velocimorph.', damage: 24, speed: 66, morphSpeed: 44.7, morphMultiplier: 1.6, cooldownMax: 0.4 }),
  Object.freeze({ id: 'tide', name: 'AquaBeek', species: 'AquaBeek', element: 'water', color: '#60d9de', description: 'A cyan water slug with purple fins and a little beak. AquaBeek restores health and shield when fired; the Velocimorph unfurls broad aquatic fins.', damage: 18, speed: 52, morphSpeed: 44.7, morphMultiplier: 1.6, cooldownMax: 1.2 }),
]);

const SHARDS = ['shard-west', 'shard-east', 'shard-depths'];
const finite = (value, fallback, min = 0, max = 1e6) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const safePosition = (value) => ({ x: finite(value?.x, 0, -94, 94), y: finite(value?.y, 3, -10, 100), z: finite(value?.z, 35, -94, 94) });

function initialState(settings) {
  return {
    health: 100, maxHealth: 100, shield: 40, maxShield: 40,
    xp: 0, xpToNext: 100, level: 1, selectedSlug: 0,
    slugs: SLUGS.map((slug) => ({ ...slug, unlocked: true, cooldown: 0 })),
    quest: {}, shards: 0, collected: [], kills: 0, deaths: 0,
    bossDefeated: false, questStarted: false, won: false,
    settings: { sound: true, sensitivity: 1, quality: 'high', ...settings },
    hasSave: false, position: { x: 0, y: 3, z: 35 },
  };
}

function updateQuest(state) {
  state.shards = state.collected.length;
  const stage = !state.questStarted ? 'briefing' : state.shards < 3 ? 'shards' : !state.bossDefeated ? 'boss' : !state.won ? 'return' : 'complete';
  const quests = {
    briefing: { title: 'A light in the dark', description: 'Find the expedition guide at the Haven beacon. Press E nearby.', progress: 0, total: 1 },
    shards: { title: 'The heart of the cavern', description: 'Recover the three luminous shards. Follow the cyan beacons.', progress: state.shards, total: 3 },
    boss: { title: 'Awaken the deep', description: 'Reach the ancient heart and defeat the corrupted Warden.', progress: 0, total: 1 },
    return: { title: 'Bring the light home', description: 'Return to the guide at Haven to restore the cavern.', progress: 0, total: 1 },
    complete: { title: 'Keeper of the luminous deep', description: 'The cavern shines again. Keep exploring with your slug companions.', progress: 1, total: 1 },
  };
  state.quest = { ...quests[stage], stage };
}

/** Pure game rules; rendering, movement and combat collision live in the client. */
export function createGameState(providedStorage) {
  let storage = providedStorage;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const listeners = new Set();
  const state = initialState();
  let sinceDamage = 10;
  updateQuest(state);

  function emit(event) {
    for (const listener of listeners) listener(state, event);
    return event;
  }

  function readSave() {
    try {
      const saved = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
      return saved && saved.version === 1 && typeof saved === 'object' && !Array.isArray(saved) && Array.isArray(saved.collected) ? saved : null;
    } catch { return null; }
  }

  function hasSave() { return Boolean(readSave()); }

  function applySave(saved) {
    const level = Math.floor(finite(saved.level, 1, 1, 20));
    state.level = level;
    state.maxHealth = 100 + (level - 1) * 12;
    state.maxShield = 40 + (level - 1) * 4;
    state.health = finite(saved.health, state.maxHealth, 1, state.maxHealth);
    state.shield = finite(saved.shield, state.maxShield, 0, state.maxShield);
    state.xpToNext = level * 100;
    state.xp = Math.floor(finite(saved.xp, 0, 0, state.xpToNext - 1));
    state.selectedSlug = Math.floor(finite(saved.selectedSlug, 0, 0, 2));
    state.collected = [...new Set(saved.collected.filter((id) => SHARDS.includes(id)))];
    state.questStarted = saved.questStarted === true || state.collected.length > 0;
    state.bossDefeated = state.collected.length === 3 && saved.bossDefeated === true;
    state.won = state.bossDefeated && saved.won === true;
    state.kills = Math.floor(finite(saved.kills, 0, 0, 1e6));
    state.deaths = Math.floor(finite(saved.deaths, 0, 0, 1e6));
    state.position = safePosition(saved.position);
    if (typeof saved.settings?.sound === 'boolean') state.settings.sound = saved.settings.sound;
    state.settings.sensitivity = finite(saved.settings?.sensitivity, 1, 0.25, 2.5);
    if (['high', 'medium', 'low'].includes(saved.settings?.quality)) state.settings.quality = saved.settings.quality;
    state.hasSave = true;
    updateQuest(state);
  }

  function save(position) {
    if (position) state.position = safePosition(position);
    const payload = {
      version: 1, health: state.health, shield: state.shield, xp: state.xp,
      level: state.level, selectedSlug: state.selectedSlug, collected: [...state.collected],
      questStarted: state.questStarted, bossDefeated: state.bossDefeated, won: state.won,
      kills: state.kills, deaths: state.deaths, position: state.position, settings: state.settings,
    };
    try {
      if (!storage) return false;
      storage.setItem(SAVE_KEY, JSON.stringify(payload));
      state.hasSave = true;
      return true;
    } catch { return false; }
  }

  function reset() {
    const settings = { ...state.settings };
    Object.assign(state, initialState(settings));
    updateQuest(state);
    sinceDamage = 10;
    try { storage?.removeItem(SAVE_KEY); } catch { /* Private browsers can deny storage. */ }
    return emit({ event: 'reset' });
  }

  function start({ fresh = false } = {}) {
    if (fresh) reset();
    const saved = fresh ? null : readSave();
    if (saved) applySave(saved);
    state.slugs.forEach((slug) => { slug.cooldown = 0; });
    save();
    return emit({ event: saved ? 'restored' : 'started', position: { ...state.position } });
  }

  function gainXP(amount) {
    state.xp += amount;
    let leveled = false;
    while (state.xp >= state.xpToNext && state.level < 20) {
      state.xp -= state.xpToNext;
      state.level += 1;
      state.xpToNext = state.level * 100;
      state.maxHealth += 12;
      state.maxShield += 4;
      state.health = state.maxHealth;
      state.shield = state.maxShield;
      leveled = true;
    }
    if (state.level === 20) state.xp = Math.min(state.xp, state.xpToNext - 1);
    if (leveled) emit({ event: 'level-up', message: `Level ${state.level} — vitality and shield increased.`, type: 'success' });
    return leveled;
  }

  function tick(dt) {
    dt = finite(dt, 0, 0, 1);
    for (const slug of state.slugs) slug.cooldown = Math.max(0, slug.cooldown - dt);
    sinceDamage += dt;
    if (sinceDamage > 7) state.shield = Math.min(state.maxShield, state.shield + dt * 2.5);
  }

  function selectSlug(index) {
    if (!Number.isInteger(index) || !state.slugs[index]?.unlocked) return false;
    state.selectedSlug = index;
    emit({ event: 'slug-selected', slug: state.slugs[index] });
    return true;
  }

  function heal(amount) {
    const before = state.health;
    state.health = Math.min(state.maxHealth, state.health + finite(amount, 0));
    return state.health - before;
  }

  function fire() {
    const slug = state.slugs[state.selectedSlug];
    if (!slug || !slug.unlocked || slug.cooldown > 0) return null;
    slug.cooldown = slug.cooldownMax;
    if (slug.element === 'water') {
      heal(4);
      state.shield = Math.min(state.maxShield, state.shield + 8);
    }
    emit({ event: 'fired', slug });
    return { ...slug };
  }

  function damage(amount) {
    amount = finite(amount, 0);
    if (!amount) return { event: 'damage', amount: 0 };
    sinceDamage = 0;
    const absorbed = Math.min(state.shield, amount);
    state.shield -= absorbed;
    state.health = Math.max(0, state.health - (amount - absorbed));
    if (state.health <= 0) {
      state.deaths += 1;
      state.health = state.maxHealth;
      state.shield = state.maxShield;
      state.position = { x: 0, y: 3, z: 35 };
      save();
      return emit({ event: 'respawn', message: 'Your slugs brought you back to Haven. Your progress is safe.', type: 'warning' });
    }
    return emit({ event: 'damage', amount });
  }

  function addKill({ boss = false } = {}) {
    state.kills += 1;
    gainXP(boss ? 180 : 35);
    if (boss && state.quest.stage === 'boss') {
      state.bossDefeated = true;
      updateQuest(state);
      save();
      return emit({ event: 'boss-defeated', message: 'The Warden has fallen. Bring the light back to Haven.', type: 'success' });
    }
    save();
    return emit({ event: 'enemy-defeated', message: '+35 XP · The corruption recedes.', type: 'success' });
  }

  function interact(id) {
    if (id === 'guide') {
      if (state.quest.stage === 'briefing') {
        state.questStarted = true;
        updateQuest(state);
        save();
        return emit({ event: 'quest-started', message: 'The cavern is fading. Find three heart shards, face the Warden, and bring their light home.', type: 'quest' });
      }
      if (state.quest.stage === 'return') {
        state.won = true;
        gainXP(150);
        state.health = state.maxHealth;
        state.shield = state.maxShield;
        updateQuest(state);
        save();
        return emit({ event: 'quest-complete', message: 'The luminous deep lives again. You are its new keeper.', type: 'success' });
      }
      heal(state.maxHealth);
      state.shield = state.maxShield;
      const message = state.won ? 'Haven welcomes you, Keeper. There is always more to discover.' : 'Follow the luminous beacons. Your slugs will see you through. Rest here to recover.';
      save();
      return emit({ event: 'rested', message, type: 'info' });
    }
    if (SHARDS.includes(id)) {
      if (!state.questStarted) return emit({ event: 'briefing-required', message: 'Speak to the expedition guide at Haven first.', type: 'info' });
      if (state.collected.includes(id)) return emit({ event: 'already-collected', message: 'This shard is already safe in your pack.', type: 'info' });
      state.collected.push(id);
      gainXP(60);
      heal(25);
      updateQuest(state);
      save();
      return emit({ event: state.shards === 3 ? 'boss-unlocked' : 'shard-collected', message: state.shards === 3 ? 'All three shards recovered. The ancient Warden stirs in the deep.' : `Heart shard recovered · ${state.shards} / 3 · +60 XP`, type: 'success' });
    }
    return { event: 'nothing', message: 'There is nothing to interact with here.', type: 'info' };
  }

  function setSetting(key, value) {
    if (key === 'sound' && typeof value === 'boolean') state.settings.sound = value;
    else if (key === 'sensitivity' && Number.isFinite(Number(value))) state.settings.sensitivity = finite(Number(value), 1, 0.25, 2.5);
    else if (key === 'quality' && ['high', 'medium', 'low'].includes(value)) state.settings.quality = value;
    else return false;
    save();
    emit({ event: 'setting-changed', key, value: state.settings[key] });
    return true;
  }

  // Hydrate before menu settings can be changed: a sound toggle on the title
  // screen must not overwrite an existing expedition with a fresh character.
  const existingSave = readSave();
  if (existingSave) applySave(existingSave);
  state.hasSave = Boolean(existingSave);
  return { state, start, tick, selectSlug, fire, damage, heal, addKill, interact, save, hasSave, reset, setSetting, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
