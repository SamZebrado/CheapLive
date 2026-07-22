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
