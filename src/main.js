import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCavern } from './caverns.js';
import { CAVERNS, BLASTERS } from './content.js';
import { createEnemyBrain } from './enemy-ai.js';
import { createGameState } from './game-state.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import metamorphosisClip from './assets/audio/slugterra-metamorphosis-shot.mp3?inline';
import { createSlugModel, createBlasterModel } from './models.js';
import { createCharacterPhysics, segmentSphereHit, segmentCapsuleHit, firstTerrainHit } from './physics.js';
import { createMouseControls } from './input.js';
import './style.css';

const canvas = document.querySelector('#game-canvas');
const game = createGameState();
const audio = createAudio({
  bundledClips: Object.fromEntries(['fire', 'electric', 'water'].map(element => [
    `morph-${element}`, { data: metamorphosisClip, offset: 0.085, label: 'Provided metamorphosis recording' },
  ])),
});
game.state.audio = audio.getStatus();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  document.body.innerHTML = '<main style="padding:10%;color:#d5fff3;background:#08252b;height:100vh;font-family:system-ui"><h1>The luminous deep needs WebGL</h1><p>Enable hardware acceleration in your browser and reload to enter the cavern.</p></main>';
  throw new Error('WebGL unavailable');
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x102e36);
scene.fog = new THREE.FogExp2(0x102e36, 0.0085);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.08, 260);
camera.position.set(43, 23, 64);
camera.lookAt(0, 5, -5);
const hemisphere = new THREE.HemisphereLight(0xa5e7ef, 0x254e3b, 1.55);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xf9e6b8, 2.6);
sun.position.set(20, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 0.5, far: 160 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.12;
sun.shadow.radius = 3;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x69cfff, 1.4);
fill.position.set(-25, 18, -45);
scene.add(fill);
let world = createCavern(THREE, { id: game.state.currentCavern || 'luminous', quality: game.state.settings.quality });
scene.add(world.group);
const colliders = [];
function bindColliders() {
  colliders.length = 0;
  if (world.colliders) { colliders.push(...world.colliders); return; }
  world.group.traverse(object => {
  if (!object.isMesh) return;
  if (object.isInstancedMesh && object.count < 100) object.castShadow = true;
  const p = object.geometry?.parameters;
  if (object.geometry?.type === 'CylinderGeometry' && p.height > 25) colliders.push({ x: object.position.x, z: object.position.z, radius: p.radiusBottom * 0.65, bottom: object.position.y - p.height / 2, top: object.position.y + p.height / 2 });
  if (object.isInstancedMesh && p?.radiusTop === 0.72 && p.height === 1) {
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    for (let i = 0; i < object.count; i++) { object.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale); colliders.push({ x: position.x, z: position.z, radius: scale.x, bottom: position.y - scale.y / 2, top: position.y + scale.y / 2 }); }
  }
  });
}
bindColliders();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.65, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let mode = 'menu', previousMode = 'menu', panelOpen = false, suppressUnlock = false;
let yaw = 0, pitch = 0, recoil = 0;
let aiming = false, focusToggled = false, lastSave = 0, lastUI = 0, lastScan = -10;
let simulationRemainder = 0, footstepDistance = 0, shotSerial = 0, jumpQueued = false;
const simulationStep = 1 / 120;
let currentInteraction = null, elapsed = 0, bossSpawned = false;
const keys = new Set();
const player = new THREE.Vector3(world.spawn.x, world.groundHeight(world.spawn.x, world.spawn.z) + 1.85, world.spawn.z);
const character = createCharacterPhysics({ position: player, groundHeight: (x, z) => world.groundHeight(x, z), colliders, bounds: 88 });
const projectiles = [], bursts = [], enemies = [], floatingLabels = [];
const forward = new THREE.Vector3(), right = new THREE.Vector3();
const screenVector = new THREE.Vector3();
const targetLine = new THREE.Vector3();
let damageFlash;
const landmarkLayer = document.createElement('div');
landmarkLayer.className = 'world-markers';
document.body.append(landmarkLayer);
const locations = () => [...(world.interactables || []), ...world.landmarks].filter((item, i, all) => all.findIndex(other => other.id === item.id) === i);
function rebuildMarkers() {
  landmarkLayer.replaceChildren(); floatingLabels.length = 0;
  for (const landmark of locations()) {
  const label = document.createElement('div');
  label.className = 'world-marker';
  label.innerHTML = `<span class="marker-diamond"></span><b>${landmark.name}</b><small></small>`;
  label.style.setProperty('--marker-color', `#${(landmark.color || 0x9cedd7).toString(16).padStart(6, '0')}`);
  landmarkLayer.append(label);
  floatingLabels.push({ landmark, label });
  }
}
rebuildMarkers();

const ui = createUI({
  start: () => startGame(false),
  resume: resumeGame,
  restart: () => startGame(true),
  selectSlug: index => { game.selectSlug(index); refreshWeapon(); },
  toggleSound: () => { game.setSetting('sound', !game.state.settings.sound); audio.setEnabled(game.state.settings.sound); audio.unlock(); },
  openPanel,
  closePanel,
  setSetting: (key, value) => {
    game.setSetting(key, value); applySettings();
    if (key === 'quality' && world.quality !== value) rebuildCavernDetails();
    if (key === 'difficulty') enemies.forEach(e => { e.brain = createEnemyBrain({ home: e.home, boss: e.boss, difficulty: value }); });
  },
  equipSlug: (id, slot) => {
    const result = game.equipSlug(id, slot);
    if (result.ok) { refreshWeapon(); rebuildPets(); }
    return result;
  },
  buyBlaster: id => { const result = game.buyBlaster(id); if (result.ok) refreshWeapon(); return result; },
  equipBlaster: id => { const result = game.equipBlaster(id); if (result.ok) refreshWeapon(); return result; },
  learnSkill: id => game.learnSkill(id),
  useSkill,
  fire: shoot,
  touch: (key, pressed) => { pressed ? keys.add(key.toLowerCase()) : keys.delete(key.toLowerCase()); },
  interact,
  importAudio: async (slot, file) => {
    await audio.unlock();
    const result = await audio.loadClip(slot, file);
    game.state.audio = audio.getStatus(); ui.update(game.state);
    return result;
  },
  clearAudio: async () => {
    const result = await audio.clearClips();
    game.state.audio = audio.getStatus(); ui.update(game.state); return result;
  },
});
damageFlash = document.querySelector('#damage-flash');

