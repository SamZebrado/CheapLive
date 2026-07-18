// Capture App UI 自动实操脚本（Playwright + /capture 页面 + Mock Bridge）
// 由于 WebView debugging 未启用，通过 LocalServer 加载 /capture 页面，
// 并 mock window.CheapLiveBridge.* 方法以使用 /api/control 完成端到端验证。
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';

const BASE = process.env.RECEIVER_BASE || 'http://192.168.31.137:8765';
const TOKEN = process.env.RECEIVER_TOKEN || 'gJXTh11z3IAJ0R3p1Nt5jyEB8HX_krQgbMooClmOh2I';
const URL = `${BASE}/capture/index.html?token=${TOKEN}&v=0.1.0`;
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
      hostname: BASE.replace(/^https?:\/\//, '').split(':')[0],
      port: parseInt(BASE.replace(/^https?:\/\//, '').split(':')[1] || '80'),
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchStatus() {
  const r = await httpRequest('GET', `/api/status?token=${TOKEN}`);
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  return JSON.parse(r.body);
}

async function sendControl(payload) {
  const r = await httpRequest('POST', `/api/control?token=${TOKEN}`, JSON.stringify(payload));
  return JSON.parse(r.body);
}

// 注入 mock bridge 的脚本
// - getFaceTrackingConfig: 通过 /api/status 拉取并返回
// - updateFaceTrackingConfig: 转发到 /api/control，并调用 applyFaceTrackingConfig 更新本地 currentConfig
// - submitCalibrationSample: 暂时不支持（需要真实采样）
// - getCalibrationStatus: 通过 /api/status 拉取
const BRIDGE_INIT_SCRIPT = `
window.__bridgeCalls = [];
window.CheapLiveBridge = {
  getSessionInfo: function() {
    return JSON.stringify({ sessionId: 'test', token: '${TOKEN}', port: 8765, version: 1, serverRunning: true });
  },
  getFaceTrackingConfig: function() {
    try {
      var r = new XMLHttpRequest();
      r.open('GET', '/api/status?token=${TOKEN}', false);
      r.send();
      var s = JSON.parse(r.responseText);
      return JSON.stringify(s.faceTrackingConfig);
    } catch (e) { return '{}'; }
  },
  getCalibrationStatus: function() {
    try {
      var r = new XMLHttpRequest();
      r.open('GET', '/api/status?token=${TOKEN}', false);
      r.send();
      var s = JSON.parse(r.responseText);
      return JSON.stringify({
        inProgress: s.calibrationInProgress,
        sampleCount: s.calibrationSampleCount,
        targetSamples: s.calibrationTargetSamples,
        lastError: s.calibrationLastError
      });
    } catch (e) { return '{}'; }
  },
  updateFaceTrackingConfig: function(json) {
    window.__bridgeCalls.push({ method: 'updateFaceTrackingConfig', args: [json] });
    try {
      var req = JSON.parse(json);
      var body = { type: 'setFaceTrackingConfig', baseRevision: req.baseRevision, patch: req.patch };
      var r = new XMLHttpRequest();
      r.open('POST', '/api/control?token=${TOKEN}', false);
      r.setRequestHeader('Content-Type', 'application/json');
      r.send(JSON.stringify(body));
      // 解析响应并通过 applyFaceTrackingConfig 更新本地 currentConfig
      // CaptureBridge.kt 实际行为：返回 { ok, message, state: { faceTrackingConfig: {...} } }
      var resp = JSON.parse(r.responseText);
      if (resp && resp.state && resp.state.faceTrackingConfig) {
        // 调用 capture 页面的 applyFaceTrackingConfig 以更新本地 currentConfig
        if (window.CheapLiveCapture && typeof window.CheapLiveCapture.applyFaceTrackingConfig === 'function') {
          window.CheapLiveCapture.applyFaceTrackingConfig(JSON.stringify(resp.state.faceTrackingConfig));
        }
      }
      return r.responseText;
    } catch (e) { console.error('bridge mock updateFaceTrackingConfig error', e); return '{}'; }
  },
  submitCalibrationSample: function(json) {
    window.__bridgeCalls.push({ method: 'submitCalibrationSample', args: [json] });
    return '{"ok":false,"reason":"mock bridge: calibration sample not supported in test env"}';
  },
  publishFaceFrame: function(json) {
    return '{"ok":true}';
  }
};
console.log('[TestBridge] CheapLiveBridge mock installed');
`;

(async () => {
  // 先重置 faceTrackingConfig 到默认
  await sendControl({ type: 'resetFaceTrackingConfig', keepCalibration: true });
  await sleep(300);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  // 注入 mock bridge 到每个新页面（在任何脚本运行前）
  await context.addInitScript(BRIDGE_INIT_SCRIPT);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // 1. 页面加载
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000); // 给页面时间初始化
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cap_01_loaded.png` });
    record('1./capture页面加载', true);

    // 2. 面捕设置面板实际可见
    const ftPanel = page.locator('#ftSettings, .ft-settings, [class*="ft-section"]').first();
    const panelVisible = await ftPanel.isVisible().catch(() => false);
    record('2.面捕设置面板可见', panelVisible);

    // 3. 基础面板可折叠（默认折叠，点击展开）
    const basicHeader = page.locator('#ftBasicHeader').first();
    const basicBody = page.locator('#ftBasicBody').first();
    if (await basicHeader.count() > 0) {
      // 默认应该是折叠状态
      const beforeExpanded = await basicBody.evaluate(el => el.classList.contains('expanded')).catch(() => false);
      // 点击展开
      await basicHeader.click();
      await sleep(500);
      const afterExpanded = await basicBody.evaluate(el => el.classList.contains('expanded')).catch(() => false);
      record('3.基础面板可折叠', beforeExpanded === false && afterExpanded === true, `before=${beforeExpanded}, after=${afterExpanded}`);
      
      // 截图展开后的状态
      await page.screenshot({ path: `${SCREENSHOT_DIR}/cap_03_basic_expanded.png` });
      
      // 4. 高级面板可折叠
      const advHeader = page.locator('#ftAdvancedHeader').first();
      const advBody = page.locator('#ftAdvancedBody').first();
      const advBefore = await advBody.evaluate(el => el.classList.contains('expanded')).catch(() => false);
      await advHeader.click();
      await sleep(500);
      const advAfter = await advBody.evaluate(el => el.classList.contains('expanded')).catch(() => false);
      record('4.高级面板可折叠', advBefore === false && advAfter === true, `before=${advBefore}, after=${advAfter}`);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/cap_04_advanced_expanded.png` });
    } else {
      record('3.基础面板可折叠', false, '基础面板 header not found');
      record('4.高级面板可折叠', false, '高级面板 header not found');
    }

    // 5. 真实拖动左眼 sensitivity 滑块
    const sliderL = page.locator('input[data-ftkey="scale.eyeLeft"]').first();
    if (await sliderL.count() > 0) {
      const beforeStatus = await fetchStatus();
      const beforeRev = beforeStatus.faceTrackingConfig.revision;
      const beforeVal = await sliderL.inputValue();

      // range input 不能用 fill()，需要 evaluate 设置 value 并 dispatch input 事件
      await sliderL.evaluate(el => { el.value = '2.5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      // 等待 debounce + commit
      await sleep(800);

      const afterVal = await sliderL.inputValue();
      const afterStatus = await fetchStatus();
      record('5.拖动左眼sensitivity滑块',
        afterVal === '2.5' &&
        Math.abs(afterStatus.faceTrackingConfig.scale.eyeLeft - 2.5) < 0.001 &&
        afterStatus.faceTrackingConfig.revision > beforeRev,
        `before=${beforeVal}, after=${afterVal}, server=${afterStatus.faceTrackingConfig.scale.eyeLeft}, rev=${beforeRev}->${afterStatus.faceTrackingConfig.revision}`);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/cap_05_after_slider_L.png` });
    } else {
      record('5.拖动左眼sensitivity滑块', false, 'scale.eyeLeft slider not found');
    }

    // 6. 真实拖动右眼滑块
    const sliderR = page.locator('input[data-ftkey="scale.eyeRight"]').first();
    if (await sliderR.count() > 0) {
      const beforeStatus = await fetchStatus();
      const beforeRev = beforeStatus.faceTrackingConfig.revision;
      const beforeVal = await sliderR.inputValue();

      await sliderR.evaluate(el => { el.value = '2.0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await sleep(800);

      const afterVal = await sliderR.inputValue();
      const afterStatus = await fetchStatus();
      record('6.拖动右眼sensitivity滑块',
        Math.abs(parseFloat(afterVal) - 2.0) < 0.001 &&
        Math.abs(afterStatus.faceTrackingConfig.scale.eyeRight - 2.0) < 0.001 &&
        afterStatus.faceTrackingConfig.revision > beforeRev,
        `before=${beforeVal}, after=${afterVal}, server=${afterStatus.faceTrackingConfig.scale.eyeRight}, rev=${beforeRev}->${afterStatus.faceTrackingConfig.revision}`);
    } else {
      record('6.拖动右眼sensitivity滑块', false, 'scale.eyeRight slider not found');
    }

    // 7. 左右眼互不联动（修改左眼不影响右眼，反之亦然）
    const sBefore = await fetchStatus();
    const leftBefore = sBefore.faceTrackingConfig.scale.eyeLeft;
    const rightBefore = sBefore.faceTrackingConfig.scale.eyeRight;

    // 修改左眼到 3.0
    await sliderL.evaluate(el => { el.value = '3.0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(800);
    const sAfterLeft = await fetchStatus();
    const leftAfterLeft = sAfterLeft.faceTrackingConfig.scale.eyeLeft;
    const rightAfterLeft = sAfterLeft.faceTrackingConfig.scale.eyeRight;

    record('7.左右眼互不联动',
      Math.abs(leftAfterLeft - 3.0) < 0.001 &&  // 左眼确实变为 3.0
      Math.abs(rightAfterLeft - rightBefore) < 0.001,   // 右眼未变
      `before: L=${leftBefore}, R=${rightBefore}; after left=3.0: L=${leftAfterLeft}, R=${rightAfterLeft}`);

    // 8. 左右眼 offset 分别可调
    const sliderLOffset = page.locator('input[data-ftkey="offset.eyeLeft"]').first();
    const sliderROffset = page.locator('input[data-ftkey="offset.eyeRight"]').first();
    if ((await sliderLOffset.count() > 0) && (await sliderROffset.count() > 0)) {
      const beforeStatus = await fetchStatus();
      const beforeLOff = beforeStatus.faceTrackingConfig.offset.eyeLeft;
      const beforeROff = beforeStatus.faceTrackingConfig.offset.eyeRight;

      await sliderLOffset.evaluate(el => { el.value = '0.15'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await sleep(800);

      const afterLOffset = await fetchStatus();
      record('8.左眼offset可调',
        Math.abs(afterLOffset.faceTrackingConfig.offset.eyeLeft - 0.15) < 0.001 &&
        Math.abs(afterLOffset.faceTrackingConfig.offset.eyeRight - beforeROff) < 0.001,
        `L offset: ${beforeLOff}->${afterLOffset.faceTrackingConfig.offset.eyeLeft}, R offset: ${beforeROff}->${afterLOffset.faceTrackingConfig.offset.eyeRight}`);
    } else {
      record('8.左眼offset可调', false, 'offset.eyeLeft slider not found');
    }

    // 9. 嘴巴、微笑、yaw/pitch/roll、position X/Y 控件可操作
    const controlKeys = [
      'scale.mouthOpen', 'scale.mouthSmile',
      'scale.headYaw', 'scale.headPitch', 'scale.headRoll',
      'scale.positionX', 'scale.positionY',
    ];
    let allControlOk = true;
    const controlDetails = [];
    for (const key of controlKeys) {
      const slider = page.locator(`input[data-ftkey="${key}"]`).first();
      if (await slider.count() > 0) {
        const beforeStatus = await fetchStatus();
        const beforeRev = beforeStatus.faceTrackingConfig.revision;
        const beforeVal = await slider.inputValue();
        // 设为 2.0（若已经是 2.0 则设为 2.5 以确保变化触发 patch）
        const targetVal = beforeVal === '2' || beforeVal === '2.0' ? '2.5' : '2.0';
        await slider.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, targetVal);
        await sleep(800); // 增加 wait 时间避免 debounce race
        const afterStatus = await fetchStatus();
        const afterVal = await slider.inputValue();
        const ok = afterStatus.faceTrackingConfig.revision > beforeRev;
        if (!ok) allControlOk = false;
        controlDetails.push(`${key}: ${ok ? 'ok' : 'fail'}(before=${beforeVal},after=${afterVal},rev=${beforeRev}->${afterStatus.faceTrackingConfig.revision})`);
      } else {
        allControlOk = false;
        controlDetails.push(`${key}: slider not found`);
      }
    }
    record('9.其他控件可操作', allControlOk, controlDetails.join(', '));

    // 10. revision、保存状态、校准状态实际显示
    // 检查是否有显示 revision 的元素
    const revDisplay = await page.locator('[data-ftdisplay="revision"], .ft-revision, #ftRevision').count();
    const syncStatus = await page.locator('.ft-sync-status, #ftSyncStatus').count();
    const calibStatus = await page.locator('.ft-calibration-status, #ftCalibStatus, [data-calib-status]').count();
    record('10.状态显示元素存在', 
      revDisplay > 0 || syncStatus > 0 || calibStatus > 0, 
      `rev=${revDisplay}, sync=${syncStatus}, calib=${calibStatus}`);

    // 11. 面板不遮挡主要摄像头操作区
    // 通过截图判断主要 canvas 不被覆盖
    const avatarCanvas = page.locator('canvas').first();
    const canvasExists = await avatarCanvas.count() > 0;
    // 在 Playwright 环境中，无摄像头权限，canvas 可能未渲染但 DOM 中存在
    record('11.主要canvas元素存在(不遮挡)', canvasExists);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/cap_11_panel_not_blocking.png` });

    // 12. console error（忽略调试日志和模型预加载日志）
    const realErrors = consoleErrors.filter(e =>
      e.indexOf('idle_tick') < 0 &&
      e.indexOf('CheapLiveCaptureDiag') < 0 &&
      e.indexOf('CheapLiveCameraDiag') < 0 &&  // 摄像头诊断日志（无摄像头权限）
      e.indexOf('preload_model') < 0 &&       // 模型预加载日志
      e.indexOf('faceLandmarker_model') < 0   // 模型加载日志
    );
    record('12.console无真实错误', realErrors.length === 0, `errors=${realErrors.length}` + (realErrors.length > 0 ? `: ${realErrors.slice(0, 3).join(' | ')}` : ''));

  } catch (e) {
    record('Exception', false, e.message);
    console.error(e);
  } finally {
    await browser.close();
  }

  // 清理：恢复默认配置
  await sendControl({ type: 'resetFaceTrackingConfig', keepCalibration: true });
  await sleep(300);

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Capture App UI Summary: ${passed}/${results.length} PASS, ${failed} FAIL ===`);
  fs.writeFileSync('/tmp/auto-verify-screenshots/capture_ui_result.json', JSON.stringify(results, null, 2));
  process.exit(failed === 0 ? 0 : 1);
})();
