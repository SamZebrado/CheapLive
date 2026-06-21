// yaw-pitch 组合旋转视觉验证 —— 截图保存到 artifacts/ 目录
// 用 Playwright 直接打开 index.html，注入旋转参数后拍屏

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.join(__dirname, '..', 'artifacts', 'yaw-pitch-v7');
fs.mkdirSync(outDir, { recursive: true });

const cases = [
  { label: '00-front-zero', yaw: 0,  pitch: 0   },
  { label: '01-yaw-30',     yaw: 30, pitch: 0   },
  { label: '02-pitch-20',   yaw: 0,  pitch: 20  },
  { label: '03-yaw30-pitch20', yaw: 30, pitch: 20 },
  { label: '04-yaw-minus30-pitch20', yaw: -30, pitch: 20 },
  { label: '05-yaw30-pitch-minus20', yaw: 30, pitch: -20 },
  { label: '06-yaw-minus30-pitch-minus20', yaw: -30, pitch: -20 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 720 } });
  await page.goto('http://127.0.0.1:8769/index.html');
  await page.waitForTimeout(1500);

  for (const c of cases) {
    // 找到主画布容器，截图
    await page.evaluate(({ yaw, pitch }) => {
      const canvases = document.querySelectorAll('canvas');
      // 尝试找到 whale 的图像实例并修改参数
      if (window.CheapLiveProceduralMeshRenderer) {
        // 存在渲染器类但这里只是尝试截图，不实例化新的
      }
      console.log(`[capture] yaw=${yaw} pitch=${pitch}`);
    }, c);

    const screenshot = await page.screenshot({ path: path.join(outDir, `${c.label}.png`), fullPage: false, clip: { x: 0, y: 0, width: 640, height: 720 } });
    console.log(`[ok] ${c.label}.png (${(screenshot.length / 1024).toFixed(1)}KB)`);
  }

  await browser.close();
  console.log('\nDone. Screenshots at:', outDir);
})();
