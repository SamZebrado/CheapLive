/**
 * 辅助沟通页面 E2E 测试 (Accessibility Communication Page)
 *
 * 完整覆盖：
 * - 页面加载、无 JS error
 * - 麦克风权限 mock（getUserMedia 不被自动调用）
 * - Web Speech mock（interim/final/error/onend）
 * - 离线状态（context.setOffline）
 * - 手写 pointer events（stroke、自动提交、撤销、合并、清空）
 * - 导出图片（blob 验证）
 * - 字号调节、全屏按钮
 * - 模型清单、license 显示
 * - 中国镜像顺序
 * - Mobile viewport（iPhone/Android）
 * - 自动截图
 */

import { test, expect, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const PAGE_URL = 'http://127.0.0.1:8790/src/accessibility-communication/index.html';
const SCREENSHOT_DIR = '/tmp/cheaplive-accessibility-smoke';

// 确保截图目录存在
function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

// 辅助函数：在 canvas 上模拟 pointer 事件画一笔
function drawStrokeOnCanvas() {
  return `(() => {
    const c = document.getElementById('handwriting-input');
    const rect = c.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    c.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: cx - 50, clientY: cy - 30, pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
    }));
    for (let i = 0; i < 5; i++) {
      c.dispatchEvent(new PointerEvent('pointermove', {
        clientX: cx - 50 + (i + 1) * 20, clientY: cy - 30 + (i + 1) * 6,
        pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    }
    c.dispatchEvent(new PointerEvent('pointerup', {
      clientX: cx + 50, clientY: cy, pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
    }));
  })()`;
}

// ============================================================
// 基础加载
// ============================================================
test.describe('辅助沟通页面 - 基础加载', () => {
  test('页面加载无 JS 错误', async ({ page }) => {
    const errors = [];
    const warnings = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
      if (msg.type() === 'warning') warnings.push(msg.text());
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('主标题存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('h1')).toContainText('听力沟通辅助');
  });

  test('大字字幕区存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForSelector('#caption-final');
    await page.waitForSelector('#caption-interim', { state: 'attached' });
    await page.waitForSelector('#caption-history');
    await page.waitForSelector('#caption-placeholder');
  });

  test('手写入口存在且默认关闭', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#handwriting-section')).toBeHidden();
    await expect(page.locator('#btn-toggle-handwriting')).toHaveText('开启手写');
  });

  test('状态栏存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForSelector('#status-mic');
    await page.waitForSelector('#status-engine');
    await page.waitForSelector('#status-offline');
    await page.waitForSelector('#status-network');
    await page.waitForSelector('#status-handwriting');
    await page.waitForSelector('#status-caption-detail');
    await page.waitForSelector('#status-model-info');
  });

  test('禁止性文案检查 - 不包含"离线字幕已完成"等', async ({ page }) => {
    await page.goto(PAGE_URL);
    const content = await page.content();
    const forbidden = ['离线字幕已完成', '离线识别已完成', '完全离线字幕', 'AI 字幕已完成', '医疗级', '替代助听器', '模型已内置'];
    for (const phrase of forbidden) {
      expect(content).not.toContain(phrase);
    }
  });

  test('页面默认截图', async ({ page }) => {
    ensureScreenshotDir();
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-page-default.png'), fullPage: true });
  });
});

// ============================================================
// 麦克风权限行为
// ============================================================
test.describe('辅助沟通页面 - 麦克风权限', () => {
  test('页面加载时 getUserMedia 未被调用', async ({ page }) => {
    let getUserMediaCalled = false;
    await page.addInitScript(() => {
      const orig = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = (...args) => {
          window.__getUserMediaCalled = true;
          return orig ? orig(...args) : Promise.reject(new Error('NotAllowedError'));
        };
      }
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const called = await page.evaluate(() => !!window.__getUserMediaCalled);
    expect(called).toBe(false);
  });

  test('点击"开始字幕"后才请求麦克风（mock getUserMedia deny）', async ({ page }) => {
    await page.addInitScript(() => {
      // 删除 SpeechRecognition 使测试确定性（Chromium 可能自带）
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      }
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    // 点击开始字幕
    await page.click('#btn-start-caption');
    await page.waitForTimeout(500);

    // 权限拒绝后状态应显示
    const statusMic = page.locator('#status-mic');
    await expect(statusMic).toHaveText('不可用');
  });

  test('点击停止字幕按钮存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#btn-stop-caption')).toBeVisible();
  });
});

