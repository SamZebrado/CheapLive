# CheapLive 测试与 Quality Gate

本文档面向所有参与 CheapLive 开发的 Agent，说明：

- 各 npm test 命令的用途；
- 哪些属于强制 Gate；
- 哪些属于实验测试；
- 哪些需要真实设备；
- 哪些属于视觉证据；
- 本地运行方法；
- GitHub Actions 行为；
- 出现失败时的定位方法；
- 禁止用删除测试换取绿色的原则。

## 1. 脚本一览

| 命令 | 用途 | 归属 | 稳定性 | 依赖真实设备 |
|------|------|------|--------|-------------|
| `npm run test:unit`       | 纯几何/渲染/脚本生成相关的 Node 单元测试 | 稳定 Gate | 稳定 | 否 |
| `npm run test:gate`       | **提交前强制 Gate**（单元 + Avatar runtime smoke + public status） | 稳定 Gate | 稳定 | 否 |
| `npm run test:gate-verify` | Gate 自身可靠性自验证（注入失败后确认非零退出码） | 自验证 | 稳定 | 否 |
| `npm run test:smoke`      | 站点与基础交互 smoke | E2E | 稳定 | 否 |
| `npm run test:e2e`        | 所有 Playwright E2E（稳定 + 实验） | E2E 全集 | 部分实验 | 部分 |
| `npm run test:experimental` | WebRTC / 多设备 / 音频；依赖真实浏览器能力 | 实验 | 实验 | 是（部分） |
| `npm run test:visual`     | 生成 Canvas Avatar 截图作为视觉证据 | 视觉证据 | 稳定 | 否 |
| `npm run test:status`     | 公共状态表 / README 文档断言 | 稳定 Gate | 稳定 | 否 |
| `npm run test:all`        | 稳定测试全集（不含 experimental） | 参考 | 视测试而定 | 部分 |

## 2. 强制 Gate 构成

`npm run test:gate` 组合以下步骤，按顺序执行，任一失败即中断：

1. `node --test tests/unit/*.test.js`
   - 覆盖：程序化几何、锚点计算、face weight、派生脚本生成、gate 故障注入自验证。
2. `npx playwright test tests/e2e/playwright-smoke.test.js tests/public-status --project=chromium-desktop --reporter=list`
   - `tests/e2e/playwright-smoke.test.js`：真实加载 `src/face-tracking/index.html`，验证鲸鱼默认渲染、球体切换尺寸稳定性、表情按钮点击、5× 反复切换无 pageerror。
   - `tests/public-status`：README 与状态表的诚实性检查。

### 2.1. 什么不在 Gate 中

- 依赖真实摄像头、麦克风、局域网或多设备的测试；
- 视觉截图生成（有专门的 `test:visual`，不作为 gate 硬性要求）；
- Android Gradle / APK 构建（CI 不覆盖）；
- Xiaomi 真机真机链路（必须由人工执行）。

### 2.2. Gate 故障注入

`tests/unit/gate-exit-code.test.js` 会：

1. 在临时目录生成一个必然失败的 `intentional-failure.spec.js`；
2. 以子进程方式调用 `npx playwright test` 执行它；
3. 断言其退出码非零；
4. 测试完成后删除临时目录。

该测试用来证明："测试失败 → Gate 失败"，避免某一层把失败静默吞掉后误报为通过。

## 3. 实验测试说明

`npm run test:experimental` 包含：

- WebRTC 连接/信令相关（`tests/e2e/webrtc-connected.test.js`、`tests/e2e/multi-device.test.js`）；
- 音频 track 测试（`tests/e2e/audio-track.test.js`）。

这些测试对浏览器能力、网络或设备依赖较大，可能在某些 CI 环境或本机配置下不稳定，**不得纳入强制 gate**。

## 4. 视觉证据

`npm run test:visual`

- 直接运行 `tests/e2e/generate-screenshots.js`，输出截图至 `artifacts/canvas-avatar-web-sync/`；
- 这些截图用于**人工视觉验收**，不是自动通过/失败的依据；
- 不得将"截图成功生成"替换为"视觉通过"。

## 5. Runner 与脚本格式

- Node 原生 `--test` runner 用于 `tests/unit/*.test.js`；
- `@playwright/test`（即 Playwright Test runner）用于 `tests/e2e/*.test.js` 和 `tests/public-status/*.spec.js`；
- 独立脚本（直接 `node X.js` 运行）不得出现在 gate 路径上。

### 5.1. 历史遗留注意

`tests/e2e/generate-screenshots.js` 不是 Playwright Test 文件，它是独立脚本，**只由 `test:visual` 调用**。它不在 `test:gate` 中运行，也不影响 CI 是否绿色。

## 6. 本地运行指南

```bash
# 先跑单元测试，快速过滤逻辑问题
npm run test:unit

# 提交前 gate
npm run test:gate

# 需要视觉截图时
npm run test:visual

# 想运行所有 E2E（含 WebRTC 可能不稳定的部分）
npm run test:e2e

# 仅跑实验性
npm run test:experimental
```

## 7. GitHub Actions

- Workflow 文件：`.github/workflows/quality-gate.yml`
- 触发：`push` 到 `main`，以及对 `main` 的 PR。
- 运行环境：`ubuntu-latest`，Node 20。
- 步骤：checkout → setup-node → `npm ci` 或 `npm install` → 安装 Playwright chromium 与系统依赖 → `npm run test:gate`。
- 失败时会上传 `test-results/` 目录作为 artifact，便于使用 `playwright show-trace` 定位。

### 7.1. CI 覆盖与不覆盖

覆盖：

- 程序化 Canvas Avatar 的 runtime smoke；
- 静态站点的公共状态表；
- 单元测试（几何、锚点、派生脚本一致性、gate 故障注入）。

不覆盖：

- Android Gradle；
- 多端局域网/WebRTC；
- 真实摄像头/麦克风；
- Xiaomi 真机链路；
- 视觉验收。

## 8. 失败定位建议

- `npm run test:unit` 失败：检查几何/计算逻辑；
- `tests/e2e/playwright-smoke.test.js` 失败：
  - 使用 `npx playwright test tests/e2e/playwright-smoke.test.js --trace on`，之后查看 `test-results/` 下的 trace；
  - 留意 `pageerror` 和 `console.error` 的收集；
- `tests/public-status` 失败：可能是 README 的状态表文案与实际代码入口不一致；
- CI 但本地通过：检查是否有 Playwright 浏览器尚未本地安装；本地需要 `npx playwright install chromium`。

## 9. 禁止事项（维护测试体系时）

- 不得为让 CI 变绿删除测试；
- 不得在测试内部 `process.exit(0)` 或 `try/catch` 吞掉失败断言；
- 不得将独立脚本包装在 `.test.js` 中以假装有测试通过；
- 不得把 WebRTC、音频等依赖真实设备的测试纳入强制 Gate；
- 不得把截图生成的成功视为视觉验收通过。

## 10. 相关文档

- [`AGENTS.md`](../AGENTS.md) — Agent 分工、角色边界、协作流程。
- [`rules/runtime-validation-gate.md`](../rules/runtime-validation-gate.md) — 开发 Code 的提交前强制验证。
- [`rules/evidence-labels.md`](../rules/evidence-labels.md) — 证据标签、防夸大规则。
- [`rules/product-roadmap.md`](../rules/product-roadmap.md) — 产品路线与技术冻结项。
