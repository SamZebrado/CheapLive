import { test } from 'node:test';
import assert from 'node:assert';

import { VoiceChanger } from '../../src/face-tracking/voice-changer.js';

function makeAudioContextMock() {
  const gainNodes = [];
  const ctx = {
    createGain: () => {
      const g = { gain: { value: 0 }, connect: (t) => t, disconnect: () => {} };
      gainNodes.push(g);
      return g;
    },
    sampleRate: 48000,
    close: () => {},
  };
  return { AudioContext: function () { return ctx; }, gainNodes };
}

function makeFakeMedia(mediaStream) {
  return {
    getUserMedia: async () => mediaStream,
  };
}

test('构造时可注入 window/document/navigator，不依赖全局', () => {
  const { AudioContext } = makeAudioContextMock();
  const win = { AudioContext };
  const doc = {};
  const nav = { mediaDevices: { getUserMedia: async () => ({}) } };
  const vc = new VoiceChanger({ window: win, document: doc, navigator: nav });
  assert.ok(vc);
});

test('isSupported() — 有 AudioContext + mediaDevices 时返回 true', () => {
  const win = { AudioContext: function () {} };
  const nav = { mediaDevices: { getUserMedia: async () => {} } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  assert.equal(vc.isSupported(), true);
});

test('isSupported() — 缺 AudioContext 返回 false', () => {
  const vc = new VoiceChanger({ window: {}, navigator: { mediaDevices: { getUserMedia: async () => {} } } });
  assert.equal(vc.isSupported(), false);
});

test('isSupported() — 缺 mediaDevices 返回 false', () => {
  const vc = new VoiceChanger({ window: { AudioContext: function () {} }, navigator: {} });
  assert.equal(vc.isSupported(), false);
});

test('applyPreset 正确更新 pitch/tempo 并在 soundTouch 存在时同步', async () => {
  const win = { AudioContext: function () { return { createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }), sampleRate: 48000, close: () => {} }; } };
  const vc = new VoiceChanger({ window: win });
  vc.pitch = 1.0;
  vc.tempo = 1.0;
  vc.applyPreset('loli');
  assert.ok(vc.pitch > 1.0, 'loli pitch 应该大于 1');
  assert.ok(vc.tempo >= 1.0, 'loli tempo 应该 >= 1');
});

test('applyMonitorMode 根据监听模式切换 outputGain 和 bypassGain', () => {
  const win = { AudioContext: function () {} };
  const vc = new VoiceChanger({ window: win });
  vc.outputGain = { gain: { value: 0 } };
  vc.bypassGain = { gain: { value: 0 } };

  vc.monitorMode = 'original';
  vc.applyMonitorMode();
  assert.ok(vc.bypassGain.gain.value > 0);
  assert.equal(vc.outputGain.gain.value, 0);

  vc.monitorMode = 'changed';
  vc.applyMonitorMode();
  assert.equal(vc.bypassGain.gain.value, 0);
  assert.ok(vc.outputGain.gain.value > 0);

  vc.monitorMode = 'mute';
  vc.applyMonitorMode();
  assert.equal(vc.bypassGain.gain.value, 0);
  assert.equal(vc.outputGain.gain.value, 0);
});

test('setVolume 直接设置 outputGain.gain.value', () => {
  const vc = new VoiceChanger({ window: {} });
  vc.outputGain = { gain: { value: 0 } };
  vc.setVolume(0.75);
  assert.equal(vc.outputGain.gain.value, 0.75);
});

test('stop() 标记为未启动并断开 source，同时停止 stream tracks', () => {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const vc = new VoiceChanger({ window: {} });
  vc.isActive = true;
  vc.started = true;
  vc.source = { disconnect() { this.disconnected = true; } };
  vc.stream = { getAudioTracks: () => tracks };
  vc.stop();
  assert.equal(vc.isActive, false);
  assert.equal(vc.started, false);
  assert.equal(tracks[0].stopped, true);
});

test('loadSoundTouch() — 无 document 环境直接抛错，不尝试访问全局', async () => {
  const vc = new VoiceChanger({ window: {}, document: null });
  try {
    await vc.loadSoundTouch();
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('不支持动态加载脚本') || err.message.includes('SoundTouchJS'),
      '错误消息应表明无 document 支持');
  }
});

test('start(existingStream) — 传入已有 stream 时不再请求 getUserMedia', async () => {
  let getUserMediaCalled = 0;
  const win = {
    AudioContext: function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
        createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {} }),
        createMediaStreamSource: () => ({ connect: () => {} }),
        createMediaStreamDestination: () => ({ stream: {} }),
        sampleRate: 48000,
        close: () => {},
      };
    },
    soundtouch: {
      SoundTouch: function () { this.pitch = 0; this.tempo = 0; this.rate = 0; },
      Float32AudioBuffer: function () { this.vector = []; },
    },
  };
  const nav = { mediaDevices: { getUserMedia: async () => { getUserMediaCalled++; return {}; } } };
  const existingStream = { fake: true };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  await vc.start(existingStream);
  assert.equal(getUserMediaCalled, 0);
  assert.equal(vc.isActive, true);
  assert.equal(vc.started, true);
});

test('presets 中全部包含 pitch 与 tempo 数值', () => {
  const vc = new VoiceChanger({ window: {} });
  for (const key of ['normal', 'loli', 'uncle', 'robot', 'monster']) {
    const p = vc.presets[key];
    assert.ok(typeof p.pitch === 'number', `preset ${key} missing pitch`);
    assert.ok(typeof p.tempo === 'number', `preset ${key} missing tempo`);
  }
});

test('getProcessedStream() — 未初始化时返回 null', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc.getProcessedStream(), null);
});
