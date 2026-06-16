# CheapLive 重要决策记录

## 已确定决策

### 1. 纯网页技术栈（2026-06-16）
- **决策**：所有核心功能（面捕、变声、多端传输）均采用纯浏览器技术实现
- **原因**：降低部署复杂度，无需额外 APP，跨平台兼容性好
- **影响**：性能受浏览器限制，但足以满足基础需求

### 2. MediaPipe Face Landmarker 作为面捕方案（2026-06-16）
- **决策**：使用 MediaPipe Face Landmarker（@mediapipe/tasks-vision）
- **原因**：浏览器端运行、GPU 加速、输出 Blendshapes（52 个表情系数）、Apache 2.0 许可证
- **替代方案**：TensorFlow.js FaceMesh（已否决，Blendshapes 支持不如 MediaPipe）

### 3. Web Audio API + SoundTouchJS 作为变声方案（2026-06-16）
- **决策**：使用 Web Audio API 进行实时音频处理，SoundTouchJS 进行音高变换
- **原因**：纯浏览器端，无需后端服务
- **限制**：音质和延迟不如原生方案，作为备选功能

### 4. WebRTC DataChannel 作为多端传输方案（2026-06-16）
- **决策**：使用 WebRTC DataChannel 传输面捕参数
- **原因**：P2P 直连，局域网内零延迟，无需公网服务器
- **挑战**：需要解决信令交换问题（计划用二维码/手动输入 SDP）

### 5. Live2D Cubism Web SDK 作为渲染方案（2026-06-16）
- **决策**：使用 Live2D 官方 Web SDK
- **原因**：官方支持，文档完善
- **待确认**：许可证条款（需查阅 SDK 使用协议）

### 6. TransparentFloatingBrowser 作为悬浮载体（2026-06-16）
- **决策**：基于现有开源项目继续开发，而非重写
- **原因**：已有成熟悬浮窗口能力，节省开发时间
- **澄清**：悬浮浏览器是技术载体，未来其能力将内化为 CheapLive 组件
