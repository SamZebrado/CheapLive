# Live2D 球体纺锤体资产规格 - 美术交接文档

> 版本: 1.0
> 目标: 为 CheapLive 项目制作 Live2D Cubism 4 模型（球体 + 纺锤体 + 鲸鱼尾巴）
> 面向: Live2D Cubism Editor 美术师
> 输出格式: Cubism 4 .model3.json + .moc3

---

## 1. 视觉设计概述

### 1.1 角色描述

**萨卡班甲鱼（Sacabambaspis）** 风格的角色，由以下部分组成：

| 部件 | 描述 |
|------|------|
| **头部（球体）** | 灰白色球体，直径约 85 单位。上半部分浅灰棕色，下半部分白色/米色（鱼肚白），中缝水平分割。 |
| **身体（纺锤体）** | 从头部后方延伸的纺锤形身体，长度约 140 单位，最宽处约 55 单位。上半灰色，下半白色。 |
| **尾巴（鲸鱼尾叶）** | 从身体末端延伸的横向鲸鱼尾巴，长度约 60 单位，尾叶展开宽度约 50 单位。灰色。 |
| **眼睛（左/右）** | 白色圆眼，半径约 24 单位，内含黑色瞳孔。位置在头部前方两侧。 |
| **鼻孔（左/右）** | 小椭圆形黑色鼻孔，位于头部中下部。 |
| **嘴巴** | 位于头部下方，闭合时是一条线，张开时呈三角形暗红色。 |

### 1.2 参考颜色

| 元素 | 颜色 | 用途 |
|------|------|------|
| 身体上半部 | `#bdb8aa` (浅灰棕) | 纺锤体顶部 |
| 身体下半部 | `#f2f1ea` (米白) | 纺锤体底部（鱼肚白） |
| 球体高光 | `#e8e6df` | 头部高光 |
| 球体暗部 | `#9a9588` | 头部边缘 |
| 尾巴 | `#8a8a8a` (中灰) | 鲸鱼尾叶 |
| 眼睛白 | `#ffffff` | 眼睛底色 |
| 瞳孔 | `#1a1a1a` | 瞳孔 |
| 嘴巴内部 | `#7a2e2e` (暗红) | 嘴巴张开时内部 |
| 轮廓线 | `#7c7a72` | 特征描边 |

---

## 2. ArtMesh 建议

### 2.1 分层结构（从后到前）

```
Layer 1 (最后):  身体下半部（白色/米色） - ArtMesh "BodyBottom"
Layer 2:         身体上半部（灰色/棕色） - ArtMesh "BodyTop"
Layer 3:         鲸鱼尾叶（上叶 + 下叶） - ArtMesh "TailTop", "TailBottom"
Layer 4:         球体头部（下半部白色） - ArtMesh "HeadBottom"
Layer 5:         球体头部（上半部灰色） - ArtMesh "HeadTop"
Layer 6:         嘴巴（闭合/张开） - ArtMesh "Mouth"
Layer 7:         鼻孔（左/右） - ArtMesh "NostrilL", "NostrilR"
Layer 8:         左眼 - ArtMesh "EyeL_White", "EyeL_Pupil"
Layer 9 (最前):  右眼 - ArtMesh "EyeR_White", "EyeR_Pupil"
```

### 2.2 ArtMesh 网格注意事项

- **球体头部**：建议使用圆形 ArtMesh，确保旋转时边缘平滑
- **纺锤体身体**：使用贝塞尔曲线拟合的纺锤形轮廓，前端与头部连接，后端渐细
- **鲸鱼尾叶**：两片独立 ArtMesh，横向展开，根部连接身体末端
- **眼睛**：眼白和瞳孔分开为两个 ArtMesh，瞳孔在眼白上方
- **嘴巴**：闭合状态和张开状态使用不同的 Keyform 变形

---

## 3. 参数列表

### 3.1 标准 Cubism 参数（必须实现）

