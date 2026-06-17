/**
 * Procedural Mesh Dynamic Demo Generator
 * 为程序化 Canvas 2.5D 网格 Avatar 生成动态展示 webm 视频
 */

const { test } = require('playwright/test');
const path = require('path');
const { execSync } = require('child_process');

async function renderDynamicDemo(page, type, frames, paramFn) {
  await page.evaluate(async (avatarType) => {
    document.body.innerHTML = `
      <canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>
      <div id="param-info" style="position:fixed;bottom:8px;left:50%;transform:translateX(-50%);color:#fff;font:12px monospace;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:4px;"></div>
    `;
    const { ProceduralSphereAvatar, ProceduralSpindleWhaleAvatar } = await import('/src/face-tracking/procedural-mesh-renderer.js');
    let avatar;
    if (avatarType === 'mesh-sphere') {
      avatar = new ProceduralSphereAvatar('avatar_canvas');
    } else {
      avatar = new ProceduralSpindleWhaleAvatar('avatar_canvas');
    }
    window._testAvatar = avatar;
    window._paramInfo = document.getElementById('param-info');
    avatar.draw();
  }, type);
  await page.waitForTimeout(500);

  for (let i = 0; i < frames; i++) {
    const params = paramFn(i, frames);
    await page.evaluate((p) => {
      const avatar = window._testAvatar;
      if (avatar && avatar.renderer) {
        avatar.renderer.setParameters(p);
        avatar.renderer.draw();
      }
      if (window._paramInfo) {
        window._paramInfo.textContent = `yaw:${p.angleY?.toFixed(1) || 0} pitch:${p.angleX?.toFixed(1) || 0} frame:${p._frame}`;
      }
    }, { ...params, _frame: i });
    await page.waitForTimeout(50);
  }
}

test.describe('Procedural Sphere Dynamic Demo', () => {
  test('generate sphere animation', async ({ browser }) => {
    const context = await browser.newContext({
      recordVideo: {
        dir: path.resolve('artifacts/procedural-sphere'),
        size: { width: 400, height: 420 },
      },
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 400, height: 420 });
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Phase 1: Yaw sweep -60 to +60
    const totalFrames = 120; // ~6 seconds at 50ms/frame
    await renderDynamicDemo(page, 'mesh-sphere', totalFrames, (i, total) => {
      const t = i / total;
      const yaw = -60 + 120 * t;
      return { angleY: yaw, angleX: 0, angleZ: 0 };
    });

    await context.close();
  });
});

test.describe('Procedural Spindle-Whale Dynamic Demo', () => {
  test('generate spindle-whale animation', async ({ browser }) => {
    const context = await browser.newContext({
      recordVideo: {
        dir: path.resolve('artifacts/procedural-spindle-whale'),
        size: { width: 400, height: 420 },
      },
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 400, height: 420 });
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const totalFrames = 180; // ~9 seconds
    await renderDynamicDemo(page, 'mesh-spindle-whale', totalFrames, (i, total) => {
      const t = i / total;
      // Phase 1 (0-0.33): Yaw sweep
      let yaw = 0, pitch = 0, tailPitch = 0, tailYaw = 0;
      if (t < 0.33) {
        yaw = -60 + 180 * (t / 0.33);
      }
      // Phase 2 (0.33-0.66): Pitch + tail wave
      else if (t < 0.66) {
        yaw = 60;
        pitch = 15 * Math.sin((t - 0.33) / 0.33 * Math.PI * 2);
        tailPitch = 20 * Math.sin((t - 0.33) / 0.33 * Math.PI * 3);
      }
      // Phase 3 (0.66-1.0): Combined rotation
      else {
        const phase = (t - 0.66) / 0.34;
        yaw = 60 * Math.cos(phase * Math.PI * 2);
        pitch = 10 * Math.sin(phase * Math.PI * 2);
        tailPitch = 15 * Math.sin(phase * Math.PI * 3);
        tailYaw = 10 * Math.sin(phase * Math.PI * 2.5);
      }
      return { angleY: yaw, angleX: pitch, angleZ: 0, tailPitch, tailYaw };
    });

    await context.close();
  });
});