// A tiny, expressive ranger and slug companions inhabit Haven.
function material(color, glow = 0, intensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, emissive: glow, emissiveIntensity: intensity });
}
function part(group, geometry, mat, x, y, z) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z); group.add(mesh); return mesh;
}
const ranger = new THREE.Group();
const guidePos = world.landmarks.find(l => l.id === 'guide')?.position || { x: 0, y: 2, z: 35 };
ranger.position.set(guidePos.x, guidePos.y + 0.3, guidePos.z);
ranger.visible = game.state.currentCavern === 'luminous';
const rangerCoat = material(0x315766), rangerTrim = material(0xd7ad68), rangerSkin = material(0xd5b08a);
part(ranger, new THREE.CapsuleGeometry(0.35, 0.75, 4, 8), rangerCoat, 0, 1.2, 0);
part(ranger, new THREE.SphereGeometry(0.27, 12, 8), rangerSkin, 0, 2.04, 0);
part(ranger, new THREE.CylinderGeometry(0.45, 0.45, 0.09, 12), rangerTrim, 0, 2.26, 0);
part(ranger, new THREE.CylinderGeometry(0.27, 0.31, 0.3, 12), rangerCoat, 0, 2.36, 0);
for (const side of [-1, 1]) {
  part(ranger, new THREE.CapsuleGeometry(0.12, 0.57, 3, 6), rangerCoat, side * 0.19, 0.45, 0);
  const arm = part(ranger, new THREE.CapsuleGeometry(0.11, 0.6, 3, 6), rangerCoat, side * 0.42, 1.27, 0);
  arm.rotation.z = side * 0.15;
  part(ranger, new THREE.SphereGeometry(0.048, 8, 6), material(0x8cf7e8, 0x52ffd3, 2), side * 0.11, 2.08, -0.24);
}
const badge = part(ranger, new THREE.OctahedronGeometry(0.12), rangerTrim, 0, 1.52, -0.33);
scene.add(ranger);
const slugPets = [];
function rebuildPets() {
  slugPets.forEach(pet => { scene.remove(pet); disposeObject(pet); }); slugPets.length = 0;
  game.state.slugs.forEach((slug, i) => {
  const pet = createSlugModel(THREE, slug, { scale: 0.85 });
  pet.position.set(-1 + i, world.groundHeight(-1 + i, 33.2) + 0.3, 33.2);
    pet.visible = game.state.currentCavern === 'luminous';
    scene.add(pet); slugPets.push(pet);
  });
}
rebuildPets();

const blaster = createBlasterModel(THREE, game.state.slugs);
const launcher = blaster.group;
camera.add(launcher); scene.add(camera);
launcher.position.set(0.3, -0.3, -0.64);
launcher.scale.setScalar(0.8); launcher.visible = false;
function refreshWeapon() {
  blaster.setRoster?.(game.state.slugs);
  blaster.setSlug(game.state.selectedSlug);
  const weapon = BLASTERS.find(b => b.id === game.state.equippedBlaster) || BLASTERS[0];
  blaster.setWeapon?.({ ...weapon, tier: weapon.id === 'breaker' ? 2 : weapon.id === 'rapid' ? 1 : 0, accent: weapon.id === 'breaker' ? '#f2a96d' : weapon.id === 'rapid' ? '#7cd4f5' : '#f58a36' });
  audio.reload?.(audioElement(game.state.slugs[game.state.selectedSlug].element));
  ui.update(game.state);
}
function audioElement(element) { return element === 'ice' ? 'water' : ['healing', 'light'].includes(element) ? 'electric' : element; }
function disposeObject(root) {
  const seen = new Set();
  root.traverse(o => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (material && !seen.has(material)) {
        for (const texture of Object.values(material)) if (texture?.isTexture && !seen.has(texture)) { seen.add(texture); texture.dispose(); }
        seen.add(material); material.dispose();
      }
    }
  });
}
function clearProjectiles() {
  for (const p of projectiles) { scene.remove(p.mesh, p.trail); disposeObject(p.mesh); disposeObject(p.trail); }
  projectiles.length = 0;
  game.state.slugs.forEach(s => { s.inFlight = false; });
  game.state.flight = { phase: 'ready', slug: '', speed: 0, morphed: false };
}
function clearBursts() {
  for (const burst of bursts) { scene.remove(burst.points); disposeObject(burst.points); }
  bursts.length = 0;
}
function applyAtmosphere() {
  const a = world.atmosphere || {};
  scene.background.set(a.background ?? 0x102e36);
  scene.fog.color.set(a.fog ?? a.background ?? 0x102e36);
  scene.fog.density = a.density ?? 0.0085;
  sun.color.set(a.key ?? 0xf9e6b8); fill.color.set(a.fill ?? 0x69cfff);
  renderer.toneMappingExposure = a.exposure ?? 1.18;
  hemisphere.color.set(a.ambient ?? 0xa5e7ef);
  hemisphere.groundColor.set(a.ground ?? 0x254e3b);
  renderer.shadowMap.needsUpdate = true;
}
function rebuildCavernDetails() {
  const nextWorld = createCavern(THREE, { id: game.state.currentCavern, quality: game.state.settings.quality });
  scene.remove(world.group); disposeObject(world.group);
  world = nextWorld; scene.add(world.group); bindColliders();
  rebuildMarkers(); updateCollected(); applyAtmosphere(); updateInteractions();
}
function loadCavern(id, { restoring = false, position = null } = {}) {
  if (!CAVERNS[id]) return false;
  if (!restoring && game.state.slugs.some(slug => slug.inFlight)) {
    ui.toast('Wait for your companions to return before travelling.', 'info'); return false;
  }
  const nextWorld = createCavern(THREE, { id, quality: game.state.settings.quality });
  if (!restoring) {
    game.save(player);
    const result = game.travel(id);
    if (!result.ok) { disposeObject(nextWorld.group); return false; }
  }
  clearProjectiles(); clearBursts();
  for (const enemy of enemies) { scene.remove(enemy.root); disposeObject(enemy.root); }
  enemies.length = 0;
  scene.remove(world.group); disposeObject(world.group);
  world = nextWorld; scene.add(world.group); bindColliders();
  const destination = position || game.state.position || world.spawn;
  const x = THREE.MathUtils.clamp(destination.x ?? world.spawn.x, -85, 85);
  const z = THREE.MathUtils.clamp(destination.z ?? world.spawn.z, -85, 85);
  player.set(x, world.groundHeight(x, z) + 1.85, z);
  character.reset(); keys.clear(); jumpQueued = false; focusToggled = false; aiming = false; mouse.reset();
  simulationRemainder = 0; footstepDistance = 0; currentInteraction = null;
  yaw = Math.PI; pitch = 0; camera.position.copy(player); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  ranger.visible = id === 'luminous';
  if (ranger.visible) { const guide = world.landmarks.find(l => l.id === 'guide').position; ranger.position.set(guide.x, guide.y + 0.3, guide.z); }
  rebuildPets(); rebuildMarkers(); populateEnemies(); applyAtmosphere(); updateCollected();
  game.save(player); ui.update(game.state); updateInteractions();
  if (!restoring) ui.toast(`${CAVERNS[id].name} · Find a checkpoint, survey the cavern, and meet its companions.`, 'quest');
  return true;
}
function useSkill(id = 'slug-fu') {
  if (mode === 'menu') return { ok: false, event: 'expedition-required', message: 'Begin your expedition to use a skill.' };
  const result = game.useSkill(id);
  if (result.ok) {
    if (panelOpen) closePanel();
    audio.collect(); spawnBurst(player.clone().add(new THREE.Vector3(0, 0.3, 0)), '#b9f2dd', 18);
  }
  return result;
}

