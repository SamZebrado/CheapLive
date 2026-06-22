import { test } from 'node:test';
import assert from 'node:assert';

import { LiveSubtitle } from '../../src/face-tracking/live-subtitle.js';

test('构造时可通过 options.window 注入环境', () => {
  const win = {
    webkitSpeechRecognition: function MockSR() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = () => {};
      this.stop = () => {};
    },
  };
  const s = new LiveSubtitle({ window: win });
  assert.equal(s.isSupported(), true);
});

test('isSupported() 在无 SpeechRecognition 环境返回 false', () => {
  const empty = {};
  const s = new LiveSubtitle({ window: empty });
  assert.equal(s.isSupported(), false);
});

test('isSupported() 同时支持 SpeechRecognition 和 webkitSpeechRecognition', () => {
  const winStd = { SpeechRecognition: function () {} };
  const winWebkit = { webkitSpeechRecognition: function () {} };
  assert.equal(new LiveSubtitle({ window: winStd }).isSupported(), true);
  assert.equal(new LiveSubtitle({ window: winWebkit }).isSupported(), true);
});

test('init() 使用注入的 window 来获取 SpeechRecognition', () => {
  let recognitionConstructorCalled = false;
  const MockRecognition = function () {
    recognitionConstructorCalled = true;
    this.continuous = false;
    this.interimResults = false;
    this.lang = '';
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.start = () => {};
    this.stop = () => {};
  };
  const win = { webkitSpeechRecognition: MockRecognition };
  const s = new LiveSubtitle({ window: win });
  s.init();
  assert.equal(recognitionConstructorCalled, true);
});

test('clear() 会清除 transcript 并回调 onResult 空字符串', () => {
  const win = {
    webkitSpeechRecognition: function MockSR() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = () => {};
      this.stop = () => {};
    },
  };
  const s = new LiveSubtitle({ window: win });
  s.transcript = 'some speech';
  s.interimTranscript = ' interim';
  let called = null;
  s.onResult = (v) => { called = v; };
  s.clear();
  assert.equal(s.transcript, '');
  assert.equal(s.interimTranscript, '');
  assert.equal(called, '');
});

test('setLang(lang) 设置语言并保留到实例', () => {
  const s = new LiveSubtitle({ window: { webkitSpeechRecognition: function () {} } });
  s.setLang('en-US');
  assert.equal(s.lang, 'en-US');
});

test('BroadcastChannel 不支持时不会抛错', () => {
  const win = {};
  const create = () => new LiveSubtitle({ window: win });
  assert.doesNotThrow(create);
});

test('BroadcastChannel 支持时会初始化 channel 实例', () => {
  const channels = [];
  class MockChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.onerror = null;
    }
    postMessage(data) {
      channels.push({ name: this.name, data });
    }
  }
  const win = { BroadcastChannel: MockChannel };
  const s = new LiveSubtitle({ window: win });
  assert.ok(s.broadcastChannel !== null);
  s.transcript = 'hello';
  s.interimTranscript = ' world';
  s.broadcast();
  assert.equal(channels.length, 1);
  assert.equal(channels[0].data.final, 'hello');
  assert.equal(channels[0].data.interim, ' world');
});

test('start() 在不支持环境直接抛错而不是等待', () => {
  const s = new LiveSubtitle({ window: {} });
  assert.throws(() => s.start(), /不支持语音识别/);
});

test('setStyle 更改样式后不抛错', () => {
  const s = new LiveSubtitle({ window: { webkitSpeechRecognition: function () {} } });
  s.setStyle('fontSize', 40);
  assert.equal(s.style.fontSize, 40);
});

test('getDisplayText() 返回 transcript + interimTranscript 拼接结果', () => {
  const s = new LiveSubtitle({ window: { webkitSpeechRecognition: function () {} } });
  s.transcript = '你好 ';
  s.interimTranscript = '世界';
  assert.equal(s.getDisplayText(), '你好 世界');
});
