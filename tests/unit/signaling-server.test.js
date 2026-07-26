import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createSignalingService } from '../../src/multi-device/signaling-server.js';

const TEST_TOKEN = 'local-test-token';
let service;

async function request(pathname, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.token !== null) headers.Authorization = `Bearer ${options.token ?? TEST_TOKEN}`;
  let body;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${service.baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: AbortSignal.timeout(2_000),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : {},
  };
}

async function register(id, room = 'default', role = 'capture') {
  return request('/register', {
    method: 'POST',
    body: { id, room, role },
  });
}

function parseSseChunk(chunk) {
  const line = String(chunk).split('\n').find((value) => value.startsWith('data: '));
  return line ? JSON.parse(line.slice(6)) : null;
}

function connectSse(deviceId) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${service.baseUrl}/events/${encodeURIComponent(deviceId)}?token=${TEST_TOKEN}`, (res) => {
      res.setEncoding('utf8');
      res.once('data', (chunk) => resolve({ req, res, initial: parseSseChunk(chunk) }));
    });
    req.setTimeout(2_000, () => req.destroy(new Error('SSE connect timeout')));
    req.on('error', reject);
  });
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}

describe('local signaling service', () => {
  before(async () => {
    service = createSignalingService({
      host: '127.0.0.1',
      port: 0,
      token: TEST_TOKEN,
      heartbeatIntervalMs: 0,
      logger: { error() {} },
    });
    const address = await service.start();
    assert.equal(address.address, '127.0.0.1');
    assert.ok(address.port > 0);
  });

  after(async () => {
    await service.stop();
  });

  beforeEach(() => {
    for (const response of service.sseClients.values()) response.end();
    service.sseClients.clear();
    service.devices.clear();
    service.lastSequences.clear();
  });

  it('rejects requests with no token or a wrong token', async () => {
    const missing = await request('/devices', { token: null });
    const wrong = await request('/devices', { token: 'wrong-token' });
    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(missing.body.error, 'Unauthorized');
  });

  it('registers two clients and isolates rooms', async () => {
    assert.equal((await register('capture-a', 'room-a')).status, 200);
    assert.equal((await register('receiver-a', 'room-a', 'receiver')).status, 200);
    assert.equal((await register('capture-b', 'room-b')).status, 200);
    const roomA = await request('/devices?room=room-a');
    const roomB = await request('/devices?room=room-b');
    assert.deepEqual(roomA.body.devices.map((device) => device.id).sort(), ['capture-a', 'receiver-a']);
    assert.deepEqual(roomB.body.devices.map((device) => device.id), ['capture-b']);
  });

  it('forwards messages to a connected SSE client', async () => {
    await register('sender');
    await register('receiver', 'default', 'receiver');
    const sse = await connectSse('receiver');
    assert.equal(sse.initial.type, 'deviceList');
    const eventPromise = new Promise((resolve) => {
      sse.res.once('data', (chunk) => resolve(parseSseChunk(chunk)));
    });
    const result = await request('/signal/receiver', {
      method: 'POST',
      body: { from: 'sender', sequence: 1, payload: { type: 'offer', sdp: 'test' } },
    });
    const event = await eventPromise;
    assert.equal(result.status, 200);
    assert.equal(result.body.delivered, true);
    assert.equal(event.type, 'signal');
    assert.equal(event.from, 'sender');
    assert.equal(event.sequence, 1);
    sse.req.destroy();
  });

  it('reports a registered target without SSE as offline', async () => {
    await register('sender');
    await register('receiver', 'default', 'receiver');
    const result = await request('/signal/receiver', {
      method: 'POST',
      body: { from: 'sender', sequence: 1, payload: { type: 'offer' } },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.delivered, false);
    assert.equal(result.body.reason, 'Target offline');
  });

  it('rejects cross-room forwarding', async () => {
    await register('sender', 'room-a');
    await register('receiver', 'room-b', 'receiver');
    const result = await request('/signal/receiver', {
      method: 'POST',
      body: { from: 'sender', sequence: 1, payload: { type: 'offer' } },
    });
    assert.equal(result.status, 404);
    assert.equal(result.body.error, 'Target unavailable');
  });

  it('rejects duplicate and out-of-order sequences', async () => {
    await register('sender');
    await register('receiver', 'default', 'receiver');
    const send = (sequence) => request('/signal/receiver', {
      method: 'POST',
      body: { from: 'sender', sequence, payload: { type: 'frame' } },
    });
    assert.equal((await send(5)).status, 200);
    const duplicate = await send(5);
    const stale = await send(4);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error, 'Duplicate sequence');
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'Stale sequence');
  });

  it('rejects non-finite payload numbers and invalid sequences', async () => {
    await register('sender');
    await register('receiver', 'default', 'receiver');
    const nonFinite = await request('/signal/receiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{"from":"sender","sequence":1,"payload":{"x":1e999}}',
    });
    const invalidSequence = await request('/signal/receiver', {
      method: 'POST',
      body: { from: 'sender', sequence: -1, payload: { type: 'frame' } },
    });
    assert.equal(nonFinite.status, 400);
    assert.equal(nonFinite.body.error, 'Invalid payload number');
    assert.equal(invalidSequence.status, 400);
  });

  it('cleans up a disconnected SSE client and permits reconnect', async () => {
    await register('receiver', 'default', 'receiver');
    const first = await connectSse('receiver');
    assert.equal(service.sseClients.size, 1);
    first.req.destroy();
    await waitFor(() => service.sseClients.size === 0, 'SSE client was not removed after disconnect');
    const second = await connectSse('receiver');
    assert.equal(service.sseClients.size, 1);
    second.req.destroy();
    await waitFor(() => service.sseClients.size === 0, 'SSE client was not removed after reconnect close');
  });

  it('unregister removes device and active SSE state', async () => {
    await register('receiver', 'default', 'receiver');
    const sse = await connectSse('receiver');
    const result = await request('/unregister/receiver', { method: 'DELETE' });
    assert.equal(result.status, 200);
    assert.equal(service.devices.has('receiver'), false);
    assert.equal(service.sseClients.has('receiver'), false);
    sse.req.destroy();
  });

  it('returns bounded errors for invalid JSON and unknown routes', async () => {
    const invalid = await request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      rawBody: '{bad',
    });
    const missing = await request('/unknown');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'Invalid JSON');
    assert.equal(missing.status, 404);
  });

  it('returns CORS preflight headers', async () => {
    const result = await request('/register', { method: 'OPTIONS', token: null });
    assert.equal(result.status, 204);
    assert.match(result.headers.get('access-control-allow-headers'), /Authorization/);
  });

  it('supports concurrent dynamic ports without collisions', async () => {
    const first = createSignalingService({ host: '127.0.0.1', port: 0, heartbeatIntervalMs: 0 });
    const second = createSignalingService({ host: '127.0.0.1', port: 0, heartbeatIntervalMs: 0 });
    const firstAddress = await first.start();
    const secondAddress = await second.start();
    assert.notEqual(firstAddress.port, secondAddress.port);
    await first.stop();
    await second.stop();
  });

  it('releases its port after stop so another server can bind', async () => {
    const first = createSignalingService({ host: '127.0.0.1', port: 0, heartbeatIntervalMs: 0 });
    const address = await first.start();
    await first.stop();
    const second = createSignalingService({
      host: '127.0.0.1',
      port: address.port,
      heartbeatIntervalMs: 0,
    });
    await second.start();
    assert.equal(second.server.address().port, address.port);
    await second.stop();
  });
});
