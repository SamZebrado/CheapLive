# CheapLive · 萨卡班甲鱼 头像 — 开发与验收手册

> 面向自动化 Agent：如果你是接到"继续改萨卡班甲鱼"任务的新 Agent，请从这里开始。

---

## 1. 项目文件总览

仓库根：`/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive`

关键前端文件（全部位于 `src/face-tracking/`）：

| 文件 | 作用 | 必须读的行 |
|---|---|---|
| `index.html` | 页面入口；引入 face-tracker.js 和样式 | `<canvas>` + test buttons 段 |
| `style.css` | 页面样式（小改动即可影响布局） | `.avatar-controls` |
| `face-tracker.js` | 主逻辑：按钮事件、参数、调用渲染器 | 测试按钮事件处理、`updateParams` |
| `mesh-spindle-whale.js` | **核心几何**：参数化曲面 (s, θ) → (x, y, z) + 法线 | `getSection`、`createSpindleMesh`、`computeFaceAnchorXYZ`、`deformSpindle` |
| `mesh-sphere.js` | 备用球体头像（同样的程序化渲染逻辑） | `createSphereMesh`、`computeSphereFaceAnchorXYZ` |
| `procedural-mesh-renderer.js` | **渲染核心**：Canvas 2D 背面剔除 + 光照 + 五官绘制 | `ProceduralSpindleWhaleAvatar._render`、`_drawMesh`、`_drawFaceFeatures` |

> 每次接手任务先重新跑一遍语法检查：`node --check src/face-tracking/xxx.js`。

---

## 2. 如何在本地查看效果

```bash
cd /Users/samzebrado/Documents/PersonalCodingLocal/CheapLive/src/face-tracking
python3 -m http.server 8000   # 或任何可用端口（如 9876）
```
浏览器打开 `http://localhost:8000/index.html`，页面上方可见：
- 左/右/抬头/低头姿势测试按钮（无需摄像头，直接改参数驱动旋转）
- canvas 中央绘制鱼形

---

## 3. 核心数学模型（必须理解，否则会把形状搞砸）

### 3.1 坐标系约定

- **X**：屏幕水平（右为正）
- **Y**：屏幕垂直（**下为正**，Canvas 坐标）
- **Z**：屏幕深度（**+z = 朝向摄像机/近**，-z = 远离摄像机）
- 身体主轴沿 **Z**：鼻端在 **+Z**，尾端在 **-Z**

### 3.2 形状方程（参数化曲面）

鱼形由参数 `s ∈ [0, 1]`（沿主轴，0=鼻端，1=尾端）和 `θ ∈ [-π, π]`（绕主轴一圈）驱动：

```
x(s, θ) = rx(s) · cos(θ)
y(s, θ) = yBend(s) + ry(s) · sin(θ)
z(s)      = headZ - s · (headZ + bodyLength)
```

其中 `rx(s)`、`ry(s)` 由 **radiusScale(s)** 决定：

```
HEAD_T_END = 0.22   // 头部最大半径位置
MID_T       = 0.55  // 肩部/上身结束位置

if s <= HEAD_T_END:
  // 头部：半圆膨胀 — 鼻端 r=0，头最鼓处 r=headX/headY
  u = s / HEAD_T_END
  r = sqrt(1 - (1-u)^2)

elif s <= MID_T:
  // 肩部：smoothstep 从 1 降到 0.72（缓慢收窄，形成鱼雷躯干）
  eased = smoothstep((s - HEAD_T_END) / (MID_T - HEAD_T_END))
  r = 1*(1-eased) + 0.72*eased

else:
  // 尾部：smoothstep 从 0.72 快速收尖到 0.04（尾鳍前）
  eased = smoothstep((s - MID_T) / (1 - MID_T))
  r = 0.72*(1-eased) + 0.04*eased

rx = headX * r
ry = headY * r * (0.88 + 0.12*r)   // 身体略扁，头更圆
```

