# CheapLive - 便宜直播

🚧 **CheapLive 当前处于积极开发阶段**。本仓库提供早期功能 Demo。部分功能仍属实验性、开发中或后续规划，请先查看下方功能状态，再决定使用方式。

> 低成本浏览器端虚拟形象面捕实验项目：打开网页即可体验，无需安装。

---

## 🏆 TRAE AI 创造力大赛结果

CheapLive 在 TRAE AI 创造力大赛初赛中获得**专业评分 TOP 2000**，荣获**初赛优秀奖**。遗憾未进入专业评审通道 TOP 300，未能晋级复赛。

**赛后状态**：比赛期间的源码保密限制已解除。Android Capture 源码现已开源，详见 [docs/POST_CONTEST_OPEN_SOURCE_DECISION.md](docs/POST_CONTEST_OPEN_SOURCE_DECISION.md)。

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
| CheapLive Capture Android App | ✅ 开源可用 | 源码已公开，支持构建和安装 |
| Android 黑屏采集 | 前台模式 | 防止自动超时并以纯黑 overlay 降低屏幕发光；不支持后台摄像头 |
| 上半身动作捕捉 | Beta（默认关闭） | Android Capture 本地 Worker 推理；上半身九关键点与调试骨架 |
| 参赛演示 Demo | 公开演示 | [3D 萨卡班甲鱼互动 Demo](src/contest-demo/contest-interactive-demo.html) |
| Live2D Cubism | 规划中 | Demo 阶段冻结，当前不能实际渲染 Live2D 模型 |
| 透明悬浮浏览器 | 规划中 | 当前尚未实现 |

**可体验入口**：[单机面捕 Demo](src/face-tracking/index.html) | [🏆 CheapLive 参赛 Demo / 3D 互动演示](src/contest-demo/contest-interactive-demo.html)

---

## 项目简介

CheapLive 是一个基于纯浏览器技术栈的**低成本移动端虚拟形象面捕实验项目**。它利用手机前置摄像头进行实时面部捕捉，驱动程序化虚拟形象进行直播展示。

**当前事实：**

- 可体验：单机浏览器面捕 + 两个程序化 Avatar（球形头像 / 纺锤鲸鱼）
- 实验性：实时变声，旧多端网页协同（依赖开发者本地信令服务）
- ✅ 开源可用：CheapLive Capture Android App（源码已公开）
- 规划中：Live2D Cubism SDK 集成，透明悬浮浏览器

### 两种产品模式

**单机模式**：打开网页即可体验，无需安装。一台手机同时负责面捕 + 渲染 + 直播展示。

**多端模式**：面捕手机安装 CheapLive Capture；直播端仍使用普通浏览器；无需电脑。通过局域网传输面捕参数。

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

### 方式三：Android Capture App

```bash
# 进入 Android 项目目录
cd android-capture

# 构建 APK（需要 Java 17）
JAVA_HOME=/path/to/java17 ./gradlew assembleDebug

# 安装到设备
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

详细构建指南见 [android-capture/README.md](android-capture/README.md)。

Android 主采集页提供 **黑屏采集 / Black Screen Capture**：保持 Activity 和现有 WebView 在前台，通过窗口级防超时、沉浸式系统栏和纯黑 overlay 降低屏幕发光。长按约 1.5 秒或按一次返回键退出。它不会绕过用户主动锁屏，也不支持后台持续摄像头；使用方式、亮度档位、OLED/LCD 差异及温度建议见 [docs/BLACK_SCREEN_CAPTURE.md](docs/BLACK_SCREEN_CAPTURE.md)。

---

## 项目结构

```
CheapLive/
├── index.html                 # 项目说明与统一入口（当前首页）
├── src/
│   ├── contest-demo/          # 参赛演示 Demo（公开）
│   │   ├── contest-interactive-demo.html  # 3D 萨卡班甲鱼互动演示
│   │   └── dual-device-demo.html          # 双端模拟多设备交互演示
│   ├── face-tracking/         # 单机面捕核心（当前推荐体验路径）
│   │   ├── index.html         # 主页面
│   │   ├── face-tracker.js    # 面部捕捉核心逻辑
│   │   ├── procedural-mesh-renderer.js    # 程序化 Avatar
│   │   └── style.css
│   └── multi-device/          # 多设备信令服务器与旧多端模式
├── android-capture/           # CheapLive Capture Android App（开源可用）
│   ├── app/src/main/java/     # Kotlin 源码
│   └── app/src/main/assets/web/  # WebView 页面（capture / receiver）
├── docs/
│   ├── POST_CONTEST_OPEN_SOURCE_DECISION.md  # 赛后开源决策
│   └── signaling-server-setup.md              # 信令服务器搭建指南
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

### ✅ 开源可用：CheapLive Capture Android App

基于 Android WebView 的面捕客户端。主要功能：

- 本地 HTTP 服务器（端口 8765），提供 `/api/status`、`/api/control`、`/events` 等端点
- Token 鉴权机制，确保局域网内安全访问
- Capture 页面：使用 MediaPipe 进行面部捕捉
- Receiver 页面：接收面捕参数并渲染虚拟形象
- 后台服务生存能力，支持锁屏状态下继续运行

**开发说明**：详见 [android-capture/README.md](android-capture/README.md)。

### 🔴 规划中：Live2D Cubism / 透明悬浮浏览器

- Live2D Cubism SDK 集成作为后续规划，当前**不能实际渲染** Live2D 模型
- 透明悬浮浏览器需依赖原生 Android 悬浮窗能力，当前纯网页版本不提供

---

## 隐私说明

