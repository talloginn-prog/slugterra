import test from 'node:test';
import assert from 'node:assert/strict';
import { createMouseControls } from '../src/input.js';
class Target {
  callbacks = new Map();
  addEventListener(name, callback) { this.callbacks.set(name, callback); }
  removeEventListener(name) { this.callbacks.delete(name); }
  emit(name, event = {}) { this.callbacks.get(name)?.({ target: this, preventDefault() {}, clientX: 10, clientY: 20, ...event }); }
}
function fixture() {
  const element = new Target(), doc = new Target(), win = new Target(), looks = [], aims = [];
  let fires = 0, active = true, locked = false;
  const input = createMouseControls({element, documentTarget:doc, windowTarget:win, isActive:()=>active, isLocked:()=>locked, onFire:()=>fires++, onLook:(x,y)=>looks.push([x,y]), onAim:v=>aims.push(v), requestPointer() {}});
  return {element,doc,win,input,looks,aims,get fires(){return fires;},set active(v){active=v;},set locked(v){locked=v;}};
}
test('right focus plus left fire and turning work together without pointer lock', () => {
  const f = fixture();
  f.element.emit('mousedown',{button:2});
  f.doc.emit('mousemove',{movementX:12,movementY:-3});
  assert.deepEqual(f.looks,[[12,-3]]);
  f.element.emit('mousedown',{button:0});
  assert.equal(f.fires,1); assert.equal(f.input.aiming,true); assert.equal(f.input.firing,true);
  f.doc.emit('mouseup',{button:0});
  assert.equal(f.input.firing,false); assert.equal(f.input.aiming,true);
  f.doc.emit('mousemove',{movementX:8,movementY:2});
  assert.equal(f.looks.length,2);
  f.doc.emit('mouseup',{button:2}); assert.equal(f.input.buttons,0);
});
test('releasing focus while left fire is held keeps firing and dragging active', () => {
  const f = fixture(); f.element.emit('mousedown',{button:0}); f.element.emit('mousedown',{button:2});
  f.doc.emit('mouseup',{button:2});
  assert.equal(f.input.firing,true); assert.equal(f.input.aiming,false);
  f.doc.emit('mousemove',{movementX:4,movementY:1}); assert.equal(f.looks.length,1);
  f.win.emit('blur'); assert.equal(f.input.firing,false);
});
test('menus ignore input, pointer lock allows free look, disposal releases held buttons', () => {
  const f=fixture(); f.active=false; f.element.emit('mousedown',{button:0}); assert.equal(f.fires,0);
  f.active=true; f.doc.emit('mousemove',{movementX:3}); assert.equal(f.looks.length,0);
  f.locked=true; f.doc.emit('mousemove',{movementX:3}); assert.equal(f.looks.length,1);
  f.element.emit('mousedown',{button:0}); f.input.dispose(); assert.equal(f.input.buttons,0);
});
