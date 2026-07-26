import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEUTRAL_POSE_LANDMARKS,
  createPoseFrame,
  mirrorPoseLandmarks,
  normalizeLegacyPoseFrame,
} from '../../src/shared/protocol/pose-frame.js';
import { PoseFrameGate, validatePoseFrame } from '../../src/shared/protocol/pose-validator.js';
import { PoseSimulator } from '../../src/shared/protocol/pose-simulator.js';
import { PoseSmoother } from '../../src/shared/protocol/pose-smoothing.js';
import { applyPoseCalibration, createPoseCalibration } from '../../src/shared/protocol/pose-calibration.js';

const simulator = () => {
  let now = 1000;
  const value = new PoseSimulator({ now: () => now += 16 });
  value.setEnabled(true);
  return value;
};

test('pose simulator is silent while disabled and emits versioned frames when enabled', () => {
  const sim = new PoseSimulator({ now: () => 10 });
  assert.equal(sim.frame(), null);
  sim.setEnabled(true);
  const frame = sim.frame();
  assert.equal(frame.type, 'pose-frame');
  assert.equal(frame.schemaVersion, 1);
  assert.equal(validatePoseFrame(frame).ok, true);
});

test('neutral, lean, arm, both-arm, and crossed-wrist scenarios have correct directions', () => {
  const sim = simulator();
  const neutral = sim.frame('neutral').landmarks;
  assert.ok(sim.frame('lean-left').landmarks.nose.x < neutral.nose.x);
  assert.ok(sim.frame('lean-right').landmarks.nose.x > neutral.nose.x);
  assert.ok(sim.frame('left-arm-up').landmarks.leftWrist.y < neutral.leftWrist.y);
  assert.ok(sim.frame('right-arm-up').landmarks.rightWrist.y < neutral.rightWrist.y);
  const both = sim.frame('both-arms-up').landmarks;
  assert.ok(both.leftWrist.y < neutral.leftWrist.y && both.rightWrist.y < neutral.rightWrist.y);
  const crossed = sim.frame('wrists-crossed').landmarks;
  assert.ok(crossed.leftWrist.x > crossed.rightWrist.x);
});

test('validator rejects invalid timestamps, NaN, Infinity, and unknown landmarks', () => {
  assert.equal(validatePoseFrame(createPoseFrame({ timestampMs: NaN })).ok, false);
  assert.equal(validatePoseFrame(createPoseFrame({ confidence: Infinity })).ok, false);
  const bad = createPoseFrame();
  bad.landmarks.nose.x = NaN;
  assert.equal(validatePoseFrame(bad).ok, false);
  const unknown = createPoseFrame();
  unknown.landmarks.ankle = { x: 0, y: 0, z: 0, visibility: 1 };
  assert.equal(validatePoseFrame(unknown).ok, false);
});

test('gate rejects low confidence, duplicate, rollback, and stale revision then recovers', () => {
  const sim = simulator();
  const gate = new PoseFrameGate();
  const low = sim.frame('neutral', { confidence: 0.2 });
  assert.equal(gate.accept(low).reason, 'low-confidence');
  const tracked = sim.frame('neutral', { confidence: 0.9 });
  assert.equal(gate.accept(tracked).accepted, true);
  assert.equal(gate.accept(tracked).reason, 'duplicate');
  assert.equal(gate.accept({ ...tracked, sequence: tracked.sequence - 1 }).reason, 'stale-sequence');
  assert.equal(gate.accept({ ...tracked, sequence: tracked.sequence + 1, revision: 0 }).reason, 'stale-revision');
  const lost = sim.frame('neutral', { tracking: false, confidence: 0 });
  assert.equal(gate.accept(lost).reason, 'tracking-lost');
  assert.equal(gate.accept(sim.frame('neutral')).reason, 'tracking');
});

test('missing joints fall back to the last good value and tracking timeout blends to neutral', () => {
  const sim = simulator();
  const smoother = new PoseSmoother({ alpha: 1, neutralAlpha: 0.5, trackingTimeoutMs: 100 });
  const raised = sim.frame('left-arm-up');
  const first = smoother.update(raised, 1000);
  const priorWrist = first.landmarks.leftWrist;
  const missing = sim.frame('neutral');
  delete missing.landmarks.leftWrist;
  const fallback = smoother.update(missing, 1050);
  assert.deepEqual(fallback.landmarks.leftWrist, priorWrist);
  assert.equal(smoother.update(sim.frame('neutral', { tracking: false }), 1080).tracking, true);
  const lost = smoother.update(sim.frame('neutral', { tracking: false }), 1200);
  assert.equal(lost.tracking, false);
  assert.ok(lost.landmarks.leftWrist.y > priorWrist.y);
});

test('smoothing bounds jitter and maximum movement', () => {
  const sim = simulator();
  const smoother = new PoseSmoother({ alpha: 0.25, maxDelta: 0.04 });
  const outputs = sim.jitter(12, 0.02).map((frame) => smoother.update(frame, frame.timestampMs).landmarks.nose.x);
  const range = Math.max(...outputs) - Math.min(...outputs);
  assert.ok(range < 0.02);
  const jump = sim.frame('neutral');
  jump.landmarks.nose.x = 1;
  const before = outputs.at(-1);
  const after = smoother.update(jump, jump.timestampMs).landmarks.nose.x;
  assert.ok(after - before <= 0.011);
});

test('mirroring swaps semantic sides and camera x direction', () => {
  const mirrored = mirrorPoseLandmarks(NEUTRAL_POSE_LANDMARKS);
  assert.equal(mirrored.leftWrist.x, 1 - NEUTRAL_POSE_LANDMARKS.rightWrist.x);
  assert.equal(mirrored.rightWrist.x, 1 - NEUTRAL_POSE_LANDMARKS.leftWrist.x);
});

test('calibration offsets a biased neutral back to canonical neutral', () => {
  const sim = simulator();
  const biased = [sim.frame(), sim.frame()];
  for (const frame of biased) for (const point of Object.values(frame.landmarks)) point.x += 0.05;
  const calibration = createPoseCalibration(biased);
  const corrected = applyPoseCalibration(biased[0].landmarks, calibration, NEUTRAL_POSE_LANDMARKS);
  assert.ok(Math.abs(corrected.nose.x - NEUTRAL_POSE_LANDMARKS.nose.x) < 1e-9);
  assert.equal(calibration.sampleCount, 2);
});

test('legacy pose input is adapted while face-only messages remain untouched', () => {
  const legacy = normalizeLegacyPoseFrame({
    type: 'pose', seq: 3, timestamp: 50, points: NEUTRAL_POSE_LANDMARKS,
  });
  assert.equal(validatePoseFrame(legacy).ok, true);
  const face = { type: 'face-frame', sequence: 3 };
  assert.equal(normalizeLegacyPoseFrame(face), null);
  assert.deepEqual(face, { type: 'face-frame', sequence: 3 });
});
