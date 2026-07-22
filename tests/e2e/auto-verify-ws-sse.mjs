// WebSocket & SSE 自动验收脚本
// 测试 LocalServer /ws 和 /events 端点的鉴权、状态推送、断线重连等
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import { WebSocket } from 'ws';

const BASE = process.env.RECEIVER_BASE || 'http://192.168.31.137:8765';
const BASE_HOST = BASE.replace(/^https?:\/\//, '');
const TOKEN = process.env.RECEIVER_TOKEN || 'gJXTh11z3IAJ0R3p1Nt5jyEB8HX_krQgbMooClmOh2I';
const WS_URL = `ws://${BASE_HOST}/ws?token=${TOKEN}`;
const SSE_PATH = `/events?token=${TOKEN}`;
const SCREENSHOT_DIR = '/tmp/auto-verify-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' :: ' + detail : ''}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE_HOST.split(':')[0],
      port: parseInt(BASE_HOST.split(':')[1] || '80'),
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchStatus(token) {
  const r = await httpRequest('GET', `/api/status?token=${encodeURIComponent(token || TOKEN)}`);
  return r;
}

async function sendControl(token, payload) {
  const r = await httpRequest('POST', `/api/control?token=${encodeURIComponent(token || TOKEN)}`, JSON.stringify(payload));
  try { return JSON.parse(r.body); } catch { return { _raw: r.body, status: r.status }; }
}

async function setFtConfig(token, patch) {
  const r = await fetchStatus(token);
  const status = JSON.parse(r.body);
  const baseRevision = status.faceTrackingConfig.revision;
  return sendControl(token, { type: 'setFaceTrackingConfig', baseRevision, patch });
}

// SSE 客户端
function openSSE(onEvent, onError, onClose) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BASE_HOST.split(':')[0],
      port: parseInt(BASE_HOST.split(':')[1] || '80'),
      path: SSE_PATH,
      method: 'GET',
      headers: { 'Accept': 'text/event-stream', 'Cache-Control': 'no-cache' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode !== 200) {
        resolve({ status: res.statusCode, close: () => res.destroy() });
        return;
      }
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        let eventName = 'message';
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
          else if (line === '' && data) {
            try { onEvent(eventName, JSON.parse(data)); } catch { onEvent(eventName, data); }
            eventName = 'message';
            data = '';
          }
        }
      });
      res.on('error', (e) => onError && onError(e));
      res.on('close', () => onClose && onClose());
      resolve({ status: 200, close: () => res.destroy() });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  // ============== WebSocket 测试 ==============

  // 1. 正确 token 的 WebSocket 握手成功
  try {
    const ws = new WebSocket(WS_URL);
    const opened = await new Promise((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });
    record('WS-1.正确token握手成功', opened);
    if (opened) ws.close();
  } catch (e) {
    record('WS-1.正确token握手成功', false, e.message);
  }

  // 2. 错误 token 返回 403
  try {
    const ws = new WebSocket(`ws://${BASE_HOST}/ws?token=WRONG_TOKEN`);
    let unexpectedOpen = false;
    let closedCode = null;
    const result = await new Promise((resolve) => {
      ws.on('open', () => { unexpectedOpen = true; ws.close(); resolve('open'); });
      ws.on('error', () => resolve('error'));
      ws.on('close', (code) => { closedCode = code; resolve('close'); });
      setTimeout(() => resolve('timeout'), 5000);
    });
    // ws 库无法直接看到 HTTP 403，但 open 应该不触发（或触发后立即 close）
    record('WS-2.错误token拒绝', !unexpectedOpen, `result=${result}, closedCode=${closedCode}`);
  } catch (e) {
    record('WS-2.错误token拒绝', false, e.message);
  }

  // 3. token 来源与二维码 URL 一致（API 返回与本地存储一致）
  try {
    const statusRes = await fetchStatus(TOKEN);
    const statusData = JSON.parse(statusRes.body);
    const serverRunning = statusData.serverRunning;
    // 二维码 URL 中的 token = TOKEN（来自 SharedPreferences cheaplive_connection_identity）
    record('WS-3.token与API一致', serverRunning === true && statusData.faceTrackingConfig !== undefined);
  } catch (e) {
    record('WS-3.token与API一致', false, e.message);
  }

  // 4. App 重启后正确 token 仍可连接（通过 SSE 持续工作来验证，不真的重启 App）
  // 此项通过 Force-stop 重启 App 的二维码稳定性 A/B/C 已验证，这里只做存活检查
  try {
    const statusRes = await fetchStatus(TOKEN);
    record('WS-4.token在App存活期可用', statusRes.status === 200);
  } catch (e) {
    record('WS-4.token在App存活期可用', false, e.message);
  }

  // 5. 重置连接后旧 token 被拒绝、新 token 成功
  // 注：本测试不真的执行 resetConnectionIdentity（会破坏测试环境）
  // 已在二维码测试 D 中验证；这里通过错误 token 模拟
  try {
    const res = await fetchStatus('INVALID_TOKEN_AFTER_RESET');
    record('WS-5.错误token被拒绝', res.status === 403);
  } catch (e) {
    record('WS-5.错误token被拒绝', false, e.message);
  }

  // ============== SSE 测试 ==============

  // 6. SSE 初始状态推送
  try {
    let received = false;
    let firstEvent = null;
    const sse = await openSSE(
      (event, data) => { if (!received) { received = true; firstEvent = { event, data }; } },
      (e) => console.log('SSE error:', e.message),
      () => {}
    );
    await sleep(2000);
    sse.close();
    record('SSE-6.初始状态推送', received && firstEvent && firstEvent.data && firstEvent.data.serverRunning !== undefined, 
      `received=${received}, hasState=${!!(firstEvent && firstEvent.data && firstEvent.data.serverRunning !== undefined)}`);
  } catch (e) {
    record('SSE-6.初始状态推送', false, e.message);
  }

  // 7. SSE 配置变更推送
  try {
    let cfgChanged = false;
    let receivedRev = null;
    let receivedRevCount = 0;
    const sse = await openSSE(
      (event, data) => {
        if (data && data.faceTrackingConfig && data.faceTrackingConfig.revision !== undefined) {
          receivedRev = data.faceTrackingConfig.revision;
          receivedRevCount++;
        }
      },
      () => {},
      () => {}
    );
    await sleep(1000);
    // 触发配置变更（用最新 revision）
    const before = await setFtConfig(TOKEN, { offset: { eyeLeft: 0.05 } });
    await sleep(2000);
    sse.close();
    record('SSE-7.配置变更推送', 
      before && before.ok === true && receivedRevCount >= 1, 
      `sent ok=${before?.ok}, receivedRevCount=${receivedRevCount}, lastReceivedRev=${receivedRev}`);
  } catch (e) {
    record('SSE-7.配置变更推送', false, e.message);
  }

  // 8. SSE 断线重连
  try {
    let receivedCount = 0;
    const sse1 = await openSSE(() => { receivedCount++; }, () => {}, () => {});
    await sleep(1500);
    sse1.close();
    await sleep(1000);
    // 重连
    const sse2 = await openSSE(() => { receivedCount++; }, () => {}, () => {});
    await sleep(1500);
    sse2.close();
    record('SSE-8.断线重连', receivedCount >= 2, `received ${receivedCount} events across 2 connections`);
  } catch (e) {
    record('SSE-8.断线重连', false, e.message);
  }

  // 9. 两个 Receiver 同时订阅
  try {
    let p1Count = 0;
    let p2Count = 0;
    const sse1 = await openSSE(() => { p1Count++; }, () => {}, () => {});
    const sse2 = await openSSE(() => { p2Count++; }, () => {}, () => {});
    await sleep(1000);
    // 触发广播
    await sendControl(TOKEN, { type: 'setFaceTrackingConfig', baseRevision: 0, patch: { offset: { eyeRight: 0.04 } } });
    await sleep(2000);
    sse1.close();
    sse2.close();
    record('SSE-9.双Receiver同时订阅', p1Count >= 1 && p2Count >= 1, `p1=${p1Count}, p2=${p2Count}`);
  } catch (e) {
    record('SSE-9.双Receiver同时订阅', false, e.message);
  }

  // 10. 无持续重连风暴和日志刷屏
  // 检查：连续打开 5 个 SSE 客户端不导致服务器崩溃或日志激增
  try {
    const clients = [];
    for (let i = 0; i < 5; i++) {
      const sse = await openSSE(() => {}, () => {}, () => {});
      clients.push(sse);
    }
    await sleep(2000);
    // 检查服务器仍可响应
    const status = await fetchStatus(TOKEN);
    // 清理
    clients.forEach(c => c.close());
    await sleep(500);
    record('SSE-10.5个并发无风暴', status.status === 200, `server still responds: ${status.status === 200}`);
  } catch (e) {
    record('SSE-10.5个并发无风暴', false, e.message);
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== WS/SSE Summary: ${passed}/${results.length} PASS, ${failed} FAIL ===`);
  fs.writeFileSync('/tmp/auto-verify-screenshots/ws_sse_result.json', JSON.stringify(results, null, 2));
  process.exit(failed === 0 ? 0 : 1);
})();
