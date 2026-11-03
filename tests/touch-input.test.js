import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchControls } from '../src/touch-input.js';
class Target {
  listeners = new Map(); style = {}; dataset = {}; captures = new Set(); attributes = {};
  classList = { toggle() {}, remove() {} };
  addEventListener(name, fn) { const list = this.listeners.get(name) || new Set(); list.add(fn); this.listeners.set(name, list); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  emit(name, event = {}) { for (const fn of this.listeners.get(name) || []) fn({ target: this, pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50, preventDefault() {}, ...event }); }
  setPointerCapture(id) { this.captures.add(id); } hasPointerCapture(id) { return this.captures.has(id); } releasePointerCapture(id) { this.captures.delete(id); }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest() { return this.dataset.touchHold || this.dataset.touchAction ? this : null; }
  contains(target) { return this === target; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}
function fixture() {
  const canvas = new Target(), controls = new Target(), doc = new Target(), win = new Target(), stick = new Target(), knob = new Target();
  const buttons = ['fire', 'aim', 'sprint', 'jump', 'pause'].map(action => { const b = new Target(); b.dataset[['jump','pause'].includes(action) ? 'touchAction' : 'touchHold'] = action; return b; });
  controls.contains = target => buttons.includes(target) || target === stick;
  controls.querySelector = selector => selector === '#touch-stick' ? stick : knob;
  controls.querySelectorAll = () => buttons.filter(b => b.dataset.touchHold);
  let active = true, fires = 0; const looks = [], actions = [], aims = [];
  const input = createTouchControls({ element: canvas, controls, documentTarget: doc, windowTarget: win, isActive: () => active, onLook: (x,y) => looks.push([x,y]), onFire: () => fires++, onAim: v => aims.push(v), onAction: a => actions.push(a) });
  const press = (target, id, extra = {}) => (target === canvas ? canvas : controls).emit('pointerdown', { target, pointerId: id, ...extra });
  return { canvas, controls, doc, win, stick, knob, buttons, input, press, looks, actions, aims, get fires() { return fires; }, set active(v) { active = v; } };
}
test('movement, look, aim and fire use independent fingers and releases', () => {
  const f = fixture(); f.press(f.stick, 1, { clientY: 15 }); f.press(f.canvas, 2);
  f.press(f.buttons[1], 3); f.press(f.buttons[0], 4);
  f.doc.emit('pointermove', { pointerId: 2, clientX: 70, clientY: 40 });
  assert.equal(f.input.z, 1); assert.equal(f.input.x, 0); assert.deepEqual(f.looks, [[20,-10]]);
  assert.equal(f.input.aiming, true); assert.equal(f.input.firing, true); assert.equal(f.fires, 1);
  f.doc.emit('pointerup', { pointerId: 4 }); assert.equal(f.input.firing, false); assert.equal(f.input.aiming, true);
  f.doc.emit('pointerup', { pointerId: 1 }); assert.equal(f.input.z, 0);
  f.doc.emit('pointermove', { pointerId: 2, clientX: 80, clientY: 42 }); assert.deepEqual(f.looks.at(-1), [10,2]);
  f.doc.emit('pointerup', { pointerId: 3 }); assert.equal(f.input.aiming, false);
});
test('thumbstick is analog, radial-clamped and has a dead zone', () => {
  const f = fixture(); f.press(f.stick, 1, { clientX: 52, clientY: 50 }); assert.equal(f.input.x, 0);
  f.doc.emit('pointermove', { pointerId: 1, clientX: 68, clientY: 50 }); assert.ok(f.input.x > .3 && f.input.x < .6);
  f.doc.emit('pointermove', { pointerId: 1, clientX: 200, clientY: -100 }); assert.ok(Math.abs(Math.hypot(f.input.x, f.input.z) - 1) < 1e-8);
  assert.ok(f.input.x > 0 && f.input.z > 0);
});
test('unrelated touch endings do not stop look and second look fingers cannot steal it', () => {
  const f = fixture(); f.press(f.canvas, 1); f.press(f.canvas, 2, { clientX: 300 });
  f.doc.emit('pointerup', { pointerId: 2 }); f.doc.emit('pointermove', { pointerId: 1, clientX: 60 });
  assert.deepEqual(f.looks, [[10,0]]); f.doc.emit('pointermove', { pointerId: 2, clientX: 350 }); assert.equal(f.looks.length, 1);
});
test('cancel/lost capture release just that action, including duplicate holds', () => {
  const f = fixture(); f.press(f.buttons[0], 1); f.press(f.buttons[0], 2); f.press(f.buttons[2], 3);
  assert.equal(f.fires, 1); f.doc.emit('pointercancel', { pointerId: 1 }); assert.equal(f.input.firing, true);
  f.doc.emit('lostpointercapture', { pointerId: 2 }); assert.equal(f.input.firing, false); assert.equal(f.input.sprinting, true);
  f.doc.emit('pointerup', { pointerId: 3 }); assert.equal(f.input.sprinting, false);
});
test('pause, backgrounding and orientation reset every held pointer without stuck actions', () => {
  for (const reason of ['blur', 'pagehide', 'resize', 'hidden', 'inactive']) {
    const f = fixture(); f.press(f.stick, 1, { clientY: 15 }); f.press(f.buttons[0], 2); f.press(f.buttons[1], 3);
    if (reason === 'hidden') { f.doc.hidden = true; f.doc.emit('visibilitychange'); }
    else if (reason === 'inactive') { f.active = false; f.doc.emit('pointermove', { pointerId: 1 }); }
    else f.win.emit(reason);
    assert.equal(f.input.z, 0, reason); assert.equal(f.input.firing, false, reason); assert.equal(f.input.aiming, false, reason);
    assert.equal(f.buttons[0].captures.size, 0); assert.equal(f.stick.captures.size, 0);
  }
});
test('menus and mouse canvas events are ignored; actions fire once at contact and disposal unbinds', () => {
  const f = fixture(); f.active = false; f.press(f.buttons[0], 1); assert.equal(f.fires, 0);
  f.active = true; f.press(f.canvas, 2, { pointerType: 'mouse' }); f.doc.emit('pointermove', { pointerId: 2, clientX: 90 }); assert.equal(f.looks.length, 0);
  f.press(f.buttons[3], 3); f.doc.emit('pointerup', { pointerId: 3 }); assert.deepEqual(f.actions, ['jump']);
  f.input.dispose(); f.press(f.buttons[0], 4); assert.equal(f.fires, 0);
});
test('assistive clicks activate actions while pointer-generated clicks do not double fire', () => {
  const f = fixture();
  f.controls.emit('click', { target: f.buttons[0], detail: 1 }); assert.equal(f.fires, 0);
  f.controls.emit('click', { target: f.buttons[0], detail: 0 }); assert.equal(f.fires, 1);
  f.controls.emit('click', { target: f.buttons[1], detail: 0 }); assert.equal(f.input.aiming, true);
  f.controls.emit('click', { target: f.buttons[1], detail: 0 }); assert.equal(f.input.aiming, false);
  f.controls.emit('click', { target: f.buttons[3], detail: 0 }); assert.deepEqual(f.actions, ['jump']);
});
test('fire dragging turns with two thumbs and yields to a separate look finger without jumping', () => {
  const f = fixture(); f.press(f.buttons[0], 1);
  f.doc.emit('pointermove', { pointerId: 1, clientX: 60 }); assert.deepEqual(f.looks, [[10,0]]);
  f.press(f.canvas, 2); f.doc.emit('pointermove', { pointerId: 1, clientX: 100 }); assert.equal(f.looks.length, 1);
  f.doc.emit('pointerup', { pointerId: 2 }); f.doc.emit('pointermove', { pointerId: 1, clientX: 105 }); assert.deepEqual(f.looks.at(-1), [5,0]);
  assert.equal(f.input.firing, true); assert.equal(f.fires, 1);
});
