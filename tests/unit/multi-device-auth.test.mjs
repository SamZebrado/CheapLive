import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

import { SignalingClient } from '../../src/multi-device/signaling-client.js';
import { createSignalingService } from '../../src/multi-device/signaling-server.js';

// Execute the shipped role methods without downloading MediaPipe or starting media.
const source = fs.readFileSync(new URL('../../src/multi-device/multi-device.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '');
const fixtureToken = 'synthetic-auth +/?&=#';

async function fixture(t, serverToken, enteredToken) {
  const service = createSignalingService({ token: serverToken, heartbeatIntervalMs: 0 });
  await service.start();
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.unregister()));
    await service.stop();
  });
  const intervals = new Map();
  t.mock.method(globalThis, 'setInterval', (callback) => {
    const id = intervals.size + 1;
    intervals.set(id, callback);
    return id;
  });
  t.mock.method(globalThis, 'clearInterval', (id) => intervals.delete(id));
  // Keep the browser EventSource URL and handlers; open its stream with real HTTP below.
  const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
  t.after(() => {
    if (originalEventSource) Object.defineProperty(globalThis, 'EventSource', originalEventSource);
    else delete globalThis.EventSource;
  });
  globalThis.EventSource = class {
    constructor(url) { this.url = url; }
    close() { this.closed = true; }
  };
  const elements = {
    signalingToken: { value: enteredToken },
    status: { textContent: '' },
    receiverStatus: { textContent: '' },
    receiverSignalingStatus: { textContent: '' },
    receiverSignalingError: { classList: new Set(['hidden']) },
  };
  elements.receiverSignalingError.classList.remove = (name) => elements.receiverSignalingError.classList.delete(name);
  const registrations = [];
  class LocalClient extends SignalingClient {
    detectServerUrl() { return service.baseUrl; }
    register(...args) {
      const result = super.register(...args);
      registrations.push(result);
      return result;
    }
  }
  const context = vm.createContext({
    SignalingClient: LocalClient,
    window: { addEventListener() {} },
    document: { readyState: 'loading', addEventListener() {}, getElementById: (id) => elements[id] },
    console: { log() {}, warn() {} },
  });
  vm.runInContext(`${source}\nglobalThis.roles = { Sender, Receiver };`, context);
  const roles = ['Sender', 'Receiver'].map((name) => {
    const role = Object.create(context.roles[name].prototype);
    role.id = name.toLowerCase();
    role.discoveredDevices = [];
    role.updateDeviceList = () => {};
    role.initSignaling();
    clients.push(role.signalingClient);
    return role;
  });
  const results = await Promise.all(registrations);
  return { service, roles, results, elements, intervals };
}

test('shipped sender and receiver register, discover, heartbeat, signal and unregister with the entered token', async (t) => {
  const { service, roles, results, intervals } = await fixture(t, fixtureToken, fixtureToken);
  assert.ok(results.every((result) => result.success), 'both shipped roles must authenticate');
  assert.equal(service.devices.size, 2);
  assert.equal(intervals.size, 2);
  const [sender, receiver] = roles.map((role) => role.signalingClient);
  assert.deepEqual((await receiver.fetchDeviceList()).map((device) => device.id).sort(), ['receiver', 'sender']);

  // Exercise the exact encoded EventSource URL produced by the browser client.
  const streamAbort = new AbortController();
  t.after(() => streamAbort.abort());
  const stream = await fetch(receiver.eventSource.url, { signal: streamAbort.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  await reader.read(); // initial deviceList
  const nextEvent = reader.read();
  assert.equal((await sender.sendSignal('receiver', { type: 'fixture' })).delivered, true);
  const event = JSON.parse(new TextDecoder().decode((await nextEvent).value).split('data: ')[1].trim());
  assert.equal(event.type, 'signal');
  assert.equal(event.from, 'sender');
  assert.equal(event.payload.type, 'fixture');
  streamAbort.abort();

  service.devices.get('sender').lastHeartbeat = 1;
  await intervals.get(sender.heartbeatTimer)();
  // Heartbeat callback is fire-and-forget; wait for its HTTP request to finish.
  for (let attempt = 0; service.devices.get('sender').lastHeartbeat === 1 && attempt < 100; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(service.devices.get('sender').lastHeartbeat > 1);
  await Promise.all([sender.unregister(), receiver.unregister()]);
  assert.equal(service.devices.size, 0);
  assert.equal(intervals.size, 0);
  assert.equal(sender.connected, false);
});

for (const [label, enteredToken] of [['missing', ''], ['wrong', 'synthetic-wrong']]) {
  test(`shipped roles reject ${label} credentials without starting heartbeat or SSE and show an auth error`, async (t) => {
    const { service, roles, results, elements, intervals } = await fixture(t, fixtureToken, enteredToken);
    assert.ok(results.every((result) => result.error));
    assert.equal(service.devices.size, 0);
    assert.equal(intervals.size, 0);
    for (const role of roles) {
      assert.equal(role.signalingClient.eventSource, null);
      assert.equal(role.signalingClient.connected, false);
    }
    assert.match(elements.status.textContent, /Authentication failed/);
    assert.equal(elements.receiverStatus.textContent, '信令服务不可用');
    assert.equal(elements.receiverSignalingError.classList.has('hidden'), false);
    assert.match(elements.receiverSignalingStatus.textContent, /认证失败.*Token.*重试/);
    assert.equal(elements.receiverSignalingStatus.textContent.includes(fixtureToken), false);
  });
}

test('shipped roles keep working with an empty field when server authentication is disabled', async (t) => {
  const { service, results, elements } = await fixture(t, '', '');
  assert.ok(results.every((result) => result.success));
  assert.equal(service.devices.size, 2);
  assert.equal(elements.receiverSignalingError.classList.has('hidden'), true);
});
