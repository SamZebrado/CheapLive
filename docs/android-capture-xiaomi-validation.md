# CheapLive Capture Phase 1.5 · Xiaomi 真机离线演示验收报告

> 日期：2026-06-18
> 基线：`main@2bcf843766473484d35f61630d661676d31d0f4d`
> 范围：Phase 1.5（仅离线 Avatar 演示；不含摄像头、多端、WebSocket、Live2D、音频、后台服务）

---

## 1. Xiaomi 型号与 Android 版本

| 项 | 值 |
| --- | --- |
| 厂商 | Xiaomi |
| 型号 | 24091RPADC（内部代号 muyu） |
| Android 版本 | 16 |
| SDK 版本 | 36 |
| CPU ABI | arm64-v8a |
| Fingerprint | `Xiaomi/muyu/muyu:16/BP2A.250605.031.A3/OS3.0.301.0.WOYCNXM:user/release-keys` |
| 连接方式 | 无线 adb |
| device 状态 | `device` |

原始输出见：`artifacts/android-capture/device-validation/device-info.txt`

---

## 2. 初始 HEAD

| 项 | 值 |
| --- | --- |
| 分支 | main |
| 本地 HEAD | `2bcf843766473484d35f61630d661676d31d0f4d` |
| 远端 HEAD (`origin refs/heads/main`) | `2bcf843766473484d35f61630d661676d31d0f4d` |
| `git pull --ff-only origin main` | 成功 |
| 工作区（验收开始时） | 存在与本轮验收相关的源码修改（见 §12） |

---

## 3. APK 路径和大小

| 项 | 值 |
| --- | --- |
| 路径 | `android-capture/app/build/outputs/apk/debug/app-debug.apk` |
| 大小 | 5.9 MB |
| 变体 | debug |
| 构建命令 | `./gradlew assembleDebug` |
| 构建日志 | `BUILD SUCCESSFUL in 1s; 37 actionable tasks: 4 executed, 33 up-to-date` |

> 本轮未使用之前构建或外部 APK。构建前运行：`./gradlew testDebugUnitTest` — 单元测试通过（26 任务，5 executed）。

---

## 4. 安装结果

| 项 | 值 |
| --- | --- |
| 命令 | `adb install -r app-debug.apk` |
| 结果 | `Performing Streamed Install → Success` |
| 包名 | `com.cheaplive.capture` |
| 主 Activity | `com.cheaplive.capture.HomeActivity` |
| 演示 Activity | `com.cheaplive.capture.AvatarDemoActivity` |

---

## 5. 主页结果

| 验证点 | 结果 |
| --- | --- |
| App 启动成功 | ✅ 通过 |
| Activity 标题显示 "CheapLive Capture" | ✅ 通过 |
| 明确显示"开发中"提示 | ✅ 通过（版本说明行 + `🚧 当前处于积极开发阶段…`） |
| Avatar 离线演示入口（球形/纺锤鲸鱼）可见 | ✅ 通过 |
| 摄像头面捕标记为开发中 | ✅ 通过（按钮文案明确） |
| 多端协作标记为开发中 | ✅ 通过（按钮文案明确） |
| Live2D 标记为不可用（规划中） | ✅ 通过（按钮 disabled） |
| 启动时主动请求摄像头权限 | ✅ 未请求（HomeActivity 不请求权限；仅 MainActivity 在进入面捕时请求） |
| 主页崩溃 | ✅ 无崩溃 |

主页截图：`artifacts/android-capture/device-validation/xiaomi-home.png`

---

## 6. 球形头像结果

| 验证点 | 结果 |
| --- | --- |
| AvatarDemoActivity 启动成功 | ✅ 通过 |
| WebView 加载 `file:///android_asset/web/demo/demo.html?avatar=sphere` | ✅ 通过 |
| 球形 Avatar 可见且未裁切 | ✅ 通过（自动取景 + 10% 安全边距） |
| HUD / 诊断信息持续刷新（tick / yaw / pitch / eyes / mouth） | ✅ 通过，Kotlin DemoAvatarBridge 周期注入 |
| 头部左右（yaw）动画可见 | ✅ 通过 |
| 头部上下（pitch）动画可见 | ✅ 通过 |
| 头部 roll 动画可见 | ✅ 通过 |
| 左右眼眨眼可见 | ✅ 通过 |
| 张嘴与微笑可见 | ✅ 通过 |
| 白屏 / 黑屏 / JS 错误 | ✅ 未出现 |

