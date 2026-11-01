/** Deterministic ranged-enemy intent. Rendering, movement and collision stay in main. */
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

/**
 * A windup locks its aim, giving the player time to strafe or seek cover.
 * The caller supplies fresh line of sight and applies the returned movement
 * through its own collision checks. `fire` is a one-update event, never a latch.
 */
export function createEnemyBrain({ home = { x: 0, z: 0 }, boss = false, difficulty = 'normal' } = {}) {
  const origin = Object.freeze({ x: finite(home?.x), z: finite(home?.z) });
  const scale = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const tuning = Object.freeze({
    aggro: boss ? 35 : 21,
    preferredRange: boss ? 11 : 8,
    leashRadius: boss ? 40 : 22,
    windup: (boss ? 0.95 : 0.75) * scale.windup,
    recovery: (boss ? 1.5 : 1.8) * scale.recovery,
    alert: 0.2,
    damageMultiplier: scale.damage,
    speedMultiplier: scale.speed,
  });
  let phase = 'patrol', windupRemaining = 0, recoveryRemaining = 0;
  let alertRemaining = 0, staggerRemaining = 0, lockedAim = null;

  function reset() {
    phase = 'patrol';
    windupRemaining = recoveryRemaining = alertRemaining = staggerRemaining = 0;
    lockedAim = null;
  }

  function result({ move = { x: 0, z: 0 }, fire = false, aimPoint = null } = {}) {
    return {
      phase, move, fire,
      aimPoint: aimPoint ? { ...aimPoint } : null,
      telegraph: phase === 'windup' ? Math.max(0, Math.min(1, 1 - windupRemaining / tuning.windup)) : 0,
      damageMultiplier: tuning.damageMultiplier,
      speedMultiplier: tuning.speedMultiplier,
    };
  }

  function cancelWindup() {
    lockedAim = null;
    windupRemaining = 0;
    recoveryRemaining = Math.max(recoveryRemaining, tuning.recovery);
  }

  function update(dt, { position = origin, target, lineOfSight = true, stagger = 0 } = {}) {
    // A long suspended tab must not consume a complete tell or fire a burst.
    dt = Math.max(0, Math.min(0.25, finite(dt)));
    const current = { x: finite(position?.x, origin.x), z: finite(position?.z, origin.z) };
    const validTarget = target && Number.isFinite(target.x) && Number.isFinite(target.z);
    const destination = validTarget ? { x: target.x, y: finite(target.y), z: target.z } : null;
    const homeDistance = distance(current, origin);
    const targetDistance = destination ? distance(current, destination) : Infinity;
    const targetHomeDistance = destination ? distance(origin, destination) : Infinity;
    const seesTarget = lineOfSight === true && validTarget;

    staggerRemaining = Math.max(0, staggerRemaining - dt, finite(stagger));
    if (staggerRemaining > 0) {
      if (phase !== 'stagger') cancelWindup();
      phase = 'stagger';
      return result();
    }
    if (phase === 'stagger') phase = 'recovery';
    recoveryRemaining = Math.max(0, recoveryRemaining - dt);

    // Once leashed, finish returning before responding to a nearby player.
    if (homeDistance > tuning.leashRadius || (phase === 'return' && homeDistance > 0.8)) {
      if (phase !== 'return') cancelWindup();
      phase = 'return';
      return result({ move: direction(current, origin) });
    }
    if (phase === 'return') phase = 'patrol';

    const engaged = destination && targetDistance <= tuning.aggro && targetHomeDistance <= tuning.leashRadius + tuning.preferredRange;
    if (!engaged) {
      if (phase === 'windup') cancelWindup();
      if (homeDistance > 0.8) {
        phase = 'return';
        return result({ move: direction(current, origin) });
      }
      phase = 'patrol';
      return result();
    }

    if (phase === 'windup') {
      if (!seesTarget) {
        cancelWindup();
        phase = 'recovery';
        return result();
      }
      windupRemaining = Math.max(0, windupRemaining - dt);
      if (windupRemaining <= 1e-9) {
        const aimPoint = lockedAim;
        lockedAim = null;
        recoveryRemaining = tuning.recovery;
        phase = 'recovery';
        return result({ fire: true, aimPoint });
      }
      return result();
    }

    if (recoveryRemaining > 1e-9) {
      phase = 'recovery';
      return result();
    }

    if (phase !== 'alert') {
      phase = 'alert';
      alertRemaining = tuning.alert;
    } else alertRemaining = Math.max(0, alertRemaining - dt);

    if (alertRemaining <= 1e-9 && seesTarget) {
      phase = 'windup';
      windupRemaining = tuning.windup;
      lockedAim = { ...destination };
      return result();
    }
    const move = targetDistance > tuning.preferredRange ? direction(current, destination) : { x: 0, z: 0 };
    return result({ move });
  }

  return { get phase() { return phase; }, tuning, update, reset };
}
