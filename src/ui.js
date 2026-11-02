import { campaignSlugArt, renderCampaignPanel } from './campaign-ui.js';
import modelCredits from './assets/models/credits.json';
import { CAVERNS, SLUG_CATALOG } from './content.js';

const icons = {
  sound: '<path d="m4 9 4 0 5-4v14l-5-4H4z"/><path d="M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="m4 9 4 0 5-4v14l-5-4H4z"/><path d="m17 9 5 6m0-6-5 6"/>',
  gear: '<path d="m10 3 4 0 1 3 3 1 3 3-2 3 0 3-3 3-3-1-3 1-3-3 1-3-2-3 3-3z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 8-2 6-5 2 2-6z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  diamond: '<path d="m12 2 8 10-8 10-8-10z"/><path d="m12 6 4 6-4 6-4-6z"/>',
  book: '<path d="M3 5c5-2 7 0 9 1 2-1 4-3 9-1v14c-4-2-7-1-9 0-2-1-5-2-9 0zM12 6v13"/>',
  leaf: '<path d="M4 19C2 7 10 3 21 3c0 12-4 17-14 15m-3 3L17 7"/>',
  bolt: '<path d="m14 2-9 12h7l-2 8 10-13h-7z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/>',
  target: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.diamond}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Distinct silhouettes stay recognizable at loadout size. Protoforms are soft
