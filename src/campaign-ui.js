import { CAVERNS, SLUG_CATALOG, BLASTERS, SKILLS } from './content.js';
import burpyProto from './assets/references/burpy-protoform.png?inline';
import burpyMorph from './assets/references/burpy-velocimorph.png?inline';
import joulesProto from './assets/references/joules-protoform.png?inline';
import joulesMorph from './assets/references/joules-velocimorph.png?inline';
import docProto from './assets/references/doc-protoform.png?inline';
import docMorph from './assets/references/doc-velocimorph.png?inline';
import frostProto from './assets/references/frost-protoform.png?inline';
import frostMorph from './assets/references/frost-velocimorph.png?inline';
import glowProto from './assets/references/glow-protoform.png?inline';
import glowMorph from './assets/references/glow-velocimorph.png?inline';
import forestStill from './assets/references/dark-spores-cavern.webp?inline';
import pyriteStill from './assets/references/pyrite-cavern.webp?inline';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const refs = { ember: [burpyProto, burpyMorph], volt: [joulesProto, joulesMorph], doc: [docProto, docMorph], frost: [frostProto, frostMorph], glow: [glowProto, glowMorph] };
const descriptions = {
  ember: 'Your fiery Infurnus companion. Heavy fire attacks reward a clear line of sight and a well-timed launch.',
  volt: 'A fast Tazerling with lightning-shaped horns. Electrical hits interrupt a hostile’s attack.',
  tide: 'Your loyal AquaBeek. Water shots help replenish your vitality and shield as you explore.',
  frost: 'A single-eyed ice companion with a cyan body. Freezing shots slow approaching hostiles and create a moment to reposition.',
  doc: 'An exceptionally rare Boon Doc. Gentle in protoform, this green companion restores vitality when launched.',
  glow: 'A radiant Phosphoro. Its bright flashes briefly dazzle hostiles and illuminate the way forward.',
};
const caveImages = { 'dark-spores': forestStill, pyrite: pyriteStill };
const caveCopy = {
  luminous: 'Return to the amber lights of Haven. Kael’s expedition, the lost heartshards and the Hollow Warden await.',
  'dark-spores': 'Descend beneath red-rimmed lantern mushrooms and twisting black roots. Find the forest survey beacon and seek a rare healer.',
  pyrite: 'Cross luminous blue terraces beneath vast waterfall curtains. Explore the broken monuments and search for a new companion.',
};
const skillCopy = {
  'slug-fu': 'Guide the selected companion in outward flight toward your aim. Keep moving while your slug follows your focus.',
  mastery: 'Draw on your training to strengthen your companions’ next shots for a short time.',
};
const title = (eyebrow, heading) => `<p class="eyebrow">${eyebrow}</p><h2 id="dialog-title">${heading}</h2>`;
const coins = state => `<span class="campaign-wallet"><i aria-hidden="true">◈</i> <b>${Math.floor(state.coins || 0)}</b> GOLD</span>`;
const ownedIds = state => Array.isArray(state.ownedSlugs) ? state.ownedSlugs : (state.slugs || []).map(slug => slug.id);
const equippedIds = state => Array.isArray(state.equippedSlugs) ? state.equippedSlugs : (state.slugs || []).map(slug => slug.id);

