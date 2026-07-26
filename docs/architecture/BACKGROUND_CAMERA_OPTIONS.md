# Background Camera Options

## Current decision

CheapLive Black Screen Capture is a foreground, screen-on mode. It keeps the existing `MainActivity` and WebView camera running under a black content overlay. It is not a background-camera implementation.

The lifecycle split is intentional:

| Owner | Current responsibility | Background expectation |
| --- | --- | --- |
| `MainActivity` + WebView | Camera, face inference, optional pose Worker | Foreground only; may stop when locked or backgrounded |
| `CaptureServerService` | LocalServer and Receiver availability | Foreground service can outlive the Activity within documented OEM limits |

## Options not implemented

### Camera foreground service

Moving capture into a camera-type foreground service would require a new native camera owner, Android camera foreground-service permissions/types, visible user disclosure, lifecycle transfer, and target-version policy review. It would also replace the current WebView ownership model. This task does not implement or claim that path.

### Native CameraX or MediaPipe pipeline

A native pipeline could own frames outside the WebView, but would duplicate or migrate the established face/pose runtime, introduce a second protocol boundary, and require new privacy, performance, and device gates. It is outside this MVP.

### Picture-in-picture or overlay window

Picture-in-picture and application-overlay permissions do not make background camera ownership automatic. They also add UI, permission, and store-policy constraints. Black Screen Capture uses neither.

### Fake media playback

A silent or black looping video, ExoPlayer, or a media-playback foreground service would not prove camera inference continues. These approaches are prohibited and are not part of the design.

## Future gate

Any future background-camera proposal must be a separate user-approved project with official Android policy review, explicit privacy disclosure, a single camera owner, process-death behavior, thermal/power limits, device tests, and no regression to LocalServer identity or the current foreground mode.
