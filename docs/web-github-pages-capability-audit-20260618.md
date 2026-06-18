# CheapLive 纯 Web / GitHub Pages 功能可行性全面审计

**生成日期**: 2026-06-18
**审计范围**: 当前 GitHub `main` 分支真实代码 + 官方文档 + 公开网络资料
**审计原则**: 只读调研，不修改代码，每个结论附来源

---

## 1. 审计方法说明

### 数据来源
- [P0] 官方文档: MDN, W3C, Chrome Developers, WebKit, Live2D 官方, MediaPipe 官方, Android 官方
- [P1] 权威二级资料: GitHub 官方文档, Can I use, web.dev
- [P2] 技术社区: 开发者博客（仅作补充，不作为关键结论唯一来源）

### 代码审计范围
- GitHub 仓库 `SamZebrado/CheapLive` main 分支
- 关键文件: `src/face-tracking/`, `src/multi-device/`, `index.html`, `package.json`, `README.md`, `docs/`

### 四种运行环境定义
- **A. 纯静态 HTTPS Web**: 只有 HTML/CSS/JS/WASM/WebGL，无后端
- **B. GitHub Pages**: HTTPS 静态托管，不能运行常驻 Node 服务
- **C. 局域网本地 Web 服务**: 本地静态页面 + Node 信令服务，HTTP/HTTPS
- **D. Android WebView / 原生容器**: 网页运行在 Android WebView，可配合原生能力

---

## 2. Live2D Cubism 专项审计

### 2.1 当前代码状态

| 组件 | 状态 | 证据 |
|------|------|------|
| 上传 UI (ZIP/文件夹) | ✅ 已实现 | `index.html` 中有 `<input type="file">` 和 JSZip 解析 |
| cubism-loader.js | 🟡 骨架 | 能动态加载 Core/Framework，但 SDK 文件未包含在仓库 |
| cubism-runtime.js | 🟡 骨架 | 状态机完整，能解析 .model3.json，但**渲染循环未实现** |
| face-to-cubism-mapper.js | 🟡 骨架 | 映射逻辑完整，但无下游模型接收参数 |
| Cubism Core (live2dcubismcore.min.js) | ❌ 缺失 | 需用户从 live2d.com 下载，受许可证约束 [cite:1] |
| Cubism Framework | ❌ 缺失 | 同上 |
| .moc3 模型文件 | ❌ 缺失 | 项目中无任何模型文件 |
| WebGL 渲染循环 | ❌ 未实现 | `cubism-runtime.js` 中 `draw()` 仅为纹理占位 |
| 实际可运行 Demo | ❌ 不可运行 | 选择 live2d-cubism 选项会报错 |

**关键代码证据** (`cubism-runtime.js`):
```javascript
// 注释明确说明:
// "full Framework mode needs more initialization steps including 
//  CubismModelMatrix, CubismRenderer, CubismMotionManager"
// 实际的 WebGL/Canvas 渲染循环未编写
```

### 2.2 技术可行性

**普通 HTTPS 网页能否加载 Live2D?**
- ✅ **可以**。Live2D Cubism Web SDK 是纯前端 JavaScript + WebGL，不需要后端。[cite:2]
- 已有多个开源项目成功在纯网页中运行 Live2D，如 `pixi-live2d-display`, `live2d-widget`。[cite:3]

**GitHub Pages 能否加载 Live2D?**
- ✅ **可以**。GitHub Pages 是静态 HTTPS 托管，完全满足 Live2D SDK 的运行要求。
- 但模型文件（.moc3, .model3.json, 纹理）需要用户自行提供，不能托管在 GitHub 上（许可证限制）。[cite:1]

### 2.3 许可证约束

Live2D Cubism SDK 使用 **Live2D Proprietary Software License**。[cite:1]

| 使用场景 | 许可要求 |
|---------|---------|
| 开发/测试 | 免费，需同意 EULA |
| 公开发布/比赛 | **需要申请 SDK 发行许可证** |
| 个人/小规模 | 可能免除许可费 |
| 开源仓库分发 SDK 文件 | **禁止** — 这就是为什么 CheapLive 不包含 SDK 文件 |

**来源**: Live2D 官方 SDK 发行许可页面，2024 年更新 [cite:1]

### 2.4 用户上传模型流程

