# CheapLive Contest Demo 开发日志

> 本文件从 2026-07-05 起建立。
> 不补编历史。只记录从现在开始的开发事实。
> 每轮任务完成后必须追加一条日志。

---

## 当前 Contest Demo 基本信息

| 项 | 值 |
|---|---|
| 线上地址 | `https://samzebrado.github.io/CheapLive/src/contest-demo/contest-interactive-demo.html` |
| 工作区 | `CheapLive_demo_full_regression_repair/` |
| 分支 | `demo-full-regression-repair` |
| source-of-truth | `src/contest-demo/contest-interactive-demo.js` 等 |

---

## 当前相关 commits

| SHA | 说明 | 用户验收 |
|-----|------|---------|
| `0569e00` | voice + floating 第一轮修复 | ❌ 未通过 |
| `c2e4271` | voice silence / floating / iris 修复 | ❌ 用户实测不通过（虹膜变小点、悬浮仍不透明） |
| `a935929` | restore floating transparency and iris panel consistency | ⏳ 待验证 |

---

## 当前用户实测未通过项

1. 悬浮浏览器 edit mode 背景仍不透明（c2e4271 只改了 CSS，3D renderer 没有 transparentMode）
2. display mode 只是半透明（c2e4271 仍有 opacity）
3. 虹膜被缩成小点（c2e4271 的 3D 路径 irisBaseR 漏乘 scale）
4. 主 panel 与右侧 panel 虹膜比例不一致（待验证）
5. 变声纯音是否消失仍需真实听感验证

---

## a935929 修复内容（待验证）

### 悬浮透明
- 给 `ProceduralMeshRenderer` 基类添加了 `transparentMode` 属性和 `setTransparentMode()` 方法
- `draw()` 中 `transparentMode=true` 时跳过 `fillRect` 背景，只 `clearRect`
- fwAvatarCanvas 初始化时已调用 `setTransparentMode(true)`，现在 3D renderer 有了这个方法，会生效
- CSS 已在 c2e4271 设置 `background: transparent`

### 虹膜大小
- 3D 路径 `irisBaseR` 从 `eyeBase * 0.50` 改为 `eyeHalfW * 0.50`
- `eyeHalfW = eyeBase * scale`，所以现在 3D 路径 iris radius 和 baseline 0569e00 正脸 neutral 一致
- 2D fallback 路径不受影响（`eyeBase = 10 * scale` 已包含 scale）

### Panel 一致性
- 两个 canvas 使用同一 `ProceduralSpindleWhaleAvatar` 类、同一 `drawEye` 函数、相同 params
- 相对比例应该一致，但需 runtime 验证

---

## 日志条目格式

每条开发记录使用以下格式：

```md
## YYYY-MM-DD HH:mm - Task name

### Context
### Files changed
### Tests run
### Evidence
### Commit / push
### Verified
### Not verified
### Next
```

---

## 未验证项

- [ ] 变声纯音真实听感验证
- [ ] 悬浮窗真实像素级 alpha 验证
- [ ] 虹膜默认大小视觉验证（是否恢复到好看版本）
- [ ] 虹膜 radius stability 验证
- [ ] 虹膜 movementNotSizePass 验证
- [ ] 主 panel vs 右侧 panel irisRatioToHead 一致性验证
- [ ] 线上 GitHub Pages 部署后验证
- [ ] Android 正式仓库 CONFIRMED
- [ ] Android 真机视觉同步验证
