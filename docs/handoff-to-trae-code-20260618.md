# CheapLive → TRAE Code 正式开发交接包

**生成日期**: 2026-06-18
**交接人**: SOLO Agent (交接前最后一轮)
**接收方**: TRAE Code

---

## 1. 项目定位

CheapLive 是一个基于浏览器的低成本虚拟形象面部捕捉工具，纯前端运行，无需后端服务。

| 项目 | 说明 |
|------|------|
| GitHub 仓库 | `https://github.com/samzebrado/CheapLive` |
| GitHub Pages | `https://samzebrado.github.io/CheapLive/` |
| 主页面 | `https://samzebrado.github.io/CheapLive/` |
| 面捕页面 | `https://samzebrado.github.io/CheapLive/src/face-tracking/index` |
| 多端页面 | `https://samzebrado.github.io/CheapLive/src/multi-device/` |
| 信令服务器 | `node src/multi-device/signaling-server.js` (HTTP/SSE, 端口 8766) |

---

## 2. 当前 Git 基线

> **重要**: Push 被 TRAE 沙箱阻止（Keychain 访问限制）。本地有 2 个新 commit 未推送到远端。以下为本地状态。

```
branch: main
本地 HEAD: d520376b5dcf0e3d2b3e9e6eab6e650e103e4e0e
GitHub main HEAD: 7ebd71a (← 比本地落后 3 个 commit)
Gitee main HEAD: (ls-remote 无输出，可能未配置 main 分支)

最近 commits:
d520376 fix: enhance mouth visibility, update tab identifier, add verification screenshots
11ef094 feat: mesh avatar visual overhaul — remove seams, add facial features, auto-fit, remove old versions
7ebd71a feat: procedural mesh dynamic demos and Cubism SDK infrastructure
9443002 fix: add audio track tests, CDN audit, security context banners
d1ecc09 fix: add WebRTC connected state E2E tests
```

**工作区状态**: 有未暂存修改（`artifacts/procedural-sphere/` 和 `artifacts/procedural-spindle-whale/` 目录下的 webm 文件，为测试运行产物，非源码）。

**Push 状态**: 失败。TRAE 沙箱阻止 `osxkeychain` credential helper 访问。需要用户在 IDE 设置中调整沙箱配置后手动 push。

---

## 3. 当前功能状态矩阵

| 功能 | 状态 | 关键文件 | 测试文件 | 已知限制 |
|------|------|---------|---------|---------|
| MediaPipe 面捕 | A | `src/face-tracking/face-tracker.js` | `tests/e2e/smoke.test.js` | 依赖 CDN 加载 wasm |
| 球形头像 (mesh-sphere) | B | `src/face-tracking/procedural-mesh-renderer.js` | `tests/e2e/mesh-visual.test.js` | Canvas 2.5D 渲染，非真实 3D；用户视觉验收待确认 |
| 纺锤鲸鱼 (mesh-spindle-whale) | B | `src/face-tracking/procedural-mesh-renderer.js` | `tests/e2e/mesh-visual.test.js` | 同上 |
| 五官和表情 (眼睛/嘴巴/眉毛) | B | `src/face-tracking/procedural-mesh-renderer.js` | `tests/e2e/mesh-visual.test.js` | 嘴巴可见度已增强，仍待用户确认 |
| 头部姿态 (yaw/pitch/roll) | B | `src/face-tracking/procedural-mesh-renderer.js` | `tests/e2e/mesh-visual.test.js` | 五官跟随头部转向已实现 |
| 旧 Avatar 清理 | A | `src/face-tracking/avatar-versions.js` | `tests/e2e/mesh-visual.test.js` | saka/saka-whale/sphere 已移除 |
| 变声器 | C | `src/face-tracking/voice-changer.js` | `tests/e2e/voice-changer.test.js` | 生产页面调用链未完整验证 |
| 变声监听模式 | C | `src/face-tracking/voice-changer.js` | 同上 | 同上 |
| 原始麦克风推流 | C | `src/multi-device/` | `tests/e2e/audio-track.test.js` | 测试使用 fake device，真实设备未验证 |
| 变声音频推流 | C | `src/multi-device/` | 无 | 未确认变声输出是否接入 WebRTC |
| HTTP/SSE 设备发现 | B | `src/multi-device/signaling-server.js` | `tests/e2e/multi-device.test.js` | 无配对鉴权；HTTPS 页面可能 mixed content 阻止 |
| WebRTC DataChannel | B | `src/multi-device/` | `tests/e2e/webrtc-connected.test.js` | connected 状态被动检测 |
| WebRTC 音频 track | C | `src/multi-device/` | `tests/e2e/audio-track.test.js` | remote audio track 实际接收未验证 |
| 多接收端 | C | `src/multi-device/` | 无 | 未专项测试 |
| Live2D ZIP/文件夹导入 | D | `src/face-tracking/index.html` | 无 | UI 入口存在，后端未实现 |
| Cubism Core | E | `src/face-tracking/cubism-loader.js` | 无 | SDK 文件受许可证约束，未提交 |
| Cubism Framework | E | `src/face-tracking/cubism-runtime.js` | 无 | 同上 |
| Cubism 模型实际渲染 | E | `src/face-tracking/face-to-cubism-mapper.js` | 无 | 当前仅为纹理占位图 |
| 透明悬浮浏览器 | E | 无 | 无 | 未实现 |