function makeEnemy(x, z, boss = false, camp = null, encounterId = null) {
  const root = new THREE.Group();
  const size = boss ? 2.8 : 1;
  root.position.set(x, world.groundHeight(x, z) + (boss ? 3.2 : 1.2), z);
  const shell = material(boss ? 0x313b4a : 0x243745, 0x231831, 0.15);
  const pink = material(0xd17cc9, 0xef4eb2, 1.6);
  const body = part(root, new THREE.IcosahedronGeometry(0.8 * size, 1), shell, 0, 0, 0);
  body.scale.y = 0.85;
  const eye = part(root, new THREE.SphereGeometry(0.22 * size, 12, 8), pink, 0, 0.08 * size, -0.68 * size);
  for (const side of [-1, 1]) {
    const horn = part(root, new THREE.ConeGeometry(0.16 * size, 0.85 * size, 5), shell, side * 0.57 * size, 0.6 * size, -0.08);
    horn.rotation.z = side * -0.35;
    for (const front of [-1, 1]) {
      const leg = part(root, new THREE.ConeGeometry(0.13 * size, 1.35 * size, 5), shell, side * 0.7 * size, -0.45 * size, front * 0.43 * size);
      leg.rotation.z = side * -0.55;
      part(root, new THREE.SphereGeometry(0.09 * size, 8, 6), pink, side * 0.85 * size, -0.4 * size, front * 0.43 * size);
    }
  }
  const halo = part(root, new THREE.TorusGeometry(1.03 * size, 0.028 * size, 4, 32), pink, 0, 0, 0);
  halo.rotation.x = Math.PI / 2;
  const hpGroup = new THREE.Group();
  hpGroup.position.y = 1.3 * size;
  part(hpGroup, new THREE.PlaneGeometry(1.45 * size, 0.085 * size), new THREE.MeshBasicMaterial({ color: 0x243b42 }), 0, 0, 0);
  const hpBar = part(hpGroup, new THREE.PlaneGeometry(1.45 * size, 0.085 * size), new THREE.MeshBasicMaterial({ color: boss ? 0xf090c9 : 0x74eccd }), 0, 0, 0.005);
  root.add(hpGroup); scene.add(root);
  const enemy = { root, body, eye, halo, hpGroup, hpBar, boss, hp: boss ? 530 : 100, maxHp: boss ? 530 : 100, radius: boss ? 2.4 : 0.88, home: new THREE.Vector3(x, 0, z), attack: 1 + Math.random() * 2, stagger: 0, dead: false, camp, size, encounterId };
  enemy.brain = createEnemyBrain({ home: enemy.home, boss, difficulty: game.state.settings.difficulty || 'normal' });
  enemies.push(enemy); return enemy;
}
function populateEnemies() {
  const disposed = new Set();
  enemies.forEach(e => {
    scene.remove(e.root);
    e.root.traverse(o => {
      if (o.geometry && !disposed.has(o.geometry)) { o.geometry.dispose(); disposed.add(o.geometry); }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) if (mat && !disposed.has(mat)) { mat.dispose(); disposed.add(mat); }
    });
  });
  enemies.length = 0;
  const defeated = game.state.cavernProgress?.[game.state.currentCavern]?.defeated || [];
  if (game.state.currentCavern === 'luminous') {
    for (const landmark of world.landmarks.filter(l => l.id.startsWith('shard'))) {
      if (game.state.collected.includes(landmark.id)) continue;
      for (let i = 0; i < 2; i++) {
        const id = `luminous:${landmark.id}:${i}`;
        if (!defeated.includes(id)) makeEnemy(landmark.position.x + (i ? 5 : -5), landmark.position.z + (i ? 3 : -4), false, landmark.id, id);
      }
    }
  } else {
    for (const spawn of world.enemySpawns || []) {
      if (!defeated.includes(spawn.id)) makeEnemy(spawn.x, spawn.z, spawn.boss || false, spawn.camp || spawn.id, spawn.id);
    }
  }
  bossSpawned = false;
  checkBoss();
}
function checkBoss() {
  if (game.state.currentCavern === 'luminous' && game.state.quest.stage === 'boss' && !bossSpawned) {
    makeEnemy(0, -48, true, null, 'luminous:warden'); bossSpawned = true;
    ui.toast('The Hollow Warden awakens at the Heartstone.', 'warning');
  }
}