// companions; Velocimorphs have the elongated, angular forms seen in flight.
const slugArt = (slug, id = 0, morphed = false) => {
  const campaignArt = campaignSlugArt(slug, morphed);
  if (campaignArt) return campaignArt;
  const element = slug.element || 'fire';
  const key = `slug-${element}-${id}-${morphed ? 'velocity' : 'proto'}`;
  const color = { fire: '#f58a36', electric: '#5aa9ed', water: '#60d9de' }[element] || '#f58a36';
  const outline = 'stroke="#12313c" stroke-width="2.1" stroke-linejoin="round"';
  const eyes = morphed
    ? '<path d="m81 45 15-4-8 10Z" fill="#fff5cb"/><path d="m89 43-1 6" stroke="#18333c" stroke-width="3"/><path d="m77 42 17-5" fill="none" stroke="#15313b" stroke-width="3.5"/>'
    : '<ellipse cx="48" cy="47" rx="10" ry="12" fill="#fffbe8"/><ellipse cx="72" cy="45" rx="10" ry="12" fill="#fffbe8"/><ellipse cx="51" cy="48" rx="5.5" ry="8" fill="#235d79"/><ellipse cx="74" cy="46" rx="5.5" ry="8" fill="#235d79"/><ellipse cx="52" cy="49" rx="2.8" ry="5.8" fill="#122b35"/><ellipse cx="75" cy="47" rx="2.8" ry="5.8" fill="#122b35"/><circle cx="49" cy="44" r="2.5" fill="#fff"/><circle cx="72" cy="42" r="2.5" fill="#fff"/>';
  let art = '';
  if (element === 'fire') {
    art = morphed
      ? `<path d="M19 61 3 47 21 44 8 29 40 39 32 13 55 32 62 8 75 32 97 22 89 38 111 39 101 56 84 70 52 76 14 76 31 65Z" fill="#dc4024" ${outline}/><path d="m17 52 31-6-4-18 20 16 8-19 10 16 14-6-8 17 15 1-23 17-33 3Z" fill="#ffc347"/><path d="M29 60 48 42 77 34 95 39 108 51 96 67 69 74 46 71Z" fill="url(#${key}-skin)" ${outline}/><path d="m47 64 22-7 32-4-10 14-24 9-27-6Z" fill="#ffe28b"/><path d="m32 67-18 15 29-4 14-9m6-25L52 18l26 17" fill="#ec5a27" ${outline}/>${eyes}<path d="m88 61 9-3" stroke="#7e3027" stroke-width="2"/>`
      : `<path d="M39 76C27 68 29 47 35 35L46 25 44 11 55 21 63 4 68 22 81 12 78 29C96 39 92 65 81 76L70 87 43 88 27 84Z" fill="url(#${key}-skin)" ${outline}/><path d="m44 29 2-17 10 13 7-18 4 19 13-12-6 20Z" fill="#e34f2c"/><path d="m51 25 11-10 1 14 8-4-3 12-12-1Z" fill="#ffd75b"/><path d="M47 65c8-9 21-8 29-2l-4 20c-7 7-23 5-27-2Z" fill="#ffe19a"/><path d="m37 66-12 9 17-1m37-9 12 8-16 2" fill="#f29a45" ${outline}/>${eyes}<path d="M52 66q12 8 21-3" fill="none" stroke="#8d3f2b" stroke-width="2.2" stroke-linecap="round"/><path d="m43 33 12 3m12-3 14-4" stroke="#aa4126" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (element === 'electric') {
    art = morphed
      ? `<path d="m32 52-21-9 21-4-9-17 28 13 5-25 14 25 15-23 2 24 23-7-12 18 14 5-17 13-24 11-41-3-21 8 10-20Z" fill="#f5d656" ${outline}/><path d="m27 57 23-16 28-7 22 4 10 14-18 15-29 9-32-4-16 7 10-17Z" fill="url(#${key}-skin)" ${outline}/><path d="m26 54 23 2-10 12 27-5-5 13 23-11 16-12-25 7 9-11-27 7 5-12Z" fill="#f8dc5b"/><path d="m56 39-10-15 20 10-5-17 21 20" fill="#335fa9" ${outline}/>${eyes}<path d="m87 61 9-3" stroke="#173851" stroke-width="2"/>`
      : `<path d="m40 32-9-15 8-1-2-13 16 18-8 2 5 10m17-4 11-18 5 8 9-11-3 25-8-4-5 8" fill="#f9da5d" ${outline}/><path d="M35 39c8-15 36-18 48-6 11 11 10 30-2 43l-7 9c-11 7-37 5-45-1l11-8c-11-7-14-23-5-37Z" fill="url(#${key}-skin)" ${outline}/><path d="M45 66c7-8 21-9 30-3l1 21c-7 6-25 5-31 0Z" fill="#cadf83"/><path d="m34 52-8 8 12-2-5 10 13-13m34-6 12 7-11 2 5 10-14-12" fill="#f8d45d" ${outline}/><path d="m47 29 9 8 6-11 5 10 8-9" fill="none" stroke="#294d91" stroke-width="4"/>${eyes}<path d="m53 65 10 4 9-6" fill="none" stroke="#24516f" stroke-width="2.2" stroke-linecap="round"/>`;
  } else {
    art = morphed
      ? `<path d="M38 42 16 13 55 29 65 9 79 31 101 20 92 43 107 53 89 66 80 83 60 71 17 88 31 64 8 58Z" fill="#8063bd" ${outline}/><path d="m31 47 29-11 29 1 14 12-10 15-30 10-35-6-18 8 12-19Z" fill="url(#${key}-skin)" ${outline}/><path d="m83 51 27 1-17 14-18-4Z" fill="#efd997" ${outline}/><path d="m37 52-7-25 24 18 12-14 4 15m-34 17-14 16 30-10" fill="#9b7bd2" stroke="#3c4188" stroke-width="2"/>${eyes}<path d="m42 62 13 4 16-7" fill="none" stroke="#e0f1c6" stroke-width="3"/>`
      : `<path d="M40 37 27 24l21 5L55 9l10 21 17-15-4 26m-3 28 22 9-22 6-10 8" fill="#9271c3" ${outline}/><path d="M36 39c12-14 37-16 48-1 10 15 2 33-9 41l-5 7c-14 4-30 3-42-2l13-8c-15-10-15-25-5-37Z" fill="url(#${key}-skin)" ${outline}/><path d="M44 64c5-7 20-8 28-2l1 21c-9 5-21 6-30 1Z" fill="#b1efdf"/><path d="m36 58-15 10 19 2m37-17 19 7-16 8" fill="#a18bd9" ${outline}/><path d="m47 30 8 8 9-8 9 6" fill="none" stroke="#427bba" stroke-width="4"/>${eyes}<path d="M51 60q13-7 25-3l-12 13Z" fill="#ead394" stroke="#536683" stroke-width="1.7"/><path d="m58 62 11-1" stroke="#f9efc6" stroke-width="1.5"/>`;
  }
  return `<svg class="slug-art ${morphed ? 'velocimorph-art' : 'protoform-art'}" data-element="${esc(element)}" data-form="${morphed ? 'velocimorph' : 'protoform'}" viewBox="0 0 120 100" aria-hidden="true"><defs><radialGradient id="${key}-glow"><stop stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><linearGradient id="${key}-skin" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="${element === 'fire' ? '#d46a2f' : element === 'electric' ? '#3365a7' : '#3f94b4'}"/></linearGradient></defs><ellipse cx="60" cy="59" rx="58" ry="40" fill="url(#${key}-glow)"/><ellipse cx="60" cy="89" rx="29" ry="4" fill="#001b27" opacity=".45"/>${art}</svg>`;
};

export function createUI(actions) {
  const app = document.querySelector('#app');
  let currentState = {}, currentDialog = null, currentMode = 'menu', dialogFocus = null, inventoryMorphed = false, currentContext = {}, lastPanelSignature = '';
  app.innerHTML = `
    <div class="cinematic-shade"></div>
    <header class="topbar">
      <button class="brand" data-panel="help" aria-label="Slugterra game guide"><span class="brand-symbol">${icon('diamond')}</span><span><strong>SLUGTERRA</strong><small>THE LUMINOUS DEEP</small></span></button>
      <nav class="main-nav" aria-label="Game navigation"><button class="nav-link active" data-explore>Explore <span>01</span></button><button class="nav-link" data-panel="inventory">Slug arsenal <span>02</span></button><button class="nav-link" data-panel="journal">Field journal <span>03</span></button><button class="nav-link" data-panel="atlas">Cavern atlas <span>04</span></button></nav>
      <div class="header-tools"><span class="live-label"><i></i> EXPEDITIONS</span><button class="icon-button" id="minimap-toggle" aria-label="Hide minimap" aria-pressed="true" title="Show or hide minimap">${icon('compass')}</button><button class="icon-button mobile-atlas-button" data-panel="atlas" aria-label="Cavern atlas">${icon('compass')}</button><button class="icon-button" id="view-toggle" aria-label="Switch to third-person view (P)" title="Switch view (P)">P</button><button class="icon-button" id="sound-toggle" aria-label="Toggle sound">${icon('sound')}</button><button class="icon-button" data-panel="settings" aria-label="Settings">${icon('gear')}</button></div>
    </header>
    <main class="menu-content" id="menu-content">
      <div class="expedition-label"><span class="tiny-cross">◈</span> THE SLUGSLINGER'S FRONTIER <span class="label-line"></span></div>
      <p class="eyebrow">DISCOVER THE WORLD BELOW</p>
      <h1>Go below.<br><em>Go beyond.</em></h1>
      <p class="hero-description">A hidden world. A blaster full of friends.<br>Explore the caverns, master your companions,<br>and find your own way through Slugterra.</p><div class="expedition-stats"><div><strong>${Object.keys(CAVERNS).length.toString().padStart(2, '0')}</strong><span>CONNECTED CAVERNS</span></div><div><strong>${Object.keys(SLUG_CATALOG).length.toString().padStart(2, '0')}</strong><span>COMPANION SPECIES</span></div><div><strong>100<small>mph</small></strong><span>UNLEASH THEIR POWER</span></div></div>
      <div class="hero-actions"><button id="begin-button" class="button-primary"><span>Begin expedition</span>${icon('arrow')}</button><button class="button-text" data-panel="help"><span class="play-circle">▷</span> How to play</button></div>
      <button id="continue-button" class="continue-button" hidden>Continue your journey ${icon('arrow')}</button>
      <div class="hero-meta"><span><i class="status-dot"></i> YOUR ADVENTURE STARTS HERE</span><span>ONE WORLD. YOUR STORY.</span></div>
    </main>
    <aside class="location-card menu-only"><div class="coordinates">36° N <span>/</span> 182° BELOW</div><div class="location-divider"></div><span class="eyebrow" id="menu-region-number">REGION 01</span><h2 id="menu-cavern-name">The Luminous Deep</h2><p id="menu-cavern-description">A forgotten cavern. An ancient pulse.</p><div class="location-tags"><span>BIOLUMINESCENT WILDS</span><span>∞ POSSIBILITIES</span></div><button class="location-map" data-panel="atlas">${icon('compass')} Discover the region <span>↗</span></button></aside>
    <div class="world-marker menu-only"><i></i><span>THE HEART OF THE CAVERN<small>Unknown energy signature</small></span></div>
    <footer class="menu-footer menu-only"><div class="feature"><span class="feature-number">01</span>${icon('compass')}<div><strong>A living underworld</strong><span>Go where the glow takes you.</span></div></div><div class="feature"><span class="feature-number">02</span>${icon('bolt')}<div><strong>Small allies. Wild power.</strong><span>New caverns. New companions.</span></div></div><div class="feature"><span class="feature-number">03</span>${icon('book')}<div><strong>Your story, below</strong><span>Answer the call of the deep.</span></div></div><div class="footer-edition">AN EXPLORABLE 3D ADVENTURE <span>CONNECTED CAVERNS / WEB EDITION</span></div></footer>
    <div class="game-hud" id="game-hud"><section class="campaign-status" aria-label="Expedition status"><button data-panel="atlas" class="cavern-status-button"><span>EXPLORING</span><strong id="current-cavern-name">The Luminous Deep</strong></button><div class="campaign-status-meta"><span id="campaign-coins">◈ 100 GOLD</span><span id="campaign-checkpoint">HAVEN CHECKPOINT</span></div></section><div class="discipline-controls"><button id="slug-fu-button" data-skill="slug-fu" aria-label="Activate Guided Flight"><kbd>R</kbd><span>SLUG FU<small id="slug-fu-status">Find the Haven trainer</small></span></button><button class="skill-menu-button" data-panel="skills" aria-label="Open disciplines">✧</button></div>
      <div class="compass-bar"><span>W</span><i></i><span>NW</span><i></i><b id="heading">N</b><i></i><span>NE</span><i></i><span>E</span></div>
      <section class="vitals"><div class="player-name"><span class="player-emblem">${icon('shield')}</span><div><span>SLUGSLINGER</span><strong>THE NEW GUARDIAN</strong></div><b class="level-number" id="level-label">01</b></div><div class="vital-label"><span>VITALITY</span><strong id="health-number">100 / 100</strong></div><div class="meter health-meter"><i id="health-fill"></i></div><div class="shield-row">${icon('shield')}<div class="meter shield-meter"><i id="shield-fill"></i></div><span id="shield-number">50</span></div><div class="xp-row"><span id="xp-label">0 XP</span><div class="meter xp-meter"><i id="xp-fill"></i></div></div></section>
      <section class="quest-tracker"><div class="quest-kicker">${icon('diamond')} ACTIVE EXPEDITION <button data-panel="journal" aria-label="Open quest journal">J</button></div><h3 id="quest-title">The call of the deep</h3><p id="quest-description">Find the guardian at the waystation.</p><div class="quest-progress"><span id="quest-progress-text">EXPLORE THE CAVERN</span><i><b id="quest-fill"></b></i></div></section>
      <div class="reticle" id="reticle"><i></i><i></i><i></i><i></i><b></b></div><div id="hit-marker" class="hit-marker">╳</div><div id="flight-status" class="flight-status"><span class="flight-phase">PROTOFORM</span><strong class="flight-name">BURPY READY</strong><span class="flight-speed">100 mph (44.7 m/s) TO VELOCIMORPH</span><i><b></b></i></div>
      <div id="interact-prompt" class="interact-prompt" hidden><kbd>E</kbd><span></span></div>
      <div id="click-to-look" class="click-to-look">Hold right mouse and drag to look · left click to fire <span>C toggles focus · ESC releases cursor</span></div>
      <div class="loadout-wrap"><div id="energy-boost" class="energy-boost" hidden></div><div class="loadout-label"><span>YOUR COMPANIONS</span><span>1 — 3 TO SWITCH</span></div><div id="loadout" class="loadout"></div><div class="combat-hint"><span>LEFT CLICK <b>Fire slug</b></span><i></i><span>RMB / C <b>Focus</b></span><i></i><span>SHIFT <b>Sprint</b></span></div></div>
      <aside class="minimap-wrap"><div class="minimap-title"><span id="minimap-cavern-name">THE LUMINOUS DEEP</span><button data-panel="map" aria-label="Open region map">M</button></div><div class="minimap-frame"><canvas id="minimap" width="160" height="160" aria-label="Region minimap"></canvas><span class="map-north">N</span></div><span class="minimap-caption">${icon('diamond')} <b id="shard-count">0 / 3</b> <span id="minimap-objective-name">HEARTSHARDS</span></span></aside>
      <div class="touch-controls"><div class="touch-movement"><button data-touch="w" aria-label="Move forward">↑</button><div><button data-touch="a" aria-label="Move left">←</button><button data-touch="s" aria-label="Move backward">↓</button><button data-touch="d" aria-label="Move right">→</button></div></div><div><button data-touch="e" aria-label="Interact">E</button><button id="touch-fire" aria-label="Fire slug">${icon('target')}</button></div></div>
    </div>
    <div id="toasts" class="toasts" aria-live="polite"></div>
    <div id="damage-flash" class="damage-flash"></div>
    <div id="dialog-backdrop" class="dialog-backdrop" hidden><section id="game-dialog" class="game-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><button class="dialog-close icon-button" id="dialog-close" aria-label="Close dialog">${icon('close')}</button><div id="dialog-content"></div></section></div>
    <div class="loading-status" id="loading-status"><i class="status-dot"></i> ESTABLISHING CONNECTION TO THE DEEP</div>
  `;
  const $ = selector => app.querySelector(selector);
  const panelButtons = () => app.querySelectorAll('[data-panel]').forEach(button => { button.onclick = () => actions.openPanel(button.dataset.panel); });
  panelButtons();
  $('[data-explore]').onclick = () => { if (currentMode === 'menu') actions.start(); else actions.resume(); };
  $('#begin-button').onclick = () => currentState.hasSave ? actions.openPanel('restart') : actions.start();
  $('#continue-button').onclick = () => actions.start();
  $('#sound-toggle').onclick = () => actions.toggleSound();
  $('#view-toggle').onclick = () => actions.toggleView?.();
  $('#minimap-toggle').onclick = () => {
    const collapsed = app.classList.toggle('minimap-collapsed');
    $('#minimap-toggle').setAttribute('aria-label', collapsed ? 'Show minimap' : 'Hide minimap');
    $('#minimap-toggle').setAttribute('aria-pressed', String(!collapsed));
  };
  $('#dialog-close').onclick = () => actions.closePanel();
  $('#dialog-backdrop').onclick = event => { if (event.target === $('#dialog-backdrop')) actions.closePanel(); };
  $('#touch-fire').onclick = () => actions.fire?.();
  $('#slug-fu-button').onclick = () => actions.useSkill?.('slug-fu');
  app.querySelectorAll('[data-touch]').forEach(button => {
    button.onpointerdown = event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (button.dataset.touch === 'e') actions.interact?.(); else actions.touch?.(button.dataset.touch, true); };
    button.onpointerup = button.onpointercancel = () => actions.touch?.(button.dataset.touch, false);
  });
  document.addEventListener('keydown', event => {
    if (currentDialog && event.key === 'Tab') {
      const focusable = [...$('#game-dialog').querySelectorAll('button,input,select,[tabindex="0"]')].filter(item => !item.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
      if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
    }
  });
  let lastLoadout = '', previousHealth = 100;
  function update(state) {
    currentState = state;
    $('#view-toggle').setAttribute('aria-label', `Switch to ${state.viewMode === 'third-person' ? 'first' : 'third'}-person view (P)`);
    const health = state.health ?? 100, maxHealth = state.maxHealth ?? 100;
    $('#health-number').textContent = `${Math.ceil(health)} / ${maxHealth}`;
    $('#health-fill').style.width = `${Math.max(0, health / maxHealth * 100)}%`;
    $('#shield-fill').style.width = `${Math.max(0, (state.shield ?? 0) / (state.maxShield || 50) * 100)}%`;
    $('#shield-number').textContent = Math.ceil(state.shield ?? 0);
    $('#xp-label').textContent = `${state.xp ?? 0} / ${state.xpToNext ?? 100} XP`;
    $('#xp-fill').style.width = `${Math.min(100, (state.xp ?? 0) / (state.xpToNext || 100) * 100)}%`;
    const heading = Number(state.heading);
    if (Number.isFinite(heading)) $('#heading').textContent = ['N','NE','E','SE','S','SW','W','NW'][Math.round(((heading % 360 + 360) % 360) / 45) % 8];
    $('#level-label').textContent = String(state.level ?? 1).padStart(2, '0');
    const cave = CAVERNS[state.currentCavern || 'luminous'] || CAVERNS.luminous;
    $('#current-cavern-name').textContent = cave.name;
    $('#menu-cavern-name').textContent = cave.name;
    $('#menu-cavern-description').textContent = cave.subtitle || cave.description;
    $('#menu-region-number').textContent = `REGION ${String(Object.keys(CAVERNS).indexOf(cave.id) + 1).padStart(2, '0')}`;
    $('#minimap-cavern-name').textContent = (cave.shortName || cave.name).toUpperCase();
    $('#campaign-coins').textContent = `◈ ${Math.floor(state.coins || 0)} GOLD`;
    const checkpoint = state.checkpoint?.cavernId || 'luminous';
    $('#campaign-checkpoint').textContent = `CHECKPOINT · ${(CAVERNS[checkpoint]?.shortName || 'Haven').toUpperCase()}`;
    const learnedFu = state.skills?.includes('slug-fu');
    const fuCooldown = Math.ceil(state.skillCooldowns?.['slug-fu'] || 0);
    const fuActive = (state.activeSkills?.['slug-fu'] || 0) > 0;
    $('#slug-fu-button').disabled = !learnedFu || fuCooldown > 0;
    $('#slug-fu-button').classList.toggle('discipline-active', fuActive);
    $('#slug-fu-status').textContent = !learnedFu ? 'Find the Haven trainer' : fuActive ? 'GUIDING YOUR COMPANION' : fuCooldown ? `Recovering · ${fuCooldown}s` : 'GUIDED FLIGHT READY';
    const quest = state.quest ?? {};
    const awayFromHaven = state.currentCavern && state.currentCavern !== 'luminous';
    $('#quest-title').textContent = awayFromHaven ? `${cave.shortName || cave.name} expedition` : quest.title ?? 'The call of the deep';
    const cavernProgress = state.cavernProgress?.[state.currentCavern] || {};
    $('#quest-description').textContent = awayFromHaven ? cavernProgress.completed ? 'Survey recorded. Seek new companions beyond the paths, or follow a passage gate back to Haven.' : 'Clear hostiles around the survey beacon, record your expedition, and seek new companions.' : quest.description ?? 'Explore the cavern.';
    $('#quest-progress-text').textContent = awayFromHaven ? cavernProgress.completed ? 'SURVEY RECORDED' : 'FIND THE SURVEY BEACON' : quest.total ? `${quest.progress ?? 0} / ${quest.total} ${quest.stage === 'shards' ? 'HEARTSHARDS' : 'COMPLETE'}` : 'FOLLOW THE BEACON';
    $('#quest-fill').style.width = `${awayFromHaven ? cavernProgress.completed ? 100 : 10 : quest.total ? Math.min(100, (quest.progress ?? 0) / quest.total * 100) : 8}%`;
    $('#shard-count').textContent = awayFromHaven ? cavernProgress.completed ? '✓' : '◇' : `${state.shards ?? 0} / 3`;
    $('#minimap-objective-name').textContent = awayFromHaven ? cavernProgress.completed ? 'SURVEY RECORDED' : 'SURVEY BEACON' : 'HEARTSHARDS';
    $('#continue-button').hidden = !state.hasSave;
    const boost = Math.ceil(state.energyBoost || 0);
    $('#energy-boost').hidden = boost <= 0;
    if (boost > 0) $('#energy-boost').textContent = `FANDANGO CHARGE · NEXT COMPANION +25% · ${boost}s`;
    const flight = state.flight;
    const selected = state.slugs?.[state.selectedSlug ?? 0];
    const flightActive = Boolean(flight && flight.phase !== 'ready');
    const returning = flight?.phase === 'returning';
    const morphed = Boolean(flightActive && !returning && (flight?.morphed || String(flight?.phase || '').toLowerCase().includes('veloci')));
    const flightStatus = $('#flight-status');
    flightStatus.classList.toggle('morphed', morphed);
    flightStatus.classList.toggle('returning', returning);
    flightStatus.classList.toggle('in-flight', flightActive);
    flightStatus.setAttribute('aria-hidden', String(!flightActive));
    flightStatus.querySelector('.flight-phase').textContent = returning ? 'RETURNING' : morphed ? 'VELOCIMORPH' : 'PROTOFORM';
    flightStatus.querySelector('.flight-name').textContent = String(flightActive ? flight?.slug?.name || flight?.slug || selected?.name || 'BURPY' : selected?.name || 'BURPY') + (returning ? ' TO BLASTER' : flightActive ? ' IN FLIGHT' : ' READY');
    const speed = Number(flight?.speed) || 0;
    flightStatus.querySelector('.flight-speed').textContent = returning ? 'RECALLING YOUR COMPANION' : flightActive ? `${Math.round(speed * 2.23694)} mph · ${speed.toFixed(1)} m/s${morphed ? ' · 1.6× DAMAGE' : ''}` : '100 mph / 44.7 m/s TO MORPH';
    flightStatus.querySelector('i b').style.width = `${Math.min(100, speed / (selected?.morphSpeed || 44.7) * 100)}%`;
    $('#sound-toggle').innerHTML = icon(state.settings?.sound === false ? 'mute' : 'sound');
    $('#sound-toggle').setAttribute('aria-label', state.settings?.sound === false ? 'Enable sound' : 'Mute sound');
    if (health < previousHealth) { $('#damage-flash').classList.remove('flash'); void $('#damage-flash').offsetWidth; $('#damage-flash').classList.add('flash'); }
    previousHealth = health;
    const loadoutSignature = JSON.stringify((state.slugs ?? []).map((s, i) => [s.name, s.unlocked, s.inFlight, Math.ceil(s.cooldown ?? 0), i === state.selectedSlug]));
    if (loadoutSignature !== lastLoadout) {
      lastLoadout = loadoutSignature;
      $('#loadout').innerHTML = (state.slugs ?? []).map((slug, index) => `<button class="slug-slot ${index === state.selectedSlug ? 'selected' : ''} ${slug.unlocked === false ? 'locked' : ''}" style="--slug-color:${esc(slug.color || '#83efdc')}" data-slug="${index}" ${slug.unlocked === false ? 'disabled' : ''} aria-label="Select ${esc(slug.name)}"><kbd>${index + 1}</kbd>${slugArt(slug, index)}<span class="slug-info"><strong>${esc(slug.name)}</strong><small>${esc(slug.element || 'COMPANION')}</small></span>${slug.unlocked === false ? '<span class="cooldown">LOCKED</span>' : (slug.inFlight ? '<span class="cooldown in-flight-label">IN FLIGHT</span>' : slug.cooldown > 0 ? `<span class="cooldown">${Math.ceil(slug.cooldown)}s</span>` : '<span class="ready-dot"></span>')}</button>`).join('');
      app.querySelectorAll('[data-slug]').forEach(button => { button.onclick = () => actions.selectSlug(Number(button.dataset.slug)); });
    }
    $('#loading-status').classList.add('loaded');
    if (currentDialog && ['inventory', 'atlas', 'merchant', 'trainer', 'skills', 'expedition', 'map'].includes(currentDialog)) {
      const signature = JSON.stringify([state.currentCavern, state.coins, state.ownedSlugs, state.equippedSlugs, state.ownedBlasters, state.equippedBlaster, state.skills, Math.ceil(state.skillCooldowns?.['slug-fu'] || 0), Math.ceil(state.skillCooldowns?.mastery || 0)]);
      if (signature !== lastPanelSignature) showDialog(currentDialog, state, currentContext, true);
      lastPanelSignature = signature;
    }
  }
  function setMode(mode) {
    currentMode = mode;
    document.body.dataset.mode = mode;
    $('#view-toggle').disabled = mode !== 'playing';
  }
  function toast(message, type = 'info') {
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.innerHTML = `${icon(type === 'quest' ? 'diamond' : type === 'warning' ? 'shield' : 'leaf')}<span>${esc(message)}</span>`;
    $('#toasts').append(element);
    setTimeout(() => { element.classList.add('leaving'); setTimeout(() => element.remove(), 400); }, 4200);
  }
  function closeDialog() {
    currentDialog = null; currentContext = {}; lastPanelSignature = '';
    $('#dialog-backdrop').hidden = true;
    dialogFocus?.focus?.();
  }
  function showDialog(kind, state = currentState, context = {}, refresh = false) {
    currentDialog = kind; currentContext = context || {};
    if (!refresh) dialogFocus = document.activeElement;
    const slugs = state.slugs || [];
    const panelTitle = title => `<p class="eyebrow">SLUGTERRA / FIELD SYSTEMS</p><h2 id="dialog-title">${title}</h2>`;
    const help = `<div class="controls-grid"><div><kbd>W A S D</kbd><span>Move through the cavern</span></div><div><kbd>MOUSE</kbd><span>Look freely with cursor capture; otherwise hold right mouse and drag</span></div><div><kbd>LEFT / F</kbd><span>Fire your slug, including while holding right mouse to focus</span></div><div><kbd>RMB / C</kbd><span>Hold right mouse to focus; C toggles focus for trackpads</span></div><div><kbd>SHIFT</kbd><span>Sprint</span></div><div><kbd>SPACE</kbd><span>Jump</span></div><div><kbd>P</kbd><span>Switch first-person / third-person view</span></div><div><kbd>E</kbd><span>Talk, gather, and activate</span></div><div><kbd>1 · 2 · 3</kbd><span>Switch elemental companions</span></div><div><kbd>Q</kbd><span>Scan for nearby life and landmarks</span></div><div><kbd>R</kbd><span>Activate Guided Flight after training Slug Fu</span></div><div><kbd>J / M / I</kbd><span>Journal / map / slug arsenal</span></div><div><kbd>ESC</kbd><span>Pause · release cursor</span></div></div>`;
    const campaignPanel = renderCampaignPanel({ kind, state, context: currentContext, container: $('#dialog-content'), actions, rerender: () => showDialog(kind, currentState, currentContext, true), slugArt, morphed: inventoryMorphed, setMorphed: value => { inventoryMorphed = value; }, notify: toast });
    if (campaignPanel) {
      // Shared dialog focus and close controls remain the same for every panel.
    } else if (kind === 'inventory') {
      $('#dialog-content').innerHTML = `${panelTitle('Small allies. <em>Wild power.</em>')}<p class="dialog-intro">Meet your Slugterra companions in both forms. Launch them as protoforms; at 100 mph (44.7 m/s) they transform into their powerful Velocimorph battle forms.</p><div class="morph-tabs" role="group" aria-label="Companion form"><button data-form-toggle="protoform" class="${inventoryMorphed ? '' : 'active'}" aria-pressed="${!inventoryMorphed}">Protoform <small>YOUR COMPANION</small></button><span class="morph-tab-arrow">→ 100 mph →</span><button data-form-toggle="velocimorph" class="${inventoryMorphed ? 'active' : ''}" aria-pressed="${inventoryMorphed}">Velocimorph <small>THE BATTLE FORM</small></button></div><div class="arsenal-grid ${inventoryMorphed ? 'show-velocimorph' : 'show-protoform'}">${slugs.map((slug, index) => `<button class="arsenal-card ${index === state.selectedSlug ? 'selected' : ''}" style="--slug-color:${esc(slug.color || '#83efdc')}" data-select="${index}" ${slug.unlocked === false ? 'disabled' : ''}><span class="card-index">${esc(slug.species || slug.element).toUpperCase()} / 0${index + 1}</span>${slugArt(slug, index + 10, inventoryMorphed)}<span class="element-tag">${esc(slug.element)} · ${inventoryMorphed ? 'VELOCIMORPH' : 'PROTOFORM'}</span><h3>${esc(slug.name)}</h3><p>${esc(slug.description)}</p><span class="slug-combat-stats"><span>${Math.round(slug.damage * (inventoryMorphed ? (slug.morphMultiplier || 1.6) : 1))} <small>DAMAGE</small></span><span>${inventoryMorphed ? `${slug.morphMultiplier || 1.6}×` : Math.round((slug.morphSpeed || 44.7) * 2.23694)} <small>${inventoryMorphed ? 'POWER' : 'mph MORPH'}</small></span></span><span class="card-action">${slug.unlocked === false ? 'CONTINUE YOUR QUEST TO UNLOCK' : index === state.selectedSlug ? 'EQUIPPED' : `EQUIP COMPANION ${icon('arrow')}`}</span></button>`).join('')}</div><p class="panel-footnote">A visible transformation happens in flight once a slug accelerates past 100 mph (44.7 m/s). Velocimorph hits deal 1.6× damage. Your slugs return after every shot.</p>`;
      app.querySelectorAll('[data-form-toggle]').forEach(button => { button.onclick = () => { inventoryMorphed = button.dataset.formToggle === 'velocimorph'; showDialog(kind, currentState); }; });
      app.querySelectorAll('[data-select]').forEach(button => { button.onclick = () => { actions.selectSlug(Number(button.dataset.select)); showDialog(kind, currentState); }; });
    } else if (kind === 'journal') {
      const stages = ['Meet Ranger Kael at Haven Outpost', 'Recover three ancient heartshards', 'Defeat the corrupted Hollow Warden', 'Return the light to Haven Outpost'];
      const q = state.quest || {};
      const step = q.stage === 'intro' ? 0 : q.stage === 'shards' ? 1 : q.stage === 'boss' ? 2 : q.stage === 'return' ? 3 : state.won ? 4 : Math.max(0, Number(q.stage) || 0);
      $('#dialog-content').innerHTML = `${panelTitle('Your story, <em>below.</em>')}<div class="journal-layout"><div class="journal-story"><span class="chapter-number">CHAPTER 01 / THE LUMINOUS DEEP</span><h3>${esc(q.title || 'The call of the deep')}</h3><p>${esc(q.description || 'A strange corruption is draining the light from these caverns. Ranger Kael at Haven Outpost may know how to stop it.')}</p><blockquote>“The deep remembers every footstep. Make yours worth remembering.”<span>— RANGER KAEL, HAVEN OUTPOST</span></blockquote><div class="journal-stats"><div><strong>${state.shards || 0}<small> / 3</small></strong><span>HEARTSHARDS</span></div><div><strong>${state.kills || 0}</strong><span>HOSTILES DEFEATED</span></div><div><strong>${state.level || 1}</strong><span>GUARDIAN LEVEL</span></div></div></div><ol class="quest-timeline">${stages.map((title, index) => `<li class="${index < step ? 'complete' : index === step ? 'current' : ''}"><span>${index < step ? '✓' : `0${index + 1}`}</span><div><small>${index < step ? 'COMPLETED' : index === step ? 'CURRENT OBJECTIVE' : 'UNDISCOVERED'}</small><h4>${title}</h4></div></li>`).join('')}</ol></div>`;
    } else if (kind === 'map') {
      $('#dialog-content').innerHTML = `${panelTitle('The Luminous <em>Deep.</em>')}<p class="dialog-intro">Follow the light. Seek the three heartshards, then face the darkness gathering in the north.</p><div class="region-map"><svg viewBox="0 0 600 350" role="img" aria-label="Cavern map: waystation south, three heartshard sites center and west and east, sentinel in the north"><defs><pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#8ce8d7" stroke-opacity=".07"/></pattern></defs><rect width="600" height="350" fill="url(#mapGrid)"/><path d="M90 310C20 230 100 80 190 40S430 10 505 110 540 280 440 315 170 345 90 310" fill="#21443f" fill-opacity=".35" stroke="#729b83" stroke-opacity=".4"/><path d="M280 315C235 250 340 200 290 155S300 85 355 30" fill="none" stroke="#58bdc2" stroke-opacity=".3" stroke-width="13"/><path d="m300 290-110-100 230-45-190-70 70-40" fill="none" stroke="#9aedcf" stroke-opacity=".5" stroke-dasharray="4 7"/><g fill="#b4ffe4" font-family="Arial" font-size="11"><circle cx="300" cy="290" r="7" fill="#ffbd76"/><text x="318" y="294">HAVEN OUTPOST</text><path d="m190 180 7 10-7 10-7-10z"/><text x="75" y="173">LUMINOUS GROVE</text><path d="m420 135 7 10-7 10-7-10z"/><text x="433" y="132">VIOLET FALLS</text><path d="m230 65 7 10-7 10-7-10z"/><text x="95" y="65">ANCIENT ROOTS</text><circle cx="300" cy="35" r="9" fill="none" stroke="#ff9eaa"/><text x="320" y="39" fill="#ff9eaa">THE HEARTSTONE</text><text x="557" y="34">N</text><path d="m560 44-5 13h10z"/></g></svg></div><div class="map-legend"><span><i style="background:#ffbd76"></i> HAVEN OUTPOST</span><span><i style="background:#b4ffe4"></i> HEARTSHARD</span><span><i style="background:#ff9eaa"></i> HOLLOW WARDEN</span></div>`;
    } else if (kind === 'settings') {
      const loadedClips = new Set(state.audio?.clips || []);
      const bundledClips = new Set(state.audio?.bundledClips || []);
      const readyBundledClips = new Set(state.audio?.readyBundledClips || []);
      const failedBundledClips = new Set(state.audio?.failedBundledClips || []);
      const audioSlots = [
        ['blaster', 'Blaster launch'], ['reload', 'Blaster reload'],
        ['morph-fire', 'Infurnus transformation'], ['morph-electric', 'Tazerling transformation'], ['morph-water', 'AquaBeek transformation'],
        ['impact-fire', 'Fire impact'], ['impact-electric', 'Electric impact'], ['impact-water', 'Water impact'],
      ];
      const recordingSlots = new Set([...bundledClips, ...loadedClips].filter(id => audioSlots.some(([slot]) => slot === id)));
      const audioDescription = bundledClips.size
        ? 'The supplied launch and transformation recording starts with your shot. Imported launch and transformation clips replace their matching events. Other effects use original synthesis. Imported files stay on this device.'
        : 'Assign your own sound clips to the matching effects below. Original synthesized effects play until you import a replacement. Imported files stay on this device.';
      const clipLabel = slot => loadedClips.has(slot) ? 'Imported clip' : failedBundledClips.has(slot) ? 'Original effect · recording unavailable' : bundledClips.has(slot) ? 'Included recording' : 'Original effect';
      $('#dialog-content').innerHTML = `${panelTitle('Make it <em>your world.</em>')}<p class="dialog-intro">Tune your expedition. Settings are saved on this device.</p><div class="settings-section-title">EXPEDITION PREFERENCES</div><div class="settings-list"><label><span><strong>World audio</strong><small>Ambient atmosphere and combat sounds</small></span><input id="setting-sound" type="checkbox" ${state.settings?.sound !== false ? 'checked' : ''}/></label><label><span><strong>Look sensitivity</strong><small>Adjust mouse movement speed</small></span><input id="setting-sensitivity" type="range" min="0.3" max="2" step="0.1" value="${state.settings?.sensitivity ?? 1}"/></label><label><span><strong>Visual quality</strong><small>Balance atmosphere and performance</small></span><select id="setting-quality"><option value="ultra" ${state.settings?.quality === 'ultra' ? 'selected' : ''}>Ultra</option><option value="high" ${!['ultra', 'medium', 'low'].includes(state.settings?.quality) ? 'selected' : ''}>High</option><option value="medium" ${state.settings?.quality === 'medium' ? 'selected' : ''}>Balanced</option><option value="low" ${state.settings?.quality === 'low' ? 'selected' : ''}>Performance</option></select></label><label><span><strong>Screen aspect ratio</strong><small>Fit the window or choose cinematic framing</small></span><select id="setting-aspect-ratio"><option value="auto" ${!state.settings?.aspectRatio || state.settings.aspectRatio === 'auto' ? 'selected' : ''}>Fit display</option><option value="16:9" ${state.settings?.aspectRatio === '16:9' ? 'selected' : ''}>16:9 · Widescreen</option><option value="21:9" ${state.settings?.aspectRatio === '21:9' ? 'selected' : ''}>21:9 · Ultrawide</option></select></label><label><span><strong>Resolution limit</strong><small>Maximum 3440 × 1440 · fits inside your display</small></span><select id="setting-resolution"><option value="auto" ${!state.settings?.resolution || state.settings.resolution === 'auto' ? 'selected' : ''}>Automatic · up to 3440 × 1440</option><option value="1920x1080" ${state.settings?.resolution === '1920x1080' ? 'selected' : ''}>1920 × 1080</option><option value="2560x1080" ${state.settings?.resolution === '2560x1080' ? 'selected' : ''}>2560 × 1080</option><option value="3440x1440" ${state.settings?.resolution === '3440x1440' ? 'selected' : ''}>3440 × 1440</option></select></label><label><span><strong>Combat challenge</strong><small>Choose a comfortable pace for your expedition</small></span><select id="setting-difficulty"><option value="easy" ${state.settings?.difficulty === 'easy' ? 'selected' : ''}>Explorer</option><option value="normal" ${!['easy', 'hard'].includes(state.settings?.difficulty) ? 'selected' : ''}>Slugslinger</option><option value="hard" ${state.settings?.difficulty === 'hard' ? 'selected' : ''}>Veteran</option></select></label></div><section class="audio-pack-section" aria-labelledby="audio-pack-title"><div class="audio-pack-heading"><div><p class="eyebrow">EXPEDITION SOUND LIBRARY</p><h3 id="audio-pack-title">Show audio pack</h3></div><span class="audio-pack-count">${recordingSlots.size} / ${audioSlots.length} RECORDINGS</span></div><p class="audio-pack-description">${audioDescription}</p><div class="audio-slot-grid">${audioSlots.map(([slot, label]) => `<label class="audio-slot ${loadedClips.has(slot) || bundledClips.has(slot) && !failedBundledClips.has(slot) ? 'imported' : ''}"><span><strong>${label}</strong><small data-audio-status="${slot}" title="${loadedClips.has(slot) ? 'Local replacement' : failedBundledClips.has(slot) ? 'Using the original fallback effect' : readyBundledClips.has(slot) ? 'Included recording ready' : bundledClips.has(slot) ? 'Included recording loads when audio starts' : 'Original synthesized effect'}">${clipLabel(slot)}</small></span><span class="audio-file-button">${loadedClips.has(slot) || bundledClips.has(slot) ? 'Replace' : 'Import'}<input type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac" data-audio-slot="${slot}" aria-label="Import ${label.toLowerCase()} clip"/></span></label>`).join('')}</div><div class="audio-pack-footer"><span>Included shot sequence · local replacements support WAV, MP3, OGG and other audio</span><button id="clear-audio-pack" class="audio-clear" ${loadedClips.size ? '' : 'disabled'}>Remove imported clips</button></div></section><p class="panel-footnote">Progress is automatically saved locally. Your companions will be waiting when you return.</p>`;
      $('#setting-sound').onchange = event => actions.setSetting('sound', event.target.checked);
      $('#setting-sensitivity').oninput = event => actions.setSetting('sensitivity', Number(event.target.value));
      $('#setting-quality').onchange = event => actions.setSetting('quality', event.target.value);
      $('#setting-aspect-ratio').onchange = event => actions.setSetting('aspectRatio', event.target.value);
      $('#setting-resolution').onchange = event => actions.setSetting('resolution', event.target.value);
      $('#setting-difficulty').onchange = event => actions.setSetting('difficulty', event.target.value);
      app.querySelectorAll('[data-audio-slot]').forEach(input => {
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const slot = input.dataset.audioSlot;
          const status = app.querySelector(`[data-audio-status="${slot}"]`);
          status.textContent = 'Importing…';
          input.disabled = true;
          try {
            const result = await actions.importAudio?.(slot, file);
            toast(result?.message || (result?.ok ? 'Audio clip imported on this device.' : 'Audio import is unavailable.'), result?.ok ? 'success' : 'warning');
          } catch (error) {
            toast(error?.message || 'This audio file could not be imported.', 'warning');
          } finally {
            if (currentDialog === 'settings') showDialog('settings', currentState);
          }
        };
      });
      $('#clear-audio-pack').onclick = async () => {
        $('#clear-audio-pack').disabled = true;
        try {
          const result = await actions.clearAudio?.();
          toast(result?.ok === false ? result.message || 'Imported clips could not be removed.' : 'Imported clips removed. Included recordings and original defaults restored.', result?.ok === false ? 'warning' : 'success');
        } catch (error) { toast(error?.message || 'Imported clips could not be removed.', 'warning'); }
        finally { if (currentDialog === 'settings') showDialog('settings', currentState); }
      };
    } else if (kind === 'credits') {
      const creditURL = value => /^https?:\/\//i.test(String(value || '')) ? esc(value) : '#';
      $('#dialog-content').innerHTML = `${panelTitle('The artists <em>behind the adventure.</em>')}<p class="dialog-intro">Uploaded character, companion and equipment models bring the caverns to life. Runtime versions are adapted for this expedition.</p>${modelCredits.map(credit => `<article class="guide-note"><div><h3>${esc(credit.title)}</h3><p>By <a href="${creditURL(credit.authorURL)}" target="_blank" rel="noopener noreferrer">${esc(credit.author)}</a> · <a href="${creditURL(credit.licenseURL)}" target="_blank" rel="noopener noreferrer">${esc(credit.license)}</a></p><p><a href="${creditURL(credit.source)}" target="_blank" rel="noopener noreferrer">Original model ↗</a></p><small>${esc(credit.changes)}</small></div></article>`).join('')}<p class="panel-footnote">Additional character models supplied by the project owner. Original procedural artwork and gameplay are retained.</p>`;
    } else if (kind === 'pause') {
      $('#dialog-content').innerHTML = `${panelTitle('Take a <em>breath.</em>')}<p class="dialog-intro">The deep can wait. Your expedition is safely saved on this device.</p><div class="pause-actions"><button class="button-primary" id="resume-game">Return to expedition ${icon('arrow')}</button><button class="button-outline" data-panel="atlas">Cavern atlas</button><button class="button-outline" data-panel="skills">Disciplines</button><button class="button-outline" data-panel="help">Field guide</button><button class="button-outline" data-panel="settings">Settings</button><button class="button-danger" id="restart-game">Start a new expedition</button></div>`;
      $('#resume-game').onclick = () => actions.resume();
      $('#restart-game').onclick = () => showDialog('restart', state);
      panelButtons();
    } else if (kind === 'restart') {
      $('#dialog-content').innerHTML = `${panelTitle('A new <em>beginning.</em>')}<p class="dialog-intro">Starting a new expedition replaces your saved journey on this device. Your heartshards, experience, discoveries, equipment and expedition progress will be reset. Your imported audio clips stay on this device.</p><div class="dialog-button-row"><button class="button-primary" id="confirm-restart">Start new expedition ${icon('arrow')}</button><button class="button-outline" id="cancel-restart">Keep exploring</button></div>`;
      $('#confirm-restart').onclick = () => actions.restart();
      $('#cancel-restart').onclick = () => currentMode === 'menu' ? actions.closePanel() : showDialog('pause', state);
    } else if (kind === 'victory' || kind === 'won') {
      $('#dialog-content').innerHTML = `<p class="eyebrow">EXPEDITION COMPLETE</p><h2 id="dialog-title">You became <em>the light.</em></h2><p class="dialog-intro">The Heart of the Deep beats again. The corruption has lifted, and the caverns will remember the slugslinger who brought the light home.</p><div class="victory-emblem">${icon('diamond')}</div><div class="journal-stats"><div><strong>3<small> / 3</small></strong><span>HEARTSHARDS RECOVERED</span></div><div><strong>${state.kills || 0}</strong><span>HOSTILES DEFEATED</span></div><div><strong>${state.level || 1}</strong><span>GUARDIAN LEVEL</span></div></div><div class="dialog-button-row"><button class="button-primary" id="keep-exploring">Keep exploring ${icon('arrow')}</button><button class="button-outline" id="victory-restart">New expedition</button></div>`;
      $('#keep-exploring').onclick = () => actions.resume();
      $('#victory-restart').onclick = () => showDialog('restart', state);
    } else {
      $('#dialog-content').innerHTML = `${panelTitle('Every hero <em>starts somewhere.</em>')}<p class="dialog-intro">Explore a living cavern, meet the waystation guardian, and recover three heartshards to restore the light. Your elemental companions are the key.</p>${help}<div class="guide-note">${icon('leaf')}<p><strong>Speed unlocks their power.</strong> Your slug accelerates into a Velocimorph at 100 mph (44.7 m/s) for 1.6× damage. <strong>Watch the beacons.</strong> Mint marks your path, amber marks a friend, and a violet glow marks the ancient heart. Approach a landmark and press E to interact.</p></div><div class="dialog-button-row"><button class="button-primary" id="guide-start">${currentMode === 'menu' ? 'Begin expedition' : 'Back to expedition'} ${icon('arrow')}</button></div>`;
      $('#guide-start').onclick = () => { if (currentMode === 'menu') actions.start(); else actions.resume(); };
      const creditButton = document.createElement('button'); creditButton.className = 'button-outline'; creditButton.textContent = 'Model credits';
      creditButton.onclick = () => showDialog('credits', currentState);
      $('#dialog-content .dialog-button-row').append(creditButton);
    }
    $('#dialog-backdrop').hidden = false;
    if (!refresh || !document.activeElement?.isConnected || document.activeElement === document.body) $('#game-dialog').focus({ preventScroll: refresh });
  }
  return {
    setMode, update, toast, showDialog, closeDialog,
    setInteract(text) { $('#interact-prompt').hidden = !text; $('#interact-prompt span').textContent = text || ''; },
    setPointerLocked(locked) { $('#click-to-look').classList.toggle('hidden', locked); },
    hit() { const el = $('#hit-marker'); el.classList.remove('active'); void el.offsetWidth; el.classList.add('active'); },
  };
}
