import { test } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function createMockWindow(hasBroadcastChannel) {
  let broadcastChannelInstance = null;
  
  const mockBroadcastChannel = function(name) {
    broadcastChannelInstance = {
      name,
      onmessage: null,
      onerror: null,
      _messages: [],
      postMessage: function(data) {
        this._messages.push(data);
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({ data });
          }
        }, 0);
      },
      close: function() {}
    };
    return broadcastChannelInstance;
  };

  return {
    BroadcastChannel: hasBroadcastChannel ? mockBroadcastChannel : undefined,
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    SpeechRecognition: undefined,
    webkitSpeechRecognition: undefined
  };
}

async function importLiveSubtitle() {
  const modulePath = pathToFileURL(`${__dirname}/../../src/face-tracking/live-subtitle.js`).href;
  const { LiveSubtitle } = await import(modulePath);
  return LiveSubtitle;
}

test('LiveSubtitle constructor initializes with default settings', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  
  assert.strictEqual(subtitle.isActive, false);
  assert.strictEqual(subtitle.lang, 'zh-CN');
  assert.strictEqual(subtitle.transcript, '');
  assert.strictEqual(subtitle.interimTranscript, '');
  assert.strictEqual(subtitle.isReceiver, false);
  assert.ok(subtitle.broadcastChannel);
});

test('LiveSubtitle initializes BroadcastChannel when supported', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  
  assert.ok(subtitle.broadcastChannel);
  assert.strictEqual(subtitle.broadcastChannel.name, 'cheaplive-subtitle');
});

test('LiveSubtitle sets broadcastChannel to null when not supported', async () => {
  const window = createMockWindow(false);
  const LiveSubtitle = await importLiveSubtitle();
  
  const errorCalls = [];
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.onError = (err) => errorCalls.push(err);
  
  assert.strictEqual(subtitle.broadcastChannel, null);
  assert.strictEqual(errorCalls.length, 0);
});

test('LiveSubtitle broadcast sends message when BroadcastChannel is available', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.transcript = 'final text';
  subtitle.interimTranscript = 'interim';
  
  subtitle.broadcast();
  
  assert.ok(subtitle.broadcastChannel._messages.length >= 1);
  const msg = subtitle.broadcastChannel._messages[subtitle.broadcastChannel._messages.length - 1];
  assert.strictEqual(msg.final, 'final text');
  assert.strictEqual(msg.interim, 'interim');
  assert.ok(msg.timestamp);
});

test('LiveSubtitle broadcast does nothing when BroadcastChannel is not available', async () => {
  const window = createMockWindow(false);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.transcript = 'test';
  
  assert.doesNotThrow(() => subtitle.broadcast());
});

test('LiveSubtitle broadcast does nothing in receiver mode', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.setReceiverMode(true);
  subtitle.transcript = 'test';
  
  subtitle.broadcast();
  
  assert.strictEqual(subtitle.broadcastChannel._messages.length, 0);
});

test('LiveSubtitle receives broadcast messages in receiver mode', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const results = [];
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.setReceiverMode(true);
  subtitle.onResult = (text) => results.push(text);
  
  subtitle.broadcastChannel.postMessage({
    final: 'hello',
    interim: ''
  });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  assert.strictEqual(subtitle.transcript, 'hello');
  assert.strictEqual(subtitle.interimTranscript, '');
});

test('LiveSubtitle setReceiverMode toggles receiver mode', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  
  assert.strictEqual(subtitle.isReceiver, false);
  subtitle.setReceiverMode(true);
  assert.strictEqual(subtitle.isReceiver, true);
  subtitle.setReceiverMode(false);
  assert.strictEqual(subtitle.isReceiver, false);
});

test('LiveSubtitle isSupported returns true when SpeechRecognition available', async () => {
  const window = {
    BroadcastChannel: function(name) {
      return { name, onmessage: null, onerror: null, _messages: [], postMessage: function(d) { this._messages.push(d); } };
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    SpeechRecognition: function() {},
    webkitSpeechRecognition: undefined
  };
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  
  assert.strictEqual(subtitle.isSupported(), true);
});

test('LiveSubtitle isSupported returns false without SpeechRecognition', async () => {
  const window = {
    BroadcastChannel: function(name) {
      return { name, onmessage: null, onerror: null, _messages: [], postMessage: function(d) { this._messages.push(d); } };
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    SpeechRecognition: undefined,
    webkitSpeechRecognition: undefined
  };
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  
  assert.strictEqual(subtitle.isSupported(), false);
});

test('LiveSubtitle getDisplayText returns combined transcript', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.transcript = 'hello ';
  subtitle.interimTranscript = 'world';
  
  assert.strictEqual(subtitle.getDisplayText(), 'hello world');
});

test('LiveSubtitle clear resets transcript', async () => {
  const window = createMockWindow(true);
  const LiveSubtitle = await importLiveSubtitle();
  
  const results = [];
  const subtitle = new LiveSubtitle({ window, localStorage: window.localStorage });
  subtitle.transcript = 'test';
  subtitle.interimTranscript = 'ing';
  subtitle.onResult = (text) => results.push(text);
  
  subtitle.clear();
  
  assert.strictEqual(subtitle.transcript, '');
  assert.strictEqual(subtitle.interimTranscript, '');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0], '');
});