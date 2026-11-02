import { Box3, Matrix4, Ray, Triangle, Vector3, BackSide, DoubleSide } from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

const SKIN = 1e-5;

// Three's generic Octree creates children with default depth/leaf settings.
// Keep collision-specific limits on every child to avoid extreme subdivision
// of the dense mushroom canopies while retaining all original triangles.
class CollisionOctree extends Octree {
  constructor(box) { super(box); this.maxLevel = 8; this.trianglesPerLeaf = 32; }
  split(level) {
    const half = this.box.getSize(new Vector3()).multiplyScalar(.5), children = [];
    for (let x=0;x<2;x++) for(let y=0;y<2;y++) for(let z=0;z<2;z++) {
      const min = this.box.min.clone().add(new Vector3(x*half.x,y*half.y,z*half.z));
      children.push(new CollisionOctree(new Box3(min,min.clone().add(half))));
    }
    for (const triangle of this.triangles) for (const child of children) if (child.box.intersectsTriangle(triangle)) child.triangles.push(triangle);
    this.triangles.length = 0;
    for(const child of children) if(child.triangles.length) {
      if(child.triangles.length > this.trianglesPerLeaf && level < this.maxLevel) child.split(level+1);
      this.subTrees.push(child);
    }
    return this;
  }
}


/** Compile explicit structural meshes only. Render detail never silently becomes solid. */
export function createSceneCollision(group) {
  const octree = new CollisionOctree();
  const solids = [];
  const instance = new Matrix4(), transform = new Matrix4();
  let triangleCount = 0;
  group.updateWorldMatrix(true, true);
  group.traverse(object => {
    if (!object.isMesh || object.userData.collisionSolid !== true) return;
    const geometry = object.geometry, positions = geometry?.attributes.position;
    if (!positions) return;
    const index = geometry.index;
    const count = index?.count ?? positions.count;
    const copies = object.isInstancedMesh ? object.count : 1;
    for (let copy = 0; copy < copies; copy++) {
      if (object.isInstancedMesh) { object.getMatrixAt(copy, instance); transform.multiplyMatrices(object.matrixWorld, instance); }
      else transform.copy(object.matrixWorld);
      const triangles = [], box = new Box3();
      for (let i = 0; i + 2 < count; i += 3) {
        const at = offset => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset).applyMatrix4(transform);
        const a = at(0), b = at(1), c = at(2);
        if (![a,b,c].every(v => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z))) continue;
        const triangle = new Triangle(a, b, c);
        if (triangle.getArea() < 1e-10) continue;
        triangles.push(triangle); box.expandByPoint(a); box.expandByPoint(b); box.expandByPoint(c);
        const materialIndex = geometry.groups.find(g => i >= g.start && i < g.start + g.count)?.materialIndex || 0;
        const material = Array.isArray(object.material) ? object.material[materialIndex] : object.material;
        const reversed = transform.determinant() < 0;
        const side = material?.side;
        if (side === DoubleSide || ((side !== BackSide) !== reversed)) { octree.addTriangle(triangle); triangleCount++; }
        if (side === DoubleSide || ((side === BackSide) !== reversed)) { octree.addTriangle(new Triangle(c.clone(), b.clone(), a.clone())); triangleCount++; }
      }
      if (triangles.length) solids.push({ box, triangles, recoverVolume: !Array.isArray(object.material) && ![BackSide, DoubleSide].includes(object.material?.side) });
    }
  });
  // Pad both sides: floating-point child-box subdivision must not discard
  // triangles lying exactly on the global maximum face (platform tops).
  if (triangleCount) { octree.bounds.expandByScalar(.01); octree.build(); }
  const capsule = new Capsule();
  const ray = new Ray(), origin = new Vector3(), direction = new Vector3(), point = new Vector3();
  let disposed = false;
  const optionsFor = (options = {}) => ({ radius: options.radius ?? .38, eyeHeight: options.eyeHeight ?? 1.85 });
  function setCapsule(position, options) {
    const { radius, eyeHeight } = optionsFor(options);
    const bottom = position.y - eyeHeight + radius;
    capsule.radius = radius;
    capsule.start.set(position.x, bottom, position.z);
    capsule.end.set(position.x, Math.max(bottom, position.y + .12 - radius), position.z);
  }
  function resolve(position, velocity, options, contacts) {
    setCapsule(position, options);
    for (let iteration = 0; iteration < 8; iteration++) {
      const candidates = [];
      octree.getCapsuleTriangles(capsule, candidates);
      let deepest = null;
      for (const triangle of candidates) {
        const contact = octree.triangleCapsuleIntersect(capsule, triangle);
        if (contact && contact.depth > SKIN && contact.normal.lengthSq() > .5 && (!deepest || contact.depth > deepest.depth)) deepest = contact;
      }
      if (!deepest) break;
      const n = deepest.normal;
      const distance = deepest.depth + SKIN;
      if (n.y >= .6) {
        // A walking character climbs a walkable surface vertically, without
        // converting forward/sideways intent into downhill lateral drift.
        // Full normal projection remains necessary for walls and ceilings.
        const lift = distance / n.y;
        capsule.translate(new Vector3(0, lift, 0)); position.y += lift;
        if (velocity.y < 0) velocity.y = 0;
      } else {
        capsule.translate(n.clone().multiplyScalar(distance));
        position.x += n.x * distance; position.y += n.y * distance; position.z += n.z * distance;
        const inward = velocity.x * n.x + velocity.y * n.y + velocity.z * n.z;
        if (inward < 0) { velocity.x -= inward * n.x; velocity.y -= inward * n.y; velocity.z -= inward * n.z; }
      }
      contacts.push({ x: n.x, y: n.y, z: n.z });
    }
  }
  function move(position, desired, velocity, options = {}) {
    if (disposed || !triangleCount) { Object.assign(position, desired); return { grounded: false, ceiling: false, contacts: [] }; }
    const { radius } = optionsFor(options);
    const dx = desired.x - position.x, dy = desired.y - position.y, dz = desired.z - position.z;
    // Subdivide the spatial sweep as well as time: even externally restored high
    // velocity cannot skip a thin triangle wall between fixed simulation ticks.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / Math.max(.04, radius * .35)));
    const contacts = [];
    for (let i = 0; i < steps; i++) {
      position.x += dx / steps; position.y += dy / steps; position.z += dz / steps;
      resolve(position, velocity, options, contacts);
    }
    return { grounded: contacts.some(n => n.y >= .6), ceiling: contacts.some(n => n.y <= -.6), contacts };
  }
  function segmentHit(start, end) {
    if (disposed || !triangleCount) return null;
    origin.set(start.x, start.y, start.z); direction.set(end.x-start.x,end.y-start.y,end.z-start.z);
    const length = direction.length(); if (length < 1e-10) return null;
    ray.set(origin, direction.multiplyScalar(1/length));
    const hit = octree.rayIntersect(ray);
    return hit && hit.distance <= length + SKIN ? Math.max(0, Math.min(1, hit.distance / length)) : null;
  }
  function groundHeight(x, z, maxY) {
    if (disposed || !triangleCount || !Number.isFinite(maxY)) return -Infinity;
    ray.set(origin.set(x, maxY + .001, z), direction.set(0,-1,0));
    const hit = octree.rayIntersect(ray);
    if (!hit || hit.triangle.getNormal(point).y < .6) return -Infinity;
    return hit.position.y;
  }
  function intersections(solid, p, d) {
    ray.set(origin.copy(p), direction.copy(d));
    const distances = [];
    for (const triangle of solid.triangles) {
      if (!ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,point)) continue;
      const distance = point.distanceTo(origin);
      if (distance > SKIN && !distances.some(v => Math.abs(v-distance)<1e-4)) distances.push(distance);
    }
    return distances.sort((a,b)=>a-b);
  }
  function recover(position, velocity = {x:0,y:0,z:0}, options = {}) {
    if (disposed || !triangleCount) return { grounded:false,ceiling:false,contacts:[] };
    const {radius,eyeHeight} = optionsFor(options);
    const center = new Vector3(position.x, position.y-eyeHeight*.5, position.z);
    for (const solid of solids) {
      if (!solid.recoverVolume || !solid.box.containsPoint(center)) continue;
      if (intersections(solid,center,new Vector3(1,.137,.271).normalize()).length % 2 !== 1) continue;
      let best = null;
      for (const d of [new Vector3(-1,0,0),new Vector3(1,0,0),new Vector3(0,0,-1),new Vector3(0,0,1)]) {
        const distance = intersections(solid,center,d)[0];
        if (Number.isFinite(distance) && (!best || distance<best.distance)) best={d,distance};
      }
      if (best) { position.x+=best.d.x*(best.distance+radius+SKIN*2);position.z+=best.d.z*(best.distance+radius+SKIN*2);center.set(position.x,position.y-eyeHeight*.5,position.z); }
    }
    return move(position,{...position},velocity,options);
  }
  return { move, recover, segmentHit, groundHeight, triangleCount, solidCount: solids.length, dispose() { disposed=true; octree.clear(); solids.length=0; } };
}