| 步骤 | 可行性 | 说明 |
|------|--------|------|
| 用户上传 ZIP | ✅ | JSZip 可在浏览器内解压 |
| 解析 .model3.json | ✅ | 纯 JSON 解析 |
| 加载 .moc3 二进制 | ✅ | ArrayBuffer + Cubism Core |
| 加载纹理图片 | ✅ | Blob URL + Image |
| 页面刷新后持久化 | ⚠️ | IndexedDB 可存储，但 File System Access API 在移动端支持有限 |
| 每次重新上传 | ✅ | 最可靠方案 |

### 2.5 移动端兼容性

| 浏览器 | WebGL | Live2D 支持 | 风险 |
|--------|-------|------------|------|
| Chrome Android | ✅ | ✅ | 低 |
| Safari iOS | ✅ | ⚠️ | WebGL 性能较弱，内存限制严格 |
| QQ 浏览器 | ⚠️ | 🧪 | 内核基于 Chromium，但 WebGL 支持可能不完整 |
| 微信内置浏览器 | ⚠️ | 🧪 | 同上，且可能限制文件上传 |

**来源**: MDN WebGL 兼容性表，2024 [cite:4]

### 2.6 Demo 阶段建议

**暂缓 Live2D 是合理的**，原因：
1. 当前代码仅为骨架，无法实际渲染
2. SDK 文件和模型资源需要用户自行配置，比赛 Demo 场景不友好
3. 许可证要求可能增加比赛合规风险
4. 程序化 Avatar 已能满足 Demo 展示需求

**UI 建议**: 标记为"规划中"或完全隐藏。保留上传入口但禁用会造成用户困惑。

---

## 3. 面捕和图像

### 3.1 MediaPipe Face Landmarker

| 功能 | 纯 HTTPS Web | GitHub Pages | LAN 本地 | Android WebView | 来源 |
|------|-------------|-------------|---------|----------------|------|
| WASM 推理 | ✅ | ✅ | ✅ | ✅ | MediaPipe 官方文档 [cite:5] |
| GPU delegate | ⚠️ | ⚠️ | ⚠️ | ⚠️ | 需 WebGL 2.0，部分移动端不支持 [cite:5] |
| 摄像头权限 | ✅ | ✅ | ✅ | ⚠️ | 需 HTTPS 或 localhost [cite:6] |
| 前后摄像头选择 | ✅ | ✅ | ✅ | ✅ | `facingMode` 约束 [cite:6] |
| 52 Blendshape | ✅ | ✅ | ✅ | ✅ | MediaPipe 0.10.3 [cite:5] |
| Head pose (yaw/pitch/roll) | ✅ | ✅ | ✅ | ✅ | 从关键点计算 |
| 程序化 Avatar 渲染 | ✅ | ✅ | ✅ | ✅ | Canvas 2D |
| 透明 Canvas | ✅ | ✅ | ✅ | ✅ | `canvas { background: transparent }` |
| 镜像 | ✅ | ✅ | ✅ | ✅ | CSS `transform: scaleX(-1)` |
| 隐私模式 | ✅ | ✅ | ✅ | ✅ | 停止摄像头，显示占位符 |
| 性能模式 (跳帧) | ✅ | ✅ | ✅ | ✅ | 已实现 |

### 3.2 后台/锁屏限制

| 场景 | 行为 | 来源 |
|------|------|------|
| 页面隐藏 (visibilitychange) | 摄像头继续运行，但浏览器可能节流 | MDN Page Visibility API [cite:7] |
| 切后台 (background tab) | Chrome 68+ 可能冻结标签页，摄像头**可能被暂停** | Page Lifecycle API [cite:8] |
| 锁屏 | 摄像头**必定停止**，浏览器安全模型禁止 | 浏览器安全策略 |
| 长时间运行 | 无固有稳定性问题，但需处理内存泄漏 | — |

**关键结论**: 纯网页无法实现"锁屏后继续面捕"。这是浏览器安全模型的根本限制。

---

## 4. 音频

### 4.1 核心 API 支持

| 功能 | 纯 HTTPS Web | GitHub Pages | LAN 本地 | Android WebView | 来源 |
|------|-------------|-------------|---------|----------------|------|
| 麦克风权限 | ✅ | ✅ | ✅ | ⚠️ | 需 HTTPS [cite:6] |
| Web Audio API | ✅ | ✅ | ✅ | ✅ | Baseline 2022 [cite:9] |
| AudioWorklet | ✅ | ✅ | ✅ | ⚠️ | Chrome 66+, Safari 15.4+ [cite:9] |
| SoundTouchJS (变声) | ✅ | ✅ | ✅ | ✅ | 纯 JS 库 |
| 实时变声 | ✅ | ✅ | ✅ | ⚠️ | ScriptProcessorNode 已弃用，建议 AudioWorklet |
| 回声消除 | ✅ | ✅ | ✅ | ✅ | `echoCancellation: true` [cite:6] |
| 多路音频输出 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | `setSinkId()` 实验性，移动端不支持 [cite:10] |
| 选择物理输出设备 | ❌ | ❌ | ❌ | ❌ | 无标准 API |

