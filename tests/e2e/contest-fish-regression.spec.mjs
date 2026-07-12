import { test, expect } from '@playwright/test';

const DEMO_URL = '/src/contest-demo/contest-interactive-demo.html';

test('contest demo page: opens without console errors', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));

  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // renderer should be ready
  await page.waitForFunction(() => window.__cheapLiveContestAvatarDiag?.rendererReady, { timeout: 10000 });

  const ready = await page.evaluate(() => window.__cheapLiveContestAvatarDiag?.rendererReady);
  expect(ready).toBe(true);

  // no console errors
  expect(errs.length).toBe(0);
});

test('tail fluke: no duplicate layers after fix', async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => window.__cheapLiveContestAvatarDiag?.rendererReady, { timeout: 10000 });

  const diag = await page.evaluate(async () => {
    window.__cheapLiveContestAvatarApplyFrame({ headYaw: 0, headPitch: 0, mouthOpen: 0 });
    await new Promise(r => requestAnimationFrame(() => r()));
    await new Promise(r => setTimeout(r, 50));
    const d = window.__cheapLiveTailFlukeDiag || {};
    return {
      totalFlukeVerts: d.totalFlukeVerts,
      mainPlaneCount: d.mainPlaneCount,
      thicknessPlaneCount: d.thicknessPlaneCount,
      maxSeparationPixels: d.maxSeparationPixels,
      duplicateTailDetected: d.duplicateTailDetected,
    };
  });

  // After the fix: no thickness plane, zero separation
  expect(diag.thicknessPlaneCount).toBe(0);
  expect(diag.maxSeparationPixels).toBe(0);
  expect(diag.duplicateTailDetected).toBe(false);
});

test('tail yaw: direction matches head yaw', async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => window.__cheapLiveContestAvatarDiag?.rendererReady, { timeout: 10000 });

  const results = await page.evaluate(async () => {
    const cases = [
      { name: 'neutral', yaw: 0 },
      { name: 'yaw -30', yaw: -30 },
      { name: 'yaw +30', yaw: 30 },
      { name: 'yaw -60', yaw: -60 },
      { name: 'yaw +60', yaw: 60 },
    ];
    const out = [];
    for (const c of cases) {
      window.__cheapLiveContestAvatarApplyFrame({ headYaw: c.yaw, headPitch: 0, mouthOpen: 0 });
      await new Promise(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 50));
      const d = window.__cheapLiveTailRuntimeDiag || {};
      out.push({
        name: c.name,
        expected: d.expectedTailSide,
        actual: d.actualTailSide,
        match: d.expectedTailSide === d.actualTailSide,
      });
    }
    return out;
  });

  for (const r of results) {
    expect(r.match, `${r.name}: expected=${r.expected}, actual=${r.actual}`).toBe(true);
  }
});

test('eye surface attachment: stable local coordinates under pitch', async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => window.__cheapLiveContestAvatarDiag?.rendererReady, { timeout: 10000 });

  const results = await page.evaluate(async () => {
    const cases = [
      { name: 'neutral', pitch: 0 },
      { name: 'pitch down 30', pitch: -30 },
      { name: 'pitch up 30', pitch: 30 },
    ];
    const out = [];
    for (const c of cases) {
      window.__cheapLiveContestAvatarApplyFrame({ headYaw: 0, headPitch: c.pitch, mouthOpen: 0, eyeLeft: 1, eyeRight: 1 });
      await new Promise(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 50));
      const d = window.__cheapLiveEyeSurfaceDiag || {};
      out.push({
        name: c.name,
        localSurfaceU: d.localSurfaceU,
        localSurfaceV: d.localSurfaceV,
        eyeToSurfaceDistance: d.eyeToSurfaceDistance,
      });
    }
    return out;
  });

  const neutral = results.find(r => r.name === 'neutral');
  for (const r of results) {
    if (r.name === 'neutral') continue;
    // Local surface parameters should be stable (not slide)
    expect(Math.abs(r.localSurfaceU - neutral.localSurfaceU)).toBeLessThan(0.001);
    expect(Math.abs(r.localSurfaceV - neutral.localSurfaceV)).toBeLessThan(0.001);
    // Distance to surface should be stable
    expect(Math.abs(r.eyeToSurfaceDistance - neutral.eyeToSurfaceDistance)).toBeLessThan(0.001);
  }
});

test('mouth: upper lip moves upward when mouth opens', async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => window.__cheapLiveContestAvatarDiag?.rendererReady, { timeout: 10000 });

  const results = await page.evaluate(async () => {
    const cases = [0, 0.5, 1.0];
    const out = [];
    for (const m of cases) {
      window.__cheapLiveContestAvatarApplyFrame({ headYaw: 0, headPitch: 0, mouthOpen: m });
      await new Promise(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 50));
      const d = window.__cheapLiveMouthDiag || {};
      out.push({
        mouthOpen: m,
        upperLipY: d.upperMidScreen?.y ?? 0,
        lowerLipY: d.lowerMidScreen?.y ?? 0,
        upperLipOffset: d.upperLipOffset ?? 0,
        lowerLipOffset: d.lowerLipOffset ?? 0,
      });
    }
    return out;
  });

  const neutral = results.find(r => r.mouthOpen === 0);
  const half = results.find(r => r.mouthOpen === 0.5);
  const full = results.find(r => r.mouthOpen === 1.0);

  // Upper lip should move UP (decreasing Y) when mouth opens
  expect(half.upperLipY).toBeLessThan(neutral.upperLipY);
  expect(full.upperLipY).toBeLessThan(half.upperLipY);

  // Lower lip should move DOWN (increasing Y) when mouth opens
  expect(half.lowerLipY).toBeGreaterThan(neutral.lowerLipY);
  expect(full.lowerLipY).toBeGreaterThan(half.lowerLipY);

  // Lower lip moves more than upper lip
  const upperMove = full.upperLipY - neutral.upperLipY;
  const lowerMove = full.lowerLipY - neutral.lowerLipY;
  expect(Math.abs(lowerMove)).toBeGreaterThan(Math.abs(upperMove));
});

test('avatar selection: 3D sacabambaspis is default', async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const selectedText = await page.evaluate(() => {
    const btn = document.querySelector('.avatar-btn.selected');
    return btn ? btn.getAttribute('data-avatar') : '';
  });

  expect(selectedText).toBe('sacabambaspis-3d');
});

test('avatar selection: can switch to cat avatar', async ({ page }) => {
  await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.click('.avatar-btn[data-avatar="cat"]');
  await page.waitForTimeout(300);

  const selectedText = await page.evaluate(() => {
    const btn = document.querySelector('.avatar-btn.selected');
    return btn ? btn.getAttribute('data-avatar') : '';
  });

  expect(selectedText).toBe('cat');
});
