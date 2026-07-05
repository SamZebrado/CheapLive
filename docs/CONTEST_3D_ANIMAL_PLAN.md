# CheapLive 3D 动物扩展方案（分析文档，未实现）

> 本文档仅为分析与设计，**未实现**。当前 demo 中不存在 3D 猫/狗/兔/狐/熊，只有 3D 萨卡班甲鱼（`ProceduralSpindleWhaleAvatar`）和 2D 占位图。

## 1. 当前 3D Sacabambaspis renderer 架构

### 1.1 文件与类

- 文件：`src/face-tracking/procedural-mesh-renderer.js`
- 基类：`ProceduralMeshRenderer`（Canvas 2D 程序化渲染，**非 WebGL**）
- 子类：`ProceduralSpindleWhaleAvatar extends ProceduralMeshRenderer`
- 适配层：`src/contest-demo/contest-avatar-adapter.js`（懒加载 + 按 canvasId 缓存实例）

### 1.2 渲染管线

1. `updateParams(params)` → `draw()`
2. `draw()` 内部：`resize()` → 计算 mesh → 投影 → 绘制 body / dorsal / tail / eye / iris / eyelid / mouth / nostril
3. `resize()` 会把 `canvas.width/height` 改成 `parent.clientWidth × DPR`（**注意：会改写 canvas 像素尺寸**）
4. 没有 `requestAnimationFrame` 循环，完全由外部 `simLoop` 驱动

### 1.3 Mesh 生成

- `createSpindleMesh()` 生成纺锤形鱼体 mesh
- 参数：`headX`（头部宽）、`headY`（头部高）、`bodyLen`（体长）等
- Face anchors：`computeFaceAnchorXYZ(mesh, bodyT, horizOffset, vertOffset, surfaceOffset)` 计算面部锚点 3D 坐标
- 投影：`_transformAnchor(local, rot, originX, originY, scale)` 把 3D 锚点投影到 2D 屏幕

### 1.4 表情参数

`normalizeParams` 接收：`mouthOpen / mouthSmile / mouthFunnel / mouthPress / eyeLeft / eyeRight / headYaw / headPitch / headRoll / headX / headY / gazeLeftX/Y / gazeRightX/Y`

## 2. 可复用部分

| 模块 | 可复用性 | 说明 |
|---|---|---|
| Canvas 2D 渲染框架 | 高 | `ProceduralMeshRenderer` 基类的 `getContext('2d')` / `resize()` / `draw()` 框架可直接复用 |
| Mesh 生成 | 中 | `createSpindleMesh` 是鱼形专用；猫需要新的 `createCatMesh`，但框架可复用 |
| 投影 / transform | 高 | `_transformAnchor` / `mapFaceLocalPoint` / `buildFaceBasis` 与动物无关，可复用 |
| Face anchors | 高 | `computeFaceAnchorXYZ` 通用，只要 mesh 提供锚点即可 |
| 眼睛 / 虹膜 / 眼皮 | 高 | `drawEye` 含 blink / eyelid 不透明遮挡 / iris，与动物无关 |
| 嘴部 | 高 | `drawMouth` 已支持 smile / open / funnel，可复用 |
| 诊断 | 高 | `mouthDiag` / `eyelidDiag` 框架可复用 |
| Adapter | 高 | `contest-avatar-adapter.js` 的懒加载 + 缓存机制通用 |

## 3. 3D 猫最小可行方案

### 3.1 Mesh

- `createCatMesh()`：
  - 头部：椭球（`headX=0.4, headY=0.42`）
  - 身体：纺锤形（比鱼短粗）
  - 耳朵：两个三角锥（cone），从头顶两侧伸出
  - 鼻子：小球
  - 尾巴：可选，分段细纺锤

### 3.2 渲染

- 复用 `drawEye` / `drawMouth` / `drawNostril`
- 新增 `drawEars(mesh, ...)`：两个三角锥，跟随 head roll
- 新增 `drawWhiskers(...)`：细线
- Body shading 复用现有椭圆 + gradient

### 3.3 参数

- 与鱼共用 `normalizeParams`
- 可能新增 `earTwitch` 参数（耳朵微动）

## 4. 其他动物扩展接口设想

```js
// 接口设想（未实现）
class ProceduralCatAvatar extends ProceduralMeshRenderer {
  static createMesh() { return createCatMesh(); }
  // 复用 drawEye / drawMouth / drawNostril
  // 新增 drawEars / drawWhiskers
}

class ProceduralDogAvatar extends ProceduralMeshRenderer { /* ... */ }
class ProceduralRabbitAvatar extends ProceduralMeshRenderer { /* ... */ }
class ProceduralFoxAvatar extends ProceduralMeshRenderer { /* ... */ }
class ProceduralBearAvatar extends ProceduralMeshRenderer { /* ... */ }
```

Adapter 改造：`createContestAvatar(canvasId, type)` 按 type 选择类。

## 5. 风险

1. **视觉容易变丑**：程序化 mesh 画猫/狗容易像"塑料玩具"，需要反复调参
2. **2D/3D selection 状态复杂**：当前 `state.currentAvatar` 是字符串，3D 动物多了需要区分 `cat-3d` / `cat-2d`
3. **Performance**：每个 3D renderer 实例独立 Canvas 2D context，多实例可能掉帧
4. **Diagnostics**：每种动物可能有不同诊断字段，需要统一接口
5. **Bundle size**：所有动物类都在一个文件里会让 `procedural-mesh-renderer.js` 变大
6. **回归风险**：改动基类可能影响现有萨卡班甲鱼

## 6. 推荐实施顺序

1. ✅ 先修 2D avatar selection（本轮已完成）
2. ✅ 再补 2D blink / head position / roll（本轮已完成）
3. ⬜ 做 3D cat prototype（单独分支，最小可行，先 head + ears + eyes + mouth）
4. ⬜ 扩展其他动物（dog / rabbit / fox / bear）
5. ⬜ 性能优化（按需懒加载动物类）

## 7. 当前状态

- **未实现**任何 3D 猫 / 3D 狗 / 3D 兔 / 3D 狐 / 3D 熊
- 本轮只做了 2D 修复 + 3D 萨卡班甲鱼嘴型改善
- 本文档仅为设计参考，不代表已上线功能
