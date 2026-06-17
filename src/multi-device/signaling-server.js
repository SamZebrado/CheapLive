/**
 * CheapLive Signaling Server - 局域网设备发现和 WebRTC 信令服务
 *
 * 技术方案：Node.js HTTP Server + Server-Sent Events (SSE)
 * 纯本地运行，不上传数据到任何外部服务器
 *
 * 功能：
 * - 设备注册（POST /register）
 * - 设备心跳（POST /heartbeat/:id）
 * - 设备列表查询（GET /devices）
 * - 设备下线（DELETE /unregister/:id）
 * - WebRTC 信令转发（POST /signal/:targetId）
 * - SSE 实时推送（GET /events/:id）
 */

const http = require('http');
const url = require('url');

const PORT = process.env.SIGNAL_PORT || 8766;
const HEARTBEAT_INTERVAL_MS = 5000;
const DEVICE_TTL_MS = 15000; // 15秒无心跳视为离线

// 内存中的设备注册表
const devices = new Map(); // deviceId -> { id, name, ip, port, role, lastHeartbeat, sseRes }

// SSE 客户端连接表
const sseClients = new Map(); // deviceId -> response

// 清理过期设备的定时任务
setInterval(() => {
  const now = Date.now();
  for (const [id, device] of devices) {
    if (now - device.lastHeartbeat > DEVICE_TTL_MS) {
      console.log(`[TTL] Device ${id} expired, removing`);
      devices.delete(id);
      broadcastDeviceList();
    }
  }
}, HEARTBEAT_INTERVAL_MS);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function broadcastDeviceList() {
  const list = Array.from(devices.values()).map(d => ({
    id: d.id,
    name: d.name,
    ip: d.ip,
    port: d.port,
    role: d.role,
    lastSeen: d.lastHeartbeat,
  }));

  const data = `data: ${JSON.stringify({ type: 'deviceList', devices: list })}\n\n`;

  for (const [id, res] of sseClients) {
    try {
      res.write(data);
    } catch (e) {
      console.warn(`[SSE] Failed to send to ${id}, removing`);
      sseClients.delete(id);
    }
  }
}

function handleRegister(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const { id, name, ip, port, role } = data;

      if (!id || !role) {
        sendJSON(res, 400, { error: 'Missing id or role' });
        return;
      }

      // 更新或注册设备
      devices.set(id, {
        id,
        name: name || 'Unknown',
        ip: ip || 'unknown',
        port: port || 8765,
        role,
        lastHeartbeat: Date.now(),
      });

      console.log(`[Register] ${role} ${id} from ${ip}:${port}`);
      broadcastDeviceList();
      sendJSON(res, 200, { success: true, ttl: DEVICE_TTL_MS });
    } catch (e) {
      sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  });
}

function handleHeartbeat(req, res, deviceId) {
  const device = devices.get(deviceId);
  if (!device) {
    sendJSON(res, 404, { error: 'Device not found' });
    return;
  }
  device.lastHeartbeat = Date.now();
  sendJSON(res, 200, { success: true });
}

function handleUnregister(req, res, deviceId) {
  if (devices.has(deviceId)) {
    devices.delete(deviceId);
    console.log(`[Unregister] ${deviceId}`);
    broadcastDeviceList();
    sendJSON(res, 200, { success: true });
  } else {
    sendJSON(res, 404, { error: 'Device not found' });
  }
}

function handleDeviceList(req, res) {
  const now = Date.now();
  const list = Array.from(devices.values())
    .filter(d => now - d.lastHeartbeat <= DEVICE_TTL_MS)
    .map(d => ({
      id: d.id,
      name: d.name,
      ip: d.ip,
      port: d.port,
      role: d.role,
    }));
  sendJSON(res, 200, { devices: list });
}

function handleSignal(req, res, targetId) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const targetClient = sseClients.get(targetId);

      if (targetClient) {
        const msg = `data: ${JSON.stringify({ type: 'signal', from: data.from, payload: data.payload })}\n\n`;
        targetClient.write(msg);
        sendJSON(res, 200, { success: true, delivered: true });
      } else {
        // 目标不在线，缓存信号（简单实现：不缓存，直接返回未送达）
        sendJSON(res, 200, { success: true, delivered: false, reason: 'Target offline' });
      }
    } catch (e) {
      sendJSON(res, 400, { error: 'Invalid JSON' });
    }
  });
}

function handleSSE(req, res, deviceId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // 发送初始设备列表
  const now = Date.now();
  const list = Array.from(devices.values())
    .filter(d => now - d.lastHeartbeat <= DEVICE_TTL_MS && d.id !== deviceId)
    .map(d => ({
      id: d.id,
      name: d.name,
      ip: d.ip,
      port: d.port,
      role: d.role,
    }));

  res.write(`data: ${JSON.stringify({ type: 'deviceList', devices: list })}\n\n`);

  sseClients.set(deviceId, res);

  req.on('close', () => {
    sseClients.delete(deviceId);
    console.log(`[SSE] Client ${deviceId} disconnected`);
  });
}

const server = http.createServer((req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  console.log(`[${req.method}] ${path}`);

  if (path === '/register' && req.method === 'POST') {
    handleRegister(req, res);
  } else if (path.startsWith('/heartbeat/') && req.method === 'POST') {
    const deviceId = path.replace('/heartbeat/', '');
    handleHeartbeat(req, res, deviceId);
  } else if (path.startsWith('/unregister/') && req.method === 'DELETE') {
    const deviceId = path.replace('/unregister/', '');
    handleUnregister(req, res, deviceId);
  } else if (path === '/devices' && req.method === 'GET') {
    handleDeviceList(req, res);
  } else if (path.startsWith('/signal/') && req.method === 'POST') {
    const targetId = path.replace('/signal/', '');
    handleSignal(req, res, targetId);
  } else if (path.startsWith('/events/') && req.method === 'GET') {
    const deviceId = path.replace('/events/', '');
    handleSSE(req, res, deviceId);
  } else {
    sendJSON(res, 404, { error: 'Not found' });
  }
});

server.listen(PORT, () => {
  console.log(`CheapLive Signaling Server running on port ${PORT}`);
  console.log(`Device TTL: ${DEVICE_TTL_MS}ms`);
  console.log(`Heartbeat interval: ${HEARTBEAT_INTERVAL_MS}ms`);
});

module.exports = { server, devices, sseClients };
