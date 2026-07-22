import {
  POSE_COORDINATE_SPACE,
  POSE_FRAME_TYPE,
  POSE_LANDMARK_NAMES,
  POSE_SCHEMA_VERSION,
  normalizeLegacyPoseFrame,
} from './pose-frame.js';

const finite = Number.isFinite;

export function validatePoseFrame(input, { allowLegacy = true } = {}) {
  const frame = allowLegacy ? normalizeLegacyPoseFrame(input) : input;
  const errors = [];
  if (!frame || typeof frame !== 'object') return { ok: false, errors: ['frame must be an object'], frame: null };
  if (frame.type !== POSE_FRAME_TYPE) errors.push('type must be pose-frame');
  if (frame.schemaVersion !== POSE_SCHEMA_VERSION) errors.push('schemaVersion must be 1');
  if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) errors.push('sequence must be a non-negative safe integer');
  if (!finite(frame.timestampMs) || frame.timestampMs < 0) errors.push('timestampMs must be finite and non-negative');
  if (!Number.isSafeInteger(frame.revision) || frame.revision < 0) errors.push('revision must be a non-negative safe integer');
  if (typeof frame.sourceId !== 'string' || frame.sourceId.length < 1 || frame.sourceId.length > 64) errors.push('sourceId must be 1-64 characters');
  if (typeof frame.tracking !== 'boolean') errors.push('tracking must be boolean');
  if (!finite(frame.confidence) || frame.confidence < 0 || frame.confidence > 1) errors.push('confidence must be in [0,1]');
  if (frame.coordinateSpace !== POSE_COORDINATE_SPACE) errors.push('coordinateSpace must be normalized-camera');
  if (typeof frame.mirrored !== 'boolean') errors.push('mirrored must be boolean');
  if (!frame.landmarks || typeof frame.landmarks !== 'object' || Array.isArray(frame.landmarks)) {
    errors.push('landmarks must be an object');
  } else {
    for (const [name, point] of Object.entries(frame.landmarks)) {
      if (!POSE_LANDMARK_NAMES.includes(name)) {
        errors.push(`unknown landmark: ${name}`);
        continue;
      }
      if (!point || typeof point !== 'object') {
        errors.push(`${name} must be an object`);
        continue;
      }
      if (!finite(point.x) || point.x < 0 || point.x > 1) errors.push(`${name}.x must be in [0,1]`);
      if (!finite(point.y) || point.y < 0 || point.y > 1) errors.push(`${name}.y must be in [0,1]`);
      if (!finite(point.z) || point.z < -2 || point.z > 2) errors.push(`${name}.z must be in [-2,2]`);
      if (!finite(point.visibility) || point.visibility < 0 || point.visibility > 1) errors.push(`${name}.visibility must be in [0,1]`);
    }
  }
  return { ok: errors.length === 0, errors, frame };
}

export class PoseFrameGate {
  constructor({ confidenceEnter = 0.6, confidenceExit = 0.45 } = {}) {
    this.confidenceEnter = confidenceEnter;
    this.confidenceExit = confidenceExit;
    this.reset();
  }

  reset() {
    this.lastSequence = -1;
    this.revision = -1;
    this.sourceId = null;
    this.tracking = false;
  }

  accept(input) {
    const validation = validatePoseFrame(input);
    if (!validation.ok) return { accepted: false, reason: 'invalid', errors: validation.errors };
    const frame = validation.frame;
    if (this.sourceId !== null && frame.sourceId === this.sourceId) {
      if (frame.revision < this.revision) return { accepted: false, reason: 'stale-revision' };
      if (frame.revision === this.revision && frame.sequence <= this.lastSequence) {
        return { accepted: false, reason: frame.sequence === this.lastSequence ? 'duplicate' : 'stale-sequence' };
      }
    }
    const threshold = this.tracking ? this.confidenceExit : this.confidenceEnter;
    if (frame.tracking && frame.confidence < threshold) {
      this.tracking = false;
      return { accepted: false, reason: 'low-confidence' };
    }
    this.sourceId = frame.sourceId;
    this.revision = frame.revision;
    this.lastSequence = frame.sequence;
    this.tracking = frame.tracking;
    return { accepted: true, reason: frame.tracking ? 'tracking' : 'tracking-lost', frame };
  }
}
