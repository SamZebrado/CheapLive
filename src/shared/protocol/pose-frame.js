export const POSE_SCHEMA_VERSION = 1;
export const POSE_FRAME_TYPE = 'pose-frame';
export const POSE_COORDINATE_SPACE = 'normalized-camera';

export const POSE_LANDMARK_NAMES = Object.freeze([
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
]);

export const NEUTRAL_POSE_LANDMARKS = Object.freeze({
  nose: Object.freeze({ x: 0.5, y: 0.2, z: 0, visibility: 1 }),
  leftShoulder: Object.freeze({ x: 0.4, y: 0.35, z: 0, visibility: 1 }),
  rightShoulder: Object.freeze({ x: 0.6, y: 0.35, z: 0, visibility: 1 }),
  leftElbow: Object.freeze({ x: 0.34, y: 0.5, z: 0, visibility: 1 }),
  rightElbow: Object.freeze({ x: 0.66, y: 0.5, z: 0, visibility: 1 }),
  leftWrist: Object.freeze({ x: 0.31, y: 0.65, z: 0, visibility: 1 }),
  rightWrist: Object.freeze({ x: 0.69, y: 0.65, z: 0, visibility: 1 }),
  leftHip: Object.freeze({ x: 0.45, y: 0.65, z: 0, visibility: 1 }),
  rightHip: Object.freeze({ x: 0.55, y: 0.65, z: 0, visibility: 1 }),
});

export function cloneLandmarks(landmarks = {}) {
  return Object.fromEntries(Object.entries(landmarks).map(([name, point]) => [name, { ...point }]));
}

export function createPoseFrame(overrides = {}) {
  return {
    type: POSE_FRAME_TYPE,
    schemaVersion: POSE_SCHEMA_VERSION,
    sequence: 0,
    timestampMs: 0,
    revision: 1,
    sourceId: 'capture',
    tracking: true,
    confidence: 1,
    coordinateSpace: POSE_COORDINATE_SPACE,
    mirrored: true,
    landmarks: cloneLandmarks(NEUTRAL_POSE_LANDMARKS),
    ...overrides,
    landmarks: cloneLandmarks(overrides.landmarks ?? NEUTRAL_POSE_LANDMARKS),
  };
}

export function isPoseFrame(value) {
  return value?.type === POSE_FRAME_TYPE;
}

export function normalizeLegacyPoseFrame(value) {
  if (!value || typeof value !== 'object') return null;
  if (isPoseFrame(value)) return value;
  if (value.type !== 'pose' || !value.points) return null;
  return createPoseFrame({
    sequence: value.sequence ?? value.seq ?? 0,
    timestampMs: value.timestampMs ?? value.timestamp ?? 0,
    revision: value.revision ?? 0,
    sourceId: value.sourceId ?? value.source ?? 'legacy-capture',
    tracking: value.tracking !== false,
    confidence: value.confidence ?? 1,
    mirrored: value.mirrored === true,
    landmarks: value.points,
  });
}

export function mirrorPoseLandmarks(landmarks) {
  const result = {};
  const counterpart = (name) => name.startsWith('left')
    ? `right${name.slice(4)}`
    : name.startsWith('right')
      ? `left${name.slice(5)}`
      : name;
  for (const name of POSE_LANDMARK_NAMES) {
    const source = landmarks[counterpart(name)];
    if (source) result[name] = { ...source, x: 1 - source.x };
  }
  return result;
}
