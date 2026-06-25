# Android 系统级字幕设计说明 (Android On-Device Caption Design)

## 概述

本文档描述 Android 系统级 on-device SpeechRecognizer 在 CheapLive 参赛 Android App 中的设计。

**注意：主项目（CheapLive 公开仓库）不包含 Android 代码。此功能由参赛 Android agent 在私有分支 `contest-private-app-web-control` 中实现。**

## 设计原则

- 不启动 App 时自动请求麦克风权限
- 不在主线程外调用 SpeechRecognizer
- 不支持时 fallback 到 Web 字幕 / 手写板
- 探测结果通过 WebView bridge 传递给辅助沟通页面

## API 探测

```kotlin
// API 31+ 才有 on-device recognizer
if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
    val available = SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
    if (available) {
        val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        // 配置并使用...
        // 注意：使用完毕后必须调用 destroy()
    }
}
```

## 要求

| 项目 | 说明 |
|---|---|
| 最低 API | 31+ (Android 12) |
| 权限 | RECORD_AUDIO（需用户主动授权） |
| 线程 | 必须主线程调用 |
| 生命周期 | 使用后必须 destroy() |
| 设备支持 | 取决于设备厂商和语言包 |
| Fallback | 不支持时 fallback 到 Web Speech / 手写板 |

## 与主项目的交互

辅助沟通页面（`src/accessibility-communication/`）通过以下方式与 Android 端交互：

1. Android App 探测 on-device 能力
2. 通过 WebView JavaScript bridge 注入探测结果
3. 辅助沟通页面根据结果更新状态栏显示：
   - "Android 设备端识别可用"
   - "Android 设备端识别不可用，使用浏览器识别"

## 状态标注

在辅助沟通页面状态栏中：

| 引擎 | 显示 |
|---|---|
| Android on-device 可用 | 当前引擎：Android 设备端语音识别 / 离线状态：本机处理 |
| Android on-device 不可用 | 当前引擎：浏览器语音识别 / 离线状态：未保证 |
| 全部不可用 | 字幕识别暂不可用，请使用手写留言板 |

## 当前状态

- [已完成] 设计文档
- [未实现] Android 端 on-device 探测代码
- [未实现] WebView bridge 注入
- [未实现] 真机 on-device 识别验证

## 相关文件

- `src/accessibility-communication/speech-caption.js` - 字幕引擎（Web Speech API）
- `src/accessibility-communication/asr-model-manifest.js` - ASR 模型清单
- `docs/offline-chinese-asr-options.md` - 离线中文 ASR 方案对比