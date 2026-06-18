# Test Avatar Asset Trace

## MemorialAvatar / 纪念版皮套历史追踪

### 概述
萨卡班甲鱼和球形头像的纪念版/测试版皮套在项目早期曾经存在，
后因精简需求被从正式入口中移除。本文件记录其历史和当前状态，
供开发者在需要恢复时参考。

### 历史状态
- **原路径**: 最初的 `MemorialAvatar` 实现位于 `src/face-tracking/`
  目录下的早期版本，与 `ProceduralSpindleWhaleAvatar` /
  `ProceduralSphereAvatar` 共享类似的渲染管线
- **删除原因**: 项目方向调整，正式入口只保留两个程序化模型
- **最后存在版本**: 可在 git 历史中查询（使用 `git log --oneline --
  src/face-tracking/` 查看相关变更）

### 注册表残留
- 当前 `src/face-tracking/procedural-mesh-renderer.js` 中
  `ProceduralSpindleWhaleAvatar` 与 `ProceduralSphereAvatar` 是唯一
  公开的 Avatar 类
- 无残留的 `MemorialAvatar` 导出符号
- `window.*` 暴露仅包含上述两个类

### 恢复代码来源
如需恢复纪念版，可基于以下文件结构重建：
- `src/face-tracking/mesh-spindle-whale.js` — 萨卡班甲鱼的几何定义
- `src/face-tracking/mesh-sphere.js` — 球形头像的几何定义
- `src/face-tracking/procedural-mesh-renderer.js` — 共用渲染管线

恢复时建议：
1. 保持类名与内部 ID 兼容（避免破坏 localStorage 旧配置）
2. 将其标记为 `legacy / memorial / developer-only`
3. 不在正式 UI 主入口中显示，仅在开发者模式下可选

### UI 去重规则
正式 UI 入口（`src/face-tracking/index.html`）中仅显示：
- **萨卡班甲鱼** — `data-model="avatar"`
- **球形头像** — `data-model="sphere"`

纪念版皮套如需显示，应通过独立开发开关控制，不得混入正式 Tab 中。
