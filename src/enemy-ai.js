/** Deterministic ranged-enemy intent. Scene movement and collision stay in main. */
const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ damage: 0.7, speed: 0.82, windup: 1.4, recovery: 1.25 }),
  normal: Object.freeze({ damage: 1, speed: 1, windup: 1, recovery: 1 }),
  hard: Object.freeze({ damage: 1.25, speed: 1.1, windup: 0.76, recovery: 0.78 }),
});
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const direction = (from, to) => {
  const x = to.x - from.x, z = to.z - from.z, length = Math.hypot(x, z);
  return length > 1e-6 ? { x: x / length, z: z / length } : { x: 0, z: 0 };
};
const scaled = (move, amount) => ({ x: move.x * amount, z: move.z * amount });

/**
 * Guards walk a circuit, investigate their last sighting and reposition between
 * shots. A stationary windup locks aim so the player can dodge or reach cover.
 * `blocked` is optional feedback from the scene controller, never a collision
 * bypass; it changes the next patrol destination and preferred sidestep.
 */
export function createEnemyBrain({ home = { x: 0, z: 0 }, boss = false, difficulty = 'normal' } = {}) {
  const origin = Object.freeze({ x: finite(home?.x), z: finite(home?.z) });
  const scale = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const tuning = Object.freeze({
    aggro: boss ? 35 : 21, preferredRange: boss ? 11 : 8,
    leashRadius: boss ? 40 : 22, patrolRadius: boss ? 6 : 4.2,
    windup: (boss ? 0.95 : 0.75) * scale.windup,
    recovery: (boss ? 1.5 : 1.8) * scale.recovery,
    alert: 0.2, searchDuration: 5,
    damageMultiplier: scale.damage, speedMultiplier: scale.speed,
  });
  const seed = Math.abs(Math.sin(origin.x * 12.9898 + origin.z * 78.233));
  const patrolOffset = seed * Math.PI * 2;
  let phase, windupRemaining, recoveryRemaining, alertRemaining, staggerRemaining;
  let lockedAim, lastSeen, searchRemaining, patrolIndex, blockedTime, sidestep;
  function reset() {
    phase = 'patrol'; windupRemaining = recoveryRemaining = alertRemaining = staggerRemaining = 0;
    lockedAim = lastSeen = null; searchRemaining = blockedTime = 0; patrolIndex = 0; sidestep = seed > .5 ? 1 : -1;
  }
  reset();
  function result({ move = { x: 0, z: 0 }, fire = false, aimPoint = null, lookAt = null } = {}) {
    return {
      phase, move, fire, lookAt: lookAt ? { ...lookAt } : null,
      aimPoint: aimPoint ? { ...aimPoint } : null,
      telegraph: phase === 'windup' ? Math.max(0, Math.min(1, 1 - windupRemaining / tuning.windup)) : 0,
      damageMultiplier: tuning.damageMultiplier, speedMultiplier: tuning.speedMultiplier,
    };
  }
  function cancelWindup() {
    lockedAim = null; windupRemaining = 0;
    recoveryRemaining = Math.max(recoveryRemaining, tuning.recovery);
  }
  function patrol(current) {
    const waypoint = () => {
      const angle = patrolOffset + patrolIndex * Math.PI / 2;
      return { x: origin.x + Math.cos(angle) * tuning.patrolRadius, z: origin.z + Math.sin(angle) * tuning.patrolRadius };
    };
    let goal = waypoint();
    if (distance(current, goal) < .65 || blockedTime > .65) { patrolIndex = (patrolIndex + 1) % 4; blockedTime = 0; goal = waypoint(); }
    phase = 'patrol';
    return result({ move: scaled(direction(current, goal), .46), lookAt: goal });
  }
  function combatMove(current, target, amount = 1) {
    if (!target) return { x: 0, z: 0 };
    const toward = direction(current, target), gap = distance(current, target);
    if (gap > tuning.preferredRange + 1.5) return scaled(toward, amount);
    if (gap < tuning.preferredRange * .6) return scaled(toward, -.72 * amount);
    return { x: -toward.z * sidestep * .65 * amount, z: toward.x * sidestep * .65 * amount };
  }
  function update(dt, { position = origin, target, lineOfSight = true, stagger = 0, blocked = false } = {}) {
    dt = Math.max(0, Math.min(.25, finite(dt)));
    const current = { x: finite(position?.x, origin.x), z: finite(position?.z, origin.z) };
    const validTarget = target && Number.isFinite(target.x) && Number.isFinite(target.z);
    const destination = validTarget ? { x: target.x, y: finite(target.y), z: target.z } : null;
    const homeDistance = distance(current, origin);
    const inTerritory = destination && distance(origin, destination) <= tuning.leashRadius + tuning.preferredRange;
    const inAggro = inTerritory && distance(current, destination) <= tuning.aggro;
    const seesTarget = lineOfSight === true && inAggro;
    if (blocked) blockedTime += dt; else blockedTime = Math.max(0, blockedTime - dt * .5);
    if (blockedTime > .45 && phase !== 'patrol') { sidestep *= -1; blockedTime = 0; }
    if (seesTarget) { lastSeen = { ...destination }; searchRemaining = tuning.searchDuration; }
    else searchRemaining = Math.max(0, searchRemaining - dt);
    staggerRemaining = Math.max(0, staggerRemaining - dt, finite(stagger));
    if (staggerRemaining > 0) {
      if (phase !== 'stagger') cancelWindup();
      phase = 'stagger'; return result({ lookAt: lastSeen });
    }
    if (phase === 'stagger') phase = 'recovery';
    recoveryRemaining = Math.max(0, recoveryRemaining - dt);
    if (homeDistance > tuning.leashRadius || (phase === 'return' && homeDistance > .8)) {
      if (phase !== 'return') cancelWindup();
      phase = 'return'; return result({ move: direction(current, origin), lookAt: origin });
    }
    if (phase === 'return') phase = 'patrol';
    if (phase === 'windup') {
      if (!seesTarget) { cancelWindup(); phase = 'recovery'; return result({ lookAt: lastSeen }); }
      windupRemaining = Math.max(0, windupRemaining - dt);
      if (windupRemaining <= 1e-9) {
        const aimPoint = lockedAim; lockedAim = null;
        recoveryRemaining = tuning.recovery; phase = 'recovery'; sidestep *= -1;
        return result({ fire: true, aimPoint, lookAt: aimPoint });
      }
      return result({ lookAt: lockedAim });
    }
    if (recoveryRemaining > 1e-9) {
      phase = 'recovery';
      return result({ move: combatMove(current, seesTarget ? destination : lastSeen, .48), lookAt: lastSeen });
    }
    if (!seesTarget) {
      if (lastSeen && searchRemaining > 0 && inTerritory) {
        phase = 'search';
        const gap = distance(current, lastSeen);
        const move = gap > 1.2 ? scaled(direction(current, lastSeen), .8) : combatMove(current, lastSeen, .4);
        return result({ move, lookAt: lastSeen });
      }
      lastSeen = null;
      if (homeDistance > tuning.patrolRadius + 2) { phase = 'return'; return result({ move: direction(current, origin), lookAt: origin }); }
      return patrol(current);
    }
    if (phase !== 'alert') { phase = 'alert'; alertRemaining = tuning.alert; }
    else alertRemaining = Math.max(0, alertRemaining - dt);
    if (alertRemaining <= 1e-9) {
      phase = 'windup'; windupRemaining = tuning.windup; lockedAim = { ...destination };
      return result({ lookAt: lockedAim });
    }
    return result({ move: combatMove(current, destination), lookAt: destination });
  }
  return { get phase() { return phase; }, tuning, update, reset };
}
