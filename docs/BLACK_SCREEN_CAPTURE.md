# Black Screen Capture

Black Screen Capture is a foreground-only Android mode for reducing visible light while face and optional pose capture continue in the existing `MainActivity` WebView.

## What it does

- Adds `FLAG_KEEP_SCREEN_ON` while active so the normal automatic screen timeout does not lock the device.
- Places one opaque `#000000` view over the Activity content and hides the Android system bars.
- Uses a per-window brightness tier: Extra dim (`0.02`), Low (`0.08`), or System. The selected tier is persisted; active state is not persisted across a cold launch.
- Leaves the WebView attached and resumed. It does not reload the page, create another camera client, restart a Worker, or change LocalServer identity.

Open the main capture screen and tap **黑屏采集 / Black Screen Capture**. A short hint disappears after three seconds. A normal tap does not exit. Hold the black screen for about 1.5 seconds, or press Back once, to restore the previous UI, brightness, keep-screen-on flag, and system-bar state.

## Boundaries

This mode prevents automatic timeout only while `MainActivity` remains in the foreground. It does not bypass an intentional power-button lock and it does not provide background camera capture. Pressing Home, switching apps, locking the device, or Android lifecycle pressure can suspend or stop the Activity-owned WebView camera according to the platform and device policy.

`CaptureServerService` owns the local HTTP/Receiver server separately from the camera. The server may continue when the Activity camera does not; LocalServer availability is not proof that camera, face, or pose inference is running.

The implementation does not play a black video, save or upload camera pixels, change the global `screen_off_timeout`, request `WRITE_SETTINGS`, use overlay permission, or move camera/MediaPipe work into a Service.

## Display, power, and privacy

- OLED panels can emit almost no light for black pixels; LCD backlights may still glow even when all content pixels are black.
- Extra dim remains non-zero and applies only to this Activity window. System brightness is restored exactly, including the `-1` system-default sentinel.
- For long sessions, use safe power, ventilation, and conservative face/pose performance settings. Stop if the device warns about heat; do not continue at or above 45°C.
- The black overlay conceals the UI but is not an access-control or privacy screen. The local camera pipeline still processes frames, and Receiver data remains personal sensor data subject to the trusted-LAN guidance in `PRIVACY_SECURITY.md`.

## Known limitations

- Foreground-only; no supported background camera path.
- Intentional lock remains supported and ends foreground capture according to Android lifecycle behavior.
- System-bar restoration follows the Activity window's requested visibility and behavior on entry; OEM transient-bar animations can briefly appear after gestures.
- Black pixel ratio and continued capture must be verified on each target device rather than inferred from JVM tests.
