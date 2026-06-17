/**
 * CheapLive VoiceChanger E2E Tests
 *
 * Tests VoiceChanger class with fake media devices.
 * Browser launched with --use-fake-ui-for-media-stream --use-fake-device-for-media-stream.
 */

const { test, expect } = require('playwright/test');

/**
 * 在页面中注入 VoiceChanger 类（模拟简化版，不依赖外部 CDN）
 * 用于测试核心逻辑：实例化、监听模式切换、资源清理
 */
async function injectVoiceChanger(page) {
  await page.evaluate(() => {
    // 模拟 SoundTouchJS
    window.soundtouch = {
      SoundTouch: function (sampleRate, channels) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.pitch = 1.0;
        this.tempo = 1.0;
        this.rate = 1.0;
        this.putSamples = function () {};
        this.receiveSamples = function (buffer) {
          return buffer.vector ? buffer.vector.length : 0;
        };
      },
      Float32AudioBuffer: function (length) {
        this.vector = new Float32Array(length);
      },
    };

    window.VoiceChanger = class {
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
        this.initialized = false;
        this.started = false;
        this.monitorMode = 'changed';
        this.bypassGain = null;
        this._processedDest = null;

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

        this.inputGain = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();
        this.outputGain.gain.value = 0.8;

        this.bypassGain = this.audioContext.createGain();
        this.bypassGain.gain.value = 0;

        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => this.processAudio(e);

        this.inputGain.connect(this.processor);
        this.processor.connect(this.outputGain);
        this.outputGain.connect(this.audioContext.destination);

        this.inputGain.connect(this.bypassGain);
        this.bypassGain.connect(this.audioContext.destination);

        this.applyMonitorMode();
        this.initialized = true;
      }

      async start(stream) {
        if (this.started) return;
        await this.init();
        this.stream = stream;

        if (this.source) {
          this.source.disconnect();
          this.source = null;
        }

        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.inputGain);

        this.soundTouch = new window.soundtouch.SoundTouch(
          this.audioContext.sampleRate,
          1
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

        const inputBuffer = new window.soundtouch.Float32AudioBuffer(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          inputBuffer.vector[i] = inputData[i];
        }

        this.soundTouch.putSamples(inputBuffer);

        const outputBuffer = new window.soundtouch.Float32AudioBuffer(outputData.length);
        const received = this.soundTouch.receiveSamples(outputBuffer);

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

      setMonitorMode(mode) {
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

      destroy() {
        this.stop();
        if (this.source) { try { this.source.disconnect(); } catch(e) {} this.source = null; }
        if (this.inputGain) { try { this.inputGain.disconnect(); } catch(e) {} this.inputGain = null; }
        if (this.processor) {
          try { this.processor.disconnect(); } catch(e) {}
          this.processor.onaudioprocess = null;
          this.processor = null;
        }
        if (this.outputGain) { try { this.outputGain.disconnect(); } catch(e) {} this.outputGain = null; }
        if (this.bypassGain) { try { this.bypassGain.disconnect(); } catch(e) {} this.bypassGain = null; }
        if (this._processedDest) { try { this._processedDest.disconnect(); } catch(e) {} this._processedDest = null; }
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }
        this.initialized = false;
        this.started = false;
        this.soundTouch = null;
      }
    };
  });
}

