import { applyImportedSlug, createImportedBlaster } from './model-registry.js';
/** Procedural fallbacks and uploaded artwork. Faces point along local -Z. */
function helpers(THREE) {
  const group = new THREE.Group();
  const materials = new Map();
  function material(name, color, { glow = 0, intensity = 0, metalness = .05, roughness = .48, ...rest } = {}) {
    if (materials.has(name)) return materials.get(name);
    const m = new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: intensity, metalness, roughness, ...rest });
    materials.set(name, m); return m;
  }
  function add(geometry, mat, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], parent = group) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function egg(mat, position, scale, rotation, parent) { return add(new THREE.SphereGeometry(1, 18, 12), mat, position, scale, rotation, parent); }
  function box(mat, position, scale, rotation, parent) { return add(new THREE.BoxGeometry(1, 1, 1), mat, position, scale, rotation, parent); }
  function tube(mat, points, radius, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, 14, radius, 7, false), mat, undefined, undefined, undefined, parent);
  }
  function shape(mat, points, depth = .035, position = [0, 0, 0], rotation = [0, 0, 0], parent) {
    const path = new THREE.Shape();
    path.moveTo(...points[0]); points.slice(1).forEach(p => path.lineTo(...p)); path.closePath();
    const geometry = new THREE.ExtrudeGeometry(path, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: Math.min(depth * .22, .015), bevelThickness: Math.min(depth * .22, .015), curveSegments: 6 });
    geometry.translate(0, 0, -depth * .5);
    return add(geometry, mat, position, undefined, rotation, parent);
  }
  function curveShape(mat, build, depth = .035, position = [0, 0, 0], rotation = [0, 0, 0], parent) {
    const path = new THREE.Shape(); build(path);
    const geometry = new THREE.ExtrudeGeometry(path, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: Math.min(depth * .22, .015), bevelThickness: Math.min(depth * .22, .015), curveSegments: 8 });
    geometry.translate(0, 0, -depth * .5);
    return add(geometry, mat, position, undefined, rotation, parent);
  }
  // Merge by material to retain sculpted detail with only a few draw calls per pet.
  function bake(source = group) {
    source.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(source.matrixWorld).invert(), buckets = new Map(), originals = [];
    source.traverse(mesh => {
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const transformed = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
      if (geometry !== transformed) transformed.dispose();
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const list = buckets.get(mesh.material) || []; list.push(geometry); buckets.set(mesh.material, list); originals.push(mesh);
    });
    for (const mesh of originals) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const [mat, geometries] of buckets) {
      const length = geometries.reduce((sum, geo) => sum + geo.attributes.position.count, 0);
      const position = new Float32Array(length * 3), normal = new Float32Array(length * 3), uv = new Float32Array(length * 2);
      let offset = 0;
      for (const geo of geometries) {
        position.set(geo.attributes.position.array, offset * 3); normal.set(geo.attributes.normal.array, offset * 3);
        if (geo.attributes.uv) uv.set(geo.attributes.uv.array, offset * 2);
        offset += geo.attributes.position.count; geo.dispose();
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(position, 3)); geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3)); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geometry.computeBoundingSphere(); geometry.computeBoundingBox();
      const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; source.add(mesh);
    }
    return source;
  }
  return { group, material, add, egg, box, tube, shape, curveShape, bake };
}

function kindOf(slug) {
  const aliases = {
    infurnus: 'fire', ember: 'fire', burpy: 'fire', fire: 'fire',
    tazerling: 'electric', volt: 'electric', joules: 'electric', electric: 'electric', electricity: 'electric',
    aquabeek: 'water', tide: 'water', beeker: 'water', water: 'water',
    frostcrawler: 'ice', frost: 'ice', chiller: 'ice', ice: 'ice',
    'boon-doc': 'healing', boondoc: 'healing', doc: 'healing', healing: 'healing',
    phosphoro: 'light', glow: 'light', glimmer: 'light', light: 'light',
  };
  const normalize = value => String(value || '').toLowerCase().trim().replace(/[_\s]+/g, '-');
  if (typeof slug === 'object' && slug !== null) {
    const explicit = slug.modelArchetype || slug.archetype;
    if (explicit) return aliases[normalize(explicit)] || 'neutral';
    // Species identity wins over a shared element: Boon Doc is a Light species,
    // but needs its one-eyed healing silhouette rather than Phosphoro's hood.
    for (const value of [slug.speciesId, slug.species, slug.id, slug.element]) {
      const match = aliases[normalize(value)];
      if (match) return match;
    }
    return 'neutral';
  }
  return aliases[normalize(slug)] || 'neutral';
}

