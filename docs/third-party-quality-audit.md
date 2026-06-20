# CheapLive 第三方质量审计日志

> 角色：独立第三方测试与代码审查者
> 审计范围：生产代码、测试代码、页面入口、Android 工程、开发文档之间的一致性
> 操作边界：仅审计和记录，不修改生产代码、不修改测试代码、不重构、不安装依赖、不 commit/push

---

## 2026-06-19

### 审计时 Git HEAD

`19db8a92e4f36dfcde4ee7f223e5ecb2ebc54d59`

### 自上次审计后的主要变化

- [已阅读] 本次为首次建立第三方审计文档，无历史审计记录可对比。
- [已阅读] 当前工作区存在未提交的修改（`git status` 显示 8 个文件 modified + 若干 untracked），但尚未 commit。
- [已阅读] 最近 3 个 commit（`HEAD~2..HEAD`）主要涉及：
  - `19db8a9` docs: trace and quarantine memorial avatar implementation
  - `e61d696` fix(ui): unify avatar selection and preserve legacy migration
  - `1bc5a20` fix(avatar): stabilize materials pupils and face anchors

### 实际运行的测试及结果

| 测试命令 | 结果 | 说明 |
|---------|------|------|
| `npm run test:gate` | **通过** | 单元测试 78 pass + Playwright smoke 11 pass |
| `node --test tests/unit/*.test.js` | **通过** | 78 tests, 26 suites, 0 fail |
| `npx playwright test tests/e2e/playwright-smoke.test.js tests/public-status --project=chromium-desktop --reporter=list` | **通过** | 11 passed |

- [已运行本地测试] `test:gate` 完整通过，退出码 0。
- [已运行本地测试] `tests/unit/gate-exit-code.test.js` 作为 gate 自验证，确认失败测试会产生非零退出码。

### 新发现的问题

#### 1. [Observation] 工作区存在未提交的修改，但无对应 commit 记录

- **严重程度**: Observation
- **问题描述**: `git status` 显示 8 个文件有未提交修改（包括 AGENTS.md、Android 代码、face-tracker.js、debug-avatar.js、playwright-smoke.test.js 等），以及多个 untracked 文件（包括 `docs/android-capture-xiaomi-validation.md`、`artifacts/` 等）。这些修改是否已完成验证、是否应提交，当前状态不明确。
- **证据**: `git status` 输出显示 "Changes not staged for commit: 8 files" + "Untracked files: 9 items"
- **影响范围**: 项目历史可追溯性
- **复现方式**: `cd CheapLive && git status`
- **建议处理方向**: 由开发 Code 确认这些修改是否已完成验证并应提交；若仍在进行中，应在 STATUS 或文档中标注。
- **当前状态**: 未处理

#### 2. [Minor] `tests/e2e/smoke.test.js` 硬编码 `localhost:8765`，与 `test:gate` 使用的相对路径不一致

- **严重程度**: Minor
- **问题描述**: `smoke.test.js` 中页面地址硬编码为 `http://localhost:8765/...`，而 `playwright-smoke.test.js` 和 `test:gate` 使用的是相对路径 `src/face-tracking/index.html`。这导致 `smoke.test.js` 需要外部 HTTP server 在 8765 端口运行才能通过，而 `test:gate` 不需要。两者测试覆盖范围重叠但运行条件不同。
- **证据**: `tests/e2e/smoke.test.js:18` 使用 `http://localhost:8765/src/face-tracking/index.html`；`tests/e2e/playwright-smoke.test.js:20` 使用 `src/face-tracking/index.html`
- **影响范围**: 测试可维护性、CI 一致性
- **复现方式**: 对比两个 smoke 测试文件的 `page.goto()` 参数
- **建议处理方向**: 统一使用相对路径，或在 `smoke.test.js` 中添加 server 启动逻辑。
- **当前状态**: 未处理

#### 3. [Minor] `face-tracker.js` 中 `applySensitivity` 可能产生超出 [0,1] 范围的值

