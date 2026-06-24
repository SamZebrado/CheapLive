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
  const win = { AudioContext, isSecureContext: true };
  const doc = {};
  const nav = { mediaDevices: { getUserMedia: async () => ({}) } };
  const vc = new VoiceChanger({ window: win, document: doc, navigator: nav });
  assert.ok(vc);
});

// ---- isSupported() 返回诊断对象 ----
test('isSupported() — 有 AudioContext + mediaDevices + secureContext 时返回 supported=true', () => {
  const win = { AudioContext: function () {}, isSecureContext: true };
  const nav = { mediaDevices: { getUserMedia: async () => {} } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  const result = vc.isSupported();
  assert.equal(result.supported, true);
  assert.equal(result.reasons.length, 0);
  assert.equal(result.details.webAudio, true);
  assert.equal(result.details.getUserMedia, true);
  assert.equal(result.details.secureContext, true);
});

test('isSupported() — 缺 AudioContext 返回 supported=false 并给出具体原因', () => {
  const vc = new VoiceChanger({ window: { isSecureContext: true }, navigator: { mediaDevices: { getUserMedia: async () => {} } } });
  const result = vc.isSupported();
  assert.equal(result.supported, false);
  assert.ok(result.reasons.some(r => r.includes('Web Audio')));
  assert.equal(result.details.webAudio, false);
});

test('isSupported() — 缺 mediaDevices 返回 supported=false 并给出具体原因', () => {
  const vc = new VoiceChanger({ window: { AudioContext: function () {}, isSecureContext: true }, navigator: {} });
  const result = vc.isSupported();
  assert.equal(result.supported, false);
  assert.ok(result.reasons.some(r => r.includes('getUserMedia')));
  assert.equal(result.details.getUserMedia, false);
});

test('isSupported() — 非安全上下文时给出警告', () => {
  const win = { AudioContext: function () {}, isSecureContext: false };
  const nav = { mediaDevices: { getUserMedia: async () => {} } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  const result = vc.isSupported();
  assert.equal(result.supported, false);
  assert.ok(result.reasons.some(r => r.includes('安全上下文')));
  assert.equal(result.details.secureContext, false);
});

// ---- 状态机 ----
test('初始状态为 idle', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc.state, 'idle');
});

test('状态机转换：_setState 更新状态和错误，保存失败快照', () => {
  const vc = new VoiceChanger({ window: {} });
  const err = new Error('test error');
  vc._setState('error', err);
  assert.equal(vc.state, 'error');
  assert.equal(vc.lastError, err);
  assert.equal(vc.failStage, 'error');
  assert.notEqual(vc._lastFailureDiagnostics, null);
  assert.equal(vc._lastFailureDiagnostics.errorName, 'Error');
  assert.equal(vc._lastFailureDiagnostics.errorMessage, 'test error');
});

test('_changeStage 仅追踪阶段，不记录错误', () => {
  const vc = new VoiceChanger({ window: {} });
  vc._changeStage('requesting-mic');
  assert.equal(vc.state, 'requesting-mic');
  assert.equal(vc.failStage, null);
  assert.equal(vc._lastFailureDiagnostics, null);
});

