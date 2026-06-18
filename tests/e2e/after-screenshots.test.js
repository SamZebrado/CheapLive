const { test } = require('@playwright/test');
test.setTimeout(120000);

function p({ angleY, angleX, angleZ, eyeLeft, eyeRight, mouthOpen, mouthSmile, browLeft, browRight, tailPitch, tailYaw }) {
  const r = { angleY: 0, angleX: 0, angleZ: 0, eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0, browLeft: 0, browRight: 0 };
  return Object.assign(r, arguments[0]);
}

test('after screenshots', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 400, height: 400 });
  await page.goto('http://localhost:8765/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });

  const { ProceduralSphereAvatar, ProceduralSpindleWhaleAvatar } = await (async () => {
    await page.evaluate(() => { document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>'; });
    return await page.evaluate(async () => {
      const m = await import('/src/face-tracking/procedural-mesh-renderer.js');
      return { hasSphere: !!m.ProceduralSphereAvatar, hasSpindle: !!m.ProceduralSpindleWhaleAvatar };
    });
  })();

  // === SPHERE ===
  await page.evaluate(async () => {
    document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';
    const { ProceduralSphereAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js');
    window._a = new ProceduralSphereAvatar('avatar_canvas');
    window._a.renderer.draw();
  });

  const sphereShots = [
    { n: 'sphere-front', p: p({}) },
    { n: 'sphere-blink', p: p({ eyeLeft: 0, eyeRight: 0 }) },
    { n: 'sphere-mouth-open', p: p({ mouthOpen: 0.8 }) },
    { n: 'sphere-yaw-left', p: p({ angleY: -40 }) },
    { n: 'sphere-yaw-right', p: p({ angleY: 40 }) },
    { n: 'sphere-pitch-down', p: p({ angleX: -20 }) },
    { n: 'sphere-both-closed', p: p({ eyeLeft: 0, eyeRight: 0, mouthOpen: 0.7 }) },
    { n: 'sphere-smile', p: p({ mouthSmile: 0.8 }) },
  ];
  for (const s of sphereShots) {
    await page.evaluate((p) => { window._a.renderer.setParameters(p); window._a.renderer.draw(); }, s.p);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `artifacts/mesh-avatar-after/${s.n}.png` });
  }

  // === SPINDLE ===
  await page.evaluate(async () => {
    document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';
    const { ProceduralSpindleWhaleAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js');
    window._a = new ProceduralSpindleWhaleAvatar('avatar_canvas');
    window._a.renderer.draw();
  });

  const spindleShots = [
    { n: 'spindle-front', p: p({}) },
    { n: 'spindle-blink', p: p({ eyeLeft: 0, eyeRight: 0 }) },
    { n: 'spindle-mouth-open', p: p({ mouthOpen: 0.8 }) },
    { n: 'spindle-three-quarter', p: p({ angleY: 30, angleX: 10 }) },
    { n: 'spindle-side', p: p({ angleY: -60 }) },
    { n: 'spindle-tail-visible', p: p({ angleY: 50, tailYaw: 15 }) },
    { n: 'spindle-smile', p: p({ mouthSmile: 0.8 }) },
  ];
  for (const s of spindleShots) {
    await page.evaluate((p) => { window._a.renderer.setParameters(p); window._a.renderer.draw(); }, s.p);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `artifacts/mesh-avatar-after/${s.n}.png` });
  }

  await ctx.close();
});

test('sphere expression demo webm', async ({ browser }) => {
  const ctx = await browser.newContext({
    recordVideo: { dir: 'artifacts/mesh-avatar-after', size: { width: 400, height: 420 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 400, height: 420 });
  await page.goto('http://localhost:8765/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(async () => {
    document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';
    const { ProceduralSphereAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js');
    window._a = new ProceduralSphereAvatar('avatar_canvas');
    window._a.renderer.draw();
  });

  const frames = 180;
  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    let yaw = 0, pitch = 0, eyeL = 1, eyeR = 1, mouth = 0, smile = 0;
    if (t < 0.2) { // yaw sweep
      yaw = -40 + 80 * (t / 0.2);
    } else if (t < 0.35) { // blink
      yaw = 40;
      const bt = (t - 0.2) / 0.15;
      eyeL = eyeR = 1 - Math.sin(bt * Math.PI) * 1;
    } else if (t < 0.55) { // mouth open
      eyeL = eyeR = 1;
      const mt = (t - 0.35) / 0.2;
      mouth = Math.sin(mt * Math.PI * 0.5) * 0.8;
    } else if (t < 0.75) { // smile
      mouth = 0.4;
      smile = (t - 0.55) / 0.2 * 0.8;
    } else { // reset + pitch
      mouth = 0; smile = 0;
      const pt = (t - 0.75) / 0.25;
      pitch = -20 + 40 * pt;
      yaw = 40 * Math.cos(pt * Math.PI);
    }
    await page.evaluate((p) => { window._a.renderer.setParameters(p); window._a.renderer.draw(); }, { angleY: yaw, angleX: pitch, eyeLeft: eyeL, eyeRight: eyeR, mouthOpen: mouth, mouthSmile: smile });
    await page.waitForTimeout(50);
  }
  await ctx.close();
});

test('spindle expression demo webm', async ({ browser }) => {
  const ctx = await browser.newContext({
    recordVideo: { dir: 'artifacts/mesh-avatar-after', size: { width: 400, height: 420 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 400, height: 420 });
  await page.goto('http://localhost:8765/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(async () => {
    document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';
    const { ProceduralSpindleWhaleAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js');
    window._a = new ProceduralSpindleWhaleAvatar('avatar_canvas');
    window._a.renderer.draw();
  });

  const frames = 240;
  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    let yaw = 0, pitch = 0, eyeL = 1, eyeR = 1, mouth = 0, smile = 0, tailPitch = 0, tailYaw = 0;
    if (t < 0.15) { // yaw sweep
      yaw = -60 + 120 * (t / 0.15);
    } else if (t < 0.3) { // blink
      yaw = 60;
      const bt = (t - 0.15) / 0.15;
      eyeL = eyeR = 1 - Math.sin(bt * Math.PI) * 1;
    } else if (t < 0.5) { // mouth open
      eyeL = eyeR = 1;
      const mt = (t - 0.3) / 0.2;
      mouth = Math.sin(mt * Math.PI * 0.5) * 0.8;
    } else if (t < 0.65) { // smile
      mouth = 0.3;
      smile = (t - 0.5) / 0.15 * 0.8;
    } else if (t < 0.85) { // tail wag
      mouth = 0; smile = 0;
      const wt = (t - 0.65) / 0.2;
      tailPitch = 25 * Math.sin(wt * Math.PI * 2);
      tailYaw = 15 * Math.sin(wt * Math.PI * 1.5);
      yaw = 30 * Math.cos(wt * Math.PI);
    } else { // reset
      yaw = 0; pitch = 0; tailPitch = 0; tailYaw = 0;
    }
    await page.evaluate((p) => { window._a.renderer.setParameters(p); window._a.renderer.draw(); }, { angleY: yaw, angleX: pitch, eyeLeft: eyeL, eyeRight: eyeR, mouthOpen: mouth, mouthSmile: smile, tailPitch, tailYaw });
    await page.waitForTimeout(50);
  }
  await ctx.close();
});