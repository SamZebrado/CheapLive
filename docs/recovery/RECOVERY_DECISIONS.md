# Recovery Decisions

Audit date: 2026-07-22

## Verified baseline

- GitHub default branch: `main` at `d4a8222e3eb742d0e6b0a936a958035b4e4183e9`
- Gitee default branch: `master` at the same commit
- Both default-branch tree objects: `8cae25dda3170a5873fa1448c1e2db18e156c323`
- Recovery worktree baseline: `origin/main`
- Recovery branch: `codex/recovery-organize-motion-mvp-20260722`

The two public defaults were fetched and resolved independently. No default branch was changed or synchronized during this work.

## Backup verification

- Actual readable root: `CodeBackups 2/2026-07-22-disk-cleanup`
- `repository.bundle` SHA256: `83fe8f4c921fecb6ecaac7297df1c124c9e85373f8dfba0b3e156d5925409e8a`
- `git bundle verify`: passed; complete history recorded
- Required refs found: `migration/android-source-from-verify`, `contest-private-app-web-control`, `online-regression-fix`, `public-demo-release`, and `main`
- `working-tree-snapshot.zip`: compressed-data integrity test passed

## Restored directory classification

The three restored directories each contain 221 files, are approximately 38 MB, and have the same aggregate file manifest SHA256:

`6682a7c6b201ef9a80be2e4ec04bbabccdf149c6084fdf4ff40faabf777820ac`

Their `.git` files all point to the same unavailable `/sessions/.../worktrees/CheapLive-main` location. They are identical non-repository snapshots, not three independent candidate histories.

Compared with bundle commit `d508e253833db18ef53d36ace59c8a21559f9759`, 207 files match, 12 files are older tracked revisions already present in Git history, and one file (`src/contest-demo/demo-game.html`) is a historical file that was later deliberately removed by `4d20190`. No recovered source file is both unique and newer than the verified public baseline.

Decision: do not copy any restored source over the baseline.

## Patch decisions

### `CheapLive_demo_full_regression_repair/uncommitted.patch`

- SHA256: `c3c5ed60914c3bdf6fc5910d1d4f787b7a8087ef44fbcf6173df685415c34bc3`
- Historical worktree HEAD from bundle: `aed5191865162cbc592b66ebc0cfceb8f27f7535`
- The patch base blob for `src/contest-demo/contest-interactive-demo.js` matches that commit (`8e8a246...`).
- It does not apply or reverse-apply to current `origin/main`.
- Later commits replaced the demo structure and added explicit floating/transparent behavior. The patch would also force showcase mode on by default, which is not the current public behavior.

Decision: do not apply; the remaining change is obsolete or behavior-changing, not an unambiguous recovery.

### `CheapLive-verify/uncommitted.patch`

- SHA256: `e71af500bd312d299204191a071d80aa818359ce8ef1529d3b3988c3fe082848`
- Historical worktree HEAD from bundle: `7867e334317b03198febcaa3307137092bfd7756`
- All three patch base blobs match that commit.
- The patch changes about 1,900 lines in Android receiver assets. Current `main` contains later receiver migration, token, transparent mode, renderer, profile-eye, and pose-contract commits.
- It does not apply or reverse-apply to current `origin/main`; several features are already present while old geometry constants would regress later renderer work.

Decision: do not apply; it is a superseded prototype patch with partial semantic absorption.

## Untracked source and test decisions

- `contest-layout-camera.test.cjs`: not copied. Its layout, hidden-video, renderer, and face-frame assertions are already covered by the larger tracked `contest-layout-regression.test.cjs` and `contest-face-frame-pose.test.cjs` suites.
- `open-demo-profile-yaw.mjs` and `build-contact-sheet.py`: not copied. The script contains a deleted worktree absolute path; current `profile-eye-tests.mjs`, `final-fix-tests.mjs`, and visual angle suites cover the same yaw/blink contract.
- `CheapLive-verify` ad-hoc smoke and capture scripts: preserved in read-only backup but not copied. They target an obsolete worktree/device setup and are not a deterministic current test suite.
- Missing PNGs: no payload was found; see `MISSING_FILE_RECOVERY_MATRIX.md`.

## Safety outcome

No backup, restored directory, old worktree evidence, branch history, default branch, or remote default was deleted, rewritten, merged, or force-pushed.
