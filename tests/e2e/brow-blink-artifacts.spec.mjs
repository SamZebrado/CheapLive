import { test, expect } from '@playwright/test';

const RUN_ID = 'run-20260622-015';
const ARTIFACT_DIR = `.automation/artifacts/${RUN_ID}`;

test('spindle: default front with blink clip mask', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-front-blink-clip.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: brow animation fully raised', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ browLeft: 1, browRight: 1 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-brow-raised-full.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: brow animation half raised', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ browLeft: 0.5, browRight: 0.5 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-brow-raised-half.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: eye fully closed (blink clip mask)', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ eyeLeft: 0, eyeRight: 0 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-closed-full.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('spindle: eye half closed (blink clip mask)', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ eyeLeft: 0.325, eyeRight: 0.325 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/spindle-eye-closed-half.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: default front with blink clip mask', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-front-blink-clip.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: brow animation fully raised', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ browLeft: 1, browRight: 1 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-brow-raised-full.png`, fullPage: true });
  expect(errs.length).toBe(0);
});

test('sphere: eye fully closed (blink clip mask)', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ eyeLeft: 0, eyeRight: 0 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/sphere-eye-closed-full.png`, fullPage: true });
  expect(errs.length).toBe(0);
});