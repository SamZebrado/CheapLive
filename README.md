# CheapLive - 便宜直播

🚧 **CheapLive 当前处于积极开发阶段**。本仓库提供早期功能 Demo。部分功能仍属实验性、开发中或后续规划，请先查看下方功能状态，再决定使用方式。

> 低成本浏览器端虚拟形象面捕实验项目：打开网页即可体验，无需安装。

---

## 当前状态一览

| 功能 | 状态 | 说明 |
|------|------|------|
| 浏览器单机面捕 | 可体验 | 使用摄像头与 MediaPipe；目标设备兼容性仍需验证 |
| 程序化球形头像 | 可体验 | 支持头部和表情参数 |
| 程序化纺锤鲸鱼 | 可体验 | 支持表情及尾巴动画 |
| 实时变声 | 实验性 | 自动测试覆盖有限，真实麦克风和听感待验证 |
| 多设备信令服务器 | 扩展玩法/待开发 | 局域网内多设备协作，需手动搭建 Node.js 服务 |
| 网页旧多端模式 | 实验性 | 当前部署和真实跨设备连接仍有限制 |
| CheapLive Capture Android App | ⏸️ 暂停开发 | 功能已移交参赛项目独立开发，比赛结束后酌情恢复 |
| 参赛演示 Demo | 公开演示 | 双端模拟多设备交互 Demo；Android APK/源码比赛期间不公开 |
| Live2D Cubism | 规划中 | Demo 阶段冻结，当前不能实际渲染 Live2D 模型 |
| 透明悬浮浏览器 | 规划中 | 当前尚未实现 |

**可体验入口**：[单机面捕 Demo](src/face-tracking/index.html)

---

## 项目简介

CheapLive 是一个基于纯浏览器技术栈的**低成本移动端虚拟形象面捕实验项目**。它利用手机前置摄像头进行实时面部捕捉，驱动程序化虚拟形象进行直播展示。

**当前事实：**

- 可体验：单机浏览器面捕 + 两个程序化 Avatar（球形头像 / 纺锤鲸鱼）
- 实验性：实时变声，旧多端网页协同（依赖开发者本地信令服务）
- ⏸️ 暂停开发：CheapLive Capture Android App（功能已移交参赛项目，比赛结束后酌情恢复）
- 规划中：Live2D Cubism SDK 集成，透明悬浮浏览器

### 两种产品模式

**单机模式**：打开网页即可体验，无需安装。一台手机同时负责面捕 + 渲染 + 直播展示。

**未来多端模式**：面捕手机安装 CheapLive Capture；直播端仍使用普通浏览器；无需电脑。多端模式**开发中，当前不可下载**。

### 核心价值

- **零成本体验**：无需额外硬件，有浏览器就能开始
- **隐私优先**：摄像头画面在本地浏览器处理；单机模式不主动上传摄像头画面
- **开源可审计**：MIT 许可证，代码完全开源

### 已知限制

- 手机及内置浏览器兼容性仍需真机测试
- 变声听感和真实设备尚未完整验证
- 多端模式尚未形成正式可交付方案
- Live2D 当前不能使用（规划中）
- 后台摄像头和系统悬浮能力不属于纯网页能力

---

## 快速开始

### 方式一：GitHub Pages 直接打开（推荐体验）