- **严重程度**: Minor
- **问题描述**: `applySensitivity` 函数实现为 `0.5 + (rawValue - 0.5) * sens`，当 `sens > 100` 且 `rawValue` 接近边界时，结果可能超出 [0,1] 范围。虽然 `setParam` 中有 `Math.max(0, Math.min(1, value))` 进行 clamp，但 `applySensitivity` 的返回值在 `updateBlendshapes` 中直接用于 `setParam`，中间没有其他处理。这是一个防御性编程问题：依赖下游 clamp 而非在源头保证范围。
- **证据**: `src/face-tracking/face-tracker.js:100-104` 的 `applySensitivity` 实现；`tests/unit/param-processor.test.js` 的测试用例仅验证了 `applySensitivity` 的数学行为，未验证与 `setParam` 的集成。
- **影响范围**: 参数显示和 avatar 驱动
- **复现方式**: 设置灵敏度为 200%，rawValue 为 0.9，计算得 0.5 + (0.9-0.5)*2 = 1.3，经 clamp 后为 1.0
- **建议处理方向**: 已在 `setParam` 中 clamp，当前行为正确但依赖链较长。可考虑在 `applySensitivity` 内部也加入 clamp 以增强鲁棒性。
- **当前状态**: 未处理（当前行为正确，属代码风格建议）

#### 4. [Minor] `debug-avatar.js` 中的 `MemorialAvatar` 类与 `DebugAvatar` 类存在大量重复代码

- **严重程度**: Minor
- **问题描述**: `MemorialAvatar` 和 `DebugAvatar` 两个类在 `rotate3D`、`draw3DEye`/`drawEye`、`draw3DMouth`/`drawMouth`、`draw3DNostril`/`drawNostril`、`drawLabels` 等方法上存在大量重复实现。`MemorialAvatar` 的 `rotate3D` 实现与 `DebugAvatar` 有细微差异（`DebugAvatar` 返回 `{x,y,z}`，`MemorialAvatar` 返回 `{x,y,z}` 但代码行有差异）。这种重复增加了维护成本，且 `MemorialAvatar` 的 `draw` 方法使用了不同的身体绘制策略（`bodyPoints` 数组 + `bezierCurveTo` 而非截面堆叠）。
- **证据**: 对比 `src/face-tracking/debug-avatar.js` 中两个类的实现
- **影响范围**: 代码维护性
- **复现方式**: 阅读 `debug-avatar.js` 第 454-722 行
- **建议处理方向**: 考虑将共同逻辑提取到基类，或明确 `MemorialAvatar` 的维护策略（文档中标注为 "quarantine"）。
- **当前状态**: 未处理

#### 5. [Observation] Android 工程的 `MainActivity.kt` 引用了未在当前文件中定义的类

- **严重程度**: Observation
- **问题描述**: `MainActivity.kt` 中使用了 `LocalServer`、`Session`、`SessionManager`、`CaptureBridge`、`PrivateIpPicker` 等类，但这些类在当前文件中未定义。由于本次审计未检查完整的 Android 工程结构，无法确认这些类是否存在于其他文件中。这是一个潜在的编译风险点。
- **证据**: `android-capture/app/src/main/java/com/cheaplive/capture/MainActivity.kt` 第 20-23、107-121 行
- **影响范围**: Android 工程编译
- **复现方式**: 检查 Android 工程完整文件列表
- **建议处理方向**: 确认这些类是否存在于工程其他位置；若缺失，Android 工程将无法编译。
- **当前状态**: 未验证（需检查完整 Android 工程）

### 已解决或状态变化的问题

- 本次为首次审计，无历史问题状态可更新。

### 未执行的检查及原因

| 检查项 | 未执行原因 |
|--------|-----------|
| Android Gradle 构建 | 审计边界：不安装 Android SDK、不运行 Gradle |
| 真实摄像头面捕测试 | 审计边界：当前环境无摄像头；且属于真实设备验证范畴 |
| WebRTC 多端实验测试 | 审计边界：`test:experimental` 被项目自身定义为不稳定，不纳入强制 gate |
| 视觉截图验收 | 审计边界：`test:visual` 生成截图需人工验收，非自动判断 |
| Xiaomi 真机链路 | 审计边界：无真机设备 |
| 完整 Android 工程文件审查 | 审计边界：本次聚焦 Web 端质量 gate；Android 仅做入口一致性检查 |

### 修改的审计文档

- 新建 `docs/third-party-quality-audit.md`

### 是否修改生产代码

**否**

### 是否 commit/push

**否**

### 当前最值得开发 Code 处理的前三项问题

1. **确认并提交工作区未提交的修改** — 当前 8 个 modified 文件和多个 untracked 文件的状态不明确，影响版本可追溯性。
2. **统一 smoke 测试的页面加载路径** — `smoke.test.js` 与 `playwright-smoke.test.js` 使用不同的页面加载策略，可能导致 CI 和本地运行结果不一致。
3. **验证 Android 工程编译完整性** — `MainActivity.kt` 引用的外部类是否全部存在，需确认 Android 工程能否正常编译。

---

## 2026-06-20

