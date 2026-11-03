/** Independent touch pointers: a thumbstick, one look finger and held actions. */
export function createTouchControls({ element, controls, documentTarget = document, windowTarget = window, isActive, onLook, onFire, onAim, onAction, onActivate = () => {} }) {
  const pointers = new Map();
  let stickPointer = null, lookPointer = null, x = 0, z = 0;
  const stick = controls.querySelector('#touch-stick');
  const knob = controls.querySelector('#touch-stick-knob');
  const held = action => [...pointers.values()].some(pointer => pointer.kind === 'hold' && pointer.action === action);
  function refresh() {
    controls.querySelectorAll('[data-touch-hold]').forEach(button => {
      const pressed = held(button.dataset.touchHold);
      button.classList.toggle('pressed', pressed); button.setAttribute('aria-pressed', String(pressed));
    });
    onAim(held('aim'));
  }
  function moveStick(event, pointer) {
    const dx = event.clientX - pointer.cx, dy = event.clientY - pointer.cy;
    const distance = Math.hypot(dx, dy), amount = Math.min(1, distance / pointer.radius);
    const magnitude = Math.max(0, (amount - .12) / .88);
    x = distance ? dx / distance * magnitude : 0;
    z = distance ? -dy / distance * magnitude : 0;
    const scale = distance ? Math.min(distance, pointer.radius) / distance : 0;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    stick.classList.toggle('pressed', amount > .12);
  }
  function down(event) {
    if (!['touch', 'pen'].includes(event.pointerType) || !isActive()) return;
    const button = event.target.closest?.('[data-touch-hold], [data-touch-action]');
    let pointer;
    if (button && controls.contains(button) && !button.disabled) {
      pointer = { kind: button.dataset.touchHold ? 'hold' : 'action', action: button.dataset.touchHold || button.dataset.touchAction, owner: button };
    } else if (stick.contains(event.target) && stickPointer === null) {
      const rect = stick.getBoundingClientRect();
      pointer = { kind: 'stick', cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, radius: rect.width * .35, owner: stick };
      stickPointer = event.pointerId;
    } else if (event.target === element && lookPointer === null) {
      pointer = { kind: 'look', lastX: event.clientX, lastY: event.clientY, owner: element };
      lookPointer = event.pointerId;
    } else return;
    event.preventDefault();
    onActivate();
    const wasFiring = held('fire');
    pointer.lastX = event.clientX; pointer.lastY = event.clientY;
    pointers.set(event.pointerId, pointer);
    try { pointer.owner.setPointerCapture(event.pointerId); } catch { /* Document listeners still release the pointer. */ }
    if (pointer.kind === 'stick') moveStick(event, pointer);
    refresh();
    if (pointer.kind === 'hold' && pointer.action === 'fire' && !wasFiring) onFire();
    if (pointer.kind === 'action') onAction(pointer.action);
  }
  function move(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    if (!isActive()) { reset(); return; }
    event.preventDefault();
    if (pointer.kind === 'stick') moveStick(event, pointer);
    if (pointer.kind === 'look' || (pointer.kind === 'hold' && pointer.action === 'fire')) {
      // Two thumbs can move and fire/turn. An explicit look finger takes priority.
      if (pointer.kind === 'look' || lookPointer === null) onLook(event.clientX - pointer.lastX, event.clientY - pointer.lastY);
      pointer.lastX = event.clientX; pointer.lastY = event.clientY;
    }
  }
  function release(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    pointers.delete(event.pointerId);
    if (event.pointerId === stickPointer) {
      stickPointer = null; x = z = 0; knob.style.transform = 'translate(0px, 0px)'; stick.classList.remove('pressed');
    }
    if (event.pointerId === lookPointer) lookPointer = null;
    try { if (pointer.owner.hasPointerCapture?.(event.pointerId)) pointer.owner.releasePointerCapture(event.pointerId); } catch { /* Already cancelled. */ }
    refresh();
  }
  function reset() {
    const captured = [...pointers.entries()]; pointers.clear(); stickPointer = lookPointer = null; x = z = 0;
    knob.style.transform = 'translate(0px, 0px)'; stick.classList.remove('pressed');
    for (const [id, pointer] of captured) {
      try { if (pointer.owner.hasPointerCapture?.(id)) pointer.owner.releasePointerCapture(id); } catch { /* Detached or already released. */ }
    }
    refresh();
  }
  const visibility = () => { if (documentTarget.hidden) reset(); };
  function accessibleClick(event) {
    // Assistive technology and Enter/Space activation do not always emit pointers.
    if (event.detail !== 0 || !isActive()) return;
    const button = event.target.closest?.('[data-touch-hold], [data-touch-action]');
    if (!button || button.disabled || !controls.contains(button)) return;
    if (button.dataset.touchAction) onAction(button.dataset.touchAction);
    else if (button.dataset.touchHold === 'fire') onFire();
    else {
      const id = `accessible-${button.dataset.touchHold}`;
      if (pointers.has(id)) pointers.delete(id);
      else pointers.set(id, { kind: 'hold', action: button.dataset.touchHold, owner: button });
      refresh();
    }
  }
  element.addEventListener('pointerdown', down);
  controls.addEventListener('pointerdown', down);
  controls.addEventListener('click', accessibleClick);
  documentTarget.addEventListener('pointermove', move, { passive: false });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) documentTarget.addEventListener(event, release);
  for (const event of ['blur', 'pagehide', 'resize']) windowTarget.addEventListener(event, reset);
  documentTarget.addEventListener('visibilitychange', visibility);
  return {
    get x() { return x; }, get z() { return z; },
    get firing() { return held('fire'); }, get aiming() { return held('aim'); }, get sprinting() { return held('sprint'); },
    reset,
    dispose() {
      reset(); element.removeEventListener('pointerdown', down); controls.removeEventListener('pointerdown', down); controls.removeEventListener('click', accessibleClick);
      documentTarget.removeEventListener('pointermove', move);
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) documentTarget.removeEventListener(event, release);
      for (const event of ['blur', 'pagehide', 'resize']) windowTarget.removeEventListener(event, reset);
      documentTarget.removeEventListener('visibilitychange', visibility);
    },
  };
}
