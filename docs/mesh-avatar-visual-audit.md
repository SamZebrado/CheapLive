# 网格 Avatar 视觉审计

> 时间：2026-06-18

## 一、接缝来源

| 来源 | 文件 | 行号 | 说明 |
|------|------|------|------|
| **显式描边** | `procedural-mesh-renderer.js` | 321-323 | `ctx.stroke()` + `strokeStyle` + `lineWidth=0.5` 对每个面绘制深色轮廓线 |
| **颜色突变** | `mesh-sphere.js` | 214-274 | `computeSphereFaceColor` 对每个面独立计算 flat-shading，相邻面法向量差异导致颜色跳变 |
| **颜色突变** | `mesh-spindle-whale.js` | 511-552 | 同上，`computeSpindleFaceColor` 每面独立计算 |
| **伪背面剔除** | `mesh-sphere.js` | 272 | `alpha: face.vertices[0].tz > -mesh.radius*0.8 ? 1 : 0.4` 用 alpha 淡化背面，而非真正剔除 |
| **伪背面剔除** | `mesh-spindle-whale.js` | 550, 591 | 同上，`alpha: face.vertices[0].tz > -50 ? 1 : 0.35` |
| **抗锯齿裂缝** | `procedural-mesh-renderer.js` | 198-199 | 每个面独立 `beginPath()/fill()`，无顶点外扩，相邻面在 Canvas 抗锯齿下产生 1px 细缝 |
| **深度排序** | `procedural-mesh-renderer.js` | 191 | Painter's algorithm 按 `avgZ` 排序，但背面未被剔除，导致背面穿透 |

## 二、五官缺失来源

| 参数 | 传入 | 渲染 | 说明 |
|------|------|------|------|
| `eyeLeft` | ✓ (Avatar 包装类存储) | ✗ | `ProceduralMeshRenderer.draw()` 从未绘制眼睛 |
| `eyeRight` | ✓ | ✗ | 同上 |
| `mouthOpen` | ✓ | ✗ | 同上 |
| `mouthSmile` | ✓ | ✗ | 同上 |
| `browLeft` | ✓ | ✗ | 同上 |
| `browRight` | ✓ | ✗ | 同上 |
| `headYaw/Pitch/Roll` | ✓ | ✓ | 映射到 `angleX/Y/Z`，但仅用于网格旋转 |
| `headX/headY` | ✓ | ✓ | 映射到 `offsetX/offsetY` |

**根因：`ProceduralMeshRenderer` 只包含网格绘制逻辑，没有五官绘制。`ProceduralSphereAvatar` 和 `ProceduralSpindleWhaleAvatar` 包装类存储了五官参数但从未传递给渲染器绘制。**

## 三、构图和裁切

| 问题 | 位置 | 说明 |
|------|------|------|
| 固定 scale=1 | `procedural-mesh-renderer.js:196` | 无自动 bounding box 计算 |
| 固定 fov=800, zOffset=200 | `procedural-mesh-renderer.js:57-58` | 无自动调整 |
| 无 devicePixelRatio 处理 | 全局 | Canvas 尺寸 = CSS 尺寸，无高 DPI |
| 无安全边距 | 全局 | 模型可能裁切到边缘 |

## 四、旧版本依赖

| ID | 类 | 文件中 | 保留？ |
|------|------|------|------|
| `saka` | `DebugAvatar` | `debug-avatar.js` | 删除 |
| `saka-whale` | `WhaleTailAvatar` | `avatar-versions.js` | 删除 |
| `sphere` | `SphereAvatar` | `avatar-versions.js` | 删除 |
| `saka-memorial` | `MemorialAvatar` | `avatar-versions.js` | 保留 |
| `mesh-sphere` | `ProceduralSphereAvatar` | `procedural-mesh-renderer.js` | 保留，改为默认 |
| `mesh-spindle-whale` | `ProceduralSpindleWhaleAvatar` | `procedural-mesh-renderer.js` | 保留，改为默认 |
| `live2d-cubism` | 包装对象 | `avatar-versions.js` | 保留 |