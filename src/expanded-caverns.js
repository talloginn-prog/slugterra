import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSlugModel } from './models.js';
import { SLUG_CATALOG } from './content.js';

/** Original expedition layouts for the canon-named Quiet Lawn and Snowdance.
 * Their geography, lift network, camps and rescue placements are game design. */
export function createExpandedCavern(THREE, { id, quality = 'high' }) {
  const ice = id === 'snowdance', group = new THREE.Group();
  group.name = ice ? 'Snowdance · the frozen amphitheatre' : 'Quiet Lawn · the green forge';
  const detail = quality === 'low' ? .5 : quality === 'medium' ? .75 : quality === 'ultra' ? 1.35 : 1;
  let seed = ice ? 510927 : 742918;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + random() * (b - a);
  const riverX = z => -12 + Math.sin(z * .045) * 5;
  const groundHeight = (x, z) => ice
    ? 2.8 + Math.sin(x * .038) * .9 + Math.cos(z * .046) * .7 + Math.max(0, -z - 20) * .055
    : 2.3 + Math.sin(x * .045) * 1.3 + Math.cos(z * .047) * .8 - Math.max(0, 1 - Math.abs(x - riverX(z)) / 4) * .55;
  const interactables = [], enemySpawns = [], colliders = [], animated = [], buckets = new Map();
  const local = (x, z) => ({ x, y: groundHeight(x, z), z });
  const mat = (color, glow = 0, intensity = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: intensity, roughness: .8, metalness: .03, ...extra });
  const rock = mat(ice ? 0x6b94b0 : 0x637265), dark = mat(ice ? 0x243e63 : 0x263e34);
  const pale = mat(ice ? 0xd7f0f3 : 0xb0a67c), timber = mat(0x514633), metal = mat(0x4b626b, 0, 0, { metalness: .7, roughness: .4 });
  const cyan = mat(0x91eae5, 0x4cded8, .8), amber = mat(0xffcf7d, 0xffa042, 1.5);
  // CPU-generated texture works in Node inspection and the offline edition.
  // Fine grain and ice seams supply close-up surface detail without downloads.
  function grainTexture(frozen = false, repeat = 3) {
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let n = (Math.imul(x + 41, 374761393) ^ Math.imul(y + 79, 668265263)) >>> 0; n = Math.imul(n ^ n >>> 13, 1274126177) >>> 0;
      const seam = frozen && Math.abs(Math.sin(x * .067 + Math.sin(y * .049) * 1.9)) < .035;
      const value = Math.max(120, 216 + (n & 31) - (seam ? 52 : 0) + Math.sin(y * .42 + Math.sin(x * .11)) * 7);
      const at = (y * size + x) * 4; data[at] = data[at + 1] = data[at + 2] = value; data[at + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.needsUpdate = true; return texture;
  }
  const stoneGrain = grainTexture(ice), floorGrain = grainTexture(ice, 32);
  for (const material of [rock, dark, pale, timber]) { material.map = stoneGrain; material.bumpMap = stoneGrain; material.bumpScale = ice ? .07 : .15; }
  const dummy = new THREE.Object3D();
  function mesh(geometry, material, x = 0, y = 0, z = 0, solid = true, parent = group) {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z);
    object.userData.collisionSolid = solid; object.castShadow = solid; object.receiveShadow = true; parent.add(object); return object;
  }
  function structure(geometry, material, x, y, z, scale = null, rotation = null) {
    if (geometry.index) { const next = geometry.toNonIndexed(); geometry.dispose(); geometry = next; }
    dummy.position.set(x, y, z); dummy.scale.set(scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1); dummy.rotation.set(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0); dummy.updateMatrix(); geometry.applyMatrix4(dummy.matrix);
    const list = buckets.get(material) || []; list.push(geometry); buckets.set(material, list);
  }
  function batch(geometry, material, values, solid) {
    const object = new THREE.InstancedMesh(geometry, material, values.length); object.userData.collisionSolid = solid;
    values.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.rotation.set(v.rx || 0, v.ry || 0, v.rz || 0); dummy.scale.set(v.sx || 1, v.sy || 1, v.sz || 1); dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix); if (v.color !== undefined) object.setColorAt(i, new THREE.Color(v.color)); });
    object.instanceMatrix.needsUpdate = true; object.castShadow = solid; object.receiveShadow = true; group.add(object); return object;
  }
  function tube(points, radius, material, solid = true) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    if (solid) structure(new THREE.TubeGeometry(curve, 22, radius, 7, false), material, 0, 0, 0);
    else mesh(new THREE.TubeGeometry(curve, 16, radius, 5, false), material, 0, 0, 0, false);
  }
  const paths = [[0, 38], [0, 28], [0, 10], [-22, -12], [-28, -40], [0, -47], [20, -8], [35, 25], [0, 28]];
  const pathDistance = (x, z) => Math.min(...paths.slice(1).map((p, i) => { const a = paths[i], dx = p[0] - a[0], dz = p[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); }));
  const anchors = [[0, 28, 13], [0, 38, 6], [35, 25, 7], [-22, -12, 11], [20, -8, 11], [-28, -40, 12], [0, -47, 16]];
  const reserved = (x, z, margin = 0) => pathDistance(x, z) < 3.4 + margin || anchors.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + margin);
  const floor = new THREE.PlaneGeometry(210, 210, quality === 'low' ? 112 : 168, quality === 'low' ? 112 : 168); floor.rotateX(-Math.PI / 2);
  const positions = floor.attributes.position, colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), onPath = pathDistance(x, z) < 2.7;
    positions.setY(i, groundHeight(x, z));
    const tint = new THREE.Color(ice ? onPath ? 0x7aafc5 : 0xc1dce1 : onPath ? 0x92926a : 0x46705b);
    tint.multiplyScalar(.94 + Math.sin(x * .55 + z * .2) * Math.cos(z * .4) * .06); colors.push(tint.r, tint.g, tint.b);
  }
  floor.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); floor.computeVertexNormals();
  mesh(floor, mat(0xffffff, 0, 0, { vertexColors: true, roughness: ice ? .62 : .95, map: floorGrain, bumpMap: floorGrain, bumpScale: ice ? .045 : .12 }), 0, 0, 0, false);
  const roof = mesh(new THREE.SphereGeometry(135, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), mat(ice ? 0x3b5c87 : 0x314c40, 0, 0, { side: THREE.BackSide }), 0, 24, 0); roof.scale.y = .44;
  const walls = [], hanging = [], formations = [], crown = [], undergrowth = [];
  for (let i = 0; i < 52; i++) {
    const angle = i / 52 * Math.PI * 2, radius = range(103, 111), height = range(25, 44);
    walls.push({ x: Math.sin(angle) * radius, y: height / 2 + 2, z: Math.cos(angle) * radius, sx: range(12, 18), sy: height, sz: range(10, 16), ry: angle });
  }
  batch(new THREE.DodecahedronGeometry(1, 0), dark, walls, true);
  // Fixed structural stream: quality only changes decorative populations.
  for (let i = 0; i < 60; i++) {
    const x = range(-86, 86), z = range(-82, 78); if (reserved(x, z, 2)) continue;
    const height = range(ice ? 4 : 12, ice ? 16 : 28), width = range(1.1, ice ? 3.2 : 2.1), y = groundHeight(x, z);
    formations.push({ x, y: y + height / 2, z, sx: width, sy: height, sz: width, ry: range(0, 6.28), rz: range(-.08, .08) });
    colliders.push({ x, z, radius: width * .9, bottom: y, top: y + height });
    if (ice) crown.push({ x, y: y + height - .1, z, sx: width * 1.05, sy: .35, sz: width * 1.05 });
    else for (let k = 0; k < 3; k++) crown.push({ x: x + Math.sin(k * 2.1) * 3, y: y + height - k * 1.3, z: z + Math.cos(k * 2.1) * 3, sx: 5 + k * .8, sy: 2.4, sz: 4.5 + k * .7, ry: k, color: [0x50734c, 0x789157, 0x416c54][k] });
  }
  batch(ice ? new THREE.CylinderGeometry(.15, 1, 1, 6, 3) : new THREE.CylinderGeometry(.55, 1, 1, 9, 3), ice ? rock : timber, formations, true);
  batch(ice ? new THREE.DodecahedronGeometry(1, 0) : new THREE.SphereGeometry(1, 12, 7), ice ? pale : mat(0xffffff, 0x143e24, .12), crown, ice);
  for (let i = 0; i < 45; i++) { const x = range(-85, 85), z = range(-82, 78), height = range(3, 9); hanging.push({ x, y: 58 - Math.hypot(x, z) * .09, z, sx: range(.5, 1.4), sy: height, sz: range(.5, 1.5), rx: Math.PI }); }
  batch(new THREE.ConeGeometry(1, 1, 7), ice ? pale : rock, hanging, true);
  // A looped ice arch versus an organic canopy establishes different skylines.
  for (const side of [-1, 1]) {
    const x = side * 42, z = -32, y = groundHeight(x, z);
    tube([[x, y, z], [x - side * 3, y + 15, z], [x - side * 10, y + 23, z - 5], [x - side * 18, y + 14, z - 7]], ice ? 1.8 : 1.3, ice ? rock : timber);
    if (!ice) for (let k = 0; k < 7; k++) tube([[x - side * 9, y + 20, z - 3], [x - side * (9 + k * .5), y + 14, z - 3 + k], [x - side * (10 + k * .4), y + 9, z - 2 + k]], .035, mat(0x73b38a, 0x2a724d, .15), false);
  }
  const water = new THREE.PlaneGeometry(5.5, 190, 3, 112); water.rotateX(-Math.PI / 2);
  for (let i = 0; i < water.attributes.position.count; i++) { const z = water.attributes.position.getZ(i), x = water.attributes.position.getX(i) + riverX(z); water.attributes.position.setXYZ(i, x, groundHeight(x, z) + .07, z); }
  water.computeVertexNormals(); mesh(water, mat(ice ? 0x8dcad9 : 0x3f9d95, ice ? 0x4185ae : 0x1e6d60, .22, { roughness: .16, metalness: .45, transparent: true, opacity: ice ? .7 : .75, side: THREE.DoubleSide }), 0, 0, 0, false);
  // Warm, working forge buildings in Quiet Lawn. Snowdance has a sheltered
  // expedition projection screen, an original nod to the episode's drive-in.
  if (ice) {
    const shimmerMaterial = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 } }, vertexShader: 'varying vec2 shimmerUv; void main(){shimmerUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec2 shimmerUv;uniform float time;void main(){float wave=sin(shimmerUv.x*32.0+sin(shimmerUv.x*9.0+time*.15)*2.0+shimmerUv.y*5.0);float edge=sin(shimmerUv.y*3.14159)*sin(shimmerUv.x*3.14159);vec3 tint=mix(vec3(.22,.48,.82),vec3(.36,.9,.76),shimmerUv.y);gl_FragColor=vec4(tint,pow(max(0.0,wave),3.0)*edge*.13);}' });
    const curtain = mesh(new THREE.PlaneGeometry(104, 13, 48, 5), shimmerMaterial, 0, 34, -59, false); curtain.rotation.y = -.16;
    animated.push(time => { shimmerMaterial.uniforms.time.value = time; });
    const y = groundHeight(0, -53);
    for (const x of [-10, 10]) structure(new THREE.CylinderGeometry(.5, .8, 12, 8), metal, x, y + 6, -53);
    structure(new THREE.BoxGeometry(22, .7, 1), metal, 0, y + 12, -53);
    structure(new THREE.BoxGeometry(20.5, 9, .45), dark, 0, y + 7.2, -53);
    const screen = mesh(new THREE.PlaneGeometry(19.2, 7.8), mat(0x8fd1e7, 0x2779a4, .65, { side: THREE.DoubleSide, roughness: .4 }), 0, y + 7.3, -52.7, false);
    for (let k = 0; k < 3; k++) mesh(new THREE.TorusGeometry(1.4 + k * .65, .035, 4, 48), cyan, 0, y + 7.3, -52.4 + k * .01, false);
    animated.push(time => { screen.material.emissiveIntensity = .55 + Math.sin(time * .45) * .1; });
    for (const x of [-28, 28]) for (let k = 0; k < 3; k++) structure(new THREE.BoxGeometry(7, .45, 1.1), pale, x, groundHeight(x, -31 + k * 4) + .7, -31 + k * 4);
  } else {
    for (const [x, z] of [[-31, -20], [25, -38]]) {
      const shaft = mesh(new THREE.CylinderGeometry(.35, 6.8, 36, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe6ab, transparent: true, opacity: .032, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), x, 23, z, false); shaft.rotation.z = .12;
    }
    for (const [x, z] of [[-39, 17], [40, 3], [49, 27]]) {
      const y = groundHeight(x, z);
      for (const s of [-1, 1]) for (const f of [-1, 1]) structure(new THREE.CylinderGeometry(.22, .29, 5, 7), timber, x + s * 3.1, y + 2.5, z + f * 2.3);
      structure(new THREE.BoxGeometry(7.5, .35, 5.7), timber, x, y + 5, z, null, { z: .04 });
      structure(new THREE.BoxGeometry(5.2, 1, 1.6), rock, x, y + .8, z - 1.8);
      structure(new THREE.CylinderGeometry(.8, 1, 2.3, 7), dark, x + 1.8, y + 1.2, z);
      mesh(new THREE.SphereGeometry(.42, 10, 8), amber, x + 1.8, y + 1.7, z - .7, false);
      const light = new THREE.PointLight(0xffa45a, 9, 16, 2); light.position.set(x, y + 2.7, z); group.add(light);
    }
  }
  function platform(x, z, radius = 2.5) { const y = groundHeight(x, z); structure(new THREE.CylinderGeometry(radius, radius + .15, .25, 12), rock, x, y + .02, z); return y; }
  function gate(target, x, z, name) {
    const y = platform(x, z, 2.7);
    const arch = mesh(new THREE.TorusGeometry(2.15, .29, 8, 40, Math.PI * 1.73), metal, x, y + 2.4, z); arch.rotation.z = -Math.PI * .365;
    for (const s of [-1, 1]) structure(new THREE.BoxGeometry(.48, 2.7, .7), metal, x + s * 1.75, y + 1.3, z);
    const veil = mesh(new THREE.CircleGeometry(1.85, 36), new THREE.MeshBasicMaterial({ color: ice ? 0x9cecff : 0xa8e4a0, transparent: true, opacity: .08, side: THREE.DoubleSide, depthWrite: false }), x, y + 2.4, z + .05, false);
    animated.push(time => { veil.material.opacity = .08 + Math.sin(time * 1.4) * .025; });
    interactables.push({ id: `gate-${target}`, type: 'portal', target, name, position: local(x, z), color: 0x9ce7dd, description: 'Take the expedition lift to the connected cavern.' });
  }
  gate(ice ? 'pyrite' : 'dark-spores', 0, 38, ice ? 'Lift to Pyrite' : 'Lift to Dark Spores');
  gate(ice ? 'quiet-lawn' : 'snowdance', 35, 25, ice ? 'Lift to Quiet Lawn' : 'Lift to Snowdance');
  const checkY = platform(0, 23, 1.7); structure(new THREE.CylinderGeometry(.28, .42, 2.5, 8), metal, 0, checkY + 1.25, 23);
  const beacon = mesh(new THREE.OctahedronGeometry(.42), amber, 0, checkY + 2.9, 23, false); animated.push(time => { beacon.rotation.y = time * .5; });
  interactables.push({ id: `checkpoint-${id}`, type: 'checkpoint', name: 'Expedition checkpoint', position: local(0, 23), color: 0xffca85, description: 'Rest and record this expedition return point.' });
  const npcY = groundHeight(7, 27), npc = new THREE.Group(); npc.position.set(7, npcY, 27); group.add(npc);
  mesh(new THREE.CapsuleGeometry(.28, .8, 4, 8), mat(ice ? 0x7772a1 : 0x5c7661), 0, 1.05, 0, true, npc);
  mesh(new THREE.SphereGeometry(.24, 12, 8), mat(0xdfb58b), 0, 1.86, 0, true, npc);
  for (const s of [-1, 1]) { mesh(new THREE.CapsuleGeometry(.10, .6, 3, 7), dark, s * .15, .4, 0, true, npc); mesh(new THREE.CapsuleGeometry(.09, .5, 3, 7), pale, s * .38, 1.1, 0, true, npc); }
  interactables.push({ id: `npc-${id}-expedition`, type: 'npc', role: 'expedition', name: ice ? 'Neri · Iceway keeper' : 'Caro · Forge scout', position: local(7, 27), color: 0xffca85, description: ice ? 'The old projection screen gives this expedition its landmark. Clear the scouting party and survey the frozen amphitheatre. The rescued Rammstone waits by the ice ridge.' : 'Follow the meadow trail past the green forge. Meet two new companions, then survey the old watchpost. These expeditions and rescue placements are original game design.' });
  function discovery(slugId, x, z, name) {
    const spec = SLUG_CATALOG[slugId]; if (!spec) return;
    const y = platform(x, z, 1.5); mesh(new THREE.CylinderGeometry(.7, 1.1, .9, 8), dark, x, y + .48, z);
    const display = new THREE.Group(); display.name = `Companion discovery ${slugId}`; group.add(display);
    const companion = createSlugModel(THREE, spec, { scale: .85 }); companion.position.set(x, y + 1.1, z); display.add(companion);
    const beam = mesh(new THREE.CylinderGeometry(.035, .18, 5, 8, 1, true), new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }), x, y + 3, z, false, display);
    animated.push(time => { companion.position.y = y + 1.12 + Math.sin(time * 2.2) * .08; companion.rotation.y = Math.sin(time * .7) * .3; });
    interactables.push({ id: `discovery-${slugId}`, type: 'discovery', slugId, name, position: local(x, z), color: new THREE.Color(spec.color).getHex(), object: display, beam, description: `An expedition rescue: invite this ${spec.species} into your collection. Placement is original game design.` });
  }
  if (ice) discovery('rammstone', 20, -8, 'A Rammstone by the ice ridge');
  else { discovery('arachnet', -22, -12, 'Arachnet at the silken thicket'); discovery('fandango', 20, -8, 'Fandango in the meadow'); }
  const surveyX = ice ? 0 : -28, surveyZ = ice ? -47 : -40, surveyY = platform(surveyX, surveyZ, 2.4);
  structure(new THREE.BoxGeometry(1.2, .8, .7), metal, surveyX, surveyY + .65, surveyZ);
  const core = mesh(new THREE.OctahedronGeometry(.42), cyan, surveyX, surveyY + 1.9, surveyZ, false); animated.push(time => { core.rotation.y = time * .5; });
  interactables.push({ id: `survey-${id}`, type: 'survey', name: ice ? 'The frozen amphitheatre survey' : 'The green forge survey', position: local(surveyX, surveyZ), color: 0x9ce7dd, description: 'Record this expedition survey after clearing the outlaw patrol.' });
  const camps = ice ? [[15, -14, 'discovery-rammstone'], [26, -13, 'discovery-rammstone'], [-6, -43, `survey-${id}`], [6, -44, `survey-${id}`]] : [[-27, -17, 'discovery-arachnet'], [23, -13, 'discovery-fandango'], [-33, -45, `survey-${id}`], [-21, -44, `survey-${id}`]];
  camps.forEach(([x, z, camp], i) => enemySpawns.push({ id: `${id}-outlaw-${i + 1}`, x, z, boss: false, camp }));
  // Separate decorative seed keeps all solid geometry identical across quality.
  let decorSeed = ice ? 721034 : 581287;
  const dr = () => { decorSeed = (Math.imul(decorSeed, 1664525) + 1013904223) >>> 0; return decorSeed / 4294967296; };
  for (let i = 0; i < Math.floor((ice ? 220 : 1200) * detail); i++) { const x = -86 + dr() * 172, z = -82 + dr() * 160; if (pathDistance(x, z) < 2.4) continue; const s = .2 + dr() * .7; undergrowth.push({ x, y: groundHeight(x, z) + s * .28, z, sx: s, sy: s * (ice ? .5 : 1.3), sz: s, ry: dr() * 6.28, color: ice ? [0xb5d8ed, 0xe8f5ed][i % 2] : [0x71a86e, 0x5e986e, 0xb2bd72, 0x8baf8c][i % 4] }); }
  batch(ice ? new THREE.OctahedronGeometry(1) : new THREE.ConeGeometry(.48, 1, 5), mat(0xffffff, ice ? 0x3d7092 : 0x2d542a, .16), undergrowth, false);
  const moteGeo = new THREE.BufferGeometry(), motePositions = [], moteSeeds = [];
  for (let i = 0; i < Math.floor((ice ? 260 : 150) * detail); i++) { const p = { x: -80 + dr() * 160, y: 4 + dr() * 28, z: -78 + dr() * 150, phase: dr() * 6.28 }; moteSeeds.push(p); motePositions.push(p.x, p.y, p.z); }
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3)); group.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: ice ? 0xd0efff : 0xf2e9b1, size: ice ? .12 : .08, transparent: true, opacity: .6, depthWrite: false })));
  animated.push(time => { const a = moteGeo.attributes.position; moteSeeds.forEach((p, i) => a.setXYZ(i, p.x + Math.sin(time * .15 + p.phase), ice ? 3 + (p.y - time * .45 + 1200) % 28 : p.y + Math.sin(time * .2 + p.phase) * .6, p.z + Math.cos(time * .12 + p.phase))); a.needsUpdate = true; });
  for (const [material, geometries] of buckets) { const merged = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose()); if (merged) { const m = mesh(merged, material); m.name = 'Solid expedition structure'; } }
  return {
    id, quality, group, groundHeight, spawn: { x: 0, z: 28 }, bounds: 88, landmarks: [], interactables, enemySpawns, colliders, collisionReady: true,
    atmosphere: ice ? { background: 0x203854, fog: 0x426182, density: .0065, key: 0xd1edf8, fill: 0x6ca8ec, ambient: 0xc9e5f1, ground: 0x30435f, exposure: 1.15 } : { background: 0x23382f, fog: 0x3c5c47, density: .0065, key: 0xffe1a8, fill: 0x86c6b1, ambient: 0xc6dfb9, ground: 0x3b4933, exposure: 1.2 },
    map: { kind: ice ? 'snowdance' : 'quiet-lawn', river: Array.from({ length: 69 }, (_, i) => ({ x: riverX(-102 + i * 3), z: -102 + i * 3 })), paths: [paths.map(([x, z]) => ({ x, z }))] },
    update(time, dt, player) { animated.forEach(update => update(time, dt, player)); },
    dispose() { const seen = new Set(); group.traverse(object => { if (object.isInstancedMesh) object.dispose(); if (object.geometry && !seen.has(object.geometry)) { seen.add(object.geometry); object.geometry.dispose(); } for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if (material && !seen.has(material)) { seen.add(material); for (const value of Object.values(material)) if (value?.isTexture && !seen.has(value)) { seen.add(value); value.dispose(); } material.dispose(); } }); group.removeFromParent(); },
  };
}
