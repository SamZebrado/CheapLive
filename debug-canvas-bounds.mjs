import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const canvas = document.getElementById('avatarCanvas');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let topRow = -1, bottomRow = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] > 10 || data[i+1] > 10 || data[i+2] > 10) {
          if (topRow === -1) topRow = y;
          bottomRow = y;
        }
      }
    }

    let leftCol = canvas.width, rightCol = 0;
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] > 10 || data[i+1] > 10 || data[i+2] > 10) {
          leftCol = Math.min(leftCol, x);
          rightCol = Math.max(rightCol, x);
        }
      }
    }

    return {
      canvasSize: { w: canvas.width, h: canvas.height },
      cssRect: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
      contentBounds: { top: topRow, bottom: bottomRow, left: leftCol, right: rightCol },
      expectedCenter: canvas.height / 2,
      expectedFoot: canvas.height / 2 + 115,
    };
  });

  console.log('Canvas info:', JSON.stringify(info, null, 2));
  console.log('\nAnalysis:');
  console.log('- Content spans rows:', info.contentBounds.top, 'to', info.contentBounds.bottom, 'in canvas');
  console.log('- Canvas height:', info.canvasSize.h);
  console.log('- Content uses', Math.round((info.contentBounds.bottom - info.contentBounds.top) / info.canvasSize.h * 100), '% of canvas height');
  console.log('- Expected avatar foot at canvas row:', info.expectedFoot, '(', Math.round(info.expectedFoot / info.canvasSize.h * 100), '% from top)');

  await browser.close();
})();
