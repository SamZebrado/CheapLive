# Missing File Recovery Matrix

Audit date: 2026-07-22

The backup was found under `CodeBackups 2/2026-07-22-disk-cleanup`; the path without ` 2` recorded in the original SHA manifest is no longer present. The bundle, status files, patches, and snapshot ZIP are readable. The PNG payloads listed below were omitted from the backup.

Search scope:

- Google Drive disaster backup (read-only)
- `CheapLive-main`, `cheaplive-main-staging`, and `cheaplive-main-staging 21-24-48-275` (read-only)
- `CheapLive-main/working-tree-snapshot.zip` (listing and integrity test only)

All three restored directories are byte-for-byte identical. Exact-basename search returned no matches for any row below. The snapshot ZIP contains older, differently named renderer screenshots, but no missing basename. Because the missing files themselves are unavailable, their original SHA256 values cannot be reconstructed and semantic similarity cannot establish identity.

| 原路径 | 备份中是否存在 | 恢复目录是否存在 | SHA256 | 候选来源 | 结论 |
|---|---:|---:|---|---|---|
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/contact-sheet-open-demo-profile.png` | 否，仅 `status.txt` 有记录 | 否 | 不可得 | snapshot ZIP 中有旧版 contact/verification 类证据，但无同名文件 | 未恢复，不能以旧图替代 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-blink-m70-fullblink.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 blink 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-blink-m70-halfblink.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 blink 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-blink-p70-fullblink.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 blink 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-blink-p70-halfblink.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 blink 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-m60.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-m70.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-m75.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-m85.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-p60.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-p70.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-p75.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-direct-p85.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-left-0-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-left 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-left-1-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-left 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-left-2-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-left 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-left-3-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-left 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-left-4-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-left 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-left-5-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-left 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-right-0-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-right 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-right-1-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-right 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-right-2-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-right 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-right-3-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-right 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-right-4-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-right 图 | 未恢复，身份无法确认 |
| `CheapLive_demo_full_regression_repair/artifacts/open-demo-yaw/open-yaw-right-5-clicks.png` | 否 | 否 | 不可得 | snapshot ZIP 的旧版 yaw-right 图 | 未恢复，身份无法确认 |
| `CheapLive-verify/artifacts/regression-sakaban-blink.png` | 否，仅 `status.txt` 有记录 | 否 | 不可得 | snapshot ZIP 中有旧版 `spindle-blink.png` | 未恢复，不能证明同一渲染版本 |
| `CheapLive-verify/artifacts/regression-sakaban-front.png` | 否 | 否 | 不可得 | snapshot ZIP 中有旧版 `spindle-front.png` | 未恢复，不能证明同一渲染版本 |
| `CheapLive-verify/artifacts/regression-sakaban-mouth-open.png` | 否 | 否 | 不可得 | snapshot ZIP 中有旧版 `spindle-mouth-open.png` | 未恢复，不能证明同一渲染版本 |
| `CheapLive-verify/artifacts/regression-sphere-blink.png` | 否 | 否 | 不可得 | snapshot ZIP 中有旧版 `sphere-blink.png` | 未恢复，不能证明同一渲染版本 |
| `CheapLive-verify/artifacts/regression-sphere-front.png` | 否 | 否 | 不可得 | snapshot ZIP 中有旧版 `sphere-front.png` | 未恢复，不能证明同一渲染版本 |
| `CheapLive-verify/artifacts/regression-sphere-mouth-open.png` | 否 | 否 | 不可得 | snapshot ZIP 中有旧版 `sphere-mouth-open.png` | 未恢复，不能证明同一渲染版本 |
| `CheapLive-verify/docs/design-review/artifacts/style-board-v1-fullpage.png` | 否 | 否 | 不可得 | 无候选 | 未恢复 |
| `CheapLive-verify/docs/design-review/artifacts/style-board-v1-section2.png` | 否 | 否 | 不可得 | 无候选 | 未恢复 |
| `CheapLive-verify/docs/design-review/artifacts/style-board-v1-section3.png` | 否 | 否 | 不可得 | 无候选 | 未恢复 |
| `CheapLive-verify/docs/design-review/artifacts/style-board-v1-section4.png` | 否 | 否 | 不可得 | 无候选 | 未恢复 |
| `CheapLive-verify/docs/design-review/artifacts/style-board-v1-section5.png` | 否 | 否 | 不可得 | 无候选 | 未恢复 |
| `CheapLive-verify/docs/design-review/artifacts/style-board-v1-top.png` | 否 | 否 | 不可得 | 无候选 | 未恢复 |

## Preserved evidence outside this missing set

The pre-existing `CheapLive` worktree still contains 25 untracked `artifacts/receiver-face-render/*.png` files and two untracked E2E probes. They were not moved, deleted, or copied because they are not the missing files listed above and their current worktree ownership is intact.
