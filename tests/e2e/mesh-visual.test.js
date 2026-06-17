/**
 * Mesh Visual Verification Tests
 * 为 Live2D 风格 2.5D 网格模型生成视觉验收截图
 */

const { test } = require('playwright/test');

async function renderMeshAvatar(page, type) {
  // 直接创建 mesh avatar 并绘制，不依赖 face-tracker 初始化
  await page.evaluate(async (avatarType) => {
    // 清理页面内容，只保留 canvas
    document.body.innerHTML = '<canvas id="avatar_canvas" width="400" height="400" style="background:#1A1A2E;"></canvas>';

    // 动态导入 mesh renderer
    const { SphereMeshAvatar, SpindleWhaleMeshAvatar } = await import('/src/face-tracking/live2d-mesh-renderer.js');

    let avatar;
    if (avatarType === 'mesh-sphere') {
      avatar = new SphereMeshAvatar('avatar_canvas');
    } else {
      avatar = new SpindleWhaleMeshAvatar('avatar_canvas');
    }

    window._testAvatar = avatar;
    avatar.draw();
  }, type);

  await page.waitForTimeout(500);
}

async function setAngles(page, yaw, pitch, roll) {
  await page.evaluate((params) => {
    const avatar = window._testAvatar;
    if (avatar && avatar.renderer) {
      avatar.renderer.setParameters(params);
      avatar.renderer.draw();
    }
  }, {
    angleX: pitch,
    angleY: yaw,
    angleZ: roll,
  });
  await page.waitForTimeout(300);
}

test.describe('Sphere Mesh Visual', () => {
  test('generate sphere screenshots', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 400, height: 400 });
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await renderMeshAvatar(page, 'mesh-sphere');

    const shots = [
      { name: 'front', yaw: 0, pitch: 0, roll: 0 },
      { name: 'yaw-minus-60', yaw: -60, pitch: 0, roll: 0 },
      { name: 'yaw-plus-60', yaw: 60, pitch: 0, roll: 0 },
      { name: 'pitch-plus-25', yaw: 0, pitch: 25, roll: 0 },
    ];

    for (const s of shots) {
      await setAngles(page, s.yaw, s.pitch, s.roll);
      await page.screenshot({
        path: `artifacts/3d-sphere/sphere-${s.name}.png`,
      });
    }

    await context.close();
  });
});

test.describe('Spindle Whale Mesh Visual', () => {
  test('generate spindle screenshots', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 400, height: 400 });
    await page.goto('http://localhost:8765/src/face-tracking/index.html', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await renderMeshAvatar(page, 'mesh-spindle-whale');

    const shots = [
      { name: 'front', yaw: 0, pitch: 0, roll: 0 },
      { name: 'side', yaw: -60, pitch: 0, roll: 0 },
      { name: 'three-quarter', yaw: 30, pitch: 15, roll: 0 },
      { name: 'tail-occluded', yaw: 0, pitch: 0, roll: 0 },
      { name: 'tail-visible', yaw: 60, pitch: 0, roll: 0 },
    ];

    for (const s of shots) {
      await setAngles(page, s.yaw, s.pitch, s.roll);
      await page.screenshot({
        path: `artifacts/3d-spindle-whale/spindle-${s.name}.png`,
      });
    }

    await context.close();
  });
});
