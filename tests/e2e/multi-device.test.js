/**
 * CheapLive Multi-Device E2E Tests
 *
 * Tests signaling server, device discovery, heartbeat, and WebRTC P2P
 * Each test uses independent BrowserContexts for sender and receiver.
 */

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

// ===================== 工具函数 =====================

/**
 * 启动信令服务器，返回 server 实例和端口
 */
function startSignalingServer(port) {
  return new Promise((resolve, reject) => {
    const serverPath = path.resolve(__dirname, '../../src/multi-device/signaling-server.js');
    const child = spawn('node', [serverPath], {
      env: { ...process.env, SIGNAL_PORT: String(port), TEST_MODE: '1' },
      stdio: 'pipe',
    });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes(`running on port ${port}`)) {
        resolve({ server: child, port });
      }
    });

    child.stderr.on('data', (data) => {
      // 忽略正常日志输出到 stderr 的情况
    });

    child.on('error', reject);

    // 超时保护
    setTimeout(() => {
      if (!stdout.includes(`running on port ${port}`)) {
        reject(new Error(`Signaling server failed to start on port ${port}`));
      }
    }, 5000);
  });
}

/**
 * 停止信令服务器
 */
function stopSignalingServer(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }
    child.on('close', resolve);
    child.kill('SIGTERM');
    // 强制终止保护
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      resolve();
    }, 3000);
  });
}

/**
 * 打开多端互动页面并选择模式
 * 策略：通过 addInitScript 在页面任何脚本运行前注入全局配置，
 * 让 SignalingClient.detectServerUrl 读取该配置
 */
async function openModePage(context, mode, port) {
  // 在页面任何脚本执行前注入测试端口配置
  // signaling-client.js 的 detectServerUrl() 会优先读取 window.__TEST_SIGNAL_PORT
  await context.addInitScript((testPort) => {
    window.__TEST_SIGNAL_PORT = testPort;
  }, port);

  const page = await context.newPage();
  // 使用 domcontentloaded 避免被 CDN 资源阻塞
  await page.goto('/src/multi-device/index.html', { waitUntil: 'domcontentloaded' });

  // 等待模式选择卡片可见
  await page.locator('.mode-select').waitFor({ state: 'visible', timeout: 5000 });

  if (mode === 'sender') {
    await page.locator('.mode-card[data-mode="sender"]').click();
    await page.locator('#senderPanel').waitFor({ state: 'visible', timeout: 5000 });
  } else if (mode === 'receiver') {
    await page.locator('.mode-card[data-mode="receiver"]').click();
    await page.locator('#receiverPanel').waitFor({ state: 'visible', timeout: 5000 });
  }

  return page;
}

/**
 * 等待设备列表更新（通过轮询页面内部状态）
 */
async function waitForDeviceList(page, expectedCount, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = await page.evaluate(() => {
      // Receiver 内部状态
      if (window.receiver && window.receiver.discoveredDevices) {
        return window.receiver.discoveredDevices.length;
      }
      // 或者通过 DOM 查询设备项数量
      return document.querySelectorAll('.device-item').length;
    });
    if (count >= expectedCount) return count;
    await page.waitForTimeout(500);
  }
  throw new Error(`Timeout waiting for device list count >= ${expectedCount}`);
}

/**
 * 获取接收端发现的设备列表（内部状态）
 */
async function getDiscoveredDevices(page) {
  return page.evaluate(() => {
    if (window.receiver && window.receiver.discoveredDevices) {
      return window.receiver.discoveredDevices;
    }
    return [];
  });
}

// ===================== 测试套件 =====================