`yBend(s)`：尾端 `s > TAIL_BEND_START=0.72` 时，脊柱向 **-Y**（屏幕上方）轻微上翘，平滑过渡。

### 3.3 曲面法线 ——**这里极容易搞砸！**

切向量（用数值差分计算 `radiusScaleDeriv`）：

```
T_θ = ∂p/∂θ = (-rx·sinθ,  ry·cosθ,  0)
T_s = ∂p/∂s = (rx'·cosθ, yBend' + ry'·sinθ, z')
```

法线 = **T_s × T_θ**（**T_s 叉乘 T_θ，顺序不能反**）：

```
nx = T_s.y · T_θ.z - T_s.z · T_θ.y
ny = T_s.z · T_θ.x - T_s.x · T_θ.z
nz = T_s.x · T_θ.y - T_s.y · T_θ.x
```

然后归一化。

⚠️ **关键陷阱（2025-06-20 已发生过一次）**：
如果写成 **T_θ × T_s**（顺序反了），整个头部正面半球的 nz 将为**负值**，被背面剔除（`_drawMesh` 中 `avgNz > -0.05` 才绘制）——结果就是"**萨卡班甲鱼整个儿看不见了**"。

### 3.4 鼻端特殊处理

s→0 时 rx→ry→0，导致 T_θ → 零向量，叉乘结果也为零。归一化时会除零，法线变成 NaN 或零向量。所以在 `s < 0.02` 时直接设 `n = (0, 0, 1)`（朝摄像机）。

---

## 4. 背面剔除与可见性

`procedural-mesh-renderer.js` 的 `_drawMesh`：

- 对每个四边形面，计算 4 个顶点的平均 nz
- 如果 `avgNz / nLen < -0.05`，跳过（认为背面）
- 否则按 depth 排序，按 isTop/isBottom 决定灰度/白色上色
- faceWeight 决定面部颜色过渡（面部略亮）

常见 bug：

1. **法线全为零或 NaN** → 整面被判定为"不确定"，随机画或不画，导致图像有洞。
2. **法线符号整体反了** → 所有正面都被剔除，用户看到"什么都没有"。
3. **yBend 或 z(s) 改变但忘了同步更新 yBend' / z'** → 法线方向错。
4. **deformSpindle 中 yaw 旋转矩阵方向**：确保你的旋转方向与用户意图一致（"向右旋转"= 鱼的右侧转向摄像机）。

---

## 5. 五官绘制逻辑（眉、眼、嘴、鼻孔）

`_drawFaceFeatures` 对每个五官做如下流程：

1. 用 `computeFaceAnchorXYZ(mesh, {}, horizOffset, vertOffset, surfaceOffset)` 取**椭球表面点**
2. 对锚点做同样的 yaw/pitch/roll 旋转 → 得到屏幕位置 + 旋转后的 tangent/normal/binormal
3. 用 `rightLen = sqrt(rightVec.x^2 + rightVec.y^2)`、`downLen` 作为椭圆的水平/垂直半径（模拟透视压缩——当从侧面看，眼会变细长）
4. 眉毛从起点沿 `rightVec` 画一条线（眉毛随头旋转而不再水平）
5. 嘴巴用贝塞尔曲线从左嘴角沿曲面画到右嘴角，嘴角和中心都沿曲面切向量移动

眨眼（eyeOpen 参数）：先画完整椭圆眼白+瞳孔，再用肤色矩形从顶部往下盖 `(1 - openness)` 的高度——而不是"去掉瞳孔"。

鼻孔：两眼下方、嘴角上方的两个深色小点，位置用 `horizOffset = ±hx * 0.08, vertOffset = -hy * 0.55` 的锚点定位。

---

## 6. 每次开发前的静态核对清单

**务必按顺序做，漏掉一步会让你改出运行时错误：**

1. 打开 `src/face-tracking/mesh-spindle-whale.js`，确认：
   - `getSection` 返回 `rxDeriv`、`ryDeriv`、`spineZDeriv`、`yBendDeriv` 都是有限值
   - 叉乘是 **T_s × T_θ**（不是 T_θ × T_s）
   - 没有任何除以零的地方（都有 `|| 1` 或 `if (nLen > 1e-6)`）