### 4.2 移动端音频限制

| 限制 | 说明 | 来源 |
|------|------|------|
| AudioContext 需用户手势 | 移动端必须用户点击后才能 `resume()` | MDN AudioContext [cite:11] |
| Autoplay 策略 | 无用户交互时音频不能自动播放 | Chrome Autoplay Policy [cite:12] |
| 后台音频处理 | 标签页隐藏后 AudioContext 可能被暂停 | Page Lifecycle API [cite:8] |
| 锁屏后音频 | 可能继续播放（如果已获取 Wake Lock），但麦克风停止 | — |
| 浏览器标签页休眠 | Chrome 会冻结后台标签，音频处理停止 | — |

### 4.3 变声器当前状态

- 代码完整（`voice-changer.js`），使用 SoundTouchJS
- 但生产页面集成未验证：是否真正调用 `VoiceChanger.start(stream)`
- ScriptProcessorNode 已弃用，未来应迁移到 AudioWorklet

---

## 5. 多端通信

### 5.1 WebRTC

| 功能 | 纯 HTTPS Web | GitHub Pages | LAN 本地 | Android WebView | 来源 |
|------|-------------|-------------|---------|----------------|------|
| DataChannel | ✅ | ✅ | ✅ | ✅ | WebRTC 标准 [cite:13] |
| Audio track | ✅ | ✅ | ✅ | ✅ | 同上 |
| offer/answer | ✅ | ✅ | ✅ | ✅ | 同上 |
| ICE candidate | ✅ | ✅ | ✅ | ✅ | 同上 |
| 同一局域网 P2P | ✅ | ✅ | ✅ | ✅ | 无需 STUN/TURN [cite:14] |
| 需要 STUN | ⚠️ | ⚠️ | ⚠️ | ⚠️ | 同一 LAN 不需要，跨 NAT 需要 |
| 需要 TURN | ❌ | ❌ | ❌ | ❌ | 仅防火墙严格时需要 |
| 多接收端 | ✅ | ✅ | ✅ | ✅ | 一个 PeerConnection 多 track |
| 断线重连 | 🟡 | 🟡 | 🟡 | 🟡 | 代码有状态监控，但重连逻辑不完整 |

### 5.2 信令服务器

**关键问题**: WebRTC 不能"去掉信令服务器"。

WebRTC 需要信令通道交换 SDP offer/answer 和 ICE candidate。虽然连接建立后是 P2P，但**初始协商必须依赖某种信令机制**。[cite:13]

| 信令方案 | 可行性 | 说明 |
|---------|--------|------|
| 专用信令服务器 (SSE/WebSocket) | ✅ | 当前实现 |
| 手动复制粘贴 SDP | ✅ | 纯网页可实现，但用户体验差 |
| QR 码扫描 | ✅ | 可编码 SDP，但复杂 |
| 无信令 (纯 P2P) | ❌ | 技术上不可能 |

### 5.3 设备发现

| 方案 | 可行性 | 说明 |
|------|--------|------|
| 注册式设备发现 (HTTP/SSE) | ✅ | 当前实现，需本地 Node 服务 |
| 跨标签页 BroadcastChannel | ✅ | 仅同域同浏览器 [cite:15] |
| localStorage storage event | ✅ | 仅同域同浏览器 |
| 浏览器主动扫描 LAN | ❌ | 浏览器安全模型禁止 UDP 扫描 |
| mDNS | ❌ | 网页无法发送 mDNS 查询 |
| UDP broadcast | ❌ | 网页无 UDP socket 权限 |
| 自动获取本机 LAN IP | ⚠️ | RTCPeerConnection trick 可行但不稳定 |

**来源**: MDN BroadcastChannel API [cite:15]

### 5.4 GitHub Pages 多端架构断点

```
GitHub Pages 页面 (HTTPS)
    ↓
信令请求发往: hostname:8766 (HTTP)
    ↓
❌ MIXED CONTENT 阻止 — HTTPS 页面不能请求 HTTP API
    ↓
发送端无法注册
    ↓
接收端无法发现设备
    ↓
WebRTC 无法协商
    ↓
音频/参数无法 P2P
```

