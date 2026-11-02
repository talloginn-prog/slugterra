import { CAVERNS, SLUG_CATALOG, BLASTERS, SKILLS } from './content.js';
import { ASPECT_RATIOS, RESOLUTIONS } from './display.js';

export const SAVE_KEY = 'slugterra.luminous-deep.v1';

export const CAMPAIGN_SAVE_KEY = 'slugterra.campaign.v2';
export const SLUGS = Object.freeze(['ember', 'volt', 'tide'].map(id => SLUG_CATALOG[id]));
const STARTERS = ['ember', 'volt', 'tide'];
const caveExists = id => typeof id === 'string' && Object.hasOwn(CAVERNS, id);
const slugExists = id => typeof id === 'string' && Object.hasOwn(SLUG_CATALOG, id);
const blasterById = id => BLASTERS.find(item => item.id === id);
const skillById = id => SKILLS.find(item => item.id === id);
const identifiers = value => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && /^[a-z0-9][a-z0-9:_-]{0,119}$/i.test(id)))].slice(0, 500) : [];
const progressFor = (position = { x: 0, y: 3, z: 28 }) => ({ position: safePosition(position), defeated: [], discoveries: [], completed: false });

const SHARDS = ['shard-west', 'shard-east', 'shard-depths'];
const finite = (value, fallback, min = 0, max = 1e6) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const safePosition = (value) => ({ x: finite(value?.x, 0, -94, 94), y: finite(value?.y, 3, -10, 100), z: finite(value?.z, 35, -94, 94) });