1. 访问 [https://samzebrado.github.io/CheapLive/src/face-tracking/](https://samzebrado.github.io/CheapLive/src/face-tracking/)
2. 点击 "启动摄像头" 即可开始面部捕捉
3. 在页面中选择球形头像或纺锤鲸鱼 Avatar

### 方式二：本地开发服务器

```bash
cd CheapLive
python3 -m http.server 8080
# 手机浏览器访问 http://电脑IP:8080/src/face-tracking/
```

---

## 项目结构

```
CheapLive/
├── index.html                 # 项目说明与统一入口（当前首页）
├── src/
│   ├── contest-demo/          # 参赛演示 Demo（公开）
│   │   └── dual-device-demo.html  # 双端模拟多设备交互演示
│   └── face-tracking/         # 单机面捕核心（当前推荐体验路径）
│       ├── index.html         # 主页面
│       ├── face-tracker.js    # 面部捕捉核心逻辑
│       ├── debug-avatar.js    # 程序化 Avatar（萨卡班甲鱼基础）
│       └── style.css
├── android-capture/           # CheapLive Capture Android App（⏸️ 暂停开发，已由参赛项目接管）
└── README.md                  # 本文件
```

---

## 功能说明

### 🟢 可体验：浏览器单机面捕

基于 MediaPipe Face Landmarker 在浏览器中实时处理摄像头画面，提取面部参数（眼睛、嘴巴、头部姿态）。当前支持两个程序化 Avatar：

- **球形头像**：Canvas 2D 渲染，响应眨眼、张嘴和头部转动
- **纺锤鲸鱼**：带有身体摆动和尾巴动画的程序化形象

### 🟡 实验性：实时变声 / 旧多端模式

- **实时变声**：基于 Web Audio API，功能存在但听感和跨浏览器兼容仍待验证
- **网页旧多端模式**：保留在 `src/multi-device/`，依赖本地局域网信令服务；作为开发者实验入口保留，不作为当前推荐用户路径

### 🛠️ 扩展玩法 / 待开发：多设备信令服务器

> **手动搭建，不包含在默认体验中**。适合有一定 Node.js 使用经验的开发者。

局域网内多设备协作扩展。支持：

- 设备注册与发现（HTTP + JSON API）
- 心跳保活与自动清理（5秒心跳，15秒 TTL）
- Server-Sent Events (SSE) 实时推送
- WebRTC 信令消息转发

**快速启动**：

```bash
cd CheapLive
node src/multi-device/signaling-server.js
# 服务监听端口 8766
```

然后在浏览器访问 <http://localhost:8766/devices> 验证服务运行。

**完整搭建说明**：请参阅 [docs/signaling-server-setup.md](docs/signaling-server-setup.md)，包含：

- 所有 API 参考（注册/心跳/设备列表/信令/SSE 事件流）
- 浏览器端 JavaScript 示例代码
- 生产部署（systemd/launchd）
- 故障排查与安全提示
- 单元测试验证方法

**注意事项**：

- 此服务仅推荐在受信任的局域网内使用
- 不包含认证机制，不要暴露到公网
- 所有信令消息为 HTTP 明文传输（WebRTC 媒体流自身加密）

### ⏸️ 暂停开发：CheapLive Capture Android App

该功能已由参赛项目独立开发接管，主项目不再更新。比赛结束后根据代码质量和结果酌情回灌。

**开发中**的说明（快照，仅供参考）：目标是在面捕手机上运行轻量 Android App，通过局域网向直播端浏览器发送面捕参数。目前 APK 未发布，真机链路未验证。

### 🔴 规划中：Live2D Cubism / 透明悬浮浏览器

- Live2D Cubism SDK 集成作为后续规划，当前**不能实际渲染** Live2D 模型
- 透明悬浮浏览器需依赖原生 Android 悬浮窗能力，当前纯网页版本不提供

---

## 隐私说明

- **面部捕捉数据**：由 MediaPipe 模型在你的设备本地实时计算，所有数据（关键点、表情参数）留在浏览器中，不会上传到服务器
- **摄像头画面**：仅在本地显示；单机模式不主动上传摄像头画面
- **实验性功能**（变声、旧多端模式）可能触发额外的浏览器内处理，但不会向云端上传原始音频或视频流
- **Android Capture**（⏸️ 暂停开发）未来在局域网内仅传输少量面捕参数，不传输摄像头视频

---

## 参考与致谢

- [MediaPipe](https://mediapipe.dev/) - 浏览器端面部捕捉方案
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/download-web/) - 未来虚拟形象渲染
- [SoundTouchJS](https://github.com/cutterbl/soundtouchjs) - 变声参考

---

## 许可证

MIT License

Copyright (c) 2025 CheapLive Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## 参与贡献

CheapLive 是为 TRAE AI 创造力大赛开发的项目，欢迎提交 Issue 和 PR。

---

> **CheapLive** - 让每个人都能成为虚拟主播。
