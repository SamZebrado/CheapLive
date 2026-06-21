const { test } = require('@playwright/test');
test('before', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 400, height: 400 });
  await page.goto('http://localhost:8765/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(async (type) => {
    document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';
    const { ProceduralSphereAvatar, ProceduralSpindleWhaleAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js');
    window._a = type === 'sphere' ? new ProceduralSphereAvatar('avatar_canvas') : new ProceduralSpindleWhaleAvatar('avatar_canvas');
    window._a.renderer.draw();
  }, 'sphere');
  const shots = [{ n: 'sphere-front', y: 0, p: 0 }, { n: 'sphere-yaw-left', y: -40, p: 0 }, { n: 'sphere-yaw-right', y: 40, p: 0 }];
  for (const s of shots) {
    await page.evaluate((p) => { window._a.renderer.setParameters(p); window._a.renderer.draw(); }, { angleY: s.y, angleX: s.p });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `artifacts/mesh-avatar-before/${s.n}.png` });
  }
  await page.evaluate(async () => { document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>'; const { ProceduralSpindleWhaleAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js'); window._a = new ProceduralSpindleWhaleAvatar('avatar_canvas'); window._a.renderer.draw(); });
  const shots2 = [{ n: 'spindle-front', y: 0, p: 0 }, { n: 'spindle-three-quarter', y: 30, p: 10 }, { n: 'spindle-side', y: -60, p: 0 }];
  for (const s of shots2) {
    await page.evaluate((p) => { window._a.renderer.setParameters(p); window._a.renderer.draw(); }, { angleY: s.y, angleX: s.p });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `artifacts/mesh-avatar-before/${s.n}.png` });
  }
  await ctx.close();
});