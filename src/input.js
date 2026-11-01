/** Mouse buttons are independent: pointerdown alone does not report button chords. */
export function createMouseControls({ element, documentTarget = document, windowTarget = window, isActive, isLocked, onFire, onLook, onAim, requestPointer, sensitivity = () => 1 }) {
  let buttons = 0, lastX = null, lastY = null;
  const active = event => isActive() && (event.target === element || isLocked());
  function publishAim() { onAim(Boolean(buttons & 2)); }
  function down(event) {
    if (!active(event) || event.sourceCapabilities?.firesTouchEvents) return;
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    // mousedown fires for every newly pressed button, including left+right chords.
    buttons |= event.button === 0 ? 1 : 2;
    lastX = event.clientX; lastY = event.clientY;
    publishAim();
    if (event.button === 0) onFire();
    if (!isLocked()) requestPointer();
  }
  function up(event) {
    if (event.button === 0) buttons &= ~1;
    if (event.button === 2) buttons &= ~2;
    publishAim();
    if (!buttons) { lastX = null; lastY = null; }
  }
  function move(event) {
    if (!isActive() || (!isLocked() && !buttons)) return;
    const dx = event.movementX || (lastX === null ? 0 : event.clientX - lastX);
    const dy = event.movementY || (lastY === null ? 0 : event.clientY - lastY);
    lastX = event.clientX; lastY = event.clientY;
    onLook(dx * sensitivity(), dy * sensitivity());
  }
  function reset() { buttons = 0; lastX = null; lastY = null; publishAim(); }
  function context(event) { if (isActive()) event.preventDefault(); }
  element.addEventListener('mousedown', down);
  element.addEventListener('contextmenu', context);
  documentTarget.addEventListener('mouseup', up);
  documentTarget.addEventListener('mousemove', move);
  windowTarget.addEventListener('blur', reset);
  return {
    reset,
    get firing() { return Boolean(buttons & 1); },
    get aiming() { return Boolean(buttons & 2); },
    get buttons() { return buttons; },
    dispose() {
      reset(); element.removeEventListener('mousedown', down); element.removeEventListener('contextmenu', context);
      documentTarget.removeEventListener('mouseup', up); documentTarget.removeEventListener('mousemove', move); windowTarget.removeEventListener('blur', reset);
    },
  };
}
