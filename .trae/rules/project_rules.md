# CheapLive Project Rules (Agent 自动加载)

> 每个 agent 在操作本项目时必须遵守以下规则。
> 详细规范见 `docs/agent-rules/` 下的独立文档。

## 快速索引

| 规则文档 | 内容 |
|----------|------|
| [global-safety-rules.md](../../docs/agent-rules/global-safety-rules.md) | 授权透明 + 禁止隐藏高风险 Git 操作 |
| [cheaplive-isolation-rules.md](../../docs/agent-rules/cheaplive-isolation-rules.md) | public main / Android 私有分支 / contest demo 隔离 |

## 关键规则摘要

1. 高风险 Git 操作必须单独请求授权（checkout / reset / stash pop / rebase 等）
2. dirty worktree 上禁止切分支
3. Android 私有代码禁止带入 public main
4. `git add .` 禁止
5. commit 前必须输出 `git diff --cached --name-only`
6. push 前必须说明 remote / branch