function startGame(fresh) {
  audio.unlock();
  clearProjectiles();
  for (const b of bursts) { scene.remove(b.points); b.points.geometry.dispose(); b.points.material.dispose(); }
  bursts.length = 0;
  const result = game.start({ fresh });
  if (world.id !== game.state.currentCavern) loadCavern(game.state.currentCavern, { restoring: true, position: result.position || game.state.position });
  const p = result.event === 'restored' ? result.position : { x: world.spawn.x, z: world.spawn.z };
  player.set(p.x, world.groundHeight(p.x, p.z) + 1.85, p.z);
  yaw = result.event === 'restored' ? 0 : Math.PI;
  pitch = 0;
  keys.clear(); jumpQueued = false; focusToggled = false; mouse.reset(); character.reset(); simulationRemainder = 0;
  panelOpen = false; ui.closeDialog(); mode = 'playing'; ui.setMode(mode);
  launcher.visible = true;
  populateEnemies(); applySettings(); applyAtmosphere(); updateCollected(); refreshWeapon(); rebuildPets();
  ui.toast(result.event === 'restored' ? 'Welcome back to the luminous deep.' : 'Welcome to Haven. Approach Ranger Kael at the amber beacon. Press E to speak.', 'quest');
  requestPointer();
}
function requestPointer() {
  if (!canvas.requestPointerLock || matchMedia('(pointer: coarse)').matches) return;
  try {
    const result = canvas.requestPointerLock();
    if (result?.catch) result.catch(() => ui.toast('Click and drag the world to look around. WASD to move.', 'info'));
  } catch { /* Drag-to-look remains available. */ }
}
function releasePointer() {
  suppressUnlock = true;
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => { suppressUnlock = false; }, 150);
}
function openPanel(kind, context = {}) {
  if (!panelOpen) previousMode = mode;
  panelOpen = true; keys.clear(); jumpQueued = false; focusToggled = false; mouse.reset(); simulationRemainder = 0;
  if (mode !== 'menu') { mode = 'paused'; ui.setMode(mode); game.save(player); }
  releasePointer(); ui.showDialog(kind, game.state, context);
}
function closePanel() {
  panelOpen = false; ui.closeDialog();
  if (previousMode === 'menu') { mode = 'menu'; ui.setMode(mode); }
  else resumeGame();
}
function resumeGame() {
  panelOpen = false; ui.closeDialog(); mode = 'playing'; ui.setMode(mode);
  keys.clear(); mouse.reset(); simulationRemainder = 0; requestPointer();
}
function applySettings() {
  audio.setEnabled(game.state.settings.sound);
  const q = game.state.settings.quality;
  renderer.shadowMap.enabled = q !== 'low';
  const shadowSize = q === 'ultra' ? 4096 : q === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== shadowSize) {
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.map?.dispose(); sun.shadow.map = null;
  }
  renderer.shadowMap.needsUpdate = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 0.85 : q === 'medium' ? 1 : q === 'ultra' ? 2 : 1.5));
  bloom.strength = q === 'ultra' ? 0.43 : 0.38;
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
}
function updateCollected() {
  for (const lm of world.landmarks) if (lm.id.startsWith('shard') && lm.object) lm.object.visible = !game.state.collected.includes(lm.id);
  for (const lm of world.interactables || []) {
    if (lm.type === 'discovery' && lm.object) lm.object.visible = !game.state.ownedSlugs.includes(lm.slugId);
    if (lm.type === 'survey' && lm.object) lm.object.visible = !game.state.cavernProgress[game.state.currentCavern]?.completed;
  }
}
function interact() {
  if (mode !== 'playing' || !currentInteraction) return;
  const lm = currentInteraction;
  if (lm.type === 'portal') { loadCavern(lm.target); return; }
  if (lm.type === 'npc') { openPanel(lm.role || 'expedition', lm); return; }
  if (lm.type === 'checkpoint') { game.setCheckpoint(game.state.currentCavern, player); audio.collect(); return; }
  if (lm.type === 'discovery' || lm.type === 'survey') {
    if (enemies.some(e => !e.dead && (e.camp === lm.id || Math.hypot(e.root.position.x - lm.position.x, e.root.position.z - lm.position.z) < 12))) {
      ui.toast('Clear the nearby sentinels before approaching this discovery.', 'warning'); return;
    }
    const result = lm.type === 'discovery' ? game.discoverSlug(lm.slugId) : game.completeCavern(game.state.currentCavern);
    if (result.ok) {
      audio.collect(); spawnBurst(new THREE.Vector3(lm.position.x, lm.position.y + 1, lm.position.z), '#b9f2dd', 24);
      if (lm.object) lm.object.visible = false;
      game.save(player); ui.update(game.state);
    } else if (result.message) ui.toast(result.message, 'info');
    return;
  }
  if (lm.id.startsWith('shard') && enemies.some(e => !e.dead && e.camp === lm.id)) {
    ui.toast('Clear the corrupted sentinels before collecting this shard.', 'warning'); return;
  }
  const event = game.interact(lm.id);
  game.save(player); updateCollected(); checkBoss();
  if (['shard-collected', 'boss-unlocked', 'quest-started'].includes(event.event)) audio.collect();
  if (event.event === 'quest-complete') {
    audio.win(); spawnBurst(player.clone().add(new THREE.Vector3(0, 2, -4)), '#baffd4', 55);
    openPanel('victory');
  }
}

