import { createPoseFrame } from '../protocol/pose-frame.js';

export const POSE_MODEL_INFO = Object.freeze({
  name: 'MediaPipe Pose Landmarker Lite',
  version: 'float16/1',
  file: 'pose_landmarker_lite.task',
  size: 5777746,
  sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  license: 'Apache-2.0',
  source: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
});

const INDEX = Object.freeze({
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
});

export function mapMediaPipePoseResult(result, meta = {}) {
  const source = result?.landmarks?.[0];
  if (!Array.isArray(source) || source.length < 25) {
    return createPoseFrame({ ...meta, tracking: false, confidence: 0, landmarks: {} });
  }
  const landmarks = {};
  let confidence = 1;
  for (const [name, index] of Object.entries(INDEX)) {
    const point = source[index];
    const visibility = Number.isFinite(point?.visibility) ? point.visibility : 0;
    landmarks[name] = {
      x: point?.x,
      y: point?.y,
      z: point?.z ?? 0,
      visibility,
    };
    confidence = Math.min(confidence, visibility);
  }
  return createPoseFrame({ ...meta, tracking: true, confidence, landmarks });
}

export class MediaPipePoseProvider {
  constructor({ createLandmarker, modelPath, wasmPath, clock = () => performance.now() }) {
    this.createLandmarker = createLandmarker;
    this.modelPath = modelPath;
    this.wasmPath = wasmPath;
    this.clock = clock;
    this.task = null;
    this.loading = null;
    this.enabled = false;
    this.sequence = 0;
    this.revision = 1;
    this.sourceId = 'mediapipe-pose-lite';
    this.status = 'off';
  }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.status = this.task ? 'ready-disabled' : 'off';
      return;
    }
    await this.load();
  }

  async load() {
    if (this.task) return this.task;
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = Promise.resolve(this.createLandmarker({ modelPath: this.modelPath, wasmPath: this.wasmPath }))
      .then((task) => {
        this.task = task;
        this.status = 'ready';
        return task;
      })
      .catch((error) => {
        this.status = 'error';
        throw error;
      })
      .finally(() => { this.loading = null; });
    return this.loading;
  }

  detect(image, timestampMs = this.clock(), mirrored = true) {
    if (!this.enabled || !this.task) return null;
    const result = this.task.detectForVideo(image, timestampMs);
    return mapMediaPipePoseResult(result, {
      sequence: ++this.sequence,
      timestampMs,
      revision: this.revision,
      sourceId: this.sourceId,
      mirrored,
    });
  }

  close() {
    this.enabled = false;
    if (this.task?.close) this.task.close();
    this.task = null;
    this.status = 'off';
  }
}