**状态说明**:
- A: 生产代码已接入，稳定自动测试通过
- B: 生产代码已接入，但测试不完整或存在 flaky
- C: 代码部分实现，用户运行链路尚未接通
- D: 仅接口、骨架、占位或文档
- E: 未实现
- F: 真实设备待验证

---

## 4. 已知关键缺陷

### 测试体系
- `smoke.test.js` 是独立 Node/Playwright 脚本，不属于统一的 Playwright Test reporter
- `package.json` 当前测试脚本不一定覆盖完整 E2E
- 历史报告中的 68 tests 数字是人工汇总
- 历史正确口径至少需要重新核算
- **flaky 不得算作 stable pass**

### WebRTC
- 检查 `connect_request` 是否导致重复创建和发送 offer
- 页面关闭资源释放测试存在过弱断言
- "无资源泄漏"测试目前只检查连接数量，覆盖不足
- **真实跨设备局域网尚未验证**

### 音频
- 部分测试直接调用内部函数，未通过真实 UI
- "默认关闭"历史测试曾使用固定 null 并恒真
- "无重复 track"历史断言曾允许最多两条
- `replaceTrack()` 是否正确 await
- 先开启麦克风同步、后启动面捕的时序是否能正确开始音频
- **当前多端音频是否仍然发送原始麦克风，而非变声输出**

### 变声器
- 生产页面是否真正调用 `VoiceChanger.start(stream)`
- 测试是否直接导入生产 `voice-changer.js`，不得测试复制类
- `getProcessedStream()` 是否受本地监听 gain 影响
- "听原声但远端听变声"和"本地静音但远端听变声"必须独立
- **真实麦克风和听感尚未验证**

### Cubism
- `cubism-loader.js`、`cubism-runtime.js` 和 `mapper` 属于未验证代码时，必须标为骨架
- 当前主页面是否实际创建 `CubismRuntime`
- `draw()` 是否仍只是绘制纹理占位
- 未加载有效 `.moc3` 和 `.model3.json` 时，不得称为 Live2D 接入完成
- SDK 文件受许可证约束，不得随意提交

### 局域网部署
- GitHub Pages 页面默认连接 `hostname:8766` 是否实际可用
- HTTPS 页面请求 HTTP 信令服务可能被 mixed content 阻止
- 真实使用可能要求本地同时运行静态服务器和 Node 信令服务器
- README 中"无后端服务""GitHub Pages 直接使用"等描述是否与现架构冲突
- 当前信令服务没有完整配对鉴权

### Push 状态
- 本地有 2 个新 commit 未推送到 GitHub
- TRAE 沙箱阻止 Keychain 访问，需要用户手动 push

---

## 5. 自动测试清单

### 测试结果汇总（2026-06-18 实际执行）

