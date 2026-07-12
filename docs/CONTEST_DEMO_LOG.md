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

## f5f4d00 修复内容：3D鱼完整姿态链、嘴唇运动

### 姿态链修复
- 眼睛在鱼头局部坐标中固定，与鱼头顶点使用同一模型旋转
- 眼睛只经过一次 yaw/pitch/roll，再统一投影到屏幕
- 低头和抬头时，眼睛相对头部位置基本固定，不出现反向抬起或向外翘起
- 眼皮方向由头部局部 right/down/normal 向量投影得出，随头部旋转

### 眨眼机制
- 使用不透明眼皮覆盖方案，而非梭形/树叶形眨眼
- 半眨眼时眼皮覆盖虹膜，全眨眼时完全遮住虹膜和瞳孔
- 眼白基础 rx/ry 不随 openness 压扁
- 左右眼独立眨眼

### 上嘴唇运动
- 嘴角端点在 mouthOpen 过程中基本固定
- 张嘴时上嘴唇中部轻微向上移动（upperLipRatio = 0.15）
- 下嘴唇中部明显向下移动（lowerLipRatio = 0.70）
- 下唇位移约为上唇的 4.7 倍

### 尾巴坐标
- tail root 固定在身体后端局部坐标
- tail tip 经过和身体一致的模型变换
- bend 在局部空间应用
- 镜像不改变 tail bend 符号

### 诊断系统
- 新增 `window.__cheapLiveFishPoseDiag` 包含头部/眼睛局部和世界坐标
- 新增 `window.__cheapLiveMouthDiag` 包含嘴唇位置和位移比例

### 测试结果
- 全部 53 个 Playwright 测试通过
- 生成了完整的姿态和嘴巴 contact sheets
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

## 2026-07-12 17:00 — 3D 鱼完整姿态链修复 + 嘴唇运动 + receiver 抠图（阶段0基线）

### Context
- Web HEAD: f5f4d00 (demo-full-regression-repair)
- Android HEAD: 9284363 (migration/android-source-from-verify)
- 平板: 已解锁 (bbda35e, Android 16, com.cheaplive.capture versionName=0.1.0)
- 平板 APK lastUpdateTime: 2026-07-12 16:17:45
- 当前公开页面 URL: https://samzebrado.github.io/CheapLive/src/contest-demo/contest-interactive-demo.html
- 本轮任务: 修复 3D 鱼完整姿态链、嘴唇运动、receiver 抠图，统一 Web 与 Android 实现

### 当前确认问题
1. 公开 contest demo: 低头时眼睛相对鱼头反向抬起；抬头时眼睛相对鱼头向外翘起
2. APK receiver: 眼睛不稳定贴头；眼皮方向不随头部姿态；旧式梭形/树叶形眨眼风险；左右转头时尾巴方向异常
3. 公开 demo 与 APK 当前不能直接互相证明正确
4. 左右镜像不是 bug: 用户闭左眼 → 屏幕靠左鱼眼闭合；用户闭右眼 → 屏幕靠右鱼眼闭合
5. 嘴巴需要统一: 上嘴唇两端基本固定；中部随张嘴轻微上抬；下嘴唇移动和弯曲明显更大
6. receiver 背景没有被悬浮浏览器正确抠除
7. 公开 demo 版本时间和 Git commit 标记需要更新

### 禁止事项
- 不要使用 git checkout / restore / reset / clean / stash / rebase / force push
- 不要把当前镜像映射当作 bug
- 不要继续只替换 `_drawFaceFeatures`
- 不要分别手工维护两套逐渐分叉的 renderer
- 不要用 diagnostics 自己写的 `matchesPublicDemo=true` 代替视觉证据
- 不要容忍测试 5/7 后继续宣布 renderer 正确
- 不要因为 contact sheet 缺 canvas npm 依赖就放弃截图
- 不要继续修改眼睛颜色，除非真实抠图实验明确要求
- 任一子任务阻塞时，记录阻塞并继续其他可独立阶段

### 实施顺序
1. 复现并修复公开 demo
2. 完成公开 demo 的测试和视觉证据
3. 更新版本时间与 Git commit 标记
4. commit/push 公开 demo
5. 将已验证实现同步到 Android receiver
6. 构建、安装和真机验证
7. 测量并修复悬浮浏览器抠图
8. 分别提交 Web 和 Android 改动

