# 网格 Avatar 视觉审计

> 时间：2026-06-18
> 状态：修复完成，等待用户视觉验收

## 一、接缝来源根因（已修复）

| 来源 | 修复方式 |
|------|---------|
| **显式描边** | 删除 `ctx.stroke()` (旧 321-323 行)，仅保留 `debugShowMesh` 模式 |
| **颜色突变** | 改为顶点级平滑光照，每面取顶点颜色均值 |
| **伪背面剔除** | 改为真正的背面剔除 (`cross <= 0 → skip`)，不再用 alpha 淡化 |
| **抗锯齿裂缝** | 已删除描边，相邻面共享顶点，无独立 path 间隙 |
| **深度排序** | Painter's algorithm 在 culling 后执行，背面不穿透 |

## 二、五官驱动（已实现）

| 参数 | 效果 |
|------|------|
| `eyeLeft/eyeRight` | 1.0=睁开, 0.0=闭合, 中间值连续插值, 闭眼时绘制上眼睑 |
| `mouthOpen` | 控制开口高度, >0.15 时绘制深色口腔 |
| `mouthSmile` | 控制嘴角上扬, 影响闭嘴弧线 |
| `browLeft/browRight` | 眉毛上扬, 跟随眼睛锚点 |
| `headYaw/Pitch/Roll` | 五官跟随头部旋转, 远侧压缩, 近侧放大, 背面淡出 |

五官在模型局部坐标锚点中计算，经过与主体相同的 yaw/pitch/roll + 透视投影。

## 三、构图和取景（已修复）

- 自动 bounding box 计算 (`_computeBBox`)
- 自动 scale (`_calcAutoScale`) — 90% 安全边距
- 高 DPI backing store (`devicePixelRatio`)
- 光线增强：ambient 0.6, diffuse 0.35, 柔和阴影

## 四、旧版本清理（已完成）

| 删除项 | 操作 |
|--------|------|
| `saka` (3D纺锤体) | 从 HTML select 移除, 从 AVATAR_REGISTRY 移除 |
| `saka-whale` (鲸鱼尾巴) | 同上 |
| `sphere` (球体基础) | 同上 |
| 旧 localStorage 迁移 | `saka/saka-whale` → `mesh-spindle-whale`, `sphere` → `mesh-sphere` |
| 默认值 | `mesh-spindle-whale` (纺锤鲸鱼) |

## 五、调试信息

- `debugShowMesh = false` (默认关闭网格线)
- `debugShowLabels = false` (默认关闭参数标签)
- 仅通过 `window._a.renderer.debugShowMesh = true` 可手动开启

## 六、视觉证据

### Before
```
artifacts/mesh-avatar-before/sphere-front.png       (angleY:0, angleX:0)
artifacts/mesh-avatar-before/sphere-yaw-left.png     (angleY:-40)
artifacts/mesh-avatar-before/sphere-yaw-right.png    (angleY:40)
artifacts/mesh-avatar-before/spindle-front.png       (angleY:0, angleX:0)
artifacts/mesh-avatar-before/spindle-three-quarter.png (angleY:30, angleX:10)
artifacts/mesh-avatar-before/spindle-side.png        (angleY:-60)
```

### After
```
artifacts/mesh-avatar-after/sphere-front.png          (正面, 睁眼)
artifacts/mesh-avatar-after/sphere-blink.png          (闭眼)
artifacts/mesh-avatar-after/sphere-mouth-open.png     (张嘴)
artifacts/mesh-avatar-after/sphere-yaw-left.png       (yaw:-40)
artifacts/mesh-avatar-after/sphere-yaw-right.png      (yaw:40)
artifacts/mesh-avatar-after/sphere-both-closed.png    (闭眼+张嘴)
artifacts/mesh-avatar-after/sphere-smile.png          (微笑)

artifacts/mesh-avatar-after/spindle-front.png         (正面)
artifacts/mesh-avatar-after/spindle-blink.png         (闭眼)
artifacts/mesh-avatar-after/spindle-mouth-open.png    (张嘴)
artifacts/mesh-avatar-after/spindle-three-quarter.png (斜侧面)
artifacts/mesh-avatar-after/spindle-side.png          (侧面)
artifacts/mesh-avatar-after/spindle-tail-visible.png  (尾巴可见)
artifacts/mesh-avatar-after/spindle-smile.png         (微笑)

artifacts/mesh-avatar-after/sphere-expression-demo.webm
artifacts/mesh-avatar-after/spindle-expression-demo.webm
```

## 七、状态

代码已实现，自动测试通过，视觉材料已生成，等待用户视觉确认。