2. 打开 `procedural-mesh-renderer.js`，确认：
   - `_drawMesh` 的 `avgNz > -0.05` 可见条件合理
   - `_drawFaceFeatures` 中 drawEye 不会因为 openness=0 就跳过（要先画眼白再盖）
3. `node --check` 对每个修改过的 JS 文件都通过

---

## 7. Node 脚本快速验证（dry-run）

在任何时候可以写一段 `.mjs` 脚本来 dry-run 网格生成和可见性判断：

```javascript
// 保存为 /tmp/diag.mjs 然后 node /tmp/diag.mjs
import { createSpindleMesh, deformSpindle } from '/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive/src/face-tracking/mesh-spindle-whale.js';

const mesh = createSpindleMesh();
const deformed = deformSpindle(mesh, { angleY: 0, angleX: 0, angleZ: 0 });

let visible = 0, hidden = 0;
for (const f of deformed.faces) {
  let avgNz = 0;
  for (let k = 0; k < 4; k++) avgNz += f.vertices[k].nz;
  if (avgNz * 0.25 > -0.05) visible++; else hidden++;
}
console.log(`可见=${visible}, 隐藏=${hidden}, 总=${deformed.faces.length}`);
console.log('正面应该可见的面数 ≥ 200（大致合理）；若 < 50 说明法线方向反了');

// 再打印前几个顶点的法线
for (let i = 0; i < 3; i++) {
  const v = mesh.vertices[i*50 + 10];
  console.log(`v: x=${v.x.toFixed(1)}, y=${v.y.toFixed(1)}, z=${v.z.toFixed(1)}; n=(${v.nx.toFixed(2)},${v.ny.toFixed(2)},${v.nz.toFixed(2)})`);
}
```

健康状态（正面视角）：
- 可见面 ≈ 240-400
- 头部第一圈顶点 `nz` 应在 0.7-1.0 之间
- 身体中段一圈应有约一半 nz > 0（朝上/朝摄像机的一侧）
- 尾端 `nz < 0`（正常）

---

## 8. ChatGPT-Bridge 的使用模板

### 8.1 发送代码之前先做什么

1. **不要直接用 chatgpt-bridge 打开网页**（ChatGPT 不需要浏览器）；chatgpt-bridge 的唯一用途是：把一段文本 prompt 发给 ChatGPT 模型（GPT-4），得到回复。
2. **ChatGPT 回复较慢——通常需要等 20~60 秒**。第一次超时不要马上重发，先等至少 3 分钟再试一次。
3. **不要让 ChatGPT 去浏览器做事情**。它用的是特殊的、和用户看到的浏览器不同的"sandbox"。我们只用它来做**静态代码审查/数学建议/新算法设计**。

### 8.2 如何让 ChatGPT 审查一段代码的正确性

**Prompt 模板（直接复制粘贴）**：

```
我正在一个 Canvas 2D 程序里绘制一个鱼雷形状的萨卡班甲鱼头像。下面是我生成网格顶点和法线的关键代码。请审查数学正确性。

核心约束：
- 坐标系：X 右，Y 下（Canvas），Z 朝镜头（+z 靠近摄像机）
- 鼻端在 +Z，尾端在 -Z
- 背面剔除规则：面法线的 z 分量 avgNz > -0.05 才绘制
- 所以"头部正面半球"的法线 nz 必须为正（朝 +Z）
- 身体上半（-Y 方向）的法线也应该有正的 nz

参数化曲面：
  x = rx(s) · cosθ
  y = yBend(s) + ry(s) · sinθ
  z = headZ - s · (headZ + bodyLength)

切向量：
  T_s = (rx'·cosθ, yBend' + ry'·sinθ, z')
  T_θ = (-rx·sinθ, ry·cosθ, 0)

法线应该是 T_s × T_θ 还是 T_θ × T_s？请给出理由，并验证：
(1) 鼻端（s→0, rx→ry→0, rx'>0, ry'>0, z'<0）附近 nz 是否为正
(2) 身体中段（s≈0.4, rx>0, ry>0, rx'<0, ry'<0, z'<0）朝上半球（sinθ<0）附近 nz 是否为正

如果我的方向反了，请明确指出并给出正确顺序。

（然后附上 mesh-spindle-whale.js 中 createSpindleMesh 函数里生成法线的完整代码，100 行以内）
```

