# Audio End-to-End Plan（草稿 · 只读审计 · 待真机验证）

> 审计日期：2026-07-03  
> 范围：App 端（android-capture/）+ Web 端（src/）音频链路  
> 状态：只读审计，未真机测试  

---

## 1. 当前已有链路

### 1.1 App Capture 端（发送端）

- `android-capture/app/src/main/assets/web/capture/index.html`
- `android-capture/app/src/main/assets/web/capture/voice-effects.js`

| 节点 | 状态 | 证据 |
|------|------|------|
| `getUserMedia({ audio: true })` 请求麦克风 | [已阅读] 存在 | voice-effects.js L19 `start()` 调用 `navigator.mediaDevices.getUserMedia({ audio: true })` |
| `AudioContext + createMediaStreamSource` | [已阅读] 存在 | voice-effects.js `buildAudioGraph()` |
| `createMediaStreamDestination`（输出 AudioNode） | [已阅读] 存在 | voice-effects.js `start()` 创建 `mediaStreamDest` |
| `MediaRecorder`（录制输出流为 webm chunks） | [已阅读] 存在 | voice-effects.js `mediaRecorder = new MediaRecorder(stream)` |
| WebSocket 发送 `audio_chunk` | [已阅读] 存在 | capture/index.html WebSocket send blob |
| 5 种变声效果（original/cute/robot/deep/radio） | [已阅读] 存在 | voice-effects.js L27 `EFFECT_MODES` + `buildEffectChain()` |

### 1.2 App Receiver 端（接收端）

- `android-capture/app/src/main/assets/web/receiver/index.html`

| 节点 | 状态 | 证据 |
|------|------|------|
| WebSocket 接收消息 | [已阅读] 存在 | receiver/index.html L1928 `new WebSocket(wsUrl)` |
| 解析 `audio_chunk` 消息 | [已阅读] 存在 | receiver/index.html L1832+ `onWsMessage` 处理 |
| `MediaSource + SourceBuffer` 流式播放 | [已阅读] 存在 | receiver/index.html L1787 `initMediaSource()`, L1796 `new MediaSource()`, L1801 `addSourceBuffer()` |
| 接收端变声 preset 同步 | [已阅读] 存在 | receiver/index.html L1953 `appState.voicePreset = msg.effectMode` |

### 1.3 Web 端（contest demo）

- `src/contest-demo/contest-interactive-demo.js`
- `src/contest-demo/contest-voice-adapter.js`
- `src/face-tracking/voice-changer.js`

| 节点 | 状态 | 证据 |
|------|------|------|
| `VOICE_PRESETS` 数据（5 种） | [已阅读] 存在 | L30-36 `original/cute/robot/deep/radio` |
| `ContestVoiceAdapter`（复用主项目 VoiceChanger） | [已阅读] 存在 | contest-voice-adapter.js L39 |
| `toggleVoice()` 开关 | [已阅读] 存在 | JS L982 |
| `toggleMicMonitor()` 监听按钮 | [已阅读] 存在（本轮恢复） | JS L1538+ |
| **Preset selector UI** | [已阅读] **缺失** | HTML 无下拉/按钮组选择 preset |

---

## 2. 缺口

### 2.1 Contest Demo 网页端

- ❌ 无 voice preset selector UI（数据有，UI 无）
- ❌ `state.voicePreset` 硬编码为 `'original'`，无 UI 可变更
- ❌ contest-voice-adapter.js 的 `setPreset()` 方法已实现（L158+），但从未被 contest demo HTML 调用
- ❌ 未验证真实音频链路（仅 mock/UI 层面）

### 2.2 App 真机端

- [未验证] `getUserMedia({ audio })` 在 Android WebView 中是否 resolve
- [未验证] `MediaRecorder` 在 Android WebView 中是否可用
- [未验证] WebSocket 音频帧传输延迟和丢包
- [未验证] `MediaSource + SourceBuffer` 在 Android WebView 中是否正常播放
- [未验证] 播放是否真实可听见

---

## 3. 不需要设备可以测什么

| 测试项 | 方式 | 状态 |
|--------|------|------|
| voice preset UI selector 存在性 | Playwright DOM 检查 | [未开始] |
| VOICE_PRESETS 数据完整性 | 静态代码检查 | [已核对] 5 种 preset |
| voice adapter 状态机 | 单元测试 mock VoiceChanger | [未开始] |
| monitorBtn 功能 | Playwright 不授权麦克风 → 错误提示 | [未开始] |
| toggleVoice + display 联动 | Playwright DOM 检查 | [未开始] |

---

## 4. 需要真机时测什么

| 测试项 | 判定标准 |
|--------|----------|
| `getUserMedia audio` | resolve → startVoiceCapture 成功 |
| `MediaRecorder` 启动 | `MediaRecorder.start()` 无异常 |
| `audio_chunk` 发送 | WebSocket blob 消息到达 receiver |
| `audio_chunk` 接收 | SourceBuffer append 成功 |
| 播放状态 | `audioElement.playbackState` → "playing" |
| 实际可听见 | 人耳确认（不可自动化） |

---

## 5. 成功判定标准（用于真机测试时检查）

```
startVoiceCapture     → getUserMedia audio resolve
getUserMedia resolve  → AudioContext + MediaStreamSource 创建
MediaRecorder started → mediaRecorder.start() 无异常
audio_chunk_sent      → WebSocket send(blob) 成功
audio_chunk_received  → onmessage 收到 audio_chunk 类型
SourceBuffer append   → sourceBuffer.appendBuffer() 成功
playbackState         → audioElement.playbackState === "playing"
actual audible sound  → 人耳确认声音可听
```

---

## 6. 当前最准确状态

- App 端音频代码框架完整，从麦克风采集 → 变声处理 → MediaRecorder → WebSocket → SourceBuffer 播放链路已实现 [已阅读]
- 未做任何真机验证 [未验证]
- Contest demo 的 voice preset 数据存在但 UI selector 缺失 [已核对]
- ContestVoiceAdapter 复用主项目 VoiceChanger，setPreset 已实现但未被 UI 调用 [已核对]
- 在设备被用户占用期间，不做任何真机操作 [遵循规则]
