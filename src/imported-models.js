import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { alignImportedBlaster } from './blaster-alignment.js';
import burpyURL from './assets/models/runtime/burpy.glb?url&inline';
import joulesURL from './assets/models/runtime/joules.glb?url&inline';
import blasterURL from './assets/models/runtime/blaster.glb?url&inline';
import breakerURL from './assets/models/runtime/x-duty.glb?url&inline';
import rapidURL from './assets/models/runtime/renegade.glb?url&inline';
import eliURL from './assets/models/runtime/eli.glb?url&inline';
import shellURL from './assets/models/runtime/shell.glb?url&inline';
import suppliedCredits from './assets/models/credits.json';

// Originals and supplied attribution are retained under assets/models. Runtime
// copies reduce mesh density, embed their images and need no network access.
const sources = { burpy: burpyURL, joules: joulesURL, standard: blasterURL, breaker: breakerURL, rapid: rapidURL, eli: eliURL, shell: shellURL };
const cache = new Map(), failures = new Map();
let preparation = null;
const loader = new GLTFLoader();

export const IMPORTED_MODEL_CREDITS = Object.freeze(suppliedCredits);

export function getImportedModelStatus() {
  return { ready: cache.size, total: Object.keys(sources).length, loading: Boolean(preparation) && cache.size + failures.size < Object.keys(sources).length, models: [...cache.keys()], failed: [...failures.keys()] };
}

export function prepareImportedModels() {
  if (preparation) return preparation;
  preparation = Promise.all(Object.entries(sources).map(async ([id, url]) => {
    try {
      const asset = await loader.loadAsync(url);
      asset.scene.updateMatrixWorld(true);
      cache.set(id, asset);
    } catch (error) { failures.set(id, error?.message || 'Model could not be decoded'); }
  })).then(() => getImportedModelStatus());
  return preparation;
}

function instance(id) {
  const asset = cache.get(id);
  if (!asset) return null;
  const scene = cloneSkeleton(asset.scene);
  scene.traverse(object => {
    if (!object.isMesh) return;
    // Geometry/materials/textures belong to the immutable page-lifetime cache.
    // Scene cleanup must skip shared resources while removing each instance.
    object.userData.importedSharedResources = true;
    object.castShadow = true; object.receiveShadow = true;
  });
  return scene;
}

function normalized(id, height, yaw = Math.PI) {
  const scene = instance(id);
  if (!scene) return null;
  const group = new THREE.Group(), content = new THREE.Group();
  content.rotation.y = yaw; content.add(scene); group.add(content);
  // SkinnedMesh updates its inverse bind transform in updateMatrixWorld,
  // not updateWorldMatrix (which Box3 uses internally). Refresh the whole rig
  // first, then measure deformed vertices rather than a stale bind-pose box.
  group.updateMatrixWorld(true);
  content.traverse(object => { if (object.skeleton) object.skeleton.update(); });
  const box = new THREE.Box3().setFromObject(content, true), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const ratio = height / Math.max(size.y, 0.0001);
  content.scale.setScalar(ratio);
  content.position.set(-center.x * ratio, -box.min.y * ratio, -center.z * ratio);
  group.updateMatrixWorld(true);
  group.name = `Uploaded ${id}`; group.userData.importedModelId = id;
  return group;
}

export function applyImportedSlug(_THREE, slug, { scale = 1, morphed = false } = {}) {
  if (morphed) return null;
  const id = slug?.id === 'ember' || slug?.species === 'Infurnus' ? 'burpy' : slug?.id === 'volt' || slug?.species === 'Tazerling' ? 'joules' : null;
  if (!id) return null;
  const group = normalized(id, 1.3);
  if (!group) return null;
  group.scale.setScalar(scale); group.kind = slug.element; group.form = 'protoform';
  group.userData.form = 'protoform'; group.userData.slugId = slug.id;
  return group;
}

export function createImportedCharacter(_THREE, { height = 1.9 } = {}) {
  return normalized('eli', height);
}

export function createImportedShell(_THREE, { height = 0.22 } = {}) {
  return normalized('shell', height, 0);
}

export function createImportedBlaster(_THREE, spec = {}) {
  const id = typeof spec === 'string' ? spec : spec.id || 'standard';
  const scene = instance(id);
  return alignImportedBlaster(scene, id);
}
