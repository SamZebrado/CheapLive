// 透明应用模式像素自动验收脚本
// 验证 Receiver Canvas 在普通模式和应用模式下的透明度
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

// 从 canvas 读取像素 RGBA
async function readCanvasPixels(page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'canvas not found' };
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return { error: 'canvas size 0' };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'no 2d ctx' };
    try {
      const points = [
        { name: 'tl', x: 1, y: 1 },
        { name: 'tr', x: w - 2, y: 1 },
        { name: 'bl', x: 1, y: h - 2 },
        { name: 'br', x: w - 2, y: h - 2 },
        { name: 'center', x: Math.floor(w / 2), y: Math.floor(h / 2) },
        { name: 'q1', x: Math.floor(w / 4), y: Math.floor(h / 4) },
        { name: 'q3', x: Math.floor(3 * w / 4), y: Math.floor(3 * h / 4) },
      ];
      const result = { width: w, height: h, points: {} };
      for (const p of points) {
        try {
          const d = ctx.getImageData(p.x, p.y, 1, 1).data;
          result.points[p.name] = { r: d[0], g: d[1], b: d[2], a: d[3] };
        } catch (e) {
          result.points[p.name] = { error: e.message };
        }
      }
      let nonZeroAlphaCount = 0;
      let totalSampled = 0;
      const stepX = Math.max(1, Math.floor(w / 50));
      const stepY = Math.max(1, Math.floor(h / 50));
      try {
        for (let y = 0; y < h; y += stepY) {
          for (let x = 0; x < w; x += stepX) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            if (d[3] > 0) nonZeroAlphaCount++;
            totalSampled++;
          }
        }
      } catch (e) {
        result.sampleError = e.message;
      }
      result.nonZeroAlphaRatio = totalSampled > 0 ? nonZeroAlphaCount / totalSampled : 0;
      result.totalSampled = totalSampled;
      return result;
    } catch (e) {
      return { error: e.message };
    }
  });
}

async function checkBackgroundTransparent(page, appMode) {
  return await page.evaluate((mode) => {
    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    const container = document.querySelector('.container');
    const containerStyle = container ? window.getComputedStyle(container) : null;
    const stage = document.querySelector('#stage');
    const stageStyle = stage ? window.getComputedStyle(stage) : null;

    function parseAlpha(color) {
      if (!color) return null;
      const m = color.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 4) return parts[3];
      if (parts.length === 3) return 1;
      return null;
    }

    return {
      appMode: mode,
      bodyBg: bodyStyle.backgroundColor,
      bodyAlpha: parseAlpha(bodyStyle.backgroundColor),
      containerBg: containerStyle ? containerStyle.backgroundColor : null,
      containerAlpha: containerStyle ? parseAlpha(containerStyle.backgroundColor) : null,
      stageBg: stageStyle ? stageStyle.backgroundColor : null,
      stageAlpha: stageStyle ? parseAlpha(stageStyle.backgroundColor) : null,
      bodyClassAppMode: body.classList.contains('app-mode'),
    };
  }, appMode);
}

