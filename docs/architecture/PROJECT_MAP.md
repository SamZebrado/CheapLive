# CheapLive Project Map

Status date: 2026-07-22

This document is the current navigation map for the recovered repository. It supersedes older worktree snapshots for present-day path and entrypoint decisions; historical logs remain evidence of what happened at the time.

## Repository and branch baseline

- Canonical repository root: this Git worktree
- Recovery baseline: GitHub `main` at `d4a8222e3eb742d0e6b0a936a958035b4e4183e9`
- Gitee default: `master` at the same commit and tree
- Recovery branch: `codex/recovery-organize-motion-mvp-20260722`
- Recovery evidence and non-applied artifacts: `docs/recovery/`

## Runtime surfaces

| Surface | Entrypoint | Supporting source | Delivery path |
| --- | --- | --- | --- |
| Public landing/demo | `index.html` | `src/face-tracking/`, `src/contest-demo/` | Static public hosting / GitHub Pages-compatible URLs |
| Public face tracking | `src/face-tracking/index.html` | Face tracking JavaScript, MediaPipe runtime and model under the same tree | Browser |
| Public contest demo | `src/contest-demo/contest-interactive-demo.html` | Contest demo scripts and renderers | Browser |
| Android capture | `android-capture/app/src/main/java/com/cheaplive/capture/MainActivity.kt` | Embedded server and `android-capture/app/src/main/assets/web/capture/index.html` | LocalServer route `/capture/` |
| Android receiver | `android-capture/app/src/main/assets/web/receiver/index.html` | Receiver transport, renderer and mesh modules | LocalServer route `/receiver/` |
| Android contest demo | `android-capture/app/src/main/java/com/cheaplive/capture/ContestDemoActivity.kt` | `android-capture/app/src/main/assets/web/contest-demo/contest-interactive-demo.html` | Android asset URL |
| Android avatar demo | `android-capture/app/src/main/java/com/cheaplive/capture/AvatarDemoActivity.kt` | `android-capture/app/src/main/assets/web/demo/demo.html` | Android asset URL |

## Major source areas

- `server/`: signaling and transport server logic.
- `src/face-tracking/`: canonical public face runtime, MediaPipe face model/runtime, and public audio dependency.
- `src/contest-demo/`: public contest experience. It is intentionally not a byte-for-byte Android mirror.
- `android-capture/`: Android application, native shell, embedded LocalServer, and Android-specific web surfaces.
- `tests/unit/`: deterministic Node tests, including source/mirror drift checks.
- `tests/e2e/`: browser regression tests that require a working Playwright test runner and local bind permission.
- `scripts/`: maintenance and validation scripts. `sync-contest-demo-to-android.mjs` owns the explicit byte-identical mirror map.
- `docs/architecture/`: current architectural authority.
- `docs/recovery/`: immutable audit conclusions about recovered snapshots, patches, and missing files.

## Authority boundaries

1. Git history is authoritative for source evolution. Recovered folders and backup archives are evidence, not writable sources.
2. `SOURCE_OF_TRUTH.md` is authoritative for duplicated web assets.
3. `WEB_ASSET_SYNC_MANIFEST.json` is generated evidence for byte-identical mirrors; it is not edited by hand.
4. Android and public files with similar names are not assumed equivalent. Only paths listed by the sync script are mirrors.
5. Generated build output, screenshots, local device captures, Gradle caches, browser profiles, and `node_modules` are not source.

## Historical documents

Documents such as `docs/CURRENT_WORKTREES.md`, `docs/ANDROID_WORKFLOW_LOG.md`, and archived agent/status notes may describe earlier branches or machines. Use them as chronology only. For current navigation and ownership, use this map and `SOURCE_OF_TRUTH.md`.
