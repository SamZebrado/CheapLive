import { test } from 'node:test';
import assert from 'node:assert';

import { createVoiceInputController } from '../../android-capture/app/src/main/assets/web/capture/voice-effects.js';

function makeFakeTrack() {
  let stopped = false;
  return {
    get stopped() { return stopped; },
    stop() { stopped = true; }
  };
}

function makeFakeStream() {
  const tracks = [makeFakeTrack(), makeFakeTrack()];
  return {
    getTracks: () => tracks,
    _tracks: tracks
  };
}

function makeAnalyserMock() {
  let fftSizeValue = 2048;
  return {
    get fftSize() { return fftSizeValue; },
    set fftSize(v) { fftSizeValue = v; },
    get frequencyBinCount() { return Math.floor(fftSizeValue / 2); },
    getByteFrequencyData(arr) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = 128;
      }
    }
  };
}

function makeAudioContextMock() {
  const nodes = { gains: [], analysers: [], biquadFilters: [], waveShapers: [], oscillators: [], delays: [], mediaStreamSources: [] };
  const ctx = {
    state: 'running',
    sampleRate: 48000,
    createGain() {
      const g = { gain: { value: 1 }, connect: (t) => t, disconnect: () => {} };
      nodes.gains.push(g);
      return g;
    },
    createAnalyser() {
      const a = makeAnalyserMock();
      a.connect = (t) => t;
      a.disconnect = () => {};
      nodes.analysers.push(a);
      return a;
    },
    createBiquadFilter() {
      const f = { type: 'lowpass', frequency: { value: 0 }, Q: { value: 0 }, connect: (t) => t, disconnect: () => {} };
      nodes.biquadFilters.push(f);
      return f;
    },
    createWaveShaper() {
      const w = { curve: null, connect: (t) => t, disconnect: () => {} };
      nodes.waveShapers.push(w);
      return w;
    },
    createOscillator() {
      const o = { frequency: { value: 0 }, connect: () => {}, start() { this._started = true; } };
      nodes.oscillators.push(o);
      return o;
    },
    createDelay() {
      const d = { delayTime: { value: 0 }, connect: (t) => t, disconnect: () => {} };
      nodes.delays.push(d);
      return d;
    },
    createMediaStreamSource(stream) {
      const s = { _stream: stream, connect: (t) => t, disconnect: () => {} };
      nodes.mediaStreamSources.push(s);
      return s;
    },
    destination: { _isDest: true },
    close() { this._closed = true; },
    resume() { return Promise.resolve(); },
    _nodes: nodes
  };
  return ctx;
}

function setupGlobals(opts = {}) {
  const origWindow = globalThis.window;
  const origNavigator = globalThis.navigator;
  const AudioContextClass = opts.AudioContext || (function () { return makeAudioContextMock(); });
  const fakeWindow = {
    AudioContext: AudioContextClass,
    webkitAudioContext: opts.webkitAudioContext || null,
    isSecureContext: opts.isSecureContext !== false,
    CheapLiveBridge: opts.CheapLiveBridge || null
  };
  const fakeNavigator = {
    mediaDevices: {
      getUserMedia: opts.getUserMedia || (async () => makeFakeStream())
    }
  };
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: fakeNavigator, writable: true, configurable: true });
  return () => {
    if (origWindow === undefined) delete globalThis.window;
    else Object.defineProperty(globalThis, 'window', { value: origWindow, writable: true, configurable: true });
    if (origNavigator === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, 'navigator', { value: origNavigator, writable: true, configurable: true });
  };
}

// ===== 基础构造测试 =====
test('createVoiceInputController 返回对象包含必要方法', () => {
  const ctrl = createVoiceInputController();
  assert.ok(ctrl);
  assert.equal(typeof ctrl.start, 'function');
  assert.equal(typeof ctrl.stop, 'function');
  assert.equal(typeof ctrl.setEffectMode, 'function');
  assert.equal(typeof ctrl.setMonitorEnabled, 'function');
  assert.equal(typeof ctrl.getState, 'function');
  assert.ok(Array.isArray(ctrl.EFFECT_MODES));
});

test('初始状态正确：未运行，effectMode 为 original', () => {
  const ctrl = createVoiceInputController();
  const state = ctrl.getState();
  assert.equal(state.running, false);
  assert.equal(state.effectMode, 'original');
  assert.equal(state.micLevel, 0);
  assert.equal(state.processedLevel, 0);
  assert.equal(state.monitorEnabled, false);
  assert.equal(state.hasAudioContext, false);
  assert.equal(state.hasStream, false);
  assert.ok(state.availableModes.includes('original'));
  assert.ok(state.availableModes.includes('cute'));
  assert.ok(state.availableModes.includes('robot'));
  assert.ok(state.availableModes.includes('deep'));
  assert.ok(state.availableModes.includes('radio'));
});

// ===== preset 映射测试 =====
test('EFFECT_MODES 包含全部 5 种预设', () => {
  const ctrl = createVoiceInputController();
  assert.deepEqual(ctrl.EFFECT_MODES, ['original', 'cute', 'robot', 'deep', 'radio']);
});

test('setEffectMode 更新 state.effectMode', () => {
  const ctrl = createVoiceInputController();
  ctrl.setEffectMode('robot');
  assert.equal(ctrl.getState().effectMode, 'robot');
  ctrl.setEffectMode('deep');
  assert.equal(ctrl.getState().effectMode, 'deep');
});

test('setEffectMode 不接受无效 preset', () => {
  const ctrl = createVoiceInputController();
  ctrl.setEffectMode('invalid-preset');
  assert.equal(ctrl.getState().effectMode, 'original');
});

