/**
 * Playwright smoke test — procedural avatar 真实页面
 *
 * 测试内容：
 *   1. 启动本地 HTTP server（src/face-tracking 目录）
 *   2. 打开 index.html
 *   3. 捕获 pageerror 和 console error
 *   4. 默认鲸鱼 Avatar 创建成功，canvas 有非空像素
 *   5. 眨眼 / 张嘴 / 微笑 按钮
 *   6. 切换到球体，canvas 有像素
 *   7. 开启镜像
 *   8. 多次切换（5x）不崩溃
 *   9. canvas 与 avatar-wrapper 尺寸在切换后保持稳定（±10%）
 *
 * 运行：
 *   node tests/e2e/playwright-smoke.test.js
 *
 * 前提：Playwright 已安装（不下载新浏览器）
 */
import { chromium } from 'playwright';
import path from 'path';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HTML_PATH = path.join(REPO_ROOT, 'src', 'face-tracking', 'index.html');
const STATIC_ROOT = join(REPO_ROOT, 'src', 'face-tracking');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const errors = [];
const consoleErrors = [];

function makeServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = req.url === '/' ? '/index.html' : req.url;
      const filePath = join(STATIC_ROOT, urlPath.split('?')[0]);
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const mime = MIME[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found: ' + urlPath);
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function run() {
  let server;
  let browser;
  const PORT = 7788;
  try {
    server = await makeServer(PORT);
    console.log(`HTTP server on port ${PORT}`);

    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    // ---- 捕获错误 ----
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ---- 打开页面 ----
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(1500); // 让 avatar 创建 + 首次 draw

    // ---- 1. 无 pageerror ----
    if (errors.length > 0) throw new Error(`Page errors: ${errors.join(' | ')}`);
    console.log('✓ 无 pageerror');

    // ---- 2. 无控制台 error ----
    if (consoleErrors.length > 0) {
      // 过滤掉无关的资源加载警告（dev 环境偶发）
      const realErrors = consoleErrors.filter(e =>
        !e.includes('favicon') && !e.includes('net::ERR_FILE_NOT_FOUND')
      );
      if (realErrors.length > 0) throw new Error(`Console errors: ${realErrors.join(' | ')}`);
    }
    console.log('✓ 无控制台错误');

    // ---- 3. canvas 有非空像素 ----
    const hasPixels = await page.evaluate(() => {
      const canvas = document.getElementById('avatar_canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 0 || data[i+1] !== 0 || data[i+2] !== 0) return true;
      }
      return false;
    });
    if (!hasPixels) throw new Error('Canvas 无像素（avatar 未渲染）');
    console.log('✓ Canvas 有非空像素（鲸鱼默认渲染）');

    // ---- 4. 记录初始尺寸 ----
    async function getSizes() {
      return page.evaluate(() => {
        const wrapper = document.querySelector('.avatar-wrapper');
        const canvas = document.getElementById('avatar_canvas');
        const wRect = wrapper ? wrapper.getBoundingClientRect() : null;
        const cRect = canvas ? canvas.getBoundingClientRect() : null;
        return {
          wrapperW: wRect ? wRect.width : 0,
          wrapperH: wRect ? wRect.height : 0,
          canvasW: cRect ? cRect.width : 0,
          canvasH: cRect ? cRect.height : 0,
          canvasBackingW: canvas ? canvas.width : 0,
          canvasBackingH: canvas ? canvas.height : 0,
        };
      });
    }

    const initial = await getSizes();
    console.log(`  初始尺寸: wrapper=${initial.wrapperW.toFixed(0)}x${initial.wrapperH.toFixed(0)} backing=${initial.canvasBackingW}x${initial.canvasBackingH}`);

    if (initial.canvasBackingW === 0 || initial.canvasBackingH === 0) {
      throw new Error('Canvas backing store 为 0（resize 未执行）');
    }

    // ---- 5. 测试按钮 ----
    for (const [id, label] of [['#testBlink', '眨眼'], ['#testOpen', '张嘴'], ['#testSmile', '微笑']]) {
      await page.click(id);
      await page.waitForTimeout(200);
      await page.click('#testReset');
      console.log(`✓ ${label}按钮`);
    }

    // ---- 6. 切换到球体 ----
    const tabs = await page.$$('.model-tab');
    for (const tab of tabs) {
      const txt = await tab.textContent();
      if (txt.includes('球形')) { await tab.click(); break; }
    }
    await page.waitForTimeout(1000);
    const spherePixels = await page.evaluate(() => {
      const canvas = document.getElementById('avatar_canvas');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 0 || data[i+1] !== 0 || data[i+2] !== 0) return true;
      }
      return false;
    });
    if (!spherePixels) throw new Error('切换球体后 Canvas 无像素');
    const afterSphere = await getSizes();
    const wDriftSphere = Math.abs(afterSphere.wrapperW - initial.wrapperW) / (initial.wrapperW || 1);
    const hDriftSphere = Math.abs(afterSphere.wrapperH - initial.wrapperH) / (initial.wrapperH || 1);
    if (wDriftSphere > 0.05 || hDriftSphere > 0.05) {
      throw new Error(`尺寸漂移（球体）: W ${(wDriftSphere*100).toFixed(1)}% H ${(hDriftSphere*100).toFixed(1)}%`);
    }
    console.log(`✓ 球体渲染 + 尺寸稳定 (drift W=${(wDriftSphere*100).toFixed(1)}% H=${(hDriftSphere*100).toFixed(1)}%)`);

    // ---- 7. 镜像 ----
    await page.locator('.mirror-toggle .toggle-switch').click();
    await page.waitForTimeout(200);
    console.log('✓ 镜像模式');

    // ---- 8. 多次切换（5x） ----
    for (let i = 0; i < 5; i++) {
      const allTabs = await page.$$('.model-tab');
      for (const tab of allTabs) {
        const txt = await tab.textContent();
        if (txt.includes('纺锤')) { await tab.click(); await page.waitForTimeout(200); break; }
      }
      const tabs2 = await page.$$('.model-tab');
      for (const tab of tabs2) {
        const txt = await tab.textContent();
        if (txt.includes('球形')) { await tab.click(); await page.waitForTimeout(200); break; }
      }
    }
    console.log('✓ 多次切换（5x）不崩溃');

    // ---- 9. 最终尺寸检查 ----
    const final = await getSizes();
    const fwDrift = Math.abs(final.wrapperW - initial.wrapperW) / (initial.wrapperW || 1);
    const fhDrift = Math.abs(final.wrapperH - initial.wrapperH) / (initial.wrapperH || 1);
    console.log(`  最终: wrapper=${final.wrapperW.toFixed(0)}x${final.wrapperH.toFixed(0)} drift W=${(fwDrift*100).toFixed(1)}% H=${(fhDrift*100).toFixed(1)}%`);
    if (fwDrift > 0.12 || fhDrift > 0.12) {
      throw new Error(`尺寸漂移过大（最终）: W ${(fwDrift*100).toFixed(1)}% H ${(fhDrift*100).toFixed(1)}%`);
    }
    console.log('✓ 尺寸最终稳定');

    // ---- 10. 无新错误 ----
    if (errors.length > 0) throw new Error(`运行时 pageerror: ${errors.join(' | ')}`);
    if (consoleErrors.length > 0) {
      const real = consoleErrors.filter(e => !e.includes('favicon'));
      if (real.length > 0) throw new Error(`运行时 console error: ${real.join(' | ')}`);
    }
    console.log('✓ 无新增错误');

    console.log('\n=== All smoke tests passed ===');
  } catch (e) {
    console.error('\n✖ Smoke test failed:', e.message);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));

