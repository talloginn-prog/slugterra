import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWorld } from './world.js';
import { createSlugModel } from './models.js';
import { SLUG_CATALOG } from './content.js';

/*
 * These are original playable expedition layouts, informed by the inspected
 * Dark Spores/Pyrite series stills. They are not a claimed canonical world map.
 * The original Luminous Deep remains its own, unchanged seeded expedition.
 */
export function createCavern(THREE, { id = 'luminous', quality = 'high' } = {}) {
  const legacy = id === 'luminous' || !['dark-spores', 'pyrite'].includes(id);
  if (legacy) id = 'luminous';
  const forest = id === 'dark-spores';
  const detail = quality === 'ultra' ? 1.35 : quality === 'low' ? 0.55 : quality === 'medium' ? 0.8 : 1;
  const original = legacy ? createWorld(THREE) : null;
  const group = original?.group || new THREE.Group();
  group.name = legacy ? 'The Luminous Deep' : forest ? 'Dark Spores · expedition' : 'Pyrite · expedition';
  let seed = forest ? 928473 : legacy ? 120481 : 612988;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * random();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const riverX = z => forest ? -11 + Math.sin(z * 0.041) * 7 : -8 + Math.sin(z * 0.033) * 8;
  const groundHeight = original?.groundHeight || (forest
    ? (x, z) => 2 + Math.sin(x * 0.049) * 1.2 + Math.cos(z * 0.044) * 1.15 + Math.sin(x * 0.095 + z * 0.051) * 0.34 + 2.2 * Math.exp(-((x + 32) ** 2 + (z + 31) ** 2) / 460) - Math.max(0, 1 - Math.abs(x - riverX(z)) / 4.4) * 0.9
    : (x, z) => 1.5 + Math.sin(x * 0.045) * 0.38 + Math.cos(z * 0.038) * 0.45 + smooth(0, 64, -z + 3) * 8.6 + smooth(16, 63, -x) * 3.6 - Math.max(0, 1 - Math.abs(x - riverX(z)) / 4) * 0.55);
  const colliders = [];
  const interactables = [];
  const enemySpawns = [];
  const landmarks = original?.landmarks || [];
  const animated = [], particles = [], waving = [];
  const staticGroups = new Map();
  const local = (x, z, y = 0) => ({ x, y: groundHeight(x, z) + y, z });
  const color = value => new THREE.Color(value);
  const material = (hex, glow = 0, strength = 0, options = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.84, metalness: 0.04, emissive: glow, emissiveIntensity: strength, ...options });
  const stone = material(legacy ? 0x233c46 : forest ? 0x24363d : 0x344f79);
  const darkStone = material(legacy ? 0x142b34 : forest ? 0x182532 : 0x1b304d);
  const paleStone = material(forest ? 0x59665f : 0x6f86a2);
  const bark = material(0x192b37);
  const metal = material(0x455864, 0, 0, { roughness: 0.42, metalness: 0.66 });
  const amber = material(0xf7c37e, 0xffa34e, 1.8);
  const cyan = material(0x6fe5df, 0x38dacc, 1.4);
  const leaf = material(0xffffff, forest ? 0x174c53 : 0x342846, 0.2, { side: THREE.DoubleSide, roughness: 0.9 });
  const dummy = new THREE.Object3D();

  function texture(kind) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const pixels = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      let n = (Math.imul(x + 317, 374761393) ^ Math.imul(y + 173, 668265263)) >>> 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
      const grain = (n & 255) / 255, u = x / 256 * Math.PI * 2, v = y / 256 * Math.PI * 2;
      const strata = kind === 'rock' ? Math.sin(v * 12 + Math.sin(u * 3) * 1.4) : kind === 'bark' ? Math.sin(u * 22 + Math.sin(v * 3)) : Math.sin(u * 5 + Math.sin(v * 7)) * Math.cos(v * 4);
      const value = clamp(211 + grain * 23 + strata * 19 - (grain < 0.04 ? 34 : 0), 140, 255);
      const index = (y * 256 + x) * 4;
      pixels.data[index] = value; pixels.data[index + 1] = value; pixels.data[index + 2] = value; pixels.data[index + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace; result.wrapS = result.wrapT = THREE.RepeatWrapping; result.anisotropy = quality === 'ultra' ? 8 : 4;
    return result;
  }
  const rockTexture = texture('rock'), barkTexture = texture('bark');
  if (rockTexture) { stone.map = rockTexture; stone.bumpMap = rockTexture; stone.bumpScale = 0.22; darkStone.map = rockTexture; darkStone.bumpMap = rockTexture; darkStone.bumpScale = 0.28; }
  if (barkTexture) { bark.map = barkTexture; bark.bumpMap = barkTexture; bark.bumpScale = 0.3; }

  function mesh(geometry, mat, x = 0, y = 0, z = 0, parent = group) {
    const object = new THREE.Mesh(geometry, mat); object.position.set(x, y, z);
    object.receiveShadow = true; parent.add(object); return object;
  }
  function staticMesh(geometry, mat, x = 0, y = 0, z = 0, scale = null, rotation = null) {
    if (geometry.index) { const nonIndexed = geometry.toNonIndexed(); geometry.dispose(); geometry = nonIndexed; }
    dummy.position.set(x, y, z); dummy.scale.set(scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1); dummy.rotation.set(rotation?.x || 0, rotation?.y || 0, rotation?.z || 0); dummy.updateMatrix();
    geometry.applyMatrix4(dummy.matrix);
    if (!staticGroups.has(mat)) staticGroups.set(mat, []);
    staticGroups.get(mat).push(geometry);
  }
  function batch(geometry, mat, values) {
    if (!values.length) { geometry.dispose(); return null; }
    const object = new THREE.InstancedMesh(geometry, mat, values.length);
    values.forEach((v, index) => {
      dummy.position.set(v.x, v.y, v.z); dummy.scale.set(v.sx ?? 1, v.sy ?? 1, v.sz ?? 1); dummy.rotation.set(v.rx || 0, v.ry || 0, v.rz || 0); dummy.updateMatrix(); object.setMatrixAt(index, dummy.matrix);
      if (v.color !== undefined) object.setColorAt(index, color(v.color));
    });
    object.instanceMatrix.needsUpdate = true; object.receiveShadow = true; group.add(object); return object;
  }
  function tube(points, radius, mat, segments = 20) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    staticMesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), mat);
  }
  function obstacle(x, z, radius, height, bottom = groundHeight(x, z)) { colliders.push({ x, z, radius, bottom, top: bottom + height }); }

  // A continuous underside, overlapping wall masses and hanging geology make
  // the playable space a cavern, including when the camera points straight up.
  const roofMaterial = material(legacy ? 0x213843 : forest ? 0x303447 : 0x334a65, 0, 0, { side: THREE.BackSide });
  roofMaterial.map = rockTexture; roofMaterial.bumpMap = rockTexture; roofMaterial.bumpScale = 0.38;
  const roof = mesh(new THREE.SphereGeometry(137, quality === 'low' ? 36 : 48, quality === 'low' ? 16 : 22, 0, Math.PI * 2, 0, Math.PI / 2), roofMaterial, 0, 21, 0);
  roof.scale.y = legacy ? 0.42 : 0.47;
  const wallMasses = [], hanging = [], roofRibs = [];
  for (let i = 0; i < 56; i++) {
    const a = i / 56 * Math.PI * 2, r = range(101, 112), h = range(26, 49);
    wallMasses.push({ x: Math.sin(a) * r, y: h * 0.45 + 3, z: Math.cos(a) * r, sx: range(13, 22), sy: h, sz: range(10, 18), ry: a, color: forest ? [0x202c3c, 0x293545, 0x303c4b][i % 3] : [0x263c58, 0x2f4868, 0x304560][i % 3] });
  }
  for (let i = 0; i < Math.floor(88 * detail); i++) {
    const a = range(0, Math.PI * 2), r = range(32, 108), length = range(5, 19);
    hanging.push({ x: Math.sin(a) * r, y: 65 - r * 0.17 - length / 2, z: Math.cos(a) * r, sx: range(0.7, 3.2), sy: length, sz: range(0.7, 3), rx: Math.PI, rz: range(-0.12, 0.12), color: i % 5 === 0 ? 0x40515f : 0x263747 });
  }
  batch(new THREE.DodecahedronGeometry(1, 1), darkStone, wallMasses);
  // Irregular tapered columns replace uniform cone teeth.
  const stalactite = new THREE.CylinderGeometry(0.10, 1, 1, 7, 5);
  const stalactitePositions = stalactite.attributes.position;
  for (let i = 0; i < stalactitePositions.count; i++) {
    const x = stalactitePositions.getX(i), y = stalactitePositions.getY(i), z = stalactitePositions.getZ(i);
    const wobble = Math.sin(y * 14 + Math.atan2(z, x) * 3) * 0.11;
    stalactitePositions.setXYZ(i, x * (1 + wobble), y, z * (1 + wobble));
  }
  stalactite.computeVertexNormals();
  batch(stalactite, stone, hanging);
  for (const z of [-86, -45, 10, 62]) {
    const points = [[-109, 33, z], [-76, 52, z - 6], [-35, 69, z - 13], [12, 72, z - 5], [67, 59, z + 5], [112, 30, z + 7]];
    tube(points, legacy ? 5.1 : 6.3, darkStone, 26);
  }

  const routePoints = forest
    ? [[0, 38], [0, 28], [0, 14], [-9, 3], [-22, -12], [-30, -38], [2, -48], [29, -29], [35, 25], [0, 28]]
    : [[0, 38], [0, 28], [0, 12], [20, -8], [35, -35], [-2, -49], [-28, -40], [-29, -4], [0, 12], [35, 25]];
  function distanceSegment(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
  }
  const pathDistance = (x, z) => Math.min(...routePoints.slice(1).map((p, i) => distanceSegment(x, z, routePoints[i], p)));
  const clearings = [[0, 28, 12], [35, 25, 8], [-22, -12, 10], [20, -8, 10], [-30, -38, 11], [35, -35, 10], [-28, -40, 9]];
  const reserved = (x, z, margin = 0) => pathDistance(x, z) < 3.1 + margin || clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + margin);

  if (!legacy) {
    const terrainSegments = quality === 'low' ? 132 : quality === 'ultra' ? 208 : 176;
    const terrain = new THREE.PlaneGeometry(210, 210, terrainSegments, terrainSegments); terrain.rotateX(-Math.PI / 2);
    const position = terrain.attributes.position, terrainColors = [];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i), h = groundHeight(x, z); position.setY(i, h);
      const path = pathDistance(x, z), speckle = Math.sin(x * 1.33 + z * 0.93) * Math.cos(x * 0.74 - z * 1.19);
      const tone = color(forest ? path < 2.8 ? 0x507170 : 0x234e50 : path < 3 ? 0x6b7a8e : 0x3a557a);
      tone.multiplyScalar(0.91 + speckle * 0.08 + Math.sin(x * 0.057 + z * 0.021) * 0.07 + Math.cos(z * 0.044 - x * 0.018) * 0.055); terrainColors.push(tone.r, tone.g, tone.b);
    }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3)); terrain.computeVertexNormals();
    const floorTexture = texture(forest ? 'moss' : 'ground-stone'); if (floorTexture) floorTexture.repeat.set(forest ? 19 : 13, forest ? 19 : 13);
    mesh(terrain, material(0xffffff, 0, 0, { vertexColors: true, map: floorTexture, bumpMap: floorTexture, bumpScale: forest ? 0.12 : 0.075, roughness: 0.95 }));
    const streamGeometry = new THREE.PlaneGeometry(forest ? 5.4 : 6.5, 200, 5, 144); streamGeometry.rotateX(-Math.PI / 2);
    const wp = streamGeometry.attributes.position;
    for (let i = 0; i < wp.count; i++) { const z = wp.getZ(i), x = wp.getX(i) + riverX(z); wp.setXYZ(i, x, groundHeight(x, z) + 0.1, z); }
    streamGeometry.computeVertexNormals();
    const streamMat = material(forest ? 0x1b8186 : 0x4596c2, forest ? 0x155b65 : 0x1d5d8a, 0.24, { metalness: 0.65, roughness: 0.19, transparent: true, opacity: 0.77, side: THREE.DoubleSide });
    const stream = mesh(streamGeometry, streamMat); stream.renderOrder = 1;
    animated.push(time => { streamMat.emissiveIntensity = 0.25 + Math.sin(time * 0.7) * 0.035; });
  }

  if (forest) {
    // Collidable trees use their own fixed stream. Quality changes ornamental
    // density and tessellation without moving trunks around an existing save.
    seed = 928473;
    const trunks = [], caps = [], undercaps = [], redRims = [], gills = [], spots = [], roots = [];
    const treeLocations = [[-18, 39, 29, 7], [20, 38, 30, 7.5], [-29, 17, 38, 9], [29, 4, 37, 9], [-43, -10, 44, 11], [49, -25, 46, 12], [-55, -45, 48, 12], [11, -67, 49, 13], [-4, -23, 34, 8], [48, 47, 39, 10], [-50, 49, 42, 11], [65, 5, 45, 12]];
    for (let i = 0; i < 45; i++) {
      const x = range(-87, 87), z = range(-84, 76); if (reserved(x, z, 0.8)) continue;
      treeLocations.push([x, z, range(9, 24), range(3.2, 6.4)]);
    }
    for (let i = 0; i < treeLocations.length; i++) {
      const [x, z, h, radius] = treeLocations[i], y = groundHeight(x, z), thickness = radius * 0.23;
      trunks.push({ x, y: y + h * 0.5, z, sx: thickness, sy: h, sz: thickness, rz: Math.sin(i * 1.8) * 0.045 });
      obstacle(x, z, thickness * 0.95, h);
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * Math.PI * 2 + i, bx = x + Math.sin(a) * radius * 0.8, bz = z + Math.cos(a) * radius * 0.8, level = h * (0.65 + k * 0.12);
        tube([[x, y + level - 7, z], [x + Math.sin(a) * radius * 0.36, y + level - 2, z + Math.cos(a) * radius * 0.36], [bx, y + level, bz]], thickness * 0.47, bark, 13);
        caps.push({ x: bx, y: y + level, z: bz, sx: radius, sy: radius * 0.22, sz: radius * 0.89, ry: a, color: [0x815560, 0x694f65, 0x8a5c60][(i + k) % 3] });
        undercaps.push({ x: bx, y: y + level - 0.08, z: bz, sx: radius * 0.96, sy: radius * 0.13, sz: radius * 0.85, ry: a, color: [0x5bb7b9, 0x328f99, 0x78bfb5][(i + k) % 3] });
        redRims.push({ x: bx, y: y + level + 0.1, z: bz, sx: radius * 0.985, sy: radius * 0.88, sz: 1, rx: -Math.PI / 2, ry: 0, rz: a });
        for (let s = 0; s < 6; s++) { const angle = s / 6 * Math.PI * 2, rr = radius * range(0.25, 0.7); spots.push({ x: bx + Math.cos(angle) * rr, y: y + level + radius * 0.22 * Math.sqrt(1 - (rr / radius) ** 2), z: bz + Math.sin(angle) * rr * 0.89, sx: range(0.07, 0.15), sy: 0.025, sz: range(0.1, 0.22) }); }
      }
      if (h > 28) for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + i, dx = Math.sin(a), dz = Math.cos(a), length = radius * 1.25;
        tube([[x, y + 5, z], [x + dx * length * 0.4, y + 1.5, z + dz * length * 0.4], [x + dx * length, groundHeight(x + dx * length, z + dz * length) - 0.15, z + dz * length]], thickness * 0.33, bark, 15);
      }
    }
    batch(new THREE.CylinderGeometry(0.19, 1.15, 1, quality === 'low' ? 8 : 10, quality === 'low' ? 3 : 4), bark, trunks);
    const capMat = material(0xffffff, 0x15202d, 0.06); if (barkTexture) capMat.map = barkTexture;
    batch(new THREE.SphereGeometry(1, quality === 'low' ? 14 : 22, quality === 'low' ? 7 : 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat, caps);
    let gillTexture = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const data = ctx.createImageData(256, 128);
        for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
          const u = x / 256 * Math.PI * 2, v = y / 128;
          const ridge = Math.pow((Math.sin(u * 58 + Math.sin(v * 11) * 0.7) + 1) * 0.5, 3);
          const value = 85 + ridge * 105 + Math.sin(v * Math.PI) * 34;
          const k = (y * 256 + x) * 4; data.data[k] = value; data.data[k + 1] = value; data.data[k + 2] = value; data.data[k + 3] = 255;
        }
        ctx.putImageData(data, 0, 0); gillTexture = new THREE.CanvasTexture(canvas); gillTexture.colorSpace = THREE.SRGBColorSpace; gillTexture.anisotropy = 4;
      }
    }
    const gillMaterial = material(0xffffff, 0x1d7b82, 0.52, { map: gillTexture, emissiveMap: gillTexture, bumpMap: gillTexture, bumpScale: 0.09, side: THREE.DoubleSide });
    batch(new THREE.SphereGeometry(1, quality === 'low' ? 18 : 26, quality === 'low' ? 6 : 9, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gillMaterial, undercaps);
    batch(new THREE.TorusGeometry(1, 0.055, 5, 32), material(0xa04f55, 0x5b2435, 0.25), redRims);
    batch(new THREE.SphereGeometry(1, 6, 4), material(0x87dfcf, 0x2da39a, 0.7), spots);
    // Smaller shelf fungi and root arches establish detail at walking height.
    const shelves = [], shelfStems = [];
    for (let i = 0; i < Math.floor(200 * detail); i++) {
      const x = range(-82, 82), z = range(-80, 76); if (pathDistance(x, z) < 2.9) continue;
      const height = range(0.35, 1.5), r = range(0.45, 1.5), y = groundHeight(x, z);
      shelves.push({ x, y: y + height, z, sx: r, sy: r * 0.28, sz: r, color: [0x3aa8ad, 0x618ac2, 0x785eaf][i % 3] });
      shelfStems.push({ x, y: y + height * 0.5, z, sx: r * 0.16, sy: height, sz: r * 0.16 });
    }
    batch(new THREE.CylinderGeometry(0.6, 1, 1, 6), bark, shelfStems);
    batch(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), material(0xffffff, 0x1a6678, 0.5), shelves);
    tube([[-40, 3, -31], [-30, 13, -30], [-19, 15, -36], [-11, 4, -40]], 1.15, bark, 34);
    tube([[25, 4, 5], [18, 13, -2], [10, 16, -7], [3, 3, -15]], 0.95, bark, 34);
    const pendants = [];
    for (let i = 0; i < 28; i++) {
      const x = range(-70, 70), z = range(-73, 65), y = range(29, 42), length = range(4, 11);
      tube([[x, y, z], [x + 0.6, y - length * 0.5, z + 0.4], [x - 0.4, y - length, z + 0.1]], 0.047, bark, 9);
      for (let j = 0; j < 6; j++) pendants.push({ x: x + Math.sin(j * 0.8) * 0.4, y: y - length * j / 6, z: z + 0.3, sx: 0.1, sy: 0.23, sz: 0.1, color: i % 4 ? 0x62d6c3 : 0xd18dc1 });
    }
    batch(new THREE.SphereGeometry(1, 7, 5), material(0xffffff, 0x449b9f, 1.25), pendants);
  }

  if (!legacy && !forest) {
    seed = 612988;
    // Monumental split ring, sloped terraces and waterfall-lit ruins follow the
    // inspected Pyrite composition without copying its unverified floor plan.
    const ruins = [], columns = [], inlays = [];
    for (let side of [-1, 1]) {
      const x = side * 16, z = -43, y = groundHeight(x, z);
      const ring = new THREE.TorusGeometry(13, 2.7, 9, 44, Math.PI * 0.77);
      staticMesh(ring, stone, x, y + 10, z, { x: 1, y: 1, z: 0.72 }, { x: 0, y: side * 0.12, z: side < 0 ? 0.23 : Math.PI - 0.32 });
      obstacle(x + side * 8, z, 2.8, 14);
      const innerRing = new THREE.TorusGeometry(10.9, 0.09, 5, 38, Math.PI * 0.64);
      staticMesh(innerRing, material(0x729fae, 0x458eb1, 0.6), x, y + 10, z - 2.06, null, { z: side < 0 ? 0.23 : Math.PI - 0.32 });
    }
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2, r = range(38, 82), x = Math.sin(a) * r, z = Math.cos(a) * r - 16;
      if (Math.abs(x) < 10 && z > -60 || reserved(x, z, 1)) continue;
      const h = range(3, 10), radius = range(2.2, 6.8), y = groundHeight(x, z);
      ruins.push({ x, y: y + h * 0.35, z, sx: radius, sy: h, sz: radius * range(0.7, 1.4), ry: range(0, 6.28), color: [0x4b6789, 0x345172, 0x60748e][i % 3] });
      obstacle(x, z, radius * 0.68, h * 0.8);
    }
    for (const [x, z, h] of [[-44, -34, 22], [44, -58, 25], [-65, -62, 31], [64, -5, 21], [-60, 28, 18], [17, -71, 28]]) {
      const y = groundHeight(x, z); columns.push({ x, y: y + h / 2 - 0.1, z, sx: 1.6, sy: h, sz: 1.6, ry: range(0, 1.2) }); obstacle(x, z, 1.9, h);
      inlays.push({ x: x - 1.18, y: y + h * 0.55, z: z + 0.7, sx: 0.06, sy: h * 0.6, sz: 0.08 });
      for (let j = 0; j < 3; j++) staticMesh(new THREE.TorusGeometry(2.3, 0.22, 5, 12), paleStone, x, y + h * (0.2 + j * 0.28), z, null, { x: Math.PI / 2 });
    }
    batch(new THREE.DodecahedronGeometry(1, 0), stone, ruins);
    batch(new THREE.CylinderGeometry(0.8, 1.15, 1, 8), stone, columns);
    batch(new THREE.BoxGeometry(1, 1, 1), cyan, inlays);
    const waterfallMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, tint: { value: color(0x6dc7e8) } },
      vertexShader: 'varying vec2 waterUv; uniform float time; void main(){waterUv=uv;vec3 p=position;p.z+=sin(uv.x*24.0+time*1.3)*0.11;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
      fragmentShader: `varying vec2 waterUv; uniform float time; uniform vec3 tint;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
        void main(){vec2 flow=vec2(waterUv.x*13.0,waterUv.y*34.0+time*1.6);
        float body=noise(flow)*0.6+noise(flow*2.13)*0.28+noise(flow*5.1)*0.12;
        float strands=pow(sin(waterUv.x*135.0+noise(flow*0.35)*3.0)*0.5+0.5,8.0);
        float edge=smoothstep(0.0,0.1,waterUv.x)*(1.0-smoothstep(0.9,1.0,waterUv.x));
        float foam=(1.0-smoothstep(0.0,0.05,waterUv.y))*0.4;
        vec3 water=mix(tint*0.65,vec3(0.72,0.89,0.96),body*0.52+strands*0.13+foam);
        gl_FragColor=vec4(water,edge*(0.16+body*0.3+strands*0.13+foam));}`,
    });
    for (const [x, z, width, height] of [[-51, -77, 13, 42], [-29, -83, 9, 46], [-4, -85, 17, 50], [23, -81, 12, 43], [50, -72, 8, 39]]) {
      const y = groundHeight(x, z);
      const fall = mesh(new THREE.PlaneGeometry(width, height, 12, 25), waterfallMaterial, x, y + height / 2, z); fall.rotation.y = -x * 0.004;
      staticMesh(new THREE.BoxGeometry(width * 1.25, 1.1, 6), darkStone, x, y + height + 0.2, z + 1);
      const pool = mesh(new THREE.CircleGeometry(width * 0.65, 32), material(0x55aaca, 0x1c668a, 0.55, { transparent: true, opacity: 0.38, side: THREE.DoubleSide, roughness: 0.2 }), x, y + 0.07, z + 0.6); pool.rotation.x = -Math.PI / 2;
      const halo = new THREE.PointLight(0x55b9e8, 13, 33, 2); halo.position.set(x, y + 8, z + 4); group.add(halo);
    }
    animated.push(time => { waterfallMaterial.uniforms.time.value = time; });
    const fins = [], crystals = [];
    for (let i = 0; i < Math.floor(125 * detail); i++) {
      const x = range(-85, 85), z = range(-82, 76); if (pathDistance(x, z) < 3) continue;
      const y = groundHeight(x, z), s = range(0.5, 2.4);
      if (i % 3) fins.push({ x, y: y + s * 0.6, z, sx: s * 0.35, sy: s, sz: s * 0.7, rz: range(-0.4, 0.4), ry: range(0, 6.28), color: i % 2 ? 0x6e477c : 0x646192 });
      else crystals.push({ x, y, z, sx: s * 0.35, sy: s * 0.8, sz: s * 0.35, rz: range(-0.3, 0.3), color: i % 4 ? 0x85b6c2 : 0xa36bbb });
    }
    batch(new THREE.SphereGeometry(1, 9, 6), material(0xffffff, 0x3e2148, 0.35), fins);
    const crystal = new THREE.CylinderGeometry(0.01, 0.6, 2.5, 5); crystal.translate(0, 1.25, 0);
    batch(crystal, material(0xffffff, 0x34768d, 0.6, { roughness: 0.3, metalness: 0.25 }), crystals);
  }

  if (!legacy) {
    // Instanced ground life bends in the draft and yields near the explorer.
    const blades = new THREE.BufferGeometry(), vertices = [], indices = [];
    for (let i = 0; i < 4; i++) {
      const angle = i / 4 * Math.PI * 2, dx = Math.sin(angle), dz = Math.cos(angle), n = vertices.length / 3;
      vertices.push(-dz * 0.11, 0, dx * 0.11, dz * 0.11, 0, -dx * 0.11, dx * 0.2, 0.65, dz * 0.2, dx * 0.46, 1.1, dz * 0.46); indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    blades.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); blades.setIndex(indices); blades.computeVertexNormals();
    const life = [];
    for (let i = 0; i < Math.floor((forest ? 2400 : 650) * detail); i++) {
      const x = range(-88, 88), z = range(-86, 83); if (pathDistance(x, z) < 2.45 || Math.abs(x - riverX(z)) < 2.9 || x * x + z * z > 89 ** 2) continue;
      const s = range(0.3, forest ? 1.2 : 0.68);
      life.push({ x, y: groundHeight(x, z), z, sx: s, sy: s * range(0.6, 1.25), sz: s, ry: range(0, 6.28), color: forest ? [0x4d9089, 0x5e83a4, 0x5c617f, 0x458b7c][i % 4] : [0x627c86, 0x7c698e, 0x657587][i % 3] });
    }
    leaf.onBeforeCompile = shader => {
      shader.uniforms.cavernTime = { value: 0 }; shader.uniforms.cavernPlayer = { value: new THREE.Vector3(1000, 0, 1000) };
      shader.vertexShader = 'uniform float cavernTime;uniform vec3 cavernPlayer;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 lifePos=vec4(position,1.0);\n#ifdef USE_INSTANCING\nlifePos=instanceMatrix*lifePos;\n#endif\nvec3 worldLife=(modelMatrix*lifePos).xyz;vec2 away=worldLife.xz-cavernPlayer.xz;float bend=max(0.0,1.0-length(away)/1.7);float top=max(0.0,position.y);transformed.x+=sin(cavernTime*0.8+worldLife.x*0.3+worldLife.z*0.19)*top*0.07+normalize(away+vec2(0.001)).x*bend*top*0.5;transformed.z+=cos(cavernTime*0.6+worldLife.z*0.22)*top*0.05+normalize(away+vec2(0.001)).y*bend*top*0.5;');
      waving.push(shader.uniforms);
    };
    leaf.customProgramCacheKey = () => 'cavern-responsive-life-v1';
    batch(blades, leaf, life);
    const count = Math.floor((forest ? 430 : 220) * detail), positions = new Float32Array(count * 3), particleColors = new Float32Array(count * 3), seeds = [];
    for (let i = 0; i < count; i++) {
      const x = range(-82, 82), z = range(-81, 79), y = groundHeight(x, z) + range(1.4, forest ? 26 : 10), phase = range(0, Math.PI * 2);
      seeds.push({ x, y, z, phase }); positions.set([x, y, z], i * 3); const tint = color(forest ? i % 5 ? 0x8edccf : 0xe8a3bf : 0x7eb5d6); particleColors.set([tint.r, tint.g, tint.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    const motes = new THREE.Points(geometry, new THREE.PointsMaterial({ size: forest ? 0.085 : 0.07, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); group.add(motes);
    animated.push(time => { const p = geometry.attributes.position; seeds.forEach((s, i) => p.setXYZ(i, s.x + Math.sin(time * 0.13 + s.phase) * 1.3, s.y + Math.sin(time * 0.2 + s.phase) * 0.7, s.z + Math.cos(time * 0.11 + s.phase) * 0.8)); p.needsUpdate = true; });
  }

  function platform(x, z, radius, tone = metal) {
    const y = groundHeight(x, z);
    staticMesh(new THREE.CylinderGeometry(radius, radius * 1.07, 0.26, 12), tone, x, y + 0.05, z);
    staticMesh(new THREE.TorusGeometry(radius * 0.91, 0.045, 5, 48), cyan, x, y + 0.2, z, null, { x: Math.PI / 2 });
    return y;
  }
  function gate(target, x, z, name) {
    const y = platform(x, z, 2.7);
    const node = new THREE.Group(); node.position.set(x, y, z); group.add(node);
    mesh(new THREE.TorusGeometry(2.15, 0.29, 8, 40, Math.PI * 1.73), metal, 0, 2.4, 0, node).rotation.z = -Math.PI * 0.365;
    const inner = mesh(new THREE.TorusGeometry(1.94, 0.055, 5, 48, Math.PI * 1.73), cyan, 0, 2.4, -0.24, node); inner.rotation.z = -Math.PI * 0.365;
    for (const side of [-1, 1]) { staticMesh(new THREE.BoxGeometry(0.48, 2.7, 0.7), metal, x + side * 1.75, y + 1.3, z); obstacle(x + side * 1.75, z, 0.26, 2.7); }
    const mist = mesh(new THREE.CircleGeometry(1.85, 36), new THREE.MeshBasicMaterial({ color: target === 'pyrite' ? 0x749dce : 0x54baaa, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }), 0, 2.4, 0.1, node);
    animated.push(time => { mist.material.opacity = 0.075 + Math.sin(time * 1.6) * 0.025; });
    const record = { id: `gate-${target}`, type: 'portal', target, name, position: local(x, z), color: target === 'pyrite' ? 0x93bdea : 0x78d6c3, description: 'Take the expedition lift to the connected cavern.' };
    interactables.push(record); return record;
  }
  function checkpoint(x, z) {
    const y = platform(x, z, 1.7);
    staticMesh(new THREE.CylinderGeometry(0.28, 0.42, 2.5, 8), metal, x, y + 1.25, z);
    const beacon = mesh(new THREE.OctahedronGeometry(0.44, 0), amber, x, y + 2.9, z); animated.push(time => { beacon.rotation.y = time * 0.4; });
    const light = new THREE.PointLight(0xffba72, 6, 12, 2); light.position.set(x, y + 2.8, z); group.add(light);
    obstacle(x, z, 0.38, 2.5);
    interactables.push({ id: `checkpoint-${id}`, type: 'checkpoint', name: 'Expedition checkpoint', position: local(x, z), color: 0xffc781, description: 'Rest, restore vitality and record your return point.' });
  }
  function person(role, x, z, name) {
    const y = groundHeight(x, z), npc = new THREE.Group(); npc.position.set(x, y, z); group.add(npc);
    const clothes = material(role === 'merchant' ? 0x4b7181 : role === 'trainer' ? 0x306861 : 0x735d46), skin = material(role === 'merchant' ? 0x83a7ad : 0xd8b38c), trim = role === 'merchant' ? amber : cyan;
    const height = role === 'merchant' ? 1.12 : 1, width = role === 'merchant' ? 1.15 : 0.85;
    const body = mesh(new THREE.CapsuleGeometry(0.34 * width, 0.68 * height, 4, 9), clothes, 0, 1.15, 0, npc);
    mesh(new THREE.SphereGeometry(0.26, 12, 8), skin, 0, 1.95 + (height - 1) * 0.3, 0, npc);
    for (const side of [-1, 1]) {
      mesh(new THREE.CapsuleGeometry(0.11, 0.58, 3, 7), clothes, side * 0.19, 0.42, 0, npc);
      const arm = mesh(new THREE.CapsuleGeometry(0.1, 0.55, 3, 7), clothes, side * 0.43 * width, 1.25, 0, npc); arm.rotation.z = side * 0.14;
      mesh(new THREE.SphereGeometry(0.037, 6, 4), cyan, side * 0.1, 2.0, 0.24, npc);
    }
    mesh(new THREE.BoxGeometry(0.42, 0.12, 0.24), trim, 0, 1.6, 0.25, npc);
    for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 7), cyan, -0.18 + k * 0.16, 0.93, 0.3, npc);
    if (role === 'merchant') {
      const goggles = mesh(new THREE.TorusGeometry(0.105, 0.023, 5, 12), metal, -0.1, 2.13, 0.2, npc); goggles.rotation.x = 0.2;
      mesh(new THREE.TorusGeometry(0.105, 0.023, 5, 12), metal, 0.1, 2.13, 0.2, npc);
      // An actual stall with display canisters and blaster-shaped merchandise.
      staticMesh(new THREE.BoxGeometry(4.6, 0.2, 1.8), metal, x, y + 0.85, z - 2.4);
      for (const side of [-1, 1]) staticMesh(new THREE.BoxGeometry(0.13, 3.5, 0.13), metal, x + side * 2.05, y + 1.65, z - 2.7);
      staticMesh(new THREE.BoxGeometry(4.9, 0.2, 2.4), material(0x886849), x, y + 3.45, z - 2.5, null, { x: 0.08 });
      for (let k = 0; k < 4; k++) { const bx = x - 1.4 + k * 0.9; staticMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 8), cyan, bx, y + 1.2, z - 2.55); staticMesh(new THREE.BoxGeometry(0.55, 0.3, 0.24), metal, bx, y + 1.1, z - 1.95); staticMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8), amber, bx + 0.3, y + 1.18, z - 1.95, null, { z: Math.PI / 2 }); }
    } else if (role === 'trainer') {
      platform(x, z - 2.2, 3.3, stone);
      for (const side of [-1, 1]) { staticMesh(new THREE.CylinderGeometry(0.22, 0.28, 2.4, 8), metal, x + side * 2.2, y + 1.2, z - 2.2); staticMesh(new THREE.OctahedronGeometry(0.34), amber, x + side * 2.2, y + 2.65, z - 2.2); }
    }
    animated.push(time => { body.position.y = 1.15 + Math.sin(time * 1.4 + x) * 0.018; });
    obstacle(x, z, 0.5, 2.6);
    interactables.push({ id: `npc-${id}-${role}`, type: 'npc', role, name, position: local(x, z), color: role === 'merchant' ? 0xffc781 : 0x7edbd1, description: role === 'merchant' ? 'An expedition blastersmith. Buy and equip different blasters.' : role === 'trainer' ? 'Practice the expedition interpretation of slug guidance.' : 'Your local expedition contact has a survey for this cavern.' });
  }
  function discovery(slugId, x, z, name) {
    const y = platform(x, z, 1.5, stone);
    const pedestal = mesh(new THREE.CylinderGeometry(0.7, 1.1, 0.9, 8), darkStone, x, y + 0.48, z);
    const slug = createSlugModel(THREE, SLUG_CATALOG[slugId], { scale: 0.85 }); slug.position.set(x, y + 1.1, z); group.add(slug);
    const beam = mesh(new THREE.CylinderGeometry(0.035, 0.18, 5, 9, 1, true), new THREE.MeshBasicMaterial({ color: SLUG_CATALOG[slugId].color, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }), x, y + 3.1, z);
    const display = new THREE.Group(); display.name = `Companion discovery ${slugId}`; group.add(display); display.add(slug, pedestal, beam);
    const record = { id: `discovery-${slugId}`, type: 'discovery', slugId, name, position: local(x, z), color: color(SLUG_CATALOG[slugId].color).getHex(), object: display, beam, description: `Approach gently and invite this ${SLUG_CATALOG[slugId].species} to your collection.` };
    animated.push(time => { slug.position.y = y + 1.12 + Math.sin(time * 2.3) * 0.08; slug.rotation.y = Math.sin(time * 0.7) * 0.32; });
    interactables.push(record); obstacle(x, z, 0.75, 0.8);
  }
  function survey(x, z, name) {
    const y = platform(x, z, 2.4, stone);
    staticMesh(new THREE.BoxGeometry(1.2, 0.8, 0.7), metal, x, y + 0.65, z);
    const core = mesh(new THREE.OctahedronGeometry(0.42), cyan, x, y + 1.9, z); animated.push(time => { core.rotation.y = time * 0.5; core.position.y = y + 1.9 + Math.sin(time) * 0.12; });
    interactables.push({ id: `survey-${id}`, type: 'survey', name, position: local(x, z), color: 0x80ded7, description: 'Record this expedition survey. Its route and task are original game content.' });
  }

  if (legacy) {
    // Carry forward the old collider extraction, including its exact geometry
    // thresholds, so enclosure/decorations do not change the original routes.
    original.group.traverse(object => {
      const p = object.geometry?.parameters;
      if (!object.isMesh) return;
      if (object.isInstancedMesh && object.count < 100) object.castShadow = true;
      if (object.geometry.type === 'CylinderGeometry' && p.height > 25) colliders.push({ x: object.position.x, z: object.position.z, radius: p.radiusBottom * 0.65, bottom: object.position.y - p.height / 2, top: object.position.y + p.height / 2 });
      if (object.isInstancedMesh && p?.radiusTop === 0.72 && p.height === 1) {
        const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
        for (let i = 0; i < object.count; i++) { object.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale); colliders.push({ x: position.x, z: position.z, radius: scale.x, bottom: position.y - scale.y / 2, top: position.y + scale.y / 2 }); }
      }
    });
    gate('dark-spores', 20, 30, 'Lift to Dark Spores'); gate('pyrite', -20, 30, 'Lift to Pyrite');
    person('merchant', 11, 37, 'Mira · Blastersmith'); person('trainer', -11, 37, 'Tala · Expedition trainer');
    discovery('frost', 16, 40, 'Rescued Frostcrawler');
    interactables[interactables.length - 1].description = 'This expedition rescue crate is original game content, not a claim that Frostcrawlers inhabit Haven.';
    const rescueY = groundHeight(16, 40);
    for (const side of [-1, 1]) for (const front of [-1, 1]) staticMesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), metal, 16 + side * 0.72, rescueY + 1.25, 40 + front * 0.65);
    staticMesh(new THREE.BoxGeometry(1.6, 0.12, 1.45), metal, 16, rescueY + 2.12, 40);
    staticMesh(new THREE.TorusGeometry(0.3, 0.05, 5, 14, Math.PI), metal, 16, rescueY + 2.17, 40, null, { z: Math.PI });
  } else {
    gate('luminous', 0, 38, 'Lift to Haven'); gate(forest ? 'pyrite' : 'dark-spores', 35, 25, forest ? 'Lift to Pyrite' : 'Lift to Dark Spores');
    checkpoint(0, 23); person('expedition', 7, 27, forest ? 'Ivo · Field researcher' : 'Sera · Ruins surveyor');
    if (forest) { discovery('doc', -22, -12, 'A Boon Doc in the grove'); survey(-30, -38, 'The Sporeheart survey'); }
    else { discovery('glow', 20, -8, 'A Phosphoro in the ruins'); survey(35, -35, 'The cascade archive'); }
    const camps = forest ? [[-28, -16, 'grove'], [-17, -18, 'grove'], [-36, -43, 'survey'], [-23, -45, 'survey']] : [[15, -14, 'archive'], [26, -13, 'archive'], [30, -41, 'survey'], [41, -39, 'survey']];
    camps.forEach(([x, z, camp], i) => enemySpawns.push({ id: `${id}-sentinel-${i + 1}`, x, z, boss: false, camp: camp === 'survey' ? `survey-${id}` : forest ? 'discovery-doc' : 'discovery-glow' }));
    const light = new THREE.PointLight(forest ? 0x65cfc2 : 0x86c4e5, forest ? 12 : 10, 30, 2); light.position.set(forest ? -22 : 20, groundHeight(forest ? -22 : 20, forest ? -12 : -8) + 7, forest ? -12 : -8); group.add(light);
  }

  // Secondary detail uses a separate decorative stream and never changes
  // terrain or collisions when rendering quality changes.
  let decorSeed = forest ? 814217 : 621049;
  const decorRandom = () => { decorSeed = (Math.imul(decorSeed, 1664525) + 1013904223) >>> 0; return decorSeed / 4294967296; };
  const deco = (a, b) => a + (b - a) * decorRandom();
  if (!legacy) {
    const rubble = [], tufts = [];
    const count = quality === 'low' ? 95 : quality === 'ultra' ? 410 : 300;
    for (let i = 0; i < count; i++) {
      const x = deco(-82, 82), z = deco(-80, 76), bank = Math.abs(x - riverX(z));
      if (pathDistance(x, z) < 1.7 || (bank > 9 && decorRandom() < 0.55)) continue;
      const size = deco(0.13, forest ? 0.45 : 0.75);
      rubble.push({x, y: groundHeight(x,z) - size * 0.16, z, sx: size * deco(0.8,1.5), sy: size * deco(0.35,0.8), sz: size, ry:deco(0,6.28), color:forest ? [0x3c6265,0x4b6a6c,0x466371][i%3] : [0x536e8c,0x657d95,0x3d526d][i%3]});
    }
    batch(new THREE.DodecahedronGeometry(1,0), material(0xffffff,0,0,{roughness:0.97}), rubble);
    if (forest) {
      const fern = new THREE.BufferGeometry(), fp=[], fi=[];
      for(let f=0;f<6;f++){
        const a=f/6*Math.PI*2,dx=Math.sin(a),dz=Math.cos(a);
        for(let k=0;k<5;k++){
          const t=(k+1)/6,b=fp.length/3,w=Math.sin(t*Math.PI)*0.21,xx=dx*t*1.4,zz=dz*t*1.4,yy=Math.sin(t*Math.PI)*0.62;
          fp.push(xx,yy,zz,xx+dz*w,yy+0.06,zz-dx*w,xx+dx*0.25,yy+0.09,zz+dz*0.25,xx-dz*w,yy+0.06,zz+dx*w);
          fi.push(b,b+1,b+2,b,b+2,b+3);
        }
      }
      fern.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fern.setIndex(fi);fern.computeVertexNormals();
      for(let i=0;i<(quality==='low'?180:590);i++){
        const x=deco(-83,83),z=deco(-82,77),d=pathDistance(x,z);
        if(d<1.7||d>12||Math.abs(x-riverX(z))<2.8)continue;
        const size=deco(0.45,1.05);tufts.push({x,y:groundHeight(x,z),z,sx:size,sy:size,sz:size,ry:deco(0,6.28),color:[0x587f83,0x3f7975,0x726e92,0x6c9493][i%4]});
      }
      batch(fern,leaf,tufts);
    } else {
      // Broad fractured cliff shelves give the falling water a convincing
      // source and a geological silhouette instead of floating strips.
      const cliffBlocks=[];
      for(let i=0;i<13;i++){
        const x=-78+i*13,z=-103+Math.abs(x)*0.15,base=groundHeight(x,z),height=deco(31,47);
        cliffBlocks.push({x,y:base+height*0.42,z,sx:deco(9,14),sy:height*0.65,sz:deco(9,14),ry:deco(-0.16,0.16),color:[0x344a68,0x3e5877,0x2d435f][i%3]});
        staticMesh(new THREE.BoxGeometry(deco(18,26),deco(1.3,2.5),deco(12,18)),stone,x,base+height*0.87,z+2,null,{y:deco(-0.12,0.12),z:deco(-0.025,0.025)});
        staticMesh(new THREE.BoxGeometry(deco(14,23),deco(1.5,2.7),deco(8,12)),darkStone,x,base+height*0.55,z+6,null,{y:deco(-0.13,0.13)});
      }
      batch(new THREE.DodecahedronGeometry(1,1),stone,cliffBlocks);
      let mistTexture=null;
      if(typeof document!=='undefined'){
        const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');
        if(ctx){const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,0.8)');gradient.addColorStop(0.35,'rgba(255,255,255,0.35)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);mistTexture=new THREE.CanvasTexture(c);}
      }
      const coords=[],mistSeeds=[],ripples=[];
      for(const [x,z,width] of [[-51,-77,13],[-29,-83,9],[-4,-85,17],[23,-81,12],[50,-72,8]]){
        const y=groundHeight(x,z);
        const pool=mesh(new THREE.PlaneGeometry(width*1.8,width*1.15),new THREE.MeshBasicMaterial({color:0x88d9e9,map:mistTexture,transparent:true,opacity:0.24,depthWrite:false,side:THREE.DoubleSide}),x,y+0.13,z+3);pool.rotation.x=-Math.PI/2;
        for(let i=0;i<30;i++){const px=x+deco(-width*0.65,width*0.65),pz=z+deco(-1,7),py=y+deco(0.2,2.6);coords.push(px,py,pz);mistSeeds.push({x:px,y:py,z:pz,p:deco(0,6.28)});}
        for(let i=0;i<3;i++)ripples.push({x,y:y+0.16,z:z+2,phase:i/3,width});
      }
      const mistGeo=new THREE.BufferGeometry();mistGeo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
      const spray=new THREE.Points(mistGeo,new THREE.PointsMaterial({color:0x8acadd,map:mistTexture,size:3.2,transparent:true,opacity:0.16,depthWrite:false,sizeAttenuation:true}));group.add(spray);
      const rippleBatch=batch(new THREE.RingGeometry(0.94,1,36).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xa6dcea,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}),ripples.map(p=>({x:p.x,y:p.y,z:p.z})));
      animated.push(time=>{
        const pos=mistGeo.attributes.position;mistSeeds.forEach((p,i)=>pos.setXYZ(i,p.x+Math.sin(time*0.4+p.p)*0.8,p.y+Math.sin(time*0.7+p.p)*0.55,p.z+Math.cos(time*0.25+p.p)*0.6));pos.needsUpdate=true;
        ripples.forEach((p,i)=>{const t=(time*0.14+p.phase)%1;dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(p.width*(0.2+t*0.6),1,p.width*(0.14+t*0.36));dummy.updateMatrix();rippleBatch.setMatrixAt(i,dummy.matrix)});rippleBatch.instanceMatrix.needsUpdate=true;
      });
    }
  }

  // Merge static ornaments by material after transforms. Dense silhouettes and
  // architecture stay inexpensive rather than becoming one draw call per twig.
  for (const [mat, geometries] of staticGroups) {
    if (!geometries.length) continue;
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (merged) { const object = mesh(merged, mat); object.castShadow = mat === bark || mat === stone || mat === metal; }
  }
  const atmosphere = legacy
    ? { background: 0x102832, fog: 0x102e36, density: 0.0075, key: 0xf5dfbb, fill: 0x69cfff, exposure: 1.15 }
    : forest ? { background: 0x1c2339, fog: 0x302b48, density: 0.008, key: 0xb4cbd1, fill: 0x7495ce, ambient: 0x9ab7ce, ground: 0x253344, exposure: 1.22 }
      : { background: 0x172b46, fog: 0x273e5b, density: 0.007, key: 0xc6d8f1, fill: 0x6aa4e1, ambient: 0xa5cbe4, ground: 0x283b57, exposure: 1.16 };
  const river = Array.from({ length: 69 }, (_, i) => { const z = -102 + i * 3; return { x: legacy ? -7 + Math.sin(z * 0.035) * 13 : riverX(z), z }; });
  return {
    id, quality, group, groundHeight, spawn: original?.spawn || { x: 0, z: 28 }, bounds: original?.bounds || 88,
    landmarks, colliders, interactables, enemySpawns, atmosphere,
    map: { kind: legacy ? 'luminous' : forest ? 'forest' : 'terraces', river, paths: legacy ? [] : [routePoints.map(([x, z]) => ({ x, z }))] },
    update(time, dt, player) {
      original?.update(time, dt);
      animated.forEach(update => update(time, dt));
      waving.forEach(uniforms => { uniforms.cavernTime.value = time; if (player) uniforms.cavernPlayer.value.copy(player); });
    },
    dispose() {
      const seen = new Set();
      group.traverse(object => {
        if (object.isInstancedMesh) object.dispose();
        if (object.geometry && !seen.has(object.geometry)) { seen.add(object.geometry); object.geometry.dispose(); }
        for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) if (mat && !seen.has(mat)) {
          seen.add(mat); for (const value of Object.values(mat)) if (value?.isTexture && !seen.has(value)) { seen.add(value); value.dispose(); }
          mat.dispose();
        }
      });
      group.removeFromParent();
    },
  };
}
