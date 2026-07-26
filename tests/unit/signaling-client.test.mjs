import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { SignalingClient } from '../../src/multi-device/signaling-client.js';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
let calls;

beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return { json: async () => ({ success: true, devices: [] }) };
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.EventSource = originalEventSource;
});

test('register sends room and token without exposing token in the URL', async () => {
  const client = new SignalingClient('capture id', 'http://127.0.0.1:9999', {
    token: 'test-token',
    room: 'room-a',
  });
  client.startHeartbeat = () => {};
  client.connectSSE = () => {};
  await client.register('Capture', 'unknown', 8765, 'capture');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:9999/register');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.room, 'room-a');
  assert.equal(calls[0].url.includes('test-token'), false);
});

test('signal sequence increments monotonically', async () => {
  const client = new SignalingClient('sender', 'http://127.0.0.1:9999', { token: 'test-token' });
  await client.sendSignal('receiver', { type: 'offer' });
  await client.sendSignal('receiver', { type: 'candidate' });
  assert.deepEqual(calls.map((call) => JSON.parse(call.options.body).sequence), [1, 2]);
  assert.ok(calls.every((call) => call.options.headers.Authorization === 'Bearer test-token'));
});

test('SSE URL encodes identity and token', () => {
  let eventSourceUrl = null;
  globalThis.EventSource = class {
    constructor(url) {
      eventSourceUrl = url;
    }
    close() {}
  };
  const client = new SignalingClient('receiver/id', 'http://127.0.0.1:9999', {
    token: 'token with spaces',
  });
  client.connectSSE();
  assert.equal(
    eventSourceUrl,
    'http://127.0.0.1:9999/events/receiver%2Fid?token=token%20with%20spaces',
  );
});

test('device listing sends room and authorization header', async () => {
  const client = new SignalingClient('receiver', 'http://127.0.0.1:9999', {
    token: 'test-token',
    room: 'room-a',
  });
  await client.fetchDeviceList();
  assert.equal(calls[0].url, 'http://127.0.0.1:9999/devices?room=room-a');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
});
