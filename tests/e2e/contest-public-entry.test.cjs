const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8770';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '.automation', 'contest-demo-open-fish');
function ensureDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('public entry: contest demo 3D fish', () => {
  test('contest-interactive-demo.html renders 3D spindle whale avatar', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(`${BASE}/src/contest-demo/contest-interactive-demo.html`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag).toBeDefined();
    expect(diag.rendererReady).toBe(true);
    expect(diag.rendererClass).toBe('ProceduralSpindleWhaleAvatar');
    expect(diag.source).toBe('src/face-tracking');
    expect(diag.fallbackActive).toBe(false);
    expect(diag.mainCanvasDiag.isSquare).toBe(true);
    expect(diag.mainCanvasDiag.w).toBeGreaterThan(300);

    const pixelCount = await page.evaluate(() => {
      const c = document.getElementById('avatarCanvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      return n;
    });
    expect(pixelCount).toBeGreaterThan(1000);
    expect(errs.length).toBe(0);
    ensureDir();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'public-entry-interactive.png'), fullPage: true });
  });

  test('dual-device-demo.html redirects to 3D interactive demo (no old blue fish)', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(`${BASE}/src/contest-demo/dual-device-demo.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const before = await page.evaluate(() => ({
      hasOldCanvas: !!document.getElementById('avatarCanvas')?.getContext,
      hasOldCfg: typeof window.AVATAR_CFG !== 'undefined',
      hasGoBtn: !!document.getElementById('goBtn'),
      goBtnHref: document.getElementById('goBtn')?.href || null,
    }));
    expect(before.hasOldCanvas).toBe(false);
    expect(before.hasOldCfg).toBe(false);
    expect(before.hasGoBtn).toBe(true);
    expect(before.goBtnHref).toContain('contest-interactive-demo.html');

    await page.waitForTimeout(2500);
    const afterUrl = page.url();
    expect(afterUrl).toContain('contest-interactive-demo.html');

    await page.waitForTimeout(2000);
    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag.rendererReady).toBe(true);
    expect(diag.fallbackActive).toBe(false);
    expect(diag.rendererClass).toBe('ProceduralSpindleWhaleAvatar');
    expect(errs.length).toBe(0);
    ensureDir();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'public-entry-after-redirect.png'), fullPage: true });
  });

  test('README main contest demo link points to contest-interactive-demo.html', async ({ }) => {
    const readmePath = path.join(__dirname, '..', '..', 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    const tableMatch = content.match(/参赛演示 Demo[^\n]*contest-demo\/([a-z0-9-]+\.html)/i);
    expect(tableMatch).not.toBeNull();
    expect(tableMatch[1]).toBe('contest-interactive-demo.html');
    const entryMatch = content.match(/可体验入口[^\n]*contest-demo\/([a-z0-9-]+\.html)/i);
    expect(entryMatch).not.toBeNull();
    expect(entryMatch[1]).toBe('contest-interactive-demo.html');
  });

  test('face-tracking index.html contest link points to interactive demo', async ({ page }) => {
    await page.goto(`${BASE}/src/face-tracking/index.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const href = await page.evaluate(() => document.querySelector('.contest-demo-link')?.href || '');
    expect(href).toContain('contest-interactive-demo.html');
  });
});
