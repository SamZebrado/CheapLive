import { expect, test } from '@playwright/test';

function observeRuntime(page) {
  const pageErrors = [];
  const brokenCoreAssets = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (response.status() >= 400 && /\.(?:css|html|js|mjs|task|wasm)$/.test(pathname)) {
      brokenCoreAssets.push(`${response.status()} ${pathname}`);
    }
  });
  return { pageErrors, brokenCoreAssets };
}

test.describe('CheapLive canonical web runtime gate', () => {
  test('all primary entry points load without runtime errors or missing core assets', async ({ page }) => {
    const diagnostics = observeRuntime(page);
    const entries = [
      '/',
      '/src/face-tracking/',
      '/src/contest-demo/contest-interactive-demo.html',
      '/capture/',
      '/receiver/?public=1&showcase=1',
      '/android-capture/app/src/main/assets/web/contest-demo/contest-interactive-demo.html',
      '/demo/',
      '/black-screen/',
    ];

    for (const entry of entries) {
      const response = await page.goto(entry, { waitUntil: 'domcontentloaded' });
      expect(response, `no navigation response for ${entry}`).not.toBeNull();
      expect(response.ok(), `${entry} returned ${response.status()}`).toBeTruthy();
      await page.waitForTimeout(150);
    }

    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.brokenCoreAssets).toEqual([]);
  });

  test('browser face model resources are local and reachable', async ({ request }) => {
    const resources = [
      '/src/face-tracking/mediapipe/face_landmarker.task',
      '/src/face-tracking/mediapipe/vision_bundle.mjs',
      '/web/mediapipe/tasks-vision/face_landmarker.task',
      '/web/mediapipe/tasks-vision/vision_bundle.mjs',
    ];
    for (const resource of resources) {
      const response = await request.get(resource);
      expect(response.ok(), `${resource} returned ${response.status()}`).toBeTruthy();
      expect((await response.body()).byteLength, `${resource} is empty`).toBeGreaterThan(100);
    }
  });

  test('receiver renders, validates frames, toggles transparency, and releases audio', async ({ page }) => {
    const diagnostics = observeRuntime(page);
    await page.goto('/receiver/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag?.rendererReady)).toBe(true);
    await expect(page.locator('#stage')).toBeVisible();

    const accepted = await page.evaluate(() => {
      const good = window.__cheapLiveInjectFaceEnvelope({
        type: 'face-frame', seq: 41, source: 'real-camera', timestamp: Date.now(),
        params: { eyeLeft: 0.8, eyeRight: 0.7, mouthOpen: 0.35, headYaw: 12 },
      });
      const stale = window.__cheapLiveInjectFaceEnvelope({
        type: 'face-frame', seq: 41, params: { mouthOpen: 0.2 },
      });
      const invalid = window.__cheapLiveInjectFaceEnvelope({
        type: 'face-frame', seq: 42, params: { mouthOpen: Number.POSITIVE_INFINITY },
      });
      return { good, stale, invalid, diag: window.__cheapLiveReceiverDiag };
    });
    expect(accepted.good).toBe(true);
    expect(accepted.stale).toBe(false);
    expect(accepted.invalid).toBe(false);
    expect(accepted.diag.lastFrameSeq).toBe(41);
    expect(accepted.diag.lastFrameSource).toBe('real-camera');

    await page.locator('#enableAudioBtn').click();
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag.audioUnlocked)).toBe(true);
    await page.locator('#enableAudioBtn').click();
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag.audioPlaybackState)).toBe('off');
    await page.locator('#toggleAppModeBtn').click();
    await expect(page.locator('body')).toHaveClass(/app-mode/);

    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.brokenCoreAssets).toEqual([]);
  });

  test('receiver app query boots directly into transparent avatar-only mode', async ({ page }) => {
    await page.goto('/receiver/?app=1');
    await expect(page.locator('body')).toHaveClass(/app-mode/);
    await expect(page.locator('#stage')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.hero')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag.rendererReady)).toBe(true);
    const cornerAlphaAfterReinit = await page.evaluate(() => {
      window.__cheapLiveInitRenderer('cat');
      const canvas = document.getElementById('stage');
      return canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3];
    });
    expect(cornerAlphaAfterReinit).toBe(0);
  });

  test('receiver retries preferred SSE while keeping only one polling fallback', async ({ page }) => {
    await page.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.__sseTest = { instances: [], statusFetches: 0 };
      window.fetch = (input, init) => {
        if (String(input).startsWith('/api/status')) {
          window.__sseTest.statusFetches++;
          return Promise.resolve(new Response(JSON.stringify({ avatar: 'sacabambaspis3d' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        return nativeFetch(input, init);
      };
      window.EventSource = class FakeEventSource {
        constructor(url) {
          this.url = url;
          this.listeners = {};
          this.closed = false;
          window.__sseTest.instances.push(this);
          const attempt = window.__sseTest.instances.length;
          setTimeout(() => {
            if (attempt === 1) {
              if (this.onerror) this.onerror(new Event('error'));
            } else {
              const listener = this.listeners.state;
              if (listener) listener({ data: JSON.stringify({ avatar: 'sacabambaspis3d' }) });
            }
          }, 20);
        }
        addEventListener(type, listener) { this.listeners[type] = listener; }
        close() { this.closed = true; }
      };
    });

    await page.goto('/receiver/?public=1&showcase=1');
    await expect.poll(() => page.evaluate(() => window.__sseTest.instances.length), { timeout: 7000 }).toBe(2);
    const state = await page.evaluate(() => ({
      firstClosed: window.__sseTest.instances[0].closed,
      secondClosed: window.__sseTest.instances[1].closed,
      statusFetches: window.__sseTest.statusFetches,
    }));
    expect(state.firstClosed).toBe(true);
    expect(state.secondClosed).toBe(false);
    expect(state.statusFetches).toBeLessThan(5);

    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag.transportState)).toBe('offline');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => page.evaluate(() => window.__sseTest.instances.length)).toBe(3);
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag.transportState)).toBe('connected-sse');
  });

  test('receiver stops transport retries after an unauthorized status', async ({ page }) => {
    await page.addInitScript(() => {
      window.__unauthorizedTransport = { eventSources: 0 };
      window.fetch = () => Promise.resolve(new Response('forbidden', { status: 403 }));
      window.EventSource = class FakeEventSource {
        constructor() { window.__unauthorizedTransport.eventSources++; }
        addEventListener() {}
        close() {}
      };
    });
    await page.goto('/receiver/?token=invalid');
    await expect.poll(() => page.evaluate(() => window.__cheapLiveReceiverDiag.transportState)).toBe('unauthorized');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__unauthorizedTransport.eventSources)).toBe(0);
  });

  test('capture camera start/stop and page exit are idempotent', async ({ page }) => {
    await page.addInitScript(() => {
      window.__cameraTest = { requests: 0, stops: 0, resolve: null };
      const track = { kind: 'video', label: 'fake-camera', readyState: 'live', stop() { window.__cameraTest.stops++; this.readyState = 'ended'; } };
      const stream = { id: 'fake-stream', getTracks: () => [track] };
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia() {
            window.__cameraTest.requests++;
            return new Promise((resolve) => { window.__cameraTest.resolve = () => resolve(stream); });
          },
        },
      });
    });

    await page.goto('/capture/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => Boolean(window.CheapLiveCapture))).toBe(true);
    const starts = await page.evaluate(() => [
      JSON.parse(window.CheapLiveCapture.startCamera('gate-1')),
      JSON.parse(window.CheapLiveCapture.startCamera('gate-2')),
    ]);
    expect(starts[0].starting).toBe(true);
    expect(starts[1].alreadyStarting).toBe(true);
    expect(await page.evaluate(() => window.__cameraTest.requests)).toBe(1);

    await page.evaluate(() => window.__cameraTest.resolve());
    await expect.poll(() => page.evaluate(() => JSON.parse(window.CheapLiveCapture.getState()).hasStream)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    expect(await page.evaluate(() => window.__cameraTest.stops)).toBe(1);
    const stopped = await page.evaluate(() => JSON.parse(window.CheapLiveCapture.stopCamera('gate-repeat', true)));
    expect(stopped.hasStream).toBe(false);
    expect(await page.evaluate(() => window.__cameraTest.stops)).toBe(1);
  });
});
