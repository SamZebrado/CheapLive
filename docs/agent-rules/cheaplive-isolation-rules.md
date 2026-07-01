# CheapLive 项目专用规则｜public main / Android 私有分支 / contest demo 隔离

> CheapLive 项目的 public main、contest demo、Android 私有开发分支、audio 分支必须严格隔离。
> 违反隔离规则可能导致私有代码泄露到公开仓库。

## 1. 分支隔离原则

| 分支 / 区域 | 允许操作 | 禁止操作 |
|-------------|---------|---------|
| `main` (public) | 只在干净 main worktree 做 cleanup | 带 Android 私有代码入 main |
| `migration/android-source-from-verify` (Android 私有) | audio / capture / face 开发 | 带 public cleanup 改动 |
| `src/contest-demo/` | 只改 contest demo 三个文件 | 带到 Android 分支 |
| `src/face-tracking/` | 只读参考 | 改 face-tracking 源文件 |

## 2. 禁止清单

- 不允许为了切任务在 dirty worktree 里 `git checkout`；
- 不允许把 Android 私有文件带入 public main；
- 不允许把 contest demo 修改混入 Android audio commit；
- 不允许 `git add .`；
- 不允许 `git push origin main` 带 Android 私有代码；
- 不允许 stage 任何超出本轮允许列表的文件。

## 3. Commit 前必须检查

每次 commit 前必须输出：

```bash
git diff --cached --name-only
```

如果 staged 文件不在本轮允许列表内，必须立刻停止。

## 4. Push 前必须检查

Push 前必须说明：

- remote 名称（origin / gitee / 其他）
- 目标分支名称
- 禁止误推 public main

```bash
# 允许
git push origin migration/android-source-from-verify

# 禁止（除非本轮任务明确要求且用户授权）
git push origin main
```

## 5. 任务间切换

如果要在 public main 和 Android 私有分支间切换：

```bash
# 正确：使用独立 worktree
git worktree add /tmp/cheaplive-main-worktree main
cd /tmp/cheaplive-main-worktree
# 在干净 worktree 中操作 main

# 错误：在 dirty repo 中直接 checkout
git checkout main  # 禁止
```

## 6. Staged 文件范围检查

每次 commit 前，agent 必须将 staged 文件列表与本轮允许修改的文件列表对比。

如果出现以下文件，立刻停止：
- `README.md`（除非明确允许）
- `index.html`（除非明确允许）
- `src/face-tracking/`（除非明确允许）
- Android 私有文件出现在 public main commit 中
- Contest demo 文件出现在 Android audio commit 中
