import { FilesetResolver, PoseLandmarker } from '/web/mediapipe/tasks-vision/vision_bundle.mjs';
import { MediaPipePoseProvider } from './pose-model-provider.js';
import { PoseInferenceScheduler } from './pose-scheduler.js';

const MODEL_PATH = '/web/mediapipe/tasks-vision/pose_landmarker_lite.task';
const WASM_PATH = '/web/mediapipe/tasks-vision/wasm';

let provider = null;
let scheduler = new PoseInferenceScheduler({ profile: 'low' });
let mirrored = true;
let busy = false;

async function init(message) {
  scheduler.setProfile(message.profile || 'low');
  scheduler.resetStats();
  mirrored = message.mirrored !== false;
  provider = new MediaPipePoseProvider({
    modelPath: MODEL_PATH,
    wasmPath: WASM_PATH,
    createLandmarker: async ({ modelPath, wasmPath }) => {
      const fileset = await FilesetResolver.forVisionTasks(wasmPath);
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    },
  });
  await provider.setEnabled(true);
  postMessage({ type: 'ready' });
}

self.onmessage = async (event) => {
  const message = event.data || {};
  try {
    if (message.type === 'init') {
      await init(message);
      return;
    }
    if (message.type === 'configure') {
      scheduler.setProfile(message.profile || 'low');
      mirrored = message.mirrored !== false;
      return;
    }
    if (message.type === 'close') {
      provider?.close();
      provider = null;
      close();
      return;
    }
    if (message.type !== 'frame' || !provider || busy) {
      message.bitmap?.close?.();
      return;
    }
    busy = true;
    const bitmap = message.bitmap;
    const timestampMs = message.timestampMs;
    const frame = scheduler.run('pose', () => provider.detect(bitmap, timestampMs, message.mirrored ?? mirrored), timestampMs);
    bitmap.close?.();
    postMessage({ type: 'frame', frame, stats: scheduler.snapshot(timestampMs) });
  } catch (error) {
    postMessage({ type: 'error', error: error?.message || String(error) });
  } finally {
    busy = false;
  }
};