export function campaignSlugArt(slug, morphed = false, useReference = false) {
  if (refs[slug.id] && (useReference || ['doc', 'frost', 'glow'].includes(slug.id))) {
    return `<img class="slug-art reference-slug-art ${morphed ? 'velocimorph-art' : 'protoform-art'}" data-form="${morphed ? 'velocimorph' : 'protoform'}" src="${refs[slug.id][morphed ? 1 : 0]}" alt="${esc(slug.name)} ${morphed ? 'transformed' : 'protoform'}" draggable="false"/>`;
  }
  if (!['ice', 'light', 'healing'].includes(slug.element)) return '';
  const frost = slug.element === 'ice';
  const color = frost ? '#a7e7fc' : '#ffe694';
  const eye = frost ? '<ellipse cx="55" cy="46" rx="10" ry="8" fill="#ecfbff"/><ellipse cx="58" cy="46" rx="4" ry="6" fill="#273e7a"/><ellipse cx="78" cy="45" rx="8" ry="7" fill="#ecfbff"/><ellipse cx="80" cy="45" rx="3" ry="5" fill="#273e7a"/>' : '<ellipse cx="64" cy="45" rx="19" ry="13" fill="#fffce5"/><ellipse cx="65" cy="45" rx="9" ry="11" fill="#dcb25a"/><ellipse cx="67" cy="45" rx="4" ry="8" fill="#4c6140"/>';
  const body = frost
    ? `<path d="m24 76 8-24 9-16 4-14 10 10 13-19 9 19 14-7-1 18 10 14-8 22-22 8-29-2Z" fill="${color}" stroke="#315f80" stroke-width="2"/><path d="m32 55 11-13 12 11 12-16 11 14 13-9 5 20-17-2-13 17-14-16-16 9Z" fill="#5ea8d0"/><path d="m35 72-15 10m25-4-8 11m43-10 9 9m1-16 16 7" stroke="#a7e7fc" stroke-width="6"/>`
    : `<path d="M35 73c-9-14-7-35 7-45l9-17 7 12 13-13 7 19c16 10 17 30 6 44l-10 14-39-1-12-5Z" fill="#b4c954" stroke="#4a6446" stroke-width="2"/><path d="m42 24 1-15 8 9m24 7 8-16 2 22" fill="none" stroke="#f7e3a0" stroke-width="4"/><path d="M46 68q17-10 31-1l-5 15H45Z" fill="#f8e2a4"/><path d="m31 62-13 8 16 3m50-14 16 9-16 4" fill="#dce579"/>`;
  const aura = morphed ? `<path d="m18 35 15 7-7-23 25 10 9-21 14 18 22-9-6 25 18 11-17 20 6 16-26-5-18 9-17-15-24 3 12-20-13-10Z" fill="none" stroke="${color}" stroke-width="3" opacity=".65"/>` : '';
  return `<svg class="slug-art ${morphed ? 'velocimorph-art' : 'protoform-art'}" data-form="${morphed ? 'velocimorph' : 'protoform'}" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="89" rx="32" ry="4" fill="#051b28" opacity=".4"/>${aura}${body}${eye}<path d="m57 65 11 3 7-4" fill="none" stroke="#416456" stroke-width="2"/></svg>`;
}

