/**
 * CheapLive Voice Changer - 纯本地实时变声
 *
 * 双引擎架构：
 * - Native Web Audio effects = 默认可用路径（滤波器、增益、调制）
 * - SoundTouchJS pitch shifting = 可选增强路径（CDN + 本地回退）
 *
 * SoundTouch 不可用时自动 fallback 到 native，不阻塞普通变声启动。
 */

// ---- 状态机 ----
const VC_STATES = [
  'idle',
  'checking-support',
  'loading-engine',
  'creating-audio-context',
  'resuming-audio-context',
  'requesting-mic',
  'mic-stream-created',
  'creating-source-node',
  'creating-processor',
  'connecting-graph',
  'enabled',
  'disabled',
  'error',
  'unsupported',
];

class VoiceChanger {
  constructor(options = {}) {
    this._window = options.window || (typeof globalThis !== 'undefined' ? globalThis.window : (typeof window !== 'undefined' ? window : undefined));
    this._document = options.document || (typeof globalThis !== 'undefined' ? globalThis.document : (typeof document !== 'undefined' ? document : undefined));
    this._navigator = options.navigator || (typeof globalThis !== 'undefined' ? globalThis.navigator : (typeof navigator !== 'undefined' ? navigator : undefined));

    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.soundTouch = null;
    this.isActive = false;
    this.pitch = 1.0;
    this.tempo = 1.0;
    this.rate = 1.0;
    this.stream = null;
    this.outputGain = null;
    this.inputGain = null;

    this.initialized = false;
    this.started = false;

    this.monitorMode = 'changed';
    this.bypassGain = null;

    // ---- 双引擎 ----
    this.engineMode = 'native';       // 'native' | 'soundtouch' | 'fallback'
    this._soundTouchUsable = false;
    this._soundTouchApiDetail = null; // detectSoundTouchApi() 结果
    this._currentPreset = 'normal';

    // ---- 状态机 ----
    this._state = 'idle';
    this._lastError = null;
    this._failStage = null;
    this._lastFailureDiagnostics = null;
    this._engineSource = null;

    this.presets = {
      normal: { pitch: 1.0, tempo: 1.0,  name: '原声',          native: 'normal' },
      cute:   { pitch: 1.5, tempo: 1.05, name: '基础可爱声效',    native: 'cute' },
      robot:  { pitch: 1.0, tempo: 1.0,  name: '基础机器人声效',  native: 'robot' },
      deep:   { pitch: 0.7, tempo: 0.95, name: '基础低沉声效',    native: 'deep' },
      radio:  { pitch: 0.9, tempo: 1.0,  name: '基础收音机声效',  native: 'radio' },
    };

    // Native Web Audio 效果节点
    this._nativeEffects = {};

    // 段落模式状态
    this.mode = 'realtime';
    this.paragraphBuffer = [];
    this.paragraphRecorder = null;
    this.isRecording = false;
    this.paragraphDestination = null;
    this.paragraphSource = null;
    this.onParagraphComplete = null;
  }

  // ---- 状态机 API ----
  get state() { return this._state; }
  get lastError() { return this._lastError; }
  get engineSource() { return this._engineSource; }
  get failStage() { return this._failStage; }

  _setState(state, error = null) {
    if (!VC_STATES.includes(state)) return;
    this._state = state;
    if (error) {
      this._lastError = error;
      this._failStage = state;
      this._lastFailureDiagnostics = this._snapshotDiagnostics(error);
    }
  }

  _changeStage(stage) {
    if (VC_STATES.includes(stage)) {
      this._state = stage;
    }
  }

  _snapshotDiagnostics(error) {
    return {
      state: this._state,
      failStage: this._state,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || '未知错误',
      audioContext: {
        state: this.audioContext ? this.audioContext.state : 'none',
        sampleRate: this.audioContext ? this.audioContext.sampleRate : null,
      },
      mic: {
        hasStream: !!this.stream,
        tracksActive: this.stream ? this.stream.getAudioTracks().every(t => t.readyState === 'live') : false,
        trackCount: this.stream ? this.stream.getAudioTracks().length : 0,
      },
      graph: {
        connected: this.isActive && !!this.source && !!this.processor,
        hasSource: !!this.source,
        hasProcessor: !!this.processor,
        hasInputGain: !!this.inputGain,
        hasOutputGain: !!this.outputGain,
      },
      engine: {
        source: this._engineSource || 'not-loaded',
        loaded: !!(this._window?.soundtouch),
        mode: this.engineMode,
        soundTouchUsable: this._soundTouchUsable,
      },
      support: this.isSupported(),
    };
  }

