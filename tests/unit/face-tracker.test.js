import test from 'node:test';
import assert from 'node:assert/strict';

class FaceTrackerTest {
  constructor() {
    this.scale = {
      eye: 1.5,
      mouth: 1.5,
      smile: 1.5,
      brow: 1.8,
      head: 1.0,
      pos: 1.0,
    };
    this.calibration = {
      eyeLeft: 0.7,
      eyeRight: 0.7,
      mouthOpen: 0.0,
      mouthSmile: 0.0,
      browLeft: 0.0,
      browRight: 0.0,
      headYaw: 0.5,
      headPitch: 0.5,
      headRoll: 0.5,
      headX: 0.5,
      headY: 0.5,
    };
    this.smoothed = {};
    this.smoothFactor = 0.25;
  }

  applyMagnitudeScale(raw, calib, scaleFactor, invert = false) {
    let delta;
    if (invert) {
      delta = calib - raw;
    } else {
      delta = raw - calib;
    }
    const scaledDelta = delta * scaleFactor;
    let result;
    if (invert) {
      result = 1.0 - Math.max(0, scaledDelta);
    } else {
      result = Math.max(0, Math.min(1, scaledDelta));
    }
    return result;
  }

  applyCenterScale(raw, center, scaleFactor) {
    const delta = raw - center;
    const scaled = delta * scaleFactor;
    return Math.max(0, Math.min(1, center + scaled));
  }

  smoothValue(key, target) {
    const current = this.smoothed[key] || 0;
    this.smoothed[key] = current + (target - current) * (1 - this.smoothFactor);
    return this.smoothed[key];
  }
}

test('applyMagnitudeScale: eye openness (inverted) - raw at calibration returns fully open', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(0.7, 0.7, 1.5, true);
  assert.ok(Math.abs(result - 1.0) < 1e-10, 'eye fully open when raw == calib');
});

test('applyMagnitudeScale: eye openness (inverted) - raw below calibration returns partially closed', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(0.5, 0.7, 1.5, true);
  assert.ok(result < 1.0 && result > 0, 'eye partially closed when raw < calib');
  assert.ok(Math.abs(result - 0.7) < 1e-10, 'correct calculation: 1 - (0.7-0.5)*1.5 = 0.7');
});

test('applyMagnitudeScale: eye openness (inverted) - raw much below calibration returns fully closed', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(0.0, 0.7, 1.5, true);
  assert.ok(result <= 0, 'eye fully closed when raw far below calib');
});

test('applyMagnitudeScale: mouth open (non-inverted) - raw at calibration returns neutral', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(0.0, 0.0, 1.5, false);
  assert.ok(Math.abs(result - 0) < 1e-10, 'mouth closed when raw == calib');
});

test('applyMagnitudeScale: mouth open (non-inverted) - raw above calibration returns open', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(0.5, 0.0, 1.5, false);
  assert.ok(result > 0 && result <= 1, 'mouth partially open when raw > calib');
  assert.ok(Math.abs(result - 0.75) < 1e-10, 'correct calculation: (0.5-0.0)*1.5 = 0.75');
});

test('applyMagnitudeScale: mouth open (non-inverted) - raw much above calibration clamps to 1', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(1.0, 0.0, 1.5, false);
  assert.ok(Math.abs(result - 1.0) < 1e-10, 'mouth fully open clamped at 1');
});

test('applyMagnitudeScale: brow raise with high scale factor', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyMagnitudeScale(0.3, 0.0, 1.8, false);
  assert.ok(Math.abs(result - 0.54) < 1e-10, 'brow scaled correctly: 0.3 * 1.8 = 0.54');
});

test('applyCenterScale: headYaw at center returns center', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyCenterScale(0.5, 0.5, 1.0);
  assert.ok(Math.abs(result - 0.5) < 1e-10, 'center stays at center');
});

test('applyCenterScale: headYaw offset is amplified', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyCenterScale(0.7, 0.5, 1.0);
  assert.ok(Math.abs(result - 0.7) < 1e-10, 'no amplification when scale=1');
});

test('applyCenterScale: headYaw offset is amplified with scale>1', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyCenterScale(0.6, 0.5, 2.0);
  assert.ok(Math.abs(result - 0.7) < 1e-10, 'offset amplified: 0.5 + (0.6-0.5)*2 = 0.7');
});

test('applyCenterScale: result is clamped to [0, 1]', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyCenterScale(1.0, 0.5, 2.0);
  assert.ok(Math.abs(result - 1.0) < 1e-10, 'clamped to 1');
});

test('applyCenterScale: result is clamped to [0, 1] at lower bound', () => {
  const ft = new FaceTrackerTest();
  const result = ft.applyCenterScale(0.0, 0.5, 2.0);
  assert.ok(Math.abs(result - 0.0) < 1e-10, 'clamped to 0');
});

test('smoothValue: first call applies smoothing factor', () => {
  const ft = new FaceTrackerTest();
  const result = ft.smoothValue('test', 1.0);
  assert.ok(Math.abs(result - 0.75) < 1e-10, 'first call: 0 + (1-0)*0.75 = 0.75');
});

test('smoothValue: factor=0.25 converges to target gradually', () => {
  const ft = new FaceTrackerTest();
  ft.smoothValue('test', 0);
  const r1 = ft.smoothValue('test', 1.0);
  const r2 = ft.smoothValue('test', 1.0);
  const r3 = ft.smoothValue('test', 1.0);
  assert.ok(r1 < r2 && r2 < r3 && r3 < 1.0, 'converges gradually');
  assert.ok(Math.abs(r1 - 0.75) < 1e-10, 'first step: 0 + (1-0)*0.75 = 0.75');
});

test('smoothValue: multiple keys are independent', () => {
  const ft = new FaceTrackerTest();
  ft.smoothValue('key_a', 0.5);
  ft.smoothValue('key_b', 0.8);
  const ra = ft.smoothValue('key_a', 1.0);
  const rb = ft.smoothValue('key_b', 0.0);
  assert.ok(Math.abs(ra - 0.84375) < 1e-10, 'key_a independent: 0.375 + (1-0.375)*0.75 = 0.84375');
  assert.ok(Math.abs(rb - 0.15) < 1e-10, 'key_b independent: 0.6 + (0-0.6)*0.75 = 0.15');
});