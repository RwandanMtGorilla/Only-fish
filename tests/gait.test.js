import test from 'node:test';
import assert from 'node:assert/strict';
import { LighthillGait } from '../src/core/LighthillGait.js';

function settle(yaw, options = {}) {
  const gait = new LighthillGait({ phase: 0, ...options });
  for (let i = 0; i < 300; i++) gait.update(1 / 60, 1, 0, yaw);
  return gait;
}

test('straight swimming is unchanged and turning preserves the swim clock', () => {
  const straight = settle(0);
  const disabled = settle(0, { turnAsymmetryMax: 0 });
  const turn = settle(0.3);
  assert.deepEqual(straight.relativeAngles(12), disabled.relativeAngles(12));
  assert.equal(turn.phase, straight.phase);
  assert.equal(turn.tipAmplitude, straight.tipAmplitude);
  assert.equal(turn.omega, straight.omega);
});

test('opposite turns produce mirrored body bends at opposite swim phases', () => {
  const left = settle(0.3);
  const right = settle(-0.3);
  for (let sample = 0; sample < 120; sample++) {
    left.phase = sample / 120 * Math.PI * 2;
    right.phase = left.phase + Math.PI;
    const a = left.relativeAngles(15), b = right.relativeAngles(15);
    assert.equal(a[0], 0);
    for (let i = 1; i < a.length; i++) assert.ok(Math.abs(a[i] + b[i]) < 1e-6);
  }
});

test('gentle turning changes stroke shape beyond a static camber offset', () => {
  const turn = settle(0.3, { camberGain: 0 });
  const straight = settle(0, { camberGain: 0 });
  let asymmetry = 0;
  for (let sample = 0; sample < 120; sample++) {
    const phase = sample / 120 * Math.PI * 2;
    turn.phase = straight.phase = phase;
    const a = turn.slope(1), s = straight.slope(1);
    turn.phase = straight.phase = phase + Math.PI;
    assert.ok(Math.abs(s + straight.slope(1)) < 1e-12);
    asymmetry = Math.max(asymmetry, Math.abs(a + turn.slope(1)));
  }
  assert.ok(asymmetry > 0.01);
});

test('turn onset is smoothed and straight swimming recovers without phase resets', () => {
  const gait = settle(0);
  gait.update(1 / 60, 1, 0, 0.3);
  assert.ok(Math.abs(gait.turnAsymmetry) > 0);
  assert.ok(Math.abs(gait.turnAsymmetry) < 0.01);
  for (let i = 0; i < 120; i++) gait.update(1 / 60, 1, 0, 0.3);
  for (let i = 0; i < 180; i++) gait.update(1 / 60, 1, 0, 0);
  assert.ok(Math.abs(gait.turnAsymmetry) < 1e-6);
  assert.ok(Number.isFinite(gait.slope(1)));
});