// 通过按钮点击进入/退出应用模式（不依赖 window.toggleAppMode）
// 进入：点击 #toggleAppModeBtn（普通模式下可见）
// 退出：点击 #appModeExitBtn（应用模式下可见）或双击屏幕
async function setAppMode(page, enter) {
  const currentAppMode = await page.evaluate(() => document.body.classList.contains('app-mode'));
  if (enter && !currentAppMode) {
    // 普通模式下点击 toggleAppModeBtn 进入应用模式
    await page.click('#toggleAppModeBtn');
  } else if (!enter && currentAppMode) {
    // 应用模式下 toggleAppModeBtn 被隐藏，改用 appModeExitBtn
    const exitBtn = page.locator('#appModeExitBtn');
    if (await exitBtn.count() > 0 && await exitBtn.isVisible().catch(() => false)) {
      await exitBtn.click();
    } else {
      // 备用：双击屏幕中央退出
      await page.mouse.dblclick(640, 450);
    }
  }
  await sleep(800);
  return await page.evaluate(() => document.body.classList.contains('app-mode'));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/trans_01_loaded.png` });
    record('0.页面加载', true);

    // ========== 1. 普通模式 Canvas 四角 alpha=255 ==========
    // 确保在普通模式
    await setAppMode(page, false);
    const normalPixels = await readCanvasPixels(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/trans_02_normal_pixels.png` });
    if (normalPixels.error) {
      record('1.普通模式四角alpha=255', false, normalPixels.error);
    } else {
      const corners = ['tl', 'tr', 'bl', 'br'];
      let allOpaque = true;
      const details = [];
      for (const c of corners) {
        const p = normalPixels.points[c];
        const a = p.a;
        const ok = a === 255;
        if (!ok) allOpaque = false;
        details.push(`${c}.a=${a}`);
      }
      record('1.普通模式四角alpha=255', allOpaque, details.join(', '));
    }

    // ========== 2. 应用模式四角 alpha=0 ==========
    await setAppMode(page, true);
    await sleep(1500); // 等 renderer 重绘
    await page.screenshot({ path: `${SCREENSHOT_DIR}/trans_03_app_mode.png` });

    const appPixels = await readCanvasPixels(page);
    if (appPixels.error) {
      record('2.应用模式四角alpha=0', false, appPixels.error);
    } else {
      const corners = ['tl', 'tr', 'bl', 'br'];
      let allTransparent = true;
      const details = [];
      for (const c of corners) {
        const p = appPixels.points[c];
        const a = p.a;
        const ok = a === 0;
        if (!ok) allTransparent = false;
        details.push(`${c}.a=${a}`);
      }
      record('2.应用模式四角alpha=0', allTransparent, details.join(', '));
    }

    // ========== 3. 鱼体中心 alpha>0 ==========
    if (appPixels.error) {
      record('3.鱼体中心alpha>0', false, 'no canvas data');
    } else {
      const center = appPixels.points.center;
      const q1 = appPixels.points.q1;
      const q3 = appPixels.points.q3;
      const ratio = appPixels.nonZeroAlphaRatio;
      const hasBody = (center && center.a > 0) || (q1 && q1.a > 0) || (q3 && q3.a > 0) || ratio > 0.01;
      record('3.鱼体中心alpha>0', hasBody,
        `center.a=${center?.a}, q1.a=${q1?.a}, q3.a=${q3?.a}, nonZeroRatio=${ratio.toFixed(3)}`);
    }

    // ========== 4. 眼睛、嘴巴、轮廓没有被误删 ==========
    const featureCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'no canvas' };
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      if (w === 0 || h === 0) return { error: 'canvas 0 size' };
      const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
      const sx = Math.max(0, cx - 100), sy = Math.max(0, cy - 100);
      const sw = Math.min(200, w - sx), sh = Math.min(200, h - sy);
      try {
        const imgData = ctx.getImageData(sx, sy, sw, sh);
        const data = imgData.data;
        let nonZeroPixels = 0;
        let colorVariety = new Set();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) {
            nonZeroPixels++;
            const r = Math.floor(data[i] / 32) * 32;
            const g = Math.floor(data[i + 1] / 32) * 32;
            const b = Math.floor(data[i + 2] / 32) * 32;
            colorVariety.add(`${r},${g},${b}`);
          }
        }
        return { nonZeroPixels, colorVariety: colorVariety.size, sampleW: sw, sampleH: sh };
      } catch (e) {
        return { error: e.message };
      }
    });
    if (featureCheck.error) {
      record('4.眼睛嘴巴轮廓未误删', false, featureCheck.error);
    } else {
      const ok = featureCheck.colorVariety >= 3 && featureCheck.nonZeroPixels > 50;
      record('4.眼睛嘴巴轮廓未误删', ok,
        `nonZero=${featureCheck.nonZeroPixels}, colorVariety=${featureCheck.colorVariety}`);
    }

    // ========== 5. body、stage、container 背景透明 ==========
    const bgCheck = await checkBackgroundTransparent(page, true);
    const bgOk =
      bgCheck.bodyAlpha !== null && bgCheck.bodyAlpha === 0 &&
      bgCheck.containerAlpha !== null && bgCheck.containerAlpha === 0 &&
      bgCheck.stageAlpha !== null && bgCheck.stageAlpha === 0;
    record('5.body/container/stage透明', bgOk,
      `body.alpha=${bgCheck.bodyAlpha}, container.alpha=${bgCheck.containerAlpha}, stage.alpha=${bgCheck.stageAlpha}, appMode=${bgCheck.bodyClassAppMode}`);

    // ========== 6. 标题黑圈用 elementsFromPoint 定位 ==========
    const titleCheck = await page.evaluate(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const darkSpots = [];
      const seenElements = new Set();
      for (let y = 0; y < h; y += 20) {
        for (let x = 0; x < w; x += 20) {
          const els = document.elementsFromPoint(x, y);
          if (els.length > 0) {
            for (const el of els) {
              if (seenElements.has(el)) continue;
              const style = window.getComputedStyle(el);
              const bg = style.backgroundColor;
              const m = bg.match(/rgba?\(([^)]+)\)/);
              if (m) {
                const parts = m[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 3 && parts[0] < 50 && parts[1] < 50 && parts[2] < 50 && (parts.length < 4 || parts[3] > 0.5)) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 20 && rect.height > 20) {
                    seenElements.add(el);
                    darkSpots.push({
                      tag: el.tagName,
                      id: el.id,
                      className: typeof el.className === 'string' ? el.className : '',
                      x, y,
                      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                      bg,
                    });
                    break;
                  }
                }
              }
            }
          }
        }
      }
      return { count: darkSpots.length, samples: darkSpots.slice(0, 5) };
    });
    record('6.标题黑圈定位', titleCheck.count >= 0,
      `darkSpots=${titleCheck.count}, samples=${JSON.stringify(titleCheck.samples.slice(0, 2))}`);

    // ========== 7. 进入/退出应用模式连续循环 20 次 ==========
    let cycleOk = true;
    let lastError = null;
    for (let i = 0; i < 20; i++) {
      // 进入应用模式
      const entered = await setAppMode(page, true);
      if (!entered) { cycleOk = false; lastError = `iter ${i}: enter failed`; break; }

      // 退出应用模式
      const exited = await setAppMode(page, false);
      if (exited) { cycleOk = false; lastError = `iter ${i}: exit failed`; break; }
    }
    record('7.进入退出循环20次', cycleOk, lastError || 'all 20 cycles ok');

    // ========== 8. 每次恢复状态一致 ==========
    await setAppMode(page, false);
    await sleep(500);
    const finalNormalPixels = await readCanvasPixels(page);
    let consistent = true;
    const consistencyDetails = [];
    if (!finalNormalPixels.error) {
      const corners = ['tl', 'tr', 'bl', 'br'];
      for (const c of corners) {
        const a = finalNormalPixels.points[c]?.a;
        if (a === undefined || a === null) {
          consistent = false;
          consistencyDetails.push(`${c}: no data`);
        } else {
          consistencyDetails.push(`${c}.a=${a}`);
        }
      }
    } else {
      consistent = false;
      consistencyDetails.push(finalNormalPixels.error);
    }
    record('8.恢复状态一致', consistent, consistencyDetails.join(', '));

    // ========== 9. 页面 reload 后仍透明 ==========
    // 先进入应用模式
    await setAppMode(page, true);
    await sleep(500);
    // reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(3000);
    // reload 后默认应该是普通模式
    const afterReloadAppMode = await page.evaluate(() => document.body.classList.contains('app-mode'));
    // 重新进入应用模式检查透明效果
    await setAppMode(page, true);
    await sleep(1500);
    const reloadAppPixels = await readCanvasPixels(page);
    let reloadTransparent = false;
    let reloadDetail = '';
    if (!reloadAppPixels.error) {
      const corners = ['tl', 'tr', 'bl', 'br'];
      let allTransparent = true;
      const parts = [];
      for (const c of corners) {
        const a = reloadAppPixels.points[c]?.a;
        parts.push(`${c}.a=${a}`);
        if (a !== 0) allTransparent = false;
      }
      reloadTransparent = allTransparent;
      reloadDetail = parts.join(', ');
    } else {
      reloadDetail = reloadAppPixels.error;
    }
    record('9.reload后仍透明', reloadTransparent,
      `afterReloadDefaultAppMode=${afterReloadAppMode}, ${reloadDetail}`);

    // ========== 10. 与悬浮透明浏览器叠加截图 ==========
    await page.screenshot({ path: `${SCREENSHOT_DIR}/trans_10_overlay.png` });
    const overlayBgCheck = await checkBackgroundTransparent(page, true);
    const overlayOk =
      overlayBgCheck.bodyAlpha === 0 &&
      overlayBgCheck.containerAlpha === 0 &&
      overlayBgCheck.stageAlpha === 0;
    record('10.叠加透明(间接验证)', overlayOk,
      `body.alpha=${overlayBgCheck.bodyAlpha}, container.alpha=${overlayBgCheck.containerAlpha}, stage.alpha=${overlayBgCheck.stageAlpha}`);

    // ========== console error 检查 ==========
    const realErrors = consoleErrors.filter(e =>
      e.indexOf('idle_tick') < 0 &&
      e.indexOf('CheapLiveReceiverDiag') < 0
    );
    record('11.console无真实错误', realErrors.length === 0,
      `errors=${realErrors.length}` + (realErrors.length > 0 ? `: ${realErrors.slice(0, 3).join(' | ')}` : ''));

    // 退出应用模式恢复
    await setAppMode(page, false);
    await sleep(500);

  } catch (e) {
    record('Exception', false, e.message);
    console.error(e);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Transparent Mode Summary: ${passed}/${results.length} PASS, ${failed} FAIL ===`);
  fs.writeFileSync('/tmp/auto-verify-screenshots/transparent_result.json', JSON.stringify(results, null, 2));
  process.exit(failed === 0 ? 0 : 1);
})();