  // ---- 诊断性支持检查 ----
  isSupported() {
    const details = {
      webAudio: false,
      getUserMedia: false,
      secureContext: !!(this._window?.isSecureContext),
    };
    const reasons = [];
    const hasAudioCtx = !!(this._window?.AudioContext || this._window?.webkitAudioContext);
    details.webAudio = hasAudioCtx;
    if (!hasAudioCtx) reasons.push('浏览器不支持 Web Audio API');
    const hasGetUserMedia = !!(this._navigator?.mediaDevices?.getUserMedia);
    details.getUserMedia = hasGetUserMedia;
    if (!hasGetUserMedia) reasons.push('浏览器不支持麦克风输入 (getUserMedia)');
    if (!details.secureContext) reasons.push('当前页面不是安全上下文，麦克风可能不可用');
    return { supported: reasons.length === 0, reasons, details };
  }

  // ---- 获取完整诊断信息 ----
  getDiagnostics() {
    const sup = this.isSupported();
    return {
      state: this._state,
      failStage: this._failStage,
      support: sup,
      engine: {
        source: this._engineSource || 'not-loaded',
        loaded: !!(this._window?.soundtouch),
        mode: this.engineMode,
        soundTouchUsable: this._soundTouchUsable,
        soundTouchScript: this._engineSource || 'not-loaded',
        soundTouchKeys: this._soundTouchApiDetail?.keys || [],
        soundTouchDetail: this._soundTouchApiDetail?.reason || '',
      },
      audioContext: {
        state: this.audioContext ? this.audioContext.state : 'none',
        sampleRate: this.audioContext ? this.audioContext.sampleRate : null,
      },
      mic: {
        hasStream: !!this.stream,
        tracksActive: this.stream ? this.stream.getAudioTracks().every(t => t.readyState === 'live') : false,
        trackCount: this.stream ? this.stream.getAudioTracks().length : 0,
      },
      graph: {
        connected: this.isActive && !!this.source && !!this.processor,
        hasSource: !!this.source,
        hasProcessor: !!this.processor,
        hasInputGain: !!this.inputGain,
        hasOutputGain: !!this.outputGain,
        nativeGraph: this._isNativeGraphConnected(),
      },
      current: {
        preset: this._currentPreset,
        pitch: this.pitch,
        tempo: this.tempo,
        rate: this.rate,
        monitorMode: this.monitorMode,
        pitchShift: this.engineMode === 'soundtouch' ? 'available' : 'unavailable (native fallback)',
      },
      lastError: this._lastError ? {
        name: this._lastError.name || 'Error',
        message: this._lastError.message,
      } : null,
      lastFailure: this._lastFailureDiagnostics,
    };
  }

  _isNativeGraphConnected() {
    if (this.engineMode !== 'native') return false;
    return !!this._nativeEffects.filterNode;
  }

  // ---- SoundTouch API 检测 ----
  /**
   * 检测 window.soundtouch 的实际 API shape。
   * 返回 { usable: boolean, keys: string[], reason: string }
   */
  detectSoundTouchApi() {
    if (this._soundTouchApiDetail) return this._soundTouchApiDetail;
    const w = this._window;
    const result = { usable: false, keys: [], reason: '' };

    // 检查全局 soundtouch 命名空间
    const st = w?.soundtouch;
    const stKeys = st ? Object.keys(st).filter(k => typeof st[k] === 'function') : [];

    if (!st) {
      result.reason = 'window.soundtouch 不存在';
      result.keys = [];
    } else if (!st.SoundTouch) {
      result.reason = 'window.soundtouch 存在但缺少 SoundTouch 构造函数';
      result.keys = stKeys;
    } else if (!st.Float32AudioBuffer) {
      result.reason = 'window.soundtouch.SoundTouch 存在但缺少 Float32AudioBuffer';
      result.keys = stKeys;
    } else {
      // 尝试验证 API shape
      try {
        const testST = new st.SoundTouch(44100, 1);
        if (typeof testST.putSamples !== 'function' || typeof testST.receiveSamples !== 'function') {
          result.reason = 'SoundTouch 实例缺少 putSamples/receiveSamples 方法';
          result.keys = stKeys;
        } else {
          const testBuf = new st.Float32AudioBuffer(128);
          if (!testBuf.vector) {
            result.reason = 'Float32AudioBuffer 缺少 vector 属性';
            result.keys = stKeys;
          } else {
            result.usable = true;
            result.keys = stKeys;
          }
        }
      } catch (e) {
        result.reason = 'SoundTouch API 验证失败: ' + (e.message || '');
        result.keys = stKeys;
      }
    }

    if (!result.usable && !result.reason) {
      result.reason = 'SoundTouch API 不可用';
    }

    this._soundTouchApiDetail = result;
    this._soundTouchUsable = result.usable;
    return result;
  }

