import test from 'node:test';
import assert from 'node:assert/strict';
import { POSE_MODEL_INFO, MediaPipePoseProvider, mapMediaPipePoseResult } from '../../src/shared/motion/pose-model-provider.js';
import { PERFORMANCE_PROFILES, PoseInferenceScheduler } from '../../src/shared/motion/pose-scheduler.js';
import { PoseState } from '../../src/shared/motion/pose-state.js';
import { PoseWorkerClient } from '../../src/shared/motion/pose-worker-client.js';
import { PoseSimulator } from '../../src/shared/protocol/pose-simulator.js';

test('model metadata is pinned to the audited official artifact', () => {
  assert.equal(POSE_MODEL_INFO.version, 'float16/1');
  assert.equal(POSE_MODEL_INFO.size, 5777746);
  assert.equal(POSE_MODEL_INFO.sha256.length, 64);
  assert.equal(POSE_MODEL_INFO.license, 'Apache-2.0');
});

test('MediaPipe mapping selects the nine upper-body joints and handles tracking loss', () => {
  const points = Array.from({ length: 33 }, (_, i) => ({ x: i / 40, y: i / 50, z: 0, visibility: 0.9 }));
  const frame = mapMediaPipePoseResult({ landmarks: [points] }, { sequence: 1, timestampMs: 5 });
  assert.equal(Object.keys(frame.landmarks).length, 9);
  assert.equal(frame.landmarks.leftShoulder.x, points[11].x);
  assert.equal(frame.tracking, true);
  assert.equal(mapMediaPipePoseResult({ landmarks: [] }).tracking, false);
});

test('provider lazy-loads only after explicit enable and closes cleanly', async () => {
  let loads = 0; let detects = 0; let closed = 0;
  const provider = new MediaPipePoseProvider({
    createLandmarker: async () => { loads++; return { detectForVideo: () => { detects++; return { landmarks: [] }; }, close: () => closed++ }; },
    modelPath: '/model.task', wasmPath: '/wasm', clock: () => 10,
  });
  assert.equal(provider.detect({}), null);
  assert.equal(loads, 0);
  await provider.setEnabled(true);
  assert.equal(loads, 1);
  assert.equal(provider.detect({}).tracking, false);
  assert.equal(detects, 1);
  provider.close();
  assert.equal(closed, 1);
});

test('performance profiles stay within the requested face/pose ranges', () => {
  assert.deepEqual(PERFORMANCE_PROFILES.low, { faceFps: 15, poseFps: 8, inputWidth: 256 });
  assert.ok(PERFORMANCE_PROFILES.balanced.faceFps === 20 && PERFORMANCE_PROFILES.balanced.poseFps >= 12);
  assert.ok(PERFORMANCE_PROFILES.high.faceFps <= 30 && PERFORMANCE_PROFILES.high.poseFps <= 24);
});

test('scheduler runs heavy inference serially, skips hidden frames, and reports effective FPS', () => {
  let now = 0;
  const scheduler = new PoseInferenceScheduler({ profile: 'low', clock: () => now });
  assert.deepEqual(scheduler.plan(now, { faceEnabled: true, poseEnabled: true }), { face: true, pose: true });
  const face = scheduler.run('face', () => { now += 4; return 'face'; }, 0);
  const pose = scheduler.run('pose', () => { now += 8; return 'pose'; }, 0);
  assert.equal(face, 'face'); assert.equal(pose, 'pose');
  assert.deepEqual(scheduler.plan(10, { visible: false }), { face: false, pose: false });
  now = 1000;
  const stats = scheduler.snapshot();
  assert.equal(stats.faceFrames, 1); assert.equal(stats.poseFrames, 1);
  assert.ok(stats.faceInferenceMs > 0 && stats.poseInferenceMs > 0);
});

test('PoseState derives stable rig values, rejects stale frames, and limits non-humanoid mapping', () => {
  let now = 100;
  const sim = new PoseSimulator({ now: () => now += 16 }); sim.setEnabled(true);
  const state = new PoseState({ aspectRatio: 16 / 9 });
  const frame = sim.frame('left-arm-up');
  const applied = state.apply(frame, frame.timestampMs);
  assert.equal(applied.accepted, true);
  assert.ok(Number.isFinite(applied.state.leftUpperArmAngle));
  assert.equal(state.apply(frame, frame.timestampMs).reason, 'duplicate');
  const limited = state.rigFor('fish');
  assert.deepEqual(Object.keys(limited).sort(), ['torsoLean', 'tracking']);
  assert.ok('leftWrist' in state.rigFor('debug-puppet'));
});

test('worker client loads only on enable, transfers resized frames, bounds concurrency, and disables', async () => {
  const sent = [];
  const worker = { postMessage: (message, transfer) => sent.push({ message, transfer }), terminateCalled: 0, terminate() { this.terminateCalled++; } };
  let bitmaps = 0;
  const statuses = [];
  const client = new PoseWorkerClient({
    workerFactory: () => worker,
    createBitmap: async () => ({ id: ++bitmaps, close() {} }),
    onStatus: (status) => statuses.push(status),
  });
  assert.equal(sent.length, 0);
  client.enable({ profile: 'low' });
  assert.equal(sent[0].message.type, 'init');
  worker.onmessage({ data: { type: 'ready' } });
  assert.equal(await client.process({ videoWidth: 640, videoHeight: 480 }, 10), true);
  assert.equal(await client.process({ videoWidth: 640, videoHeight: 480 }, 11), false);
  assert.equal(sent[1].message.bitmap.id, 1);
  worker.onmessage({ data: { type: 'frame', frame: { type: 'pose-frame' }, stats: {} } });
  assert.equal(client.busy, false);
  client.disable();
  assert.ok(statuses.includes('ready') && statuses.at(-1) === 'off');
  assert.equal(worker.terminateCalled, 1);
});
