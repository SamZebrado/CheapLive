# CheapLive Android 工作流日志

> 本文件从 2026-07-05 起建立。
> 记录 Android 仓库身份审计、同步路径、真机验证。
> 不补编历史。

---

## Android 仓库身份审计（2026-07-05）

### 候选目录

| 候选路径 | applicationId | WebView 加载 | 有 assets | 证据强度 |
|----------|---------------|-------------|-----------|----------|
| `CheapLive/android-capture` | `com.cheaplive.capture` | `file:///android_asset/web/capture/index.html` | ✅ | LIKELY |
| `CheapLive-verify/android-capture` | `com.cheaplive.capture` | 同上 | ✅ | LIKELY |

### 设备状态

| 项 | 值 |
|---|---|
| 设备 ID | `bbda35e` |
| 已安装包 | `com.cheaplive.capture` v0.1.0 |
| lastUpdateTime | 2026-07-03 |
| installerPackageName | null |

### 未确认事项

1. ❓ 哪个 `android-capture` 目录是正式工作流
2. ❓ 两个候选 applicationId 相同，remote 相同，如何区分
3. ❓ `CheapLive/` 分支名 `migration/android-source-from-verify` 是否意味着 verify 已废弃
4. ❓ `android-capture/` 被 gitignore（"Android APP 已冻结 2026-06-20"），是否意味着 Android 项目已停止
5. ❓ 设备上安装的是哪个版本构建的

### 确认方法（待执行）

- [ ] 对比两个 `android-capture` 目录的 git log 和最近修改时间
- [ ] 对比 assets 中的网页文件版本
- [ ] 检查 APK 的 build timestamp 与设备安装时间
- [ ] 用户明确确认

---

## Android 同步规则

1. **网页端验收通过后才能同步**：不准把未验收的视觉逻辑同步到 Android
2. **正式仓库 CONFIRMED 后才能修改**：没有 CONFIRMED 就动 Android = 本轮 FAIL
3. **WebView 加载路径确认**：远程 GitHub Pages 还是本地 assets
4. **assets source-of-truth 确认**：如果加载本地 assets，确认哪个是 source-of-truth
5. **真机验证**：没有设备就写"未验证"，不能写 PASS
6. **分轨 commit**：网页修复和 Android 同步分开 commit

---

## 同步记录

（暂无同步记录，等待正式仓库 CONFIRMED）

---

## 未验证项

- [ ] Android 正式仓库身份 CONFIRMED
- [ ] Android WebView 加载路径确认
- [ ] Android assets source-of-truth 确认
- [ ] Android 真机视觉验证
