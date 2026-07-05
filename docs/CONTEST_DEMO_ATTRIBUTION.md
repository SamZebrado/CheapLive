# CheapLive 参赛 Demo 技术声明 / Attribution

本文档声明 CheapLive 参赛 Demo（`src/contest-demo/contest-interactive-demo.html`）使用的关键技术与第三方组件。
不夸大自研范围，不把第三方能力写成自研。

---

## 1. CheapLive 自研部分

以下功能由本项目自行实现，源码位于 `src/contest-demo/` 与 `src/face-tracking/`：

- 参赛 Demo 页面 UI、布局、交互逻辑（`contest-interactive-demo.html` / `.css` / `.js`）。
- 程序化 3D 头像渲染器 `ProceduralMeshRenderer` / `ProceduralSpindleWhaleAvatar`（`src/face-tracking/procedural-mesh-renderer.js`）：
  - 球体网格 + 纺锤鲸鱼网格的程序化建模；
  - 五官绑定到表面参数坐标；
  - 表面法线驱动的可见性、光照着色；
  - 嘴部 / 眼皮 / 虹膜 / 眉毛的实时表情渲染。
- 网格几何生成函数 `mesh-sphere.js` / `mesh-spindle-whale.js`。
- 悬浮浏览器交互 demo（拖动 / 缩放 / 编辑-显示模式切换 / 触摸穿透）。
- 内置小游戏 demo（贪吃蛇、涂鸦）。
- 变声 preset 链：使用浏览器原生 Web Audio API（BiquadFilter ×4 + DynamicsCompressor + WaveShaper + Delay + Gain + Analyser + 噪声门）实现 original / cute / robot / deep / radio 五个预设。无第三方变声库。

## 2. 第三方 / 平台组件

| 组件 | 用途 | 来源 | 许可证 | 是否需要保留 notice |
|------|------|------|--------|---------------------|
| MediaPipe Face Landmarker / Tasks Vision | 人脸 landmark / blendshapes / 头部姿态估计 | `src/face-tracking/mediapipe/vision_bundle.mjs` + `wasm/` + `face_landmarker.task`（本地打包） | Apache License 2.0 | 是（已在 `src/face-tracking/mediapipe/LICENSE` 保留） |
| Web Audio API | 浏览器音频采集、滤波、压缩、失真、延迟、噪声门 | 浏览器原生 | 浏览器原生 API（无独立许可证） | 否 |
| Canvas 2D API | 2D 程序化渲染 | 浏览器原生 | 浏览器原生 API | 否 |
| Playwright | 端到端测试 | devDependency（npm） | Apache License 2.0 | 否（仅测试用，不打包进页面） |

## 3. 页面 Tech Credits 入口

参赛 Demo 页面底部 / 设置区提供 "技术说明 / Tech credits" 入口，链接到本文档。
示例文案（页面显示用，谨慎表述）：

> Face landmark detection uses MediaPipe Face Landmarker (Apache-2.0).
> Audio effects are implemented with browser Web Audio API presets.
> Avatar rendering and contest UI are implemented in CheapLive.

不写"全部自研"、"完全原创面捕"、"专业级变声"。

## 4. 未知 / 未明确项

- 若后续引入新的第三方库，必须在此文档补充其名称、来源、许可证、是否需要 attribution。
- 当前 `__cheapLiveContestVoiceCredits` 也提供运行时 credits 信息（`window.__cheapLiveContestVoiceCredits`）。
- 如发现遗漏组件，应按 UNKNOWN 标注并尽快核实，不要凭猜测写许可证。
