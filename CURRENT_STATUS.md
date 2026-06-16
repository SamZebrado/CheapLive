# CheapLive 当前状态

## 已完成功能

- [x] 项目章程制定
- [x] 技术路线调研（MediaPipe、Web Audio API、WebRTC、Live2D SDK）
- [x] GitHub Pages 参赛展示页
- [x] AGENT_RULES.md 项目规则
- [x] Git 仓库初始化（main 分支，3 个 commit）
- [x] 浏览器端面部捕捉原型（MediaPipe Face Landmarker）
  - [x] 模型加载（GPU 加速）
  - [x] 摄像头权限获取
  - [x] 468 个面部关键点检测
  - [x] 9 个面部参数可视化（眼睛、嘴巴、眉毛、头部姿态）
  - [x] FPS 计数器

## 正在进行的任务

- [ ] 手搓 Canvas 调试小人（用于测试面捕参数驱动）
- [ ] Live2D 模型渲染原型
- [ ] 面捕参数到 Live2D 模型的映射

## 已知问题

- 网络不通，无法 push 到 GitHub/Gitee（需用户手动 push）
- 浏览器环境无摄像头，无法验证真实面捕效果
- 需要手搓调试模型替代 Live2D 进行早期测试
- Live2D Cubism Web SDK 许可证需确认

## 当前可运行版本

- `src/face-tracking/index.html` — 面部捕捉原型
  - 启动方式：`python3 -m http.server 8080 --directory src/face-tracking/`
  - 访问地址：`http://localhost:8080`

## 最近一次测试结果

- [已运行本地测试] MediaPipe 模型加载成功（WebGL 2.0 GPU 加速）
- [已运行本地测试] 页面 UI 渲染正常
- [未验证] 真实摄像头画面下的面捕效果
- [未验证] 面捕参数准确性

---

## 交接记录

### 当前 Work Agent（Trae Work）
- 负责：产品需求、技术调研、任务拆解、文档整理、原型设计
- 限制：无法直接操作 git push（需用户或 Code Agent 执行）
- 限制：无法直接访问 MCP 工具（需在 IDE 中配置）

### 建议 Code Agent 任务
1. **手搓 Canvas 调试小人** — 用 Canvas 绘制简单人形，根据面捕参数实时变形
2. **Live2D SDK 集成** — 加载官方 SDK，确认许可证，实现基础模型显示
3. **Git 推送** — 将本地 commit 推送到 GitHub/Gitee
4. **设备测试** — 在真实手机/电脑上测试面捕效果

### Code Agent 接手前必读
1. `AGENT_RULES.md` — 项目最高优先级规则
2. `PROJECT_CHARTER.md` — 项目目标和边界
3. `DECISIONS.md` — 已确定的技术决策
4. `TASKS.md` — 当前任务定义
5. `CURRENT_STATUS.md` — 本文件（当前状态）