| 参数 ID | 范围 | 默认值 | 描述 |
|---------|------|--------|------|
| `ParamAngleX` | -30 ~ 30 | 0 | 头部左右旋转（Yaw） |
| `ParamAngleY` | -30 ~ 30 | 0 | 头部上下旋转（Pitch） |
| `ParamAngleZ` | -30 ~ 30 | 0 | 头部倾斜（Roll） |
| `ParamEyeLOpen` | 0 ~ 1 | 1 | 左眼开合度 |
| `ParamEyeROpen` | 0 ~ 1 | 1 | 右眼开合度 |
| `ParamEyeBallX` | -1 ~ 1 | 0 | 眼球左右移动 |
| `ParamEyeBallY` | -1 ~ 1 | 0 | 眼球上下移动 |
| `ParamMouthOpenY` | 0 ~ 1.5 | 0 | 嘴巴纵向开合 |
| `ParamMouthForm` | -1 ~ 1 | 0 | 嘴型（负=微笑） |
| `ParamBrowLY` | -1 ~ 1 | 0 | 左眉上下 |
| `ParamBrowRY` | -1 ~ 1 | 0 | 右眉上下 |
| `ParamBodyAngleX` | -10 ~ 10 | 0 | 身体左右旋转 |
| `ParamBodyAngleY` | -10 ~ 10 | 0 | 身体上下旋转 |
| `ParamBreath` | 0 ~ 1 | 0 | 呼吸（周期性） |

### 3.2 自定义参数（建议）

| 参数 ID | 范围 | 默认值 | 描述 |
|---------|------|--------|------|
| `ParamTailPitch` | -20 ~ 20 | 0 | 尾巴上下摆动 |
| `ParamTailYaw` | -20 ~ 20 | 0 | 尾巴左右摆动 |
| `ParamTailWave` | 0 ~ 1 | 0 | 尾巴波浪幅度 |

---

## 4. Keyform 角度

### 4.1 头部旋转（ParamAngleX）- 左右

| Keyform | 角度 | 视觉变化 |
|---------|------|---------|
| 0 | -30° (向左) | 头部和身体整体向左旋转，右侧可见更多 |
| 1 | 0° (正面) | 默认正面视角 |
| 2 | +30° (向右) | 头部和身体整体向右旋转，左侧可见更多 |

### 4.2 头部旋转（ParamAngleY）- 上下

| Keyform | 角度 | 视觉变化 |
|---------|------|---------|
| 0 | -30° (向上) | 抬头，下巴可见更多 |
| 1 | 0° (正面) | 默认正面视角 |
| 2 | +30° (向下) | 低头，头顶可见更多 |

### 4.3 头部旋转（ParamAngleZ）- 倾斜

| Keyform | 角度 | 视觉变化 |
|---------|------|---------|
| 0 | -30° (左倾) | 头部左倾 |
| 1 | 0° (正面) | 默认正面视角 |
| 2 | +30° (右倾) | 头部右倾 |

### 4.4 眼睛开合（ParamEyeLOpen / ParamEyeROpen）

| Keyform | 值 | 视觉变化 |
|---------|-----|---------|
| 0 | 0 (完全闭合) | 眼球被上下眼睑遮盖，仅见一条缝 |
| 1 | 0.5 (半开) | 眼球可见一半 |
| 2 | 1 (完全睁开) | 默认睁眼状态 |

### 4.5 嘴巴开合（ParamMouthOpenY）

| Keyform | 值 | 视觉变化 |
|---------|-----|---------|
| 0 | 0 (闭合) | 一条水平线 |
| 1 | 0.5 (半开) | 三角形开口，内部暗红色可见 |
| 2 | 1.5 (最大) | 全张开的三角形嘴巴 |

---

## 5. 纺锤体结构

### 5.1 几何轮廓

纺锤体采用贝塞尔曲线拟合的轮廓：

```
控制点坐标（相对于头部中心，单位：像素）：
P0:  (-22,  -75)  头部前端（球体前缘）
P1:  ( 37,  -55)  身体上部起点
P2:  ( 84,  -47)  身体中部上部
P3:  (140,  -17)  身体后端上部
P4:  (155,   -8)  尾部过渡
P5:  (165,   -5)  尾柄上部
P6:  (170,    0)  尾尖
P7:  (165,    8)  尾柄下部
P8:  (160,   15)  尾部过渡下部
P9:  (158,   18)  身体后端下部
P10: (150,   22)  身体中后部
P11: (145,   18)  身体中部
P12: (140,   12)  身体前部转换
P13: ( 84,   39)  身体中部下部
P14: ( 37,   50)  身体下部起点
P15: (-22,   75)  头部后端（球体后缘）
```

