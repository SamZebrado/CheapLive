import {
  NEUTRAL_POSE_LANDMARKS,
  cloneLandmarks,
  createPoseFrame,
  mirrorPoseLandmarks,
} from './pose-frame.js';

function scenarioLandmarks(name) {
  const p = cloneLandmarks(NEUTRAL_POSE_LANDMARKS);
  const moveTorso = (dx) => {
    for (const key of Object.keys(p)) p[key].x += dx;
  };
  switch (name) {
    case 'neutral': break;
    case 'lean-left': moveTorso(-0.08); p.leftShoulder.y += 0.04; p.rightShoulder.y -= 0.04; break;
    case 'lean-right': moveTorso(0.08); p.leftShoulder.y -= 0.04; p.rightShoulder.y += 0.04; break;
    case 'left-arm-up': p.leftElbow = { x: 0.31, y: 0.27, z: 0, visibility: 1 }; p.leftWrist = { x: 0.27, y: 0.12, z: 0, visibility: 1 }; break;
    case 'right-arm-up': p.rightElbow = { x: 0.69, y: 0.27, z: 0, visibility: 1 }; p.rightWrist = { x: 0.73, y: 0.12, z: 0, visibility: 1 }; break;
    case 'both-arms-up':
      p.leftElbow = { x: 0.31, y: 0.27, z: 0, visibility: 1 }; p.leftWrist = { x: 0.27, y: 0.12, z: 0, visibility: 1 };
      p.rightElbow = { x: 0.69, y: 0.27, z: 0, visibility: 1 }; p.rightWrist = { x: 0.73, y: 0.12, z: 0, visibility: 1 }; break;
    case 'wrists-crossed': p.leftWrist.x = 0.57; p.rightWrist.x = 0.43; p.leftWrist.y = p.rightWrist.y = 0.48; break;
    default: throw new Error(`Unknown pose simulator scenario: ${name}`);
  }
  return p;
}

export class PoseSimulator {
  constructor({ sourceId = 'pose-simulator', revision = 1, now = () => Date.now() } = {}) {
    this.sourceId = sourceId;
    this.revision = revision;
    this.now = now;
    this.sequence = 0;
    this.enabled = false;
  }

  setEnabled(enabled) { this.enabled = Boolean(enabled); }

  frame(name = 'neutral', overrides = {}) {
    if (!this.enabled) return null;
    let landmarks = scenarioLandmarks(name);
    if (overrides.mirrored === true) landmarks = mirrorPoseLandmarks(landmarks);
    return createPoseFrame({
      sequence: ++this.sequence,
      timestampMs: this.now(),
      revision: this.revision,
      sourceId: this.sourceId,
      mirrored: overrides.mirrored ?? false,
      tracking: overrides.tracking ?? true,
      confidence: overrides.confidence ?? 0.95,
      landmarks: overrides.landmarks ?? landmarks,
      ...overrides,
    });
  }

  jitter(count, amplitude = 0.01) {
    const frames = [];
    for (let i = 0; i < count; i++) {
      const landmarks = scenarioLandmarks('neutral');
      for (const point of Object.values(landmarks)) {
        point.x += (i % 2 ? 1 : -1) * amplitude;
        point.y += (i % 3 ? 1 : -1) * amplitude;
      }
      frames.push(this.frame('neutral', { landmarks }));
    }
    return frames;
  }
}

export { scenarioLandmarks };