// ---- 诊断信息 ----
test('getDiagnostics() — 未初始化时返回基础诊断', () => {
  const win = { AudioContext: function () {}, isSecureContext: true };
  const nav = { mediaDevices: { getUserMedia: async () => {} } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  const d = vc.getDiagnostics();
  assert.equal(d.state, 'idle');
  assert.equal(d.support.supported, true);
  assert.equal(d.engine.source, 'not-loaded');
  assert.equal(d.audioContext.state, 'none');
  assert.equal(d.mic.hasStream, false);
  assert.equal(d.graph.connected, false);
  assert.equal(d.lastFailure, null);
});

test('getDiagnostics() — 失败后包含 lastError 和 failStage', () => {
  const vc = new VoiceChanger({ window: {} });
  vc._setState('error', new Error('mic denied'));
  const d = vc.getDiagnostics();
  assert.equal(d.failStage, 'error');
  assert.equal(d.lastError.name, 'Error');
  assert.equal(d.lastError.message, 'mic denied');
});

test('getDiagnostics() — stop 后仍保留 lastFailure 快照', () => {
  const vc = new VoiceChanger({ window: {} });
  vc._setState('error', new Error('mic denied'));
  vc.stop(); // stop 会清空 stream/source
  const d = vc.getDiagnostics();
  assert.notEqual(d.lastFailure, null);
  assert.equal(d.lastFailure.errorMessage, 'mic denied');
  assert.equal(d.lastFailure.mic.hasStream, false); // stop 后清空
});

// ---- getUserMedia 错误分类 ----
test('_classifyGetUserMediaError — NotAllowedError', () => {
  const vc = new VoiceChanger({ window: {} });
  const err = vc._classifyGetUserMediaError({ name: 'NotAllowedError', message: 'Permission denied' });
  assert.ok(err.message.includes('权限被拒绝'));
});

test('_classifyGetUserMediaError — NotFoundError', () => {
  const vc = new VoiceChanger({ window: {} });
  const err = vc._classifyGetUserMediaError({ name: 'NotFoundError', message: 'No device' });
  assert.ok(err.message.includes('未检测到麦克风'));
});

test('_classifyGetUserMediaError — NotReadableError', () => {
  const vc = new VoiceChanger({ window: {} });
  const err = vc._classifyGetUserMediaError({ name: 'NotReadableError', message: 'Busy' });
  assert.ok(err.message.includes('被其他应用占用'));
});

test('_classifyGetUserMediaError — SecurityError', () => {
  const vc = new VoiceChanger({ window: {} });
  const err = vc._classifyGetUserMediaError({ name: 'SecurityError', message: 'Not secure' });
  assert.ok(err.message.includes('安全策略限制'));
});

test('_classifyGetUserMediaError — 未知错误包含原始 name', () => {
  const vc = new VoiceChanger({ window: {} });
  const err = vc._classifyGetUserMediaError({ name: 'AbortError', message: 'Aborted' });
  assert.ok(err.message.includes('AbortError'));
  assert.ok(err.message.includes('Aborted'));
});

// ---- Preset 测试（新命名） ----
test('applyPreset 正确更新 pitch/tempo 并在 soundTouch 存在时同步', () => {
  const win = { AudioContext: function () { return { createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }), sampleRate: 48000, close: () => {} }; } };
  const vc = new VoiceChanger({ window: win });
  vc.pitch = 1.0;
  vc.tempo = 1.0;
  vc.applyPreset('cute');
  assert.ok(vc.pitch > 1.0, 'cute pitch 应该大于 1');
  assert.ok(vc.tempo >= 1.0, 'cute tempo 应该 >= 1');
});

test('applyPreset deep 正确设置 pitch < 1', () => {
  const vc = new VoiceChanger({ window: {} });
  vc.applyPreset('deep');
  assert.ok(vc.pitch < 1.0, 'deep pitch 应该小于 1');
});

test('applyPreset robot 保持 pitch=1.0', () => {
  const vc = new VoiceChanger({ window: {} });
  vc.applyPreset('robot');
  assert.equal(vc.pitch, 1.0);
});

test('applyPreset radio 设置 pitch=0.9', () => {
  const vc = new VoiceChanger({ window: {} });
  vc.applyPreset('radio');
  assert.equal(vc.pitch, 0.9);
});

// ---- 监听模式 ----
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
  vc._state = 'enabled';
  vc.source = { disconnect() { this.disconnected = true; } };
  vc.stream = { getAudioTracks: () => tracks };
  vc.stop();
  assert.equal(vc.isActive, false);
  assert.equal(vc.started, false);
  assert.equal(tracks[0].stopped, true);
  assert.equal(vc.state, 'disabled');
});

test('loadSoundTouch() — 无 document 环境直接抛错，不尝试访问全局', async () => {
  const vc = new VoiceChanger({ window: {}, document: null });
  try {
    await vc.loadSoundTouch();
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('不支持动态加载脚本') || err.message.includes('SoundTouch'),
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
    isSecureContext: true,
  };
  const nav = { mediaDevices: { getUserMedia: async () => { getUserMediaCalled++; return {}; } } };
  const existingStream = { fake: true };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  await vc.start(existingStream);
  assert.equal(getUserMediaCalled, 0);
  assert.equal(vc.isActive, true);
  assert.equal(vc.started, true);
  assert.equal(vc.state, 'enabled');
});

