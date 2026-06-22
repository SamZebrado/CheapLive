import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260623-001';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

// Helper to set eye openness
async function setEyeOpen(page, value) {
  await page.evaluate((v) => {
    if (window.avatar) {
      window.avatar.updateParams({ eyeLeft: v, eyeRight: v });
    }
  }, value);
}

// Helper to set yaw rotation
async function setYaw(page, value) {
  await page.evaluate((v) => {
    if (window.avatar) {
      const clamped = Math.max(0, Math.min(1, 0.5 + v * 0.15));
      window.avatar.updateParams({ headYaw: clamped });
    }
  }, value);
}

test.describe('Spindle whale eyelid ellipse verification', () => {
  test('spindle: eyeOpen=1.0 (fully open)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 1.0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-open-1.0.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeOpen=0.5 (half open)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 0.5);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-open-0.5.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeOpen=0.1 (nearly closed)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 0.1);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-open-0.1.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeOpen=0.1, yaw=-30deg', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 0.1);
    await setYaw(page, -2); // ~-30deg
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-open-0.1-yaw-minus30.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeOpen=0.1, yaw=+30deg', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 0.1);
    await setYaw(page, 2); // ~+30deg
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-open-0.1-yaw-plus30.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });
});

test.describe('Sphere avatar eyelid ellipse verification', () => {
  test('sphere: eyeOpen=1.0 (fully open)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 1.0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-eye-open-1.0.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: eyeOpen=0.5 (half open)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 0.5);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-eye-open-0.5.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: eyeOpen=0.1 (nearly closed)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setEyeOpen(page, 0.1);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-eye-open-0.1.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });
});
