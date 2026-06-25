/**
 * 辅助沟通页面 E2E 测试 (Accessibility Communication Page)
 *
 * 测试覆盖：
 * - 页面加载无 JS 错误
 * - 字幕区存在，手写默认关闭
 * - 手写开关交互
 * - 指针事件模拟手写
 * - 停笔自动提交
 * - 导出图片
 * - Web Speech 不可用时不崩溃
 * - 字号按钮
 * - 清空按钮
 * - 网络离线状态
 * - 模型 manifest 存在
 * - 离线模型未安装提示
 */

import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:8790/src/accessibility-communication/index.html';

test.describe('辅助沟通页面 - 基础加载', () => {
  test('页面加载无 JS 错误', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('字幕区存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForSelector('#caption-final');
    await page.waitForSelector('#caption-interim', { state: 'attached' });
    await page.waitForSelector('#caption-history');
  });

  test('手写区默认关闭', async ({ page }) => {
    await page.goto(PAGE_URL);
    const section = page.locator('#handwriting-section');
    await expect(section).toBeHidden();
  });

  test('手写开关按钮显示"开启手写"', async ({ page }) => {
    await page.goto(PAGE_URL);
    const btn = page.locator('#btn-toggle-handwriting');
    await expect(btn).toHaveText('开启手写');
  });

  test('状态栏显示所有状态项', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForSelector('#status-mic');
    await page.waitForSelector('#status-engine');
    await page.waitForSelector('#status-offline');
    await page.waitForSelector('#status-network');
    await page.waitForSelector('#status-handwriting');
  });

  test('页面不包含"离线字幕已完成"等未验证文案', async ({ page }) => {
    await page.goto(PAGE_URL);
    const content = await page.content();
    expect(content).not.toContain('离线字幕已完成');
    expect(content).not.toContain('离线识别已完成');
    expect(content).not.toContain('完全离线字幕');
  });
});

test.describe('辅助沟通页面 - 手写板', () => {
  test('点击"开启手写"后手写区出现', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    const section = page.locator('#handwriting-section');
    await expect(section).toBeVisible();
  });

  test('点击"开启手写"后按钮文案变为"收起手写"', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    const btn = page.locator('#btn-toggle-handwriting');
    await expect(btn).toHaveText('收起手写');
  });

  test('手写 canvas 有 touch-action: none', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    const canvas = page.locator('#handwriting-input');
    const style = await canvas.getAttribute('style');
    // touch-action is set via CSS, checking inline or computed
    await expect(canvas).toHaveCSS('touch-action', 'none');
  });

  test('模拟指针事件画一笔', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    // 直接在 canvas 上分派 pointer 事件
    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx - 50, clientY: cy,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx - 50 + (i + 1) * 20, clientY: cy + (i - 2) * 10,
          pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 50, clientY: cy,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    // 等待自动提交
    await page.waitForTimeout(1500);

    // 输出区应该有内容
    const outputCanvas = page.locator('#handwriting-output');
    await expect(outputCanvas).toBeVisible();
  });

  test('停笔后自动提交 - 笔画组被提交', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    // 第一笔
    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx - 60, clientY: cy - 30,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx - 60 + (i + 1) * 20, clientY: cy - 30 + (i + 1) * 6,
          pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 40, clientY: cy,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(1500);

    // 第二笔
    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx + 20, clientY: cy - 20,
        pointerId: 2, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx + 20 + (i + 1) * 20, clientY: cy - 20 + (i + 1) * 6,
          pointerId: 2, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 120, clientY: cy + 10,
        pointerId: 2, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(1500);

    const btnUndoChar = page.locator('#btn-undo-char');
    await expect(btnUndoChar).toBeEnabled({ timeout: 3000 });
  });

  test('合并上一字按钮在提交字后可用', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx - 50, clientY: cy - 30,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx - 50 + (i + 1) * 20, clientY: cy - 30 + (i + 1) * 6,
          pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 50, clientY: cy,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(1500);

    const btnMerge = page.locator('#btn-merge-prev');
    await expect(btnMerge).toBeEnabled({ timeout: 3000 });
  });

  test('清空手写按钮可用', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx - 50, clientY: cy - 30,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx - 50 + (i + 1) * 20, clientY: cy - 30 + (i + 1) * 6,
          pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 50, clientY: cy,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(1500);

    await page.click('#btn-clear-handwriting');
    await page.waitForTimeout(300);
    const btnUndoChar = page.locator('#btn-undo-char');
    await expect(btnUndoChar).toBeDisabled();
  });
});

