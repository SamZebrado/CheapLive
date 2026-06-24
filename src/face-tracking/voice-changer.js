/**
 * CheapLive Voice Changer - 纯本地实时变声
 *
 * 技术方案：Web Audio API + SoundTouchJS (CDN + 本地回退)
 * 纯本地处理，音频数据不上传服务器
 *
 * 功能：
 * - 音调调整（Pitch Shift）：男声↔女声
 * - 速度调整（Tempo）：快放/慢放
 * - 预设模式：原声、可爱、机器人、低沉、收音机
 * - 监听模式：变声后监听 / 原声监听 / 静音
 */

// ---- 状态机 ----
const VC_STATES = [
  'idle',                 // 未启动
  'checking-support',     // 正在检查浏览器支持
  'loading-engine',       // 正在加载 SoundTouch
  'requesting-mic',       // 正在请求麦克风权限
  'initializing-audio',   // 正在初始化音频图
  'enabled',              // 变声已启用
  'disabled',             // 用户手动关闭
  'error',                // 遇到错误
  'unsupported',          // 浏览器不支持
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

    // ---- 状态机 ----
    this._state = 'idle';
    this._lastError = null;
    this._engineSource = null; // 'cdn' | 'local' | null

    this.presets = {
      normal:  { pitch: 1.0, tempo: 1.0,  name: '原声' },
      cute:    { pitch: 1.5, tempo: 1.05, name: '可爱' },
      robot:   { pitch: 1.0, tempo: 1.0,  name: '机器人' },
      deep:    { pitch: 0.7, tempo: 0.95, name: '低沉' },
      radio:   { pitch: 0.9, tempo: 1.0,  name: '收音机' },
    };

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

  _setState(state, error = null) {
    if (!VC_STATES.includes(state)) return;
    this._state = state;
    this._lastError = error || null;
  }

  // ---- 诊断性支持检查 ----
  // 返回 { supported: boolean, reasons: string[], details: {...} }
  isSupported() {
    const details = {
      webAudio: false,
      getUserMedia: false,
      secureContext: !!(this._window?.isSecureContext),
    };
    const reasons = [];

    const hasAudioCtx = !!(this._window?.AudioContext || this._window?.webkitAudioContext);
    details.webAudio = hasAudioCtx;
    if (!hasAudioCtx) {
      reasons.push('浏览器不支持 Web Audio API');
    }

    const hasGetUserMedia = !!(this._navigator?.mediaDevices?.getUserMedia);
    details.getUserMedia = hasGetUserMedia;
    if (!hasGetUserMedia) {
      reasons.push('浏览器不支持麦克风输入 (getUserMedia)');
    }

    if (!details.secureContext) {
      reasons.push('当前页面不是安全上下文，麦克风可能不可用');
    }

    return {
      supported: reasons.length === 0,
      reasons,
      details,
    };
  }

  // ---- 获取完整诊断信息 ----
  getDiagnostics() {
    const sup = this.isSupported();
    return {
      state: this._state,
      support: sup,
      engine: {
        source: this._engineSource || 'not-loaded',
        loaded: !!(this._window?.soundtouch),
      },
      audioContext: {
        state: this.audioContext ? this.audioContext.state : 'none',
        sampleRate: this.audioContext ? this.audioContext.sampleRate : null,
      },
      mic: {
        hasStream: !!this.stream,
        tracksActive: this.stream ? this.stream.getAudioTracks().every(t => t.readyState === 'live') : false,
      },
      graph: {
        connected: this.isActive && !!this.source && !!this.processor,
      },
      current: {
        preset: this._getCurrentPresetKey(),
        pitch: this.pitch,
        tempo: this.tempo,
        rate: this.rate,
        monitorMode: this.monitorMode,
      },
      lastError: this._lastError ? this._lastError.message : null,
    };
  }

  _getCurrentPresetKey() {
    for (const [key, p] of Object.entries(this.presets)) {
      if (p.pitch === this.pitch && p.tempo === this.tempo) return key;
    }
    return 'custom';
  }

  // ---- 初始化 ----
  async init() {
    if (this.initialized) return;
    this._setState('loading-engine');

    const AudioContextCtor = this._window?.AudioContext || this._window?.webkitAudioContext;
    if (!AudioContextCtor) {
      this._setState('unsupported', new Error('浏览器不支持 Web Audio API'));
      throw new Error('浏览器不支持 Web Audio API');
    }
    this.audioContext = new AudioContextCtor();

    // 加载 SoundTouchJS
    await this.loadSoundTouch();

    // 创建输入/输出增益节点
    this.inputGain = this.audioContext.createGain();
    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = 0.8;

    // 原始音频旁路节点
    this.bypassGain = this.audioContext.createGain();
    this.bypassGain.gain.value = 0;

    // 创建 ScriptProcessor 用于实时处理
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => this.processAudio(e);

    // 连接变声链路：input -> inputGain -> processor -> outputGain -> destination
    this.inputGain.connect(this.processor);
    this.processor.connect(this.outputGain);
    this.outputGain.connect(this.audioContext.destination);

    // 连接旁路链路（原声监听）：input -> bypassGain -> destination
    this.inputGain.connect(this.bypassGain);
    this.bypassGain.connect(this.audioContext.destination);

    // 根据监听模式设置增益
    this.applyMonitorMode();

    this.initialized = true;
  }

  // ---- SoundTouch 加载（CDN → 本地回退）----
  async loadSoundTouch() {
    if (this._window?.soundtouch) {
      this._engineSource = 'preloaded';
      return;
    }
    if (!this._document) {
      this._setState('error', new Error('当前环境不支持动态加载脚本'));
      throw new Error('当前环境不支持动态加载脚本');
    }

    // 尝试 CDN 加载，失败则回退到本地文件
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
      } catch (e) {
        // 继续尝试下一个 URL
      }
    }
    this._setState('error', new Error('SoundTouch 处理库加载失败'));
    throw new Error('SoundTouch 处理库加载失败');
  }

  // ---- 启动变声 ----
  async start(existingStream) {
    if (this.started) return;
    this._setState('checking-support');

    const sup = this.isSupported();
    if (!sup.supported) {
      this._setState('unsupported', new Error(sup.reasons.join('; ')));
      throw new Error(sup.reasons.join('; '));
    }

    await this.init();

    // AudioContext resume（必须在用户手势链路中）
    this._setState('initializing-audio');
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        this._setState('error', new Error(`AudioContext 恢复失败: ${e.message}`));
        throw new Error(`AudioContext 恢复失败: ${e.message}`);
      }
    }

    // 请求麦克风权限
    let stream = existingStream;
    if (!stream) {
      this._setState('requesting-mic');
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
    this.stream = stream;

    // 断开旧的 source
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    // 从 MediaStream 创建音频源
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.inputGain);

    // 初始化 SoundTouch
    if (!this._window?.soundtouch) {
      this._setState('error', new Error('SoundTouch 处理库未正确加载'));
      throw new Error('SoundTouch 处理库未正确加载');
    }
    this.soundTouch = new this._window.soundtouch.SoundTouch(
      this.audioContext.sampleRate,
      1
    );
    this.soundTouch.pitch = this.pitch;
    this.soundTouch.tempo = this.tempo;
    this.soundTouch.rate = this.rate;

    this.isActive = true;
    this.started = true;
    this._setState('enabled');
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
        return new Error(`麦克风访问失败 (${name}): ${err.message}`);
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
    if (!this.isActive || !this.soundTouch) return;

    const inputData = e.inputBuffer.getChannelData(0);
    const outputData = e.outputBuffer.getChannelData(0);
    const st = this._window?.soundtouch;
    if (!st) return;

    const inputBuffer = new st.Float32AudioBuffer(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      inputBuffer.vector[i] = inputData[i];
    }

    this.soundTouch.putSamples(inputBuffer);

    const outputBuffer = new st.Float32AudioBuffer(outputData.length);
    const received = this.soundTouch.receiveSamples(outputBuffer);

    for (let i = 0; i < outputData.length; i++) {
      outputData[i] = i < received ? outputBuffer.vector[i] : 0;
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
    this.setPitch(preset.pitch);
    this.setTempo(preset.tempo);
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

  // ---- 获取处理后的音频流 ----
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

    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
    if (this.inputGain) {
      try { this.inputGain.disconnect(); } catch (e) {}
      this.inputGain = null;
    }
    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.outputGain) {
      try { this.outputGain.disconnect(); } catch (e) {}
      this.outputGain = null;
    }
    if (this.bypassGain) {
      try { this.bypassGain.disconnect(); } catch (e) {}
      this.bypassGain = null;
    }
    if (this._processedDest) {
      try { this._processedDest.disconnect(); } catch (e) {}
      this._processedDest = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

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

    if (!this.soundTouch) {
      if (!this._window?.soundtouch) {
        throw new Error('SoundTouch 处理库未正确加载');
      }
      this.soundTouch = new this._window.soundtouch.SoundTouch(
        this.audioContext.sampleRate,
        1
      );
      this.soundTouch.pitch = this.pitch;
      this.soundTouch.tempo = this.tempo;
      this.soundTouch.rate = this.rate;
    }

    this.isActive = true;
  }

  stopRealtime() {
    this.isActive = false;
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.soundTouch) {
      this.soundTouch = null;
    }
  }

  // ---- 段落模式 ----
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
      if (e.data && e.data.size > 0) {
        this.paragraphBuffer.push(e.data);
      }
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

        if (this.paragraphBuffer.length === 0) {
          resolve();
          return;
        }

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

      const processedBuffer = await this.applySoundTouchToBuffer(audioBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = processedBuffer;
      source.connect(this.outputGain);

      source.onended = () => {
        source.disconnect();
        if (this.onParagraphComplete) {
          this.onParagraphComplete();
        }
      };

      source.start(0);
    } catch (err) {
      console.error('段落模式处理失败:', err);
    }
  }

  async applySoundTouchToBuffer(audioBuffer) {
    if (!this._window?.soundtouch) {
      await this.loadSoundTouch();
    }
    if (!this._window?.soundtouch) {
      throw new Error('SoundTouch 处理库未正确加载');
    }
    const stNs = this._window.soundtouch;

    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    const st = new stNs.SoundTouch(sampleRate, 1);
    st.pitch = this.pitch;
    st.tempo = this.tempo;
    st.rate = this.rate;

    const inputBuffer = new stNs.Float32AudioBuffer(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      inputBuffer.vector[i] = channelData[i];
    }
    st.putSamples(inputBuffer);

    const outputLength = Math.ceil(channelData.length / this.tempo);
    const outputBuffer = new stNs.Float32AudioBuffer(outputLength);
    const received = st.receiveSamples(outputBuffer);

    const processedAudioBuffer = this.audioContext.createBuffer(
      1,
      received,
      sampleRate
    );
    const outputChannel = processedAudioBuffer.getChannelData(0);
    for (let i = 0; i < received; i++) {
      outputChannel[i] = outputBuffer.vector[i];
    }

    return processedAudioBuffer;
  }
}

export { VoiceChanger };