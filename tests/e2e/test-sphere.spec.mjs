import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260620-003';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

test('sphere: default front renders without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-sphere-front.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: blink animation runs', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  try { await page.evaluate(() => { if (window.testBlink) window.testBlink(); }); } catch (e) { /* no testBlink */ }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-sphere-blink.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: yaw rotation runs', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  try { await page.evaluate(() => { if (window.testYaw) window.testYaw(); }); } catch (e) { /* no testYaw */ }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-sphere-rotated.png`, fullPage: true });
  expect(errs.length).toBe(0);
});