### 8.3 如何让 ChatGPT 建议新形状曲线

```
我需要一组 smooth 曲线来参数化一个"鱼雷/纺锤形"的卡通 3D 模型：
- 头是圆球（从鼻端快速膨胀到最大半径）
- 身体平滑收窄（前段慢、后段快）
- 尾段微翘向上

输入：归一化 s ∈ [0,1]（0=鼻端，1=尾尖）
输出：半径缩放因子 r(s) ∈ [0,1]，以及脊柱 y 偏移 yBend(s)

要求：
- r(0)=0, r'(0+) > 0（鼻端平滑汇聚）
- r 在 s≈0.22 附近取最大值 1
- r(1) ≈ 0.04（不完全为 0，尾鳍另加）
- 曲线 C1 连续（一阶导数连续，无突兀折角）

请给出一个数学上好看且在 JavaScript 里一行就能写出来的闭式表达式（或简短 piecewise 方案）。不要写长解释，直接给公式和代码。
```

### 8.4 如何让 ChatGPT 审查整段改动

把"关键代码片段 + 你做的改动摘要 + 预期行为"发过去，例如：

```
我在一个文件里改动了 X 处，请审查这段代码是否满足预期：
预期：(1) 正面能看到鱼；(2) 眼睛/眉毛/嘴跟着头旋转；(3) 侧面看时身体流线；(4) 没有除以零或 NaN。
（附上改动代码的 diff 或完整函数）
```

### 8.5 重要！chatgpt-bridge 使用限制

- **不要在循环里反复调用 ChatGPT**——它慢，而且风控会把你的请求拒掉。
- **一次只问 1-3 个相关问题**，收到回复后再决定下一轮。
- 如果收到"超时"或"模型暂时不可用"，等 3 分钟再试一次；若 3 次都失败，应该回到代码里手动排查，不要再等模型回复。
- 如果 ChatGPT 的回复"明显答非所问"（给了不相关的答案），**直接重新问一次**，不要用它的错误结果去改代码。

---

## 9. 已经踩过的坑 —— 每次开发前请读一遍

### 坑 #1：法线叉乘顺序反了（2025-06-20）

- **现象**：正面视角下"什么都看不到"，鱼身体完全被裁掉。
- **根因**：`n = T_θ × T_s` 写成了 `T_θ × T_s`（应该是 `T_s × T_θ`），导致正面半球法线 nz 为负，被背面剔除全部丢弃。
- **诊断**：在 Node 里跑 `createSpindleMesh()`，打印前几个 col 的 nz 范围——如果全部 ≤ 0，就是这个问题。
- **修复**：把 3 行叉乘公式的顺序改为 `(T_s.y * T_θ.z - T_s.z * T_θ.y, T_s.z * T_θ.x - T_s.x * T_θ.z, T_s.x * T_θ.y - T_s.y * T_θ.x)`。

### 坑 #2：鼻端法线为零向量导致 NaN

- **现象**：鼻端附近几个三角形颜色异常/不画。
- **根因**：s→0 时 rx=ry=0 → T_θ 为零向量 → 叉乘为零 → 归一化 0/0 = NaN。
- **修复**：`if (s < 0.02) { nx=0; ny=0; nz=1; }` 直接给一个朝摄像机的默认法线。

### 坑 #3：`bodyEndX / bodyEndY` 变量从 mesh 生成里移除但 return 还在引用

