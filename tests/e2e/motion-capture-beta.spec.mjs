import { expect, test } from '@playwright/test';

test.describe('upper-body motion beta', () => {
  test('pose model stays unloaded until explicit enable', async ({ page }) => {
    const poseRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('pose_landmarker_lite.task')) poseRequests.push(request.url());
    });
    await page.goto('/capture/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const initial = JSON.parse(await page.evaluate(() => window.CheapLiveCapture.getState()));
    expect(initial.poseEnabled).toBe(false);
    expect(poseRequests).toHaveLength(0);

    await page.evaluate(() => window.CheapLiveCapture.applyPoseSettings(JSON.stringify({
      enabled: true, mode: 'real-camera', performanceProfile: 'low', smoothing: 0.35, mirrored: true,
    })));
    await expect.poll(() => poseRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await page.evaluate(() => window.CheapLiveCapture.applyPoseSettings('{"enabled":false}'));
  });

  test('simulator drives directions, rejects stale frames, and recovers from loss', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/receiver/?public=1&showcase=1', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean(window.__cheapLiveMotionTest))).toBe(true);

    const result = await page.evaluate(async () => {
      const { PoseSimulator } = await import('/web/shared/protocol/pose-simulator.js');
      const simulator = new PoseSimulator({ now: () => performance.now() });
      simulator.setEnabled(true);
      window.__cheapLiveMotionTest.configure({ enabled: true, debugSkeleton: true, smoothing: 1 });
      const neutral = simulator.frame('neutral');
      const acceptedNeutral = window.__cheapLiveMotionTest.receive(neutral);
      const lean = simulator.frame('lean-left');
      const acceptedLean = window.__cheapLiveMotionTest.receive(lean);
      const leanRig = window.__cheapLiveMotionTest.getRig();
      const crossed = simulator.frame('wrists-crossed');
      const acceptedCrossed = window.__cheapLiveMotionTest.receive(crossed);
      const crossedRig = window.__cheapLiveMotionTest.getRig();
      const stale = { ...crossed, sequence: crossed.sequence };
      const rejectedStale = window.__cheapLiveMotionTest.receive(stale);
      return {
        acceptedNeutral, acceptedLean, acceptedCrossed, rejectedStale,
        shoulderAngle: leanRig.shoulderAngle,
        crossed: crossedRig.leftWrist.x > crossedRig.rightWrist.x,
        diag: window.__cheapLiveReceiverDiag.pose,
      };
    });
    expect(result.acceptedNeutral).toBe(true);
    expect(result.acceptedLean).toBe(true);
    expect(result.acceptedCrossed).toBe(true);
    expect(result.rejectedStale).toBe(false);
    expect(Math.abs(result.shoulderAngle)).toBeGreaterThan(0.03);
    expect(result.crossed).toBe(true);
    expect(result.diag.rejected).toBeGreaterThan(0);

    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.__cheapLiveReceiverDiag.pose.tracking)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('debug skeleton produces visible confidence-colored pixels', async ({ page }) => {
    await page.goto('/receiver/?public=1&showcase=1', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean(window.__cheapLiveMotionTest))).toBe(true);
    const coloredPixels = await page.evaluate(async () => {
      const { PoseSimulator } = await import('/web/shared/protocol/pose-simulator.js');
      const simulator = new PoseSimulator({ now: () => performance.now() });
      simulator.setEnabled(true);
      window.__cheapLiveMotionTest.configure({ enabled: true, debugSkeleton: true, smoothing: 1 });
      window.__cheapLiveMotionTest.receive(simulator.frame('both-arms-up'));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = document.getElementById('stage');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if ((pixels[i] < 130 && pixels[i + 1] > 150 && pixels[i + 2] > 80) ||
            (pixels[i] > 180 && pixels[i + 1] > 160 && pixels[i + 2] < 150)) count++;
      }
      return count;
    });
    expect(coloredPixels).toBeGreaterThan(20);
  });
});