function initialState(settings) {
  return {
    health: 100, maxHealth: 100, shield: 40, maxShield: 40,
    xp: 0, xpToNext: 100, level: 1, selectedSlug: 0,
    slugs: SLUGS.map((slug) => ({ ...slug, unlocked: true, cooldown: 0, inFlight: false })),
    currentCavern: 'luminous', visitedCaverns: ['luminous'],
    cavernProgress: { luminous: progressFor({ x: 0, y: 3, z: 35 }) },
    checkpoint: { cavernId: 'luminous', position: { x: 0, y: 3, z: 35 } },
    ownedSlugs: [...STARTERS], equippedSlugs: [...STARTERS],
    coins: 100, ownedBlasters: ['standard'], equippedBlaster: 'standard',
    skills: [], skillCooldowns: {}, activeSkills: {}, completedEncounters: [], energyBoost: 0,
    quest: {}, shards: 0, collected: [], kills: 0, deaths: 0,
    bossDefeated: false, questStarted: false, won: false,
    settings: { sound: true, sensitivity: 1, quality: 'high', difficulty: 'normal', aspectRatio: 'auto', resolution: 'auto', ...settings },
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
  // Identity-keyed runtime records retain recovery when equipment is swapped.
  const runtimeSlugs = new Map(state.slugs.map(slug => [slug.id, slug]));
  updateQuest(state);

  function emit(event) {
    for (const listener of listeners) listener(state, event);
    return event;
  }

  function readSave() {
    const read = key => { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } };
    const campaign = read(CAMPAIGN_SAVE_KEY);
    if (campaign && typeof campaign === 'object' && !Array.isArray(campaign) && campaign.version === 2 && Array.isArray(campaign.collected) && Array.isArray(campaign.ownedSlugs) && Array.isArray(campaign.equippedSlugs) && campaign.equippedSlugs.length === 3 && caveExists(campaign.currentCavern)) return campaign;
    const legacy = read(SAVE_KEY);
    return legacy && legacy.version === 1 && typeof legacy === 'object' && !Array.isArray(legacy) && Array.isArray(legacy.collected) ? legacy : null;
  }

  function hasSave() { return Boolean(readSave()); }

  function applySave(saved) {
    state.energyBoost = 0;
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
    if (['high', 'ultra', 'medium', 'low'].includes(saved.settings?.quality)) state.settings.quality = saved.settings.quality;
    if (['easy', 'normal', 'hard'].includes(saved.settings?.difficulty)) state.settings.difficulty = saved.settings.difficulty;
    if (ASPECT_RATIOS.includes(saved.settings?.aspectRatio)) state.settings.aspectRatio = saved.settings.aspectRatio;
    if (RESOLUTIONS.includes(saved.settings?.resolution)) state.settings.resolution = saved.settings.resolution;
    if (saved.version === 2) {
      state.currentCavern = saved.currentCavern;
      state.visitedCaverns = [...new Set(['luminous', state.currentCavern, ...identifiers(saved.visitedCaverns).filter(caveExists)])];
      state.cavernProgress = {};
      for (const id of state.visitedCaverns) {
        const item = saved.cavernProgress?.[id];
        state.cavernProgress[id] = { ...progressFor(item?.position), defeated: identifiers(item?.defeated), discoveries: identifiers(item?.discoveries).filter(slugExists), completed: item?.completed === true };
      }
      state.cavernProgress[state.currentCavern].position = { ...state.position };
      state.ownedSlugs = [...new Set([...STARTERS, ...identifiers(saved.ownedSlugs).filter(slugExists)])];
      const used = new Set();
      state.equippedSlugs = saved.equippedSlugs.map((id, slot) => {
        const fallback = STARTERS.find(starter => !used.has(starter));
        const valid = slugExists(id) && state.ownedSlugs.includes(id) && !used.has(id) ? id : fallback;
        used.add(valid); return valid;
      });
      state.coins = Math.floor(finite(saved.coins, 100, 0, 1e7));
      state.ownedBlasters = [...new Set(['standard', ...identifiers(saved.ownedBlasters).filter(blasterById)])];
      state.equippedBlaster = state.ownedBlasters.includes(saved.equippedBlaster) ? saved.equippedBlaster : 'standard';
      state.skills = identifiers(saved.skills).filter(skillById);
      // Drop a malformed prerequisite chain instead of granting free mastery.
      state.skills = state.skills.filter(id => skillById(id).prerequisites.every(prerequisite => state.skills.includes(prerequisite)));
      state.skillCooldowns = Object.fromEntries(state.skills.map(id => [id, finite(saved.skillCooldowns?.[id], 0, 0, skillById(id).cooldown)]));
      state.activeSkills = {};
      state.completedEncounters = identifiers(saved.completedEncounters);
      const checkpointCavern = caveExists(saved.checkpoint?.cavernId) && state.visitedCaverns.includes(saved.checkpoint.cavernId) ? saved.checkpoint.cavernId : state.currentCavern;
      state.checkpoint = { cavernId: checkpointCavern, position: safePosition(saved.checkpoint?.position || state.cavernProgress[checkpointCavern].position) };
    }
    runtimeSlugs.clear();
    for (const id of state.ownedSlugs) runtimeSlugs.set(id, { ...SLUG_CATALOG[id], unlocked: true, cooldown: finite(saved.slugCooldowns?.[id], 0, 0, 10), inFlight: false });
    state.slugs.splice(0, 3, ...state.equippedSlugs.map(id => runtimeSlugs.get(id)));
    state.hasSave = true;
    updateQuest(state);
  }

  function save(position) {
    if (position) state.position = safePosition(position);
    state.cavernProgress[state.currentCavern] ||= progressFor(state.position);
    state.cavernProgress[state.currentCavern].position = { ...state.position };
    const payload = {
      version: 2, health: state.health, shield: state.shield, xp: state.xp,
      level: state.level, selectedSlug: state.selectedSlug, collected: [...state.collected],
      questStarted: state.questStarted, bossDefeated: state.bossDefeated, won: state.won,
      kills: state.kills, deaths: state.deaths, position: state.position, settings: state.settings,
      currentCavern: state.currentCavern, visitedCaverns: state.visitedCaverns,
      cavernProgress: state.cavernProgress, checkpoint: state.checkpoint,
      ownedSlugs: state.ownedSlugs, equippedSlugs: state.equippedSlugs,
      coins: state.coins, ownedBlasters: state.ownedBlasters, equippedBlaster: state.equippedBlaster,
      skills: state.skills, skillCooldowns: state.skillCooldowns,
      completedEncounters: state.completedEncounters,
      slugCooldowns: Object.fromEntries([...runtimeSlugs].map(([id, slug]) => [id, slug.cooldown])),
    };
    try {
      if (!storage) return false;
      const serialized = JSON.stringify(payload);
      storage.setItem(CAMPAIGN_SAVE_KEY, serialized);
      // Keep the original v1 save untouched, including when quota/write fails.
      if (storage.getItem(CAMPAIGN_SAVE_KEY) !== serialized) return false;
      state.hasSave = true;
      return true;
    } catch { return false; }
  }

  function reset() {
    const settings = { ...state.settings };
    Object.assign(state, initialState(settings));
    updateQuest(state);
    runtimeSlugs.clear(); state.slugs.forEach(slug => runtimeSlugs.set(slug.id, slug));
    sinceDamage = 10;
    try { storage?.removeItem(CAMPAIGN_SAVE_KEY); storage?.removeItem(SAVE_KEY); } catch { /* Private browsers can deny storage. */ }
    return emit({ event: 'reset' });
  }

  function start({ fresh = false } = {}) {
    if (fresh) reset();
    const saved = fresh ? null : readSave();
    if (saved) applySave(saved);
    state.slugs.forEach((slug) => { slug.inFlight = false; });
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
    state.energyBoost = Math.max(0, state.energyBoost - dt);
    for (const slug of runtimeSlugs.values()) slug.cooldown = Math.max(0, slug.cooldown - dt);
    for (const id of Object.keys(state.skillCooldowns)) state.skillCooldowns[id] = Math.max(0, state.skillCooldowns[id] - dt);
    for (const id of Object.keys(state.activeSkills)) state.activeSkills[id] = Math.max(0, state.activeSkills[id] - dt);
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
    if (!slug || !slug.unlocked || slug.cooldown > 0 || slug.inFlight) return null;
    const blaster = blasterById(state.equippedBlaster) || BLASTERS[0];
    slug.cooldown = slug.cooldownMax * blaster.cooldownMultiplier;
    if (slug.element === 'water') {
      heal(4);
      state.shield = Math.min(state.maxShield, state.shield + 8);
    }
    if (slug.element === 'healing') heal(slug.healAmount || 12);
    const energyMultiplier = slug.element !== 'energy' && state.energyBoost > 0 ? 1.25 : 1;
    if (slug.element === 'energy') {
      state.energyBoost = slug.supportDuration || 6;
      state.shield = Math.min(state.maxShield, state.shield + (slug.shieldAmount || 14));
    } else if (energyMultiplier > 1) state.energyBoost = 0;
    emit({ event: 'fired', slug });
    return { ...slug, damage: slug.damage * blaster.damageMultiplier * (state.activeSkills.mastery > 0 ? 1.2 : 1) * energyMultiplier, energyBoosted: energyMultiplier > 1 };
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
      state.currentCavern = state.checkpoint.cavernId;
      state.position = { ...state.checkpoint.position };
      save();
      return emit({ event: 'respawn', message: `Your slugs brought you back to ${CAVERNS[state.currentCavern].shortName}. Your progress is safe.`, position: { ...state.position }, cavernId: state.currentCavern, type: 'warning' });
    }
    return emit({ event: 'damage', amount });
  }

  function addKill({ boss = false, encounterId } = {}) {
    if (encounterId && state.completedEncounters.includes(encounterId)) return { ok: false, event: 'already-completed' };
    if (encounterId) recordEncounter(encounterId);
    state.kills += 1;
    state.coins += boss ? 60 : 12;
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
    else if (key === 'difficulty' && ['easy', 'normal', 'hard'].includes(value)) state.settings.difficulty = value;
    else if (key === 'quality' && ['high', 'ultra', 'medium', 'low'].includes(value)) state.settings.quality = value;
    else if (key === 'aspectRatio' && ASPECT_RATIOS.includes(value)) state.settings.aspectRatio = value;
    else if (key === 'resolution' && RESOLUTIONS.includes(value)) state.settings.resolution = value;
    else return false;
    save();
    emit({ event: 'setting-changed', key, value: state.settings[key] });
    return true;
  }

  const reject = (event, message) => ({ ok: false, event, message, type: 'warning' });
  const success = (event, message, extra = {}) => { save(); return emit({ ok: true, event, message, type: 'success', ...extra }); };
  function travel(cavernId, position) {
    if (!caveExists(cavernId)) return reject('unknown-cavern', 'That cavern is not on your map.');
    if (cavernId !== state.currentCavern && !CAVERNS[state.currentCavern].connections.includes(cavernId)) return reject('route-unavailable', 'There is no travel route to that cavern from here.');
    if (state.slugs.some(slug => slug.inFlight)) return reject('companion-in-flight', 'Wait for your companions to return before traveling.');
    state.cavernProgress[state.currentCavern] ||= progressFor(state.position);
    state.cavernProgress[state.currentCavern].position = { ...state.position };
    state.cavernProgress[cavernId] ||= progressFor(cavernId === 'luminous' ? { x: 0, y: 3, z: 35 } : undefined);
    state.currentCavern = cavernId;
    if (!state.visitedCaverns.includes(cavernId)) state.visitedCaverns.push(cavernId);
    state.position = safePosition(position || state.cavernProgress[cavernId].position);
    return success('cavern-traveled', `Entered ${CAVERNS[cavernId].name}.`, { cavernId, position: { ...state.position } });
  }
  function setCheckpoint(cavernId, position) {
    if (!caveExists(cavernId) || cavernId !== state.currentCavern) return reject('checkpoint-unavailable', 'Reach this cavern before resting at its checkpoint.');
    const safe = safePosition(position || state.position);
    state.checkpoint = { cavernId, position: safe };
    state.position = { ...safe };
    state.health = state.maxHealth; state.shield = state.maxShield;
    return success('checkpoint-set', 'Checkpoint secured. Your companions and vitality are restored.', { cavernId, position: { ...safe } });
  }
  function discoverSlug(id) {
    if (!slugExists(id)) return reject('unknown-slug', 'This companion is not in the field catalog.');
    if (state.ownedSlugs.includes(id)) return reject('already-discovered', 'This companion is already in your collection.');
    state.ownedSlugs.push(id);
    runtimeSlugs.set(id, { ...SLUG_CATALOG[id], unlocked: true, cooldown: 0, inFlight: false });
    state.cavernProgress[state.currentCavern] ||= progressFor(state.position);
    state.cavernProgress[state.currentCavern].discoveries.push(id);
    state.coins += 25; gainXP(45);
    return success('slug-discovered', `${SLUG_CATALOG[id].name} joined your collection · +25 coins · +45 XP. Equip a companion in your arsenal.`, { slugId: id });
  }
  function equipSlug(id, slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2 || !state.ownedSlugs.includes(id)) return reject('equip-unavailable', 'Discover that companion and choose one of three equipped slots.');
    if (state.equippedSlugs[slot] === id) return { ok: true, event: 'already-equipped', slugId: id, slot };
    if (state.equippedSlugs.includes(id)) return reject('already-equipped', 'That companion is already equipped in another slot.');
    const next = runtimeSlugs.get(id), previous = state.slugs[slot];
    if (previous?.inFlight || next?.inFlight) return reject('companion-in-flight', 'Wait until the companion returns before changing this slot.');
    state.equippedSlugs[slot] = id; state.slugs.splice(slot, 1, next);
    return success('slug-equipped', `${next.name} equipped in slot ${slot + 1}.`, { slugId: id, slot });
  }
  function buyBlaster(id) {
    const item = blasterById(id);
    if (!item) return reject('unknown-blaster', 'This blaster is not stocked here.');
    if (state.ownedBlasters.includes(id)) return reject('already-owned', 'You already own that blaster.');
    if (state.coins < item.price) return reject('insufficient-coins', `You need ${item.price} coins for ${item.name}.`);
    state.coins -= item.price; state.ownedBlasters.push(id); state.equippedBlaster = id;
    return success('blaster-purchased', `${item.name} purchased and equipped.`, { blasterId: id });
  }
  function equipBlaster(id) {
    if (!state.ownedBlasters.includes(id) || !blasterById(id)) return reject('blaster-not-owned', 'Purchase this blaster before equipping it.');
    state.equippedBlaster = id;
    return success('blaster-equipped', `${blasterById(id).name} equipped.`, { blasterId: id });
  }
  function learnSkill(id) {
    const skill = skillById(id);
    if (!skill) return reject('unknown-skill', 'This technique is not available.');
    if (state.skills.includes(id)) return reject('already-learned', 'You have already learned this technique.');
    if (!skill.prerequisites.every(required => state.skills.includes(required))) return reject('prerequisite-required', 'Learn Guided Flight before this advanced technique.');
    if (state.coins < skill.price) return reject('insufficient-coins', `Training costs ${skill.price} coins.`);
    state.coins -= skill.price; state.skills.push(id); state.skillCooldowns[id] = 0;
    return success('skill-learned', `${skill.name} learned.`, { skillId: id });
  }
  function useSkill(id) {
    const skill = skillById(id);
    if (!skill || !state.skills.includes(id)) return reject('skill-not-learned', 'Visit the trainer to learn this technique.');
    if (state.skillCooldowns[id] > 0) return reject('skill-cooling', 'This technique is still recovering.');
    state.skillCooldowns[id] = skill.cooldown; state.activeSkills[id] = skill.duration;
    return success('skill-activated', `${skill.name} active.`, { skillId: id, duration: skill.duration });
  }
  function recordEncounter(id) {
    state.completedEncounters.push(id);
    state.cavernProgress[state.currentCavern] ||= progressFor(state.position);
    state.cavernProgress[state.currentCavern].defeated.push(id);
  }
  function completeEncounter(id, reward = { coins: 12, xp: 35 }) {
    if (!identifiers([id]).length) return reject('invalid-encounter', 'This encounter has no stable identity.');
    if (state.completedEncounters.includes(id)) return reject('already-completed', 'This encounter reward has already been claimed.');
    recordEncounter(id);
    const value = typeof reward === 'number' ? { coins: reward, xp: 0 } : reward || {};
    const coins = Math.floor(finite(value.coins, 0, 0, 1000)), xp = Math.floor(finite(value.xp, 0, 0, 1000));
    state.coins += coins; gainXP(xp);
    return success('encounter-completed', `Encounter cleared · +${coins} coins${xp ? ` · +${xp} XP` : ''}.`, { encounterId: id, coins, xp });
  }
  function completeCavern(id = state.currentCavern) {
    if (id !== state.currentCavern || !caveExists(id)) return reject('cavern-unavailable', 'Reach this cavern before completing its expedition.');
    const progress = state.cavernProgress[id];
    if (progress.completed) return reject('already-completed', 'This cavern expedition is already recorded.');
    progress.completed = true; state.coins += 50; gainXP(75);
    return success('cavern-completed', `${CAVERNS[id].name} expedition recorded · +50 coins · +75 XP.`);
  }

  // Hydrate before menu settings can be changed: a sound toggle on the title
  // screen must not overwrite an existing expedition with a fresh character.
  const existingSave = readSave();
  if (existingSave) applySave(existingSave);
  state.hasSave = Boolean(existingSave);
  return { state, start, tick, selectSlug, fire, damage, heal, addKill, interact, save, hasSave, reset, setSetting, travel, setCheckpoint, discoverSlug, equipSlug, buyBlaster, equipBlaster, learnSkill, useSkill, completeEncounter, completeCavern, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
