import { PoseFrameGate } from '../protocol/pose-validator.js';
import { PoseSmoother } from '../protocol/pose-smoothing.js';

const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));

export class PoseState {
  constructor({ aspectRatio = 1, smoother, gate } = {}) {
    this.aspectRatio = aspectRatio;
    this.smoother = smoother ?? new PoseSmoother();
    this.gate = gate ?? new PoseFrameGate();
    this.last = this.derive(this.smoother.update(null, 0));
  }

  setAspectRatio(value) { if (Number.isFinite(value) && value > 0) this.aspectRatio = value; }

  apply(frame, nowMs = frame?.timestampMs ?? 0) {
    const decision = this.gate.accept(frame);
    if (!decision.accepted) {
      if (decision.reason === 'low-confidence') this.last = this.derive(this.smoother.update({ tracking: false, confidence: 0 }, nowMs));
      return { accepted: false, reason: decision.reason, state: this.last };
    }
    this.last = this.derive(this.smoother.update(decision.frame, nowMs));
    return { accepted: true, reason: decision.reason, state: this.last };
  }

  tick(nowMs) {
    this.last = this.derive(this.smoother.update({ tracking: false, confidence: 0 }, nowMs));
    return this.last;
  }

  derive(smoothed) {
    const p = smoothed.landmarks;
    const shoulderCenter = midpoint(p.leftShoulder, p.rightShoulder);
    const hipCenter = midpoint(p.leftHip, p.rightHip);
    const torsoCenter = midpoint(shoulderCenter, hipCenter);
    const corrected = (point) => ({ ...point, x: (point.x - 0.5) * this.aspectRatio + 0.5 });
    const ls = corrected(p.leftShoulder); const rs = corrected(p.rightShoulder);
    const le = corrected(p.leftElbow); const re = corrected(p.rightElbow);
    const lw = corrected(p.leftWrist); const rw = corrected(p.rightWrist);
    const leftConfidence = Math.min(p.leftShoulder.visibility, p.leftElbow.visibility, p.leftWrist.visibility);
    const rightConfidence = Math.min(p.rightShoulder.visibility, p.rightElbow.visibility, p.rightWrist.visibility);
    return {
      tracking: smoothed.tracking,
      trackingAgeMs: smoothed.ageMs,
      landmarks: p,
      shoulderCenter,
      hipCenter,
      torsoCenter,
      torsoLean: angle(hipCenter, shoulderCenter) + Math.PI / 2,
      shoulderAngle: angle(ls, rs),
      leftUpperArmAngle: angle(ls, le),
      rightUpperArmAngle: angle(rs, re),
      leftForearmAngle: angle(le, lw),
      rightForearmAngle: angle(re, rw),
      leftWrist: lw,
      rightWrist: rw,
      leftArmExtension: distance(ls, lw),
      rightArmExtension: distance(rs, rw),
      leftConfidence,
      rightConfidence,
    };
  }

  rigFor(avatarKind = 'non-humanoid') {
    if (avatarKind === 'humanoid' || avatarKind === 'debug-puppet') return this.last;
    return { tracking: this.last.tracking, torsoLean: this.last.torsoLean };
  }
}
