import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260622-009';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

function captureWithErrors(page, name) {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  return {
    errs,
    capture: async (path) => {
      await page.screenshot({ path: `${ARTIFACT_DIR}/${path}`, fullPage: true });
      expect(errs.length).toBe(0);
    }
  };
}

test('spindle: combined yaw=30 pitch=20 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw30-pitch20');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.75, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw30-pitch20.png');
});

test('spindle: combined yaw=-30 pitch=-20 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw-30-pitch-20');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.25, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw-30-pitch-20.png');
});

test('spindle: combined yaw=45 pitch=15 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw45-pitch15');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.875, headPitch: 0.75 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw45-pitch15.png');
});

test('spindle: combined yaw=-45 pitch=-15 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw-45-pitch-15');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.125, headPitch: 0.25 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw-45-pitch-15.png');
});

test('spindle: extreme yaw=60 pitch=30 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw60-pitch30');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.9167, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw60-pitch30.png');
});

test('spindle: extreme yaw=-60 pitch=-30 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw-60-pitch-30');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.0833, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw-60-pitch-30.png');
});

test('sphere: combined yaw=30 pitch=20 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw30-pitch20');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.75, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw30-pitch20.png');
});

test('sphere: combined yaw=-30 pitch=-20 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw-30-pitch-20');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.25, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw-30-pitch-20.png');
});

test('sphere: extreme yaw=60 pitch=-30 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw60-pitch-30');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.9167, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw60-pitch-30.png');
});

test('spindle: mouth open expression renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-mouth-open');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ mouthOpen: 0.8 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-mouth-open.png');
});

test('spindle: combined expression (smile + brow raise + mouth open)', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-expression-combo');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ mouthSmile: 0.8, browLeft: 0.5, browRight: 0.5, mouthOpen: 0.3 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-expression-combo.png');
});

test('sphere: mouth open expression renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-mouth-open');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ mouthOpen: 0.8 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-mouth-open.png');
});