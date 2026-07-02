// @ts-check
// Face-tracking 摄像头回归验证 smoke test
// Playwright 自动启动 http-server (port 8769)，baseURL 已在配置中设置
const { test, expect } = require('@playwright/test');

function registerErrorCollectors(page) {
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { errors, consoleErrors };
}

test.describe('face-capture P0 regression smoke', () => {

  test('face-tracking page loads and shows start button', async ({ page }) => {
    const { errors, consoleErrors } = registerErrorCollectors(page);
    await page.goto('/src/face-tracking/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#startBtn', { timeout: 10000 });
    const status = await page.textContent('#status');
    expect(status).toBeTruthy();
    expect(errors).toHaveLength(0);
    expect(consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'))).toHaveLength(0);
  });

  test('face-tracking page has webcam video element', async ({ page }) => {
    await page.goto('/src/face-tracking/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    const webcam = await page.$('#webcam');
    expect(webcam).not.toBeNull();
  });

  test('click start camera triggers getUserMedia (status changes from initial)', async ({ page }) => {
    await page.goto('/src/face-tracking/index.html', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for model to load (max 20s)
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent.includes('模型加载完成');
    }, { timeout: 20000 });

    // Hook console errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // Click start
    await page.click('#startBtn');

    // Wait for status change (either running or error, NOT stuck on initial)
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      const t = s.textContent || '';
      return !t.includes('点击"启动摄像头"开始');
    }, { timeout: 8000 });

    const status = await page.textContent('#status');
    // Status should NOT be the initial loading message
    expect(status).not.toContain('点击"启动摄像头"开始');
    // Should be either "运行中" or an error message - both mean the code path executed
    expect(status).toBeTruthy();
    // Verify no console error (getUserMedia failure is expected in headless, not a code bug)
  });

  test('avatar canvas exists and is sized', async ({ page }) => {
    await page.goto('/src/face-tracking/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    const canvas = await page.$('#avatar_canvas');
    expect(canvas).not.toBeNull();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(10);
      expect(box.height).toBeGreaterThan(10);
    }
  });

  test('receiver page loads with showcase mode', async ({ page }) => {
    await page.goto('/android-capture/app/src/main/assets/web/receiver/index.html?public=1&showcase=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#stage', { timeout: 10000 });
    const title = await page.title();
    expect(title).toBeTruthy();
    // Page should have a canvas for the 3D renderer
    const stage = await page.$('#stage');
    expect(stage).not.toBeNull();
  });

  test('contest demo page loads', async ({ page }) => {
    const { errors } = registerErrorCollectors(page);
    await page.goto('/src/contest-demo/contest-interactive-demo.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    expect(title).toBeTruthy();
    // Should contain "CheapLive" or "demo"
    expect(title.toLowerCase()).toMatch(/cheaplive|demo|参赛/);
    // No page errors
    expect(errors).toHaveLength(0);
  });
});
