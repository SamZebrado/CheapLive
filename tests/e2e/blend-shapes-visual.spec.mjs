import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260623-001';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

// Helper to set blend shape parameters
async function setBlendShapes(page, params) {
  await page.evaluate((p) => {
    if (window.avatar) {
      window.avatar.updateParams(p);
    }
  }, params);
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

test.describe('Spindle whale blend shapes visual verification', () => {
  test('spindle: baseline (no blend shape effects)', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-baseline.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeWide=1.0', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 1, eyeWideRight: 1, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-eye-wide.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeSquint=0.8', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0.8, eyeSquintRight: 0.8, mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-eye-squint.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: mouthFunnel=0.8', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0.3, mouthSmile: 0, mouthFunnel: 0.8, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-mouth-funnel.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: mouthPress=0.8', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0.5, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0.8 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-mouth-press.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeWide + eyeSquint + smile combination', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // 组合：眼睛变大的同时眯眼（微笑时的自然效果）
    await setBlendShapes(page, { eyeLeft: 0.7, eyeRight: 0.7, eyeWideLeft: 0.5, eyeWideRight: 0.5, eyeSquintLeft: 0.4, eyeSquintRight: 0.4, mouthOpen: 0.2, mouthSmile: 0.6, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-combo-wide-squint-smile.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('spindle: eyeWide + squint with half-blink', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // 半眨眼 + eyeWide + squint 组合
    await setBlendShapes(page, { eyeLeft: 0.5, eyeRight: 0.5, eyeWideLeft: 0.3, eyeWideRight: 0.3, eyeSquintLeft: 0.6, eyeSquintRight: 0.6, mouthOpen: 0.3, mouthSmile: 0.4, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blend-combo-half-blink-wide-squint.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });
});

test.describe('Sphere avatar blend shapes visual verification', () => {
  test('sphere: baseline', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-baseline.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: eyeWide=1.0', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 1, eyeWideRight: 1, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-eye-wide.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: eyeSquint=0.8', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0.8, eyeSquintRight: 0.8, mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-eye-squint.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: mouthFunnel=0.8', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0.3, mouthSmile: 0, mouthFunnel: 0.8, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-mouth-funnel.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: mouthPress=0.8', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 1, eyeRight: 1, eyeWideLeft: 0, eyeWideRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0, mouthOpen: 0.5, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0.8 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-mouth-press.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: eyeWide + squint + smile combination', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 0.7, eyeRight: 0.7, eyeWideLeft: 0.5, eyeWideRight: 0.5, eyeSquintLeft: 0.4, eyeSquintRight: 0.4, mouthOpen: 0.2, mouthSmile: 0.6, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-combo-wide-squint-smile.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });

  test('sphere: eyeWide + squint with half-blink', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setBlendShapes(page, { eyeLeft: 0.5, eyeRight: 0.5, eyeWideLeft: 0.3, eyeWideRight: 0.3, eyeSquintLeft: 0.6, eyeSquintRight: 0.6, mouthOpen: 0.3, mouthSmile: 0.4, mouthFunnel: 0, mouthPress: 0 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-blend-combo-half-blink-wide-squint.png`, fullPage: true });
    expect(errs.length).toBe(0);
  });
});
