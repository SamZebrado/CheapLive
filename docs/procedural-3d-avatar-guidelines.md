# 程序化 3D Avatar 模型制作规范

> CheapLive 项目积累的程序化 3D 模型经验，供参赛版和其他项目复用改造。

---

## 1. 坐标系统

本项目的坐标系统定义如下（与 `procedural-mesh-renderer.js` 实现一致）：

```text
X: 水平方向，右为正
Y: 垂直方向，Canvas 坐标系下为正（屏幕向下）
Z: 深度方向，朝相机方向为正（近大远小）
```

- 3D 模型顶点坐标在 mesh generator（如 `mesh-spindle-whale.js`）中定义，使用右手坐标系
- 投影到 Canvas 时，Y 轴方向与屏幕一致（向下为正），无需翻转
- 旋转顺序：Roll (绕 Z) → Pitch (绕 X) → Yaw (绕 Y)

---

## 2. Mesh 生成原则

### 2.1 参数化截面

每个 mesh 由一系列截面（cross-section）沿身体主轴排列组成：

```javascript
// 截面定义：每个截面有中心点 center 和椭圆半径 rx, ry
const sections = [
  { z: 0,   rx: headX, ry: headY },    // 头部
  { z: 0.3, rx: headX*0.7, ry: headY*0.7 }, // 头身过渡
  { z: 0.5, rx: 12, ry: 10 },          // 身体中部
  { z: 0.8, rx: bodyEndX, ry: bodyEndY }, // 身体末端
  { z: 1.0, rx: 1,  ry: 1  },          // 尾尖
];
```

### 2.2 rows / columns

- `rows`：截面数量，控制身体纵向细分
- `columns`：每截面圆周细分，控制横向光滑度
- 推荐：rows ≥ 18, columns ≥ 30

### 2.3 头身过渡

- 头部截面 → 身体截面应有平滑过渡，避免突变折角
- 使用插值函数（如 `lerp`）在截面之间过渡 rx, ry
- 鲼鱼/扁平动物：头部 X 宽 > Y 高；四足动物：头部 X ≈ Y

### 2.4 尾部收束

- 身体末端截面 rx/ry 应逐渐减小到 ≈ 1-2
- 尾部长度由 `bodyLength` 参数控制
- 尾段 mesh 顶点密度与身体一致，不做额外细分

### 2.5 避免的问题

- **零面积三角形**：两个相邻截面半径不能同时为 0
- **重复顶点**：同一位置不生成多个顶点
- **法线翻转**：确保背面剔除正确
- **NaN 顶点**：所有参数必须在有效范围内

### 2.6 深度排序

- 使用 Painter's Algorithm：按面片平均 Z 坐标从远到近排序
- 面片排序在 `drawMesh()` 中完成
- 半透明面片需要单独排序以避免深度问题

---

## 3. 低多边形 3D 质感

### 3.1 光照模型

使用简化的 Lambertian 光照：

```javascript
// 环境光 + 漫反射
const ambient = 0.35;
const diffuse = Math.max(0, dot(faceNormal, lightDir)) * 0.65;
const brightness = ambient + diffuse;
```

### 3.2 上/下颜色混合

- `topColor`：背部和顶部颜色
- `bottomColor`：腹部和底部颜色
- 根据面片法线 Y 分量插值：Y > 0 用 topColor，Y < 0 用 bottomColor

### 3.3 轮廓线

- 面片边缘检测：如果相邻面片的法线方向差异大，绘制轮廓线
- 轮廓线颜色：深色，alpha 0.15-0.3

### 3.4 阴影

- 底部面片比顶部暗 0.1-0.15（模拟地面阴影）
- 不做真实阴影映射

### 3.5 材质稳定性

- 颜色计算避免浮点误差导致闪烁
- Yaw 变化时不应出现颜色突变
- 光照参数使用 `clamp` 限制在 [0, 1] 范围内

---

## 4. 眼睛/嘴/眉毛面部贴合

### 4.1 核心原则

**不要把面部特征画成屏幕 2D 圆形。** 所有面部特征必须贴合 3D 表面。

### 4.2 Surface Anchor

每个面部特征（眼睛、嘴巴）有一个 3D anchor point：

