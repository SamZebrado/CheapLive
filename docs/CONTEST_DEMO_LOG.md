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
- [x] Android 正式仓库 CONFIRMED — 路径 `/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive/android-capture`，applicationId=com.cheaplive.capture，namespace=com.cheaplive.capture，versionName=0.1.0，versionCode=1
- [ ] Android assembleDebug 构建验证
- [ ] Android 真机视觉同步验证（Android 当前不加载 contest-demo，需后续集成方案）
- [ ] 平板浏览器交互验证（屏幕 PIN 锁定，待人工解锁）
- [ ] 用户视觉验收（鱼/猫形象主观评价）
- [ ] mocap 真实 active 状态（资源未安装）

---

## 2026-07-05 11:30 - Avatar Quality + Fish Eye Bilateral + 2D Gaze + Mocap Shell

### Context
- HEAD: c66ed84
- 远端 main: c66ed84
- 平板: 已连接 (24091RPADC, Android 16, com.cheaplive.capture 已安装)
- 本轮任务: fish eye bilateral 修复 + cat/fish iris gaze + mocap shell + 测试 + 文档

### Android source discovery (CONFIRMED)
- Android 项目路径: `/Users/samzebrado/Documents/PersonalCodingLocal/CheapLive/android-capture`
- applicationId: com.cheaplive.capture ✓
- Android app 加载: `file:///android_asset/web/demo/demo.html`（旧版 demo，不含 contest-demo）
- contest-demo 改动无需同步到 Android（Android 不加载 contest-demo）
- 预检结果: `.automation/full-regression-repair/android-sync-preflight.json`

### Fish eye bilateral 修复
- Root cause: 2D Sacabambaspis 是俯视图画法，两眼 X 坐标都是 30*s，在 headCenter(0) 右侧，bothEyesSameSide=true
- 修复: 改为正脸视图，body 竖向椭圆，两眼 X 分别为 -14*s 和 14*s，bilateral 分布
- 审计验证: 修复前 leftEyeX=277.4 > headCenter=244（同侧），修复后 leftEyeX=229.2 < 244 < rightEyeX=260.7 ✓
- Diagnostics: `window.__cheapLiveContestFishEyeDiag`

### Cat/Fish iris gaze 追踪
- 2D cat 和 2D fish 都新增 iris/gaze 追踪
- gazeSource: 优先用 gazeLeftX/gazeLeftY，fallback 到 yaw/pitch proxy
- irisOffsetX/Y 随 gaze 变化，clamp 在 eyeW 范围内
- blink 时 iris 被眼皮遮挡（eyeHL <= 2 时不画 iris）
- Diagnostics: `window.__cheapLiveContest2DGazeDiag`

### Mocap toggle shell
- 状态: shell only，unavailable（本地无 Pose/Hand landmarker 模型）
- 默认 off，点击后显示 unavailable，不崩溃
- no CDN，不引入外部资源
- face tracking 不受影响
- Diagnostics: `window.__cheapLiveContestMocapDiag`

### Files changed
- `src/contest-demo/contest-interactive-demo.js` — drawSacabambaspis 重写、drawCat 加 iris gaze、mocap toggle、diagnostics
- `src/contest-demo/contest-interactive-demo.html` — mocap toggle UI
- `tests/e2e/contest-layout-regression.test.cjs` — 新增 6 个测试
- `docs/testing-and-quality-gate.md` — 版本号规则（上一轮已加）
- `docs/CONTEST_DEMO_LOG.md` — 本日志条目

### Tests run
- git diff --check: passed
- Playwright contest-layout-regression: 39/39 passed (39.3s)
- 新增测试: fish eye bilateral (2D fish + cat), iris gaze (cat L/R + fish U/D + blink), mocap toggle

### Verified
- [local PASS] 39/39 Playwright 测试通过
- [已核对] fish eye bilateral bothEyesSameSide=false, eyesBilateralPass=true
- [已核对] iris gaze irisMovementApplied=true, irisClampedInsideEye=true
- [已核对] mocap toggle 默认 off, 点击后 unavailable, noCdn=true

