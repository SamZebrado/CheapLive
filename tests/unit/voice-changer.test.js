import { test } from 'node:test';
import assert from 'node:assert';

import { VoiceChanger } from '../../src/face-tracking/voice-changer.js';

// ---- 辅助 Mock 工厂 ----

function makeBasicAudioContextMock() {
  return {
    createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
    createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
    createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
    createMediaStreamDestination: () => ({ stream: {} }),
    sampleRate: 48000,
    close: () => {},
    resume: async () => {},
    state: 'running',
    destination: {},
  };
}

function makeFullAudioContextMock() {
  return {
    createGain: () => ({ gain: { value: 0 }, connect: () => {}, disconnect: () => {} }),
    createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
    createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
    createMediaStreamDestination: () => ({ stream: {} }),
    createBiquadFilter: () => ({
      type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
      connect: () => {}, disconnect: () => {},
    }),
    createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
    createDynamicsCompressor: () => ({
      threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
      connect: () => {}, disconnect: () => {},
    }),
    sampleRate: 48000,
    close: () => {},
    resume: async () => {},
    state: 'running',
    destination: {},
  };
}

// 完全可用的 SoundTouch mock（putSamples + receiveSamples + vector）
function makeFullSoundTouchMock() {
  return {
    SoundTouch: function (sr, ch) {
      this.pitch = 1.0; this.tempo = 1.0; this.rate = 1.0;
      this.putSamples = () => {};
      this.receiveSamples = (buf) => buf.vector.length;
    },
    Float32AudioBuffer: function (size) { this.vector = new Array(size).fill(0); },
  };
}

// 不完整的 SoundTouch mock（缺少 putSamples/receiveSamples）
function makePartialSoundTouchMock() {
  return {
    SoundTouch: function (sr, ch) {
      this.pitch = 1.0; this.tempo = 1.0; this.rate = 1.0;
    },
    Float32AudioBuffer: function (size) { this.vector = new Array(size).fill(0); },
  };
}

// 只有 SoundTouch 构造函数，没有 Float32AudioBuffer
function makeMalformedSoundTouchMock() {
  return {
    SoundTouch: function (sr, ch) {
      this.pitch = 1.0; this.tempo = 1.0; this.rate = 1.0;
      this.putSamples = () => {};
      this.receiveSamples = (buf) => buf.vector.length;
    },
  };
}

// 标准的 window 工厂
function makeWindow(extra = {}) {
  return {
    AudioContext: function () { return makeFullAudioContextMock(); },
    isSecureContext: true,
    ...extra,
  };
}

function makeNav() {
  return { mediaDevices: { getUserMedia: async () => ({ getAudioTracks: () => [] }) } };
}

// ================================================================
// 构造与基础 API
// ================================================================

test('构造时可注入 window/document/navigator，不依赖全局', () => {
  const win = makeWindow();
  const doc = {};
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, document: doc, navigator: nav });
  assert.ok(vc);
});

test('初始 engineMode 为 native', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc.engineMode, 'native');
});

test('初始 _soundTouchUsable 为 false', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc._soundTouchUsable, false);
});

// ---- isSupported() ----

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

test('isSupported() — 缺 AudioContext 返回 supported=false', () => {
  const vc = new VoiceChanger({ window: { isSecureContext: true }, navigator: { mediaDevices: { getUserMedia: async () => {} } } });
  const result = vc.isSupported();
  assert.equal(result.supported, false);
  assert.ok(result.reasons.some(r => r.includes('Web Audio')));
});

test('isSupported() — 缺 mediaDevices 返回 supported=false', () => {
  const vc = new VoiceChanger({ window: { AudioContext: function () {}, isSecureContext: true }, navigator: {} });
  const result = vc.isSupported();
  assert.equal(result.supported, false);
  assert.ok(result.reasons.some(r => r.includes('getUserMedia')));
});

test('isSupported() — 非安全上下文时给出警告', () => {
  const win = { AudioContext: function () {}, isSecureContext: false };
  const nav = { mediaDevices: { getUserMedia: async () => {} } };
  const vc = new VoiceChanger({ window: win, navigator: nav });
  const result = vc.isSupported();
  assert.equal(result.supported, false);
  assert.ok(result.reasons.some(r => r.includes('安全上下文')));
});

// ---- 状态机 ----

test('初始状态为 idle', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc.state, 'idle');
});

