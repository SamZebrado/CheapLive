# CheapLive 任务列表

## 当前任务：浏览器端面部捕捉原型

### 目标
实现一个可在浏览器中运行的面部捕捉原型，使用摄像头获取面部数据，并输出基础面部参数（眨眼、张嘴、头部转动等）。

### 修改范围
- 新建 `src/face-tracking/` 目录
- 新建 `src/face-tracking/index.html`（演示页面）
- 新建 `src/face-tracking/face-tracker.js`（核心逻辑）
- 新建 `src/face-tracking/style.css`（样式）

### 禁止修改范围
- 不修改现有 `index.html`（参赛展示页）
- 不修改 `AGENT_RULES.md`
- 不引入后端服务

### 验收标准
1. [ ] 页面能请求摄像头权限并显示视频流
2. [ ] MediaPipe Face Landmarker 能成功加载并运行
3. [ ] 能实时输出至少 3 个面部参数（如：左眼开合、右眼开合、嘴巴开合）
4. [ ] 参数以可视化方式展示（如进度条或数值）
5. [ ] 在 Chrome 浏览器中能正常运行

### 验证命令
```bash
# 启动本地 HTTP 服务器
python3 -m http.server 8080 --directory src/face-tracking/
# 然后用浏览器打开 http://localhost:8080
```

### 交付格式
- 一个可独立运行的 HTML 页面
- 所有依赖通过 CDN 引入

---

## 待办任务

### 任务 2：Live2D 模型渲染原型
- 使用 Live2D Cubism Web SDK 加载并显示模型
- 支持透明背景

### 任务 3：面捕参数驱动 Live2D
- 将 MediaPipe 输出的 Blendshapes 映射到 Live2D 模型参数
- 实现实时驱动

### 任务 4：WebRTC 局域网传输原型
- 实现两台设备间的面捕参数传输
- 使用二维码交换 SDP

### 任务 5：Web Audio API 变声原型
- 实现基础音高变换
- 实时音频处理