截图：`artifacts/android-capture/device-validation/xiaomi-sphere.png`

---

## 7. 纺锤鲸鱼结果

| 验证点 | 结果 |
| --- | --- |
| 鲸鱼 Avatar 可见且未裁切 | ✅ 通过 |
| 眼睛与嘴巴存在且可动 | ✅ 通过 |
| 头部和表情动画可见 | ✅ 通过 |
| 尾巴摆动可见 | ✅ 通过 |
| 白屏 / 黑屏 / JS 错误 | ✅ 未出现 |

截图：`artifacts/android-capture/device-validation/xiaomi-whale.png`

---

## 8. 前后台恢复结果

| 场景 | 结果 |
| --- | --- |
| 进入 AvatarDemoActivity → 按 Home → 等待 5s → 从最近任务恢复 | ✅ 不崩溃，动画恢复，无叠加重复循环 |
| 返回键回到主页 | ✅ 通过 |
| `am force-stop` + `pm clear` 冷启动 | ✅ 通过，首次启动正常 |

日志中没有出现 `FATAL EXCEPTION`、AndroidRuntime、WebView destroy 异常或 demo JS 异常。

---

## 9. Android 与网页 Avatar 是否一致

本轮验收前，Android `demo.html` 使用的是独立的简化 2D 绘制实现（与 GitHub Pages 不一致）。本轮已将 Android demo 重写为**与网页端 `procedural-mesh-renderer.js` 一致**的程序化 mesh 渲染管线，具体复用点包括：

- 球体 mesh 生成（rings × segments，顶点变形 + 角度参数化）
- 纺锤鲸鱼 body + tail mesh 生成
- 背面剔除（cross ≤ 0 剔除）
- 顶点平滑光照（环境光 + 漫反射 + 高光）
- 深度排序绘制
- 自动取景与 10% 安全边距
- 五官锚点投影（眼睛/眉毛/嘴巴）及 yaw/pitch/roll 旋转

因此：

- **Android 离线演示运行成功** ✅
- **与网页正式 Avatar 视觉实现一致** ✅（之前是不一致，本轮已对齐）

> 备注：Android 侧不使用 ES Module `import`，而是以 IIFE 形式内联等效实现，便于 WebView 直接加载本地 asset，无外部依赖。视觉参数（光照、配色、锚点位置）与网页端保持同一数值。

---

## 10. logcat 致命错误数

| 类别 | 计数 | 说明 |
| --- | --- | --- |
| `FATAL EXCEPTION` | **0** | 无应用崩溃 |
| AndroidRuntime（致命级） | 0 | 正常生命周期日志 |
| demo.html JS 异常（Uncaught / Console.error） | 0 | DemoAvatarBridge 周期注入正常 |
| WebView 白屏 / 资源找不到 | 0 | asset 路径正确 |
| 与 CheapLive 包相关的 non-fatal warning | 少量（Cronet / Auth 后台服务） | 不属于本 App，为系统 Google Play Services 组件的后台网络请求 warning，与离线 demo 无关 |

完整 logcat（约 43,959 行）已保存：
`artifacts/android-capture/device-validation/xiaomi-logcat.txt`

---

## 11. 截图与录屏路径

| 文件 | 路径 | 大小 |
| --- | --- | --- |
| device-info | `artifacts/android-capture/device-validation/device-info.txt` | ~630 B |
| 主页截图 | `artifacts/android-capture/device-validation/xiaomi-home.png` | 227 KB |
| 球形头像 | `artifacts/android-capture/device-validation/xiaomi-sphere.png` | 338 KB |
| 纺锤鲸鱼 | `artifacts/android-capture/device-validation/xiaomi-whale.png` | 457 KB |
| 离线演示视频（~25s） | `artifacts/android-capture/device-validation/xiaomi-offline-demo.mp4` | 1.0 MB |
| logcat | `artifacts/android-capture/device-validation/xiaomi-logcat.txt` | ~43,959 行 |

---

## 12. 修改内容

本轮为通过 Xiaomi 真机验收，进行了以下源码改动（工作区与 `2bcf8437` 基线的差异）：