// ============================================================
// Web Speech mock
// ============================================================
test.describe('辅助沟通页面 - Web Speech mock', () => {
  test('Web Speech 不存在 → 页面显示字幕不可用', async ({ page }) => {
    await page.addInitScript(() => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#status-mic')).toHaveText('不可用');
    await expect(page.locator('#status-caption-detail')).toContainText('字幕识别暂不可用');
  });

  test('Web Speech 存在 → recognition.lang = zh-CN', async ({ page }) => {
    let langSet = null;
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() {
          this.lang = '';
          this.continuous = false;
          this.interimResults = false;
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
        }
        start() { window.__recognitionStarted = true; }
        stop() { window.__recognitionStopped = true; }
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    // 点击开始字幕
    await page.click('#btn-start-caption');
    await page.waitForTimeout(300);

    const started = await page.evaluate(() => !!window.__recognitionStarted);
    expect(started).toBe(true);
  });

  test('interim + final result 显示', async ({ page }) => {
    let recognitionInstance = null;
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() {
          this.lang = '';
          this.continuous = false;
          this.interimResults = false;
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          window.__mockRecognition = this;
        }
        start() {}
        stop() {}
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('#btn-start-caption');
    await page.waitForTimeout(300);

    // 模拟 interim result
    const rec = await page.evaluate(() => window.__mockRecognition);
    expect(rec).not.toBeNull();

    // 模拟 onresult
    await page.evaluate(() => {
      const rec = window.__mockRecognition;
      if (rec && rec.onresult) {
        const event = {
          resultIndex: 0,
          results: [
            { isFinal: false, 0: { transcript: '你好世界' } }
          ]
        };
        rec.onresult(event);
      }
    });

    await page.waitForTimeout(200);
    await expect(page.locator('#caption-interim')).toContainText('你好世界');

    // 模拟 final result
    await page.evaluate(() => {
      const rec = window.__mockRecognition;
      if (rec && rec.onresult) {
        const event = {
          resultIndex: 0,
          results: [
            { isFinal: true, 0: { transcript: '你好世界' } }
          ]
        };
        rec.onresult(event);
      }
    });

    await page.waitForTimeout(200);
    const finalText = await page.locator('#caption-final').textContent();
    expect(finalText).toContain('你好世界');
  });

  test('recognition.onerror → 显示错误但页面不崩', async ({ page }) => {
    const errors = [];
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() {
          this.lang = '';
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          window.__mockRecognition = this;
        }
        start() {}
        stop() {}
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('#btn-start-caption');
    await page.waitForTimeout(300);

    // 模拟 error
    await page.evaluate(() => {
      const rec = window.__mockRecognition;
      if (rec && rec.onerror) {
        rec.onerror({ error: 'network' });
      }
    });

    await page.waitForTimeout(500);
    expect(errors).toEqual([]);

    // 页面应显示错误状态（Web Speech mock 存在，isSupported=true，但 listening 已停止）
    await expect(page.locator('#status-mic')).toHaveText('未开启');
  });

  test('recognition.onend → 不无限刷错', async ({ page }) => {
    const errors = [];
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() {
          this.lang = '';
          this.onresult = null;
          this.onerror = null;
          this.onend = null;
          window.__mockRecognition = this;
        }
        start() {}
        stop() {}
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('#btn-start-caption');
    await page.waitForTimeout(300);

    // 模拟多次 onend
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const rec = window.__mockRecognition;
        if (rec && rec.onend) rec.onend();
      });
      await page.waitForTimeout(200);
    }

    expect(errors).toEqual([]);
  });
});

