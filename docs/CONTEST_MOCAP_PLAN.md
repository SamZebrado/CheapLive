# CheapLive Contest Demo 动作捕捉方案

> 本文档记录 contest demo 中动作捕捉（mocap）的当前状态和后续计划。

## 1. 当前状态

**状态：shell only / unavailable**

- UI 有"动作捕捉"开关，默认 off。
- 点击开关后状态为 `unavailable`，因为本地没有 Pose/Hand landmarker 模型。
- 不使用 CDN，不引入外部资源。
- face tracking 不受影响。
- 不崩溃。

**不写"动作捕捉已完成"。当前只有 UI shell。**

## 2. 资源情况

| 资源 | 是否存在 | 路径 |
|------|---------|------|
| Face Landmarker | ✅ 是 | `src/face-tracking/mediapipe/face_landmarker.task` |
| Pose Landmarker | ❌ 否 | 未安装 |
| Hand Landmarker | ❌ 否 | 未安装 |
| Tasks Vision bundle | ✅ 是 | `src/face-tracking/mediapipe/vision_bundle.mjs` |

## 3. Diagnostics

```javascript
window.__cheapLiveContestMocapDiag = {
  enabled: false,          // 是否开启
  status: 'off',           // off | loading | active | unavailable | error
  source: 'local-mediapipe',
  hasPoseLandmarker: false,
  hasHandLandmarker: false,
  modelAssetsPresent: false,
  noCdn: true,             // 不使用 CDN
  lastFrameAt: null,
  poseLandmarkCount: 0,
  handLandmarkCount: 0,
  averageLatencyMs: 0,
  error: null,
  fallbackReason: 'Pose/Hand landmarker models not installed locally'
}
```

## 4. 后续实现计划

### 4.1 最小可行方案

如果要实现真实动作捕捉：

1. 下载 MediaPipe Pose Landmarker 模型（`.task` 文件）到 `src/face-tracking/mediapipe/pose_landmarker.task`
2. 下载 MediaPipe Hand Landmarker 模型到 `src/face-tracking/mediapipe/hand_landmarker.task`
3. 在 `toggleMocap()` 中 lazy-load Tasks Vision，创建 PoseLandmarker / HandLandmarker
4. 复用现有 camera/video frame loop
5. 成功时显示轻量骨架/关键点 overlay 或 diagnostics
6. 关闭后释放资源，不继续推理

### 4.2 性能风险

- Pose/Hand landmarker 会增加 CPU/GPU 负载
- 移动端可能掉帧
- 需要测试平板性能
- 建议默认 off，用户手动开启

### 4.3 与 face tracking 的关系

- mocap 和 face tracking 使用不同的 landmarker
- 可以同时运行，但性能开销加倍
- 建议分时复用 camera frame

### 4.4 为什么默认 off

- 性能保护
- 资源未安装时避免误导用户
- 实验功能，不保证稳定

## 5. 许可证

- MediaPipe Tasks Vision: Apache License 2.0
- 如果引入 Pose/Hand 模型，需在 `docs/CONTEST_DEMO_ATTRIBUTION.md` 补充声明

## 6. 禁止事项

- 不要把只有 UI 的 shell 写成"动作捕捉已完成"
- 不要用 CDN 加载模型
- 不要引入许可证不明的库
- 不要在资源缺失时假装成功
