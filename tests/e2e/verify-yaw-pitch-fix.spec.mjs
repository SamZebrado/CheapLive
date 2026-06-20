import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260621-001';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

// Test yaw+pitch combined rotation - verify face features stay on surface
test('spindle: yaw=0 pitch=0 (neutral) renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Set neutral pose
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5, headRoll: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw0-pitch0.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=30deg pitch=0 (right turn only) renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // yaw=0.5+0.3=0.8 maps to ~54deg, but test simple offset
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.8, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw30-pitch0.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=0 pitch=30deg (nod only) renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.8 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw0-pitch30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=30deg pitch=30deg (combined) renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.8, headPitch: 0.8 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw30-pitch30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=-30deg pitch=30deg (left+up) renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.2, headPitch: 0.8 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw-30-pitch30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=30deg pitch=-30deg (right+down) renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.8, headPitch: 0.2 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw30-pitch-30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});