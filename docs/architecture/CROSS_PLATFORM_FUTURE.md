# Cross-Platform Future

## Recommendation

Keep the transport protocol, state schema, and portable web rendering core platform-neutral. Retain the Android native shell for capture, permissions, foreground/background lifecycle, and embedded serving. Add iOS incrementally with a thin native/WebKit or Capacitor shell after the web protocol and lifecycle tests are stable.

This minimizes a second rewrite while preserving native control where mobile operating systems impose the strongest constraints.

## Options

| Option | Strengths for CheapLive | Main cost or risk | Recommendation |
| --- | --- | --- | --- |
| PWA | Maximum reuse and simplest public deployment | Limited reliable background capture, device permissions, and platform integration | Keep as public/receiver surface, not the sole capture app |
| Capacitor | Reuses the web UI and can bridge camera/audio/native lifecycle | Plugin and WebView differences still require mobile testing | Best near-term iOS shell candidate after core stabilization |
| React Native | Large ecosystem and native UI access | Rewrites current DOM/WebGL application layer and creates bridge ownership | Do not migrate solely for parity |
| Flutter | Strong cross-platform UI consistency | Largest rewrite of the established web renderer/runtime | Not justified for the MVP |
| Kotlin Multiplatform | Shares protocol/domain logic while preserving native shells | Does not directly share the existing web UI; iOS UI remains separate | Consider later for typed protocol/state logic |

## Staged path

1. Freeze and test the wire contract for face, audio, connection, revision, stale-frame rejection, and future pose frames.
2. Separate browser rendering state from Android-specific lifecycle and LocalServer ownership.
3. Establish deterministic browser tests plus Android instrumentation/runtime evidence.
4. Prototype an iOS shell that loads the same portable receiver/capture core and implements native permission/lifecycle adapters.
5. Move only clearly stable, typed domain logic into a shared native layer if duplication becomes measurable.

Upper-body motion now enters through the platform-neutral schema v1 and `PoseState`, with Android acting as the permission/lifecycle/bridge shell. The audited MediaPipe Pose Landmarker Lite artifact is offline-packaged and opt-in. A future iOS/Capacitor shell should reuse the same protocol, validator, scheduler profiles, simulator, and Receiver rig while implementing its own camera/Worker lifecycle adapter; it must not reuse Android persistence or foreground-service assumptions.