test('onStateChange 在 setEffectMode 时被调用', () => {
  let calls = 0;
  let lastState = null;
  const ctrl = createVoiceInputController({
    onStateChange: (s) => { calls++; lastState = s; }
  });
  ctrl.setEffectMode('cute');
  assert.equal(calls, 1);
  assert.equal(lastState.effectMode, 'cute');
});

// ===== start / stop 测试 =====
test('start 调用 getUserMedia 并标记 running=true', async () => {
  let gumCalled = 0;
  const fakeStream = makeFakeStream();
  const restore = setupGlobals({
    getUserMedia: async (constraints) => {
      gumCalled++;
      assert.ok(constraints.audio, '应请求 audio');
      assert.equal(constraints.video, false, '不应请求 video');
      return fakeStream;
    }
  });
  try {
    const ctrl = createVoiceInputController();
    await ctrl.start();
    assert.equal(gumCalled, 1);
    assert.equal(ctrl.getState().running, true);
    assert.equal(ctrl.getState().hasAudioContext, true);
    assert.equal(ctrl.getState().hasStream, true);
    ctrl.stop();
    assert.equal(ctrl.getState().running, false);
    assert.equal(fakeStream._tracks[0].stopped, true);
  } finally {
    restore();
  }
});

test('start 时指定 effectMode', async () => {
  const fakeStream = makeFakeStream();
  const restore = setupGlobals({ getUserMedia: async () => fakeStream });
  try {
    const ctrl = createVoiceInputController();
    await ctrl.start({ effectMode: 'robot' });
    assert.equal(ctrl.getState().effectMode, 'robot');
    assert.equal(ctrl.getState().running, true);
    ctrl.stop();
  } finally {
    restore();
  }
});

test('stop 重置状态为未运行', async () => {
  const fakeStream = makeFakeStream();
  const restore = setupGlobals({ getUserMedia: async () => fakeStream });
  try {
    const ctrl = createVoiceInputController();
    await ctrl.start();
    ctrl.stop();
    const state = ctrl.getState();
    assert.equal(state.running, false);
    assert.equal(state.monitorEnabled, false);
    assert.equal(state.hasAudioContext, false);
    assert.equal(state.hasStream, false);
    assert.equal(state.micLevel, 0);
    assert.equal(state.processedLevel, 0);
  } finally {
    restore();
  }
});

test('start 失败时调用 onError', async () => {
  const restore = setupGlobals({
    getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }
  });
  try {
    let errorMsg = null;
    const ctrl = createVoiceInputController({
      onError: (msg) => { errorMsg = msg; }
    });
    try {
      await ctrl.start();
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(errorMsg, 'onError 应被调用');
      assert.equal(ctrl.getState().running, false);
    }
  } finally {
    restore();
  }
});

test('running 时重复 start 不重复调用 getUserMedia', async () => {
  let gumCalled = 0;
  const fakeStream = makeFakeStream();
  const restore = setupGlobals({
    getUserMedia: async () => { gumCalled++; return fakeStream; }
  });
  try {
    const ctrl = createVoiceInputController();
    await ctrl.start();
    await ctrl.start();
    assert.equal(gumCalled, 1);
    ctrl.stop();
  } finally {
    restore();
  }
});

// ===== level 计算验证 =====
test('Analyser mock 的 level 计算不返回 NaN', () => {
  const analyser = makeAnalyserMock();
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / data.length;
  const level = Math.min(1, avg / 255);
  assert.equal(typeof level, 'number');
  assert.ok(!isNaN(level), 'level 不能是 NaN');
  assert.ok(level >= 0 && level <= 1, 'level 应在 0-1 之间');
});

// ===== monitor 切换 =====
test('setMonitorEnabled 在未启动时不报错', () => {
  const ctrl = createVoiceInputController();
  ctrl.setMonitorEnabled(true);
  assert.equal(ctrl.getState().monitorEnabled, false);
});

// ===== 回调格式 =====
test('onStateChange 在 start/stop 时被调用', async () => {
  const fakeStream = makeFakeStream();
  const restore = setupGlobals({ getUserMedia: async () => fakeStream });
  try {
    let stateChanges = [];
    const ctrl = createVoiceInputController({
      onStateChange: (s) => { stateChanges.push({ running: s.running, effectMode: s.effectMode }); }
    });
    await ctrl.start();
    assert.ok(stateChanges.some(s => s.running === true), 'start 后应有 running=true 状态');
    ctrl.stop();
    assert.ok(stateChanges.some(s => s.running === false), 'stop 后应有 running=false 状态');
  } finally {
    restore();
  }
});

// ===== state 格式稳定 =====
test('getState() 返回所有必要字段且类型正确', () => {
  const ctrl = createVoiceInputController();
  const state = ctrl.getState();
  const fields = ['running', 'effectMode', 'micLevel', 'processedLevel', 'monitorEnabled', 'hasAudioContext', 'hasStream', 'availableModes'];
  for (const f of fields) {
    assert.ok(f in state, `state 应包含字段: ${f}`);
  }
  assert.equal(typeof state.running, 'boolean');
  assert.equal(typeof state.effectMode, 'string');
  assert.equal(typeof state.micLevel, 'number');
  assert.equal(typeof state.processedLevel, 'number');
  assert.equal(typeof state.monitorEnabled, 'boolean');
  assert.equal(typeof state.hasAudioContext, 'boolean');
  assert.equal(typeof state.hasStream, 'boolean');
  assert.ok(Array.isArray(state.availableModes));
});