test('presets 中全部包含 pitch 与 tempo 数值', () => {
  const vc = new VoiceChanger({ window: {} });
  for (const key of ['normal', 'cute', 'robot', 'deep', 'radio']) {
    const p = vc.presets[key];
    assert.ok(typeof p.pitch === 'number', `preset ${key} missing pitch`);
    assert.ok(typeof p.tempo === 'number', `preset ${key} missing tempo`);
  }
});

test('getProcessedStream() — 未初始化时返回 null', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc.getProcessedStream(), null);
});

// ---- 引擎来源记录 ----
test('loadSoundTouch — 预加载 window.soundtouch 时记录 source=preloaded', async () => {
  const win = { soundtouch: { SoundTouch: function () {} } };
  const vc = new VoiceChanger({ window: win });
  await vc.loadSoundTouch();
  assert.equal(vc.engineSource, 'preloaded');
});

// ---- 不支持时抛出详细错误 ----
test('start() — 浏览器不支持时抛出包含具体原因的 Error', async () => {
  const vc = new VoiceChanger({ window: { isSecureContext: false }, navigator: {} });
  try {
    await vc.start();
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('Web Audio') || err.message.includes('getUserMedia') || err.message.includes('安全上下文'),
      `错误消息应包含具体原因，实际: ${err.message}`);
    assert.equal(vc.state, 'unsupported');
  }
});

// ---- start() 分阶段诊断 ----
test('start() — getUserMedia 失败时 failStage 为 error', async () => {
  const win = {
    AudioContext: function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
        createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {} }),
        createMediaStreamSource: () => ({ connect: () => {} }),
        sampleRate: 48000,
        close: () => {},
      };
    },
    soundtouch: {
      SoundTouch: function () { this.pitch = 0; this.tempo = 0; this.rate = 0; },
      Float32AudioBuffer: function () { this.vector = []; },
    },
    isSecureContext: true,
  };
  const nav = { mediaDevices: { getUserMedia: async () => { throw { name: 'NotAllowedError', message: 'denied' }; } } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  try {
    await vc.start();
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('权限被拒绝'));
    assert.equal(vc.state, 'error');
    assert.equal(vc.failStage, 'error');
    assert.notEqual(vc._lastFailureDiagnostics, null);
    assert.equal(vc._lastFailureDiagnostics.errorName, 'NotAllowedError');
  }
});

// ---- start() 阶段保留 snapshot ----
test('start() 失败后 _lastFailureDiagnostics 保留诊断信息', async () => {
  const win = {
    AudioContext: function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
        createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {} }),
        createMediaStreamSource: () => ({ connect: () => {} }),
        sampleRate: 48000,
        close: () => {},
      };
    },
    soundtouch: {
      SoundTouch: function () { this.pitch = 0; this.tempo = 0; this.rate = 0; },
      Float32AudioBuffer: function () { this.vector = []; },
    },
    isSecureContext: true,
  };
  const nav = { mediaDevices: { getUserMedia: async () => { throw { name: 'NotFoundError', message: 'no mic' }; } } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  try { await vc.start(); } catch (e) {}
  const d = vc.getDiagnostics();
  assert.notEqual(d.lastFailure, null);
  assert.equal(d.lastFailure.errorName, 'NotFoundError');
  assert.equal(d.lastFailure.failStage, 'error');
  assert.ok(d.lastFailure.engine.source === 'preloaded' || d.lastFailure.engine.source === 'not-loaded',
    'engine.source should be preloaded or not-loaded');
});

// ---- start() 成功时 clear failStage ----
test('start() — 成功后 failStage 为空，lastFailure 为空', async () => {
  const win = {
    AudioContext: function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
        createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {} }),
        createMediaStreamSource: () => ({ connect: () => {} }),
        sampleRate: 48000,
        close: () => {},
      };
    },
    soundtouch: {
      SoundTouch: function () { this.pitch = 0; this.tempo = 0; this.rate = 0; },
      Float32AudioBuffer: function () { this.vector = []; },
    },
    isSecureContext: true,
  };
  const nav = { mediaDevices: { getUserMedia: async () => ({ getAudioTracks: () => [] }) } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  await vc.start();
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.failStage, null);
  assert.equal(vc._lastFailureDiagnostics, null);
});