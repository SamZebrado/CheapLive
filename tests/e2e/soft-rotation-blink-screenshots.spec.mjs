import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260621-008';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

test('spindle: soft rotation yaw=45deg right turn', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.875, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-soft-yaw45.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: soft rotation yaw=-45deg left turn', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.125, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-soft-yaw-45.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: soft rotation pitch=30deg look up', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-soft-pitch30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: soft rotation pitch=-30deg look down', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-soft-pitch-30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: eye openness=1.0 fully open', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ eyeLeft: 1.0, eyeRight: 1.0 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blink-open.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: eye openness=0.5 half closed', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blink-half.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: eye openness=0.15 transition point', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ eyeLeft: 0.15, eyeRight: 0.15 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blink-transition.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: eye openness=0.0 fully closed', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ eyeLeft: 0.0, eyeRight: 0.0 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-blink-closed.png`, fullPage: true });
  expect(errs.length).toBe(0);
});