### Not verified
- [未验证] 线上 GitHub Pages 部署后验证
- [未验证] 平板浏览器交互验证
- [未验证] Android 真机视觉同步（Android 不加载 contest-demo）
- [未验证] 用户视觉验收（鱼和猫的形象主观评价）
- [未验证] mocap 真实 active 状态（资源未安装）

---

## 2026-07-05 16:55 — 鱼修复 + 平板验证（commit 2ae7375）

### 修改内容

#### P0-A: 3D 鱼转头眼睛脱离修复
- Root cause: yaw 转头时 rightVec（tangent）投影长度 rLen 趋近 0，导致 localRx 坍缩
  - yaw=-0.5: 远侧眼 aspectRatio=0.730（接近临界）
  - yaw=-1.0: 远侧眼 aspectRatio=0.272（严重坍缩，眼睛变竖条）
- Fix: 在 procedural-mesh-renderer.js SpindleWhale drawEye 中新增 minAspect=0.55 clamp
  - `if (localRx < localRy * minAspect) localRx = localRy * minAspect;`
  - `if (localRy < localRx * minAspect) localRy = localRx * minAspect;`
  - `const localRx` 改为 `let localRx` 以支持 clamp
- 新增诊断字段: eyeAngle, rightLen, downLen, facing, anchorNz

#### P0-B: 2D 鱼形象重新设计
- Root cause: 三种视角混合
  - 身体竖椭圆 = 侧视
  - 眼睛左右分布 = 正视
  - 尾鳍在底部 = 俯视
- Fix: 统一为正面视角
  - 身体: 宽水平椭圆 ellipse(0, 5*s, 42*s, 38*s)（宽>高）
  - 头盾: 上部更浅色椭圆
  - 尾鳍: 扇形（正面视角）
  - 背鳍: 顶部小三角
  - 胸鳍: 两侧小椭圆
  - 眼窝: 深色环描边
  - 嘴: always-visible mouth line + filled ellipse when open
  - 移除无意义灰色斑点
- 所有动态保留: mouthOpen, blinkLeft/Right, headOffset, roll, gaze

### 测试
- [已运行本地测试] Playwright 106/106 全绿（2.1m）
  - 新增 3D fish yaw-left-60 远侧眼宽高比不坍缩（eyeRx >= eyeRy * 0.5）
  - 新增 3D fish yaw-right-60 远侧眼宽高比不坍缩
  - 新增 3D fish yaw 时 eyeAngle 保持稳定（不出现 90° 翻转）
  - 新增 2D fish 重新设计后 diagnostics 正常，mouth/blink/headOffset/roll/gaze 全部生效

### 平板验证：PARTIAL
- PASS: 页面加载、版本号 v=2ae7375 source=query、renderer 就绪、2D 鱼动态、触摸穿透、0 console errors
- FAIL: GitHub Pages 部署延迟（push 后 15+ 分钟仍服务旧版本 c4868a2），平板实测旧代码
- 本地 Playwright 证明新代码修复有效，待 Pages 部署后平板 reload 即可验证

### Verified
- [已运行端到端测试] CDP 注入 face params 验证 3D 鱼 neutral/yaw±0.5/yaw=-1.0/pitch/roll 各状态不崩
- [已运行端到端测试] CDP 验证 2D 鱼切换 + mouthOpen/blink/headOffset/gaze
- [已运行端到端测试] CDP 验证触摸穿透 display mode pointerEvents=none
- [已核对] 控制台 0 错误
- [已核对] 版本号机制 v=2ae7375 source=query 工作正常

### Not verified
- [未验证] GitHub Pages 部署 2ae7375 后平板实测新代码（Pages 部署延迟）
- [未验证] 3D 鱼眼睛修复在平板真实视觉效果（待 Pages 部署）
- [未验证] 2D 鱼新版正面视角在平板真实视觉效果（待 Pages 部署）
- [未验证] 用户视觉验收（鱼形象主观评价）
