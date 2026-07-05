# Android Contest Demo 同步方案

> 建立日期：2026-07-05
> 状态：设计文档，未实施
> 背景：Android 源码已 CONFIRMED，当前加载旧 demo.html，不加载 contest-demo

---

## 1. 当前状态

### 1.1 Android 源码

| 项 | 值 |
|---|---|
| 项目路径 | `/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive/android-capture` |
| 分支 | `migration/android-source-from-verify` |
| HEAD | `4d88ca4` |
| applicationId | `com.cheaplive.capture` |
| namespace | `com.cheaplive.capture` |
| versionName | `0.1.0` |
| versionCode | `1` |
| 可信等级 | **CONFIRMED** |

### 1.2 当前 Android 加载路径

**`AvatarDemoActivity.kt` 第 179 行**：
```kotlin
webView?.loadUrl("file:///android_asset/web/demo/demo.html?avatar=$safeKind")
```

加载的是旧版 `web/demo/demo.html`，通过 query string `?avatar=` 指定形象类型。

### 1.3 当前 `assets/web/demo/` 内容

```
assets/web/demo/
├── demo.html          # 主入口（旧版）
├── demo.js            # 旧版逻辑
└── ...
```

旧版 demo 功能：
- 球形/纺锤鲸鱼 3D + 2D fallback
- FaceLandmarker 面捕
- 基础表情参数（yaw, pitch, roll, mouthOpen, blink, smile）
- 通过 CaptureBridge / AppState / LocalServer 与 Android 原生交互

### 1.4 旧 demo 与 contest-demo 的差异

| 项 | 旧 demo (web/demo/) | contest-demo (src/contest-demo/) |
|---|---------------------|----------------------------------|
| 主入口 | `demo.html` | `contest-interactive-demo.html` |
| 布局 | 单页面（capture + avatar） | 三栏布局（phone frame + receiver + game） |
| Avatar 数量 | 1（萨卡班鱼） | 7（鱼2D、鱼3D、猫、狗、兔、狐、熊） |
| 透明悬浮 | 无 | 有（floating window 模拟） |
| 变声 | 有（完整链路） | 有（WebAudio preset） |
| Mocap | 无 | 有（shell/unavailable） |
| 视觉历史 | 无 | 有（visual-history 141 文件） |
| 尺寸 | 小 | 大（含 visual-history 时显著更大） |
| 与 Android 桥接 | 完整（CaptureBridge/AppState） | 无（纯 demo 模拟） |

---

## 2. 同步方案对比

### 方案 1：维持现状，不同步 contest-demo 到 Android

**做法**：Android 继续加载旧 `web/demo/demo.html`，contest-demo 仅作为 Web 端独立演示页面。

- 优点：
  - 零风险，不影响现有 Android 功能
  - APK 体积不增加
  - 不需要修改 Android 原生代码
  - 测试成本最低
- 缺点：
  - 平板端无法展示新 contest-demo 的多形象、透明悬浮、mocap 等功能
  - Android 与 Web demo 功能差距持续扩大

**适用场景**：contest-demo 主要是参赛展示页，不需要平板端演示。

---

### 方案 2：新增 Android 内置 contest-demo assets（离线可用）

**做法**：
1. 将 `src/contest-demo/` 核心文件复制到 `app/src/main/assets/web/contest-demo/`
2. 必要依赖（如 `face-tracking/procedural-mesh-renderer.js`、`contest-avatar-adapter.js`）也复制
3. **不复制** `visual-history/`（141 个文件，体积大，非必要）
4. 修改 Android：
   - 新增一个入口按钮或 menu 选项，点击后加载 contest-demo
   - 或在 AvatarDemoActivity 增加 `?mode=contest` 参数支持
   - 或新增一个 `ContestDemoActivity`

- 优点：
  - 离线可用，不依赖网络
  - 功能完整，与 Web demo 一致
  - 可控制打包内容（剔除 visual-history）
- 缺点：
  - APK 体积增加（估计 +几百 KB 到 1 MB，不含 visual-history）
  - 需要修改 Android 原生代码（新增 Activity 或入口）
  - 路径适配复杂（相对路径、资源引用）
  - 每次 contest-demo 更新需要手动同步到 Android assets
  - Android 桥接（面捕、音频）需要额外开发

**工作量估计**：中（复制资源 + 路径适配 + Android 入口 + 测试）

---

### 方案 3：Android 增加"打开线上 contest demo"入口