/** Returns true when this panel belongs to the expanded campaign. */
export function renderCampaignPanel({ kind, state, context = {}, container, actions, rerender, slugArt, morphed = false, setMorphed, notify }) {
  const hasCampaign = Array.isArray(state.ownedSlugs);
  const bind = (selector, callback) => container.querySelectorAll(selector).forEach(button => { button.onclick = () => callback(button); });
  const perform = (method, ...args) => {
    const finish = result => {
      if (!(method === 'useSkill' && result?.ok !== false)) rerender();
      if (result?.ok === false && result.message) notify?.(result.message, 'warning');
    };
    try {
      const result = actions[method]?.(...args);
      if (result && typeof result.then === 'function') result.then(finish, error => notify?.(error?.message || 'This action could not be completed.', 'warning'));
      else finish(result);
    } catch (error) { notify?.(error?.message || 'This action could not be completed.', 'warning'); }
  };
  if (kind === 'inventory' && hasCampaign) {
    const owned = ownedIds(state), equipped = equippedIds(state);
    container.innerHTML = `${title('THE COMPANION COLLECTION', 'Small allies. <em>Wild power.</em>')}<div class="campaign-panel-top"><p class="dialog-intro">Discover new slugs in the caverns. Bring three companions with you, then switch between them with 1, 2 and 3. A companion must return before you can change its slot.</p>${coins(state)}</div><div class="morph-tabs" role="group" aria-label="Companion form"><button data-form-toggle="protoform" class="${morphed ? '' : 'active'}" aria-pressed="${!morphed}">Protoform <small>YOUR COMPANION</small></button><span class="morph-tab-arrow">→ 100 mph →</span><button data-form-toggle="velocimorph" class="${morphed ? 'active' : ''}" aria-pressed="${morphed}">Velocimorph <small>THE BATTLE FORM</small></button></div><div class="collection-summary"><span>${owned.length} / ${Object.keys(SLUG_CATALOG).length} COMPANIONS DISCOVERED</span><span>THREE EQUIPPED SLOTS</span></div><div class="campaign-collection">${Object.values(SLUG_CATALOG).map((slug, index) => {
      const isOwned = owned.includes(slug.id), slot = equipped.indexOf(slug.id), runtime = (state.slugs || []).find(s => s.id === slug.id);
      const art = campaignSlugArt(slug, morphed, true) || slugArt(slug, index + 40, morphed);
      return `<article class="collection-card ${isOwned ? 'owned' : 'undiscovered'} ${slot >= 0 ? 'equipped' : ''}" style="--slug-color:${esc(slug.color)}"><div class="collection-art">${art}<span class="collection-status">${slot >= 0 ? `SLOT ${slot + 1}` : isOwned ? 'DISCOVERED' : 'TO DISCOVER'}</span></div><div class="collection-copy"><span class="card-index">${esc(slug.species)} · ${esc(slug.classification || slug.element)}</span><h3>${esc(slug.name)}</h3><span class="rarity-tag">${esc(slug.rarity)}</span><p>${esc(descriptions[slug.id] || slug.description)}</p><div class="collection-stats"><span><b>${Math.round(slug.damage * (morphed ? (slug.morphMultiplier || 1.6) : 1))}</b> ${morphed ? 'MORPH DAMAGE' : 'DAMAGE'}</span><span><b>${slug.cooldownMax}s</b> RECOVERY</span></div>${slot >= 0 ? `<button class="campaign-action" data-ready-slug="${slot}" aria-label="Select ${esc(slug.name)}" ${state.selectedSlug === slot ? 'disabled' : ''}>${state.selectedSlug === slot ? '✓ IN HAND' : `SELECT SLOT ${slot + 1}`}</button>` : ''}${isOwned ? `<div class="equip-slot-row" role="group" aria-label="Equip ${esc(slug.name)} to a slot" title="${slot >= 0 ? `Equipped in slot ${slot + 1}` : 'Choose an equipped slot'}">${[0, 1, 2].map(i => `<button data-equip-slug="${esc(slug.id)}" data-equip-slot="${i}" ${slot >= 0 || runtime?.inFlight || state.slugs?.[i]?.inFlight ? 'disabled' : ''} aria-label="Equip ${esc(slug.name)} in slot ${i + 1}">${slot === i ? '✓' : '→'} SLOT ${i + 1}</button>`).join('')}</div>${runtime?.inFlight ? '<small class="collection-note">Waiting for your companion to return.</small>' : ''}` : '<div class="discovery-hint">Explore cavern beacons and speak to expedition contacts.</div>'}<details class="reference-note"><summary>Species reference</summary><p>${esc(slug.raritySource || 'Legacy official arsenal')}. Rarity describes the reference classification; combat values belong to this expedition.</p><a href="${esc(slug.source || '#')}" target="_blank" rel="noopener noreferrer">View official species profile ↗</a></details></div></article>`;
    }).join('')}</div><p class="panel-footnote">Living companions return to your blaster after each shot. Your original three companions and the Haven expedition stay with you.</p>`;
    bind('[data-form-toggle]', button => { setMorphed(button.dataset.formToggle === 'velocimorph'); rerender(); });
    bind('[data-equip-slug]', button => perform('equipSlug', button.dataset.equipSlug, Number(button.dataset.equipSlot)));
    bind('[data-ready-slug]', button => perform('selectSlug', Number(button.dataset.readySlug)));
    return true;
  }
  if (kind === 'atlas' || (kind === 'map' && state.currentCavern && state.currentCavern !== 'luminous')) {
    const current = state.currentCavern || 'luminous', visited = state.visitedCaverns || ['luminous'];
    const cave = CAVERNS[current] || CAVERNS.luminous;
    container.innerHTML = `${title('CAVERN ATLAS / CONNECTED EXPEDITIONS', 'Follow the <em>light.</em>')}<p class="dialog-intro">Three connected caverns. Take the marked passage gates to travel, and activate beacons to set a safe return point. Your progress stays with you.</p><div class="atlas-current"><span>CURRENT CAVERN</span><strong>${esc(cave.name)}</strong>${coins(state)}</div><div class="cavern-atlas">${Object.values(CAVERNS).map((c, index) => `<article class="cavern-atlas-card ${c.id === current ? 'current' : ''}"><div class="atlas-image ${c.id === 'luminous' ? 'original-region-art' : ''}">${caveImages[c.id] ? `<img src="${caveImages[c.id]}" alt="Animated-series reference for ${esc(c.name)}"/>` : '<div class="haven-symbol">◈</div>'}<span>0${index + 1} / ${c.id === current ? 'YOU ARE HERE' : state.cavernProgress?.[c.id]?.completed ? 'SURVEY RECORDED' : visited.includes(c.id) ? 'VISITED' : 'UNEXPLORED'}</span></div><div class="atlas-card-copy"><span class="atlas-canon">${c.canonical ? 'SLUGTERRA CAVERN' : 'YOUR ORIGINAL EXPEDITION'}</span><h3>${esc(c.name)}</h3><p>${esc(caveCopy[c.id] || c.description)}</p><div class="atlas-route">${c.id === current ? '◈ Current expedition' : `↗ Find the ${esc(c.shortName || c.name)} passage gate`}</div>${c.reference ? `<a class="atlas-source" href="${esc(c.reference)}" target="_blank" rel="noopener noreferrer">Cavern reference ↗</a>` : ''}</div></article>`).join('')}</div><div class="atlas-connections"><span>HAVEN OUTPOST</span><i>↔</i><span>DARK SPORES</span><i>↔</i><span>PYRITE</span><i>↔</i><span>HAVEN</span></div><div class="guide-note"><p><strong>Explore at your own pace.</strong> Gate markers guide you between caverns. Amber lights mark contacts and supplies; cyan beacons mark discoveries and checkpoints. The heartshard expedition remains in the Luminous Deep.</p></div><p class="panel-footnote">Cavern and creature designs follow Slugterra references. Routes, surveys and encounters are this expedition’s own adventure.</p>`;
    return true;
  }
  if (kind === 'merchant') {
    const owned = state.ownedBlasters || ['standard'];
    container.innerHTML = `${title(`${esc(context.name || 'HAVEN OUTFITTER')} / BLASTER WORKSHOP`, 'Gear for the <em>journey.</em>')}<div class="campaign-panel-top"><p class="dialog-intro">“A blaster should fit the way you fight. Heavy power or quick recovery — choose what your companions need.”</p>${coins(state)}</div><div class="blaster-shop">${BLASTERS.map((blaster, index) => {
      const isOwned = owned.includes(blaster.id), equipped = state.equippedBlaster === blaster.id;
      return `<article class="blaster-card ${equipped ? 'equipped' : ''}"><div class="blaster-schematic variant-${index}" aria-hidden="true"><span class="schematic-barrel"></span><span class="schematic-body"></span><span class="schematic-chamber">◈</span><span class="schematic-grip"></span></div><div><span class="card-index">BLASTER 0${index + 1} / ${equipped ? 'EQUIPPED' : isOwned ? 'OWNED' : 'AVAILABLE'}</span><h3>${esc(blaster.name)}</h3><p>${esc(blaster.description)}</p><dl class="equipment-stats"><div><dt>SHOT POWER</dt><dd>${Math.round(blaster.damageMultiplier * 100)}%</dd></div><div><dt>RECOVERY TIME</dt><dd>${Math.round(blaster.cooldownMultiplier * 100)}%</dd></div></dl><button class="campaign-action" data-blaster="${esc(blaster.id)}" data-blaster-action="${isOwned ? 'equipBlaster' : 'buyBlaster'}" ${equipped || (!isOwned && (state.coins || 0) < blaster.price) ? 'disabled' : ''}>${equipped ? '✓ EQUIPPED' : isOwned ? 'EQUIP BLASTER' : `BUY · ${blaster.price} GOLD`}</button></div></article>`;
    }).join('')}</div><p class="panel-footnote">Buying a blaster never takes away an owned weapon. Change equipment here whenever you return.</p>`;
    bind('[data-blaster]', button => perform(button.dataset.blasterAction, button.dataset.blaster));
    return true;
  }
  if (kind === 'trainer' || kind === 'skills') {
    const learned = state.skills || [], atTrainer = kind === 'trainer';
    container.innerHTML = `${title(atTrainer ? 'TRAINING CIRCLE / THE WAY OF THE SLUG' : 'SLUGSLINGER DISCIPLINES', 'Fight as <em>one.</em>')}<div class="campaign-panel-top"><p class="dialog-intro">${atTrainer ? '“Slug Fu begins with trust. Focus on your companion, then guide it toward your aim. Power follows practice.”' : 'Your bond opens new possibilities. Visit the amber training circle at Haven to learn a discipline, then use it during your expedition.'}</p>${coins(state)}</div><div class="skill-tree">${SKILLS.map((skill, index) => {
      const isLearned = learned.includes(skill.id), unmet = (skill.prerequisites || []).filter(id => !learned.includes(id)), cooldown = Math.ceil(state.skillCooldowns?.[skill.id] || 0), canLearn = atTrainer && !isLearned && unmet.length === 0 && (state.coins || 0) >= skill.price;
      return `<article class="skill-card ${isLearned ? 'learned' : ''}"><div class="skill-sigil">${index === 0 ? '↝' : '✧'}<span>0${index + 1}</span></div><div><span class="card-index">${isLearned ? 'DISCIPLINE LEARNED' : 'TRAINING AVAILABLE'}</span><h3>${esc(skill.name)}</h3><p>${esc(skillCopy[skill.id] || skill.description)}</p><div class="skill-values"><span><b>${skill.duration}s</b> FOCUS</span><span><b>${skill.cooldown}s</b> RECOVERY</span>${index === 0 ? '<span><kbd>R</kbd> ACTIVATE</span>' : ''}</div>${unmet.length ? `<p class="skill-requirement">Requires ${esc(unmet.map(id => SKILLS.find(s => s.id === id)?.name || id).join(', '))}</p>` : ''}<button class="campaign-action" ${isLearned ? `data-use-skill="${esc(skill.id)}"` : `data-learn-skill="${esc(skill.id)}"`} ${isLearned ? cooldown > 0 ? 'disabled' : '' : canLearn ? '' : 'disabled'}>${isLearned ? cooldown ? `RECOVERING · ${cooldown}s` : 'ACTIVATE DISCIPLINE' : atTrainer ? `LEARN · ${skill.price} GOLD` : 'VISIT THE HAVEN TRAINER'}</button></div></article>`;
    }).join('')}</div><p class="panel-footnote">Guided Flight draws on Slug Fu. Resonant Focus is an expedition discipline. Keep your normal aim, movement and firing controls while using either skill.</p>`;
    bind('[data-learn-skill]', button => perform('learnSkill', button.dataset.learnSkill));
    bind('[data-use-skill]', button => perform('useSkill', button.dataset.useSkill));
    return true;
  }
  if (kind === 'expedition') {
    const cave = CAVERNS[state.currentCavern] || CAVERNS.luminous;
    container.innerHTML = `${title('EXPEDITION CONTACT', `${esc(context.name || 'The cavern')} <em>awaits.</em>`)}<div class="contact-dialog"><span class="contact-symbol">◈</span><div><span class="card-index">${esc(cave.name).toUpperCase()}</span><h3>Keep your companions close.</h3><p>${esc(context.description || context.dialogue || 'Passage gates connect Haven, Dark Spores and Pyrite. Activate the survey beacons, explore beyond the main paths, and watch for slugs that need a companion. Return to Kael whenever you need to rest or continue the heartshard expedition.')}</p><div class="contact-hints"><span>◈ Amber lights · contacts and supplies</span><span>◇ Cyan lights · checkpoints and discoveries</span><span>↗ Passage gates · travel between caverns</span></div></div></div><div class="dialog-button-row"><button class="button-primary" data-contact-close>Keep exploring →</button><button class="button-outline" data-contact-atlas>Open cavern atlas</button></div>`;
    bind('[data-contact-close]', () => actions.closePanel());
    bind('[data-contact-atlas]', () => actions.openPanel('atlas'));
    return true;
  }
  return false;
}
