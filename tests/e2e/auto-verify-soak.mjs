// 10 分钟 soak 稳定性测试
// 持续 Receiver 连接，周期切换应用模式、修改配置、断线重连、启动/取消校准
// 记录 FPS、内存、WebView 状态、SSE 重连次数、revision 增长
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import { execSync, spawn } from 'child_process';

const BASE = process.env.RECEIVER_BASE || 'http://192.168.31.137:8765';
const TOKEN = process.env.RECEIVER_TOKEN || 'gJXTh11z3IAJ0R3p1Nt5jyEB8HX_krQgbMooClmOh2I';
const URL = `${BASE}/receiver/?token=${TOKEN}&v=0.1.0`;
const SCREENSHOT_DIR = '/tmp/auto-verify-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DURATION_MS = 10 * 60 * 1000; // 10 分钟
const TICK_MS = 30 * 1000; // 每 30 秒采样一次
const ACTION_INTERVAL_MS = 60 * 1000; // 每 60 秒做一次动作

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE.replace(/^https?:\/\//, '').split(':')[0],
      port: parseInt(BASE.replace(/^https?:\/\//, '').split(':')[1] || '80'),
      path, method,
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

async function setFtConfig(patch) {
  const status = await fetchStatus();
  const baseRevision = status.faceTrackingConfig.revision;
  const r = await httpRequest('POST', `/api/control?token=${TOKEN}`,
    JSON.stringify({ type: 'setFaceTrackingConfig', baseRevision, patch }));
  return JSON.parse(r.body);
}

async function sendControl(payload) {
  const r = await httpRequest('POST', `/api/control?token=${TOKEN}`, JSON.stringify(payload));
  return JSON.parse(r.body);
}

// 检查 logcat 错误（只关心 com.cheaplive.capture）
async function dumpLogcatErrors(sinceMs) {
  return new Promise((resolve) => {
    const since = new Date(Date.now() - sinceMs).toISOString().replace('T', ' ').slice(0, 19) + '.000';
    const proc = spawn('adb', [
      'logcat', '-d', '-v', 'time',
      '--pid', '0',
      '-s', 'AndroidRuntime:E', '-s', 'System.err:W',
      '-t', since,
    ], { timeout: 5000 });
    let out = '';
    proc.stdout.on('data', (d) => out += d.toString());
    proc.stderr.on('data', (d) => out += d.toString());
    proc.on('close', () => resolve(out));
    proc.on('error', () => resolve(''));
  });
}

// 通过 adb 检查进程状态
async function getProcStatus() {
  try {
    let isForeground = false;
    let pid = null;
    let memInfo = null;
    try {
      const top = execSync('adb shell dumpsys activity activities | grep -E "topResumedActivity" | head -1', { encoding: 'utf-8', timeout: 5000 });
      isForeground = top.indexOf('com.cheaplive.capture') >= 0;
    } catch (e) { /* ignore */ }
    try {
      const pidOut = execSync('adb shell pidof com.cheaplive.capture', { encoding: 'utf-8', timeout: 5000 }).trim();
      pid = pidOut ? pidOut.split(/\s+/)[0] : null;
    } catch (e) { /* process may not exist */ }
    if (pid) {
      try {
        const memOut = execSync('adb shell cat /proc/' + pid + '/status | grep -E "VmRSS|VmSize|Threads"', { encoding: 'utf-8', timeout: 5000 });
        const lines = memOut.trim().split('\n');
        memInfo = {};
        for (const line of lines) {
          const m = line.match(/(\w+):\s+(\d+)/);
          if (m) memInfo[m[1]] = parseInt(m[2]);
        }
      } catch (e) { memInfo = { error: e.message }; }
    }
    return { isForeground, pid, memInfo };
  } catch (e) {
    return { error: e.message };
  }
}

(async () => {
  const startTime = Date.now();
  const samples = [];
  const errors = [];
  let sseReconnectCount = 0;
  let revisionHistory = [];
  let lastFps = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // 过滤掉调试日志
      if (text.indexOf('idle_tick') < 0 && text.indexOf('CheapLiveReceiverDiag') < 0) {
        consoleErrors.push({ t: Date.now() - startTime, text });
      }
    }
  });

  // 监听 page crash
  page.on('crash', () => errors.push({ t: Date.now() - startTime, type: 'page-crash' }));
  page.on('close', () => errors.push({ t: Date.now() - startTime, type: 'page-close' }));

  const result = {
    startTime: new Date(startTime).toISOString(),
    durationMs: DURATION_MS,
    samples: [],
    errors: [],
    finalSummary: {},
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);

    let actionIdx = 0;
    let lastActionTime = Date.now();
    let lastSampleTime = 0;

    while (Date.now() - startTime < DURATION_MS) {
      const now = Date.now();
      const elapsed = now - startTime;

      // 每 TICK_MS 采样一次
      if (now - lastSampleTime >= TICK_MS) {
        lastSampleTime = now;
        const status = await fetchStatus().catch(e => ({ error: e.message }));
        const proc = await getProcStatus();
        // 通过 page.evaluate 读取 Receiver 端诊断信息
        const diag = await page.evaluate(() => {
          try {
            const r = window.__cheapLiveReceiverDiag || window.__diag || null;
            const canvas = document.querySelector('canvas');
            const ctx = canvas ? canvas.getContext('2d') : null;
            return {
              hasCanvas: !!canvas,
              canvasW: canvas?.width,
              canvasH: canvas?.height,
              appMode: document.body.classList.contains('app-mode'),
              fps: r?.fps || r?.frameRate || null,
              frameCount: r?.frameCount || r?.frames || null,
              lastUpdate: r?.lastUpdate || null,
            };
          } catch (e) { return { error: e.message }; }
        }).catch(e => ({ error: e.message }));

        const sample = {
          t: elapsed,
          time: new Date(now).toISOString(),
          status: status.error ? null : {
            serverRunning: status.serverRunning,
            faceCaptureEnabled: status.faceCaptureEnabled,
            revision: status.faceTrackingConfig?.revision,
            frameCount: status.frameCount,
            viewerConnected: status.viewerConnected,
            lastCommand: status.lastCommand,
          },
          statusError: status.error || null,
          proc,
          diag,
          sseReconnectCount,
          consoleErrorCount: consoleErrors.length,
        };
        samples.push(sample);
        revisionHistory.push({ t: elapsed, rev: status.faceTrackingConfig?.revision });

        console.log(`[${Math.floor(elapsed / 1000)}s] sample #${samples.length}: rev=${status.faceTrackingConfig?.revision}, proc=${JSON.stringify(proc)}, fps=${diag.fps || 'N/A'}`);

        // 检查 WebView renderer 是否重启（通过 pid 变化）
        if (samples.length >= 2) {
          const prev = samples[samples.length - 2];
          if (prev.proc.pid && proc.pid && prev.proc.pid !== proc.pid) {
            errors.push({ t: elapsed, type: 'pid-changed', from: prev.proc.pid, to: proc.pid });
            console.log(`  [WARN] pid changed: ${prev.proc.pid} -> ${proc.pid}`);
          }
          // 检查内存异常上涨（>50% 增长）
          if (prev.proc.memInfo?.VmRSS && proc.memInfo?.VmRSS) {
            const growthRatio = proc.memInfo.VmRSS / prev.proc.memInfo.VmRSS;
            if (growthRatio > 1.5) {
              errors.push({ t: elapsed, type: 'mem-spike', from: prev.proc.memInfo.VmRSS, to: proc.memInfo.VmRSS });
              console.log(`  [WARN] mem spike: ${prev.proc.memInfo.VmRSS} -> ${proc.memInfo.VmRSS}`);
            }
          }
        }
      }

      // 每 ACTION_INTERVAL_MS 做一次动作（轮换）
      if (now - lastActionTime >= ACTION_INTERVAL_MS) {
        lastActionTime = now;
        const actionType = actionIdx % 5;
        try {
          if (actionType === 0) {
            // 切换应用模式
            const currentAppMode = await page.evaluate(() => document.body.classList.contains('app-mode'));
            if (currentAppMode) {
              const exitBtn = page.locator('#appModeExitBtn');
              if (await exitBtn.isVisible().catch(() => false)) {
                await exitBtn.click();
              } else {
                await page.mouse.dblclick(640, 450);
              }
            } else {
              await page.click('#toggleAppModeBtn');
            }
            await sleep(500);
            console.log(`  [ACTION ${actionIdx}] toggle app mode -> ${await page.evaluate(() => document.body.classList.contains('app-mode'))}`);
          } else if (actionType === 1) {
            // 修改配置（修改 mouthOpen scale）
            const r = await setFtConfig({ scale: { mouthOpen: 1.0 + (Math.random() * 0.5) } });
            console.log(`  [ACTION ${actionIdx}] modify config: ok=${r.ok}`);
          } else if (actionType === 2) {
            // 启动并取消校准
            await sendControl({ type: 'triggerCalibration', action: 'start' });
            await sleep(1000);
            await sendControl({ type: 'triggerCalibration', action: 'cancel' });
            console.log(`  [ACTION ${actionIdx}] start+cancel calibration`);
          } else if (actionType === 3) {
            // 断线重连：reload 页面
            await page.reload({ waitUntil: 'domcontentloaded' });
            await sleep(3000);
            sseReconnectCount++;
            console.log(`  [ACTION ${actionIdx}] reload page (reconnect)`);
          } else if (actionType === 4) {
            // 检查 logcat 错误
            const logcatErrors = await dumpLogcatErrors(60000);
            if (logcatErrors && logcatErrors.length > 0) {
              const lines = logcatErrors.split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                errors.push({ t: now - startTime, type: 'logcat-error', lines: lines.slice(0, 5) });
                console.log(`  [ACTION ${actionIdx}] logcat errors: ${lines.length} lines`);
              } else {
                console.log(`  [ACTION ${actionIdx}] logcat clean`);
              }
            } else {
              console.log(`  [ACTION ${actionIdx}] logcat clean`);
            }
          }
        } catch (e) {
          errors.push({ t: now - startTime, type: 'action-error', action: actionIdx, error: e.message });
          console.log(`  [ACTION ${actionIdx}] error: ${e.message}`);
        }
        actionIdx++;
      }

      // 短暂睡眠避免 busy loop
      await sleep(2000);
    }

    // 最终采样
    const finalStatus = await fetchStatus().catch(e => ({ error: e.message }));
    const finalProc = await getProcStatus();
    const finalDiag = await page.evaluate(() => {
      try {
        const r = window.__cheapLiveReceiverDiag || window.__diag || null;
        return { fps: r?.fps || null, frameCount: r?.frameCount || null };
      } catch (e) { return { error: e.message }; }
    }).catch(e => ({ error: e.message }));

    result.finalSummary = {
      totalSamples: samples.length,
      totalActions: actionIdx,
      sseReconnectCount,
      finalStatus: finalStatus.error ? null : {
        serverRunning: finalStatus.serverRunning,
        revision: finalStatus.faceTrackingConfig?.revision,
        frameCount: finalStatus.frameCount,
      },
      finalProc,
      finalDiag,
      totalConsoleErrors: consoleErrors.length,
      consoleErrorSamples: consoleErrors.slice(0, 5),
    };

    // 分析 revision 增长
    if (revisionHistory.length > 1) {
      const first = revisionHistory[0].rev;
      const last = revisionHistory[revisionHistory.length - 1].rev;
      result.finalSummary.revisionGrowth = (last || 0) - (first || 0);
      result.finalSummary.revisionHistory = revisionHistory;
    }

    // 内存趋势分析
    if (samples.length > 1) {
      const memValues = samples
        .filter(s => s.proc.memInfo && s.proc.memInfo.VmRSS)
        .map(s => ({ t: s.t, mem: s.proc.memInfo.VmRSS }));
      if (memValues.length > 1) {
        const firstMem = memValues[0].mem;
        const lastMem = memValues[memValues.length - 1].mem;
        result.finalSummary.memTrend = {
          first: firstMem,
          last: lastMem,
          growth: lastMem - firstMem,
          growthPercent: ((lastMem - firstMem) / firstMem * 100).toFixed(2) + '%',
          samples: memValues,
        };
      }
    }

    result.samples = samples;
    result.errors = errors;

    // 判断是否通过
    const passCriteria = {
      noCrash: !errors.some(e => e.type === 'page-crash' || e.type === 'pid-changed'),
      noExcessiveErrors: consoleErrors.length < 50,
      noMemoryLeak: !result.finalSummary.memTrend || parseFloat(result.finalSummary.memTrend.growthPercent) < 50,
      revisionGrowthReasonable: (result.finalSummary.revisionGrowth || 0) < 100,
      finalServerRunning: result.finalSummary.finalStatus?.serverRunning === true,
    };

    result.passCriteria = passCriteria;
    result.pass = Object.values(passCriteria).every(v => v === true);

  } catch (e) {
    errors.push({ t: Date.now() - startTime, type: 'fatal', error: e.message });
    result.fatalError = e.message;
    result.pass = false;
  } finally {
    await browser.close();
  }

  // 保存结果
  fs.writeFileSync('/tmp/auto-verify-screenshots/soak_result.json', JSON.stringify(result, null, 2));

  console.log(`\n=== Soak Test Summary ===`);
  console.log(`Duration: ${DURATION_MS / 60000} minutes`);
  console.log(`Samples: ${result.finalSummary.totalSamples || 0}`);
  console.log(`Actions: ${result.finalSummary.totalActions || 0}`);
  console.log(`SSE reconnects: ${result.finalSummary.sseReconnectCount}`);
  console.log(`Console errors: ${result.finalSummary.totalConsoleErrors}`);
  console.log(`Errors recorded: ${result.errors.length}`);
  if (result.finalSummary.memTrend) {
    console.log(`Memory: ${result.finalSummary.memTrend.first} -> ${result.finalSummary.memTrend.last} (${result.finalSummary.memTrend.growthPercent})`);
  }
  console.log(`Revision growth: ${result.finalSummary.revisionGrowth || 0}`);
  console.log(`Pass criteria:`, result.passCriteria);
  console.log(`Overall: ${result.pass ? 'PASS' : 'FAIL'}`);

  process.exit(result.pass ? 0 : 1);
})();
