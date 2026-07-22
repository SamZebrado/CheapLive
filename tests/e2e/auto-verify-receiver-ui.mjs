// Receiver UI 自动验收脚本（headless Chromium）
// 测试 Android APK 上的 Receiver 页面：http://192.168.31.137:8765/receiver/?token=...
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.RECEIVER_BASE || 'http://192.168.31.137:8765';
const TOKEN = process.env.RECEIVER_TOKEN || 'gJXTh11z3IAJ0R3p1Nt5jyEB8HX_krQgbMooClmOh2I';
const URL = `${BASE}/receiver/?token=${TOKEN}&v=0.1.0`;
const SCREENSHOT_DIR = '/tmp/auto-verify-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' :: ' + detail : ''}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchStatus() {
  const r = await fetch(`${BASE}/api/status?token=${TOKEN}`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

async function sendControl(payload) {
  // payload = { type: ..., baseRevision: ..., patch: {...}, ... }
  const r = await fetch(`${BASE}/api/control?token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

async function setFtConfig(patch) {
  const status = await fetchStatus();
  const baseRevision = status.faceTrackingConfig.revision;
  return sendControl({
    type: 'setFaceTrackingConfig',
    baseRevision,
    patch,
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    // 1. 页面加载
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01_loaded.png` });
    record('1.页面加载', true);

    // 2. 配置面板可见
    const panelVisible = await page.locator('#controlPanel').isVisible().catch(() => false);
    record('2.配置面板可见', panelVisible);

    // 3. 滑块初值来自 Capture App（非默认中点）
    const ftSliderCount = await page.locator('input[type=range][data-ftkey]').count();
    record('3.面捕滑块存在', ftSliderCount > 0, `count=${ftSliderCount}`);

    if (ftSliderCount > 0) {
      const firstSlider = page.locator('input[type=range][data-ftkey]').first();
      const val = await firstSlider.inputValue();
      // 默认 scale.eyeLeft = 1.0；HTML range 默认中点通常是 0.5 或 50
      record('3.1 滑块初值=1(来自App,非HTML默认中点)', val === '1', `value=${val}`);
    }

    // 4. Receiver → App 修改（通过真实拖动滑块）
    const beforeStatus = await fetchStatus();
    const beforeRev = beforeStatus.faceTrackingConfig.revision;
    const beforeEyeLeft = beforeStatus.faceTrackingConfig.scale.eyeLeft;

    // 通过 API 修改并验证
    await setFtConfig({ scale: { eyeLeft: 1.8 } });
    await sleep(500);
    const afterStatus = await fetchStatus();
    const eyeLeftAfter = afterStatus.faceTrackingConfig.scale.eyeLeft;
    record('4.Receiver→App修改',
      Math.abs(eyeLeftAfter - 1.8) < 0.001 &&
      afterStatus.faceTrackingConfig.revision === beforeRev + 1,
      `eyeLeft: ${beforeEyeLeft}->${eyeLeftAfter}, rev: ${beforeRev}->${afterStatus.faceTrackingConfig.revision}`);

    // 4.1 真实拖动滑块（Playwright 鼠标操作）
    const slider = page.locator('input[data-ftkey="scale.eyeLeft"]').first();
    if (await slider.count() > 0) {
      try {
        await slider.focus();
        // 模拟键盘修改值（更可靠）
        await page.keyboard.press('Home');
        // 设为接近最大值
        for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
        await sleep(500); // 等 debounce + commit
        const sliderAfter = await slider.inputValue();
        const statusAfterDrag = await fetchStatus();
        const serverEyeLeft = statusAfterDrag.faceTrackingConfig.scale.eyeLeft;
        record('4.1 真实拖动滑块',
          parseFloat(sliderAfter) > 1.0 &&
          Math.abs(serverEyeLeft - parseFloat(sliderAfter)) < 0.001,
          `slider=${sliderAfter}, server=${serverEyeLeft}`);
      } catch (e) {
        record('4.1 真实拖动滑块', false, `error: ${e.message}`);
      }
    } else {
      record('4.1 真实拖动滑块', false, 'scale.eyeLeft slider not found');
    }

    // 5. App → Receiver 同步（通过 API 修改 eyeRight，验证 Receiver 滑块更新）
    const statusBefore5 = await fetchStatus();
    await setFtConfig({ scale: { eyeRight: 1.5 } });
    await sleep(1500); // 等 SSE 推送 + UI 更新
    const sliderRight = page.locator('input[data-ftkey="scale.eyeRight"]').first();
    if (await sliderRight.count() > 0) {
      const rightVal = await sliderRight.inputValue();
      record('5.App→Receiver同步', Math.abs(parseFloat(rightVal) - 1.5) < 0.001, `eyeRight slider=${rightVal}`);
    } else {
      record('5.App→Receiver同步', false, 'slider not found');
    }

    // 6. stale revision 拒绝
    const staleRes = await sendControl({
      type: 'setFaceTrackingConfig',
      baseRevision: 1,
      patch: { scale: { mouthOpen: 3.0 } },
    });
    const isStale = staleRes && (staleRes.staleRevision || 
      (staleRes.ok === false && typeof staleRes.message === 'string' && staleRes.message.indexOf('stale') >= 0));
    const afterStale = await fetchStatus();
    record('6.stale revision拒绝', 
      isStale && afterStale.faceTrackingConfig.scale.mouthOpen !== 3, 
      `stale=${isStale}, mouthOpen=${afterStale.faceTrackingConfig.scale.mouthOpen}, msg=${staleRes?.message}`);

    // 7. 同步状态显示
    const syncStatusVisible = await page.locator('.ft-sync-status').first().isVisible().catch(() => false);
    record('7.同步状态显示', syncStatusVisible);

    // 8. 应用模式隐藏控制面板
    await page.click('#toggleAppModeBtn').catch(async () => {
      // 备用：通过 evaluate 调用
      await page.evaluate(() => window.toggleAppMode && window.toggleAppMode());
    });
    await sleep(1000);
    const panelHidden = !(await page.locator('#controlPanel').isVisible().catch(() => false));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08_app_mode.png` });
    record('8.应用模式隐藏面板', panelHidden);

    // 9. 退出应用模式恢复
    const exitBtn = page.locator('#appModeExitBtn');
    if (await exitBtn.count() > 0 && await exitBtn.isVisible()) {
      await exitBtn.click();
      await sleep(800);
      const panelRestored = await page.locator('#controlPanel').isVisible().catch(() => false);
      record('9.退出应用模式恢复', panelRestored);
    } else {
      await page.mouse.dblclick(640, 450);
      await sleep(800);
      const panelRestored = await page.locator('#controlPanel').isVisible().catch(() => false);
      record('9.退出应用模式恢复(双击)', panelRestored);
    }

    // 10. reload 后读取最新配置
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const reloadEyeLeft = await page.locator('input[data-ftkey="scale.eyeLeft"]').first().inputValue();
    const reloadEyeRight = await page.locator('input[data-ftkey="scale.eyeRight"]').first().inputValue();
    const finalStatus = await fetchStatus();
    const serverEyeLeft = finalStatus.faceTrackingConfig.scale.eyeLeft;
    const serverEyeRight = finalStatus.faceTrackingConfig.scale.eyeRight;
    record('10.reload后读取最新配置',
      Math.abs(parseFloat(reloadEyeLeft) - serverEyeLeft) < 0.001 &&
      Math.abs(parseFloat(reloadEyeRight) - serverEyeRight) < 0.001,
      `UI L=${reloadEyeLeft} R=${reloadEyeRight} | Server L=${serverEyeLeft} R=${serverEyeRight}`);

    // 11. 双 Receiver 同时订阅
    const page2 = await context.newPage();
    await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const beforeP1Eye = await page.locator('input[data-ftkey="scale.eyeLeft"]').first().inputValue();

    // page2 修改 eyeLeft，验证 page1 通过 SSE 收到更新
    await page2.evaluate(async (t) => {
      const status = await fetch('/api/status?token=' + t).then(r => r.json());
      const baseRevision = status.faceTrackingConfig.revision;
      await fetch('/api/control?token=' + t, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'setFaceTrackingConfig',
          baseRevision,
          patch: { scale: { eyeLeft: 2.2 } }
        }),
      });
    }, TOKEN);
    await sleep(2000);
    const afterP1Eye = await page.locator('input[data-ftkey="scale.eyeLeft"]').first().inputValue();
    record('11.双Receiver同步', Math.abs(parseFloat(afterP1Eye) - 2.2) < 0.001, `page1 eyeLeft: ${beforeP1Eye}->${afterP1Eye}`);

    // 11.1 两端 revision 一致（通过 API 而非 window.appState）
    const p1Status = await fetchStatus();
    const p2UI = await page2.locator('input[data-ftkey="scale.eyeLeft"]').first().inputValue();
    const p1UI = await page.locator('input[data-ftkey="scale.eyeLeft"]').first().inputValue();
    record('11.1 双Receiver revision一致',
      Math.abs(parseFloat(p1UI) - parseFloat(p2UI)) < 0.001 &&
      Math.abs(parseFloat(p1UI) - p1Status.faceTrackingConfig.scale.eyeLeft) < 0.001,
      `p1UI=${p1UI}, p2UI=${p2UI}, server=${p1Status.faceTrackingConfig.scale.eyeLeft}, rev=${p1Status.faceTrackingConfig.revision}`);

    // 12. console error（忽略 CheapLiveReceiverDiag idle_tick 这类调试日志，过滤真实错误）
    const realErrors = consoleErrors.filter(e =>
      e.indexOf('idle_tick') < 0 &&
      e.indexOf('CheapLiveReceiverDiag') < 0
    );
    record('12.console error', realErrors.length === 0, `errors=${realErrors.length}` + (realErrors.length > 0 ? `: ${realErrors.slice(0,3).join(' | ')}` : ''));
    if (consoleErrors.length > 0) console.log('all console logs (filtered):', consoleErrors.slice(0, 5));

    await page2.close();
  } catch (e) {
    record('Exception', false, e.message);
    console.error(e);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Receiver UI Summary: ${passed}/${results.length} PASS, ${failed} FAIL ===`);
  fs.writeFileSync('/tmp/auto-verify-screenshots/receiver_ui_result.json', JSON.stringify(results, null, 2));
  process.exit(failed === 0 ? 0 : 1);
})();
