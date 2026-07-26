import { POSE_LANDMARK_NAMES, cloneLandmarks } from './pose-frame.js';

export function createPoseCalibration(frames) {
  const tracked = frames.filter((frame) => frame?.tracking && frame.confidence >= 0.6);
  if (tracked.length === 0) throw new Error('Pose calibration requires at least one tracked frame');
  const offsets = {};
  for (const name of POSE_LANDMARK_NAMES) {
    const points = tracked.map((frame) => frame.landmarks?.[name]).filter(Boolean);
    if (points.length === 0) continue;
    offsets[name] = {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
    };
  }
  return { schemaVersion: 1, sampleCount: tracked.length, offsets };
}

export function applyPoseCalibration(landmarks, calibration, neutralLandmarks) {
  const result = cloneLandmarks(landmarks);
  for (const [name, point] of Object.entries(result)) {
    const offset = calibration?.offsets?.[name];
    const neutral = neutralLandmarks?.[name];
    if (!offset || !neutral) continue;
    point.x = point.x - offset.x + neutral.x;
    point.y = point.y - offset.y + neutral.y;
    point.z = point.z - offset.z + neutral.z;
  }
  return result;
}
