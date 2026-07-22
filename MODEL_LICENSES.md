# Bundled Model Licenses

## MediaPipe Pose Landmarker Lite

- Artifact: `pose_landmarker_lite.task`
- Upstream version: `float16/1`
- Purpose: local upper-body pose landmark inference
- Size: 5,777,746 bytes
- SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- Canonical source: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- License: Apache License 2.0
- License text: `src/face-tracking/mediapipe/LICENSE`

The repository copy is stored at `src/shared/models/pose_landmarker_lite.task`. Android copies are deterministic mirrors listed in `docs/architecture/WEB_ASSET_SYNC_MANIFEST.json`.

MediaPipe's Pose Landmarker model card describes the BlazePose GHUM family and Lite/Full/Heavy variants. The Lite artifact is used here to bound mobile APK size and inference cost; the Beta does not claim medical, safety-critical, identity, or full-body biomechanical accuracy.