- **现象**：打开页面时 JS 报错 `ReferenceError: bodyEndX is not defined`
- **根因**：重构时 options 解构里删了 `bodyEndX`、`bodyEndY`，但函数末尾 `return { ..., bodyEndX, bodyEndY, ... }` 还留着。
- **修复**：把 options 里的 `bodyEndX = 0, bodyEndY = 0` 加回去即可（不参与形状计算，仅保留命名兼容）。

### 坑 #4：测试按钮抬头/低头方向反了

- **现象**：点"抬头"按钮，鱼却往下看。
- **根因**：yaw/pitch/roll 约定：`headPitch` 增大 → angleX 为正 → 绕 X 轴旋转使 +Z 端向下。鱼的鼻端在 +Z，所以 headPitch 增大=鱼"点头向下看"。这与直觉一致。但测试按钮把 `headPitch: clamp(pitch - STEP)` 放在"抬头"按钮上，导致方向反了。
- **修复**：在 face-tracker.js 中：
  - `testPitchUp`（抬头）→ `headPitch: clamp(pitch + STEP)`
  - `testPitchDown`（低头）→ `headPitch: clamp(pitch - STEP)`

### 坑 #5：眨眼时把瞳孔直接"去掉"而不是"遮住"

- **现象**：眼睛一半睁一半闭时，瞳孔直接消失，露出一个空洞的眼白。
- **根因**：旧代码 `if (openness > 0.1) { draw pupil }`——小于阈值就不画。
- **修复**：先完整画瞳孔，再用肤色矩形从顶部盖住 `(1 - openness)` 的高度，模拟眼皮。

### 坑 #6：眉毛/嘴永远水平（不跟随头旋转）

- **现象**：向左右转或抬头/低头时，眉毛还是水平横线，嘴还是水平贝塞尔，与曲面方向不一致。
- **根因**：五官锚点没有返回 local tangent/binormal，也没有在旋转后用于屏幕绘制。
- **修复**：`computeFaceAnchorXYZ` 返回 `(tx, ty, tz)` = 表面局部"右"方向 + `(bx, by, bz)` = 表面"下"方向（用 Gram-Schmidt 从法线和初始 (1,0, approxZ) 估计出来，保证与 n 正交）。绘制时：
  - 眉毛沿 `rightVec` 延伸
  - 嘴角沿 `rightVec` 分开
  - 嘴高度沿 `downVec`

### 坑 #7：缺少鼻孔

- **现象**：面部在灰白分界线附近是平的。
- **根因**：未画。
- **修复**：在 drawEye/drawBrow/drawMouth 后加 `drawNostril(+1)` 和 `drawNostril(-1)`，锚点位于 `(horizOffset=±hx*0.08, vertOffset=-hy*0.55)`，画小椭圆深色点。

---

## 10. 如何把代码打包发给 ChatGPT 审查

ChatGPT 对"一大段代码"的理解能力比"零散描述"强得多。请按以下方式给它喂代码：

**不要**把整文件 500 行全部丢给它——它会胡编。**只给关键函数**，每次≤150行：

### 10.1 "我想让 ChatGPT 审查形状数学"

发送内容：
1. 2~3 行项目背景（"Canvas 2D，绘制一个鱼雷形卡通鱼"）
2. 坐标系约定（本节 §3.1 的 5 行）
3. `radiusScale` 函数（~15 行）
4. `getSection` 函数（~15 行）
5. `createSpindleMesh` 中生成顶点法线的那一段（~15 行）
6. 具体问题（"nz 应该为正还是负？s=0.15, θ=0 时 nz 是多少？"）

### 10.2 "我想让 ChatGPT 审查渲染逻辑"

发送内容：
1. 坐标系约定
2. `_drawMesh` 的背面剔除逻辑（~20 行）
3. 问它"哪些顶点会被画错"

### 10.3 "我想让 ChatGPT 帮我设计新功能"

发送内容：
1. 用户需求原文（1~2 句）
2. 当前相关代码片段（1~2 个函数）
3. 明确提问："请给出 2-3 个可行的实现方案，并说明各自的优缺点和我应该改哪个函数。"

---