### 5.2 3D 体积感

纺锤体不是纯平面图形，需要在参数变形时体现 3D 体积感：

- **身体深度**：约 40 单位（z 方向）
- **头部球体**：半径 85 单位，x/y/z 三维旋转
- **身体截面**：沿身体长轴方向，截面宽度从头部最宽渐变为尾部最细

### 5.3 分割线

身体上半部（灰色）和下半部（白色）的分割线沿身体中线水平延伸，在旋转时随身体轮廓变形。

---

## 6. 鲸鱼尾柄和尾叶

### 6.1 尾柄

尾柄连接身体末端和尾叶分叉点，长度约 15 单位，宽度约 8 单位，略呈锥形。

### 6.2 尾叶

| 属性 | 上尾叶 | 下尾叶 |
|------|--------|--------|
| 形状 | 横向展开的扇形 | 横向展开的扇形 |
| 展开宽度 | ~50 单位 | ~50 单位 |
| 长度 | ~40 单位（从分叉点） | ~40 单位（从分叉点） |
| 颜色 | `#8a8a8a` | `#8a8a8a` |
| 摆动角度 | 上下 ±20° | 上下 ±20° |

### 6.3 尾巴摆动

- `ParamTailPitch`：控制尾叶整体上下摆动
- `ParamTailYaw`：控制尾叶左右摆动
- `ParamTailWave`：控制尾叶波浪变形幅度

---

## 7. 遮挡关系

### 7.1 绘制顺序（从远到近）

1. 身体下半部（白色）
2. 身体上半部（灰色）-- 部分遮挡身体下半部
3. 鲸鱼尾叶（下叶）
4. 鲸鱼尾叶（上叶）-- 遮挡下叶根部
5. 球体头部下半部（白色）
6. 球体头部上半部（灰色）-- 部分遮挡头部下半部
7. 嘴巴 -- 位于头部下方
8. 鼻孔（左/右）-- 位于头部中下部
9. 左眼 -- 位于头部前方左侧
10. 右眼 -- 位于头部前方右侧

### 7.2 旋转时的遮挡

- 当头部向右旋转（ParamAngleX > 0）时，右侧特征（右眼）更靠近观察者，左侧特征（左眼）可能被头部遮挡
- 当头部向上旋转（ParamAngleY < 0）时，嘴巴和鼻孔更靠近观察者
- 身体和头部在旋转时，需要正确处理 ArtMesh 之间的遮挡关系

---

## 8. 导出文件结构

### 8.1 所需文件

```
model/
  model.model3.json        # 模型入口文件（必须）
  model.moc3               # 模型二进制数据（必须）
  model.physics3.json      # 物理设定（可选）
  model.cdi3.json          # 显示信息（可选）
  textures/
    texture_00.png         # 纹理贴图
    texture_01.png         # 额外纹理（如有）
  motions/                 # 动作文件（可选）
    idle.motion3.json
    ...
  expressions/             # 表情文件（可选）
    smile.exp3.json
    ...
```

### 8.2 .model3.json 结构参考

```json
{
  "Version": 3,
  "FileReferences": {
    "Moc": "model.moc3",
    "Textures": ["textures/texture_00.png"],
    "Physics": "model.physics3.json",
    "DisplayInfo": "model.cdi3.json"
  },
  "Groups": [
    {
      "Target": "Parameter",
      "Name": "EyeBlink",
      "Ids": ["ParamEyeLOpen", "ParamEyeROpen"]
    },
    {
      "Target": "Parameter",
      "Name": "LipSync",
      "Ids": ["ParamMouthOpenY"]
    }
  ]
}
```

### 8.3 打包格式

