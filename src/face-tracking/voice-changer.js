/**
 * CheapLive Voice Changer - 纯本地实时变声
 *
 * 技术方案：Web Audio API + SoundTouchJS (CDN)
 * 纯本地处理，音频数据不上传服务器
 *
 * 功能：
 * - 音调调整（Pitch Shift）：男声↔女声
 * - 速度调整（Tempo）：快放/慢放
 * - 预设模式：原声、萝莉、大叔、机器人、怪兽
 */

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

    this.presets = {
      normal: { pitch: 1.0, tempo: 1.0, name: '原声' },
      loli: { pitch: 1.5, tempo: 1.05, name: '萝莉' },
      uncle: { pitch: 0.7, tempo: 0.95, name: '大叔' },
      robot: { pitch: 1.0, tempo: 1.0, name: '机器人' },
      monster: { pitch: 0.5, tempo: 0.8, name: '怪兽' },
    };

    // 段落模式状态
    this.mode = 'realtime'; // 'realtime' | 'paragraph'
    this.paragraphBuffer = [];
    this.paragraphRecorder = null;
    this.isRecording = false;
    this.paragraphDestination = null;
    this.paragraphSource = null;
    this.onParagraphComplete = null;
  }

  async init() {
    if (this.initialized) return;

    const AudioContextCtor = this._window?.AudioContext || this._window?.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('当前环境不支持 Web Audio API');
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

    // 回声/反馈环路警告：
    // inputGain 同时连接到 processor（变声链路）和 bypassGain（原声旁路），
    // 两者最终都输出到 audioContext.destination（本地扬声器）。
    // 如果麦克风能拾取到扬声器输出的声音，会形成声学反馈回路，产生回声或啸叫。
    // 建议：使用耳机进行本地监听，或将 monitorMode 设为 'mute' 以关闭本地播放。
    // applyMonitorMode('mute') 会将 outputGain 和 bypassGain 同时置零，完全切断本地输出。

    // 根据监听模式设置增益
    this.applyMonitorMode();

    this.initialized = true;
  }

  isSupported() {
    const hasAudio = !!(this._window?.AudioContext || this._window?.webkitAudioContext);
    const hasMedia = !!(this._navigator?.mediaDevices?.getUserMedia);
    return hasAudio && hasMedia;
  }

  async loadSoundTouch() {
    if (this._window?.soundtouch) return;
    if (!this._document) {
      throw new Error('当前环境不支持动态加载脚本');
    }
    return new Promise((resolve, reject) => {
      const script = this._document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/soundtouchjs@0.1.29/dist/soundtouch.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('SoundTouchJS 加载失败：请检查网络连接'));
      this._document.head.appendChild(script);
    });
  }

  async start(existingStream) {
    if (this.started) return;
    await this.init();

    // 关键修复：Chrome/Edge 的 AudioContext 默认处于 suspended 状态，
    // 需要 resume() 才能真正开始处理音频
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // 如果传入了已有流则复用，否则主动请求麦克风
    let stream = existingStream;
    if (!stream) {
      if (!this._navigator?.mediaDevices?.getUserMedia) {
        throw new Error('当前环境不支持音频输入');
      }
      stream = await this._navigator.mediaDevices.getUserMedia({ audio: true });
    }
    this.stream = stream;

    // 断开旧的 source（如果有）
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    // 从 MediaStream 创建音频源
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.inputGain);

    // 初始化 SoundTouch
    if (!this._window?.soundtouch) {
      throw new Error('SoundTouchJS 未正确加载');
    }
    this.soundTouch = new this._window.soundtouch.SoundTouch(
      this.audioContext.sampleRate,
      1 // 单声道
    );
    this.soundTouch.pitch = this.pitch;
    this.soundTouch.tempo = this.tempo;
    this.soundTouch.rate = this.rate;

    this.isActive = true;
    this.started = true;
  }

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
  }

  processAudio(e) {
    if (!this.isActive || !this.soundTouch) return;

    const inputData = e.inputBuffer.getChannelData(0);
    const outputData = e.outputBuffer.getChannelData(0);
    const st = this._window?.soundtouch;
    if (!st) return;

    // 将输入数据放入 SoundTouch
    const inputBuffer = new st.Float32AudioBuffer(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      inputBuffer.vector[i] = inputData[i];
    }

    this.soundTouch.putSamples(inputBuffer);

    // 从 SoundTouch 取出处理后的数据
    const outputBuffer = new st.Float32AudioBuffer(outputData.length);
    const received = this.soundTouch.receiveSamples(outputBuffer);

    // 复制到输出
    for (let i = 0; i < outputData.length; i++) {
      outputData[i] = i < received ? outputBuffer.vector[i] : 0;
    }
  }

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

  // 设置监听模式
  setMonitorMode(mode) {
    this.monitorMode = mode;
    this.applyMonitorMode();
  }

  applyMonitorMode() {
    if (!this.outputGain || !this.bypassGain) return;
    switch (this.monitorMode) {
      case 'original':
        // 听原声：旁路开启，变声链路静音
        this.bypassGain.gain.value = 0.8;
        this.outputGain.gain.value = 0;
        break;
      case 'changed':
        // 听变声：旁路静音，变声链路开启
        this.bypassGain.gain.value = 0;
        this.outputGain.gain.value = 0.8;
        break;
      case 'mute':
        // 静音监听：两边都静音
        this.bypassGain.gain.value = 0;
        this.outputGain.gain.value = 0;
        break;
    }
  }

  // 获取变声后的音频流（用于推流/录制）
  // 注意：processor 已在 init() 中连接到 outputGain，outputGain 连接到 destination。
  // 这里复用 outputGain 的下游连接，不创建新的 dangling 连接。
  // 调用方应使用返回的 stream 进行推流/录制。
  getProcessedStream() {
    if (!this.audioContext || !this.processor) return null;
    // processor -> outputGain 已在 init() 中建立
    // outputGain -> destination 也在 init() 中建立
    // 使用 outputGain 下游的 MediaStreamDestination 来获取处理后的流
    if (!this._processedDest) {
      this._processedDest = this.audioContext.createMediaStreamDestination();
      this.outputGain.connect(this._processedDest);
    }
    return this._processedDest.stream;
  }

  destroy() {
    this.stop();

    // 完全断开所有音频节点，防止内存泄漏和回声/反馈
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
  }

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
        throw new Error('SoundTouchJS 未正确加载');
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
      throw new Error('SoundTouchJS 未正确加载');
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