**结论**: 当前多端架构在 GitHub Pages 部署下**无法工作**，因为 mixed-content 阻止了 HTTP 信令请求。

---

## 6. 部署

### 6.1 GitHub Pages 能力

| 功能 | 支持 | 说明 |
|------|------|------|
| 静态 HTTPS 托管 | ✅ | 核心能力 |
| 自定义域名 | ✅ | 支持 HTTPS |
| 用户摄像头 | ✅ | 需 HTTPS |
| 麦克风 | ✅ | 需 HTTPS |
| WebGL | ✅ | 浏览器能力 |
| WASM | ✅ | 浏览器能力 |
| WebRTC | ✅ | 浏览器能力 |
| IndexedDB | ✅ | 浏览器能力 |
| Service Worker | ✅ | 支持 PWA |
| 上传文件 | ✅ | `<input type="file">` |
| Live2D 静态资产 | ⚠️ | 可托管，但模型文件需用户自有版权 |
| Node 服务 | ❌ | 不支持 |
| UDP 扫描 | ❌ | 不支持 |
| LAN 服务发现 | ❌ | 不支持 |
| 原生悬浮窗 | ❌ | 不支持 |
| 后台前台服务 | ❌ | 不支持 |

### 6.2 Mixed Content

GitHub Pages 强制 HTTPS。如果信令服务器是 HTTP（本地 Node 默认），浏览器会阻止请求。[cite:16]

**解决方案**:
1. 本地信令服务器也使用 HTTPS（需要证书）
2. 使用 `localhost` 例外（开发环境）
3. 将信令服务器部署到 HTTPS 云服务器

### 6.3 CDN 依赖

| CDN | 用途 | 风险 |
|-----|------|------|
| jsdelivr.net | MediaPipe, SoundTouchJS, JSZip | 低，主流 CDN |
| storage.googleapis.com | MediaPipe 模型文件 | 低，Google 托管 |
| fonts.googleapis.com | 字体 | 低，但国内可能慢 |
| cubism.live2d.com | Live2D Core (fallback) | 中，受许可证约束 |

---

## 7. 浏览器与设备兼容

### 7.1 功能支持矩阵

| 浏览器 | getUserMedia | WebGL 2.0 | Web Audio | WebRTC | BroadcastChannel | 文件上传 |
|--------|-------------|-----------|-----------|--------|-----------------|---------|
| Chrome Desktop | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chrome Android | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Safari macOS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Safari iOS | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| QQ 浏览器 Android | ⚠️ | 🧪 | 🧪 | 🧪 | 🧪 | ✅ |
| 微信内置浏览器 | ⚠️ | 🧪 | 🧪 | 🧪 | 🧪 | ✅ |
| Android WebView | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

**来源**: MDN 兼容性表，Can I use，2024-2025 [cite:4][cite:6][cite:9][cite:13][cite:15]

### 7.2 红米 K50 特定风险

- MIUI 可能限制后台摄像头和麦克风
- QQ 浏览器/微信内置浏览器可能限制 WebRTC
- WebGL 性能取决于 GPU (Adreno)
- 文件上传在微信中可能受限

---

## 8. 系统级能力

| 功能 | 纯网页 | Android WebView | 原生 Android | 来源 |
|------|--------|----------------|-------------|------|
| 系统透明悬浮窗 | ❌ | ⚠️ (需原生配合) | ✅ | Android 窗口管理 |
| 触摸穿透 | ❌ | ⚠️ | ✅ | — |
| 始终置顶 | ❌ | ❌ | ✅ | — |
| 前台服务 | ❌ | ❌ | ✅ | Android Service |
| camera 类型前台服务 | ❌ | ❌ | ✅ | Android 14+ 限制 |
| 后台持续摄像头 | ❌ | ❌ | ❌ | Android 安全限制 |
| 后台持续 JavaScript | ❌ | ❌ | ❌ | 系统杀进程 |
| 防止系统杀进程 | ❌ | ❌ | ⚠️ | 需前台服务 |
| 自动启动 | ❌ | ❌ | ⚠️ | 需系统权限 |
| 通知栏控制 | ❌ | ⚠️ | ✅ | Notification API 有限支持 |
| 屏幕录制 | ❌ | ❌ | ✅ | MediaProjection API |
| 系统音频捕获 | ❌ | ❌ | ✅ | AudioPlaybackCapture API |
| 跨应用叠加 | ❌ | ❌ | ✅ | SYSTEM_ALERT_WINDOW |