// Additional silhouettes are modeled from the legacy official Slug Arsenal art,
// not by recoloring an Infurnus. Source notes live in docs/references/.
function createAdditionalSlugModel(THREE, slug, kind, { scale, morphed }) {
  const b = helpers(THREE), { group, material, egg, tube, shape, curveShape, add } = b;
  const doc = kind === 'healing', frost = kind === 'ice', light = kind === 'light';
  const skin = material('skin', doc ? 0x299b69 : frost ? 0x29acd9 : light ? 0x54c2be : 0x82959f, { roughness: .5 });
  const dorsal = material('dorsal', doc ? 0x147452 : frost ? 0x176b9a : light ? 0x153a85 : 0x495d6b, { roughness: .48 });
  const belly = material('belly', doc ? 0xb0e58d : frost ? 0x86def0 : light ? 0x9ce9dd : 0xc6d5d8, { roughness: .58 });
  const ivory = material('eye-white', 0xfff8e9, { roughness: .36 });
  const pupil = material('pupil', 0x112232, { roughness: .25 });
  const iris = material('iris', frost ? 0x954be2 : doc ? 0x87a55b : 0x243d99, { roughness: .3 });
  const mouth = material('mouth', doc ? 0x254539 : frost ? 0x153e5d : 0x243851, { roughness: .8 });
  const shine = material('eye-shine', 0xffffff, { glow: 0xffffff, intensity: .3 });
  const luminous = material('bioluminescence', doc ? 0x68ffe2 : frost ? 0xc2f8ff : 0xafffff, { glow: doc ? 0x34efcc : frost ? 0x86dfff : 0x8cffff, intensity: light ? 1.7 : .6, roughness: .3 });
  const whiteIce = frost ? material('ice-mantle', 0xd8f5ff, { metalness: .1, roughness: .34 }) : null;
  group.name = `${slug?.species || (doc ? 'Boon Doc' : frost ? 'Frostcrawler' : light ? 'Phosphoro' : 'Unidentified slug')} ${morphed ? 'Velocimorph' : 'companion'}`;

  function singleEye(y, z, size = 1, halfLid = false) {
    egg(ivory, [0, y, z], [.171 * size, .094 * size, .047 * size], [0, 0, frost ? -.10 : .035]);
    egg(iris, [.058 * size, y + .007 * size, z - .042 * size], [.064 * size, .079 * size, .018 * size]);
    egg(pupil, [.06 * size, y + .008 * size, z - .058 * size], [.037 * size, .061 * size, .010 * size]);
    egg(shine, [.043 * size, y + .042 * size, z - .067 * size], [.022 * size, .008 * size, .005 * size], [0, 0, -.25]);
    if (halfLid) egg(dorsal, [0, y + .075 * size, z - .021 * size], [.18 * size, .049 * size, .048 * size], [0, 0, .035]);
    tube(dorsal, [[-.16 * size, y + .073 * size, z - .012], [0, y + .11 * size, z - .022], [.16 * size, y + .07 * size, z - .012]], .012 * size);
  }
  function pairedEyes(y, z, size = 1) {
    for (const side of [-1, 1]) {
      egg(ivory, [side * .107 * size, y, z], [.084 * size, .103 * size, .045 * size], [0, side * -.18, side * -.21]);
      egg(iris, [side * .102 * size, y + .026 * size, z - .035 * size], [.045 * size, .057 * size, .019 * size]);
      egg(pupil, [side * .101 * size, y + .027 * size, z - .052 * size], [.026 * size, .039 * size, .009 * size]);
      egg(shine, [side * .107 * size - .009, y + .047 * size, z - .061 * size], [.014 * size, .008 * size, .005 * size]);
    }
  }
  function grin(y, z, width = .12) {
    tube(mouth, [[-width, y + .02, z], [-width * .45, y - .012, z - .024], [width * .38, y - .01, z - .025], [width, y + .03, z + .005]], .009);
  }

  if (!morphed) {
    egg(skin, [0, .325, .012], [doc ? .19 : .207, .32, .195]);
    egg(skin, [0, .46, -.012], [doc ? .231 : .243, .235, .209], [0, 0, frost ? -.06 : .035]);
    egg(skin, [0, .075, .11], [.22, .075, .25]);
    egg(belly, [0, .25, -.158], [.146, .227, .055]);
    for (const side of [-1, 1]) {
      egg(skin, [side * .191, .19, .005], [.05, .105, .046], [0, 0, side * -.28]);
      egg(skin, [side * .16, .045, -.035], [.09, .034, .103]);
    }
    if (doc || frost) {
      singleEye(.485, -.2, 1, doc);
      grin(.347, -.202, .131);
      // A tiny visible fang and asymmetric grin retain the one-eyed faces.
      shape(ivory, [[-.013, .018], [.012, .018], [.004, -.017]], .012, [doc ? .105 : .121, .346, -.221]);
      for (const side of [-1, 1]) {
        const top = doc ? .93 : .81;
        tube(skin, [[side * .105, .64, .008], [side * .115, .72, .01], [side * (doc ? .135 : .113), top - .03, .01], [side * (doc ? .13 : .16), top, -.005]], doc ? .013 : .017);
        if (doc) egg(dorsal, [side * .13, top, -.005], [.013, .025, .013]);
      }
      if (frost) {
        for (let i = 0; i < 5; i++) egg(belly, [(i % 2 ? -1 : 1) * .07, .18 + i * .075, -.198], [.027, .035, .008]);
      }
    } else {
      if (light) {
        egg(dorsal, [0, .575, .005], [.234, .145, .20]);
        for (const side of [-1, 1]) {
          tube(dorsal, [[side * .11, .65, .012], [side * .13, .77, .026], [side * .18, .87, .015]], .012);
          egg(luminous, [side * .18, .87, .015], [.013, .024, .014], [0, 0, side * -.3]);
          tube(dorsal, [[side * .18, .24, -.08], [side * .22, .20, -.08], [side * .23, .25, -.08]], .018);
        }
        for (let i = 0; i < 3; i++) egg(material('hood-spots', 0x2464bc), [0, .65 - i * .045, -.134 - i * .025], [.025 - i * .003, .019, .009]);
        egg(luminous, [0, .552, -.199], [.022, .027, .013]);
      }
      pairedEyes(.463, -.19);
      grin(.333, -.205);
    }
  } else if (doc) {
    // Broad healing form, forward hands and curling rear feelers, not a fire wing.
    egg(dorsal, [0, .11, .09], [.32, .25, .47]);
    egg(belly, [0, -.015, -.045], [.25, .12, .39]);
    egg(skin, [0, .14, -.367], [.335, .25, .285]);
    egg(belly, [0, .04, -.51], [.235, .12, .157]);
    singleEye(.235, -.603, 1.23, true);
    grin(.065, -.653, .185);
    for (const side of [-1, 1]) {
      tube(skin, [[side * .25, .06, -.18], [side * .39, -.04, -.34], [side * .46, .01, -.54]], .067);
      egg(belly, [side * .46, .012, -.54], [.093, .06, .075]);
      for (let j = 0; j < 3; j++) tube(skin, [[side * .46, .025, -.57], [side * (.48 + j * .038), .03 + j * .025, -.64], [side * (.46 + j * .036), .055 + j * .025, -.67]], .016);
      tube(skin, [[side * .23, -.02, .20], [side * .40, -.065, .20], [side * .45, -.015, .06]], .054);
      for (let i = 0; i < 4; i++) {
        const y = -.04 + i * .1;
        tube(dorsal, [[side * .22, y, .30], [side * (.32 + i * .027), y + .04, .54], [side * (.39 + i * .025), y + .10, .70], [side * (.44 + i * .025), y + .15, .66]], .024 - i * .002);
      }
    }
    const aura = material('healing-aura', 0x66ffe3, { glow: 0x42ffcc, intensity: 1.1, transparent: true, opacity: .38, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2;
      egg(aura, [Math.cos(angle) * .47, .12 + Math.sin(angle) * .27, .28 + Math.sin(angle * 2) * .18], [.026, .035, .055]);
    }
  } else if (frost) {
    // The source's white serrated mantle overlaps an icy blue streamlined body.
    egg(dorsal, [0, .08, .03], [.30, .22, .61]);
    egg(belly, [0, -.04, -.10], [.23, .095, .47]);
    egg(skin, [0, .12, -.47], [.275, .19, .25]);
    egg(whiteIce, [0, .25, .045], [.31, .16, .57]);
    egg(whiteIce, [0, .258, -.43], [.287, .12, .24]);
    singleEye(.15, -.663, .94);
    grin(.035, -.663, .14);
    for (const side of [-1, 1]) {
      tube(material('ice-brow', 0x3aaab4), [[side * .125, .27, -.60], [side * .21, .345, -.54], [side * .29, .325, -.60]], .026);
      for (let i = 0; i < 5; i++) {
        const z = -.32 + i * .18;
        shape(whiteIce, [[0, -.15], [side * .15, -.11], [side * .23, .02], [side * .16, .00], [side * .20, .15], [side * .09, .12], [0, .24]], .028, [side * .13, .30 - i * .016, z], [Math.PI / 2, 0, 0]);
      }
      for (let i = 0; i < 3; i++) shape(whiteIce, [[0, -.10], [side * .14, -.01], [side * .31, .20], [side * .13, .14], [0, .23]], .028, [side * .15, .09, .20 + i * .12], [Math.PI / 2, 0, 0]);
    }
    for (let i = 0; i < 4; i++) shape(whiteIce, [[-.07, 0], [.07, 0], [.05, .13], [0, .20], [-.025, .12]], .03, [0, .35 - i * .022, -.19 + i * .19], [0, Math.PI / 2, -.08]);
  } else if (light) {
    // Spotted mantle with genuine openings and lantern-tipped feelers.
    egg(dorsal, [0, .11, .17], [.33, .18, .55]);
    egg(skin, [0, .10, -.37], [.255, .20, .28]);
    egg(belly, [0, -.015, -.43], [.19, .10, .22]);
    pairedEyes(.22, -.567, .88);
    egg(mouth, [0, .045, -.615], [.143, .064, .025]);
    egg(skin, [0, -.003, -.61], [.16, .052, .044]);
    for (const side of [-1, 1]) {
      curveShape(dorsal, p => {
        p.moveTo(side * .18, -.27); p.bezierCurveTo(side * .35, -.28, side * .61, -.08, side * .68, .17);
        p.bezierCurveTo(side * .61, .18, side * .48, .12, side * .39, .20);
        p.bezierCurveTo(side * .54, .27, side * .67, .37, side * .67, .49);
        p.lineTo(side * .34, .40); p.lineTo(side * .44, .69); p.lineTo(side * .16, .48); p.closePath();
        const hole = new THREE.Path(); hole.absellipse(side * .36, .02, .095, .12, 0, Math.PI * 2, true); p.holes.push(hole);
      }, .035, [0, .14, .10], [Math.PI / 2, 0, 0]);
      tube(skin, [[side * .16, .25, -.40], [side * .28, .50, -.28], [side * .38, .63, -.45], [side * .42, .53, -.65]], .021);
      egg(luminous, [side * .42, .52, -.65], [.045, .068, .12], [-.4, 0, side * -.2]);
      for (let i = 0; i < 6; i++) egg(material('mantle-spots', 0x4b7ca8), [side * (.15 + i % 2 * .07), .27 - i * .017, -.01 + i * .09], [.025, .01, .034]);
    }
    egg(luminous, [0, .24, -.55], [.018, .018, .014]);
  } else {
    // Unsupported catalog entries remain visibly neutral rather than becoming fire.
    egg(skin, [0, .14, .04], [.25, .20, .49]);
    egg(belly, [0, .025, -.04], [.18, .08, .38]);
    egg(skin, [0, .18, -.40], [.26, .19, .23]);
    pairedEyes(.23, -.591, .9);
    grin(.11, -.614);
  }
  b.bake(); group.scale.setScalar(scale);
  group.userData.kind = kind; group.userData.morphed = morphed;
  group.userData.form = morphed ? 'velocimorph' : 'protoform';
  group.userData.archetype = doc ? 'boon-doc' : frost ? 'frostcrawler' : light ? 'phosphoro' : 'unknown';
  for (const child of group.children) if (child.material?.transparent) { child.castShadow = false; child.receiveShadow = false; }
  return group;
}

export function createSlugModel(THREE, slug, { scale = 1, morphed = false } = {}) {
  const imported = applyImportedSlug(THREE, slug, { scale, morphed });
  if (imported) return imported;
  const kind = kindOf(slug);
  if (!['fire', 'electric', 'water'].includes(kind)) return createAdditionalSlugModel(THREE, slug, kind, { scale, morphed });
  const b = helpers(THREE), { group, material, egg, tube, shape, curveShape } = b;
  const electric = kind === 'electric', water = kind === 'water';
  const skin = material('skin', electric ? 0x2583d6 : water ? 0x20bad2 : 0xe95625, { roughness: .46 });
  const dark = material('dorsal', electric ? 0x164991 : water ? 0x167cba : 0xa82c23, { roughness: .51 });
  const belly = material('belly', electric ? 0xf0e890 : water ? 0xb3f4e3 : 0xffcc69, { roughness: .58 });
  const accent = material('crest', electric ? 0xffe343 : water ? 0x6eece0 : 0xffa32b, { glow: electric ? 0xa9910b : water ? 0x126f78 : 0xbb4706, intensity: morphed ? .55 : .1, roughness: .38 });
  const ivory = material('eye-white', 0xfff4ca, { roughness: .35 });
  const pupil = material('pupil', 0x122634, { roughness: .25 });
  const shine = material('eye-shine', 0xffffff, { glow: 0xffffff, intensity: .18 });
  const mouth = material('mouth', water ? 0x164860 : 0x622d30, { roughness: .8 });
  const beak = material('beak', water ? 0xf2c56a : 0xffd771, { roughness: .4 });
  group.name = `${slug?.species || kind} ${morphed ? 'Velocimorph' : 'companion'}`;

  if (!morphed) {
    // Pear-shaped bodies, low tails, and a broad soft belly create a slug silhouette.
    egg(skin, [0, .345, 0], [.255, .355, .225]);
    egg(skin, [0, .13, .19], [.225, .12, .29], [.1, 0, 0]);
    egg(dark, [0, .11, .38], [.14, .075, .18], [.16, 0, 0]);
    egg(belly, [0, .25, -.171], [.171, .223, .062]);
    for (const side of [-1, 1]) {
      egg(skin, [side * .22, .15, -.025], [.085, .065, .13], [0, side * .45, side * .22]);
      egg(belly, [side * .12, .055, -.09], [.085, .033, .11]);
      // Cream eye bulbs, dark pupils and bright highlights are visible at pet scale.
      egg(ivory, [side * .108, .465, -.184], [.089, .113, .064], [0, side * -.12, side * -.10]);
      egg(pupil, [side * .103, .462, -.241], [.036, .065, .018], [0, side * -.1, side * -.10]);
      egg(shine, [side * .103 - .01, .487, -.257], [.012, .018, .006]);
      // A heavy upper lid has an expressive brow, rather than a second set of ears.
      tube(dark, [[side * .035, .541, -.195], [side * .105, .573, -.209], [side * .185, .537, -.18]], .016);
      egg(skin, [side * .178, .346, -.188], [.062, .052, .035]);
    }
    if (water) {
      egg(beak, [0, .322, -.255], [.117, .055, .135], [.04, 0, 0]);
      tube(mouth, [[-.093, .31, -.3], [0, .302, -.376], [.093, .31, -.3]], .009);
      // A swept dorsal sail and paddle-shaped flippers distinguish the aquatic pet.
      shape(accent, [[-.05, 0], [-.12, .15], [.02, .31], [.12, .13], [.18, -.1]], .032, [0, .61, .10], [0, Math.PI / 2, 0]);
      for (const side of [-1, 1]) {
        shape(dark, [[0, 0], [side * .19, -.025], [side * .26, .11], [side * .1, .1]], .022, [side * .19, .17, .04], [Math.PI / 2, 0, 0]);
        tube(accent, [[side * .23, .19, .07], [side * .33, .16, .08], [side * .40, .14, .02]], .012);
      }
      shape(accent, [[-.17, 0], [0, .16], [.17, 0], [0, -.04]], .028, [0, .13, .48], [Math.PI / 2, 0, 0]);
    } else {
      tube(mouth, [[-.10, .304, -.219], [-.05, .273, -.239], [.04, .273, -.239], [.10, .308, -.219]], .012);
      egg(belly, [0, .259, -.225], [.06, .017, .013]);
      if (electric) {
        shape(accent, [[-.085, 0], [-.07, .15], [.025, .12], [-.025, .29], [.14, .12], [.05, .09], [.10, 0]], .045, [0, .649, -.015]);
        // Blue Joules-like body and yellow bolt cheek stripes.
        for (const side of [-1, 1]) {
          shape(accent, [[0, .13], [side * .052, .045], [side * .013, .04], [side * .054, -.055], [-side * .029, .045], [side * .005, .06]], .012, [side * .202, .31, -.115], [0, side * -.58, 0]);
          egg(accent, [side * .138, .125, .264], [.025, .05, .09], [.2, 0, side * .2]);
        }
        shape(accent, [[-.065, 0], [.045, .11], [.005, .13], [.105, .25], [.05, .07], [.1, .08]], .022, [0, .13, .40], [Math.PI / 2, 0, 0]);
      } else {
        // A single curled, three-tongued flame crest; no catlike pointed ears.
        curveShape(accent, p => {
          p.moveTo(-.13, 0); p.bezierCurveTo(-.20, .11, -.12, .22, -.10, .25); p.bezierCurveTo(-.11, .16, -.035, .15, -.04, .23);
          p.bezierCurveTo(-.04, .32, .07, .35, .035, .44); p.bezierCurveTo(.19, .34, .13, .25, .11, .20);
          p.bezierCurveTo(.14, .23, .19, .25, .16, .29); p.bezierCurveTo(.27, .17, .14, .08, .13, 0); p.closePath();
        }, .07, [0, .64, .015]);
        curveShape(belly, p => { p.moveTo(-.065, 0); p.bezierCurveTo(-.1, .11, .025, .14, .025, .25); p.bezierCurveTo(.12, .14, .035, .085, .08, 0);p.closePath(); }, .015, [0, .656, -.031]);
        for (let i = 0; i < 3; i++) egg(accent, [0, .24 - i * .035, .22 + i * .11], [.06 - i * .01, .085 - i * .014, .055], [.3, 0, 0]);
      }
    }
  } else {
    // At velocity the pet unfurls into an armored, aerodynamic elemental creature.
    egg(skin, [0, .12, .04], [.245, .24, .58]);
    egg(dark, [0, .16, .34], [.215, .205, .35], [.08, 0, 0]);
    egg(belly, [0, -.025, -.03], [.165, .08, .5]);
    egg(skin, [0, .145, -.43], [.30, .235, .30]);
    const eyeMat = material('morph-eye', electric ? 0xe9ff7f : water ? 0xffe6a1 : 0xffe979, { glow: electric ? 0xc7d832 : 0xc08024, intensity: .35, roughness: .25 });
    for (const side of [-1, 1]) {
      egg(eyeMat, [side * .18, .23, -.642], [.09, .073, .035], [0, side * -.25, side * -.25]);
      egg(pupil, [side * .173, .226, -.672], [.02, .047, .012], [0, side * -.2, side * -.2]);
      egg(shine, [side * .177, .244, -.682], [.009, .012, .004]);
      tube(dark, [[side * .085, .285, -.63], [side * .17, .311, -.64], [side * .258, .285, -.56]], .027);
      egg(dark, [side * .19, .06, -.47], [.10, .095, .18], [.2, side * -.2, 0]);
    }
    for (let i = 0; i < 4; i++) {
      egg(accent, [0, .31 - i * .022, -.13 + i * .205], [.18 - i * .023, .065, .14], [.16, 0, 0]);
    }
    if (water) {
      egg(beak, [0, .09, -.716], [.16, .085, .23], [.04, 0, 0]);
      tube(mouth, [[-.12, .062, -.77], [0, .043, -.92], [.12, .062, -.77]], .011);
      shape(accent, [[-.36, 0], [-.24, .25], [.13, .48], [.38, .18], [.48, .02]], .04, [0, .26, .04], [0, Math.PI / 2, 0]);
      for (const side of [-1, 1]) {
        const points=[[side * .16, -.21], [side * .39, -.40], [side * .84, .14], [side * .69, .45], [side * .34, .33], [side * .18, .46]];
        shape(accent, points, .035, [0, .06, .01], [Math.PI / 2, 0, 0]);
        tube(dark, [[side * .20, .085, -.17], [side * .44, .085, -.11], [side * .75, .085, .16]], .018);
        tube(belly, [[side * .22, .083, .10], [side * .42, .083, .19], [side * .62, .083, .35]], .012);
      }
      shape(accent, [[-.32, .08], [-.13, -.13], [0, -.02], [.13, -.13], [.32, .08], [.13, .30], [0, .22], [-.13, .30]], .035, [0, .12, .69], [Math.PI / 2, 0, 0]);
    } else if (electric) {
      egg(belly, [0, .08, -.665], [.14, .065, .075]);
      tube(mouth, [[-.1, .065, -.699], [0, .048, -.725], [.1, .065, -.699]], .012);
      for (const side of [-1, 1]) {
        const points=[[side * .16, -.32], [side * .65, -.49], [side * .49, -.13], [side * .91, -.04], [side * .62, .15], [side * .81, .35], [side * .20, .29]];
        shape(accent, points, .04, [0, .13, .04], [Math.PI / 2, 0, 0]);
        shape(dark, [[side * .19, -.22], [side * .55, -.29], [side * .40, -.06], [side * .68, .02], [side * .34, .16]], .02, [0, .159, .04], [Math.PI / 2, 0, 0]);
        tube(accent, [[side * .15, .30, -.36], [side * .24, .48, -.21], [side * .19, .42, -.08], [side * .29, .56, .07]], .035);
        shape(accent, [[0, .1], [.10, -.02], [.03, -.03], [.15, -.22], [-.02, -.09], [.03, -.08]], .02, [side * .255, .15, -.23], [0, side * -.65, 0]);
      }
      shape(accent, [[-.10, 0], [.10, .12], [0, .15], [.15, .34], [-.12, .17], [-.04, .14]], .045, [0, .13, .58], [Math.PI / 2, 0, 0]);
    } else {
      egg(belly, [0, .07, -.663], [.157, .075, .092]);
      tube(mouth, [[-.13, .077, -.711], [0, .032, -.757], [.13, .077, -.711]], .015);
      for (const side of [-1, 1]) {
        tube(accent, [[side * .15, .32, -.39], [side * .30, .53, -.26], [side * .26, .62, -.40], [side * .15, .49, -.50]], .047);
        const points=[[side * .17, -.28], [side * .37, -.40], [side * .75, -.28], [side * .62, -.04], [side * .85, .15], [side * .51, .20], [side * .42, .43], [side * .21, .32]];
        shape(accent, points, .04, [0, .14, .03], [Math.PI / 2, 0, 0]);
        shape(belly, [[side * .26, -.22], [side * .59, -.22], [side * .45, .01], [side * .66, .12], [side * .36, .12], [side * .30, .29]], .022, [0, .168, .03], [Math.PI / 2, 0, 0]);
        tube(dark, [[side * .20, .18, -.25], [side * .44, .18, -.18], [side * .68, .18, -.25]], .027);
      }
      curveShape(accent, p => {p.moveTo(-.14,0);p.bezierCurveTo(-.26,.13,-.04,.29,-.10,.43);p.bezierCurveTo(.05,.35,.04,.20,.11,.24);p.bezierCurveTo(.13,.30,.20,.31,.17,.37);p.bezierCurveTo(.35,.14,.09,.08,.14,0);p.closePath();}, .065, [0, .12, .59], [Math.PI / 2, 0, 0]);
      curveShape(belly, p => {p.moveTo(-.06,0);p.bezierCurveTo(-.14,.10,.07,.17,.025,.30);p.bezierCurveTo(.19,.12,.02,.09,.07,0);p.closePath();}, .025, [0, .16, .61], [Math.PI / 2, 0, 0]);
    }
  }
  b.bake(); group.scale.setScalar(scale); group.userData.kind = kind; group.userData.morphed = morphed;
  group.userData.form = morphed ? 'velocimorph' : 'protoform';
  group.userData.archetype = ({ fire: 'infurnus', electric: 'tazerling', water: 'aquabeek' })[kind];
  return group;
}

export function createBlasterModel(THREE, slugs = []) {
  const b = helpers(THREE), { group, material, add, egg, box, tube, shape } = b;
  group.name = 'Ranger slug blaster';
  const shell = material('gunmetal', 0x263744, { metalness: .72, roughness: .34 });
  const silver = material('brushed silver', 0xa9bbc1, { metalness: .83, roughness: .28 });
  const edge = material('pale edges', 0xd1d9d6, { metalness: .78, roughness: .26 });
  const dark = material('bore and rubber', 0x101e28, { metalness: .25, roughness: .72 });
  const orange = material('orange panels', 0xe57831, { metalness: .38, roughness: .41 });
  const glow = material('charge strips', 0xffba65, { glow: 0xffa540, intensity: 1.15, metalness: .22, roughness: .28 });
  const screw = material('fasteners', 0x546c77, { metalness: .85, roughness: .27 });
  function cylinder(mat, radius, length, x, y, z, open = false, top = radius, parent) {
    return add(new THREE.CylinderGeometry(top, radius, length, 24, 1, open), mat, [x, y, z], undefined, [Math.PI / 2, 0, 0], parent);
  }
  function ring(mat, radius, thickness, x, y, z, parent) {return add(new THREE.TorusGeometry(radius, thickness, 7, 28),mat,[x,y,z],undefined,undefined,parent);}
  // Beveled mechanical side profile. Stock and orange side plates hug the chamber.
  const profile=[[-.215,-.065],[-.22,.07],[-.12,.105],[.16,.105],[.235,.06],[.26,-.06],[.12,-.095],[-.04,-.08]];
  shape(shell,profile,.205,[0,0,0],[0,Math.PI/2,0]);
  for(const side of [-1,1]){
    shape(orange,[[-.18,-.04],[-.18,.056],[-.08,.079],[.07,.079],[.105,.025],[.065,-.05],[-.045,-.065]],.013,[side*.111,-.005,.015],[0,Math.PI/2,0]);
    shape(silver,[[.11,-.071],[.105,.04],[.17,.055],[.225,.02],[.23,-.048]],.014,[side*.111,0,0],[0,Math.PI/2,0]);
    for(const z of [-.13,.12])egg(screw,[side*.122,.014,z],[.009,.015,.015]);
    box(dark,[side*.123,-.025,.038],[.005,.012,.085]);
    box(silver,[side*.129,-.025,.04],[.006,.004,.072]);
  }
  // Broad barrel with actual dark bore, a layered muzzle crown and rifling spokes.
  cylinder(silver,.086,.31,0,.055,-.315,true);
  cylinder(shell,.096,.12,0,.055,-.188,true);
  cylinder(dark,.066,.21,0,.055,-.439,true);
  ring(edge,.087,.012,0,.055,-.535);
  ring(shell,.073,.008,0,.055,-.544);
  ring(silver,.060,.006,0,.055,-.547);
  add(new THREE.CircleGeometry(.055,24),dark,[0,.055,-.37],undefined,[0,Math.PI,0]);
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const spoke=box(screw,[Math.cos(a)*.069,.055+Math.sin(a)*.069,-.49],[.009,.012,.075],[0,0,a]);
    spoke.rotation.y=.16;
  }
  for(const z of [-.38,-.28])ring(shell,.087,.007,0,.055,z);
  // Orange forward shroud and thin exposed silver cooling rails.
  for(const side of [-1,1]){
    box(orange,[side*.09,.047,-.285],[.018,.088,.23]);
    for(let i=0;i<3;i++)box(dark,[side*.101,.047,-.355+i*.052],[.005,.048,.017]);
    box(edge,[side*.067,.132,-.274],[.018,.014,.25]);
    box(glow,[side*.061,.143,-.275],[.009,.005,.16]);
  }
  // Pistol grip, rubber finger grooves, heel plate, trigger and open guard.
  box(shell,[0,-.174,.13],[.115,.238,.105],[-.22,0,0]);
  for(const side of [-1,1]){
    box(dark,[side*.060,-.175,.13],[.008,.175,.074],[-.22,0,0]);
    for(let i=0;i<4;i++)box(screw,[side*.066,-.118-i*.035,.135+i*.006],[.006,.008,.06],[-.22,0,0]);
  }
  box(orange,[0,-.291,.105],[.13,.025,.10],[-.22,0,0]);
  tube(silver,[[0,-.075,-.015],[0,-.17,-.038],[0,-.208,.045],[0,-.19,.088]],.015);
  tube(dark,[[0,-.076,.005],[0,-.122,.001],[0,-.146,.026]],.013);
  // The glass cartridge is recessed inside a protective bridge, not above the bore.
  cylinder(shell,.101,.033,0,.115,.162,true);
  cylinder(silver,.103,.027,0,.115,-.039,true);
  for(const side of [-1,1]){
    box(shell,[side*.088,.048,.065],[.019,.017,.20]);
    box(shell,[side*.088,.188,.065],[.016,.014,.20]);
    box(silver,[side*.087,.209,.065],[.023,.019,.22]);
    box(orange,[side*.108,.113,.146],[.019,.105,.025]);
  }
  box(shell,[0,.221,.065],[.17,.024,.23]);
  box(silver,[0,.241,-.05],[.044,.019,.33]);
  for(let i=0;i<6;i++)box(dark,[0,.252,-.178+i*.054],[.054,.008,.016]);
  box(shell,[0,.273,-.19],[.036,.035,.026]);
  egg(glow,[0,.289,-.199],[.008,.007,.005]);
  for(const side of [-1,1])box(shell,[side*.031,.272,.163],[.016,.035,.022]);
  box(edge,[0,.265,.174],[.08,.014,.018]);
  b.bake();

  const glassMaterial=new THREE.MeshPhysicalMaterial({color:0x8dc6cf,metalness:.05,roughness:.1,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide,clearcoat:1});
  const glass=cylinder(glassMaterial,.089,.17,0,.115,.065,true);glass.renderOrder=3;glass.castShadow=false;
  const carousel=new THREE.Group();carousel.position.set(0,.115,.065);group.add(carousel);
  const chamberEnds=[];
  for(const z of [-.08,.08]){
    const c=ring(screw,.075,.009,0,0,z,carousel);chamberEnds.push(c);
    for(let i=0;i<4;i++){const a=i/4*Math.PI*2;box(glow,[Math.cos(a)*.071,Math.sin(a)*.071,z],[.012,.012,.02],undefined,carousel);}
  }
  let companion = null, selected = -1, selectedIdentity = null, time = 0;
  const equipment = new THREE.Group(); equipment.name = 'Equipment tuning'; group.add(equipment);
  let weaponIdentity = null, lastWeaponSpec = null, uploadedWeapon = null;
  function disposeMeshes(root) {
    const geometries = new Set(), materials = new Set(), skeletons = new Set();
    root.traverse(o => {
      if (o.isSkinnedMesh && o.skeleton) skeletons.add(o.skeleton);
      if (o.isMesh && !o.userData.importedSharedResources) { geometries.add(o.geometry); for (const m of (Array.isArray(o.material) ? o.material : [o.material])) materials.add(m); }
    });
    skeletons.forEach(s => s.dispose());
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
  function setSlug(index) {
    const next = slugs.length ? (Number.isInteger(index) && index >= 0 && index < slugs.length ? index : 0) : -1;
    const slug = slugs[next];
    const identity = slug ? JSON.stringify([slug.id, slug.speciesId, slug.species, slug.modelArchetype, slug.archetype, slug.element, slug.color]) : 'empty';
    if (next === selected && identity === selectedIdentity) return;
    if (companion) { carousel.remove(companion); disposeMeshes(companion); companion = null; }
    selected = next; selectedIdentity = identity;
    if (slug) {
      companion = createSlugModel(THREE, slug, { scale: .148 });
      companion.position.set(0, -.071, .005); companion.rotation.y = 2.6; carousel.add(companion);
    }
    const color = new THREE.Color(slug?.color || 0xffb85f); glow.color.copy(color); glow.emissive.copy(color);
    group.userData.loadedSlugId = slug?.id ?? null;
  }
  function setRoster(roster) {
    slugs = Array.isArray(roster) ? roster : [];
    setSlug(selected);
  }
  function setWeapon(spec = null) {
    const value = typeof spec === 'string' ? { id: spec } : spec || {};
    lastWeaponSpec = value;
    const identity = JSON.stringify([value.id, value.name, value.tier, value.accent, value.color, value.shellColor, value.metalness, value.roughness]);
    if (identity === weaponIdentity) return;
    weaponIdentity = identity;
    // Restore original housing and alignment for the standard blaster. Tuning is
    // purely visual; cadence, recoil and damage stay with the gameplay catalog.
    const id = value.id || 'standard';
    const tier = Math.max(0, Math.min(2, Number(value.tier) || (id === 'breaker' ? 2 : id === 'rapid' ? 1 : 0)));
    orange.color.set(value.accent || value.color || (id === 'breaker' ? 0xf2a96d : id === 'rapid' ? 0x7cd4f5 : 0xe57831));
    shell.color.set(value.shellColor || (id === 'breaker' ? 0x3a3331 : id === 'rapid' ? 0x183d52 : 0x263744));
    shell.metalness = Number.isFinite(value.metalness) ? Math.max(0, Math.min(1, value.metalness)) : .72;
    shell.roughness = Number.isFinite(value.roughness) ? Math.max(0, Math.min(1, value.roughness)) : .34;
    silver.color.set(id === 'breaker' ? 0xbfb5a3 : id === 'rapid' ? 0xc5e2e9 : 0xa9bbc1);
    // These meshes own only their geometry; their materials belong to the gun.
    for (const child of [...equipment.children]) { equipment.remove(child); child.geometry.dispose(); }
    if (tier > 0) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < (tier === 2 ? 4 : 3); i++) {
          box(silver, [side * .115, .057, -.36 + i * .045], [tier === 2 ? .027 : .014, .105, .014], undefined, equipment);
        }
        box(orange, [side * .086, .172, -.29], [tier === 2 ? .035 : .018, .026, .135], undefined, equipment);
      }
      if (tier === 2) {
        cylinder(shell, .028, .14, 0, .302, -.015, false, .028, equipment);
        ring(edge, .026, .005, 0, .302, -.09, equipment);
      } else {
        box(silver, [0, .286, .06], [.045, .025, .08], undefined, equipment);
        box(dark, [0, .304, .06], [.032, .01, .06], undefined, equipment);
      }
    }
    group.name = value.name ? `${value.name} slug blaster` : 'Ranger slug blaster';
    group.userData.weaponId = id; group.userData.weaponTier = tier;
    if (uploadedWeapon) { group.remove(uploadedWeapon); uploadedWeapon = null; }
    uploadedWeapon = createImportedBlaster(THREE, value);
    for (const child of group.children) child.visible = !uploadedWeapon || child === carousel;
    if (uploadedWeapon) { group.add(uploadedWeapon); group.userData.importedWeapon = true; }
    else group.userData.importedWeapon = false;
  }
  function refreshImported() {
    selectedIdentity = null; setSlug(selected);
    weaponIdentity = null; setWeapon(lastWeaponSpec);
  }
  setSlug(0);
  const muzzle=new THREE.Vector3(0,.055,-.553);
  return {
    group,muzzle,setSlug,setRoster,setWeapon,refreshImported,
    update(dt,{recoil=0,aiming=false,cooldown=0}={}){
      time+=Math.min(.1,Math.max(0,Number(dt)||0));
      // A little chamber indexing and charging glow show the action inside the housing.
      carousel.rotation.z=THREE.MathUtils.lerp(carousel.rotation.z,Math.min(1,Math.max(0,cooldown))*.33,Math.min(1,dt*9));
      chamberEnds.forEach((ring,i)=>{ring.rotation.z=time*.2*(i?1:-1);});
      glass.material.opacity=aiming?.2:.26;
      glow.emissiveIntensity=1.05+Math.min(1,Math.max(0,recoil))*.9+Math.min(1,Math.max(0,cooldown))*.45;
    },
  };
}
