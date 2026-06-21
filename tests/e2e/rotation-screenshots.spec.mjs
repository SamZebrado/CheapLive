import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260621-007';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

test('sphere: yaw=-45deg left turn renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.125, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-yaw-45.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: yaw=45deg right turn renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.875, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-yaw45.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: pitch=-30deg look down renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-pitch-30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: pitch=30deg look up renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-pitch30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=-45deg left turn renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.125, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw-45.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: yaw=45deg right turn renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.875, headPitch: 0.5 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-yaw45.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: pitch=-30deg look down renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.1666666667 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-pitch-30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: pitch=30deg look up renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.avatar && window.avatar.updateParams({ headYaw: 0.5, headPitch: 0.8333333333 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-pitch30.png`, fullPage: true });
  expect(errs.length).toBe(0);
});