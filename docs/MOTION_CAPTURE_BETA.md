# Upper-body Motion Capture Beta

Status: Beta, opt-in, local/offline inference. Default is **off**.

## Scope

The Android Capture app can reuse the same front-camera stream for face and upper-body tracking. Pose inference runs serially in an isolated Web Worker and publishes only nine normalized landmarks: nose, shoulders, elbows, wrists, and hips. The Receiver owns a separate `PoseState`, rejects invalid/stale/duplicate frames, smooths movement, returns to neutral after tracking loss, and can draw an optional confidence-colored debug skeleton.

This Beta is not full-body capture, hand/finger tracking, background capture, or a humanoid retargeting claim. Current non-humanoid avatars are not forced into limb animation; the debug puppet is the verified visual target.

## User controls

- Explicit enable/disable; no model request occurs while disabled.
- Mode: simulator or real camera.
- Performance: low (face 15 / pose 8 FPS), balanced (20 / 12), high (30 / 20).
- Smoothing from 0 to 1, semantic mirror, and debug-skeleton toggle.
- Neutral calibration collects 24 sufficiently confident frames and stores the calibration only in page memory.

Only settings are persisted. Camera frames, bitmaps, pose landmarks, and calibration samples are not written to disk. The Worker closes transferred bitmaps, allows one inference at a time, pauses submissions when the page is hidden, and is terminated when pose capture is disabled or the page exits.

## Protocol

The canonical schema is `src/shared/protocol/pose-frame.schema.json`; implementation and validation live beside it. Schema version 1 uses `normalized-camera` coordinates, a source/revision/sequence tuple, tracking/confidence flags, mirror metadata, and the nine-landmark allowlist. Coordinates and visibility are finite and range-checked at both JavaScript and Android bridge boundaries.

The Receiver handles pose messages independently from face/audio messages. A 500 ms tracking timeout begins a bounded blend to neutral. Low-confidence joints retain the last good value, and all derived angles are computed only from sanitized/smoothed landmarks.

## Model and runtime

The bundled model is MediaPipe Pose Landmarker Lite `float16/1`, 5,777,746 bytes, SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`. It is pinned at `src/shared/models/pose_landmarker_lite.task` and mirrored into Android assets by the asset-sync manifest. See `MODEL_LICENSES.md` and `THIRD_PARTY_NOTICES.md`.

MediaPipe's Emscripten WASM loader needs `importScripts`; CheapLive therefore starts a classic Worker bootstrap and dynamically loads the modular pose runtime. The bootstrap queues early messages until the runtime owns `onmessage`.

## Verification

- Protocol/unit cases cover disabled behavior, neutral/lean/arms/crossed wrists, invalid and non-finite values, confidence hysteresis, missing joints, tracking loss/recovery, mirroring, calibration, smoothing, scheduling, lazy model load, and Worker lifecycle.
- Browser cases prove default-off lazy loading, simulator directions and stale rejection, tracking loss, visible debug-skeleton pixels, and the pre-existing face/transparent/audio lifecycle regression gate.
- Android JVM cases prove bridge allowlisting/range checks, sanitized broadcasting, aggregate-only telemetry, default-off controls, and settings validation.

Live device performance and human-body acquisition must be recorded separately; software tests do not substitute for that evidence.

## Black-screen capture interaction

The Android foreground-only black-screen mode leaves this page and its Web Worker attached and resumed; it does not enable pose capture, load the pose model, create another camera stream, or rebuild the Worker. When pose is already enabled, face and pose continue to share the existing camera while the Activity remains foreground and screen-on. When pose is disabled, entering black-screen mode does not load the model.

This is not background motion capture. An intentional lock or background transition remains subject to Android's Activity/WebView camera lifecycle. `CaptureServerService` may keep LocalServer available independently; that server state is not evidence that pose inference continues. See `BLACK_SCREEN_CAPTURE.md` and `architecture/BACKGROUND_CAMERA_OPTIONS.md`.
