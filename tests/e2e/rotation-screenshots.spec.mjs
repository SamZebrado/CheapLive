import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260622-001';
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

test('sphere: neutral pose (yaw=0, pitch=0) renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-neutral');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-neutral.png');
});

test('sphere: yaw=-45deg left turn renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw-45');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.125, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw-45.png');
});

test('sphere: yaw=45deg right turn renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw45');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.875, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw45.png');
});

test('sphere: yaw=60deg extreme right turn renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw60');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.9167, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw60.png');
});

test('sphere: pitch=-30deg look down renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-pitch-30');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-pitch-30.png');
});

test('sphere: pitch=30deg look up renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-pitch30');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-pitch30.png');
});

test('sphere: combined yaw=-30 pitch=-20 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-yaw-30-pitch-20');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.25, headPitch: 0.1667 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-yaw-30-pitch-20.png');
});

test('sphere: blink animation renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'sphere-blink');
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ eyeLeft: 0.1, eyeRight: 0.1 });
  });
  await page.waitForTimeout(500);
  await capture('sphere-blink.png');
});

test('spindle: neutral pose (yaw=0, pitch=0) renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-neutral');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-neutral.png');
});

test('spindle: yaw=-45deg left turn renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw-45');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.125, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw-45.png');
});

test('spindle: yaw=45deg right turn renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw45');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.875, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw45.png');
});

test('spindle: yaw=60deg extreme right turn renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw60');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.9167, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw60.png');
});

test('spindle: pitch=-30deg look down renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-pitch-30');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-pitch-30.png');
});

test('spindle: pitch=30deg look up renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-pitch30');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-pitch30.png');
});

test('spindle: combined yaw=-30 pitch=-20 renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-yaw-30-pitch-20');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.25, headPitch: 0.1667 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-yaw-30-pitch-20.png');
});

test('spindle: blink animation renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-blink');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ eyeLeft: 0.1, eyeRight: 0.1 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-blink.png');
});

test('spindle: smile expression renders without JS error', async ({ page }) => {
  const { capture } = captureWithErrors(page, 'spindle-smile');
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ mouthSmile: 1.0, browLeft: 0.3, browRight: 0.3 });
  });
  await page.waitForTimeout(500);
  await capture('spindle-smile.png');
});