function spawnBurst(position, color, count = 14) {
  const geo = new THREE.BufferGeometry();
  const coords = new Float32Array(count * 3), speeds = [];
  for (let i = 0; i < count; i++) {
    coords.set([position.x, position.y, position.z], i * 3);
    speeds.push(new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 7 - 1, (Math.random() - 0.5) * 8));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(coords, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat); scene.add(points);
  bursts.push({ points, speeds, life: 0.9, maxLife: 0.9 });
}
const combatStats = { shots: 0, morphs: 0, hits: 0, terrainHits: 0, obstacleHits: 0, returns: 0 };
function createProjectile(position, direction, slug, hostile = false) {
  const mesh = new THREE.Group();
  let proto = null, morph = null;
  if (hostile) {
    part(mesh, new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: slug.color }), 0, 0, 0);
  } else {
    proto = createSlugModel(THREE, slug, { scale: 0.28 });
    morph = createSlugModel(THREE, slug, { scale: 0.38, morphed: true });
    morph.visible = false; mesh.add(proto, morph);
  }
  mesh.position.copy(position);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  scene.add(mesh);
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([position, position]), new THREE.LineBasicMaterial({ color: slug.color, transparent: true, opacity: 0.5 }));
  scene.add(trail);
  const speed = hostile ? slug.speed : 18;
  const p = { mesh, proto, morph, trail, slug, serial: ++shotSerial, velocity: direction.clone().multiplyScalar(speed), speed, damage: slug.damage, element: slug.element, color: slug.color, hostile, life: hostile ? 4 : 2.8, phase: 'protoform', morphed: false, morphAge: 0, radius: hostile ? 0.18 : 0.12 };
  projectiles.push(p);
  if (!hostile) { game.state.slugs.find(s => s.id === slug.id).inFlight = true; combatStats.shots++; }
  return p;
}
function returnSlug(p) {
  if (p.hostile) { p.life = 0; return; }
  p.phase = 'returning'; p.life = 8; p.speed = 40; p.proto.visible = true; p.morph.visible = false;
  p.proto.scale.setScalar(0.28); p.mesh.scale.setScalar(1);
}
function removeProjectile(index) {
  const p = projectiles[index]; if (!p) return;
  scene.remove(p.mesh, p.trail); disposeObject(p.mesh); disposeObject(p.trail);
  if (!p.hostile) {
    const slug = game.state.slugs.find(s => s.id === p.slug.id); slug.inFlight = false;
    combatStats.returns++; audio.reload?.(audioElement(p.element));
  }
  projectiles.splice(index, 1);
}
function aimTarget() {
  camera.getWorldDirection(forward);
  let best = null, bestScore = 0.965;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    targetLine.subVectors(enemy.root.position, player);
    const distance = targetLine.length();
    const dot = targetLine.normalize().dot(forward);
    if (distance < 42 && dot > bestScore) { best = enemy; bestScore = dot; }
  }
  return best;
}
function shoot() {
  if (mode !== 'playing' || panelOpen) return;
  if (game.state.slugs[game.state.selectedSlug].inFlight) return;
  const slug = game.fire(); if (!slug) return;
  camera.getWorldDirection(forward);
  const target = aimTarget();
  launcher.updateWorldMatrix(true, false);
  const start = launcher.localToWorld(blaster.muzzle.clone());
  const destination = target ? target.root.position : player.clone().addScaledVector(forward, 60);
  forward.subVectors(destination, start).normalize();
  createProjectile(start, forward, slug);
  audio.shoot(audioElement(slug.element)); recoil = 1;
  spawnBurst(start.clone().add(forward.clone().multiplyScalar(0.5)), slug.color, 5);
}
function damageEnemy(enemy, projectile) {
  enemy.hp -= projectile.damage * (projectile.morphed ? (projectile.slug.morphMultiplier || 1.6) : 1);
  combatStats.hits++;
  enemy.stagger = projectile.element === 'ice' ? 1.8 : projectile.element === 'light' ? 0.9 : projectile.element === 'electric' ? 0.75 : 0.18;
  enemy.eye.material.emissiveIntensity = 5;
  audio.impact(audioElement(projectile.element));
  spawnBurst(projectile.mesh.position, projectile.color, 12);
  ui.hit?.();
  if (enemy.hp <= 0) {
    enemy.dead = true; scene.remove(enemy.root);
    spawnBurst(enemy.root.position, '#f7b1e8', enemy.boss ? 65 : 25);
    game.addKill({ boss: enemy.boss, encounterId: enemy.encounterId }); game.save(player);
    if (enemy.boss) audio.collect();
  }
}
function hurt(amount) {
  const event = game.damage(amount); audio.hurt();
  damageFlash.classList.remove('active'); void damageFlash.offsetWidth; damageFlash.classList.add('active');
  if (event.event === 'respawn') {
    if (event.cavernId && event.cavernId !== game.state.currentCavern) game.state.currentCavern = event.cavernId;
    if (world.id !== game.state.currentCavern) loadCavern(game.state.currentCavern, { restoring: true, position: event.position || game.state.position });
    const checkpoint = event.position || game.state.checkpoint?.position || world.spawn;
    player.set(checkpoint.x, world.groundHeight(checkpoint.x, checkpoint.z) + 1.85, checkpoint.z);
    character.reset();
    for (const enemy of enemies) { enemy.root.position.x = enemy.home.x; enemy.root.position.z = enemy.home.z; enemy.attack = 3; enemy.brain.reset(); }
    clearProjectiles();
  }
  return event;
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.life -= dt;
    const previous = p.mesh.position.clone();
    if (p.phase === 'returning') {
      launcher.updateWorldMatrix(true, false);
      const home = launcher.localToWorld(new THREE.Vector3(0, 0.02, 0.03));
      const offset = home.sub(p.mesh.position), distance = offset.length();
      if (distance <= dt * 40 + 0.25 || p.life <= 0) { removeProjectile(i); continue; }
      p.velocity.copy(offset).normalize().multiplyScalar(40);
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p.velocity.clone().normalize());
    } else {
      if (!p.hostile) {
        if (game.state.activeSkills?.['slug-fu'] > 0 && p.slug.id === game.state.slugs[game.state.selectedSlug].id) {
          camera.getWorldDirection(forward);
          const target = aimTarget();
          const direction = target ? target.root.position.clone().sub(p.mesh.position).normalize() : forward;
          p.velocity.normalize().lerp(direction, 1 - Math.exp(-2.5 * dt)).normalize().multiplyScalar(p.speed);
        }
        p.speed = Math.min(p.slug.speed, p.speed + 105 * dt);
        p.velocity.normalize().multiplyScalar(p.speed);
        p.velocity.y -= 0.8 * dt;
        if (!p.morphed && p.speed >= (p.slug.morphSpeed || 44.7)) {
          p.morphed = true; p.phase = 'velocimorph'; p.morphAge = 0;
          p.proto.visible = false; p.morph.visible = true; p.radius = 0.25;
          combatStats.morphs++; audio.morph?.(audioElement(p.element));
          spawnBurst(p.mesh.position, p.color, 9);
        }
        if (p.morphed) {
          p.morphAge += dt;
          p.morph.scale.setScalar(0.38 * Math.min(1, 0.3 + p.morphAge * 8));
        }
      }
      const end = previous.clone().addScaledVector(p.velocity, dt);
      let hit = null, hitT = 2;
      const consider = (t, value) => { if (t !== null && t < hitT) { hitT = t; hit = value; } };
      consider(firstTerrainHit(previous, end, world.groundHeight, p.radius), { kind: 'terrain' });
      for (const obstacle of colliders) {
        const bottom = obstacle.bottom ?? world.groundHeight(obstacle.x, obstacle.z);
        const top = obstacle.top ?? bottom + 30;
        consider(segmentCapsuleHit(previous, end, { x: obstacle.x, y: (bottom + top) / 2, z: obstacle.z }, obstacle.radius + p.radius, (top - bottom) / 2), { kind: 'obstacle' });
      }
      if (p.hostile) {
        consider(segmentCapsuleHit(previous, end, { x: player.x, y: player.y - 0.72, z: player.z }, 0.38 + p.radius, 0.55), { kind: 'player' });
      } else {
        for (const enemy of enemies) if (!enemy.dead) consider(segmentSphereHit(previous, end, enemy.root.position, enemy.radius + p.radius), { kind: 'enemy', enemy });
      }
      p.mesh.position.copy(previous).lerp(end, hit ? hitT : 1);
      p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p.velocity.clone().normalize());
      if (hit) {
        if (hit.kind === 'enemy') damageEnemy(hit.enemy, p);
        else if (hit.kind === 'player') { if (hurt(p.damage)?.event === 'respawn') return; }
        else {
          combatStats[hit.kind === 'terrain' ? 'terrainHits' : 'obstacleHits']++;
          if (!p.hostile) audio.impact(audioElement(p.element));
          spawnBurst(p.mesh.position, p.color, 8);
        }
        if (p.hostile) { removeProjectile(i); continue; }
        returnSlug(p);
      } else if (p.life <= 0 || Math.hypot(p.mesh.position.x, p.mesh.position.z) > 98) {
        if (p.hostile) { removeProjectile(i); continue; }
        returnSlug(p);
      }
    }
    const tail = p.mesh.position.clone().addScaledVector(p.velocity.clone().normalize(), p.phase === 'returning' ? -0.5 : -1.6);
    const attr = p.trail.geometry.attributes.position;
    attr.setXYZ(0, tail.x, tail.y, tail.z); attr.setXYZ(1, p.mesh.position.x, p.mesh.position.y, p.mesh.position.z);
    attr.needsUpdate = true; p.trail.geometry.computeBoundingSphere();
  }
  const latest = projectiles.filter(p => !p.hostile).sort((a, b) => b.serial - a.serial)[0];
  if (latest) game.state.flight = { phase: latest.phase, slug: latest.slug.name, speed: latest.speed, morphed: latest.morphed };
  else game.state.flight = { phase: 'ready', slug: '', speed: 0, morphed: false };
}
function visibleBetween(start, end) {
  if (firstTerrainHit(start, end, world.groundHeight, 0.08) !== null) return false;
  return !colliders.some(c => segmentCapsuleHit(start, end, { x: c.x, y: (c.bottom + c.top) / 2, z: c.z }, c.radius + 0.08, Math.max(0, (c.top - c.bottom) / 2)) !== null);
}
function moveEnemy(enemy, intent, dt) {
  const distance = dt * (enemy.boss ? 2.5 : 3) * intent.speedMultiplier;
  const x = enemy.root.position.x, z = enemy.root.position.z;
  const canStand = (nx, nz) => Math.abs(nx) < 87 && Math.abs(nz) < 87
    && Math.abs(world.groundHeight(nx, nz) - world.groundHeight(x, z)) < 0.55
    && !colliders.some(c => Math.hypot(nx - c.x, nz - c.z) < c.radius + enemy.radius * 0.65 && enemy.root.position.y - 0.5 < c.top && enemy.root.position.y + 0.5 > c.bottom);
  const nx = x + intent.move.x * distance, nz = z + intent.move.z * distance;
  if (canStand(nx, nz)) { enemy.root.position.x = nx; enemy.root.position.z = nz; }
  else if (canStand(nx, z)) enemy.root.position.x = nx;
  else if (canStand(x, nz)) enemy.root.position.z = nz;
}
function updateEnemies(dt) {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]; if (e.dead) continue;
    const distance = player.distanceTo(e.root.position);
    e.stagger = Math.max(0, e.stagger - dt);
    if (distance < (e.boss ? 42 : 28) && (!e.nextSight || elapsed >= e.nextSight)) {
      e.hasSight = visibleBetween(e.root.position, player); e.nextSight = elapsed + 0.12;
    }
    const intent = e.brain.update(dt, { position: e.root.position, target: player, lineOfSight: Boolean(e.hasSight), stagger: e.stagger });
    e.phase = intent.phase;
    moveEnemy(e, intent, dt);
    if (distance < 38 && intent.phase !== 'return') { e.root.lookAt(player.x, e.root.position.y, player.z); e.root.rotateY(Math.PI); }
    if (intent.fire && visibleBetween(e.root.position, player)) {
      const direction = new THREE.Vector3(intent.aimPoint.x, intent.aimPoint.y, intent.aimPoint.z).sub(e.root.position).normalize();
      createProjectile(e.root.position.clone().addScaledVector(direction, e.radius + 0.2), direction, { color: '#ee79cc', damage: (e.boss ? 27 : 16) * intent.damageMultiplier, speed: e.boss ? 20 : 15, element: 'corrupt' }, true);
    }
    e.root.position.y = world.groundHeight(e.root.position.x, e.root.position.z) + (e.boss ? 3.2 : 1.25) + Math.sin(elapsed * 2 + i) * 0.12;
    e.halo.rotation.z = elapsed * (intent.phase === 'windup' ? 2.5 : 0.5);
    e.halo.scale.setScalar(1 + intent.telegraph * 0.24);
    e.hpGroup.quaternion.copy(e.root.quaternion).invert().multiply(camera.quaternion); e.hpBar.scale.x = Math.max(0, e.hp / e.maxHp);
    e.hpGroup.visible = distance < 30;
    e.eye.material.color.set(intent.phase === 'windup' ? 0xffc479 : intent.phase === 'recovery' ? 0x66d7cc : 0xd17cc9);
    e.eye.material.emissiveIntensity = intent.phase === 'windup' ? 2 + intent.telegraph * 4 : THREE.MathUtils.lerp(e.eye.material.emissiveIntensity, intent.phase === 'recovery' ? 0.5 : 1.6, dt * 8);
  }
}
function scan() {
  if (elapsed - lastScan < 3) return;
  lastScan = elapsed; audio.collect();
  ui.toast('Echo pulse · Beacons and hostiles revealed on your compass.', 'info');
  const active = world.landmarks.filter(l => l.id.startsWith('shard') && !game.state.collected.includes(l.id));
  if (active.length) {
    active.sort((a, b) => player.distanceTo(new THREE.Vector3(a.position.x, player.y, a.position.z)) - player.distanceTo(new THREE.Vector3(b.position.x, player.y, b.position.z)));
    const lm = active[0]; ui.toast(`${lm.name} · ${Math.round(Math.hypot(player.x - lm.position.x, player.z - lm.position.z))} m away`, 'quest');
  }
}

