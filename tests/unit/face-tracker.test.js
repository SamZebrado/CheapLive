import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMagnitudeScale, applyCenterScale, createSmoother } from '../../src/face-tracking/face-tracker.js';

test('applyMagnitudeScale: eye openness (inverted) - raw at calibration returns fully open', () => {
  const result = applyMagnitudeScale(0.7, 0.7, 1.5, true);
  assert.ok(Math.abs(result - 1.0) < 1e-10, 'eye fully open when raw == calib');
});

test('applyMagnitudeScale: eye openness (inverted) - raw below calibration returns partially closed', () => {
  const result = applyMagnitudeScale(0.5, 0.7, 1.5, true);
  assert.ok(result < 1.0 && result > 0, 'eye partially closed when raw < calib');
  assert.ok(Math.abs(result - 0.7) < 1e-10, 'correct calculation: 1 - (0.7-0.5)*1.5 = 0.7');
});

test('applyMagnitudeScale: eye openness (inverted) - raw much below calibration returns fully closed', () => {
  const result = applyMagnitudeScale(0.0, 0.7, 1.5, true);
  assert.ok(result <= 0, 'eye fully closed when raw far below calib');
});

test('applyMagnitudeScale: mouth open (non-inverted) - raw at calibration returns neutral', () => {
  const result = applyMagnitudeScale(0.0, 0.0, 1.5, false);
  assert.ok(Math.abs(result - 0) < 1e-10, 'mouth closed when raw == calib');
});

test('applyMagnitudeScale: mouth open (non-inverted) - raw above calibration returns open', () => {
  const result = applyMagnitudeScale(0.5, 0.0, 1.5, false);
  assert.ok(result > 0 && result <= 1, 'mouth partially open when raw > calib');
  assert.ok(Math.abs(result - 0.75) < 1e-10, 'correct calculation: (0.5-0.0)*1.5 = 0.75');
});

test('applyMagnitudeScale: mouth open (non-inverted) - raw much above calibration clamps to 1', () => {
  const result = applyMagnitudeScale(1.0, 0.0, 1.5, false);
  assert.ok(Math.abs(result - 1.0) < 1e-10, 'mouth fully open clamped at 1');
});

test('applyMagnitudeScale: brow raise with high scale factor', () => {
  const result = applyMagnitudeScale(0.3, 0.0, 1.8, false);
  assert.ok(Math.abs(result - 0.54) < 1e-10, 'brow scaled correctly: 0.3 * 1.8 = 0.54');
});

test('applyCenterScale: headYaw at center returns center', () => {
  const result = applyCenterScale(0.5, 0.5, 1.0);
  assert.ok(Math.abs(result - 0.5) < 1e-10, 'center stays at center');
});

test('applyCenterScale: headYaw offset is amplified', () => {
  const result = applyCenterScale(0.7, 0.5, 1.0);
  assert.ok(Math.abs(result - 0.7) < 1e-10, 'no amplification when scale=1');
});

test('applyCenterScale: headYaw offset is amplified with scale>1', () => {
  const result = applyCenterScale(0.6, 0.5, 2.0);
  assert.ok(Math.abs(result - 0.7) < 1e-10, 'offset amplified: 0.5 + (0.6-0.5)*2 = 0.7');
});

test('applyCenterScale: result is clamped to [0, 1]', () => {
  const result = applyCenterScale(1.0, 0.5, 2.0);
  assert.ok(Math.abs(result - 1.0) < 1e-10, 'clamped to 1');
});

test('applyCenterScale: result is clamped to [0, 1] at lower bound', () => {
  const result = applyCenterScale(0.0, 0.5, 2.0);
  assert.ok(Math.abs(result - 0.0) < 1e-10, 'clamped to 0');
});

test('createSmoother: first call applies smoothing factor', () => {
  const smoothValue = createSmoother(0.25);
  const result = smoothValue('test', 1.0);
  assert.ok(Math.abs(result - 0.75) < 1e-10, 'first call: 0 + (1-0)*0.75 = 0.75');
});

test('createSmoother: factor=0.25 converges to target gradually', () => {
  const smoothValue = createSmoother(0.25);
  smoothValue('test', 0);
  const r1 = smoothValue('test', 1.0);
  const r2 = smoothValue('test', 1.0);
  const r3 = smoothValue('test', 1.0);
  assert.ok(r1 < r2 && r2 < r3 && r3 < 1.0, 'converges gradually');
  assert.ok(Math.abs(r1 - 0.75) < 1e-10, 'first step: 0 + (1-0)*0.75 = 0.75');
});

test('createSmoother: multiple keys are independent', () => {
  const smoothValue = createSmoother(0.25);
  smoothValue('key_a', 0.5);
  smoothValue('key_b', 0.8);
  const ra = smoothValue('key_a', 1.0);
  const rb = smoothValue('key_b', 0.0);
  assert.ok(Math.abs(ra - 0.84375) < 1e-10, 'key_a independent: 0.375 + (1-0.375)*0.75 = 0.84375');
  assert.ok(Math.abs(rb - 0.15) < 1e-10, 'key_b independent: 0.6 + (0-0.6)*0.75 = 0.15');
});