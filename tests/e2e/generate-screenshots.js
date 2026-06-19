/**
 * 生成固定参数视觉截图（使用 Playwright + 已有 HTTP server）
 *
 * 视角固定参数（中性 yaw=0）：
 *   eyeLeft=0.8, eyeRight=0.8, mouthOpen=0, mouthSmile=0
 *
 * 截图：
 *   artifacts/canvas-avatar-web-sync/
 *     web-whale-front.png       — 鲸鱼正面
 *     web-whale-eyes-closed.png — 鲸鱼眨眼
 *     web-whale-mouth-open.png  — 鲸鱼张嘴
 *     web-whale-side.png        — 鲸鱼侧面（yaw=0.8）
 *     web-whale-three-quarter.png — 鲸鱼三分之四（yaw=0.3）
 *     web-sphere-front.png      — 球体正面
 *     web-sphere-eyes-closed.png — 球体眨眼
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(REPO_ROOT, 'artifacts', 'canvas-avatar-web-sync');
const STATIC_ROOT = join(REPO_ROOT, 'src', 'face-tracking');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

mkdirSync(OUT_DIR, { recursive: true });

function makeServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = req.url === '/' ? '/index.html' : req.url;
      const filePath = join(STATIC_ROOT, urlPath.split('?')[0]);
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
        res.end(readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found: ' + urlPath);
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function screenshot(page, label, params) {
  // 设置参数（通过已导出的 window.faceTracker.avatar）
  if (params) {
    await page.evaluate((p) => {
      const ft = window.faceTracker;
      if (ft && ft.avatar && typeof ft.avatar.updateParams === 'function') {
        ft.avatar.updateParams(p);
      }
    }, params);
    await page.waitForTimeout(300);
  }
  // 截图
  const el = page.locator('#avatar_canvas');
  await el.waitFor({ state: 'visible' });
  await page.waitForTimeout(200); // 等动画帧
  const buf = await el.screenshot({ type: 'png' });
  const outPath = join(OUT_DIR, `${label}.png`);
  writeFileSync(outPath, buf);
  console.log(`  ✓ ${outPath} (${buf.length} bytes)`);
}

async function main() {
  let server, browser;
  const PORT = 7789;
  try {
    server = await makeServer(PORT);
    console.log(`HTTP server on port ${PORT}`);

    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(1500); // 等待 avatar 创建

    // ---- 鲸鱼正面 ----
    await screenshot(page, 'web-whale-front', {
      eyeLeft: 0.8, eyeRight: 0.8, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 鲸鱼眨眼 ----
    await screenshot(page, 'web-whale-eyes-closed', {
      eyeLeft: 0.1, eyeRight: 0.1, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 鲸鱼张嘴 ----
    await screenshot(page, 'web-whale-mouth-open', {
      eyeLeft: 0.8, eyeRight: 0.8, mouthOpen: 0.8, mouthSmile: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 鲸鱼三分之四 ----
    await screenshot(page, 'web-whale-three-quarter', {
      eyeLeft: 0.8, eyeRight: 0.8, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0.75, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 鲸鱼侧面 ----
    await screenshot(page, 'web-whale-side', {
      eyeLeft: 0.8, eyeRight: 0.8, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0.85, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 切换到球体 ----
    const tabs = await page.$$('.model-tab');
    for (const tab of tabs) {
      const txt = await tab.textContent();
      if (txt.includes('球形')) { await tab.click(); break; }
    }
    await page.waitForTimeout(1000);

    // ---- 球体正面 ----
    await screenshot(page, 'web-sphere-front', {
      eyeLeft: 0.8, eyeRight: 0.8, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 球体眨眼 ----
    await screenshot(page, 'web-sphere-eyes-closed', {
      eyeLeft: 0.1, eyeRight: 0.1, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
    });

    // ---- 球体微笑 ----
    await screenshot(page, 'web-sphere-smile', {
      eyeLeft: 0.8, eyeRight: 0.8, mouthOpen: 0, mouthSmile: 0.8,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
    });

    console.log('\n=== All screenshots generated ===');
  } catch (e) {
    console.error('\n✖ Screenshot failed:', e.message);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

main().then(() => process.exit(0));