- **面部捕捉数据**：由 MediaPipe 模型在你的设备本地实时计算，所有数据（关键点、表情参数）留在浏览器中，不会上传到服务器
- **摄像头画面**：仅在本地显示；单机模式不主动上传摄像头画面
- **实验性功能**（变声、旧多端模式）可能触发额外的浏览器内处理，但不会向云端上传原始音频或视频流
- **Android Capture** 在局域网内仅传输少量面捕参数，不传输摄像头视频
- **动作捕捉 Beta** 与面捕复用同一摄像头；模型仅在用户显式启用后从 APK 本地资产加载，仅传输经过校验的九个上半身关键点，不保存原始画面或关键点历史

动作捕捉范围、性能档位、协议与验证证据见 [docs/MOTION_CAPTURE_BETA.md](docs/MOTION_CAPTURE_BETA.md)，隐私/局域网边界见 [docs/PRIVACY_SECURITY.md](docs/PRIVACY_SECURITY.md)，模型来源与哈希见 [MODEL_LICENSES.md](MODEL_LICENSES.md)。

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
## 仓库

| 平台 | 地址 |
|------|------|
| GitHub | [https://github.com/SamZebrado/CheapLive](https://github.com/SamZebrado/CheapLive) |
| Gitee | [https://gitee.com/samzebrado/CheapLive](https://gitee.com/samzebrado/CheapLive) |

---
## 自定义形象开发指南

CheapLive 支持用户自定义虚拟形象。你可以借助 AI（如 ChatGPT、Claude、DeepSeek 等）创建新形象，通过满足最小接口规范即可接入。

### 最小接入接口

自定义形象只需实现以下方法，然后在 `src/face-tracking/avatar-versions.js` 中注册即可：

```javascript
class MyCustomAvatar {
  /**
   * @param {string} canvasId - 画布元素的 ID
   */
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    // 初始化你的形象
  }

  /**
   * 接收面部追踪参数，驱动形象渲染
   * @param {Object} p - 面捕参数
   * @param {number} p.eyeLeft      - 左眼开合 [0, 1]，0=闭眼
   * @param {number} p.eyeRight     - 右眼开合 [0, 1]
   * @param {number} p.eyeWideLeft  - 左眼睁大 [0, 1]
   * @param {number} p.eyeWideRight - 右眼睁大 [0, 1]
   * @param {number} p.eyeSquintLeft  - 左眼眯眼 [0, 1]
   * @param {number} p.eyeSquintRight - 右眼眯眼 [0, 1]
   * @param {number} p.mouthOpen    - 嘴张开 [0, 1]
   * @param {number} p.mouthSmile   - 微笑 [0, 1]
   * @param {number} p.mouthFunnel  - 嘟嘴 [0, 1]
   * @param {number} p.mouthPress   - 抿嘴 [0, 1]
   * @param {number} p.browLeft     - 左眉抬起 [0, 1]
   * @param {number} p.browRight    - 右眉抬起 [0, 1]
   * @param {number} p.headYaw      - 头部偏航角（度）
   * @param {number} p.headPitch    - 头部俯仰角（度）
   * @param {number} p.headRoll     - 头部翻滚角（度）
   * @param {number} p.headX        - 头部水平位置 [0, 1]
   * @param {number} p.headY        - 头部垂直位置 [0, 1]
   * @param {number} p.gazeLeftX    - 左眼视线水平 [-1, 1]
   * @param {number} p.gazeLeftY    - 左眼视线垂直 [-1, 1]
   * @param {number} p.gazeRightX   - 右眼视线水平 [-1, 1]
   * @param {number} p.gazeRightY   - 右眼视线垂直 [-1, 1]
   */
  updateParams(p) {
    // 驱动你的形象渲染
  }

  /** 处理画布尺寸变化 */
  resize() {}

  /**
   * App 模式切换（可选）
   * @param {boolean} mode - 是否进入 App 模式
   */
  setAppMode(mode) {}

  /** 清理资源 */
  destroy() {
    // 清理定时器、事件监听等
  }
}
```

### 注册形象

编辑 `src/face-tracking/avatar-versions.js`，在 `AVATAR_REGISTRY` 中添加你的形象：

```javascript
export const AVATAR_REGISTRY = {
  // ... 已有形象 ...
  'my-custom-avatar': () => {
    return import('./my-custom-avatar.js').then((m) => new m.MyCustomAvatar('avatar_canvas'));
  },
};

export const AVATAR_VERSIONS = [
  // ... 已有形象 ...
  { id: 'my-custom-avatar', name: '我的自定义形象', desc: '由 AI 辅助生成的自定义形象' },
];
```

### 推荐开发流程

1. **用 AI 生成形象代码**：将上述接口规范提供给 AI，描述你想要的形象外观和行为
2. **本地测试**：使用 `python3 -m http.server 8080` 启动本地服务器，访问 `src/face-tracking/index.html`
3. **注册上线**：在 `avatar-versions.js` 中注册后，即可在页面中切换
4. **分享交流**：欢迎通过 Issue 或 PR 分享你的自定义形象，统一格式有助于社区交流

### 参考实现

- 纺锤鲸鱼：`src/face-tracking/procedural-mesh-renderer.js` → `ProceduralSpindleWhaleAvatar`
- 球形头像：`src/face-tracking/procedural-mesh-renderer.js` → `ProceduralSphereAvatar`
- 形象注册表：`src/face-tracking/avatar-versions.js`

---
## 参与贡献

CheapLive 是为 TRAE AI 创造力大赛开发的项目，欢迎提交 Issue 和 PR。

---

> **CheapLive** - 让每个人都能成为虚拟主播。
