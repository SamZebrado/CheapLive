import assert from 'node:assert/strict';
import { test, expect } from '@playwright/test';
import { createSignalingService } from '../../src/multi-device/signaling-server.js';

const fixtureToken = 'synthetic-browser +/?&=#';

for (const [label, enteredToken] of [['missing', ''], ['wrong', 'synthetic-wrong']]) {
  for (const role of ['sender', 'receiver']) {
    test(`${role} shows a visible ${label}-token error${role === 'receiver' ? ' and recovers after changing the token' : ''}`, async ({ page }) => {
      const service = createSignalingService({ token: fixtureToken, heartbeatIntervalMs: 0 });
      await service.start();
      try {
        // Exercise shipped HTML/JS and native fetch/EventSource without camera/model downloads.
        await page.route('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm', (route) => route.fulfill({
          contentType: 'application/javascript',
          body: 'export const FilesetResolver = { forVisionTasks: async () => ({}) }; export const FaceLandmarker = { createFromOptions: async () => ({}) };',
        }));
        await page.addInitScript((port) => { window.__TEST_SIGNAL_PORT = port; }, Number(new URL(service.baseUrl).port));
        await page.goto('/src/multi-device/index.html');
        await page.locator('#signalingToken').fill(enteredToken);
        await page.locator(`.mode-card[data-mode="${role}"]`).click();
        const error = page.locator(role === 'sender' ? '#status' : '#receiverSignalingStatus');
        await expect(error).toContainText(role === 'sender' ? 'Authentication failed' : '信令认证失败');
        await expect(error).toBeVisible();
        expect(await error.textContent()).not.toContain(fixtureToken);
        expect(await error.textContent()).not.toContain('synthetic-wrong');
        assert.deepEqual(await page.evaluate((role) => ({
          heartbeat: window[role].signalingClient.heartbeatTimer,
          sse: window[role].signalingClient.eventSource,
          connected: window[role].signalingClient.connected,
        }), role), { heartbeat: null, sse: null, connected: false });
        assert.equal(service.devices.size, 0);
        assert.equal(service.sseClients.size, 0);

        if (role === 'receiver') {
          await expect(error).toContainText('Token');
          const retry = page.getByRole('button', { name: '返回修改 Token 并重试' });
          await expect(retry).toBeVisible();
          await expect(retry).toBeEnabled();
          const failedId = await page.evaluate(() => window.receiver.id);
          await retry.click();
          await expect(page.locator('#modeSelect')).toBeVisible();
          await expect(page.locator('#signalingToken')).toBeFocused();
          await page.locator('#signalingToken').fill(fixtureToken);
          await page.locator('.mode-card[data-mode="receiver"]').click();
          await expect.poll(() => [...service.sseClients.keys()].length).toBe(1);
          const recoveredId = await page.evaluate(() => window.receiver.id);
          assert.notEqual(recoveredId, failedId);
          assert.deepEqual([...service.devices.keys()], [recoveredId]);
          await expect(error).not.toBeVisible();

          // Returning after successful registration must clean up the old auth session too.
          await page.locator('#backFromReceiver').click();
          await expect(page.locator('#modeSelect')).toBeVisible();
          await expect.poll(() => service.devices.size).toBe(0);
          await expect.poll(() => service.sseClients.size).toBe(0);
          assert.equal(await page.evaluate(() => window.receiver.signalingClient.heartbeatTimer), null);
        }
      } finally {
        await page.close();
        await service.stop();
      }
    });
  }
}