### 未验证项（本轮开始）
- [ ] 公开 demo pitch 眼睛反向抬起/向外翘起修复
- [ ] 公开 demo 尾巴方向正确
- [ ] 公开 demo 上嘴唇运动通过
- [ ] 公开 demo 时间和 Git 标记更新
- [ ] Web 全部测试通过
- [ ] Web 线上版本显示新 SHA
- [ ] receiver 同步同一实现
- [ ] receiver 全部测试通过
- [ ] APK 构建安装成功
- [ ] 真机姿态与嘴巴通过
- [ ] 悬浮浏览器真实抠图通过
- [ ] contact sheet 已生成
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

---

## 2026-07-12 14:30 — Android 统一 Contest Demo 集成与同步

### Context
- Web HEAD: df6c6db (CheapLive_demo_full_regression_repair)
- Android HEAD: ??? (CheapLive/android-capture)
- 平板: 已解锁 (Xiaomi Pad 6 Pro, Android 16, com.cheaplive.capture 已安装)
- 本轮任务: 经典圆球移植 + 鱼眼睛修复 + Android 本地 Contest Demo 集成 + 同步方案

### 经典圆球 avatar（classic-sphere）
- 来源: Android 发送端页面底部的二维圆球（灰色球体 + 黑色点眼睛嘴巴）
- 移植到 contest demo: 新增 `drawClassicSphere()` 函数
- 参数支持: mouthOpen, blinkLeft/Right, headOffset, roll, gaze
- 颜色: 球体 `#9ca3af`（灰色），眼睛和嘴巴 `#000`（黑色）
- 诊断: `window.__cheapLiveContestClassicSphereDiag`

### 鱼眼睛修复（前序任务）
- 3D 鱼: yaw 转头时 eye aspect ratio clamp（minAspect=0.55）
- 2D 鱼: 统一正面视角重新设计
- 诊断: `window.__cheapLiveContestFishEyeDiag`

### Web → Android 同步方案
- 同步脚本: `scripts/sync-contest-demo-to-android.mjs`
- Source: `src/contest-demo/` + `src/face-tracking/`
- Target: `app/src/main/assets/web/contest-demo/`
- Allowlist: 19 个核心文件（不含 .automation, docs, tests, visual-history）
- 幂等性: 连续运行两次无额外 diff
- Manifest: `contest-demo-assets-manifest.json`（含 file hashes）

### Android 本地 Contest Demo 集成
- 新增 Activity: `ContestDemoActivity.kt`
- WebView 配置: file:///android_asset 协议支持、JS enabled、权限请求
- HomeActivity 新增入口: "📱 Contest Demo 本地版"
- Fetch API 兼容: file:// 协议改用 XMLHttpRequest
- 权限: CAMERA + RECORD_AUDIO 运行时请求

### Files changed (Web)
- `src/contest-demo/contest-interactive-demo.js` — 新增 drawClassicSphere, 修复 file:// fetch
- `src/contest-demo/contest-interactive-demo.html` — 新增 classic-sphere avatar 按钮
- `scripts/sync-contest-demo-to-android.mjs` — 同步脚本
- `docs/CONTEST_DEMO_LOG.md` — 本日志条目

### Files changed (Android)
- `app/src/main/java/com/cheaplive/capture/ContestDemoActivity.kt` — 新 Activity
- `app/src/main/java/com/cheaplive/capture/HomeActivity.kt` — 新增本地 Contest Demo 入口
- `app/src/main/AndroidManifest.xml` — 注册 ContestDemoActivity
- `app/src/main/assets/web/contest-demo/` — 同步的 19 个文件
- `app/src/main/assets/web/contest-demo/contest-demo-assets-manifest.json` — manifest

### Tests run
- [已运行本地测试] git diff --check: passed
- [已运行本地测试] Playwright contest-layout-regression: 53/53 passed (58.1s)
- [已运行本地测试] 同步脚本幂等性: 第二次运行 Copied: 0 files
- [已运行本地测试] Android assembleDebug: BUILD SUCCESSFUL

### Verified
- [已运行端到端测试] Android 平板: Contest Demo 页面成功加载，无 JS errors
- [已核对] Android WebView 加载: file:///android_asset/web/contest-demo/contest-interactive-demo.html
- [已核对] 同步脚本生成 manifest 包含所有文件 hash
- [已核对] 旧 demo (web/demo/) 保留作为 fallback
- [已核对] Playwright 53/53 测试全部通过

### Not verified
- [未验证] Android 圆球 avatar 视觉效果（已加载页面，待点击测试）
- [未验证] Android 摄像头面捕真实效果（需用户授权）
- [未验证] 用户视觉验收（圆球/鱼形象主观评价）
- [未验证] 线上 GitHub Pages 部署后验证
- [未验证] 平板触摸屏交互详细验证
