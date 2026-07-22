# Core Stability Audit — 2026-07-22

This is a source audit plus the executable evidence available in the recovery environment. It is not a substitute for device or real-browser proof.

## Gate result

No confirmed P0 defect was established from source inspection. The release/feature gate is nevertheless **blocked**, because browser E2E, socket-dependent signaling tests, Android build/tests, and device lifecycle evidence could not run in the current environment. Motion-capture feature work must not start behind that blocked gate.

| Priority | Area | Source evidence | Current conclusion | Required closing evidence |
| --- | --- | --- | --- | --- |
| P1 | Android background survival | `MainActivity` owns `LocalServer`; no foreground service is declared and no explicit activity lifecycle transfer was found | Background survival is unverified and potentially fragile, not a source-confirmed crash | Instrumented device test across screen-off, background, process pressure, and return |
| P1 | Receiver reconnect | SSE error closes the stream and falls back to polling; WebSocket retry is bounded | Core data can continue by polling, but automatic return to preferred transports is incomplete | Network interruption/recovery browser and Android tests |
| P1 | Capture start/stop | Controller recreation and cleanup paths exist | No obvious source leak; runtime idempotence unverified | Repeated camera/audio start-stop device test with resource monitoring |
| P1 | Token identity and stale frames | Persistent token/state logic plus revision/stale rejection are present | Static contract exists | Multi-client reconnect and out-of-order frame integration test |
| P1 | Transparent/app mode | Explicit transparent/floating modes exist in later tracked source | Static implementation exists | Visual regression on public browser and Android WebView |
| P1 | Face/avatar stability | Current mesh topology tests pass after aligning stale assertions with the tracked renderer contract | Deterministic geometry evidence available; visual evidence blocked | Full Playwright visual suite and device screenshots |
| P1 | Pose protocol | Categorical/simulated body-pose state exists, but no continuous upper-body landmark frame/model is packaged | Motion MVP is not implemented | Approved model/runtime, versioned pose schema, performance and privacy tests |

## Executable evidence boundaries

- Asset source/mirror checks and their Node unit tests are runnable without network or package installation.
- Most deterministic Node unit tests are runnable.
- The signaling server test requires local socket binding, which this sandbox denied with `EPERM`.
- Browser E2E requires the project Playwright test runner and a local server. Dependencies are absent in the clean worktree, and the disk-safety rule forbids installing them below 3 GB free.
- Android Gradle 8.4 and JBR 17 were located without downloading Gradle 8.2.1. The sandbox denied Gradle's local daemon socket; the build therefore did not run.
- No ADB/device evidence was available.

## Motion gate

The repository contains the face landmarker model but no pose landmarker task/model. No existing local pose model was found in the audited workspace/cache locations. With free disk below 3 GB, downloading or adding a new model is prohibited. The upper-body MVP remains intentionally unstarted.

## Status update: 2026-07-23

The historical blocked result above is preserved as the recovery starting point. The disk gate later recovered to 16 GiB free, allowing the previously unavailable runtime gates to run without adding a pose model.

### Closed core gates

| Gate | Result | Closing evidence |
| --- | --- | --- |
| `ASSET_SYNC_GATE` | PASS | 12 canonical groups; 11/11 safety/idempotence tests; CWD-independent checks |
| `NODE_SIGNALING_GATE` | PASS | 360/360 Node tests and 13/13 socket/signaling tests |
| `WEB_E2E_GATE` | PASS | Chromium 34/34; SSE race follow-up 5/5; no residual test processes |
| `ANDROID_BUILD_GATE` | PASS | Gradle 8.4/JBR 17; Android JVM 29/29; debug APK assembled |
| `DEVICE_CORE_GATE` | PASS with stated evidence boundary | `install -r`, retained identity, FGS/background/lock/network/recreate/stop-restart checks, real video inference, resource release, and transparent DISPLAY touch-through; deterministic browser tests close frame-order/reconnect cases |

### Core conclusions

- `CaptureServerService` is now the explicit foreground owner. It reconstructs the process-local server from persisted identity if Android recreates the service, rejects duplicate ownership, releases the port on explicit stop, and does not log credentials.
- Receiver reconnect uses one bounded controller for SSE, polling, and WebSocket timers. Valid SSE state always restores the authoritative `connected-sse` diagnostic state, including after online recovery races.
- Camera and audio ownership are idempotent under repeated start/stop and page exit; device stress completed ten cycles for each and left no active camera client or audio recording.
- Realtime frame validation rejects invalid, non-finite, duplicate, stale-sequence, and stale-revision input while preserving the legacy compatibility adapter.
- Transparent floating-browser mode is now directly addressable with `app=1`; asynchronous renderer creation retains transparent app mode and redraws immediately.
- The Xiaomi process-kill boundary is explicit: direct process termination takes the FGS offline, and reopening the app restores it from persisted identity. The evidence does not claim that this OEM automatically restarts a killed process.
- The unattended real-camera sample contained no detectable face. Video pixels and the inference loop were live at approximately 10 FPS; human-face publish FPS is therefore recorded as unavailable rather than inferred. Face-frame ordering, stale rejection, tracking-lost/recovery, and transport recovery are covered by the deterministic E2E gate.

Core stability is no longer the blocker for motion protocol work. Motion capture remains a separate Beta with independent protocol, model, performance, privacy, and device gates.
