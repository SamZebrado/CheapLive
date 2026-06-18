# TRAE Code 启动 Prompt — CheapLive 项目

> **说明**: 这是一个可完整复制到 TRAE Code 的执行 prompt。请严格按照以下步骤执行，不要自行重新规划。

---

## 前置步骤

```bash
# 1. 克隆仓库
git clone https://github.com/samzebrado/CheapLive.git
cd CheapLive

# 2. 确认你在正确的 commit 上
git checkout main
git fetch origin
git rev-parse HEAD
# 预期 HEAD: b86508bbe6dbfb52fabe68133544b311c003192a
# 如果本地 HEAD 与 GitHub 远端不一致，以 GitHub 远端为准：
# git reset --hard origin/main

# 3. 确认工作区干净
git status --short
# 预期只有少量 artifacts 测试产物

# 4. 安装依赖
npm install
```

## 第一步：阅读交接文件

请先完整阅读 `docs/handoff-to-trae-code-20260618.md`，理解：

- 项目定位和当前真实可运行入口
- 功能状态矩阵（A–F 分级）
- 已知关键缺陷
- 测试清单
- 严格禁止事项

## 第二步：只读审计

在开始任何修改之前，请先完成只读审计：

1. 运行 `git log --oneline -15` 确认历史
2. 运行 `git status --short` 确认工作区状态
3. 浏览 `src/` 目录结构
4. 浏览 `tests/` 目录结构
5. 查看 `playwright.config.js` 配置

**不要在这个阶段做任何修改。**

## 第三步：运行现有测试

```bash
# 运行不依赖信令服务器的测试
npx playwright test tests/e2e/smoke.test.js --reporter=list
npx playwright test tests/e2e/copy-clipboard.test.js --reporter=list
npx playwright test tests/e2e/mesh-visual.test.js --reporter=list
npx playwright test tests/e2e/voice-changer.test.js --reporter=list
npx playwright test tests/e2e/webrtc-connected.test.js --reporter=list
npx playwright test tests/e2e/audio-track.test.js --reporter=list
```

记录：
- 每个测试文件的 discovered、passed、failed、skipped、flaky
- 不要继承历史报告的数字
- 将结果保存到 `test-results/trae-code-audit/`

## 第四步：第一个任务 — 统一并修复自动测试体系

这是你的第一个实际任务，也是最高优先级任务。

目标：
1. 统一所有测试到 Playwright Test runner
2. 确保 `package.json` 的 `test` 脚本覆盖所有 E2E 测试
3. 修复 flaky 测试（webrtc-connected 和 audio-track 各 1 个 flaky）
4. 修复 voice-changer 测试：必须使用生产代码，不要测试复制类
5. 确保 `multi-device.test.js` 在启动信令服务器后可以运行
6. 重新核算测试总数，不使用人工汇总数字

## 后续任务顺序（固定，不得重排）

1. **修复并统一测试体系** ← 当前任务
2. 修复 WebRTC 重复协商与资源释放
3. 把音频测试改为真实 UI 和生产代码测试
4. 打通 VoiceChanger 真实运行链路
5. 将变声输出接入多端音频推流
6. 修复局域网部署和 GitHub Pages/本地服务边界
7. 完成真实 Cubism SDK 和模型接入
8. 最后处理透明悬浮浏览器后台摄像头恢复

## 每个阶段的要求

每个阶段完成后：
1. `git add` + `git commit` 提交修改
2. `git push` 推送到 GitHub
3. 提供远端 SHA
4. 确认工作区干净
5. 更新 `docs/` 中的状态记录

## 严格禁止事项

- 不得把 mock 测试算成生产功能完成
- 不得复制生产类到测试文件中测试
- 不得把 DOM 存在性当成交互通过
- 不得用固定 true 或宽松集合让测试必过
- 不得把 flaky 计作通过
- 不得把 Canvas 模型称为 Live2D
- 不得把 Cubism 纹理占位图称为模型渲染
- 不得未查看截图就宣布视觉通过
- 不得未真实达到 connected 就称 WebRTC 成功
- 不得未收到 remote audio track 就称音频闭环完成
- 不得未 push 就报告远端已更新
- **不得重做当前已完成的视觉修复**
- **不得在未核实代码前采信历史完成状态**

## 遇到阻塞时

- 低风险、可逆、结论明确的修改：直接执行
- 遇到阻塞时：只阻塞对应任务，不要停掉所有工作
- 不确定时：明确标注"未验证"，不要自行下结论
- 如果 Push 被沙箱阻止：报告给用户，继续其他任务

## 核心原则

- 证据优先，结论从严
- 区分不同层级的完成度（代码已写 ≠ 端到端验证通过）
- 宁可少说，不可说满
- 任何正面结论都必须附带边界
- 使用证据标签：[已阅读]、[已修改]、[已核对]、[已运行静态检查]、[已运行本地测试]、[已运行集成测试]、[已运行端到端测试]、[未验证]