### 审计时 Git HEAD

`e2b7c3fce5fc76675d88334aa04f08f10bfa98e4`

### 自上次审计后的主要变化

- [已阅读] 自 2026-06-19 审计以来，HEAD 从 `19db8a9` 前进到 `e2b7c3f`，新增 12 个 commit。
- [已阅读] 主要变更方向：萨卡班甲鱼（Spindle Whale）程序化 Avatar 的多轮几何修复与视觉优化，包括：
  - 球形头像眼睛等大对称 + 鱼尾巴居中
  - 萨卡班甲鱼正面视角、圆鼻端、几何优化
  - Z 轴反向修复、前端封口、尾巴弯曲
  - 坐标系统重构、圆头平滑身体
  - 参数放大系数系统、3 秒中性姿态校准、眉毛左右映射修复、微笑视觉增强
  - 从开源中排除敏感协作规则文件
  - 身体改为水滴形（圆形截面，头大尾小）
  - pitch/roll 方向与镜像默认状态修复
  - MediaPipe 动态加载，保持程序化 Avatar 离线就绪
  - 纪念版 Avatar 实现追溯与隔离
  - Avatar 选择统一与旧版迁移保留
  - 材质、瞳孔、面部锚点稳定化
- [已阅读] 当前工作区仍有未提交修改：`src/face-tracking/face-tracker.js` 和 `src/face-tracking/voice-changer.js` 被修改，外加多个 untracked 文件（screenshot-spindle-v*.png、src/face-tracking/mediapipe/）。

### 实际运行的测试及结果

| 测试命令 | 结果 | 说明 |
|---------|------|------|
| `node --test tests/unit/*.test.js` | **失败** | 78 tests, 26 suites, **73 pass, 5 fail**, 退出码 1 |
| `npm run test:gate` | **失败** | 因单元测试失败，Gate 未进入 Playwright 阶段 |

- [已运行本地测试] 单元测试失败 5 项，全部位于 `tests/unit/procedural-mesh-renderer.test.js`，与 Spindle Whale（萨卡班甲鱼）mesh 和锚点相关。
- [已运行本地测试] `tests/unit/gate-exit-code.test.js` 通过，确认失败测试会产生非零退出码。
- [未验证] Playwright smoke 测试因 Gate 提前失败未执行。

### 新发现的问题

#### 1. [Blocker] `test:gate` 失败 — 5 项单元测试未通过

- **严重程度**: Blocker
- **问题描述**: `npm run test:gate` 因 `tests/unit/procedural-mesh-renderer.test.js` 中 5 项测试失败而整体失败，退出码 1。这意味着当前工作区代码无法通过强制质量 Gate。失败测试涉及：
  - `bodyT 不同 → 锚点 x 不同`：断言 `a1.x !== a2.x` 失败，两者均为 `0.0`。
  - `computeFaceAnchorXYZ 确保左右眼等高、水平分离`：返回 `NaN`。
  - `computeFaceAnchorXYZ 确保嘴在眼下，眉在眼上`：`mouth.y` 为 `NaN`。
  - `getFaceWeight(PI/2) 明显大于 angle=0 时的值`：`face.z === back.z`（均为 48.0）。
  - `Whale: 构造完成后 spindleMesh 和 tailMesh 均存在`：`tailMesh` 为空（`createWhaleTailMesh` 返回空数组）。
- **证据**: `node --test tests/unit/*.test.js` 输出显示 5 项 AssertionError，具体见上方测试结果。
- **影响范围**: 强制质量 Gate 无法通过；任何基于 `test:gate` 的 CI/CD 或发布流程会被阻断。
- **复现方式**: `cd CheapLive && npm run test:gate` 或 `node --test tests/unit/*.test.js`
- **建议处理方向**:
  - `computeFaceAnchor` 当前实现为 `computeFaceAnchorXYZ(mesh, 0, 0, 0, surfaceOffset)`，完全忽略了 `bodyT` 和 `surfAngle` 参数，导致所有调用返回同一固定点 `(0,0,z)`，这是测试失败的根本原因。
  - `computeFaceAnchorXYZ` 使用椭球方程 `z = hz * sqrt(1 - (x/hx)^2 - (y/hy)^2)`，当测试传入 `horizOffset=0, vertOffset=0` 时 `inside=1`，`zSurface=48`；但测试用例传入 `horizOffset=-headR2*0.25` 等值时，`inside` 可能为负导致 `sqrt` 参数为负，产生 `NaN`。需要检查 `computeFaceAnchorXYZ` 的输入范围或增加防御性处理。
  - `createWhaleTailMesh` 被实现为兼容性占位，返回空 mesh，但测试期望 `tailMesh.vertices.length > 0`。需要同步测试预期或恢复尾部 mesh 生成。