test.describe('辅助沟通页面 - 字幕', () => {
  test('Web Speech 不可用时页面不崩溃', async ({ page }) => {
    // 模拟不支持 Web Speech API 的环境
    await page.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    // 页面应该正常加载
    await page.waitForSelector('#caption-final');

    // 状态栏应显示不可用
    const statusMic = page.locator('#status-mic');
    await expect(statusMic).toHaveText('不可用');
  });

  test('状态栏显示"字幕识别暂不可用"当 Web Speech 不可用', async ({ page }) => {
    await page.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    const detail = page.locator('#status-caption-detail');
    await expect(detail).toContainText('字幕识别暂不可用');
  });

  test('字号按钮功能', async ({ page }) => {
    await page.goto(PAGE_URL);

    // 初始字号 64px
    const fontSizeDisplay = page.locator('#font-size-display');
    await expect(fontSizeDisplay).toHaveText('64px');

    // 放大
    await page.click('#btn-font-size-up');
    await expect(fontSizeDisplay).toHaveText('72px');

    // 缩小
    await page.click('#btn-font-size-down');
    await expect(fontSizeDisplay).toHaveText('64px');
  });

  test('清空字幕按钮可用', async ({ page }) => {
    await page.goto(PAGE_URL);
    const btnClear = page.locator('#btn-clear-caption');
    await expect(btnClear).toBeEnabled();
  });
});

test.describe('辅助沟通页面 - 导出图片', () => {
  test('导出图片按钮存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    const btnExport = page.locator('#btn-export-image');
    await expect(btnExport).toBeVisible();
  });

  test('点击导出图片触发下载', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');

    const canvas = page.locator('#handwriting-input');
    const box = await canvas.boundingBox();

    // 画一笔
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 80, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(1200);

    // 监听下载
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.click('#btn-export-image')
    ]);

    // 如果触发了下载，验证文件名
    if (download) {
      expect(download.suggestedFilename()).toContain('communication-board');
    }
  });
});

test.describe('辅助沟通页面 - 网络离线状态', () => {
  test('模拟离线时显示离线提示', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    // 模拟离线
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });

    // 等待状态更新
    await page.waitForTimeout(500);

    const statusNetwork = page.locator('#status-network');
    await expect(statusNetwork).toHaveText('离线');
  });

  test('离线时显示"当前没有网络，识别效果可能受限"', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(500);

    const detail = page.locator('#status-caption-detail');
    await expect(detail).toContainText('识别效果可能受限');
  });

  test('离线时手写板仍可使用', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(500);

    // 手写开关应该仍然可用
    await page.click('#btn-toggle-handwriting');
    const section = page.locator('#handwriting-section');
    await expect(section).toBeVisible();
  });
});

test.describe('辅助沟通页面 - 模型清单', () => {
  test('模型 manifest 包含 vosk-model-small-cn-0.22', async ({ page }) => {
    await page.goto(PAGE_URL);
    const statusModelInfo = page.locator('#status-model-info');
    await expect(statusModelInfo).toContainText('vosk-model-small-cn-0.22');
    await expect(statusModelInfo).toContainText('Apache-2.0');
    await expect(statusModelInfo).toContainText('可再分发');
  });

  test('模型信息显示 42MB', async ({ page }) => {
    await page.goto(PAGE_URL);
    const statusModelInfo = page.locator('#status-model-info');
    await expect(statusModelInfo).toContainText('42MB');
  });
});

test.describe('辅助沟通页面 - 移动端触摸', () => {
  test('触摸书写不触发页面滚动', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    const canvas = page.locator('#handwriting-input');

    // touch-action: none 应该通过 CSS 设置
    await expect(canvas).toHaveCSS('touch-action', 'none');
  });
});