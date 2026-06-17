# CheapLive 运行时外部依赖审计

> 生成时间：2026-06-18
> 审计范围：所有通过 CDN/URL 动态加载的外部资源

---

## 依赖清单

| # | 依赖 | URL | 用途 | 加载方式 | 失败后行为 | 可本地打包 | 本地副本 |
|---|------|-----|------|---------|-----------|-----------|---------|
| 1 | **MediaPipe FaceLandmarker** | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm` | 面部关键点检测 | ES Module import | 面部捕捉全部不可用，页面显示加载错误 | 是 | 否 |
| 2 | **MediaPipe WASM** | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm` | WebAssembly 运行时 | FilesetResolver 动态加载 | 模型初始化失败 | 是 | 否 |
| 3 | **MediaPipe Model** | `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` | 预训练模型权重 | FilesetResolver 动态下载 | 面部检测失败 | 是 | 否 |
| 4 | **SoundTouchJS** | `https://cdn.jsdelivr.net/npm/soundtouchjs@0.1.29/dist/soundtouch.min.js` | 变声器音调/速度调整 | `<script>` 动态注入 | 变声功能不可用，无变声效果 | 是 | 否 |
| 5 | **JSZip** | `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` | Live2D ZIP 解压 | `<script>` 动态注入 | Live2D 模型 ZIP 上传不可用 | 是 | 否 |
| 6 | **Google Fonts (Noto Sans SC)** | `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700` | 页面字体 | `<link>` CSS | 降级为系统默认中文字体，不影响功能 | 是 | 否 |
| 7 | **Google Fonts Preconnect** | `https://fonts.googleapis.com` | DNS 预连接 | `<link rel="preconnect">` | 无影响 | 无关 | 无关 |

---

## 影响分析

### 比赛环境/局域网离线使用

以下功能在**无互联网连接**时完全不可用：

| 功能 | 依赖项 | 影响 |
|------|--------|------|
| 面部捕捉 | 1, 2, 3 | **完全不可用** — 无法加载模型和 WASM |
| 变声器 | 4 | 变声效果不可用，但原始音频仍可传输 |
| Live2D ZIP 上传 | 5 | ZIP 解压不可用，但手动模型目录选择仍可用 |
| 页面字体 | 6 | 降级为系统字体，无功能影响 |

### 弱网环境

- MediaPipe 模型文件约 4-6MB，在弱网环境下载缓慢
- SoundTouchJS 和 JSZip 各约 100-200KB，影响较小
- Google Fonts 约 20-50KB

---

## 建议

### 短期方案（本地打包）

1. 将所有 CDN 资源下载到 `vendor/` 目录
2. 修改 import 路径指向本地文件
3. 需要确保许可协议允许本地分发

### 长期方案（Service Worker + 离线缓存）

1. 注册 Service Worker 离线缓存所有静态资源
2. 首次加载后，后续访问无需网络
3. 适用于 PWA 部署

### 当前状态

- [ ] 无本地副本
- [ ] 无 Service Worker
- [ ] 离线时所有核心功能均不可用