const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(
  __dirname,
  '..',
  '..',
  '.automation',
  'contest-demo-open-fish'
);

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

/**
 * Phase 2B.1 test: verify that mouthOpen mainly drives the lower lip,
 * not the upper lip, by capturing the actual drawing coordinates.
 *
 * Strategy: the spindle whale mouth (when open) is drawn as a filled shape
 * with fillStyle '#4a2020' using two consecutive quadraticCurveTo calls:
 *   moveTo(left) -> quadraticCurveTo(topMid, right)   // upper lip
 *   quadraticCurveTo(botMid, left)                     // lower lip
 *   closePath -> fill -> stroke
 *
 * We intercept fillStyle setter and fill() to capture exactly the two
 * quadraticCurveTo calls that form the mouth, avoiding false matches
 * with eyes/eyebrows/nostrils.
 */

async function setupRendererWithMouthCapture(page) {
  await page.evaluate(async () => {
    document.body.innerHTML =
      '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';
    const m = await import('/src/face-tracking/procedural-mesh-renderer.js');
    window._renderer = new m.ProceduralSpindleWhaleAvatar('avatar_canvas');

    const c = document.getElementById('avatar_canvas');
    const origCtx = c.getContext('2d');

    // Buffer of all quadraticCurveTo calls: { cpx, cpy, x, y }
    window._allCurves = [];
    // Captured mouth curve pairs: [{ topMid, botMid, leftCorner, rightCorner }]
    window._mouthPairs = [];
    // Track fillStyle to detect mouth fill
    window._pendingFillStyle = null;
    window._mouthFillPending = false;

    const origQCT = origCtx.quadraticCurveTo.bind(origCtx);
    origCtx.quadraticCurveTo = function (cpx, cpy, x, y) {
      window._allCurves.push({ cpx, cpy, x, y });
      return origQCT(cpx, cpy, x, y);
    };

    const origMoveTo = origCtx.moveTo.bind(origCtx);
    origCtx.moveTo = function (x, y) {
      window._lastMoveTo = { x, y };
      return origMoveTo(x, y);
    };

    // Intercept fillStyle setter to detect mouth fill color '#4a2020'
    const origFillStyle = Object.getOwnPropertyDescriptor(
      CanvasRenderingContext2D.prototype,
      'fillStyle'
    );
    Object.defineProperty(origCtx, 'fillStyle', {
      get() {
        return origFillStyle.get.call(this);
      },
      set(v) {
        window._mouthFillPending = v === '#4a2020' || v === '#4a2020'.toLowerCase();
        origFillStyle.set.call(this, v);
      },
    });

    const origFill = origCtx.fill.bind(origCtx);
    origCtx.fill = function () {
      if (window._mouthFillPending) {
        // The mouth shape: moveTo(left) -> QCT(topMid -> right) -> QCT(botMid -> left) -> closePath -> fill
        // So the last two quadraticCurveTo calls are the mouth curves.
        const curves = window._allCurves;
        if (curves.length >= 2) {
          const topMidCurve = curves[curves.length - 2];
          const botMidCurve = curves[curves.length - 1];
          window._mouthPairs.push({
            topMid: { x: topMidCurve.cpx, y: topMidCurve.cpy },
            botMid: { x: botMidCurve.cpx, y: botMidCurve.cpy },
            rightCorner: { x: topMidCurve.x, y: topMidCurve.y },
            leftCorner: { x: botMidCurve.x, y: botMidCurve.y },
          });
        }
        window._mouthFillPending = false;
      }
      return origFill();
    };
  });
}

async function renderAndCaptureMouth(page, params) {
  await page.evaluate((p) => {
    window._allCurves = [];
    window._mouthPairs = [];
    window._renderer.updateParams(p);
    window._renderer.draw();
  }, params);
  await page.waitForTimeout(100);
  return page.evaluate(() => [...window._mouthPairs]);
}

test('spindle mouth: lower lip displacement dominates upper lip', async ({
  page,
}) => {
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://127.0.0.1:8769/src/face-tracking/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });

  await setupRendererWithMouthCapture(page);

  // Render with mouthOpen=1, smile=0
  const mouthPairs = await renderAndCaptureMouth(page, {
    mouthOpen: 1,
    mouthSmile: 0,
  });

  expect(mouthPairs.length).toBeGreaterThan(0);
  const mouth = mouthPairs[mouthPairs.length - 1];

  // baseline = mouth corner y (left and right corners should be ~equal)
  const baselineY = mouth.rightCorner.y;
  const upperLipY = mouth.topMid.y;
  const lowerLipY = mouth.botMid.y;

  const upperDisplacement = Math.abs(baselineY - upperLipY);
  const lowerDisplacement = Math.abs(lowerLipY - baselineY);

  // Upper lip displacement should be <= 20% of lower lip displacement
  const ratio = upperDisplacement / Math.max(0.01, lowerDisplacement);
  expect(ratio).toBeLessThan(0.2);

  // Lower lip should have significant displacement
  expect(lowerDisplacement).toBeGreaterThan(5);

  ensureScreenshotDir();
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIR,
      'phase2b1-mouth-open-lower-lip-dominant.png'
    ),
  });

  expect(errs.length).toBe(0);
});

test('spindle mouth: smile does not lift upper lip significantly', async ({
  page,
}) => {
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://127.0.0.1:8769/src/face-tracking/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });

  await setupRendererWithMouthCapture(page);

  // Render with mouthOpen=0.4, smile=0
  const noSmilePairs = await renderAndCaptureMouth(page, {
    mouthOpen: 0.4,
    mouthSmile: 0,
  });

  // Render with mouthOpen=0.4, smile=0.8
  const smilePairs = await renderAndCaptureMouth(page, {
    mouthOpen: 0.4,
    mouthSmile: 0.8,
  });

  expect(noSmilePairs.length).toBeGreaterThan(0);
  expect(smilePairs.length).toBeGreaterThan(0);

  const noSmileMouth = noSmilePairs[noSmilePairs.length - 1];
  const smileMouth = smilePairs[smilePairs.length - 1];

  // Compare upper lip position with and without smile
  const upperLipNoSmile = noSmileMouth.topMid.y;
  const upperLipSmile = smileMouth.topMid.y;
  const upperLipChange = Math.abs(upperLipSmile - upperLipNoSmile);

  // Smile should not cause significant upper lip movement.
  // Upper lip change should be small (smile mainly widens mouth and
  // adjusts corners, not upper lip center).
  // Allow some movement but it should be less than 10 pixels.
  expect(upperLipChange).toBeLessThan(10);

  expect(errs.length).toBe(0);
});