| 测试文件 | 框架 | discovered | stable passed | failed | skipped | flaky | 是否测试生产代码 | 是否通过真实 UI |
|---------|------|-----------|--------------|--------|---------|-------|----------------|---------------|
| `tests/e2e/smoke.test.js` | Playwright | 21 | 21 | 0 | 0 | 0 | 是 | 是 |
| `tests/e2e/copy-clipboard.test.js` | Playwright | 18 | 18 | 0 | 0 | 0 | 是 | 是 |
| `tests/e2e/mesh-visual.test.js` | Playwright | 6 | 6 | 0 | 0 | 0 | 是 | 是 |
| `tests/e2e/before-screenshots.test.js` | Playwright | 6 | 6 | 0 | 0 | 0 | 是 | 是 |
| `tests/e2e/after-screenshots.test.js` | Playwright | 6 | 6 | 0 | 0 | 0 | 是 | 是 |
| `tests/e2e/voice-changer.test.js` | Playwright | 8 | 6 | 0 | 2 | 0 | 部分 | 否（调用内部函数） |
| `tests/e2e/webrtc-connected.test.js` | Playwright | 8 | 7 | 0 | 0 | 1 | 是 | 是 |
| `tests/e2e/audio-track.test.js` | Playwright | 6 | 5 | 0 | 0 | 1 | 是 | 是 |
| `tests/e2e/multi-device.test.js` | Playwright | 21 | 未完整运行 | 未完整运行 | 未完整运行 | 未完整运行 | 是 | 是 |
| `tests/e2e/procedural-demo.test.js` | Playwright | 3 | 未完整运行 | 未完整运行 | 未完整运行 | 未完整运行 | 是 | 是 |

**注意**: `multi-device.test.js` 和 `procedural-demo.test.js` 因信令服务器依赖，在本次交接中未完整运行。完整测试结果建议在启动信令服务器后重新运行。

### 测试执行命令

```bash
# 全部测试
npx playwright test --reporter=list

# 分模块测试
npx playwright test tests/e2e/smoke.test.js --reporter=list
npx playwright test tests/e2e/copy-clipboard.test.js --reporter=list
npx playwright test tests/e2e/mesh-visual.test.js --reporter=list
npx playwright test tests/e2e/voice-changer.test.js --reporter=list
npx playwright test tests/e2e/webrtc-connected.test.js --reporter=list
npx playwright test tests/e2e/audio-track.test.js --reporter=list

# 视觉测试（需要先启动信令服务器）
npx playwright test tests/e2e/multi-device.test.js --reporter=list
npx playwright test tests/e2e/procedural-demo.test.js --reporter=list
```

---

## 6. 当前视觉任务证据

### Before 基线
| 文件 | 路径 |
|------|------|
| sphere-front.png | `artifacts/mesh-avatar-before/sphere-front.png` |
| sphere-yaw-left.png | `artifacts/mesh-avatar-before/sphere-yaw-left.png` |
| sphere-yaw-right.png | `artifacts/mesh-avatar-before/sphere-yaw-right.png` |
| spindle-front.png | `artifacts/mesh-avatar-before/spindle-front.png` |
| spindle-three-quarter.png | `artifacts/mesh-avatar-before/spindle-three-quarter.png` |
| spindle-side.png | `artifacts/mesh-avatar-before/spindle-side.png` |

### After 截图
| 文件 | 路径 |
|------|------|
| sphere-front.png | `artifacts/mesh-avatar-after/sphere-front.png` |
| sphere-blink.png | `artifacts/mesh-avatar-after/sphere-blink.png` |
| sphere-mouth-open.png | `artifacts/mesh-avatar-after/sphere-mouth-open.png` |
| sphere-yaw-left.png | `artifacts/mesh-avatar-after/sphere-yaw-left.png` |
| sphere-yaw-right.png | `artifacts/mesh-avatar-after/sphere-yaw-right.png` |
| spindle-front.png | `artifacts/mesh-avatar-after/spindle-front.png` |
| spindle-blink.png | `artifacts/mesh-avatar-after/spindle-blink.png` |
| spindle-mouth-open.png | `artifacts/mesh-avatar-after/spindle-mouth-open.png` |
| spindle-three-quarter.png | `artifacts/mesh-avatar-after/spindle-three-quarter.png` |
| spindle-side.png | `artifacts/mesh-avatar-after/spindle-side.png` |

