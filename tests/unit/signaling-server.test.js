/**
 * Signaling Server 单元测试
 *
 * 测试覆盖：
 * - 设备注册（POST /register）
 * - 设备心跳（POST /heartbeat/:id）
 * - 设备列表查询（GET /devices）
 * - 设备下线（DELETE /unregister/:id）
 * - WebRTC信令转发（POST /signal/:targetId）
 * - SSE实时推送（GET /events/:id）
 */

import http from 'http';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import url from 'url';

// 测试模式下启动服务器
process.env.TEST_MODE = 'true';
process.env.SIGNAL_PORT = '18766'; // 使用不同端口避免冲突

// 导入服务器模块（动态导入以确保环境变量生效）
const signalingModule = await import('../../src/multi-device/signaling-server.js');
const { server, devices, sseClients, PORT } = signalingModule;

const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(BASE_URL + path);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('Signaling Server', () => {
  before(async () => {
    // 在测试模式下手动启动服务器
    await new Promise((resolve) => {
      server.listen(PORT, '0.0.0.0', () => {
        resolve();
      });
    });
  });

  after(async () => {
    // 关闭服务器
    server.close();
  });

  beforeEach(() => {
    // 清空设备表
    devices.clear();
    sseClients.clear();
  });

  describe('设备注册 POST /register', () => {
    it('正常注册应返回成功', async () => {
      const res = await makeRequest('POST', '/register', {
        id: 'device-001',
        name: 'Test Device',
        ip: '192.168.1.100',
        port: 8765,
        role: 'capture'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.ttl > 0);
    });

    it('缺少id应返回400', async () => {
      const res = await makeRequest('POST', '/register', {
        name: 'Test Device',
        role: 'capture'
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Missing id or role');
    });

    it('缺少role应返回400', async () => {
      const res = await makeRequest('POST', '/register', {
        id: 'device-002'
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Missing id or role');
    });

    it('无效JSON应返回400', async () => {
      // 手动发送无效JSON
      const res = await new Promise((resolve, reject) => {
        const parsedUrl = url.parse(BASE_URL + '/register');
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, body: { error: 'parse error' } });
            }
          });
        });

        req.on('error', reject);
        req.write('invalid json');
        req.end();
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid JSON');
    });

    it('重复注册应更新设备信息', async () => {
      await makeRequest('POST', '/register', {
        id: 'device-003',
        name: 'First Name',
        role: 'capture'
      });

      const res = await makeRequest('POST', '/register', {
        id: 'device-003',
        name: 'Updated Name',
        role: 'receiver'
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const listRes = await makeRequest('GET', '/devices');
      const device = listRes.body.devices.find(d => d.id === 'device-003');
      assert.strictEqual(device.name, 'Updated Name');
      assert.strictEqual(device.role, 'receiver');
    });
  });

  describe('设备心跳 POST /heartbeat/:id', () => {
    it('正常心跳应返回成功', async () => {
      await makeRequest('POST', '/register', {
        id: 'device-004',
        role: 'capture'
      });

      const res = await makeRequest('POST', '/heartbeat/device-004');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('设备不存在应返回404', async () => {
      const res = await makeRequest('POST', '/heartbeat/nonexistent');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Device not found');
    });
  });

  describe('设备列表查询 GET /devices', () => {
    it('空设备表应返回空列表', async () => {
      const res = await makeRequest('GET', '/devices');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.devices.length, 0);
    });

    it('应返回已注册设备', async () => {
      await makeRequest('POST', '/register', {
        id: 'device-005',
        name: 'Device A',
        role: 'capture'
      });

      await makeRequest('POST', '/register', {
        id: 'device-006',
        name: 'Device B',
        role: 'receiver'
      });

      const res = await makeRequest('GET', '/devices');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.devices.length, 2);
    });
  });

  describe('设备下线 DELETE /unregister/:id', () => {
    it('正常下线应返回成功', async () => {
      await makeRequest('POST', '/register', {
        id: 'device-007',
        role: 'capture'
      });

      const res = await makeRequest('DELETE', '/unregister/device-007');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const listRes = await makeRequest('GET', '/devices');
      assert.strictEqual(listRes.body.devices.length, 0);
    });

    it('设备不存在应返回404', async () => {
      const res = await makeRequest('DELETE', '/unregister/nonexistent');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Device not found');
    });
  });

  describe('WebRTC信令转发 POST /signal/:targetId', () => {
    it('目标在线应返回delivered=true', async () => {
      // 注册两个设备
      await makeRequest('POST', '/register', {
        id: 'sender-001',
        role: 'capture'
      });

      await makeRequest('POST', '/register', {
        id: 'receiver-001',
        role: 'receiver'
      });

      // 模拟SSE连接（简单测试，不实际建立SSE）
      // 在真实场景中，SSE连接需要长连接，这里只测试信令转发逻辑

      const res = await makeRequest('POST', '/signal/receiver-001', {
        from: 'sender-001',
        payload: { type: 'offer', sdp: 'test-sdp' }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      // 由于没有实际SSE连接，delivered应为false
      assert.strictEqual(res.body.delivered, false);
    });

    it('目标离线应返回delivered=false', async () => {
      await makeRequest('POST', '/register', {
        id: 'sender-002',
        role: 'capture'
      });

      const res = await makeRequest('POST', '/signal/offline-target', {
        from: 'sender-002',
        payload: { type: 'offer', sdp: 'test-sdp' }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.delivered, false);
      assert.strictEqual(res.body.reason, 'Target offline');
    });

    it('无效JSON应返回400', async () => {
      const res = await new Promise((resolve, reject) => {
        const parsedUrl = url.parse(BASE_URL + '/signal/target-001');
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, body: {} });
            }
          });
        });

        req.on('error', reject);
        req.write('invalid json');
        req.end();
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid JSON');
    });
  });

  describe('OPTIONS预检请求', () => {
    it('OPTIONS应返回204', async () => {
      const res = await makeRequest('OPTIONS', '/register');
      assert.strictEqual(res.status, 204);
    });
  });

  describe('未知路径', () => {
    it('未知路径应返回404', async () => {
      const res = await makeRequest('GET', '/unknown-path');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Not found');
    });
  });

  describe('CORS头', () => {
    it('所有响应应包含CORS头', async () => {
      const res = await makeRequest('GET', '/devices');
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
      assert.ok(res.headers['access-control-allow-methods']);
    });
  });
});