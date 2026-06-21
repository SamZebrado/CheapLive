/**
 * 视觉测试：验证萨卡班甲鱼在不同旋转角度下的可见性
 * 
 * 运行方式：
 *   node tests/e2e/verify-face-rotation-fix.test.js
 * 
 * 需要先启动本地服务器：
 *   python3 -m http.server 8000 --directory src/face-tracking
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:8000';
const OUTPUT_DIR = './artifacts/rotation-fix-verification';

async function run() {
  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 }
  });
  const page = await context.newPage();

  console.log('正在加载页面...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // 等待 canvas 渲染
  await page.waitForTimeout(1000);

  // 检查是否有 avatar 控件
  const avatarExists = await page.$('#avatarCanvas') !== null;
  console.log(`Avatar canvas 存在: ${avatarExists}`);

  // 测试不同旋转角度
  const testAngles = [0, 30, 45, 60, -30, -45, -60];

  for (const angle of testAngles) {
    console.log(`\n测试 yaw=${angle}°...`);

    // 使用测试按钮设置角度
    // 注意：需要根据实际页面上的按钮 ID 来设置
    // 这里我们通过 evaluate 直接调用渲染器的 updateParams
    await page.evaluate((yaw) => {
      const ft = window._faceTracker;
      if (ft && ft.avatar) {
        ft.avatar.updateParams({
          headYaw: 0.5 + (yaw / 120),  // 转换为 [0,1] 范围
          headPitch: 0.5,
          headRoll: 0.5,
        });
      }
    }, angle);

    await page.waitForTimeout(500);

    // 截图
    const screenshotPath = path.join(OUTPUT_DIR, `yaw-${angle}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  截图已保存: ${screenshotPath}`);
  }

  await browser.close();
  console.log('\n测试完成！');
  console.log(`截图保存在: ${OUTPUT_DIR}`);
}

run().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