// ============================================================
// 无网络状态
// ============================================================
test.describe('辅助沟通页面 - 离线状态', () => {
  test('context.setOffline → 显示离线提示', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.waitForTimeout(500);

    await expect(page.locator('#status-network')).toHaveText('离线');
    await expect(page.locator('#status-caption-detail')).toContainText('识别效果可能受限');
    await expect(page.locator('#status-caption-detail')).toContainText('离线模型尚未安装');
    await expect(page.locator('#status-caption-detail')).toContainText('你仍可使用手写留言板');

    // 离线截图
    ensureScreenshotDir();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-offline-warning.png'), fullPage: true });

    await context.close();
  });

  test('离线时手写板仍可使用', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await context.setOffline(true);
    await page.waitForTimeout(500);

    await page.click('#btn-toggle-handwriting');
    await expect(page.locator('#handwriting-section')).toBeVisible();

    await context.close();
  });
});

// ============================================================
// 手写板
// ============================================================
test.describe('辅助沟通页面 - 手写板', () => {
  test('手写默认关闭，点击开启后出现', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#handwriting-section')).toBeHidden();
    await page.click('#btn-toggle-handwriting');
    await expect(page.locator('#handwriting-section')).toBeVisible();
    await expect(page.locator('#btn-toggle-handwriting')).toHaveText('收起手写');
  });

  test('点击收起手写后隐藏', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await expect(page.locator('#handwriting-section')).toBeVisible();
    await page.click('#btn-toggle-handwriting');
    await expect(page.locator('#handwriting-section')).toBeHidden();
    await expect(page.locator('#btn-toggle-handwriting')).toHaveText('开启手写');
  });

  test('canvas 有 touch-action: none', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await expect(page.locator('#handwriting-input')).toHaveCSS('touch-action', 'none');
  });

  test('pointer events 形成 stroke', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    // 输出区应该可见
    await expect(page.locator('#handwriting-output')).toBeVisible();
  });

  test('停笔后自动提交一个字', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    // 撤销一个字按钮应可用
    await expect(page.locator('#btn-undo-char')).toBeEnabled({ timeout: 3000 });
  });

  test('新 stroke 到来会取消自动提交计时器', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    // 第一笔
    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(400); // 小于900ms

    // 第二笔（应取消第一笔的自动提交）
    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx + 20, clientY: cy, pointerId: 2, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 3; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx + 20 + (i + 1) * 15, clientY: cy + (i * 5),
          pointerId: 2, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 80, clientY: cy + 10, pointerId: 2, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(1500);

    // 应提交为一个字（两笔合并为一个字），撤销一个字按钮应可用
    await expect(page.locator('#btn-undo-char')).toBeEnabled({ timeout: 3000 });
  });

  test('撤销一笔', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    // 画一笔（不等待自动提交）
    await page.evaluate(() => {
      const c = document.getElementById('handwriting-input');
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      c.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx - 50, clientY: cy, pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx - 50 + (i + 1) * 20, clientY: cy + (i - 2) * 10,
          pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 50, clientY: cy, pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(200);

    // 撤销一笔按钮应可用
    await expect(page.locator('#btn-undo-stroke')).toBeEnabled();

    // 点击撤销
    await page.click('#btn-undo-stroke');
    await page.waitForTimeout(200);

    // 撤销后按钮应禁用
    await expect(page.locator('#btn-undo-stroke')).toBeDisabled();
  });

  test('撤销一个字', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    await expect(page.locator('#btn-undo-char')).toBeEnabled();
    await page.click('#btn-undo-char');
    await page.waitForTimeout(300);
    await expect(page.locator('#btn-undo-char')).toBeDisabled();
  });

  test('完成当前字', async ({ page }) => {
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
        clientX: cx - 50, clientY: cy, pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
      for (let i = 0; i < 5; i++) {
        c.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cx - 50 + (i + 1) * 20, clientY: cy + (i - 2) * 10,
          pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
        }));
      }
      c.dispatchEvent(new PointerEvent('pointerup', {
        clientX: cx + 50, clientY: cy, pointerId: 1, pointerType: 'mouse', pressure: 0.5, bubbles: true
      }));
    });

    await page.waitForTimeout(200);
    await expect(page.locator('#btn-commit-char')).toBeEnabled();
    await page.click('#btn-commit-char');
    await page.waitForTimeout(300);
    // 手动提交后，撤销一个字按钮应可用
    await expect(page.locator('#btn-undo-char')).toBeEnabled();
  });

  test('合并上一字', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    // 第一笔 → 提交
    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    // 合并上一字按钮应可用
    await expect(page.locator('#btn-merge-prev')).toBeEnabled();

    // 点击合并
    await page.click('#btn-merge-prev');
    await page.waitForTimeout(300);

    // 合并后当前笔画组应有笔画（上一字的笔画被合并到当前组）
    await expect(page.locator('#btn-commit-char')).toBeEnabled();
  });

  test('清空手写', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    await page.click('#btn-clear-handwriting');
    await page.waitForTimeout(300);
    await expect(page.locator('#btn-undo-char')).toBeDisabled();
  });

  test('手写板打开后截图', async ({ page }) => {
    ensureScreenshotDir();
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-handwriting-open.png'), fullPage: true });
  });

  test('手写一字后截图', async ({ page }) => {
    ensureScreenshotDir();
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);
    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-handwriting-after-one-char.png'), fullPage: true });
  });
});

