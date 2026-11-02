const EPS = 1e-6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Earliest point of entry, as a fraction of the segment, including initial overlap. */
export function segmentSphereHit(start, end, center, radius) {
  const x = start.x - center.x, y = start.y - center.y, z = start.z - center.z;
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < EPS) return null;
  const b = x * dx + y * dy + z * dz, discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

/** A vertical capsule: center is its midpoint; halfHeight is half the center-line. */
export function segmentCapsuleHit(start, end, center, radius, halfHeight) {
  halfHeight = Math.max(0, halfHeight);
  const relativeY = clamp(start.y - center.y, -halfHeight, halfHeight);
  const nearest = { x: center.x, y: center.y + relativeY, z: center.z };
  if ((start.x - nearest.x) ** 2 + (start.y - nearest.y) ** 2 + (start.z - nearest.z) ** 2 <= radius * radius) return 0;
  let result = null;
  const take = t => { if (t !== null && (result === null || t < result)) result = t; };
  for (const side of [-1, 1]) take(segmentSphereHit(start, end, { x: center.x, y: center.y + side * halfHeight, z: center.z }, radius));
  const x = start.x - center.x, z = start.z - center.z;
  const dx = end.x - start.x, dz = end.z - start.z;
  const a = dx * dx + dz * dz, b = x * dx + z * dz;
  const c = x * x + z * z - radius * radius;
  const discriminant = b * b - a * c;
  if (a > EPS && discriminant >= 0) {
    for (const t of [(-b - Math.sqrt(discriminant)) / a, (-b + Math.sqrt(discriminant)) / a]) {
      const y = start.y + (end.y - start.y) * t;
      if (t >= 0 && t <= 1 && Math.abs(y - center.y) <= halfHeight + EPS) take(t);
    }
  }
  return result;
}

/** Terrain sweep with <=20cm sampling and a refined first crossing. */
export function firstTerrainHit(start, end, groundHeight, radius = 0.1) {
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const distance = Math.hypot(dx, dy, dz);
  const clearance = t => start.y + dy * t - radius - groundHeight(start.x + dx * t, start.z + dz * t);
  if (clearance(0) <= 0) return 0;
  const steps = Math.max(1, Math.ceil(distance / 0.2));
  let last = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (clearance(t) <= 0) {
      let lo = last, hi = t;
      for (let j = 0; j < 16; j++) {
        const mid = (lo + hi) * 0.5;
        if (clearance(mid) <= 0) hi = mid; else lo = mid;
      }
      return hi;
    }
    last = t;
  }
  return null;
}