```javascript
// 在头部椭球表面上计算 anchor 点
function computeFaceAnchorXYZ(rx, ry, rz, headDef) {
  // 根据左右眼位置计算椭球表面点
  const x = headX * rx * eyeOffsetX;
  const y = headY * ry * eyeOffsetY;
  // z 从椭球方程解出
  const z = headZ * rz * Math.sqrt(1 - rx*rx - ry*ry);
  return { x, y, z };
}
```

### 4.3 Normal / Tangent Basis

```javascript
// 计算椭球表面法线
function computeEllipsoidSurfaceNormal(x, y, z, rx, ry, rz) {
  return {
    nx: x / (rx * rx),
    ny: y / (ry * ry),
    nz: z / (rz * rz),
  };
}

// 从法线构建切平面
function computeTangentBasis(n) {
  // up = (0, 1, 0)，但如果法线接近(0, 1, 0)则用(0, 0, 1)
  const up = Math.abs(n.y) > 0.999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const tangentU = normalize(cross(up, n));
  const tangentV = normalize(cross(n, tangentU));
  return { tangentU, tangentV };
}
```

### 4.4 眼白是 Decal

- 眼白在切平面上生成为椭圆
- 椭圆的长轴/短轴通过 `projectSurfaceEllipse` 投影到屏幕
- 眼白随 yaw/pitch 变化为椭圆，不是固定圆形
- 眼白边缘贴合头部曲率，不漂浮在脸外

### 4.5 瞳孔必须 Clip 在眼白内

- 瞳孔是眼白内部的椭圆贴片，不是独立球体
- 使用 Canvas `clip()` 将瞳孔限制在眼白路径内
- 瞳孔随 gaze offset 移动，但不能超出眼白边界
- 瞳孔尺寸约为眼白短轴的 28-50%

### 4.6 虹膜

- 虹膜是瞳孔外层的彩色圆环
- 颜色：棕色系（`#7a6b5c`）或根据物种调整
- 虹膜约为眼白短轴的 45-55%

### 4.7 闭眼

- 闭眼时只画贴合曲面的弧线（上眼睑下缘），不画圆形眼白
- 半闭眼时眼白高度压缩，可见区域缩小
- 眨眼过渡使用 `easedOpen` 参数平滑过渡

### 4.8 嘴巴

- 嘴巴跟随头部表面和表情参数
- 上唇边缘固定在灰白交界处，不重叠到眼睛区域
- 张嘴时下唇向下移动，上唇不动

### 4.9 眉毛

- 眉毛在眼白上方，贴合头部曲率
- 眉毛随表情移动（惊讶上移、愤怒下移）

---

## 5. 参数化与 UI 调节

### 5.1 暴露参数

建议暴露以下参数给 UI：

| 参数 | 范围 | 说明 |
|------|------|------|
| bodyLength | 60-350 | 身体长度 |
| headX | 40-90 | 头部宽度 |
| headY | 35-80 | 头部高度 |
| headZ | 35-80 | 头部厚度 |
| bodyEndX | 2-25 | 身体末端宽度 |
| bodyEndY | 2-25 | 身体末端高度 |
| tailLength | 10-80 | 尾巴长度 |

### 5.2 何时 Rebuild Mesh

以下情况需要重建 mesh（调用 `createSpindleMesh()` 重新生成）：

- 身体长度、头部/身体截面参数改变
- 截面数量改变

以下情况只需更新参数，无需重建：

- 颜色/材质改变
- 表情参数改变

### 5.3 参数范围设置

- 参数范围必须防止模型断裂、尾巴消失、眼睛飞出
- `bodyLength` 最小值应保证头部 + 身体 + 尾巴可见
- `bodyEndX/Y` 最大值应小于头部尺寸

### 5.4 localStorage 保存

```javascript
// 保存
localStorage.setItem('cheaplive.avatarModelOptions', JSON.stringify(options));

// 加载
const opts = JSON.parse(localStorage.getItem('cheaplive.avatarModelOptions'));
if (opts && typeof opts === 'object') {
  avatar.setModelOptions(opts);
}
```

要求：
- 刷新页面后保留用户调节
- 重置默认清除 localStorage
- 旧配置非法时自动回退默认

---

## 6. 多动物扩展规范

### 6.1 Species Profile

每个物种定义一个 profile：

