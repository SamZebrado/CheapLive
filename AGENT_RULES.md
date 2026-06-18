# AGENT_RULES —— legacy redirect

本文件保留为旧 Agent 实现兼容；它不是当前项目规则的活跃来源。

当前 **唯一规则入口** 是 [`AGENTS.md`](./AGENTS.md)。

产品路线与技术边界的唯一来源是 [`rules/product-roadmap.md`](./rules/product-roadmap.md)。

## 为什么 redirect

此前本文件自称"最高优先级"，包含以下已过时的开发优先级：

- 优先 Live2D 模型显示；
- 优先透明悬浮显示；
- 将单端面捕放在次级。

这与当前产品主线（GitHub Pages → 程序化 Canvas Avatar）不一致，也与近期真实提交路径不一致。

为避免旧 Agent 继续以该路径为准则，本文件不再作为活跃规则文档，仅保留 redirect 声明。

## 新规则入口的内容概览

- 角色分工：开发 Work / 开发 Code / 清理 Code；
- 证据标签和防夸大约束；
- Git 与沙箱 Push 处理；
- Runtime validation gate（真实入口、构造顺序、跨文件契约）；
- Prompt 编写固定结构；
- 产品路线冻结项（Live2D、透明悬浮、移动端多端 Phase 2、音频、多设备协作）。

全部在 [`AGENTS.md`](./AGENTS.md) 中集中索引。
