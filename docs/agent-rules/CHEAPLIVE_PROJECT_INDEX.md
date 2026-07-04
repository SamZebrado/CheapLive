# CheapLive 项目文档索引

> 本文件是 CheapLive 项目的可提交文档总入口。
> AGENTS.md 是本地敏感文件（gitignore），不提交；本文件可提交，作为跨 worktree / 跨 agent 的公共入口。
>
> 最后更新：2026-07-05

---

## 1. 必读文档顺序

新 Agent 接手任务前，按以下顺序阅读：

| 顺序 | 文档 | 位置 | 说明 |
|------|------|------|------|
| 1 | AGENTS.md（本地敏感，不提交） | `CheapLive/AGENTS.md` | 最高优先级规则，三 Agent 角色定义 |
| 2 | 开发与验收手册 | `CheapLive/docs/CHEAPLIVE-DEV-README.md` | 萨卡班甲鱼头像开发入门、数学模型、踩坑记录 |
| 3 | 隔离规则 | `CheapLive/docs/agent-rules/cheaplive-isolation-rules.md` | public/Android/contest demo 隔离规则 |
| 4 | 本文件 | 本工作区 `docs/agent-rules/CHEAPLIVE_PROJECT_INDEX.md` | 项目文档索引 |
| 5 | 当前 worktree 表 | 本工作区 `docs/CURRENT_WORKTREES.md` | 所有 worktree/分支身份 |
| 6 | Contest Demo 日志 | 本工作区 `docs/CONTEST_DEMO_LOG.md` | 参赛 Demo 修复记录 |
| 7 | Android 工作流日志 | 本工作区 `docs/ANDROID_WORKFLOW_LOG.md` | Android 仓库身份与同步记录 |
| 8 | 开发日志 | 本工作区 `docs/DEVELOPMENT_LOG.md` | 通用开发日志 |

---

## 2. 仓库与 worktree 总览

| 项 | 值 |
|---|---|
| 正式主仓库 | `/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive` |
| 正式主分支 | `migration/android-source-from-verify` |
| GitHub remote | `origin` → `github.com/SamZebrado/CheapLive` |
| Gitee remote | `gitee` → `gitee.com/samzebrado/CheapLive` |
| GitHub Pages | `https://samzebrado.github.io/CheapLive/` |
| 参赛 Demo 地址 | `https://samzebrado.github.io/CheapLive/src/contest-demo/contest-interactive-demo.html` |
| 当前 contest demo 修复工作区 | `CheapLive_demo_full_regression_repair/`（分支 `demo-full-regression-repair`） |

详细 worktree 表见 [CURRENT_WORKTREES.md](../CURRENT_WORKTREES.md)。

---

## 3. 当前 source-of-truth

| 组件 | source-of-truth | 说明 |
|------|----------------|------|
| 网页 contest demo | `src/contest-demo/contest-interactive-demo.js` | 参赛 Demo 主逻辑 |
| 网页 contest demo 样式 | `src/contest-demo/contest-interactive-demo.css` | 参赛 Demo 样式 |
| 3D 渲染器 | `src/face-tracking/procedural-mesh-renderer.js` | 程序化 Avatar 渲染核心 |
| Avatar 适配器 | `src/contest-demo/contest-avatar-adapter.js` | contest demo 专用 adapter |
| E2E 回归测试 | `tests/e2e/contest-layout-regression.test.cjs` | Playwright 回归测试 |
| Android WebView assets | **UNKNOWN** | 尚未确认正式 Android 仓库 |
| Android 正式仓库 | **UNKNOWN / LIKELY** | 候选见 ANDROID_WORKFLOW_LOG.md，未 CONFIRMED |

---

## 4. AGENTS.md 引用的缺失文件

以下文件在 `CheapLive/AGENTS.md` 中被引用，但实际不存在：

| 引用路径 | 状态 | 影响 |
|----------|------|------|
| `docs/agent-rules/CHEAPLIVE_AGENT_HARD_RULES.md` | MISSING | Agent 硬规则文档缺失 |
| `docs/architecture/CHEAPLIVE_PRODUCT_PATH.md` | MISSING | 产品路径文档缺失 |
| `docs/quality/P0_BLOCKER_GATE.md` | MISSING | P0 Blocker Gate 文档缺失 |
| `docs/demo/PUBLIC_CONTEST_DEMO_READINESS.md` | MISSING | 公开 Demo 标准缺失 |
| `docs/demo/HOME_ENTRY_SOURCE_OF_TRUTH.md` | MISSING | 首页入口规则缺失 |
| `rules/prompt-structure.md` | gitignore（本地存在但不提交） | 含 ChatGPT 引用 |

这些文件可能是计划中但未创建，或路径已变更。需要用户确认是否要创建。

---

## 5. 强制规则摘要

以下规则从 AGENTS.md 和用户指令中提炼，适用于所有 Agent：

1. **先读日志再改代码**：每轮任务开始前必须读取本索引和相关 LOG
2. **不清楚正式目录不得同步**：Android 正式仓库未 CONFIRMED 前，不得修改 Android 代码
3. **本地 PASS 不能写线上 PASS**：GitHub Pages 部署后的验证才算线上验证
4. **UI PASS 不能写功能 PASS**：静态检查/截图不能替代功能验证
5. **未验证项必须明确写未验证**：不准把推测写成事实
6. **多 worktree 修改前必须确认分支和路径**：`pwd && git branch --show-current && git status --short`
7. **禁止危险 Git 命令**：reset/checkout/restore/clean/stash/rebase/force push 未经授权不得使用
8. **每轮任务后必须写日志**：不写日志 = 任务未完成

---

## 6. 当前待验收问题（截至 2026-07-05）

| 问题 | 状态 | 详情 |
|------|------|------|
| 变声纯音 | 代码已改，待验证 | c2e4271 移除 oscillator，需真实听感确认 |
| 悬浮浏览器透明 | 代码已改，待验证 | a935929 给 3D renderer 加了 transparentMode，需像素级验证 |
| 虹膜默认大小 | 代码已改，待验证 | a935929 修复 3D 路径漏乘 scale，需视觉验证 |
| 虹膜 panel 一致性 | 待验证 | 主 panel 和右侧 panel 需确认相对比例一致 |
| Android 同步 | 未开始 | 正式仓库未 CONFIRMED |

详细记录见 [CONTEST_DEMO_LOG.md](../CONTEST_DEMO_LOG.md)。