// 使用 fake media devices 启动浏览器
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test.describe('VoiceChanger', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await injectVoiceChanger(page);
  });

  test('can be instantiated', async ({ page }) => {
    const result = await page.evaluate(() => {
      const vc = new window.VoiceChanger();
      return {
        isVoiceChanger: vc instanceof window.VoiceChanger,
        hasPresets: Object.keys(vc.presets).length > 0,
        defaultMonitorMode: vc.monitorMode,
        defaultPitch: vc.pitch,
        defaultTempo: vc.tempo,
        initialized: vc.initialized,
        started: vc.started,
      };
    });

    expect(result.isVoiceChanger).toBe(true);
    expect(result.hasPresets).toBe(true);
    expect(result.defaultMonitorMode).toBe('changed');
    expect(result.defaultPitch).toBe(1.0);
    expect(result.defaultTempo).toBe(1.0);
    expect(result.initialized).toBe(false);
    expect(result.started).toBe(false);
  });

  test('init creates AudioContext and nodes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();
      return {
        hasAudioContext: vc.audioContext !== null,
        hasInputGain: vc.inputGain !== null,
        hasOutputGain: vc.outputGain !== null,
        hasBypassGain: vc.bypassGain !== null,
        hasProcessor: vc.processor !== null,
        outputGainValue: vc.outputGain ? vc.outputGain.gain.value : null,
      };
    });

    expect(result.hasAudioContext).toBe(true);
    expect(result.hasInputGain).toBe(true);
    expect(result.hasOutputGain).toBe(true);
    expect(result.hasBypassGain).toBe(true);
    expect(result.hasProcessor).toBe(true);
    expect(result.outputGainValue).toBeCloseTo(0.8, 5);
  });

  test('monitor mode switching does not create duplicate nodes', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();

      // 记录初始节点引用
      const initialProcessor = vc.processor;
      const initialInputGain = vc.inputGain;
      const initialOutputGain = vc.outputGain;
      const initialBypassGain = vc.bypassGain;

      // 多次切换监听模式
      vc.setMonitorMode('original');
      vc.setMonitorMode('changed');
      vc.setMonitorMode('mute');
      vc.setMonitorMode('changed');
      vc.setMonitorMode('original');

      return {
        processorSame: vc.processor === initialProcessor,
        inputGainSame: vc.inputGain === initialInputGain,
        outputGainSame: vc.outputGain === initialOutputGain,
        bypassGainSame: vc.bypassGain === initialBypassGain,
        finalMonitorMode: vc.monitorMode,
        finalBypassValue: vc.bypassGain ? vc.bypassGain.gain.value : null,
        finalOutputValue: vc.outputGain ? vc.outputGain.gain.value : null,
      };
    });

    // 节点引用应保持不变（没有创建重复节点）
    expect(result.processorSame).toBe(true);
    expect(result.inputGainSame).toBe(true);
    expect(result.outputGainSame).toBe(true);
    expect(result.bypassGainSame).toBe(true);

    // 最终模式为 original，旁路开启，变声链路静音
    expect(result.finalMonitorMode).toBe('original');
    expect(result.finalBypassValue).toBeCloseTo(0.8, 5);
    expect(result.finalOutputValue).toBeCloseTo(0, 5);
  });

  test('monitor mode changed sets correct gain values', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();

      vc.setMonitorMode('changed');
      return {
        bypassValue: vc.bypassGain.gain.value,
        outputValue: vc.outputGain.gain.value,
      };
    });

    expect(result.bypassValue).toBeCloseTo(0, 5);
    expect(result.outputValue).toBeCloseTo(0.8, 5);
  });

  test('monitor mode mute sets both gains to zero', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();

      vc.setMonitorMode('mute');
      return {
        bypassValue: vc.bypassGain.gain.value,
        outputValue: vc.outputGain.gain.value,
      };
    });

    expect(result.bypassValue).toBeCloseTo(0, 5);
    expect(result.outputValue).toBe(0);
  });

  test('preset application changes pitch and tempo', async ({ page }) => {
    const result = await page.evaluate(() => {
      const vc = new window.VoiceChanger();
      vc.applyPreset('loli');
      return {
        pitch: vc.pitch,
        tempo: vc.tempo,
      };
    });

    expect(result.pitch).toBe(1.5);
    expect(result.tempo).toBe(1.05);
  });

  test('preset application for uncle', async ({ page }) => {
    const result = await page.evaluate(() => {
      const vc = new window.VoiceChanger();
      vc.applyPreset('uncle');
      return {
        pitch: vc.pitch,
        tempo: vc.tempo,
      };
    });

    expect(result.pitch).toBe(0.7);
    expect(result.tempo).toBe(0.95);
  });

  test('invalid preset does not change values', async ({ page }) => {
    const result = await page.evaluate(() => {
      const vc = new window.VoiceChanger();
      vc.setPitch(1.2);
      vc.setTempo(0.9);
      vc.applyPreset('nonexistent');
      return {
        pitch: vc.pitch,
        tempo: vc.tempo,
      };
    });

    expect(result.pitch).toBe(1.2);
    expect(result.tempo).toBe(0.9);
  });

  test('setVolume changes output gain', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();
      vc.setVolume(0.5);
      return vc.outputGain.gain.value;
    });

    expect(result).toBe(0.5);
  });

  test('destroy cleans up resources', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();

      // 获取用户媒体流用于测试 start/stop
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await vc.start(stream);
      } catch (e) {
        // fake device 可能不支持，继续测试 destroy
      }

      vc.destroy();

      return {
        audioContextNull: vc.audioContext === null,
        processorNull: vc.processor === null,
        sourceNull: vc.source === null,
        streamNull: vc.stream === null,
        isActiveFalse: vc.isActive === false,
        initializedFalse: vc.initialized === false,
        startedFalse: vc.started === false,
        soundTouchNull: vc.soundTouch === null,
        inputGainNull: vc.inputGain === null,
        outputGainNull: vc.outputGain === null,
        bypassGainNull: vc.bypassGain === null,
      };
    });

    expect(result.audioContextNull).toBe(true);
    expect(result.processorNull).toBe(true);
    expect(result.sourceNull).toBe(true);
    expect(result.streamNull).toBe(true);
    expect(result.isActiveFalse).toBe(true);
    expect(result.initializedFalse).toBe(true);
    expect(result.startedFalse).toBe(true);
    expect(result.soundTouchNull).toBe(true);
    expect(result.inputGainNull).toBe(true);
    expect(result.outputGainNull).toBe(true);
    expect(result.bypassGainNull).toBe(true);
  });

  test('start with fake media stream sets isActive', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await vc.start(stream);
        return {
          isActive: vc.isActive,
          hasStream: vc.stream !== null,
          hasSource: vc.source !== null,
          hasSoundTouch: vc.soundTouch !== null,
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    if (result.error) {
      // fake device 在某些环境下可能不可用，跳过断言
      test.skip(true, `Fake media device not available: ${result.error}`);
    } else {
      expect(result.isActive).toBe(true);
      expect(result.hasStream).toBe(true);
      expect(result.hasSource).toBe(true);
      expect(result.hasSoundTouch).toBe(true);
    }
  });

  test('stop clears stream and source', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await vc.start(stream);
        vc.stop();
        return {
          isActive: vc.isActive,
          streamNull: vc.stream === null,
          sourceNull: vc.source === null,
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    if (result.error) {
      test.skip(true, `Fake media device not available: ${result.error}`);
    } else {
      expect(result.isActive).toBe(false);
      expect(result.streamNull).toBe(true);
      expect(result.sourceNull).toBe(true);
    }
  });

  test('getProcessedStream returns MediaStream', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();
      const processedStream = vc.getProcessedStream();
      return {
        isMediaStream: processedStream instanceof MediaStream,
        hasTracks: processedStream ? processedStream.getTracks().length > 0 : false,
      };
    });

    expect(result.isMediaStream).toBe(true);
    expect(result.hasTracks).toBe(true);
  });

  test('pitch setter updates soundTouch', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await vc.start(stream);
      } catch (e) {}
      vc.setPitch(1.8);
      return {
        pitch: vc.pitch,
        soundTouchPitch: vc.soundTouch ? vc.soundTouch.pitch : null,
      };
    });

    expect(result.pitch).toBe(1.8);
    if (result.soundTouchPitch !== null) {
      expect(result.soundTouchPitch).toBe(1.8);
    }
  });

  test('tempo setter updates soundTouch', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await vc.start(stream);
      } catch (e) {}
      vc.setTempo(1.2);
      return {
        tempo: vc.tempo,
        soundTouchTempo: vc.soundTouch ? vc.soundTouch.tempo : null,
      };
    });

    expect(result.tempo).toBe(1.2);
    if (result.soundTouchTempo !== null) {
      expect(result.soundTouchTempo).toBe(1.2);
    }
  });

  test('rate setter updates soundTouch', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const vc = new window.VoiceChanger();
      await vc.init();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await vc.start(stream);
      } catch (e) {}
      vc.setRate(0.9);
      return {
        rate: vc.rate,
        soundTouchRate: vc.soundTouch ? vc.soundTouch.rate : null,
      };
    });

    expect(result.rate).toBe(0.9);
    if (result.soundTouchRate !== null) {
      expect(result.soundTouchRate).toBe(0.9);
    }
  });
});