**关键结论**: 所有"系统级"功能都**不能**在纯网页中实现，必须依赖原生 Android。

---

## 9. 其他功能

| 功能 | 纯 HTTPS Web | GitHub Pages | 来源 |
|------|-------------|-------------|------|
| Clipboard API | ✅ | ✅ | MDN [cite:17] |
| execCommand('copy') fallback | ✅ | ✅ | 已弃用但可用 |
| 文件夹上传 | ⚠️ | ⚠️ | `webkitdirectory` 非标准 [cite:18] |
| ZIP 解压 (JSZip) | ✅ | ✅ | 纯 JS |
| Web Speech API (SpeechRecognition) | ⚠️ | ⚠️ | Chrome 支持，Safari 有限 [cite:19] |
| 本地保存配置 (localStorage) | ✅ | ✅ | — |
| 本地保存配置 (IndexedDB) | ✅ | ✅ | — |
| 全屏 | ✅ | ✅ | Fullscreen API |
| 屏幕常亮 (Wake Lock) | ✅ | ✅ | MDN Wake Lock API [cite:20] |
| 下载文件 | ✅ | ✅ | `<a download>` |
| 分享 (Web Share API) | ⚠️ | ⚠️ | 移动端支持较好 [cite:21] |
| 通知 (Notification API) | ✅ | ✅ | 需用户授权 |
| 安装为 PWA | ✅ | ✅ | Service Worker + manifest |

---

## 10. 能力总矩阵

见 `docs/runtime-architecture-by-environment-20260618.md` 中的完整表格。

---

## 来源

[cite:1] [官方] Live2D SDK 发行许可: https://www.live2d.com/zh-CHS/download/cubism-sdk/release-license/ (2024)

[cite:2] [官方] Live2D Cubism Web SDK 文档: https://docs.live2d.com/cubism-sdk-tutorials/about-web-sdk/ (2024)

[cite:3] [社区] pixi-live2d-display GitHub: https://github.com/guansss/pixi-live2d-display (开源项目，证明网页可运行 Live2D)

[cite:4] [官方] MDN WebGL 兼容性: https://developer.mozilla.org/zh-CN/docs/Web/API/WebGL_API (2024-09)

[cite:5] [官方] MediaPipe Face Landmarker: https://developers.google.com/mediapipe/solutions/vision/face_landmarker (2024)

[cite:6] [官方] MDN getUserMedia: https://developer.mozilla.org/zh-CN/docs/Web/API/MediaDevices/getUserMedia (2024)

[cite:7] [官方] MDN Page Visibility API: https://developer.mozilla.org/zh-CN/docs/Web/API/Page_Visibility_API (2024)

[cite:8] [官方] Chrome Page Lifecycle API: https://developer.chrome.com/docs/web-platform/page-lifecycle-api (2024)

[cite:9] [官方] MDN Web Audio API: https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Audio_API (2024)

[cite:10] [官方] MDN AudioContext.setSinkId: https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext/setSinkId (实验性)

[cite:11] [官方] MDN AudioContext: https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext (2024)

[cite:12] [官方] Chrome Autoplay Policy: https://developer.chrome.com/blog/autoplay (2024)

[cite:13] [官方] MDN WebRTC API: https://developer.mozilla.org/zh-CN/docs/Web/API/WebRTC_API (2024)

[cite:14] [官方] WebRTC.org NAT traversal: https://webrtc.org/getting-started/turn-server (2024)

[cite:15] [官方] MDN BroadcastChannel API: https://developer.mozilla.org/zh-CN/docs/Web/API/Broadcast_Channel_API (2025-02)

[cite:16] [官方] MDN Mixed Content: https://developer.mozilla.org/zh-CN/docs/Web/Security/Mixed_content (2024)

[cite:17] [官方] MDN Clipboard API: https://developer.mozilla.org/zh-CN/docs/Web/API/Clipboard_API (2024)

[cite:18] [官方] MDN File and Directory Entries API: https://developer.mozilla.org/zh-CN/docs/Web/API/File_and_Directory_Entries_API (2024)

[cite:19] [官方] MDN Web Speech API: https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Speech_API (2024)

[cite:20] [官方] MDN Screen Wake Lock API: https://developer.mozilla.org/zh-CN/docs/Web/API/Screen_Wake_Lock_API (2024-09)

[cite:21] [官方] MDN Web Share API: https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Share_API (2024)