  // ---- 初始化 ----
  async init() {
    if (this.initialized) return;

    // 加载 SoundTouch（不阻塞，失败仅标记）
    this._changeStage('loading-engine');
    await this._loadSoundTouchOptional();

    // 检测 SoundTouch API
    this.detectSoundTouchApi();

    // 决定引擎模式
    if (this._soundTouchUsable) {
      this.engineMode = 'soundtouch';
    } else {
      this.engineMode = 'native';
    }

    this._changeStage('creating-audio-context');
    const AudioContextCtor = this._window?.AudioContext || this._window?.webkitAudioContext;
    if (!AudioContextCtor) {
      this._setState('unsupported', new Error('浏览器不支持 Web Audio API'));
      throw new Error('浏览器不支持 Web Audio API');
    }
    this.audioContext = new AudioContextCtor();

    this.inputGain = this.audioContext.createGain();
    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = 0.8;

    this.bypassGain = this.audioContext.createGain();
    this.bypassGain.gain.value = 0;

    // 创建 ScriptProcessor（双引擎共用）
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => this.processAudio(e);

    // 连接基础链路
    this.inputGain.connect(this.processor);
    this.processor.connect(this.outputGain);
    this.outputGain.connect(this.audioContext.destination);

    this.inputGain.connect(this.bypassGain);
    this.bypassGain.connect(this.audioContext.destination);

    this.applyMonitorMode();
    this.initialized = true;
  }