test('_setState 更新状态和错误，保存失败快照', () => {
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
  assert.equal(d.engine.mode, 'native');
  assert.equal(d.engine.soundTouchUsable, false);
  assert.equal(d.audioContext.state, 'none');
  assert.equal(d.mic.hasStream, false);
  assert.equal(d.graph.connected, false);
  assert.equal(d.graph.nativeGraph, false);
  assert.equal(d.current.pitchShift, 'unavailable (native fallback)');
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
  vc.stop();
  const d = vc.getDiagnostics();
  assert.notEqual(d.lastFailure, null);
  assert.equal(d.lastFailure.errorMessage, 'mic denied');
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

// ================================================================
// detectSoundTouchApi()
// ================================================================

test('detectSoundTouchApi() — window.soundtouch 不存在 → usable=false', () => {
  const vc = new VoiceChanger({ window: { isSecureContext: true } });
  const result = vc.detectSoundTouchApi();
  assert.equal(result.usable, false);
  assert.ok(result.reason.includes('不存在'));
  assert.equal(vc._soundTouchUsable, false);
});

test('detectSoundTouchApi() — 完整 API shape → usable=true', () => {
  const win = { soundtouch: makeFullSoundTouchMock(), isSecureContext: true };
  const vc = new VoiceChanger({ window: win });
  const result = vc.detectSoundTouchApi();
  assert.equal(result.usable, true);
  assert.equal(vc._soundTouchUsable, true);
  assert.ok(result.keys.length > 0, 'keys 应包含 SoundTouch 和 Float32AudioBuffer');
});

test('detectSoundTouchApi() — 缺少 putSamples/receiveSamples → usable=false', () => {
  const win = { soundtouch: makePartialSoundTouchMock(), isSecureContext: true };
  const vc = new VoiceChanger({ window: win });
  const result = vc.detectSoundTouchApi();
  assert.equal(result.usable, false);
  assert.ok(result.reason.includes('putSamples') || result.reason.includes('receiveSamples'));
});

test('detectSoundTouchApi() — 缺少 Float32AudioBuffer → usable=false', () => {
  const win = { soundtouch: makeMalformedSoundTouchMock(), isSecureContext: true };
  const vc = new VoiceChanger({ window: win });
  const result = vc.detectSoundTouchApi();
  assert.equal(result.usable, false);
  assert.ok(result.reason.includes('Float32AudioBuffer'));
});

test('detectSoundTouchApi() — 结果缓存，第二次调用返回相同对象', () => {
  const win = { soundtouch: makeFullSoundTouchMock(), isSecureContext: true };
  const vc = new VoiceChanger({ window: win });
  const r1 = vc.detectSoundTouchApi();
  const r2 = vc.detectSoundTouchApi();
  assert.strictEqual(r1, r2);
});

// ================================================================
// init() — 引擎模式决策
// ================================================================

test('init() — SoundTouch 不可用时 engineMode = native', async () => {
  const win = makeWindow({ soundtouch: undefined });
  const vc = new VoiceChanger({ window: win, navigator: makeNav(), document: {} });
  await vc.init();
  assert.equal(vc.engineMode, 'native');
  assert.equal(vc._soundTouchUsable, false);
});

test('init() — SoundTouch 完整可用时 engineMode = soundtouch', async () => {
  const win = makeWindow({ soundtouch: makeFullSoundTouchMock() });
  const vc = new VoiceChanger({ window: win, navigator: makeNav(), document: {} });
  await vc.init();
  assert.equal(vc.engineMode, 'soundtouch');
  assert.equal(vc._soundTouchUsable, true);
});

test('init() — 无 document 时仍能正常初始化（native 模式）', async () => {
  const win = makeWindow();
  const vc = new VoiceChanger({ window: win, navigator: makeNav(), document: null });
  await vc.init();
  assert.equal(vc.engineMode, 'native');
  assert.equal(vc.initialized, true);
});

// ================================================================
// start() — 双引擎架构
// ================================================================

test('start() — SoundTouch 不可用时以 native 模式启动成功', async () => {
  const win = makeWindow({ soundtouch: undefined });
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.engineMode, 'native');
  assert.equal(vc.isActive, true);
  assert.equal(vc.started, true);
  assert.equal(vc._isNativeGraphConnected(), true);
});

test('start() — SoundTouch 可用时以 soundtouch 模式启动成功', async () => {
  const win = makeWindow({ soundtouch: makeFullSoundTouchMock() });
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.engineMode, 'soundtouch');
  assert.ok(vc.soundTouch);
});

test('start() — SoundTouch 部分可用时 fallback 到 native', async () => {
  const win = makeWindow({ soundtouch: makePartialSoundTouchMock() });
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  // init() 检测到 API 不可用，设为 native
  // start() 中 engineMode === 'native'，走 native 路径
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.engineMode, 'native');
  assert.equal(vc._isNativeGraphConnected(), true);
});