function movePlayer(dt) {
  const xInput = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  const zInput = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3().addScaledVector(forward, zInput).addScaledVector(right, xInput);
  if (move.lengthSq() > 1) move.normalize();
  const before = player.clone(), wasGrounded = character.grounded, previousFall = character.velocity.y;
  character.step(dt, { x: move.x, z: move.z, jump: jumpQueued || keys.has(' '), sprint: keys.has('shift'), aiming });
  jumpQueued = false;
  if (wasGrounded && !character.grounded && character.velocity.y > 0) audio.jump?.();
  if (!wasGrounded && character.grounded && previousFall < -1) audio.land?.(Math.min(1, -previousFall / 12));
  if (character.grounded) {
    footstepDistance += Math.hypot(player.x - before.x, player.z - before.z);
    if (footstepDistance > (keys.has('shift') ? 2.5 : 1.9)) {
      const river = world.map?.river;
      const riverPoint = river?.reduce((best, point) => !best || Math.abs(point.z - player.z) < Math.abs(best.z - player.z) ? point : best, null);
      const riverCenter = game.state.currentCavern === 'luminous' ? -7 + Math.sin(player.z * 0.035) * 13 : riverPoint?.x;
      const wet = Number.isFinite(riverCenter) && Math.abs(player.x - riverCenter) < 3;
      audio.footstep?.(wet ? 'water' : 'stone', keys.has('shift') ? 1.3 : 1); footstepDistance = 0;
    }
  }
  camera.position.copy(player); camera.rotation.set(pitch, yaw, 0, 'YXZ');
  if (mouse.firing || keys.has('f')) shoot();
}
function updateView(dt) {
  camera.position.copy(player);
  const speed = Math.hypot(character.velocity.x, character.velocity.z);
  if (speed > 0.2 && character.grounded) camera.position.y += Math.sin(elapsed * (speed > 7 ? 13 : 9)) * Math.min(0.04, speed * 0.006);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const blend = 1 - Math.exp(-12 * dt);
  const fov = THREE.MathUtils.lerp(camera.fov, aiming ? 45 : 65, blend);
  if (Math.abs(camera.fov - fov) > 0.001) { camera.fov = fov; camera.updateProjectionMatrix(); }
  game.state.heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  game.state.aiming = aiming;
  recoil = Math.max(0, recoil - dt * 6);
  const target = new THREE.Vector3(aiming ? Math.min(0.06, camera.aspect * 0.05) : Math.min(0.3, camera.aspect * 0.19), aiming ? -0.235 : -0.30, (aiming ? -0.57 : -0.64) + recoil * 0.07);
  if (speed > 0.2 && character.grounded) target.y += Math.sin(elapsed * 9) * Math.min(0.012, speed * 0.002);
  launcher.position.lerp(target, blend);
  launcher.rotation.x = recoil * 0.1;
  blaster.update(dt, { recoil, aiming, cooldown: game.state.slugs[game.state.selectedSlug].cooldown });
}
function updateInteractions() {
  currentInteraction = null; let closest = 5.5;
  for (const lm of locations()) {
    if (lm.id === 'boss' || game.state.collected.includes(lm.id)) continue;
    if (lm.type === 'discovery' && game.state.ownedSlugs.includes(lm.slugId)) continue;
    if (lm.type === 'survey' && game.state.cavernProgress[game.state.currentCavern]?.completed) continue;
    const distance = Math.hypot(player.x - lm.position.x, player.z - lm.position.z);
    if (distance < closest) { closest = distance; currentInteraction = lm; }
  }
  const lm = currentInteraction;
  const prompt = !lm ? '' : lm.id === 'guide' ? 'Speak with Ranger Kael'
    : lm.type === 'portal' ? `Travel · ${CAVERNS[lm.target]?.name || lm.name}`
    : lm.type === 'checkpoint' ? `Rest · ${lm.name}`
    : lm.type === 'npc' ? `Speak · ${lm.name}`
    : lm.type === 'discovery' ? `Befriend · ${lm.name}`
    : lm.type === 'survey' ? `Record survey · ${lm.name}` : `Recover shard · ${lm.name}`;
  ui.setInteract(prompt);
}
function updateMarkers() {
  for (const { landmark: lm, label } of floatingLabels) {
    const active = lm.type ? !(lm.type === 'discovery' && game.state.ownedSlugs.includes(lm.slugId)) && !(lm.type === 'survey' && game.state.cavernProgress[game.state.currentCavern]?.completed)
      : lm.id === 'guide' ? ['briefing', 'return'].includes(game.state.quest.stage) : lm.id === 'boss' ? game.state.quest.stage === 'boss' : !game.state.collected.includes(lm.id) && game.state.quest.stage !== 'briefing';
    if (mode === 'menu' || panelOpen || !active) { label.style.display = 'none'; continue; }
    screenVector.set(lm.position.x, lm.position.y + (lm.id === 'boss' ? 10 : 4.5), lm.position.z).project(camera);
    if (screenVector.z > 1 || screenVector.z < -1 || Math.abs(screenVector.x) > 0.94 || Math.abs(screenVector.y) > 0.8) { label.style.display = 'none'; continue; }
    label.style.display = 'flex'; label.style.left = `${(screenVector.x * 0.5 + 0.5) * innerWidth}px`; label.style.top = `${(-screenVector.y * 0.5 + 0.5) * innerHeight}px`;
    label.querySelector('small').textContent = `${Math.round(Math.hypot(player.x - lm.position.x, player.z - lm.position.z))} m`;
  }
}
function drawMinimap() {
  const map = document.querySelector('#minimap'); if (!map) return;
  const ctx = map.getContext('2d'); if (!ctx) return;
  const w = map.width, h = map.height, scale = w / 135, center = { x: w / 2, y: h / 2 };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a272bcc'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#285057'; ctx.lineWidth = 0.5;
  for (let i = -6; i < 7; i++) { const o = i * 15 * scale; ctx.beginPath(); ctx.moveTo(0, center.y + o); ctx.lineTo(w, center.y + o); ctx.stroke(); ctx.beginPath(); ctx.moveTo(center.x + o, 0); ctx.lineTo(center.x + o, h); ctx.stroke(); }
  const point = (x, z) => ({ x: center.x + (x - player.x) * scale, y: center.y + (z - player.z) * scale });
  ctx.strokeStyle = '#32858d'; ctx.lineWidth = 3;
  const river = world.map?.river || (game.state.currentCavern === 'luminous' ? Array.from({ length: 96 }, (_, i) => { const z = -95 + i * 2; return { x: -7 + Math.sin(z * 0.035) * 13, z }; }) : []);
  ctx.beginPath(); river.forEach((v, i) => { const p = point(v.x ?? v[0], v.z ?? v[1]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
  for (const lm of locations()) {
    if (game.state.collected.includes(lm.id)) continue;
    if (lm.type === 'discovery' && game.state.ownedSlugs.includes(lm.slugId)) continue;
    const p = point(lm.position.x, lm.position.z); ctx.fillStyle = `#${(lm.color || 0x9cedd7).toString(16).padStart(6, '0')}`;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.6, -2.6, 5.2, 5.2); ctx.restore();
  }
  for (const e of enemies) if (!e.dead) { const p = point(e.root.position.x, e.root.position.z); ctx.fillStyle = '#ef89bc'; ctx.beginPath(); ctx.arc(p.x, p.y, e.boss ? 4 : 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(-yaw); ctx.fillStyle = '#c8ffe9'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 5); ctx.lineTo(0, 2); ctx.lineTo(-4, 5); ctx.fill(); ctx.restore();
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#98beb9'; ctx.fillText('N', center.x - 3, 12);
}

game.subscribe((state, event) => {
  if (event.message && !['enemy-defeated'].includes(event.event)) ui.toast(event.message, event.type);
  if (event.event === 'enemy-defeated') ui.toast(event.message, 'success');
  ui.update(state);
});
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,textarea') || event.repeat && ['e', 'escape', 'q', 'c', 'r', 'k'].includes(event.key.toLowerCase())) return;
  const key = event.key.toLowerCase();
  if (mode === 'playing') {
    keys.add(key);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (key === ' ' && !event.repeat) jumpQueued = true;
    if (key === 'f' && !event.repeat) shoot();
    if (key === 'c') { focusToggled = !focusToggled; aiming = focusToggled || mouse.aiming; }
    if (key === 'e') interact();
    if (key === 'q') scan();
    if (key === 'r') { const result = useSkill('slug-fu'); if (!result.ok) ui.toast(result.message, 'info'); }
    if (key === 'k') openPanel('skills');
    if (['1', '2', '3'].includes(key)) { game.selectSlug(Number(key) - 1); refreshWeapon(); }
    if (key === 'j') openPanel('journal');
    if (key === 'm') openPanel('map');
    if (key === 'tab' || key === 'i') { event.preventDefault(); openPanel('inventory'); }
  }
  if (key === 'escape') {
    if (panelOpen) closePanel(); else if (mode === 'playing') openPanel('pause');
  }
});
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
const mouse = createMouseControls({
  element: canvas,
  isActive: () => mode === 'playing' && !panelOpen,
  isLocked: () => document.pointerLockElement === canvas,
  onFire: shoot,
  onAim: held => { aiming = held || focusToggled; },
  onLook: (x, y) => {
    const multiplier = aiming ? 0.0014 : 0.0021;
    yaw -= x * multiplier;
    pitch = THREE.MathUtils.clamp(pitch - y * multiplier, -1.35, 1.35);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  },
  sensitivity: () => game.state.settings.sensitivity,
  requestPointer,
});
document.addEventListener('pointerlockchange', () => {
  ui.setPointerLocked(Boolean(document.pointerLockElement));
  if (!document.pointerLockElement && mode === 'playing' && !panelOpen && !suppressUnlock) openPanel('pause');
});
let touchPoint = null;
canvas.addEventListener('touchstart', e => { if (mode === 'playing') touchPoint = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (mode !== 'playing' || !touchPoint) return;
  const t = e.touches[0]; yaw -= (t.clientX - touchPoint.x) * 0.005;
  pitch = THREE.MathUtils.clamp(pitch - (t.clientY - touchPoint.y) * 0.005, -1.35, 1.35);
  touchPoint = { x: t.clientX, y: t.clientY };
}, { passive: true });
canvas.addEventListener('touchend', () => { touchPoint = null; });
window.addEventListener('blur', () => { keys.clear(); focusToggled = false; mouse.reset(); if (mode === 'playing') openPanel('pause'); });
window.addEventListener('beforeunload', () => { if (mode !== 'menu') game.save(player); });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.2); elapsed += dt;
  world.update(elapsed, dt, player);
  if (mode === 'menu') {
    const drift = Math.sin(elapsed * 0.045) * 4;
    camera.position.set(43 + drift, 20 + Math.sin(elapsed * 0.12) * 0.8, 64 - drift * 0.25);
    camera.lookAt(-2, 5.5, -8);
  } else if (mode === 'playing' && !panelOpen) {
    simulationRemainder = Math.min(0.2, simulationRemainder + dt);
    while (simulationRemainder >= simulationStep) {
      game.tick(simulationStep); movePlayer(simulationStep); updateEnemies(simulationStep); updateProjectiles(simulationStep);
      simulationRemainder -= simulationStep;
    }
    updateView(dt); updateInteractions();
    lastSave += dt; if (lastSave > 8) { game.save(player); lastSave = 0; }
  }
  ranger.rotation.y = mode === 'menu' ? Math.PI : Math.atan2(player.x - ranger.position.x, player.z - ranger.position.z) + Math.PI;
  badge.rotation.y = elapsed;
  slugPets.forEach((pet, i) => { pet.position.y = world.groundHeight(pet.position.x, pet.position.z) + 0.33 + Math.sin(elapsed * 2.5 + i) * 0.055; pet.rotation.y = Math.sin(elapsed * 0.8 + i) * 0.5; });
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.life -= dt;
    const attr = b.points.geometry.attributes.position;
    for (let j = 0; j < b.speeds.length; j++) { const v = b.speeds[j]; v.y -= dt * 4; attr.setXYZ(j, attr.getX(j) + v.x * dt, attr.getY(j) + v.y * dt, attr.getZ(j) + v.z * dt); }
    attr.needsUpdate = true; b.points.material.opacity = Math.max(0, b.life / b.maxLife);
    if (b.life <= 0) { scene.remove(b.points); b.points.geometry.dispose(); b.points.material.dispose(); bursts.splice(i, 1); }
  }
  updateMarkers();
  lastUI += dt; if (lastUI > 0.1) { game.state.audio = audio.getStatus(); ui.update(game.state); drawMinimap(); lastUI = 0; }
  audio.update(dt);
  game.state.settings.quality === 'low' ? renderer.render(scene, camera) : composer.render();
}
applyAtmosphere();
ui.setMode('menu'); ui.update(game.state); frame();

// Development-only hooks let integration tests exercise real collision and rendering.
if (import.meta.env.DEV) {
  window.__SLUGTERRA__ = {
    game, player, enemies, camera, renderer, character, projectiles, combatStats, audio, launcher, blaster, mouse, colliders,
    get world() { return world; },
    get aiming() { return aiming; },
    get yaw() { return yaw; },
    get mode() { return mode; },
    get projectileCount() { return projectiles.length; },
    teleport(x, z) { player.set(x, world.groundHeight(x, z) + 1.85, z); character.reset(); camera.position.copy(player); updateInteractions(); },
    lookAt(x, y, z) { camera.lookAt(x, y, z); const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw = e.y; pitch = e.x; },
    shoot, interact, loadCavern, useSkill,
  };
}
