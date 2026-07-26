export const PERFORMANCE_PROFILES = Object.freeze({
  low: Object.freeze({ faceFps: 15, poseFps: 8, inputWidth: 256 }),
  balanced: Object.freeze({ faceFps: 20, poseFps: 12, inputWidth: 320 }),
  high: Object.freeze({ faceFps: 30, poseFps: 20, inputWidth: 480 }),
});

export class PoseInferenceScheduler {
  constructor({ profile = 'low', clock = () => performance.now() } = {}) {
    this.clock = clock;
    this.setProfile(profile);
    this.resetStats();
  }

  setProfile(profile) {
    if (!PERFORMANCE_PROFILES[profile]) throw new Error(`Unknown performance profile: ${profile}`);
    this.profileName = profile;
    this.profile = PERFORMANCE_PROFILES[profile];
    this.lastFaceAt = -Infinity;
    this.lastPoseAt = -Infinity;
  }

  resetStats() {
    this.stats = {
      faceInferenceMs: 0,
      poseInferenceMs: 0,
      faceFrames: 0,
      poseFrames: 0,
      frameSkipped: 0,
      droppedMessages: 0,
      startedAt: this.clock(),
    };
    this.busy = false;
  }

  plan(now = this.clock(), { faceEnabled = true, poseEnabled = false, visible = true } = {}) {
    if (!visible || this.busy) {
      this.stats.frameSkipped++;
      return { face: false, pose: false };
    }
    const face = faceEnabled && now - this.lastFaceAt >= 1000 / this.profile.faceFps;
    const pose = poseEnabled && now - this.lastPoseAt >= 1000 / this.profile.poseFps;
    if (!face && !pose) this.stats.frameSkipped++;
    // Both tasks may run in the same video callback, but are always executed
    // serially by run() and never overlap as concurrent heavy inference.
    return { face, pose };
  }

  run(kind, fn, now = this.clock()) {
    if (this.busy) {
      this.stats.frameSkipped++;
      return null;
    }
    this.busy = true;
    const start = this.clock();
    try {
      const result = fn();
      const duration = Math.max(0, this.clock() - start);
      const key = kind === 'face' ? 'faceInferenceMs' : 'poseInferenceMs';
      const count = kind === 'face' ? ++this.stats.faceFrames : ++this.stats.poseFrames;
      this.stats[key] += (duration - this.stats[key]) / Math.min(count, 30);
      if (kind === 'face') this.lastFaceAt = now;
      else this.lastPoseAt = now;
      return result;
    } finally {
      this.busy = false;
    }
  }

  snapshot(now = this.clock()) {
    const seconds = Math.max(0.001, (now - this.stats.startedAt) / 1000);
    return {
      profile: this.profileName,
      ...this.stats,
      effectiveFaceFps: this.stats.faceFrames / seconds,
      effectivePoseFps: this.stats.poseFrames / seconds,
    };
  }
}