- **当前状态**: 未处理

#### 2. [Major] `computeFaceAnchor` 与 `computeFaceAnchorXYZ` 语义不一致且存在 NaN 风险

- **严重程度**: Major
- **问题描述**: `mesh-spindle-whale.js` 中的 `computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset)` 被实现为直接调用 `computeFaceAnchorXYZ(mesh, 0, 0, 0, surfaceOffset)`，完全丢弃了 `bodyT` 和 `surfAngle` 参数。这导致：
  1. 任何基于旧 API `computeFaceAnchor(mesh, bodyT, surfAngle, ...)` 的调用都返回固定点 `(0, 0, zSurface+offset)`，与参数无关；
  2. 测试 `bodyT 不同 → 锚点 x 不同` 因 `x` 始终为 0 而失败；
  3. `computeFaceAnchorXYZ` 使用椭球方程计算 `zSurface`，当 `horizOffset` 或 `vertOffset` 超出椭球范围时 `inside < 0`，`Math.sqrt` 接收负数产生 `NaN`，导致下游测试失败。
- **证据**: `src/face-tracking/mesh-spindle-whale.js:340-342` 的 `computeFaceAnchor` 实现；`tests/unit/procedural-mesh-renderer.test.js:188-218` 的测试断言。
- **影响范围**: Spindle Whale Avatar 的面部锚点计算；任何调用 `computeFaceAnchor` 或 `computeFaceAnchorXYZ` 的代码路径。
- **复现方式**: `node --test tests/unit/procedural-mesh-renderer.test.js`
- **建议处理方向**:
  - 恢复 `computeFaceAnchor` 的原始语义：根据 `bodyT` 和 `surfAngle` 从 mesh 表面采样，而非固定返回 `(0,0,z)`；或明确废弃该 API 并更新所有调用方。
  - 在 `computeFaceAnchorXYZ` 中增加 `inside <= 0` 的防御处理，避免 `NaN` 传播。
  - 检查测试中的 `horizOffset` 和 `vertOffset` 是否在椭球合法范围内。
- **当前状态**: 未处理

#### 3. [Major] `createWhaleTailMesh` 为空占位实现，与测试预期冲突

- **严重程度**: Major
- **问题描述**: `mesh-spindle-whale.js` 中的 `createWhaleTailMesh` 被实现为兼容性占位，返回 `{ vertices: [], faces: [], ... }`。但 `tests/unit/procedural-mesh-renderer.test.js:325-330` 的测试断言 `tailMesh.vertices.length > 0`。这导致测试失败，也表明生产代码与测试之间的契约已断裂。
- **证据**: `src/face-tracking/mesh-spindle-whale.js:350-360` 的 `createWhaleTailMesh` 实现；`tests/unit/procedural-mesh-renderer.test.js:325-330` 的测试断言。
- **影响范围**: 单元测试 Gate 失败；若生产代码实际依赖 `createWhaleTailMesh` 返回有效 mesh，则渲染器会绘制不出尾巴。
- **复现方式**: `node --test tests/unit/procedural-mesh-renderer.test.js`
- **建议处理方向**:
  - 若尾巴已与身体合并到 `createSpindleMesh` 中，则应更新测试，移除对独立 `tailMesh` 的非空断言，或改为验证身体 mesh 已包含尾巴几何。
  - 若尾巴仍应独立生成，则需恢复 `createWhaleTailMesh` 的有效实现。
- **当前状态**: 未处理

#### 4. [Minor] `face-tracker.js` 未提交修改包含变声和字幕的增强逻辑

- **严重程度**: Minor
- **问题描述**: 工作区中 `face-tracker.js` 和 `voice-changer.js` 存在未提交修改，涉及：变声开关真正调用 `voiceChanger.start()`、字幕开启前检查浏览器 Web Speech API 支持、MediaPipe 本地/CDN 双路径加载。这些修改尚未 commit，状态不明确。
- **证据**: `git diff -- src/face-tracking/face-tracker.js src/face-tracking/voice-changer.js` 显示 106 行新增/修改。
- **影响范围**: 功能状态可追溯性；若这些修改已完成验证，应尽快提交；若仍在调试，应明确标注。
- **复现方式**: `cd CheapLive && git diff -- src/face-tracking/face-tracker.js`
- **建议处理方向**: 由开发 Code 确认这些修改是否已完成验证并应提交。
- **当前状态**: 未处理