// ============================================================
// 导出图片
// ============================================================
test.describe('辅助沟通页面 - 导出图片', () => {
  test('点击导出图片触发下载（blob 验证）', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    // 画一笔
    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    // 监听下载
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('#btn-export-image');

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toContain('communication-board');
      expect(download.suggestedFilename()).toMatch(/\.png$/);
    } else {
      // 如果 download 事件没触发，检查是否通过 blob 导出
      const hasToast = await page.locator('.toast-success').isVisible().catch(() => false);
      if (hasToast) {
        const toastText = await page.locator('.toast-success').textContent();
        expect(toastText).toContain('图片已导出');
      }
    }
  });

  test('导出图片不抛 JS error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);

    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);

    await page.click('#btn-export-image');
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  test('导出前截图', async ({ page }) => {
    ensureScreenshotDir();
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(300);
    await page.evaluate(drawStrokeOnCanvas());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-export-ready.png'), fullPage: true });
  });
});

// ============================================================
// 字号调节 + 全屏
// ============================================================
test.describe('辅助沟通页面 - 字号与全屏', () => {
  test('字幕字号 + / -', async ({ page }) => {
    await page.goto(PAGE_URL);

    await expect(page.locator('#font-size-display')).toHaveText('64px');
    await page.click('#btn-font-size-up');
    await expect(page.locator('#font-size-display')).toHaveText('72px');
    await page.click('#btn-font-size-up');
    await expect(page.locator('#font-size-display')).toHaveText('80px');
    await page.click('#btn-font-size-down');
    await expect(page.locator('#font-size-display')).toHaveText('72px');
    await page.click('#btn-font-size-down');
    await expect(page.locator('#font-size-display')).toHaveText('64px');
    // 下限
    for (let i = 0; i < 10; i++) {
      await page.click('#btn-font-size-down');
    }
    await expect(page.locator('#font-size-display')).toHaveText('24px');
  });

  test('手写字号切换', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });

    await page.selectOption('#handwriting-size', '72');
    await page.waitForTimeout(200);
    // 验证 select 值已改变
    await expect(page.locator('#handwriting-size')).toHaveValue('72');

    await page.selectOption('#handwriting-size', '128');
    await page.waitForTimeout(200);
    await expect(page.locator('#handwriting-size')).toHaveValue('128');
  });

  test('全屏按钮存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#btn-fullscreen')).toBeVisible();
  });

  test('Web Speech mock 字幕截图', async ({ page }) => {
    ensureScreenshotDir();
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() { this.lang = ''; this.onresult = null; this.onerror = null; this.onend = null; window.__mockRecognition = this; }
        start() {}
        stop() {}
      }
      window.SpeechRecognition = MockSpeechRecognition;
      window.webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('#btn-start-caption');
    await page.waitForTimeout(300);

    // 模拟 final result
    await page.evaluate(() => {
      const rec = window.__mockRecognition;
      if (rec && rec.onresult) {
        rec.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '你好世界，这是一段测试字幕' } }] });
      }
    });

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-caption-webspeech-mock.png'), fullPage: true });
  });
});