### After 动态演示
| 文件 | 路径 |
|------|------|
| sphere-expression-demo.webm | `artifacts/mesh-avatar-after/sphere-expression-demo.webm` |
| spindle-expression-demo.webm | `artifacts/mesh-avatar-after/spindle-expression-demo.webm` |

### 验证截图
| 文件 | 路径 |
|------|------|
| sphere-front.png | `artifacts/verification/sphere-front.png` |
| sphere-blink.png | `artifacts/verification/sphere-blink.png` |
| sphere-mouth-open.png | `artifacts/verification/sphere-mouth-open.png` |
| sphere-yaw-left.png | `artifacts/verification/sphere-yaw-left.png` |
| sphere-yaw-right.png | `artifacts/verification/sphere-yaw-right.png` |
| sphere-debug-mesh.png | `artifacts/verification/sphere-debug-mesh.png` |
| spindle-front.png | `artifacts/verification/spindle-front.png` |
| spindle-blink.png | `artifacts/verification/spindle-blink.png` |
| spindle-mouth-open.png | `artifacts/verification/spindle-mouth-open.png` |
| spindle-yaw-left.png | `artifacts/verification/spindle-yaw-left.png` |
| spindle-yaw-right.png | `artifacts/verification/spindle-yaw-right.png` |

**用户视觉验收**: 仍待确认。不得自行宣布视觉合格。

---

## 7. 运行和开发命令

以下命令已经过实际验证：

```bash
# 安装依赖
cd CheapLive
npm install

# 启动静态服务器（本地开发）
npx http-server . -p 8765 --cors

# 启动信令服务器（多端互动需要）
node src/multi-device/signaling-server.js

# 运行完整测试
npx playwright test --reporter=list

# 运行单个测试文件
npx playwright test tests/e2e/smoke.test.js --reporter=list

# 查看 GitHub Pages
# 浏览器打开: https://samzebrado.github.io/CheapLive/
```

---

## 8. 下一阶段推荐任务顺序

**固定顺序，不得自行重新规划大方向**：

1. **修复并统一测试体系** — 第一个任务
2. 修复 WebRTC 重复协商与资源释放
3. 把音频测试改为真实 UI 和生产代码测试
4. 打通 VoiceChanger 真实运行链路
5. 将变声输出接入多端音频推流
6. 修复局域网部署和 GitHub Pages/本地服务边界
7. 完成真实 Cubism SDK 和模型接入
8. 最后处理透明悬浮浏览器后台摄像头恢复

---

## 9. 严格禁止事项

TRAE Code 后续不得：

- 把 mock 测试算成生产功能完成
- 复制生产类到测试文件中测试
- 把 DOM 存在性当成交互通过
- 用固定 true 或宽松集合让测试必过
- 把 flaky 计作通过
- 把 Canvas 模型称为 Live2D
- 把 Cubism 纹理占位图称为模型渲染
- 未查看截图就宣布视觉通过
- 未真实达到 connected 就称 WebRTC 成功
- 未收到 remote audio track 就称音频闭环完成
- 未 push 就报告远端已更新
- **重做当前已完成的视觉修复**
- 在未核实代码前采信历史完成状态

---

## 10. 当前最准确状态

- 代码已实现：网格 Avatar 视觉修复（接缝消除、五官添加、旧版本清理、自动取景）
- 自动测试通过：smoke (21)、copy-clipboard (18)、mesh-visual (6)、视觉截图 (12)
- 视觉材料已生成：before/after 截图 + webm 动态演示
- 用户视觉确认：待确认
- Push 状态：本地有 2 个新 commit，被 TRAE 沙箱阻止推送
- 工作区：有少量未暂存文件（测试产物，非源码）

**未验证项**:
- 真实设备端到端验证
- 真实摄像头面捕下的五官驱动
- 手机竖屏/横屏自动取景
- 真实 WebRTC 跨设备音频
- 变声器生产链路
- Cubism SDK 实际模型加载
- 透明悬浮浏览器
- GitHub Pages 混合内容问题