test.describe('Multi-Device Signaling & Discovery', () => {
  let serverInfo = null;
  let basePort = 18766; // 起始端口，每个测试递增

  test.beforeEach(async ({}, testInfo) => {
    // 为每个测试分配独立端口，避免冲突
    const port = basePort + testInfo.workerIndex * 10 + (testInfo.retry || 0);
    serverInfo = await startSignalingServer(port);
  });

  test.afterEach(async () => {
    if (serverInfo) {
      await stopSignalingServer(serverInfo.server);
      serverInfo = null;
    }
  });

  test('sender registration and receiver discovery', async ({ browser }) => {
    const port = serverInfo.port;

    // 创建独立的 browser context
    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();

    try {
      // 1. 创建 sender
      const senderPage = await openModePage(senderContext, 'sender', port);

      // 等待 sender 初始化完成（signalingClient 存在且 ID 已显示）
      await senderPage.waitForFunction(() => {
        return window.sender && window.sender.signalingClient && window.sender.id && window.sender.id !== '-';
      }, { timeout: 10000 });

      // 2. 创建 receiver
      const receiverPage = await openModePage(receiverContext, 'receiver', port);

      // 等待 receiver 初始化完成
      await receiverPage.waitForFunction(() => {
        return window.receiver && window.receiver.signalingClient;
      }, { timeout: 10000 });

      // 3. 等待 receiver 发现 sender
      await waitForDeviceList(receiverPage, 1, 8000);

      // 4. 断言设备信息
      const devices = await getDiscoveredDevices(receiverPage);
      expect(devices.length).toBeGreaterThanOrEqual(1);

      const senderDevice = devices.find(d => d.role === 'sender');
      expect(senderDevice).toBeDefined();
      expect(senderDevice.id).toBeTruthy();
      expect(senderDevice.name).toBeTruthy();
      expect(senderDevice.role).toBe('sender');
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });

  test('receiver connects before sender registers', async ({ browser }) => {
    const port = serverInfo.port;

    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();

    try {
      // 1. 先打开 receiver
      const receiverPage = await openModePage(receiverContext, 'receiver', port);

      await receiverPage.waitForFunction(() => {
        return window.receiver && window.receiver && window.receiver.signalingClient;
      }, { timeout: 5000 });

      // 此时应该没有设备
      let devices = await getDiscoveredDevices(receiverPage);
      expect(devices.length).toBe(0);

      // 2. 再打开 sender
      const senderPage = await openModePage(senderContext, 'sender', port);

      await senderPage.waitForFunction(() => {
        return window.sender && window.sender && window.sender.signalingClient;
      }, { timeout: 5000 });

      // 3. receiver 应该通过 SSE 实时更新，发现 sender
      await waitForDeviceList(receiverPage, 1, 8000);

      devices = await getDiscoveredDevices(receiverPage);
      expect(devices.length).toBeGreaterThanOrEqual(1);
      expect(devices.some(d => d.role === 'sender')).toBe(true);
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });

  test('heartbeat keeps device online', async ({ browser }) => {
    const port = serverInfo.port;

    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();

    try {
      // 先打开 sender，确保先注册
      const senderPage = await openModePage(senderContext, 'sender', port);

      await senderPage.waitForFunction(() => {
        return window.sender && window.sender.signalingClient && window.sender.id && window.sender.id !== '-';
      }, { timeout: 10000 });

      // 等待 sender 完成注册
      await senderPage.waitForTimeout(1000);

      // 再打开 receiver
      const receiverPage = await openModePage(receiverContext, 'receiver', port);

      await receiverPage.waitForFunction(() => {
        return window.receiver && window.receiver.signalingClient;
      }, { timeout: 10000 });

      // 等待 receiver 发现 sender
      await waitForDeviceList(receiverPage, 1, 8000);

      // 等待超过一个心跳周期（5s），但小于 TTL（8s），确认心跳保持在线
        await receiverPage.waitForTimeout(6000);

      // 直接调用 fetchDeviceList 获取设备，不依赖 SSE
      await receiverPage.evaluate(() => {
        if (window.receiver && window.receiver.signalingClient) {
          window.receiver.signalingClient.fetchDeviceList();
        }
      });
      await receiverPage.waitForTimeout(500);

      // sender 应该仍然在线
      const devices = await getDiscoveredDevices(receiverPage);
      expect(devices.length).toBeGreaterThanOrEqual(1);
      expect(devices.some(d => d.role === 'sender')).toBe(true);
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });

  test('device offline after TTL', async ({ browser }) => {
    test.setTimeout(45000); // 此测试需要较长等待时间
    const port = serverInfo.port;

    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();

    try {
      // 注册 sender
      const senderPage = await openModePage(senderContext, 'sender', port);

      await senderPage.waitForFunction(() => {
        return window.sender && window.sender.signalingClient;
      }, { timeout: 10000 });

      // 打开 receiver
      const receiverPage = await openModePage(receiverContext, 'receiver', port);

      await receiverPage.waitForFunction(() => {
        return window.receiver && window.receiver.signalingClient;
      }, { timeout: 10000 });

      await waitForDeviceList(receiverPage, 1, 8000);

      // 关闭 sender 页面，停止其心跳
      await senderPage.close();

      // 等待 TTL 过期（测试模式 8s + 2s 缓冲 = 10s）
      await receiverPage.waitForTimeout(10000);

      // 通过 HTTP API 直接检查服务器端设备状态
      const response = await fetch(`http://localhost:${port}/devices`);
      const data = await response.json();
      expect(data.devices.filter(d => d.role === 'sender').length).toBe(0);

      // 刷新 receiver 设备列表并验证 UI
      await receiverPage.evaluate(() => {
        if (window.receiver && window.receiver.signalingClient) {
          window.receiver.signalingClient.fetchDeviceList();
        }
      });
      await receiverPage.waitForTimeout(500);

      // DOM 也应显示无设备
      const emptyText = await receiverPage.locator('#scanResults').textContent();
      expect(emptyText).toContain('未发现');
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });

  test('manual connection fallback when server down', async ({ browser }) => {
    // 先停止当前测试启动的服务器，模拟服务器不可用
    if (serverInfo) {
      await stopSignalingServer(serverInfo.server);
      serverInfo = null;
    }

    const receiverContext = await browser.newContext();

    try {
      // 不启动服务器，直接打开 receiver
      // 使用一个肯定没有服务的端口
      const fakePort = 59999;
      await receiverContext.addInitScript((testPort) => {
        window.__TEST_SIGNAL_PORT = testPort;
      }, fakePort);
      const receiverPage = await receiverContext.newPage();
      await receiverPage.goto('/src/multi-device/index.html', { waitUntil: 'domcontentloaded' });
      await receiverPage.locator('.mode-card[data-mode="receiver"]').click();
      await receiverPage.locator('#receiverPanel').waitFor({ state: 'visible' });

      // 点击扫描按钮
      await receiverPage.locator('#scanBtn').click();

      // 等待错误状态显示在 scanResults 中
      await receiverPage.waitForFunction(() => {
        const results = document.getElementById('scanResults');
        return results && (results.textContent.includes('失败') || results.textContent.includes('不可用') || results.textContent.includes('错误'));
      }, { timeout: 5000 });

      // 手动输入区域仍然可用
      await expect(receiverPage.locator('#targetId')).toBeVisible();
      await expect(receiverPage.locator('#targetIp')).toBeVisible();
      await expect(receiverPage.locator('#connectBtn')).toBeVisible();
    } finally {
      await receiverContext.close();
    }
  });

  test('copy button shows manual hint on failure', async ({ browser }) => {
    const port = serverInfo.port;

    const senderContext = await browser.newContext();

    try {
      const senderPage = await openModePage(senderContext, 'sender', port);

      // 覆盖 navigator.clipboard 和 document.execCommand 使其失败
      await senderPage.evaluate(() => {
        // 覆盖 clipboard API
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: () => Promise.reject(new Error('Clipboard denied')),
          },
          configurable: true,
        });
        // 覆盖 execCommand
        document.execCommand = () => false;
      });

      // 点击复制 ID 按钮
      await senderPage.locator('#copySenderId').click();

      // 断言按钮显示 "复制失败"
      await expect(senderPage.locator('#copySenderId')).toHaveText('复制失败', { timeout: 3000 });

      // 断言手动复制提示出现
      await senderPage.waitForFunction(() => {
        const hint = document.querySelector('.copy-hint');
        return hint && hint.textContent.includes('手动复制');
      }, { timeout: 3000 });
    } finally {
      await senderContext.close();
    }
  });

  test('WebRTC offer/answer exchange', async ({ browser }) => {
    const port = serverInfo.port;

    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();

    try {
      // 创建 sender
      const senderPage = await openModePage(senderContext, 'sender', port);

      await senderPage.waitForFunction(() => {
        return window.sender && window.sender && window.sender.signalingClient;
      }, { timeout: 5000 });

      // 获取 sender ID
      const senderId = await senderPage.evaluate(() => window.sender.id);
      expect(senderId).toBeTruthy();

      // 创建 receiver
      const receiverPage = await openModePage(receiverContext, 'receiver', port);

      await receiverPage.waitForFunction(() => {
        return window.receiver && window.receiver && window.receiver.signalingClient;
      }, { timeout: 5000 });

      // 等待 receiver 发现 sender
      await waitForDeviceList(receiverPage, 1, 8000);

      // 拦截信令消息以验证 offer/answer 交换
      // 在 sender 页面拦截发送和接收
      await senderPage.evaluate(() => {
        window.__testSignals = [];
        const originalSendSignal = window.sender.signalingClient.sendSignal.bind(window.sender.signalingClient);
        window.sender.signalingClient.sendSignal = async function (targetId, payload) {
          window.__testSignals.push({ direction: 'sent', targetId, payload });
          return originalSendSignal(targetId, payload);
        };
        const originalOnSignal = window.sender.signalingClient.onSignal;
        window.sender.signalingClient.onSignal = function (from, payload) {
          window.__testSignals.push({ direction: 'received', from, payload });
          if (originalOnSignal) originalOnSignal(from, payload);
        };
      });

      // 在 receiver 页面拦截发送和接收
      await receiverPage.evaluate(() => {
        window.__testSignals = [];
        const originalSendSignal = window.receiver.signalingClient.sendSignal.bind(window.receiver.signalingClient);
        window.receiver.signalingClient.sendSignal = async function (targetId, payload) {
          window.__testSignals.push({ direction: 'sent', targetId, payload });
          return originalSendSignal(targetId, payload);
        };
        const originalOnSignal = window.receiver.signalingClient.onSignal;
        window.receiver.signalingClient.onSignal = function (from, payload) {
          window.__testSignals.push({ direction: 'received', from, payload });
          if (originalOnSignal) originalOnSignal(from, payload);
        };
      });

      // receiver 点击连接 sender
      await receiverPage.locator('#targetId').fill(senderId);
      await receiverPage.locator('#connectBtn').click();

      // 等待一段时间让信令消息流动
      await receiverPage.waitForTimeout(3000);

      // 验证 sender 收到了 connect_request
      const senderSignals = await senderPage.evaluate(() => window.__testSignals || []);
      const connectRequest = senderSignals.find(s => s.direction === 'received' && s.payload.type === 'connect_request');
      expect(connectRequest).toBeDefined();

      // 验证 sender 发送了 offer
      const offerSignal = senderSignals.find(s => s.direction === 'sent' && s.payload.type === 'offer');
      expect(offerSignal).toBeDefined();
      expect(offerSignal.payload.offer).toBeDefined();

      // 验证 receiver 收到了 offer
      const receiverSignals = await receiverPage.evaluate(() => window.__testSignals || []);
      const receivedOffer = receiverSignals.find(s => s.direction === 'received' && s.payload.type === 'offer');
      expect(receivedOffer).toBeDefined();

      // 验证 receiver 发送了 answer
      const answerSignal = receiverSignals.find(s => s.direction === 'sent' && s.payload.type === 'answer');
      expect(answerSignal).toBeDefined();
      expect(answerSignal.payload.answer).toBeDefined();
    } finally {
      await senderContext.close();
      await receiverContext.close();
    }
  });
});