  // ---- SoundTouch 加载（可选，不抛 fatal）----
  async _loadSoundTouchOptional() {
    if (this._window?.soundtouch) {
      this._engineSource = 'preloaded';
      return;
    }
    if (!this._document) return;

    const urls = [
      { src: 'https://cdn.jsdelivr.net/npm/soundtouchjs@0.1.29/dist/soundtouch.min.js', label: 'cdn' },
      { src: './lib/soundtouch.min.js', label: 'local' },
    ];

    for (const { src, label } of urls) {
      try {
        await new Promise((resolve, reject) => {
          const script = this._document.createElement('script');
          script.src = src;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('加载失败'));
          this._document.head.appendChild(script);
        });
        this._engineSource = label;
        return;
      } catch (e) {}
    }
    this._engineSource = 'failed';
  }

  // ---- 启动变声 ----
  async start(existingStream) {
    if (this.started) return;

    this._changeStage('checking-support');
    const sup = this.isSupported();
    if (!sup.supported) {
      this._setState('unsupported', new Error(sup.reasons.join('; ')));
      throw new Error(sup.reasons.join('; '));
    }

    await this.init();

    // AudioContext resume
    this._changeStage('resuming-audio-context');
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        this._setState('error', e);
        throw new Error('AudioContext 恢复失败: ' + e.message);
      }
    }

    // 麦克风
    let stream = existingStream;
    if (!stream) {
      this._changeStage('requesting-mic');
      if (!this._navigator?.mediaDevices?.getUserMedia) {
        this._setState('unsupported', new Error('浏览器不支持麦克风输入'));
        throw new Error('浏览器不支持麦克风输入');
      }
      try {
        stream = await this._navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        this._setState('error', err);
        throw this._classifyGetUserMediaError(err);
      }
    }
    this._changeStage('mic-stream-created');
    this.stream = stream;

    // 创建音频源
    this._changeStage('creating-source-node');
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
    try {
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.inputGain);
    } catch (e) {
      this._setState('error', e);
      throw new Error('音频源节点创建失败: ' + e.message);
    }

    // 根据引擎模式初始化
    this._changeStage('creating-processor');
    if (this.engineMode === 'soundtouch') {
      try {
        this._initSoundTouch();
      } catch (e) {
        // SoundTouch 初始化失败，fallback 到 native
        this.engineMode = 'fallback';
        this._initNativeEffects();
      }
    } else {
      this._initNativeEffects();
    }

    // 应用当前预设
    this._applyNativePreset(this._currentPreset);

    this._changeStage('connecting-graph');
    this.isActive = true;
    this.started = true;
    this._setState('enabled');
  }

  // ---- SoundTouch 初始化 ----
  _initSoundTouch() {
    const st = this._window?.soundtouch;
    if (!st?.SoundTouch) throw new Error('SoundTouch 不可用');
    this.soundTouch = new st.SoundTouch(this.audioContext.sampleRate, 1);
    this.soundTouch.pitch = this.pitch;
    this.soundTouch.tempo = this.tempo;
    this.soundTouch.rate = this.rate;
  }

  // ---- Native Web Audio 效果初始化 ----
  _initNativeEffects() {
    const ctx = this.audioContext;
    if (!ctx) return;

    // 清理旧节点
    this._destroyNativeEffects();

    // 创建效果节点
    // inputGain → filterNode → waveshaper → compressor → outputGain
    this._nativeEffects.filterNode = ctx.createBiquadFilter();
    this._nativeEffects.filterNode.type = 'lowshelf';
    this._nativeEffects.filterNode.frequency.value = 1000;

    this._nativeEffects.waveshaper = ctx.createWaveShaper();
    this._nativeEffects.waveshaper.oversample = 'none';

    this._nativeEffects.compressor = ctx.createDynamicsCompressor();
    this._nativeEffects.compressor.threshold.value = -24;
    this._nativeEffects.compressor.ratio.value = 12;
    this._nativeEffects.compressor.attack.value = 0.003;
    this._nativeEffects.compressor.release.value = 0.25;

    // 连接效果链：inputGain → filter → waveshaper → compressor → processor
    this.inputGain.disconnect();
    this.inputGain.connect(this._nativeEffects.filterNode);
    this._nativeEffects.filterNode.connect(this._nativeEffects.waveshaper);
    this._nativeEffects.waveshaper.connect(this._nativeEffects.compressor);
    this._nativeEffects.compressor.connect(this.processor);
  }

  _destroyNativeEffects() {
    const ef = this._nativeEffects;
    if (ef.filterNode) { try { ef.filterNode.disconnect(); } catch (e) {} ef.filterNode = null; }
    if (ef.waveshaper) { try { ef.waveshaper.disconnect(); } catch (e) {} ef.waveshaper = null; }
    if (ef.compressor) { try { ef.compressor.disconnect(); } catch (e) {} ef.compressor = null; }
  }

  // ---- Native preset 效果 ----
  _applyNativePreset(presetKey) {
    const ef = this._nativeEffects;
    if (!ef.filterNode || !ef.waveshaper || !ef.compressor) return;

    switch (presetKey) {
      case 'normal':
        // 原声：旁路效果链
        ef.filterNode.type = 'allpass';
        ef.filterNode.frequency.value = 1000;
        ef.waveshaper.curve = null;
        ef.compressor.threshold.value = -50;
        ef.compressor.ratio.value = 1;
        break;

      case 'cute':
        // 基础可爱声效：highpass + 轻微失真
        ef.filterNode.type = 'highpass';
        ef.filterNode.frequency.value = 600;
        ef.waveshaper.curve = this._makeCurve(30);
        ef.compressor.threshold.value = -30;
        ef.compressor.ratio.value = 4;
        break;

      case 'robot':
        // 基础机器人声效：ring modulation via waveshaper
        ef.filterNode.type = 'bandpass';
        ef.filterNode.frequency.value = 1500;
        ef.filterNode.Q.value = 2;
        ef.waveshaper.curve = this._makeRobotCurve();
        ef.compressor.threshold.value = -20;
        ef.compressor.ratio.value = 8;
        break;

      case 'deep':
        // 基础低沉声效：lowpass + bass boost + 压缩
        ef.filterNode.type = 'lowshelf';
        ef.filterNode.frequency.value = 300;
        ef.filterNode.gain.value = 15;
        ef.waveshaper.curve = this._makeSoftClipCurve();
        ef.compressor.threshold.value = -20;
        ef.compressor.ratio.value = 6;
        break;

      case 'radio':
        // 基础收音机声效：bandpass + 失真 + 压缩
        ef.filterNode.type = 'bandpass';
        ef.filterNode.frequency.value = 2000;
        ef.filterNode.Q.value = 0.5;
        ef.waveshaper.curve = this._makeCurve(80);
        ef.compressor.threshold.value = -24;
        ef.compressor.ratio.value = 10;
        break;
    }
  }

  // ---- Waveshaper 曲线生成 ----
  _makeCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = i * 2 / samples - 1;
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  _makeSoftClipCurve() {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = i * 2 / samples - 1;
      // tanh 近似软削波
      curve[i] = Math.tanh(x * 2);
    }
    return curve;
  }

  _makeRobotCurve() {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = i * 2 / samples - 1;
      // 量化/阶梯效果模拟机器人声
      curve[i] = Math.round(x * 4) / 4;
    }
    return curve;
  }

  // ---- getUserMedia 错误分类 ----
  _classifyGetUserMediaError(err) {
    const name = err.name || 'UnknownError';
    switch (name) {
      case 'NotAllowedError':
        return new Error('麦克风权限被拒绝：请在浏览器设置中允许麦克风访问');
      case 'NotFoundError':
        return new Error('未检测到麦克风设备：请检查麦克风是否已连接');
      case 'NotReadableError':
        return new Error('麦克风被其他应用占用：请关闭其他使用麦克风的程序后重试');
      case 'SecurityError':
        return new Error('安全策略限制：请使用 HTTPS 或 localhost 访问');
      case 'OverconstrainedError':
        return new Error('麦克风不满足音频约束条件');
      default:
        return new Error('麦克风访问失败 (' + name + '): ' + err.message);
    }
  }

  // ---- 停止变声 ----
  stop() {
    this.isActive = false;
    this.started = false;
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getAudioTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this._state === 'enabled') {
      this._setState('disabled');
    }
  }

  // ---- 音频处理 ----
  processAudio(e) {
    if (!this.isActive) return;

    if (this.soundTouch && (this.engineMode === 'soundtouch' || this.engineMode === 'fallback')) {
      this._processSoundTouch(e);
    } else {
      this._processNative(e);
    }
  }

  _processSoundTouch(e) {
    const st = this._window?.soundtouch;
    if (!st || !this.soundTouch) return;
    const inputData = e.inputBuffer.getChannelData(0);
    const outputData = e.outputBuffer.getChannelData(0);
    let inputBuffer, outputBuffer, received;
    try {
      inputBuffer = new st.Float32AudioBuffer(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        inputBuffer.vector[i] = inputData[i];
      }
      this.soundTouch.putSamples(inputBuffer);
      outputBuffer = new st.Float32AudioBuffer(outputData.length);
      received = this.soundTouch.receiveSamples(outputBuffer);
    } catch (err) {
      // SoundTouch 运行时异常，静默处理
      for (let i = 0; i < outputData.length; i++) outputData[i] = 0;
      return;
    }
    for (let i = 0; i < outputData.length; i++) {
      outputData[i] = i < received ? outputBuffer.vector[i] : 0;
    }
  }

  _processNative(e) {
    // Native 模式：效果链在 inputGain → filter → waveshaper → compressor → processor
    // ScriptProcessor 的 onaudioprocess 已通过效果链接收数据
    // 直接复制输入到输出（效果链已处理）
    const inputData = e.inputBuffer.getChannelData(0);
    const outputData = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < outputData.length; i++) {
      outputData[i] = inputData[i];
    }
  }

  // ---- 参数控制 ----
  setPitch(value) {
    this.pitch = value;
    if (this.soundTouch) this.soundTouch.pitch = value;
  }

  setTempo(value) {
    this.tempo = value;
    if (this.soundTouch) this.soundTouch.tempo = value;
  }

  setRate(value) {
    this.rate = value;
    if (this.soundTouch) this.soundTouch.rate = value;
  }

  applyPreset(presetKey) {
    const preset = this.presets[presetKey];
    if (!preset) return;
    this._currentPreset = presetKey;
    this.setPitch(preset.pitch);
    this.setTempo(preset.tempo);

    // Native 引擎：应用实际效果
    if (this.engineMode === 'native' || this.engineMode === 'fallback') {
      this._applyNativePreset(presetKey);
    }
  }

  setVolume(value) {
    if (this.outputGain) this.outputGain.gain.value = value;
  }

  // ---- 监听模式 ----
  setMonitorMode(mode) {
    if (!['changed', 'original', 'mute'].includes(mode)) return;
    this.monitorMode = mode;
    this.applyMonitorMode();
  }

  applyMonitorMode() {
    if (!this.outputGain || !this.bypassGain) return;
    switch (this.monitorMode) {
      case 'original':
        this.bypassGain.gain.value = 0.8;
        this.outputGain.gain.value = 0;
        break;
      case 'changed':
        this.bypassGain.gain.value = 0;
        this.outputGain.gain.value = 0.8;
        break;
      case 'mute':
        this.bypassGain.gain.value = 0;
        this.outputGain.gain.value = 0;
        break;
    }
  }

  getProcessedStream() {
    if (!this.audioContext || !this.processor) return null;
    if (!this._processedDest) {
      this._processedDest = this.audioContext.createMediaStreamDestination();
      this.outputGain.connect(this._processedDest);
    }
    return this._processedDest.stream;
  }

  // ---- 销毁 ----
  destroy() {
    this.stop();
    this._destroyNativeEffects();
    if (this.source) { try { this.source.disconnect(); } catch (e) {} this.source = null; }
    if (this.inputGain) { try { this.inputGain.disconnect(); } catch (e) {} this.inputGain = null; }
    if (this.processor) { try { this.processor.disconnect(); } catch (e) {} this.processor.onaudioprocess = null; this.processor = null; }
    if (this.outputGain) { try { this.outputGain.disconnect(); } catch (e) {} this.outputGain = null; }
    if (this.bypassGain) { try { this.bypassGain.disconnect(); } catch (e) {} this.bypassGain = null; }
    if (this._processedDest) { try { this._processedDest.disconnect(); } catch (e) {} this._processedDest = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    this.initialized = false;
    this.started = false;
    this.soundTouch = null;
    this._setState('idle');
  }

  // ---- 模式切换 ----
  setMode(mode) {
    if (mode !== 'realtime' && mode !== 'paragraph') return;
    if (this.mode === mode) return;
    if (this.mode === 'paragraph' && this.isRecording) {
      this.stopParagraphRecording();
    }
    this.mode = mode;
    if (this.mode === 'realtime' && this.started && !this.isActive) {
      this.startRealtime();
    }
  }

  async startRealtime() {
    if (this.started && this.isActive) return;
    if (!this.initialized) await this.init();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (!this.source && this.stream) {
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.inputGain);
    }
    if (this.engineMode === 'soundtouch' && !this.soundTouch) {
      this._initSoundTouch();
    }
    this.isActive = true;
  }

  stopRealtime() {
    this.isActive = false;
    if (this.source) { this.source.disconnect(); this.source = null; }
    if (this.soundTouch) { this.soundTouch = null; }
  }

  async startParagraphRecording() {
    if (this.mode !== 'paragraph') return;
    if (this.isRecording) return;
    await this.init();
    if (!this.stream) {
      if (!this._navigator?.mediaDevices?.getUserMedia) {
        throw new Error('当前环境不支持音频输入');
      }
      this.stream = await this._navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.isRecording = true;
    this.paragraphBuffer = [];
    this.paragraphDestination = this.audioContext.createMediaStreamDestination();
    this.paragraphRecorder = new MediaRecorder(this.paragraphDestination.stream);
    this.paragraphRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.paragraphBuffer.push(e.data);
    };
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.paragraphDestination);
    this.paragraphRecorder.start(100);
  }

  async stopParagraphRecording() {
    if (!this.isRecording || !this.paragraphRecorder) return;
    return new Promise((resolve) => {
      this.paragraphRecorder.onstop = async () => {
        this.isRecording = false;
        if (this.paragraphBuffer.length === 0) { resolve(); return; }
        const blob = new Blob(this.paragraphBuffer, { type: 'audio/webm' });
        await this.processAndPlayParagraph(blob);
        resolve();
      };
      this.paragraphRecorder.stop();
    });
  }

  async processAndPlayParagraph(blob) {
    if (!this.audioContext) return;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputGain);
      source.onended = () => {
        source.disconnect();
        if (this.onParagraphComplete) this.onParagraphComplete();
      };
      source.start(0);
    } catch (err) {
      console.error('段落模式处理失败:', err);
    }
  }
}

export { VoiceChanger };