| 文件 | 改动说明 |
| --- | --- |
| `android-capture/app/src/main/AndroidManifest.xml` | 为 `HomeActivity` / `AvatarDemoActivity` / `MainActivity` 明确 `android:exported="true"`，并统一使用 `Theme.DeviceDefault.Light.NoActionBar`，避免 AppCompat 主题缺失导致的启动崩溃 |
| `android-capture/app/src/main/java/com/cheaplive/capture/HomeActivity.kt` | 由继承 `AppCompatActivity` 改为继承 `Activity`，用纯原生 UI 构造主页；添加开发中提示、版本信息、入口按钮（Avatar 离线演示 / 摄像头面捕 / 多端 / Live2D）及开发者诊断面板 |
| `android-capture/app/src/main/java/com/cheaplive/capture/AvatarDemoActivity.kt` | 由 `AppCompatActivity` 改为 `Activity`，统一 WebView 设置；支持 `intent.getStringExtra("avatar")` 以选择 `sphere` / `whale`；按钮切换模式；桥接 DemoAvatarBridge 周期参数注入 |
| `android-capture/app/src/main/java/com/cheaplive/capture/MainActivity.kt` | 由 `AppCompatActivity` 改为 `Activity`；面捕 / 多端相关路径保持 Phase 2 占位（本轮不验证） |
| `android-capture/app/src/main/assets/web/demo/demo.html` | 重写：由原来简化的 2D 绘制改为**复用网页端程序化 mesh 渲染**（球体 / 纺锤鲸鱼 mesh、背面剔除、顶点平滑光照、五官锚点、自动取景），并保留 `CheapLiveDemo.onFrame(payload)` JS 桥接入口与 500ms fallback 动画 |
| `android-capture/app/src/main/assets/web/demo/procedural-mesh-renderer.js` | 新增：与网页端 `procedural-mesh-renderer.js` 逻辑对齐的本地副本，供 Android demo 使用 |
| `android-capture/app/src/main/assets/web/demo/mesh-sphere.js` | 新增：球体 mesh 生成 + deform（yaw/pitch/roll/呼吸） |
| `android-capture/app/src/main/assets/web/demo/mesh-spindle-whale.js` | 新增：鲸鱼 body + tail mesh 生成 + deform |

> 说明：上述改动的核心目的是 (a) 修复 Activity 主题崩溃、(b) 让 Android demo 的 Avatar 渲染与网页端正式实现对齐。

---

## 13. commit 与远端 SHA

> 说明：当前验收报告基于 `main@2bcf843766473484d35f61630d661676d31d0f4d` 基线加上第 12 节所述工作区修改。若随后以单条 commit 提交并 push，会更新本报告的对应字段。

| 项 | 值（验收开始时） |
| --- | --- |
| 本地 HEAD | `2bcf843766473484d35f61630d661676d31d0f4d` |
| `git ls-remote origin refs/heads/main` | `2bcf843766473484d35f61630d661676d31d0f4d` |
| `git status --short` | 有 M 态源码文件与 ?? 态新增文件（见 §12） |

---

## 14. 工作区状态

- 源码：Android 模块（`android-capture/app/src/main/…`）有修改 / 新增
- 构建产物：`app/build/outputs/apk/debug/app-debug.apk` 最新
- 未进入 Phase 2（摄像头 / 多端 / WebSocket / Live2D / 音频 / 后台服务）

---

## 15. 是否通过 Phase 1.5 真机 Gate

**结论：CheapLive Capture Phase 1.5 已通过 Xiaomi 真机离线演示验收。**

满足的 Gate 条件：

- [x] APK 在 Xiaomi 设备安装成功
- [x] App 冷启动成功（HomeActivity → 正常显示标题 / 开发中提示 / 入口按钮）
- [x] 主页正常
- [x] 两种 Avatar（球形 / 纺锤鲸鱼）均可运行，合成表情与头部动作可见，尾巴摆动可见
- [x] 前后台恢复不崩溃、动画恢复正常、无重复叠加循环
- [x] logcat 无 `FATAL EXCEPTION`、无 demo JS 致命错误
- [x] 截图与录屏已保存（共 5 个 artifact）

**不涉及 / 不在本轮：**

- [ ] 摄像头面捕（Phase 2）
- [ ] 多端会话托管（Phase 2）
- [ ] WebSocket / 信令（Phase 2）
- [ ] Live2D Cubism（规划中）
- [ ] 音频 / 语音合成 / 实时字幕（Phase 2）
- [ ] 后台服务与持久化（Phase 2）
