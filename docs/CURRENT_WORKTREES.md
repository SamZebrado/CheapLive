# CheapLive 当前 Worktree 与分支身份

> 最后更新：2026-07-05
> 本文件可提交，作为跨 worktree 的公共参考。

---

## Worktree 身份表

| 路径 | git repo | branch | remote | 用途 | 最近相关 commit | 是否正式入口 | 风险 |
|------|----------|--------|--------|------|-----------------|-------------|------|
| `CheapLive/` | 是 | `migration/android-source-from-verify` | origin + gitee（同一仓库） | 正式主仓库 | `4d88ca4` | ✅ 是 | 有未提交修改（android-capture assets） |
| `CheapLive_demo_full_regression_repair/` | 是 | `demo-full-regression-repair` | origin + gitee（同一仓库） | 参赛 Demo 回归修复 | `a935929` | ✅ 当前工作区 | 当前活跃 |
| `CheapLive-verify/` | 是 | `contest-private-app-web-control` | origin + gitee（同一仓库） | 旧验证分支 | `7867e33` | ❌ 旧分支 | 有未提交修改，AGENTS.md 是旧版 |
| `CheapLive-main/` | ❌ 不是 | - | - | - | - | ❌ 旧拷贝 | 不是 git repo |
| `CheapLive_public_demo_release/` | 是 | `public-demo-release` | origin + gitee（同一仓库） | 旧 public demo 发布 | `4d20190` | ❌ 旧发布分支 | 已被本工作区取代 |
| `CheapLive_online_regression_fix/` | 是 | `online-regression-fix` | origin + gitee（同一仓库） | 旧在线回归修复 | `c975c10` | ❌ 旧修复分支 | 已被本工作区取代 |

---

## Android 候选

| 候选路径 | applicationId | WebView 加载 | assets 网页副本 | 证据强度 | 说明 |
|----------|---------------|-------------|----------------|----------|------|
| `CheapLive/android-capture` | `com.cheaplive.capture` | `file:///android_asset/web/capture/index.html` | 有 | **LIKELY** | 在正式主仓库内，但 .gitignore 标记 "Android APP 已冻结" |
| `CheapLive-verify/android-capture` | `com.cheaplive.capture` | 同上 | 有 | **LIKELY** | 在 verify 分支，可能是旧版 |

### 设备状态

| 项 | 值 |
|---|---|
| 设备 ID | `bbda35e` |
| 已安装包 | `com.cheaplive.capture` v0.1.0 (versionCode=1) |
| lastUpdateTime | 2026-07-03 |
| installerPackageName | null（adb install） |

### 未确认事项

- ❓ 哪个 `android-capture` 目录是正式工作流
- ❓ 设备上安装的是哪个版本构建的
- ❓ `CheapLive/` 分支名 `migration/android-source-from-verify` 是否意味着从 verify 迁移过来后 verify 已废弃
- ❓ `android-capture/` 被 gitignore（"Android APP 已冻结 2026-06-20"），是否意味着 Android 项目已停止

---

## 备注

- 所有 git 仓库都是同一个 GitHub/Gitee 仓库 `SamZebrado/CheapLive` 的不同分支
- `CheapLive-main/` 不是 git repo，可能是早期下载的 zip 解压
- 正式主仓库 `CheapLive/` 的分支名是 `migration/android-source-from-verify`，不是 `main`
- `android-capture/` 在正式主仓库和本工作区都被 gitignore