test('start(existingStream) — 传入已有 stream 时不再请求 getUserMedia', async () => {
  let getUserMediaCalled = 0;
  const win = makeWindow({ soundtouch: makeFullSoundTouchMock() });
  const nav = { mediaDevices: { getUserMedia: async () => { getUserMediaCalled++; return {}; } } };
  const existingStream = { fake: true };
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start(existingStream);
  assert.equal(getUserMediaCalled, 0);
  assert.equal(vc.isActive, true);
  assert.equal(vc.started, true);
  assert.equal(vc.state, 'enabled');
});

// ---- start() 失败场景 ----

test('start() — 浏览器不支持时抛出错误', async () => {
  const vc = new VoiceChanger({ window: { isSecureContext: false }, navigator: {} });
  try {
    await vc.start();
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('Web Audio') || err.message.includes('getUserMedia') || err.message.includes('安全上下文'));
    assert.equal(vc.state, 'unsupported');
  }
});

test('start() — getUserMedia 失败时 failStage 为 error', async () => {
  const win = makeWindow();
  const nav = { mediaDevices: { getUserMedia: async () => { throw { name: 'NotAllowedError', message: 'denied' }; } } };
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  try {
    await vc.start();
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('权限被拒绝'));
    assert.equal(vc.state, 'error');
    assert.equal(vc.failStage, 'error');
    assert.notEqual(vc._lastFailureDiagnostics, null);
  }
});

test('start() 失败后 _lastFailureDiagnostics 保留诊断信息', async () => {
  const win = makeWindow();
  const nav = { mediaDevices: { getUserMedia: async () => { throw { name: 'NotFoundError', message: 'no mic' }; } } };
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  try { await vc.start(); } catch (e) {}
  const d = vc.getDiagnostics();
  assert.notEqual(d.lastFailure, null);
  assert.equal(d.lastFailure.errorName, 'NotFoundError');
  assert.equal(d.lastFailure.failStage, 'error');
});

test('start() — 成功后 failStage 为空', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.failStage, null);
  assert.equal(vc._lastFailureDiagnostics, null);
});

// ================================================================
// Preset 测试
// ================================================================

test('applyPreset 正确更新 pitch/tempo', () => {
  const vc = new VoiceChanger({ window: {} });
  vc.pitch = 1.0;
  vc.tempo = 1.0;
  vc.applyPreset('cute');
  assert.ok(vc.pitch > 1.0, 'cute pitch 应该大于 1');
  assert.ok(vc.tempo >= 1.0, 'cute tempo 应该 >= 1');
  assert.equal(vc._currentPreset, 'cute');
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

test('applyPreset — native 引擎时调用 _applyNativePreset', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  vc.applyPreset('robot');
  assert.equal(vc._currentPreset, 'robot');
  // 验证 native effects 已更新
  const ef = vc._nativeEffects;
  assert.ok(ef.filterNode, 'filterNode 应存在');
  assert.equal(ef.filterNode.type, 'bandpass');
  assert.equal(ef.filterNode.frequency.value, 1500);
  assert.equal(ef.filterNode.Q.value, 2);
  assert.notEqual(ef.waveshaper.curve, null, 'robot 应有 waveshaper curve');
  assert.equal(ef.compressor.ratio.value, 8);
});

test('applyPreset normal — native 引擎旁路效果链', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  vc.applyPreset('normal');
  const ef = vc._nativeEffects;
  assert.equal(ef.filterNode.type, 'allpass');
  assert.equal(ef.waveshaper.curve, null);
  assert.equal(ef.compressor.ratio.value, 1);
});

test('applyPreset cute — native 引擎设置 highpass + 失真', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  vc.applyPreset('cute');
  const ef = vc._nativeEffects;
  assert.equal(ef.filterNode.type, 'highpass');
  assert.equal(ef.filterNode.frequency.value, 600);
  assert.notEqual(ef.waveshaper.curve, null);
  assert.equal(ef.compressor.ratio.value, 4);
});

test('applyPreset deep — native 引擎设置 lowshelf + bass boost', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  vc.applyPreset('deep');
  const ef = vc._nativeEffects;
  assert.equal(ef.filterNode.type, 'lowshelf');
  assert.equal(ef.filterNode.frequency.value, 300);
  assert.equal(ef.filterNode.gain.value, 15);
  assert.notEqual(ef.waveshaper.curve, null);
  assert.equal(ef.compressor.ratio.value, 6);
});

test('applyPreset radio — native 引擎设置 bandpass + 失真', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  vc.applyPreset('radio');
  const ef = vc._nativeEffects;
  assert.equal(ef.filterNode.type, 'bandpass');
  assert.equal(ef.filterNode.frequency.value, 2000);
  assert.equal(ef.filterNode.Q.value, 0.5);
  assert.notEqual(ef.waveshaper.curve, null);
  assert.equal(ef.compressor.ratio.value, 10);
});