**做法**：
1. Android app 内新增一个按钮/入口
2. 点击后用 WebView 或系统浏览器加载 GitHub Pages URL：
   `https://samzebrado.github.io/CheapLive/src/contest-demo/contest-interactive-demo.html`
3. 可选：用 WebView 加载，复用现有 WebView 基础设施

- 优点：
  - 实现最快，只需新增一个入口按钮
  - APK 体积零增加
  - 自动与线上版本同步，不需要手动同步 assets
  - 不修改 contest-demo 代码
- 缺点：
  - 依赖网络，离线不可用
  - 不是纯本地方案
  - 无法与 Android 面捕/音频链路联动（纯展示页）
  - GitHub Pages CDN 可能有延迟

**工作量估计**：小（新增按钮 + WebView loadUrl）

---

### 方案 4：LocalServer 提供 contest-demo

**做法**：
1. 复用 Android 现有 LocalServer（`LocalServer.kt`）
2. 将 contest-demo 文件放到 assets 中，由 LocalServer 提供 HTTP 服务
3. Receiver 端（同一设备或其他设备）通过 `http://127.0.0.1:8080/contest-demo/` 访问

- 优点：
  - 接近现有多端联动架构
  - 可与 Android 面捕/音频链路集成
  - 多设备可访问
- 缺点：
  - 实现最复杂
  - 需要测试 LocalServer 与 contest-demo 的兼容性
  - 需要处理资源路径、CORS 等问题
  - 开发和测试成本最高

**工作量估计**：大

---

## 3. 推荐方案

### 3.1 短期（本轮）：方案 1 + 文档

- 维持 Android 现状，不做任何修改
- 只做构建验证（assembleDebug）和文档
- contest-demo 改动继续在 Web 端推进
- 理由：
  - 本轮任务重点是 Web demo 形象完善，不是 Android 集成
  - 贸然把 contest-demo 塞入 APK 风险高
  - 没有用户明确确认前，不修改 Android 入口

### 3.2 中期（后续轮次）：方案 2 最小版本或方案 3

如果后续需要平板端展示 contest-demo：

- **优先方案 3**（线上入口）：
  - 最快实现
  - 零 APK 体积增加
  - 适合作为"演示入口"
  - 需要用户确认：是否允许 Android 加载线上 GitHub Pages

- **备选方案 2 最小版本**：
  - 只复制 contest-demo 核心文件（不含 visual-history）
  - 新增 Activity 或入口
  - 适合需要离线演示的场景
  - 需要用户确认：是否允许 APK 体积增加、是否修改 Android 原生代码

### 3.3 长期：方案 4

如果需要完整的"平板面捕 + contest-demo 形象 + 多端联动"：
- 走 LocalServer 方案
- 工作量大，需要单独规划

---

## 4. 需要用户最终确认的高风险点

以下决策必须由用户确认，Agent 不得擅自实施：

1. **是否允许 Android APK 包含 contest-demo assets？**
   - 影响：APK 体积增加
   - 相关方案：方案 2、方案 4

2. **是否允许 Android 入口加载线上 GitHub Pages？**
   - 影响：依赖网络、数据走公网
   - 相关方案：方案 3

3. **是否允许新增 Activity / 修改 Android 原生 UI 入口？**
   - 影响：修改 Android 原生代码，需要回归测试
   - 相关方案：方案 2、方案 3、方案 4

4. **visual-history 141 个文件是否需要打包进 APK？**
   - 影响：APK 体积显著增加
   - 默认：不打包

5. **contest-demo 是否需要与 Android 面捕/音频链路集成？**
   - 影响：工作量从"加载页面"升级为"完整桥接开发"
   - 默认：不集成，纯展示

---

## 5. 当前实施状态

| 方案 | 状态 |
|------|------|
| 方案 1（维持现状） | ✅ 当前默认 |
| 方案 2（内置 assets） | ⏳ 待用户确认 |
| 方案 3（线上入口） | ⏳ 待用户确认 |
| 方案 4（LocalServer） | ⏳ 待用户确认 |

---

## 6. 相关文件

- Android 源码：`/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive/android-capture/`
- AvatarDemoActivity：`app/src/main/java/com/cheaplive/capture/AvatarDemoActivity.kt`
- 当前加载路径：`file:///android_asset/web/demo/demo.html?avatar=$safeKind`
- Contest demo 源码：`src/contest-demo/`
- 线上地址：`https://samzebrado.github.io/CheapLive/src/contest-demo/contest-interactive-demo.html`