- 将上述 `model/` 目录打包为 ZIP 文件
- ZIP 文件可直接上传到 CheapLive 的 Live2D 模型上传界面
- 不支持 ZIP 内的多层嵌套目录

---

## 9. Web 接入要求

### 9.1 SDK 版本

- 目标 SDK: **Live2D Cubism 4 SDK for Web**
- Core: `live2dcubismcore.min.js`
- Framework: `live2dcubismframework.js`

### 9.2 参数映射

CheapLive 使用 MediaPipe Face Landmarker 进行面部捕捉，并通过 `face-to-cubism-mapper.js` 将面部追踪数据映射到 Cubism 参数。美术师需要确保以下参数可被正确驱动：

| MediaPipe 数据 | Cubism 参数 | 映射说明 |
|---------------|-------------|---------|
| headYaw (0~1) | `ParamAngleX` (-30~30) | 头部左右旋转 |
| headPitch (0~1) | `ParamAngleY` (-30~30) | 头部上下旋转 |
| headRoll (0~1) | `ParamAngleZ` (-30~30) | 头部倾斜 |
| eyeLeft (0~1) | `ParamEyeLOpen` (0~1) | 左眼开合 |
| eyeRight (0~1) | `ParamEyeROpen` (0~1) | 右眼开合 |
| mouthOpen (0~1) | `ParamMouthOpenY` (0~1.5) | 嘴巴开合 |
| mouthSmile (0~1) | `ParamMouthForm` (-1~1) | 微笑/嘴型 |
| browLeft (0~1) | `ParamBrowLY` (-1~1) | 左眉 |
| browRight (0~1) | `ParamBrowRY` (-1~1) | 右眉 |

### 9.3 纹理限制

- 纹理尺寸：建议 2048x2048 或 1024x1024，支持 PNG
- 纹理数量：建议 1-2 张
- 纹理格式：PNG（支持透明通道）

### 9.4 文件大小限制

- 单个模型 ZIP 包：建议 < 20MB
- .moc3 文件：建议 < 5MB
- 纹理文件：建议 < 5MB 每张

---

## 10. 开发优先级

| 优先级 | 内容 | 说明 |
|--------|------|------|
| P0 | 球体头部 + 眼/嘴/鼻 基本 ArtMesh | 最小可用模型 |
| P1 | 头部旋转参数（ParamAngleX/Y/Z） | 面捕追踪基础 |
| P2 | 纺锤体身体 | 完整形象 |
| P3 | 鲸鱼尾叶 + 尾巴参数 | 特色尾巴动画 |
| P4 | 眉毛参数（ParamBrowLY/RY） | 表情增强 |
| P5 | 身体参数（ParamBodyAngleX/Y） | 身体跟随头部 |

---

## 附录 A: 参考图片

当前项目中的程序化渲染参考图片位于 `artifacts/` 目录：

- `artifacts/procedural-sphere/sphere-front.png` - 球体正面
- `artifacts/procedural-sphere/sphere-yaw-plus-60.png` - 球体右转 60 度
- `artifacts/procedural-sphere/sphere-yaw-minus-60.png` - 球体左转 60 度
- `artifacts/procedural-sphere/sphere-pitch-plus-25.png` - 球体上仰 25 度
- `artifacts/procedural-spindle-whale/spindle-front.png` - 纺锤体+鲸尾正面
- `artifacts/procedural-spindle-whale/spindle-side.png` - 纺锤体侧面
- `artifacts/procedural-spindle-whale/spindle-three-quarter.png` - 纺锤体 3/4 视角
- `artifacts/procedural-spindle-whale/spindle-tail-visible.png` - 尾巴可见
- `artifacts/procedural-spindle-whale/spindle-tail-occluded.png` - 尾巴被遮挡

## 附录 B: 代码参考

相关代码文件（供美术师了解参数映射）：

- `src/face-tracking/face-to-cubism-mapper.js` - 面部数据到 Cubism 参数的映射逻辑
- `src/face-tracking/cubism-runtime.js` - Cubism Web 运行时封装
- `src/face-tracking/cubism-loader.js` - SDK 加载器
- `src/face-tracking/avatar-versions.js` - 形象版本注册（`live2d-cubism` 项）