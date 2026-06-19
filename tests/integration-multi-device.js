/**
 * CheapLive 多端集成测试 - 不依赖浏览器/摄像头
 *
 * 流程：
 *  1. 模拟 sender 和 receiver 两个客户端
 *  2. 两个客户端都注册到信令服务器，通过 SSE 监听事件
 *  3. sender 发送一个"hello message"信号给 receiver
 *  4. receiver 确认收到信号
 *
 *  注意：此脚本仅验证信令与参数通道，不验证 WebRTC 连接。
 */

const http = require('http');

const SIGNAL_BASE = 'http://127.0.0.1:8766';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SIGNAL_BASE + path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function connectSse(path, onMessage) {
  return new Promise((resolve, reject) => {
    const url = new URL(SIGNAL_BASE + path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE status: ${res.statusCode}`));
        return;
      }
      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk.toString('utf8');
        // SSE 以空行分隔消息
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              try { onMessage(JSON.parse(data)); } catch {}
            }
          }
        }
      });
      res.on('end', () => console.log('[SSE] connection ended'));
      resolve(() => { try { res.destroy(); } catch {} });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('[Test] 1. Register sender & receiver');
  let resp = await post('/register', { id: 'test-sender', name: 'Sender', ip: '127.0.0.1', port: 8765, role: 'sender' });
  console.log('  sender register:', resp.status, resp.body);
  resp = await post('/register', { id: 'test-receiver', name: 'Receiver', ip: '127.0.0.1', port: 8765, role: 'receiver' });
  console.log('  receiver register:', resp.status, resp.body);

  // 给 SSE 留时间建立连接
  const received = [];
  const disconnect = await connectSse('/events/test-receiver', (msg) => {
    received.push(msg);
    console.log('[SSE] receiver got:', msg.type, msg.from || '(broadcast)');
  });

  // 等待片刻确保连接稳定
  await new Promise(r => setTimeout(r, 800));

  console.log('[Test] 2. Query device list');
  resp = await post('/devices', {});
  console.log('  device list:', resp.body.slice(0, 200));

  console.log('[Test] 3. Send a signal from sender to receiver');
  resp = await post('/signal/test-receiver', {
    from: 'test-sender',
    payload: { type: 'face', params: { eyeLeft: 1, eyeRight: 1, mouthOpen: 0.3, headYaw: 0.5 } },
  });
  console.log('  signal result:', resp.status, resp.body);

  await new Promise(r => setTimeout(r, 800));

  console.log('[Test] 4. Verify receiver received signal');
  const faceMsg = received.find(m => m.type === 'signal' && m.payload && m.payload.type === 'face');
  if (!faceMsg) {
    console.log('  FAIL: receiver total messages:', received.length, received.map(r => r.type));
    console.log('  receiver could NOT get face signal');
    process.exit(1);
  }
  console.log('  OK: receiver got face params:', JSON.stringify(faceMsg.payload.params));

  console.log('[Test] 5. Unregister');
  resp = await post('/unregister/test-sender', {});
  console.log('  unregister sender:', resp.status);
  resp = await post('/unregister/test-receiver', {});
  console.log('  unregister receiver:', resp.status);
  disconnect();

  console.log('\n=== All integration checks passed ===');
}

main().catch(err => { console.error(err); process.exit(2); });
