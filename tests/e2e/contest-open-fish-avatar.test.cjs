const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEMO_URL = 'http://127.0.0.1:8769/src/contest-demo/contest-interactive-demo.html';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '.automation', 'contest-demo-open-fish');

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

test.describe('contest demo: open 3D fish avatar (Phase 1A)', () => {
  test('default avatar is 3D sacabambaspis from src/face-tracking', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });

    await page.waitForTimeout(1500);

    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag).toBeDefined();
    expect(diag.rendererKey).toBe('sacabambaspis3d');
    expect(diag.source).toBe('src/face-tracking');
    expect(diag.fallbackActive).toBe(false);
    expect(diag.rendererReady).toBe(true);
    expect(diag.error).toBeNull();

    const selectedBtn = await page.evaluate(() => {
      const btn = document.querySelector('#avatarGrid .avatar-btn.selected');
      return btn ? btn.dataset.avatar : null;
    });
    expect(selectedBtn).toBe('sacabambaspis-3d');

    const canvasHasContent = await page.evaluate(() => {
      const c = document.getElementById('avatarCanvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonEmpty = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          nonEmpty++;
          if (nonEmpty > 100) return true;
        }
      }
      return nonEmpty > 100;
    });
    expect(canvasHasContent).toBe(true);

    expect(errs.length).toBe(0);

    ensureScreenshotDir();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'phase1a-default-3d-fish.png'),
      fullPage: true,
    });
  });

  test('old 2D white fish is not the default path', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag.fallbackActive).toBe(false);

    const is3DSelected = await page.evaluate(() => {
      const btn = document.querySelector('#avatarGrid .avatar-btn.selected');
      return btn && btn.dataset.avatar === 'sacabambaspis-3d';
    });
    expect(is3DSelected).toBe(true);

    expect(errs.length).toBe(0);
  });
});