/** Accelerated, swept-circle character controller. Position is the player's eye. */
export function createCharacterPhysics({ position, groundHeight, colliders = [], bounds = 88, eyeHeight = 1.85, getCollisionWorld = () => null }) {
  const velocity = { x: 0, y: 0, z: 0 };
  const radius = 0.38, gravity = 22, jumpSpeed = 8, maxStep = 0.48, maxSlope = Math.tan(Math.PI * 0.3);
  let grounded = false, heldJump = false, jumpBuffer = 0, coyote = 0;

  function floorAt(x, z) {
    const support = getCollisionWorld()?.groundHeight(x, z, position.y - eyeHeight + 0.06) ?? -Infinity;
    return Math.max(groundHeight(x, z), support) + eyeHeight;
  }
  function moveThroughGeometry(previous) {
    const collision = getCollisionWorld();
    if (!collision) return null;
    const desired = { x: position.x, y: position.y, z: position.z };
    Object.assign(position, previous);
    return collision.move(position, desired, velocity, { eyeHeight, radius });
  }
  function overlapsHeight(collider) {
    return position.y - eyeHeight + 0.08 < (collider.top ?? Infinity) && position.y + 0.12 > (collider.bottom ?? -Infinity);
  }
  function reset(next) {
    if (next) { position.x = next.x; position.y = next.y; position.z = next.z; }
    velocity.x = velocity.y = velocity.z = 0;
    heldJump = false; jumpBuffer = 0;
    getCollisionWorld()?.recover(position, velocity, { eyeHeight, radius });
    const floor = floorAt(position.x, position.z);
    grounded = position.y <= floor + 0.08;
    if (grounded) position.y = floor;
    coyote = grounded ? 0.1 : 0;
  }

  function slide(dx, dz) {
    // Recover cleanly from a restored save inside a tree or a moving obstacle.
    for (let iteration = 0; iteration < 3; iteration++) {
      let pushed = false;
      for (const collider of colliders) {
        if (!overlapsHeight(collider)) continue;
        const size = radius + collider.radius;
        let nx = position.x - collider.x, nz = position.z - collider.z;
        const distance = Math.hypot(nx, nz);
        if (distance < size - EPS) {
          if (distance < EPS) { nx = 1; nz = 0; } else { nx /= distance; nz /= distance; }
          const push = size - distance + EPS;
          position.x += nx * push; position.z += nz * push;
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    for (let iteration = 0; iteration < 4 && Math.hypot(dx, dz) > EPS; iteration++) {
      let hit = null, hitT = 1;
      for (const collider of colliders) {
        if (!overlapsHeight(collider)) continue;
        const x = position.x - collider.x, z = position.z - collider.z;
        const r = radius + collider.radius;
        const a = dx * dx + dz * dz, b = x * dx + z * dz, c = x * x + z * z - r * r;
        // At contact, motion away from the surface must remain unconstrained.
        if (c <= EPS && b >= 0) continue;
        const discriminant = b * b - a * c;
        if (discriminant < 0 || a < EPS) continue;
        const t = (-b - Math.sqrt(discriminant)) / a;
        if (t >= -EPS && t < hitT) { hitT = Math.max(0, t); hit = collider; }
      }
      if (!hit) { position.x += dx; position.z += dz; break; }
      const safeT = Math.max(0, hitT - EPS / Math.max(EPS, Math.hypot(dx, dz)));
      position.x += dx * safeT; position.z += dz * safeT;
      let nx = position.x - hit.x, nz = position.z - hit.z;
      const length = Math.hypot(nx, nz) || 1; nx /= length; nz /= length;
      dx *= 1 - safeT; dz *= 1 - safeT;
      const inward = Math.min(0, dx * nx + dz * nz);
      dx -= inward * nx; dz -= inward * nz;
      const speedIn = Math.min(0, velocity.x * nx + velocity.z * nz);
      velocity.x -= speedIn * nx; velocity.z -= speedIn * nz;
    }
    const edge = bounds - radius, distance = Math.hypot(position.x, position.z);
    if (distance > edge) {
      const nx = position.x / distance, nz = position.z / distance;
      position.x = nx * edge; position.z = nz * edge;
      const outward = Math.max(0, velocity.x * nx + velocity.z * nz);
      velocity.x -= outward * nx; velocity.z -= outward * nz;
    }
  }

  function integrate(dt, input) {
    const currentFloor = floorAt(position.x, position.z);
    if (position.y <= currentFloor + 0.06 && velocity.y <= 0) {
      position.y = currentFloor; grounded = true; velocity.y = 0;
    } else if (getCollisionWorld() && position.y > currentFloor + 0.08) grounded = false;
    coyote = grounded ? 0.1 : Math.max(0, coyote - dt);
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && coyote > 0) {
      velocity.y = jumpSpeed; grounded = false; coyote = 0; jumpBuffer = 0;
    }
    let x = Number.isFinite(input.x) ? input.x : 0, z = Number.isFinite(input.z) ? input.z : 0;
    const inputLength = Math.hypot(x, z);
    if (inputLength > 1) { x /= inputLength; z /= inputLength; }
    const speed = input.aiming ? 4.2 : input.sprint ? 12 : 6.5;
    const response = grounded ? (inputLength > 0 ? 13 : 17) : (inputLength > 0 ? 3.2 : 0.35);
    const attenuation = Math.exp(-response * dt);
    const targetX = x * speed, targetZ = z * speed;
    // Integrate the exponentially approaching velocity analytically.
    const dx = targetX * dt + (velocity.x - targetX) * (1 - attenuation) / response;
    const dz = targetZ * dt + (velocity.z - targetZ) * (1 - attenuation) / response;
    velocity.x = targetX + (velocity.x - targetX) * attenuation;
    velocity.z = targetZ + (velocity.z - targetZ) * attenuation;
    const oldX = position.x, oldZ = position.z;
    const beforeHorizontal = { x: position.x, y: position.y, z: position.z };
    const walkingOnSupport = grounded;
    slide(dx, dz);
    const horizontalContact = moveThroughGeometry(beforeHorizontal);
    const geometrySupport = horizontalContact?.grounded && (walkingOnSupport || velocity.y <= 0);
    if (geometrySupport) grounded = true;
    let nextFloor = floorAt(position.x, position.z);
    if ((grounded && nextFloor > currentFloor + 0.002) || (!grounded && nextFloor > position.y + EPS)) {
      const sample = 0.08;
      const gradientX = (groundHeight(position.x + sample, position.z) - groundHeight(position.x - sample, position.z)) / (sample * 2);
      const gradientZ = (groundHeight(position.x, position.z + sample) - groundHeight(position.x, position.z - sample)) / (sample * 2);
      const slope = Math.hypot(gradientX, gradientZ);
      // A short stair can have an arbitrarily steep derivative. Distinguish it
      // from a sustained unwalkable incline by probing across the contact.
      const moveLength = Math.hypot(dx, dz) || 1;
      const probeX = dx / moveLength * 0.35, probeZ = dz / moveLength * 0.35;
      const probeRise = groundHeight(position.x + probeX, position.z + probeZ) - groundHeight(position.x - probeX, position.z - probeZ);
      const tooSteep = grounded && slope > maxSlope && probeRise > maxStep;
      if (nextFloor - currentFloor > maxStep || tooSteep || (!grounded && nextFloor > position.y + EPS)) {
        position.x = oldX; position.z = oldZ;
        if (slope > EPS) {
          const nx = gradientX / slope, nz = gradientZ / slope;
          const inward = Math.max(0, dx * nx + dz * nz);
          slide(dx - inward * nx, dz - inward * nz);
          const velocityIn = Math.max(0, velocity.x * nx + velocity.z * nz);
          velocity.x -= velocityIn * nx; velocity.z -= velocityIn * nz;
        } else velocity.x = velocity.z = 0;
        nextFloor = floorAt(position.x, position.z);
        if (nextFloor > position.y + (grounded ? maxStep : EPS)) { position.x = oldX; position.z = oldZ; nextFloor = currentFloor; }
      }
    }
    const beforeVertical = { x: position.x, y: position.y, z: position.z };
    if (grounded && !geometrySupport && Math.abs(position.y - currentFloor) < maxStep + 0.08 && currentFloor - nextFloor <= maxStep) {
      position.y = nextFloor; velocity.y = 0;
    } else {
      grounded = false;
      // A capsule can rest on a sloping rock edge even when a vertical ray
      // through its center misses that rock. Probe down from the resolved
      // surface instead of snapping to the distant heightfield below it.
      if (geometrySupport) velocity.y = 0;
      position.y += velocity.y * dt - gravity * dt * dt * 0.5;
      velocity.y -= gravity * dt;
      if (position.y <= nextFloor) { position.y = nextFloor; velocity.y = 0; grounded = true; }
    }
    const descending = velocity.y <= EPS;
    const verticalContact = moveThroughGeometry(beforeVertical);
    if (verticalContact?.grounded && descending) { grounded = true; velocity.y = 0; }
    if (verticalContact?.ceiling && velocity.y > 0) velocity.y = 0;
  }

  function step(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (input.jump && !heldJump) jumpBuffer = 0.14;
    heldJump = Boolean(input.jump);
    // Deliberately cap catch-up after suspension; never advance minutes in one call.
    let remaining = Math.min(dt, 0.25);
    while (remaining > EPS) {
      const slice = Math.min(remaining, 1 / 120);
      integrate(slice, input); remaining -= slice;
    }
  }
  reset();
  return { step, reset, velocity, get grounded() { return grounded; } };
}