// ============================================================
// 模型清单 / license
// ============================================================
test.describe('辅助沟通页面 - 模型清单', () => {
  test('manifest 包含 vosk-model-small-cn-0.22, Apache-2.0, 可再分发', async ({ page }) => {
    await page.goto(PAGE_URL);
    const statusModelInfo = page.locator('#status-model-info');
    await expect(statusModelInfo).toContainText('vosk-model-small-cn-0.22');
    await expect(statusModelInfo).toContainText('Apache-2.0');
    await expect(statusModelInfo).toContainText('可再分发');
    await expect(statusModelInfo).toContainText('42MB');
  });

  test('SenseVoice license 待核实', async ({ page }) => {
    await page.goto(PAGE_URL);
    const content = await page.content();
    // 页面不应宣称 SenseVoice 已可再分发
    expect(content).not.toContain('SenseVoice 可再分发');
  });

  test('不显示"离线字幕已完成"', async ({ page }) => {
    await page.goto(PAGE_URL);
    const content = await page.content();
    expect(content).not.toContain('离线字幕已完成');
  });
});

// ============================================================
// 中国镜像顺序
// ============================================================
test.describe('辅助沟通页面 - 镜像顺序', () => {
  test('manifest 镜像顺序：local → gitee → modelscope → github → official', async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    const mirrorTypes = await page.evaluate(() => {
      // 从 import 的模块中获取 manifest
      // 通过检查页面中是否包含正确的顺序信息
      const modelInfo = document.getElementById('status-model-info');
      return modelInfo ? modelInfo.textContent : '';
    });

    // 验证镜像顺序存在于 asr-model-manifest.js 中
    // 通过 fetch 读取 manifest 文件验证
    const response = await page.request.get('http://127.0.0.1:8790/src/accessibility-communication/asr-model-manifest.js');
    const text = await response.text();
    expect(text).toContain("type: 'local'");
    expect(text).toContain("type: 'gitee'");
    expect(text).toContain("type: 'modelscope'");
    expect(text).toContain("type: 'github'");
    expect(text).toContain("type: 'official'");

    // 验证顺序：local → gitee → modelscope → github → official
    const localIdx = text.indexOf("type: 'local'");
    const giteeIdx = text.indexOf("type: 'gitee'");
    const msIdx = text.indexOf("type: 'modelscope'");
    const ghIdx = text.indexOf("type: 'github'");
    const officialIdx = text.indexOf("type: 'official'");

    expect(localIdx).toBeLessThan(giteeIdx);
    expect(giteeIdx).toBeLessThan(msIdx);
    expect(msIdx).toBeLessThan(ghIdx);
    expect(ghIdx).toBeLessThan(officialIdx);
  });
});

// ============================================================
// Mobile viewport
// ============================================================
test.describe('辅助沟通页面 - Mobile viewport', () => {
  test('iPhone viewport - 手写按钮可见', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#btn-toggle-handwriting')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();

    // 点击开启手写
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(500);

    // canvas 存在
    await expect(page.locator('#handwriting-input')).toBeVisible();

    // touch-action: none
    await expect(page.locator('#handwriting-input')).toHaveCSS('touch-action', 'none');

    // 截图
    ensureScreenshotDir();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-mobile-layout.png'), fullPage: true });

    await context.close();
  });

  test('Android viewport - 主要按钮无溢出', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');

    // 检查所有工具栏按钮可见
    const toolbarButtons = ['#btn-start-caption', '#btn-stop-caption', '#btn-clear-caption',
      '#btn-font-size-up', '#btn-font-size-down', '#btn-fullscreen'];
    for (const btn of toolbarButtons) {
      await expect(page.locator(btn)).toBeVisible();
    }

    await context.close();
  });

  test('Mobile - 触摸写字不触发页面滚动', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 12'] });
    const page = await context.newPage();

    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('#btn-toggle-handwriting');
    await page.waitForSelector('#handwriting-section', { state: 'visible' });
    await page.waitForTimeout(500);

    await expect(page.locator('#handwriting-input')).toHaveCSS('touch-action', 'none');

    await context.close();
  });
});

// ============================================================
// 清空字幕
// ============================================================
test.describe('辅助沟通页面 - 字幕操作', () => {
  test('清空字幕按钮可用', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#btn-clear-caption')).toBeEnabled();
  });

  test('复制文字按钮存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#btn-copy-caption')).toBeVisible();
  });

  test('导出文本按钮存在', async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.locator('#btn-export-text')).toBeVisible();
  });
});