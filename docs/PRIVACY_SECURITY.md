# Privacy and Security Boundaries

## Local camera processing

Face and pose inference consume the same local camera stream. Raw frames and transferred `ImageBitmap` objects remain inside the capture page/Worker and are released after inference. CheapLive does not serialize, persist, log, or send raw camera pixels through the native bridge or WebSocket.

The motion wire format contains normalized upper-body landmarks and aggregate confidence/performance metadata. These values can still reveal body motion and should be treated as personal sensor data. Use the Receiver only on a trusted local network, keep the session token private, and stop capture when it is not needed.

## Storage

Android `SharedPreferences` stores only opt-in settings: enabled state, mode, performance profile, smoothing, mirror, and debug-skeleton preference. Pose frames, landmark history, calibration samples, FPS history, and camera frames are not persisted. Neutral calibration exists only in current page memory.

## Validation and resource limits

The Android bridge accepts only schema v1 pose frames under 32 KiB, nine known landmark names, finite bounded coordinates, and finite confidence. Unknown fields are not rebroadcast. Receiver sequence/revision gates reject duplicate, rollback, stale, low-confidence, and malformed frames. Telemetry notification is throttled to avoid UI/SSE amplification.

## Network boundary

The local Receiver server uses token authentication but serves ordinary HTTP/WebSocket traffic on the LAN. It is not designed for direct internet exposure. The motion Beta adds no cloud API and loads its model/runtime from packaged same-origin assets.
