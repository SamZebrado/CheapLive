# Git 与沙箱操作规则

本文件定义 Git 操作规范、沙箱问题处理流程和环境区分要求。

## 1. Git 操作规则

### 1.1 基本规范

- 默认不自动 Push
- 默认不强制 Push
- Commit 前检查 diff
- 一个 Commit 对应一个原子目标
- 大规模修改前创建备份分支
- 不覆盖仍可运行的稳定版本
- 未经授权不修改历史 Commit

### 1.2 Push 前检查

Push 前先确认：

- 工作区干净
- 本地 HEAD 比远程多提交
- 无远程独有提交（不存在 `<` 开头的 left-right 日志行）

### 1.3 双远程同步

每个仓库的 GitHub 和 Gitee remote 名称与分支映射由用户指定，执行 push 时应按各仓库的实际配置推送两个远程。

不要假设 GitHub remote 叫 origin，也不要假设 Gitee remote 叫 gitee，更不要假设分支一定是 main——Gitee 仓库的默认分支可能是 master。

### 1.4 历史分叉处理

发现远程与本地历史分叉（`merge-base --is-ancestor` 返回非零，且 left-right 日志有 `<` 开头的行）时，立即停止并报告原始错误，不要自行 merge、rebase 或 force push，等待用户决策。

### 1.5 TRAE 沙箱 Push 问题

TRAE 沙箱环境下 HTTPS push 依赖 `osxkeychain` credential helper，沙箱可能阻止对 Keychain 的访问。

遇到 `failed to get: 100001` + `TRAE Sandbox Error: hit restricted` + `Not allow operate files: .../login.keychain-db` 时，说明沙箱阻止了 Keychain 访问，不是网络或认证配置问题。

遇到 credential helper 卡住（`git credential-osxkeychain get` 阻塞）且 `TERM=dumb` 时，不要反复重试，不要切换 HTTPS/SSH，不要裸运行 credential helper，也不要声称 `ls-remote` 成功等于认证成功。先做只读诊断，确认本地 HEAD、远程 SHA、upstream 配置。

## 2. 沙箱问题处理

### 2.1 换终端策略

同一会话中，不同终端的沙箱行为可能不一致。某个终端失败时，换一个新终端再试。

不要在沙箱诊断上花费过多时间——换终端、重开对话是最快的解法。

### 2.2 配置路径

TRAE 沙箱配置路径：`Settings -> Conversation -> Custom Sandbox Configuration`。这是 IDE 层面的设置，不在项目目录内。

沙箱问题应由用户在 IDE 设置中解决，Agent 不要越权修改 Keychain、全局 Git 配置、remote URL 或 SSH key。

## 3. 环境区分

必须清晰区分：

- host environment（宿主机环境）
- active virtual environment（活跃虚拟环境）
- cloud/VM/sandbox environment（云/虚拟机/沙箱环境）

不要把不同环境的事实混为一个总结。

## 4. 工作目录管理

### 4.1 目录划分

- **临时工作目录**（中间产物）：`/sessions/6a30eac13c4dbd647dcdf02c/work`
- **最终工作区**（最终交付物）：`/sessions/6a30eac13c4dbd647dcdf02c/workspace`

### 4.2 文件存放规则

| 类型 | 存放位置 |
|------|---------|
| 临时脚本、草稿、测试文件、调试输出 | `/sessions/.../work` |
| 用户请求的交付物 | `/sessions/.../workspace` |
| 交付物使用的资源（图片等） | `/sessions/.../workspace` |
| 处理脚本 | `/sessions/.../work` |
| 处理结果 | `/sessions/.../workspace` |

不要向 workspace 投放临时处理脚本或调试文件。

## 5. 产物与源码一致性

### 5.1 必须区分的对象

- 本地工作区
- 当前分支
- 当前提交
- 构建产物
- 打包文件
- 用户实际拿到的附件
- 审核者实际看到的文件

### 5.2 检查要求

如果没有亲自检查产物，就不能写：

- 当前附件已经包含这些修改
- 当前包就是最新版本
- 用户拿到的就是我刚改好的版本

如果修改只存在于工作区，还没有重新打包或重新构建，就必须明确写：

- 修改已在本地完成，但产物尚未重新生成或复核

## 6. 命令执行偏好

### 6.1 后台执行优先

对于可能耗时较长的命令（构建、文件处理、网络操作、网页测试等），默认使用后台执行模式，避免阻塞对话。

前台执行仅用于快速操作（如简单的文件查看、目录列表）。

### 6.2 具体场景

| 场景 | 执行方式 |
|------|---------|
| 构建命令（gradlew 等） | 后台 |
| 大型文件操作 | 后台 |
| 网络操作 | 后台 |
| 快速查询（ls、git status） | 前台 |

### 6.3 浏览器使用规则

- 优先使用已打开的专用 profile
- 避免频繁开关浏览器
- 后台执行浏览器操作
- 复用现有浏览器实例