#### 5. [Observation] `tests/e2e/smoke.test.js` 硬编码 `localhost:8765` 问题仍然存在

- **严重程度**: Observation
- **问题描述**: 该问题在 2026-06-19 审计中已记录，当前状态未变化。`smoke.test.js` 仍使用 `http://localhost:8765/...`，与 `test:gate` 使用的相对路径不一致。
- **证据**: `tests/e2e/smoke.test.js:18` 和 `:26` 仍硬编码 `localhost:8765`。
- **影响范围**: 测试可维护性。
- **复现方式**: 对比 `tests/e2e/smoke.test.js` 与 `tests/e2e/playwright-smoke.test.js` 的 `page.goto()` 参数。
- **建议处理方向**: 统一使用相对路径，或在 `smoke.test.js` 中添加 server 启动逻辑。
- **当前状态**: 未处理（与上次审计状态一致）

### 已解决或状态变化的问题

- [已核对] 2026-06-19 审计中的问题 1（工作区未提交修改）——部分 commit 已发生（12 个新 commit），但仍有新的未提交修改（`face-tracker.js`、`voice-changer.js`、截图、mediapipe 目录），状态仍为未处理。
- [已核对] 2026-06-19 审计中的问题 3（`applySensitivity` 可能超出 [0,1]）——代码未变化，状态仍为未处理。
- [已核对] 2026-06-19 审计中的问题 4（`MemorialAvatar` 与 `DebugAvatar` 重复代码）——代码未变化，状态仍为未处理。
- [已核对] 2026-06-19 审计中的问题 5（Android `MainActivity.kt` 引用未定义类）——未进一步验证，状态仍为未验证。

### 未执行的检查及原因

| 检查项 | 未执行原因 |
|--------|-----------|
| Playwright smoke / public-status | Gate 在单元测试阶段已失败，未进入 Playwright 阶段 |
| Android Gradle 构建 | 审计边界：不安装 Android SDK、不运行 Gradle |
| 真实摄像头面捕测试 | 审计边界：当前环境无摄像头；且属于真实设备验证范畴 |
| WebRTC 多端实验测试 | 审计边界：`test:experimental` 被项目自身定义为不稳定，不纳入强制 gate |
| 视觉截图验收 | 审计边界：`test:visual` 生成截图需人工验收，非自动判断 |
| Xiaomi 真机链路 | 审计边界：无真机设备 |
| 完整 Android 工程文件审查 | 审计边界：本次聚焦 Web 端质量 gate；Android 仅做入口一致性检查 |

### 修改的审计文档

- 更新 `docs/third-party-quality-audit.md`，新增 2026-06-20 审计记录。

### 是否修改生产代码

**否**

### 是否 commit/push

**否**

### 当前最值得开发 Code 处理的前三项问题

1. **修复 `test:gate` 失败的 5 项单元测试** — 这是当前最高优先级，Gate 失败会阻断所有发布和验证流程。核心原因是 `computeFaceAnchor` 语义断裂和 `createWhaleTailMesh` 为空占位。
2. **确认并提交工作区未提交的修改** — `face-tracker.js` 和 `voice-changer.js` 的变声/字幕/MediaPipe 本地加载增强逻辑是否已完成验证，应尽快明确并提交。
3. **统一 smoke 测试的页面加载路径** — `smoke.test.js` 与 `playwright-smoke.test.js` 使用不同的页面加载策略，长期存在会导致测试维护成本增加。

---

## 审计方法论说明

### 证据标签使用

本审计文档遵循 `rules/evidence-labels.md` 的证据标签规范：

- `[已阅读]` — 实际阅读了相关代码、文档、配置
- `[已运行本地测试]` — 实际运行了测试命令并看到了输出结果
- `[未验证]` — 没有足够证据或尚未进行验证

### 严重程度定义

- **Blocker** — 导致生产入口无法运行、测试 gate 失败、或严重破坏已有功能
- **Major** — 功能缺陷、明显不一致、或可能导致用户误解的问题
- **Minor** — 代码风格、维护性、或防御性编程建议
- **Observation** — 值得注意的状态或潜在风险，当前不构成直接问题

### 审计边界

- 不修改生产代码
- 不修改测试代码
- 不重构
- 不安装或升级依赖
- 不下载 Playwright 浏览器、SDK、模型或大型工具
- 不清理文件
- 不进入 Live2D、Android Phase 2、多端、音频或其他新功能开发
- 不自行改变产品路线
- 不 commit 或 push
