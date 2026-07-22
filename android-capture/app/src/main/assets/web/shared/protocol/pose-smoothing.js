import { NEUTRAL_POSE_LANDMARKS, POSE_LANDMARK_NAMES, cloneLandmarks } from './pose-frame.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function blendPoint(from, to, alpha, maxDelta) {
  const result = {};
  for (const key of ['x', 'y', 'z']) {
    const delta = clamp(to[key] - from[key], -maxDelta, maxDelta);
    result[key] = from[key] + delta * alpha;
  }
  result.visibility = from.visibility + (to.visibility - from.visibility) * alpha;
  return result;
}

export class PoseSmoother {
  constructor({ alpha = 0.35, maxDelta = 0.25, trackingTimeoutMs = 500, neutralAlpha = 0.18, minVisibility = 0.35 } = {}) {
    this.alpha = alpha;
    this.maxDelta = maxDelta;
    this.trackingTimeoutMs = trackingTimeoutMs;
    this.neutralAlpha = neutralAlpha;
    this.minVisibility = minVisibility;
    this.reset();
  }

  reset() {
    this.landmarks = cloneLandmarks(NEUTRAL_POSE_LANDMARKS);
    this.lastTrackedAt = null;
    this.tracking = false;
  }

  update(frame, nowMs = frame?.timestampMs ?? 0) {
    const usable = frame?.tracking === true && frame.confidence >= 0.45;
    if (usable) {
      for (const name of POSE_LANDMARK_NAMES) {
        const candidate = frame.landmarks?.[name];
        const target = candidate && candidate.visibility >= this.minVisibility ? candidate : this.landmarks[name];
        this.landmarks[name] = blendPoint(this.landmarks[name], target, this.alpha, this.maxDelta);
      }
      this.lastTrackedAt = nowMs;
      this.tracking = true;
    } else if (this.lastTrackedAt === null || nowMs - this.lastTrackedAt >= this.trackingTimeoutMs) {
      for (const name of POSE_LANDMARK_NAMES) {
        this.landmarks[name] = blendPoint(this.landmarks[name], NEUTRAL_POSE_LANDMARKS[name], this.neutralAlpha, this.maxDelta);
      }
      this.tracking = false;
    }
    return { tracking: this.tracking, landmarks: cloneLandmarks(this.landmarks), ageMs: this.lastTrackedAt === null ? Infinity : Math.max(0, nowMs - this.lastTrackedAt) };
  }
}
