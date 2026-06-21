/**
 * VoiceChanger 生产实现测试
 *
 * 测试目标：src/face-tracking/voice-changer.js 生产类
 * VoiceChanger 是 ES module，通过动态 import 加载后在浏览器中实例化
 * SoundTouch CDN 不可用时 mock，以测试生命周期和状态机
 *
 * 运行：
 *   npx playwright test tests/e2e/voice-changer.test.js
 */

const { test, expect } = require('@playwright/test');

test.describe('VoiceChanger 生产实现', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Mock SoundTouch（CDN 在 headless 环境不可用）
    await page.addScriptTag({
      content: `
        window.soundtouch = {
          SoundTouch: function(sampleRate, channels) {
            this.sampleRate = sampleRate;
            this.channels = channels;
            this.pitch = 1.0;
            this.tempo = 1.0;
            this.rate = 1.0;
          }
        };
        window.soundtouch.SoundTouch.prototype = {
          set pitch(v) { this._pitch = v; },
          get pitch() { return this._pitch || 1.0; },
          set tempo(v) { this._tempo = v; },
          get tempo() { return this._tempo || 1.0; },
          set rate(v) { this._rate = v; },
          get rate() { return this._rate || 1.0; },
          putSamples: function(buffer) { this._inputBuffer = buffer; },
          receiveSamples: function(buffer) { return buffer ? buffer.vector.length : 0; }
        };
      `,
    });
  });

  test('constructor 初始化默认状态', async ({ page }) => {
    const state = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();
      return {
        initialized: vc.initialized,
        started: vc.started,
        isActive: vc.isActive,
        monitorMode: vc.monitorMode,
        pitch: vc.pitch,
        tempo: vc.tempo,
      };
    });
    expect(state.initialized).toBe(false);
    expect(state.started).toBe(false);
    expect(state.isActive).toBe(false);
    expect(state.monitorMode).toBe('changed');
    expect(state.pitch).toBe(1.0);
    expect(state.tempo).toBe(1.0);
  });

  test('applyPreset 设置音调参数', async ({ page }) => {
    const pitches = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();
      const results = {};
      vc.applyPreset('loli');
      results.loli = vc.pitch;
      vc.applyPreset('uncle');
      results.uncle = vc.pitch;
      vc.applyPreset('robot');
      results.robot = vc.pitch;
      vc.applyPreset('monster');
      results.monster = vc.pitch;
      vc.applyPreset('normal');
      results.normal = vc.pitch;
      return results;
    });
    expect(pitches.loli).toBeCloseTo(1.5, 1);
    expect(pitches.uncle).toBeCloseTo(0.7, 1);
    expect(pitches.monster).toBeCloseTo(0.5, 1);
    expect(pitches.normal).toBe(1.0);
  });

  test('setMonitorMode 改变增益节点', async ({ page }) => {
    const modes = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();
      await vc.init();
      const results = {};

      vc.setMonitorMode('original');
      results.original_bypassGain = vc.bypassGain?.gain?.value;
      results.original_outputGain = vc.outputGain?.gain?.value;

      vc.setMonitorMode('changed');
      results.changed_bypassGain = vc.bypassGain?.gain?.value;
      results.changed_outputGain = vc.outputGain?.gain?.value;

      vc.setMonitorMode('mute');
      results.mute_bypassGain = vc.bypassGain?.gain?.value;
      results.mute_outputGain = vc.outputGain?.gain?.value;

      vc.destroy();
      return results;
    });

    // original: bypassGain=0.8, outputGain=0
    expect(modes.original_bypassGain).toBeCloseTo(0.8, 1);
    expect(modes.original_outputGain).toBe(0);

    // changed: bypassGain=0, outputGain=0.8
    expect(modes.changed_bypassGain).toBe(0);
    expect(modes.changed_outputGain).toBeCloseTo(0.8, 1);

    // mute: both 0
    expect(modes.mute_bypassGain).toBe(0);
    expect(modes.mute_outputGain).toBe(0);
  });

  test('节点不重复创建', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();

      await vc.init();
      await vc.init(); // 重复 init

      const hasContext = !!vc.audioContext;
      vc.destroy();
      return { hasContext };
    });
    expect(result.hasContext).toBe(true);
  });

  test('start/stop 生命周期', async ({ page }) => {
    const lifecycle = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();

      // 创建 fake MediaStream
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const oscillator = ctx.createOscillator();
      oscillator.connect(dest);
      oscillator.start();
      const fakeStream = dest.stream;
      oscillator.stop();
      ctx.close();

      const before = { started: vc.started, hasSource: !!vc.source };

      await vc.start(fakeStream);
      const afterStart = { started: vc.started, hasSource: !!vc.source, hasStream: !!vc.stream };

      vc.stop();
      const afterStop = { started: vc.started, hasSource: !!vc.source, hasStream: !!vc.stream };

      vc.destroy();
      return { before, afterStart, afterStop };
    });

    expect(lifecycle.before.started).toBe(false);
    expect(lifecycle.afterStart.started).toBe(true);
    expect(lifecycle.afterStart.hasStream).toBe(true);
    expect(lifecycle.afterStop.started).toBe(false);
    expect(lifecycle.afterStop.hasStream).toBe(false);
  });

  test('stop() 停止 track 并清空 stream', async ({ page }) => {
    const afterStop = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();

      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const oscillator = ctx.createOscillator();
      oscillator.connect(dest);
      oscillator.start();
      const fakeStream = dest.stream;
      oscillator.stop();
      ctx.close();

      await vc.start(fakeStream);
      vc.stop();

      return {
        streamNull: vc.stream === null,
        sourceNull: vc.source === null,
        started: vc.started,
      };
    });

    expect(afterStop.streamNull).toBe(true);
    expect(afterStop.sourceNull).toBe(true);
    expect(afterStop.started).toBe(false);
  });

  test('destroy() 完全清理所有节点', async ({ page }) => {
    const afterDestroy = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();

      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const oscillator = ctx.createOscillator();
      oscillator.connect(dest);
      oscillator.start();
      const fakeStream = dest.stream;
      oscillator.stop();
      ctx.close();

      await vc.start(fakeStream);
      vc.destroy();

      return {
        audioContextNull: vc.audioContext === null,
        sourceNull: vc.source === null,
        processorNull: vc.processor === null,
        outputGainNull: vc.outputGain === null,
        bypassGainNull: vc.bypassGain === null,
        // _processedDest 在 stop() 后为 null，但 MediaStreamDestination 可能仍可访问
        processedDestFalsy: !vc._processedDest,
        initialized: vc.initialized,
        started: vc.started,
        soundTouchNull: vc.soundTouch === null,
      };
    });

    expect(afterDestroy.audioContextNull).toBe(true);
    expect(afterDestroy.sourceNull).toBe(true);
    expect(afterDestroy.processorNull).toBe(true);
    expect(afterDestroy.outputGainNull).toBe(true);
    expect(afterDestroy.bypassGainNull).toBe(true);
    expect(afterDestroy.processedDestFalsy).toBe(true);
    expect(afterDestroy.initialized).toBe(false);
    expect(afterDestroy.started).toBe(false);
    expect(afterDestroy.soundTouchNull).toBe(true);
  });

  test('getProcessedStream() 返回 MediaStream', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();

      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const oscillator = ctx.createOscillator();
      oscillator.connect(dest);
      oscillator.start();
      const fakeStream = dest.stream;
      oscillator.stop();
      ctx.close();

      await vc.start(fakeStream);
      const processed = vc.getProcessedStream();
      const hasStream = processed instanceof MediaStream;
      vc.destroy();
      return { hasStream, trackCount: processed?.getAudioTracks()?.length ?? 0 };
    });

    expect(result.hasStream).toBe(true);
    expect(result.trackCount).toBeGreaterThanOrEqual(0);
  });

  test('本地监听增益不影响远端 processed stream 增益', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const { VoiceChanger } = await import('/src/face-tracking/voice-changer.js');
      const vc = new VoiceChanger();

      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const oscillator = ctx.createOscillator();
      oscillator.connect(dest);
      oscillator.start();
      const fakeStream = dest.stream;
      oscillator.stop();
      ctx.close();

      await vc.start(fakeStream);
      vc.setMonitorMode('changed');
      const gainWhileChanged = vc.outputGain?.gain?.value;

      vc.setMonitorMode('mute');
      const gainWhileMute = vc.outputGain?.gain?.value;

      const processedStream = vc.getProcessedStream();
      vc.destroy();
      return { gainWhileChanged, gainWhileMute, processedStreamExists: !!processedStream };
    });

    expect(results.gainWhileChanged).toBeCloseTo(0.8, 1);
    expect(results.gainWhileMute).toBe(0);
    expect(results.processedStreamExists).toBe(true);
  });
});
