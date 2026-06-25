# 离线中文 ASR 方案对比 (Offline Chinese ASR Options)

## 概述

本文档调研在 CheapLive 项目中实现离线中文语音识别的候选方案，用于辅助沟通页面（Accessibility Communication Page）的字幕模块。

当前页面字幕使用浏览器 Web Speech API，**不保证离线**。本文档评估离线替代方案，不意味着离线 ASR 已集成。

## 候选方案对比

| Candidate | License | Redistributable | Size | Chinese Quality | Browser Feasibility | Android Feasibility | China Mirror Strategy | Recommendation |
|---|---|---|---|---|---|---|---|---|
| **Vosk small-cn 0.22** | Apache-2.0 | **Yes** | ~42MB | 轻量，可接受 fallback | 可能（WASM/loader） | 可能 | Gitee / ModelScope / GitHub / 官方源 | **首选离线候选** |
| Vosk cn 0.22 | Apache-2.0 | **Yes** | ~1.3GB | 较好 | 不适合浏览器默认 | 仅服务器/高端设备 | Release/镜像 | 不捆绑 |
| Whisper tiny/base/small | MIT | **Yes** | 大（浏览器端） | 多语言但成本高 | 浏览器困难 | 可能（native/WASM） | Release/镜像 | 仅研究 |
| sherpa-onnx 引擎 | Apache-2.0 | 引擎 Yes | 取决于模型 | 框架良好 | WASM 可能 | Android 适配强 | ModelScope / Gitee | 框架候选，模型 license 逐个核实 |
| SenseVoice-Small | **待核实** | **未知**（需查 exact model card） | ~数百 MB | 中文效果有吸引力 | 非默认 Web MVP | 有前景 | ModelScope 首选 | **不捆绑，license 未核实** |
| Android on-device SpeechRecognizer | 系统 API | 非模型分发 | 系统管理 | 设备依赖 | 不适用 Web | API 31+ | 不适用 | 仅 Android agent 使用 |

## 详细说明

### 1. Vosk small-cn 0.22（首选）

- **License**: Apache 2.0
- **大小**: ~42MB
- **再分发**: 允许，需保留 LICENSE/NOTICE
- **中文效果**: 轻量模型，适合离线 fallback；效果不如在线识别或大模型
- **浏览器**: 可通过 Vosk WASM 或自定义 loader 在浏览器中运行
- **Android**: 可通过 Vosk Android SDK 集成
- **中国镜像**: Gitee Release → ModelScope → GitHub Release → 官方源
- **状态**: 已进入项目 ASR_MODEL_MANIFEST，作为首选离线候选；模型权重通过 Release/镜像分发，不提交到 git 仓库

**下载顺序**（中国网络优先）：
1. 本地已安装 / 已缓存
2. 项目本地路径 `./models/vosk-model-small-cn-0.22/`
3. Gitee Release
4. ModelScope
5. GitHub Release
6. Vosk 官方源 `https://alphacephei.com/vosk/models`

### 2. Vosk cn 0.22（大模型）

- **License**: Apache 2.0
- **大小**: ~1.3GB
- **再分发**: 允许
- **中文效果**: 优于 small 版本
- **限制**: 不适合浏览器默认下载或 git 仓库捆绑；仅适合服务器端或高端设备
- **推荐**: 作为高精度候选写入文档，通过 Release/镜像分发

### 3. Whisper (OpenAI)

- **License**: MIT（code 和 model weights）
- **再分发**: 允许
- **中文效果**: 多语言支持好，但中文实时识别资源开销高
- **浏览器**: 浏览器端实时中文识别延迟和电量压力大
- **推荐**: 不作为本轮网页中文实时字幕首选；放入中长期候选

### 4. sherpa-onnx

- **引擎 License**: Apache 2.0
- **模型 License**: 需逐个核实 exact model card
- **特点**: 支持本地识别、Android、WebAssembly
- **注意**: 不能把"sherpa-onnx 引擎 Apache 2.0"误写成"所有 sherpa 预训练模型都可再分发"
- **推荐**: 可作为中长期本地 ASR 框架；本轮可以做 manifest/loader/文档，不直接打包模型权重

### 5. SenseVoice / FunASR

- **当前结论**: 不能直接按可再分发处理
- **原因**: SenseVoice-Small 中文效果和边缘运行路线有吸引力，但必须查 exact ModelScope/HuggingFace model card license
- **推荐**: 本轮不打包、不镜像、不提交模型权重；文档中标注"license 待核实"

### 6. Android on-device SpeechRecognizer

- **API**: `SpeechRecognizer.isOnDeviceRecognitionAvailable()` (API 31+)
- **限制**: 需要设备支持、RECORD_AUDIO 权限、主线程调用
- **推荐**: 仅由参赛 Android agent 实现；主项目只保留设计说明

## 模型资产策略

### 模型不提交到 Git

所有模型权重（.zip, .onnx, .pt, .bin, .gguf, .tflite）**不提交到 Git 仓库**。

### "加入项目"的定义

模型进入项目可控资产体系指：
1. manifest 中有条目（`asr-model-manifest.js`）
2. license/notice 有记录
3. sha256 有记录
4. 有至少一个中国可访问镜像
5. 代码能检测、下载、缓存、加载
6. 文档说明来源和 license

### 中国网络镜像策略

模型下载顺序（硬编码）：
1. 本地已安装 / 已缓存（Cache Storage 或 IndexedDB）
2. 项目本地路径
3. Gitee Release
4. ModelScope / 国内镜像
5. GitHub Release
6. 官方源

要求：
- 国际源失败时自动尝试下一个镜像
- 当前下载源显示在 UI
- 下载失败不能卡住页面
- 下载失败后提示用户可继续使用手写板
- 下载后校验 sha256
- 缓存到 Cache Storage 或 IndexedDB
- 不每次刷新重复下载

## 当前实现状态

- [已实现] ASR 模型清单（`asr-model-manifest.js`），包含 Vosk small-cn 作为首选候选
- [已实现] 字幕引擎状态检测（Web Speech API 可用性）
- [已实现] 网络状态检测和离线提示
- [未实现] Vosk 模型下载器
- [未实现] Vosk 模型加载和实时识别
- [未实现] sha256 校验
- [未实现] Cache Storage 缓存
- [未实现] 离线模型真实集成

## 推荐路线

1. **短期（本轮）**：页面 + 手写板 + Web Speech 在线探测 + 状态标注 + 模型清单 ✅
2. **中期（P1）**：Vosk small-cn 下载器 + 加载器 + WASM 集成 + 中国镜像 fallback
3. **长期（P2）**：sherpa-onnx 框架评估 + Whisper/SenseVoice 持续跟踪

## 相关文件

- `src/accessibility-communication/asr-model-manifest.js` - ASR 模型清单
- `src/accessibility-communication/speech-caption.js` - 字幕引擎（Web Speech API）
- `docs/android-on-device-caption-design.md` - Android 系统级字幕设计说明