## 11. git 推送规则（用户已明确设定）

- push origin main、push gitee main 每次都要做
- git status 确认干净再推
- 若发生 conflict，先解决再推——不要 force push
- 若沙箱（浏览器/凭证相关）报"failed to get"或"operation not allowed"，**换一个新终端再试**，而不是反复重试
- 每个 commit 写简短清晰的描述（中文也行），例如：
  - `feat: 新增鼻孔 + 眨眼遮罩`
  - `fix: 法线叉乘 T_s × T_θ 修正可见面`
  - `refactor: 拆分 radiusScale 与 spineYOffset`

---

## 12. 调试快速参考

| 症状 | 可能原因 | 排查方式 |
|---|---|---|
| 完全一片空白 | JS 报错（ReferenceError / undefined 变量） | 打开浏览器 devtools Console |
| 只有五官可见、没有身体 | 身体 mesh 法线 nz 全部 < -0.05（方向反了） | Node diag 打印 `avgNz` 分布 |
| 鱼"反过来"显示（尾端在前面） | z 方向搞反了——鼻端应在 +Z | 检查 mesh 第一个顶点的 z 与最后一圈的 z |
| 旋转后五官位置漂移 | `computeFaceAnchorXYZ` 的 local tangent 没被 yaw/pitch/roll 矩阵一起旋转 | 检查 `_transformAnchor` 是否对 `(tx, ty, tz)` 做了相同变换 |
| 侧面看时身体变"圆铁片"而不是鱼雷 | rx/ry 曲线太圆——应该是前段慢收窄后段快收尖 | 调 `radiusScale` 的 MID_T 和 0.72/0.04 系数 |
| 眨眼看起来像"黑眼仁消失了"而不是"闭眼了" | 没有做遮罩——openness 控制是否绘制瞳孔 | 改成"先画完整瞳孔，再用肤色矩形从上往下盖" |
| 眉毛不跟随头旋转 | 眉毛沿屏幕 x 轴画，而不是沿曲面切向量 rightVec | 把眉毛从 `(sx-len, sy)` 改成沿 `rightVec = (rightVec.x, rightVec.y)` 偏移 |

---

## 13. 每次对话结束前要做的事

1. **运行 `node --check` 对每个修改过的 JS 文件**——不通过就不要推送
2. **执行一次 Node dry-run 脚本**（见 §7），确认可见面数 ≥ 200
3. **git commit**（写清楚改了什么）
4. **git push origin main && git push gitee main**
5. **在用户总结里明确写出：已做了什么、做了什么静态验证、还没有验证什么、下一步建议**
6. 如果你是 ChatGPT-Bridge 的回复——**不要欺骗性地声称"我已在浏览器里验证过"**，要说"我在 Node 做了 dry-run；真实浏览器效果应由用户打开后验证"

---

## 14. 下一步工作建议（截至 2025-06-20）

按优先级：
1. **真实浏览器端到端验证**：打开 `index.html`，测试正面/左右转 45°/抬头 20°/低头 20° 各角度都可见且五官贴合曲面
2. **眨眼遮罩颜色**：当前用固定 `#d4c78d` 作为遮罩颜色，应与鱼的实际顶面颜色一致，或改为遮罩用 `ctx.save/clip` 在眼内画肤色而不是画在眼外
3. **眉毛动画**：面捕 browLeftY/browRightY 参数应抬升眉毛垂直位置（沿 `downVec` 偏移）
4. **鼻孔尺寸和位置微调**：可能需要根据鱼的 headX 做自适应（大鱼应该有更大的鼻孔）
5. **尾鳍的 3D 化**：当前尾鳍是扁平的菱形，可以改为从主体最后一圈平滑延伸的真 3D 扇尾，让侧面看更像鱼雷的尾锥
6. **光照强度参数化**：让光的方向/强度可调（目前硬编码在 `_drawMesh` 里）

---

*文档最后更新：2025-06-20。每次发现新坑、新 bug 或新函数时，请追加一条到 §9"已经踩过的坑"里。*