```javascript
const speciesProfile = {
  id: 'fox',
  base: 'quadruped',
  body: { length: 120, height: 48, width: 42 },
  head: { radiusX: 36, radiusY: 34, radiusZ: 38 },
  ears: { type: 'triangle', count: 2, size: 18, angle: 30 },
  tail: { type: 'fluffy', length: 70, thickness: 12 },
  legs: { count: 4, length: 38, thickness: 10 },
  eyes: { spacing: 0.45, size: 0.18, offsetY: 0.15 },
  mouth: { offsetY: -0.25, width: 0.35 },
  material: { top: '#d77a35', belly: '#f2d8aa', face: '#e8c07a' },
};
```

### 6.2 Base Mesh

- `base: 'fish'`：扁平身体，无腿，尾鳍
- `base: 'quadruped'`：四足身体，四条腿
- `base: 'bird'`：双足身体，翅膀

### 6.3 四足动物姿态映射

```javascript
// 从 bodyPose 驱动四腿
function updateLegPose(legIndex, bodyPose, isFront) {
  const phase = bodyPose * Math.PI * 2 + legIndex * Math.PI / 2;
  const kneeAngle = Math.sin(phase) * 0.5;
  const hipAngle = Math.cos(phase) * 0.3;
  return { hipAngle, kneeAngle };
}
```

### 6.4 表情映射

- 所有表情参数标准化为 [0, 1]
- `eyeOpen`：0 = 闭眼，1 = 全睁
- `mouthOpen`：0 = 闭嘴，1 = 全张
- `mouthSmile`：0 = 中性，1 = 最大微笑
- `browRaise`：0 = 中性，1 = 最大抬眉

---

## 7. 验收清单

每个新模型或修改后，必须验证以下项目：

- [ ] 正面视图正常
- [ ] Yaw 左 30° 正常
- [ ] Yaw 右 30° 正常
- [ ] Pitch 上 15° 正常
- [ ] Pitch 下 15° 正常
- [ ] 眨眼后眼睛正常恢复
- [ ] 半闭眼状态正常
- [ ] 微笑正常
- [ ] 张嘴正常
- [ ] 视线左/右/上偏移正常
- [ ] bodyLength min (60) 正常
- [ ] bodyLength max (350) 正常
- [ ] 尾巴始终可见
- [ ] 无 NaN 顶点
- [ ] 无断裂 mesh
- [ ] 无漂浮眼睛
- [ ] 颜色/材质随 yaw 变化稳定

---

## 8. 常见错误

以下是实际开发中踩过的坑：

| 错误 | 原因 | 修复 |
|------|------|------|
| 眼白漂浮在脸外 | anchor 点未贴合椭球表面 | 使用 `computeFaceAnchorXYZ` 计算表面点 |
| 瞳孔像黑球 | 瞳孔画成独立圆形，未 clip 到眼白 | 使用 `ctx.clip()` 限制在眼白路径内 |
| 身体断裂 | 截面间距过大或参数超出范围 | 增加 rows 密度，限制参数范围 |
| 尾巴消失 | bodyLength 过大导致尾端超出可视范围 | 动态调整尾巴起始位置 |
| 远侧眼过大 | 投影未考虑 yaw 角度 | 根据 facing 值缩放远侧眼 |
| 材质随 yaw 闪烁 | 浮点精度导致颜色计算不稳定 | 使用 `clamp` 限制颜色值 |
| 参数 UI 只缩放 Canvas | 未调用 `createSpindleMesh()` 重建 | 使用 `setModelOptions()` 重建 mesh |

---

## 9. 迁移到其他项目的步骤

1. **复制 renderer**：`procedural-mesh-renderer.js`（基础渲染器 + 投影逻辑）
2. **复制 mesh generator**：`mesh-spindle-whale.js`（或新建物种 mesh 文件）
3. **建立 species profile**：参考第 6 节创建物种配置
4. **绑定 UI 参数**：参考第 5 节添加 slider 控件
5. **绑定表情/姿态参数**：参考 `face-tracker.js` 的 `updateParams` 调用
6. **加截图回归**：参考第 7 节验收清单
7. **加不变量测试**：验证 mesh 顶点范围、NaN 检查、参数范围

---

## 10. 文件索引

| 文件 | 说明 |
|------|------|
| `procedural-mesh-renderer.js` | 基础渲染器、投影、光照、面片排序 |
| `mesh-spindle-whale.js` | 鲼鱼 mesh 生成、anchor 计算 |
| `face-tracker.js` | 表情追踪、参数绑定、UI 控制 |
| `index.html` | 模型参数 UI 控件 |
| `style.css` | 模型参数样式 |

---

> 最后更新：2026-06-25
> 维护者：CheapLive 项目