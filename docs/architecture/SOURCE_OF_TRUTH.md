# CheapLive Source of Truth

Status date: 2026-07-22

The rule is explicit ownership, not filename similarity. A target is generated or mirrored only when it appears in `scripts/sync-contest-demo-to-android.mjs`.

| Function | Unique source | Generated or mirror target | Sync method | Drift evidence |
| --- | --- | --- | --- | --- |
| Android procedural renderer | `android-capture/app/src/main/assets/web/receiver/procedural-mesh-renderer.js` | Android `contest-demo/` and `demo/` copies | `npm run assets:sync` | `npm run assets:check`; `web-asset-sync.test.mjs` |
| Android spindle mesh | `android-capture/app/src/main/assets/web/receiver/mesh-spindle-whale.js` | Android `contest-demo/` and `demo/` copies | Same | Same |
| Android sphere mesh | `android-capture/app/src/main/assets/web/receiver/mesh-sphere.js` | Android `contest-demo/` copy | Same | Same |
| SoundTouch runtime | `src/face-tracking/lib/soundtouch.min.js` | Android contest demo library copy | Same | Same |
| MediaPipe license | `src/face-tracking/mediapipe/LICENSE` | Android contest and shared MediaPipe copies | Same | Same |
| Face landmarker model | `src/face-tracking/mediapipe/face_landmarker.task` | Android contest and shared task copies | Same | Same plus SHA-256 manifest |
| MediaPipe vision bundle | `src/face-tracking/mediapipe/vision_bundle.mjs` | Android contest and shared task copies | Same | Same |
| MediaPipe vision WASM files | `src/face-tracking/mediapipe/wasm/*` for the four listed runtime files | Android contest and shared task WASM copies | Same | Same |
| Public face experience | `src/face-tracking/` | None | Direct edit and test | Unit and browser suites |
| Public contest experience | `src/contest-demo/` | None | Direct edit and test | Contest unit/browser suites |
| Android capture UI | `android-capture/app/src/main/assets/web/capture/` | None | Direct edit and Android test | Android/WebView runtime evidence |
| Android receiver transport/UI | `android-capture/app/src/main/assets/web/receiver/` | Only the renderer/mesh targets explicitly listed above | Direct edit; then asset sync | Receiver unit, browser and Android runtime evidence |
| Android contest/demo HTML and app logic | Their respective Android asset directories | None unless explicitly listed | Direct edit and Android test | Android/WebView runtime evidence |
| Signaling server | `server/` | None | Direct edit and server tests | Unit/integration tests with local bind access |

## Change procedure

1. Edit the unique source shown above.
2. Run `npm run assets:sync` if the change touches a mapped source.
3. Review both the copied targets and `WEB_ASSET_SYNC_MANIFEST.json`.
4. Run `npm run assets:check` and the relevant unit/browser/Android tests.
5. Commit the source, intentional mirrors, manifest, and tests together.

Do not copy an entire public or Android directory over another. Public URL layout, Android asset URLs, LocalServer behavior, and WebView-specific code are independent contracts.
