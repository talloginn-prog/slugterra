import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDisplay } from '../src/display.js';

test('3440x1440 ultrawide fills the screen and caps high-DPI render pixels', () => {
  const view = calculateDisplay({ width: 3440, height: 1440, aspectRatio: '21:9', pixelRatio: 2 });
  assert.equal(view.width, 3440); assert.equal(view.height, 1440);
  assert.equal(view.bufferWidth, 3440); assert.equal(view.bufferHeight, 1440);
});
test('selected aspect is centered without stretching on standard and wider screens', () => {
  const wide = calculateDisplay({ width: 1920, height: 1080, aspectRatio: '21:9' });
  assert.equal(wide.width, 1920); assert.ok(wide.top > 130);
  assert.ok(Math.abs(wide.width / wide.height - 3440 / 1440) < 1e-8);
  const standard = calculateDisplay({ width: 3440, height: 1440, aspectRatio: '16:9' });
  assert.equal(standard.width, 2560); assert.equal(standard.left, 440);
  const huge = calculateDisplay({ width: 5120, height: 2160, aspectRatio: '21:9' });
  assert.equal(huge.width, 3440); assert.equal(huge.height, 1440);
});
test('resolution scales render quality while retaining framing and mobile auto layout', () => {
  const view = calculateDisplay({ width: 3440, height: 1440, resolution: '1920x1080', aspectRatio: '21:9' });
  assert.equal(view.width, 3440); assert.equal(view.bufferWidth, 1920); assert.ok(view.bufferHeight < 1080);
  const phone = calculateDisplay({ width: 390, height: 844 });
  assert.equal(phone.width, 390); assert.equal(phone.height, 844); assert.equal(phone.left, 0);
});
