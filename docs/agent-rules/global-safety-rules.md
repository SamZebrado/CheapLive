# 全局开发安全规则｜授权透明 + 禁止隐藏高风险 Git 操作

> 适用所有项目、所有 agent、所有 session。
> 这是所有 agent 必须遵守的最低安全标准。

## 1. 授权请求必须先说明内容和理由

在请求用户授权前，必须用自然语言明确说明：

1. 你要执行什么命令；
2. 为什么需要执行；
3. 会影响哪些文件 / 分支 / 工作区；
4. 是否会改变 git 状态；
5. 是否可能覆盖、丢弃、回滚、移动、删除、重写用户当前工作；
6. 如果命令失败，下一步不会自动做什么破坏性恢复。

不能只贴一串命令让用户授权。

## 2. 高风险命令必须单独请求授权

以下命令属于高风险 Git 操作，禁止混在其它命令串里：

- `git checkout`
- `git switch`
- `git reset`
- `git restore`
- `git stash`
- `git stash pop`
- `git clean`
- `git merge`
- `git rebase`
- `git cherry-pick`
- `git revert`
- `rm -rf`
- `mv` 覆盖已有文件
- `cp` 覆盖已有文件

如果确实需要执行，必须单独请求一次授权，并说明：

- 当前分支；
- 当前 `git status --short`；
- 是否有未提交修改；
- 是否有 untracked 文件；
- 该命令会修改什么；
- 为什么没有更安全的替代方案。

## 3. 禁止把 checkout / reset / stash pop 藏在组合命令里

禁止这种写法：

```bash
git status && git checkout main && git stash pop && npm test
```

禁止这种写法：

```bash
echo "checking branch"; git checkout xxx; git status
```

禁止这种写法：

```bash
cd repo && git checkout branch && git pull && ...
```

高风险命令必须单独一条请求，不能夹在普通命令中。

## 4. 默认禁止在 dirty worktree 上切分支或恢复文件

如果 `git status --short` 非空，默认禁止执行：

- `git checkout`
- `git switch`
- `git restore`
- `git reset`
- `git stash pop`
- `git merge`
- `git rebase`
- `git cherry-pick`

除非用户明确授权，并且 agent 已经说明风险和备份方案。

## 5. 需要切分支时，优先使用干净 worktree

如果要处理不同分支的任务，默认不要在同一个 dirty repo 中切来切去。

优先方案：

```bash
git worktree add <new-clean-worktree> <branch>
```

然后在干净 worktree 中操作。

不要在已有脏工作区里为了方便直接 checkout。

## 6. stash 规则

默认禁止使用：

```bash
git stash pop
```

如必须使用，必须先：

```bash
git stash list
git status --short
git diff --name-only
```

并说明：

- 要 pop 哪一个 stash；
- stash 里包含哪些文件；
- 当前工作区是否干净；
- 如果产生冲突如何停止；
- 不会自动解决冲突；
- 不会删除备份。

更安全的做法优先使用：

```bash
git show stash@{N} --name-only
git diff stash@{N}
git checkout <stash-commit> -- <specific-file>
```

只恢复明确文件，不整体 stash pop。

## 7. 文件恢复必须精确到文件

禁止：

```bash
git checkout .
git restore .
git reset --hard
```

除非用户明确要求整体回滚。

恢复文件时必须明确列出文件：

```bash
git checkout <commit> -- path/to/file
```

并且只能恢复本轮任务允许修改的文件。

## 8. 授权请求格式

以后请求授权时必须使用这个格式：

```
【请求授权】

目的：
...

将执行的命令：
...

影响范围：
  分支：
  文件：
  是否修改工作区：
  是否修改 index/staging：
  是否可能覆盖未提交修改：

为什么需要：
...

风险：
...

替代方案：
...

确认后我只执行上面这些命令，不会追加 checkout / reset / stash pop / clean / rm -rf 等额外命令。
```

## 9. 任何超出授权内容的命令必须重新请求授权

用户授权的是"这一次列出的命令"，不是授权 agent 自由发挥。

如果后续发现需要执行新命令，尤其是高风险 Git 操作，必须停止并重新请求授权。

## 10. 违反规则时的处理

如果 agent 已经执行了未明确授权的 checkout / reset / stash pop / restore / clean / rm -rf，必须立刻停止，并只做只读诊断：

```bash
pwd
git branch --show-current
git status --short
git log --oneline --decorate -10
git reflog --date=local -30
git stash list
git diff --name-only
git diff --name-only --diff-filter=U
git ls-files --others --exclude-standard
```

不要继续修复，不要自动恢复，不要继续 commit/push。