test('presets 中全部包含 pitch 与 tempo 数值', () => {
  const vc = new VoiceChanger({ window: {} });
  for (const key of ['normal', 'cute', 'robot', 'deep', 'radio']) {
    const p = vc.presets[key];
    assert.ok(typeof p.pitch === 'number', `preset ${key} missing pitch`);
    assert.ok(typeof p.tempo === 'number', `preset ${key} missing tempo`);
    assert.ok(typeof p.native === 'string', `preset ${key} missing native`);
  }
});

// ================================================================
// 监听模式
// ================================================================

test('applyMonitorMode 根据监听模式切换 outputGain 和 bypassGain', () => {
  const vc = new VoiceChanger({ window: {} });
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

// ================================================================
// stop()
// ================================================================

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

test('stop() — 不清除 engineMode', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  assert.equal(vc.engineMode, 'native');
  vc.stop();
  assert.equal(vc.engineMode, 'native');
});

// ================================================================
// getProcessedStream
// ================================================================

test('getProcessedStream() — 未初始化时返回 null', () => {
  const vc = new VoiceChanger({ window: {} });
  assert.equal(vc.getProcessedStream(), null);
});

// ================================================================
// destroy() — 清理 native effects
// ================================================================

test('destroy() — 清理 native effects 和所有节点', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  assert.equal(vc._isNativeGraphConnected(), true);
  vc.destroy();
  assert.equal(vc._nativeEffects.filterNode, null);
  assert.equal(vc._nativeEffects.waveshaper, null);
  assert.equal(vc._nativeEffects.compressor, null);
  assert.equal(vc.initialized, false);
  assert.equal(vc.state, 'idle');
});

// ================================================================
// _makeCurve / _makeSoftClipCurve / _makeRobotCurve
// ================================================================

test('_makeCurve 返回 Float32Array 且长度正确', () => {
  const vc = new VoiceChanger({ window: {} });
  const curve = vc._makeCurve(30);
  assert.ok(curve instanceof Float32Array);
  assert.equal(curve.length, 44100);
});

test('_makeSoftClipCurve 返回 Float32Array', () => {
  const vc = new VoiceChanger({ window: {} });
  const curve = vc._makeSoftClipCurve();
  assert.ok(curve instanceof Float32Array);
  assert.equal(curve.length, 44100);
});

test('_makeRobotCurve 返回 Float32Array 且值在 [-1, 1] 范围内', () => {
  const vc = new VoiceChanger({ window: {} });
  const curve = vc._makeRobotCurve();
  assert.ok(curve instanceof Float32Array);
  assert.equal(curve.length, 44100);
  for (let i = 0; i < curve.length; i++) {
    assert.ok(curve[i] >= -1 && curve[i] <= 1, `curve[${i}] = ${curve[i]} 超出范围`);
  }
});

// ================================================================
// processAudio — 双引擎分发
// ================================================================

test('processAudio — native 模式下复制输入到输出', async () => {
  const win = makeWindow();
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  await vc.start();
  vc.isActive = true;
  const inputData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
  const outputData = new Float32Array(4);
  const e = {
    inputBuffer: { getChannelData: () => inputData },
    outputBuffer: { getChannelData: () => outputData },
  };
  vc.processAudio(e);
  for (let i = 0; i < 4; i++) {
    assert.equal(outputData[i], inputData[i]);
  }
});

test('processAudio — isActive=false 时不处理', () => {
  const vc = new VoiceChanger({ window: {} });
  vc.isActive = false;
  const outputData = new Float32Array([9, 9, 9, 9]);
  const e = {
    inputBuffer: { getChannelData: () => new Float32Array([0.1, 0.2, 0.3, 0.4]) },
    outputBuffer: { getChannelData: () => outputData },
  };
  vc.processAudio(e);
  // 输出不应被修改
  assert.equal(outputData[0], 9);
});

// ================================================================
// SoundTouch 不可用不阻塞启动
// ================================================================

test('SoundTouch 不可用不会导致 start() throw', async () => {
  const win = makeWindow({ soundtouch: undefined });
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: {} });
  // 不应抛出错误
  await vc.start();
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.engineMode, 'native');
});

test('SoundTouch 脚本加载失败仍能以 native 启动', async () => {
  // 模拟无 document 无法加载脚本，但有 window 但没有 soundtouch
  const win = makeWindow({ soundtouch: undefined });
  const nav = makeNav();
  const vc = new VoiceChanger({ window: win, navigator: nav, document: null });
  await vc.start();
  assert.equal(vc.state, 'enabled');
  assert.equal(vc.engineMode, 'native');
  assert.equal(vc._engineSource, null);
});