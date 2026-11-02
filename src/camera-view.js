const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** View state and obstruction-safe camera placement, independent of rendering. */
export function createViewController(options = {}) {
  const config = options && typeof options === 'object' ? options : {};
  const minDistance = clamp(finite(config.minDistance, 0.35), 0, 100);
  const distance = clamp(finite(config.distance, 4.2), minDistance, 100);
  const padding = clamp(finite(config.padding, 0.22), 0, 2);
  let thirdPerson = false;

  function cameraPosition(eye = {}, yaw = 0, pitch = 0, segmentHit) {
    const input = eye || {};
    const start = {
      x: clamp(finite(input.x, 0), -1e6, 1e6),
      y: clamp(finite(input.y, 0), -1e6, 1e6),
      z: clamp(finite(input.z, 0), -1e6, 1e6),
    };
    if (!thirdPerson) return start;
    yaw = finite(yaw, 0) % (Math.PI * 2);
    pitch = clamp(finite(pitch, 0), -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    const cosPitch = Math.cos(pitch);
    const delta = {
      x: Math.sin(yaw) * cosPitch * distance,
      y: -Math.sin(pitch) * distance + 0.45,
      z: Math.cos(yaw) * cosPitch * distance,
    };
    const length = Math.hypot(delta.x, delta.y, delta.z);
    if (length < 1e-8) return start;
    let allowed = length;
    if (typeof segmentHit === 'function') {
      // Probe the center and the near-plane edges. A center ray alone lets the
      // camera's sides intersect a corner even while its center remains clear.
      const side = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
      const up = {
        x: delta.y * side.z / length,
        y: (delta.z * side.x - delta.x * side.z) / length,
        z: -delta.y * side.x / length,
      };
      const offsets = [
        { x: 0, y: 0, z: 0 },
        { x: side.x * padding, y: 0, z: side.z * padding },
        { x: -side.x * padding, y: 0, z: -side.z * padding },
        { x: up.x * padding, y: up.y * padding, z: up.z * padding },
        { x: -up.x * padding, y: -up.y * padding, z: -up.z * padding },
      ];
      for (const offset of offsets) {
        const end = { x: start.x + delta.x + offset.x, y: start.y + delta.y + offset.y, z: start.z + delta.z + offset.z };
        const fraction = segmentHit(start, end);
        if (typeof fraction === 'number' && Number.isFinite(fraction)) {
          allowed = Math.min(allowed, Math.max(0, length * clamp(fraction, 0, 1) - padding));
        }
      }
    }
    // Collision overrides minimum follow distance: a nearby wall must never
    // push the camera outward through that wall to satisfy a minimum setting.
    const ratio = allowed / length;
    return { x: start.x + delta.x * ratio, y: start.y + delta.y * ratio, z: start.z + delta.z * ratio };
  }

  return {
    get mode() { return thirdPerson ? 'third-person' : 'first-person'; },
    get thirdPerson() { return thirdPerson; },
    toggle() { thirdPerson = !thirdPerson; return thirdPerson; },
    setThirdPerson(value) { thirdPerson = value === true; return thirdPerson; },
    cameraPosition,
  };
}
