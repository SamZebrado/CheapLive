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
  constructor() {
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

    // 初始化状态标志，防止重复初始化
    this.initialized = false;
    // 启动状态标志，防止重复 start
    this.started = false;

    // 监听模式: 'original' | 'changed' | 'mute'
    // original: 听原声（变声仅推流）
    // changed: 听变声（主播自己听到变声效果）
    // mute: 静音监听（不本地播放，仅推流）
    this.monitorMode = 'changed';

    // 原始音频旁路（用于原声监听模式）
    this.bypassGain = null;

    // 预设模式
    this.presets = {
      normal: { pitch: 1.0, tempo: 1.0, name: '原声' },
      loli: { pitch: 1.5, tempo: 1.05, name: '萝莉' },
      uncle: { pitch: 0.7, tempo: 0.95, name: '大叔' },
      robot: { pitch: 1.0, tempo: 1.0, name: '机器人' },
      monster: { pitch: 0.5, tempo: 0.8, name: '怪兽' },
    };
  }

  async init() {
    if (this.initialized) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

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

  async loadSoundTouch() {
    if (window.soundtouch) return;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/soundtouchjs@0.1.29/dist/soundtouch.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('SoundTouchJS 加载失败'));
      document.head.appendChild(script);
    });
  }

  async start(stream) {
    if (this.started) return;
    await this.init();
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
    this.soundTouch = new window.soundtouch.SoundTouch(
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

    // 将输入数据放入 SoundTouch
    const inputBuffer = new window.soundtouch.Float32AudioBuffer(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      inputBuffer.vector[i] = inputData[i];
    }

    this.soundTouch.putSamples(inputBuffer);

    // 从 SoundTouch 取出处理后的数据
    const outputBuffer = new window.soundtouch.Float32AudioBuffer(outputData.length);
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
}

export { VoiceChanger };
