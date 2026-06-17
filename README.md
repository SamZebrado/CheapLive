# CheapLive - 便宜直播

> 一个面向移动端个人主播的零成本虚拟主播直播辅助工具。
> 无需电脑，纯浏览器端运行，让任何有手机的普通人都能成为虚拟主播。

---

## 项目简介

CheapLive（便宜直播）是一款基于纯浏览器技术栈的移动端虚拟主播工作台。它利用手机前置摄像头进行实时面部捕捉，驱动虚拟形象（Live2D / 调试形象）进行直播，并支持实时变声、隐私保护模式、局域网多端协同等功能。

### 核心特点

- **零成本**：无需购买电脑、摄像头、面捕设备，一部手机即可开播
- **纯浏览器**：HTML/CSS/JS 技术栈，无需安装 App，浏览器打开即用
- **隐私优先**：所有面部数据均在本地浏览器中处理，不上传到任何服务器；支持隐私保护模式隐藏真实画面
- **移动优先**：专为手机浏览器优化，支持前置摄像头和触屏操作
- **开源免费**：MIT 许可证，代码完全开源

### 隐私说明

- **面部捕捉数据**：由 MediaPipe 模型在你的设备本地实时计算，所有数据（关键点、表情参数）都留在你的浏览器中，不会上传到任何服务器
- **摄像头画面**：仅在本地显示，可通过"隐私保护模式"完全隐藏
- **上传的模型文件**：Live2D 模型文件仅在浏览器内存中解压和使用，刷新页面后自动清除，不会上传到任何服务器
- **多端互动数据**：通过 WebRTC DataChannel 在局域网内点对点传输，不经过任何中间服务器

---

## 技术栈

| 功能 | 技术方案 |
|------|----------|
| 面部捕捉 | MediaPipe Face Landmarker（浏览器端，52 Blendshapes + 468 关键点） |
| 虚拟形象渲染 | Live2D Cubism Web SDK（计划）/ Canvas 2D 调试形象（当前） |
| 实时变声 | Web Audio API + SoundTouchJS |
| 局域网传输 | WebRTC DataChannel（P2P，无需服务器） |
| 运行载体 | TransparentFloatingBrowser（开源 Android 悬浮浏览器，可切换） |

---

## 在线演示

**GitHub Pages**: [https://samzebrado.github.io/CheapLive/](https://samzebrado.github.io/CheapLive/)

- 参赛展示页：项目介绍、创意说明、开发路线图
- 面部捕捉演示：`src/face-tracking/index.html`（需摄像头权限）

## 快速开始

### 环境要求

- 一部带有前置摄像头的智能手机
- 现代浏览器（Chrome / Safari / Edge 最新版）
- 允许摄像头权限

### 运行方式

#### 方式一：GitHub Pages 直接打开（推荐体验）

1. 访问 [https://samzebrado.github.io/CheapLive/src/face-tracking/](https://samzebrado.github.io/CheapLive/src/face-tracking/)
2. 点击"启动摄像头"即可开始面部捕捉

#### 方式二：本地开发服务器

```bash
# 进入项目目录
cd CheapLive

# 使用 Python 启动本地服务器
python3 -m http.server 8080

# 或使用 Node.js
npx serve .

# 手机浏览器访问 http://你的电脑IP:8080/src/face-tracking/
```

#### 方式三：结合悬浮浏览器（完整体验）

1. 安装 [TransparentFloatingBrowser](https://github.com/SamZebrado/TransparentFloatingBrowser)（开源 Android 悬浮浏览器）
2. 在悬浮浏览器中打开 CheapLive 页面
3. 开启悬浮模式，即可在直播的同时操作其他 App

---

## 项目结构

```
CheapLive/
├── src/
│   └── face-tracking/          # 面部捕捉原型（当前主要开发区域）
│       ├── index.html          # 主页面
│       ├── face-tracker.js     # 面部捕捉核心逻辑
│       ├── debug-avatar.js     # 调试形象（萨卡班甲鱼）
│       └── style.css           # 样式
├── PROJECT_CHARTER.md          # 项目章程
├── CURRENT_STATUS.md           # 当前状态与交接说明
├── DECISIONS.md                # 技术决策记录
├── TASKS.md                    # 任务列表
├── AGENT_RULES.md              # 开发规则
└── README.md                   # 本文件
```

---

## 功能模块

### 已实现

- [x] **面部捕捉**：基于 MediaPipe Face Landmarker，实时检测面部关键点、Blendshapes、头部姿态
- [x] **调试形象**：Canvas 2D 绘制的萨卡班甲鱼，实时同步眨眼、张嘴、头部转动等表情
- [x] **隐私保护模式**：一键隐藏摄像头画面，仅显示虚拟形象，保护主播真实容貌
- [x] **参数面板**：实时显示眼睛、嘴巴、眉毛、头部姿态等面部参数

### 开发中 / 计划中

- [ ] **Live2D 集成**：接入 Live2D Cubism SDK，支持自定义虚拟形象
- [ ] **变声器面板**：Web Audio API + SoundTouchJS 实时变声（男变女、女变男、卡通音等）
- [ ] **WebRTC 局域网推流**：同一 WiFi 下多设备协同，手机面捕 + 电脑推流
- [ ] **悬浮窗模式**：配合 TransparentFloatingBrowser 实现悬浮窗直播
- [ ] **场景与背景**：自定义直播背景、前景道具、弹幕显示

---

## 隐私说明

CheapLive 高度重视用户隐私：

1. **纯本地处理**：所有面部捕捉和图像处理均在浏览器本地完成，不上传任何视频或面部数据到服务器
2. **无后端服务**：项目为纯前端实现，不依赖任何后端 API
3. **隐私保护模式**：提供一键切换功能，隐藏真实摄像头画面，仅展示虚拟形象
4. **开源可审计**：代码完全开源，任何人都可以审查数据处理逻辑

---

## 开发计划

| 阶段 | 目标 | 状态 |
|------|------|------|
| Phase 1 | 面部捕捉原型 + 调试形象 | 已完成 |
| Phase 2 | Live2D SDK 集成 + 自定义形象 | 计划中 |
| Phase 3 | 变声器 + 场景系统 | 计划中 |
| Phase 4 | WebRTC 多端协同 + 悬浮窗优化 | 计划中 |
| Phase 5 | 参赛展示 + 文档完善 | 进行中 |

---

## 参考与致谢

本项目基于以下优秀的开源项目和技术：

- [MediaPipe](https://mediapipe.dev/) - Google 开源的机器学习解决方案，提供 Face Landmarker
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/download-web/) - 虚拟形象渲染 SDK
- [SoundTouchJS](https://github.com/cutterbl/soundtouchjs) - 开源音频变速变调库
- [TransparentFloatingBrowser](https://github.com/SamZebrado/TransparentFloatingBrowser) - 开源 Android 悬浮浏览器，本项目的技术载体

---

## 许可证

MIT License

Copyright (c) 2025 CheapLive Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 参与贡献

CheapLive 是为 TRAE AI 创造力大赛开发的项目，欢迎提交 Issue 和 PR。

如有问题或建议，请联系项目维护者。

---

> **CheapLive** - 让每个人都能成为虚拟主播。
