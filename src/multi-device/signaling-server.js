/**
 * CheapLive local signaling service.
 *
 * The reusable factory is intentionally side-effect free: importing this file
 * never binds a port. The command-line entrypoint starts one LAN service.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8766;
const DEFAULT_DEVICE_TTL_MS = 15_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000;
const MAX_BODY_BYTES = 1_000_000;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CheapLive-Token');
}

function sendJson(res, status, data) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function extractToken(req, parsedUrl, body = {}) {
  const authorization = req.headers.authorization ?? '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  const headerToken = req.headers['x-cheaplive-token'];
  if (typeof headerToken === 'string') return headerToken;
  const queryToken = parsedUrl.searchParams.get('token');
  if (queryToken) return queryToken;
  return typeof body.token === 'string' ? body.token : '';
}

function normalizeRoom(value) {
  if (value === undefined || value === null || value === '') return 'default';
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) return null;
  return value;
}

function hasOnlyFiniteNumbers(value, seen = new Set()) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => hasOnlyFiniteNumbers(item, seen));
  seen.delete(value);
  return valid;
}

export function createSignalingService(options = {}) {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = Number(options.port ?? 0);
  const authToken = options.token ?? '';
  const requireAuth = options.requireAuth ?? authToken.length > 0;
  const deviceTtlMs = options.deviceTtlMs ?? DEFAULT_DEVICE_TTL_MS;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const logger = options.logger ?? console;

  const devices = new Map();
  const sseClients = new Map();
  const lastSequences = new Map();
  const sockets = new Set();
  let cleanupInterval = null;

  function isAuthorized(req, parsedUrl, body) {
    return !requireAuth || extractToken(req, parsedUrl, body) === authToken;
  }

  function publicDevice(device) {
    return {
      id: device.id,
      name: device.name,
      ip: device.ip,
      port: device.port,
      role: device.role,
      room: device.room,
      lastSeen: device.lastHeartbeat,
    };
  }

  function roomDevices(room, excludedId = null) {
    const now = Date.now();
    return [...devices.values()]
      .filter((device) => device.room === room
        && device.id !== excludedId
        && now - device.lastHeartbeat <= deviceTtlMs)
      .map(publicDevice);
  }

  function broadcastDeviceList(room) {
    for (const [deviceId, response] of sseClients) {
      const device = devices.get(deviceId);
      if (!device || device.room !== room || response.writableEnded) continue;
      response.write(`data: ${JSON.stringify({
        type: 'deviceList',
        devices: roomDevices(room, deviceId),
      })}\n\n`);
    }
  }

  function removeDevice(deviceId) {
    const device = devices.get(deviceId);
    if (!device) return false;
    devices.delete(deviceId);
    const response = sseClients.get(deviceId);
    if (response && !response.writableEnded) response.end();
    sseClients.delete(deviceId);
    for (const key of lastSequences.keys()) {
      if (key.startsWith(`${deviceId}->`) || key.includes(`->${deviceId}:`)) lastSequences.delete(key);
    }
    broadcastDeviceList(device.room);
    return true;
  }

  async function handleRequest(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    let body = {};
    if (req.method === 'POST' && (pathname === '/register' || pathname.startsWith('/signal/'))) {
      try {
        body = await readJson(req);
      } catch (error) {
        sendJson(res, error.message === 'Invalid JSON' ? 400 : 413, { error: error.message });
        return;
      }
    }

    if (!isAuthorized(req, parsedUrl, body)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (pathname === '/register' && req.method === 'POST') {
      const room = normalizeRoom(body.room);
      if (!body.id || !body.role) {
        sendJson(res, 400, { error: 'Missing id or role' });
        return;
      }
      if (!room) {
        sendJson(res, 400, { error: 'Invalid room' });
        return;
      }
      devices.set(body.id, {
        id: body.id,
        name: body.name || 'Unknown',
        ip: body.ip || 'unknown',
        port: body.port || 8765,
        role: body.role,
        room,
        lastHeartbeat: Date.now(),
      });
      broadcastDeviceList(room);
      sendJson(res, 200, { success: true, ttl: deviceTtlMs });
      return;
    }

    if (pathname.startsWith('/heartbeat/') && req.method === 'POST') {
      const deviceId = decodeURIComponent(pathname.slice('/heartbeat/'.length));
      const device = devices.get(deviceId);
      if (!device) {
        sendJson(res, 404, { error: 'Device not found' });
        return;
      }
      device.lastHeartbeat = Date.now();
      sendJson(res, 200, { success: true });
      return;
    }

    if (pathname.startsWith('/unregister/') && req.method === 'DELETE') {
      const deviceId = decodeURIComponent(pathname.slice('/unregister/'.length));
      const removed = removeDevice(deviceId);
      sendJson(res, removed ? 200 : 404,
        removed ? { success: true } : { error: 'Device not found' });
      return;
    }

    if (pathname === '/devices' && req.method === 'GET') {
      const room = normalizeRoom(parsedUrl.searchParams.get('room'));
      if (!room) {
        sendJson(res, 400, { error: 'Invalid room' });
        return;
      }
      sendJson(res, 200, { devices: roomDevices(room) });
      return;
    }

    if (pathname.startsWith('/events/') && req.method === 'GET') {
      const deviceId = decodeURIComponent(pathname.slice('/events/'.length));
      const device = devices.get(deviceId);
      if (!device) {
        sendJson(res, 404, { error: 'Device not found' });
        return;
      }
      const existing = sseClients.get(deviceId);
      if (existing && !existing.writableEnded) existing.end();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({
        type: 'deviceList',
        devices: roomDevices(device.room, deviceId),
      })}\n\n`);
      sseClients.set(deviceId, res);
      req.on('close', () => {
        if (sseClients.get(deviceId) === res) sseClients.delete(deviceId);
      });
      return;
    }

    if (pathname.startsWith('/signal/') && req.method === 'POST') {
      const targetId = decodeURIComponent(pathname.slice('/signal/'.length));
      const source = devices.get(body.from);
      const target = devices.get(targetId);
      if (!source) {
        sendJson(res, 403, { error: 'Sender not registered' });
        return;
      }
      if (!target || target.room !== source.room) {
        sendJson(res, 404, { error: 'Target unavailable' });
        return;
      }
      if (!hasOnlyFiniteNumbers(body.payload)) {
        sendJson(res, 400, { error: 'Invalid payload number' });
        return;
      }
      if (body.sequence !== undefined) {
        if (!Number.isSafeInteger(body.sequence) || body.sequence < 0) {
          sendJson(res, 400, { error: 'Invalid sequence' });
          return;
        }
        const sequenceKey = `${body.from}->${targetId}:${body.payload?.type ?? 'signal'}`;
        const previous = lastSequences.get(sequenceKey);
        if (previous !== undefined && body.sequence <= previous) {
          sendJson(res, 409, {
            error: body.sequence === previous ? 'Duplicate sequence' : 'Stale sequence',
          });
          return;
        }
        lastSequences.set(sequenceKey, body.sequence);
      }
      const targetClient = sseClients.get(targetId);
      if (targetClient && !targetClient.writableEnded) {
        targetClient.write(`data: ${JSON.stringify({
          type: 'signal',
          from: body.from,
          sequence: body.sequence,
          payload: body.payload,
        })}\n\n`);
        sendJson(res, 200, { success: true, delivered: true });
      } else {
        sendJson(res, 200, { success: true, delivered: false, reason: 'Target offline' });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      logger.error?.(`[Signaling] request failed: ${error.message}`);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  async function start() {
    if (server.listening) return server.address();
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(error);
      server.once('error', onError);
      server.listen(requestedPort, host, () => {
        server.off('error', onError);
        resolve();
      });
    });
    if (heartbeatIntervalMs > 0) {
      cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [deviceId, device] of devices) {
          if (now - device.lastHeartbeat > deviceTtlMs) removeDevice(deviceId);
        }
      }, heartbeatIntervalMs);
      cleanupInterval.unref?.();
    }
    return server.address();
  }

  async function stop() {
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = null;
    for (const response of sseClients.values()) {
      if (!response.writableEnded) response.end();
    }
    sseClients.clear();
    if (!server.listening) return;
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      for (const socket of sockets) socket.destroy();
    });
  }

  return {
    server,
    devices,
    sseClients,
    lastSequences,
    start,
    stop,
    get baseUrl() {
      const address = server.address();
      return address && typeof address === 'object' ? `http://${host}:${address.port}` : null;
    },
  };
}

export const PORT = Number(process.env.SIGNAL_PORT || DEFAULT_PORT);
export const DEVICE_TTL_MS = process.env.TEST_MODE ? 8_000 : DEFAULT_DEVICE_TTL_MS;
export const HEARTBEAT_INTERVAL_MS = process.env.TEST_MODE ? 1_000 : DEFAULT_HEARTBEAT_INTERVAL_MS;
const defaultService = createSignalingService({
  host: process.env.SIGNAL_HOST || '0.0.0.0',
  port: PORT,
  token: process.env.SIGNAL_TOKEN || '',
  deviceTtlMs: DEVICE_TTL_MS,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
});
export const server = defaultService.server;
export const devices = defaultService.devices;
export const sseClients = defaultService.sseClients;

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  defaultService.start()
    .then((address) => {
      console.log(`CheapLive Signaling Server running on port ${address.port}`);
      console.log(`Device TTL: ${DEVICE_TTL_MS}ms`);
      console.log(`Heartbeat interval: ${HEARTBEAT_INTERVAL_MS}ms`);
    })
    .catch((error) => {
      console.error(`CheapLive Signaling Server failed: ${error.message}`);
      process.exitCode = 1;
    });
}
