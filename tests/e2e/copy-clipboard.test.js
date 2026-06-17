/**
 * CheapLive copyToClipboard E2E Tests
 *
 * Tests the copyToClipboard function and fallback behavior
 * via page.evaluate() in a real browser context.
 */

const { test, expect } = require('playwright/test');

/**
 * 在页面中注入 copyToClipboard 及相关辅助函数
 * 因为该函数定义在 multi-device.js 模块中，测试页面需要重新注入
 */
async function injectCopyFunctions(page) {
  await page.evaluate(() => {
    window.copyToClipboard = function (text, btnId) {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showCopyResult(btn, true);
        }).catch(() => {
          const success = fallbackCopy(text);
          showCopyResult(btn, success);
        });
      } else {
        const success = fallbackCopy(text);
        showCopyResult(btn, success);
      }
    };

    window.fallbackCopy = function (text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(textarea);

      const selection = document.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textarea);
      selection.removeAllRanges();
      selection.addRange(range);

      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (err) {
        success = false;
      }

      selection.removeAllRanges();
      document.body.removeChild(textarea);
      return success;
    };

    window.showCopyResult = function (btn, success) {
      if (success) {
        btn.textContent = '已复制';
      } else {
        btn.textContent = '复制失败';
        showManualCopyHint(btn);
      }
      setTimeout(() => {
        btn.textContent = '复制';
      }, 2000);
    };

    window.showManualCopyHint = function (btn) {
      let hint = btn.parentElement.querySelector('.copy-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'copy-hint';
        hint.style.cssText = 'margin-top:4px;font-size:12px;color:#ff6b4a;';
        btn.parentElement.appendChild(hint);
      }
      hint.textContent = '浏览器禁止自动复制，请长按下方地址手动复制';
      setTimeout(() => {
        if (hint) hint.textContent = '';
      }, 5000);
    };
  });
}

/**
 * 创建测试按钮和容器
 */
async function createTestButton(page, btnId) {
  await page.evaluate((id) => {
    const container = document.createElement('div');
    container.id = 'test-container';
    container.style.cssText = 'padding:20px;';

    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = '复制';
    btn.style.cssText = 'padding:8px 16px;';

    container.appendChild(btn);
    document.body.appendChild(container);
  }, btnId);
}

/**
 * 清理测试 DOM
 */
async function cleanupTestDOM(page) {
  await page.evaluate(() => {
    const container = document.getElementById('test-container');
    if (container) container.remove();
    const hints = document.querySelectorAll('.copy-hint');
    hints.forEach(h => h.remove());
  });
}

test.describe('copyToClipboard', () => {
  test.beforeEach(async ({ page }) => {
    // 打开一个空白页面用于测试
    await page.goto('about:blank');
    await injectCopyFunctions(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestDOM(page);
  });

  test('navigator.clipboard succeeds', async ({ page }) => {
    const btnId = 'copyBtn-clipboard-success';
    await createTestButton(page, btnId);

    // 模拟成功的 clipboard API
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.resolve(),
        },
        configurable: true,
      });
    });

    // 执行复制
    await page.evaluate((id) => {
      window.copyToClipboard('test-content-123', id);
    }, btnId);

    // 断言按钮文本变为 "已复制"
    await expect(page.locator(`#${btnId}`)).toHaveText('已复制', { timeout: 3000 });

    // 2 秒后应恢复为 "复制"
    await page.waitForTimeout(2100);
    await expect(page.locator(`#${btnId}`)).toHaveText('复制');
  });

  test('navigator.clipboard fails, execCommand succeeds', async ({ page }) => {
    const btnId = 'copyBtn-clipboard-fail-exec-success';
    await createTestButton(page, btnId);

    // 模拟 clipboard API 失败，但 execCommand 成功
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new Error('Clipboard denied')),
        },
        configurable: true,
      });
      document.execCommand = () => true;
    });

    await page.evaluate((id) => {
      window.copyToClipboard('test-content-456', id);
    }, btnId);

    // 降级到 execCommand 成功，应显示 "已复制"
    await expect(page.locator(`#${btnId}`)).toHaveText('已复制', { timeout: 3000 });
  });

  test('both fail -> shows manual hint', async ({ page }) => {
    const btnId = 'copyBtn-both-fail';
    await createTestButton(page, btnId);

    // 模拟 clipboard API 和 execCommand 都失败
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new Error('Clipboard denied')),
        },
        configurable: true,
      });
      document.execCommand = () => false;
    });

    await page.evaluate((id) => {
      window.copyToClipboard('test-content-789', id);
    }, btnId);

    // 应显示 "复制失败"
    await expect(page.locator(`#${btnId}`)).toHaveText('复制失败', { timeout: 3000 });

    // 应出现手动复制提示
    await page.waitForFunction(() => {
      const hint = document.querySelector('.copy-hint');
      return hint && hint.textContent.includes('手动复制');
    }, { timeout: 3000 });

    const hintText = await page.locator('.copy-hint').textContent();
    expect(hintText).toContain('浏览器禁止自动复制');
  });

  test('URL content is correct', async ({ page }) => {
    const btnId = 'copyBtn-url-content';
    await createTestButton(page, btnId);

    let capturedText = null;

    // 拦截 clipboard.writeText 以捕获写入内容
    await page.evaluate(() => {
      window.__capturedClipboardText = null;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (text) => {
            window.__capturedClipboardText = text;
            return Promise.resolve();
          },
        },
        configurable: true,
      });
    });

    const testUrl = 'http://192.168.1.100:8765/src/multi-device/index.html';
    await page.evaluate(({ url, id }) => {
      window.copyToClipboard(url, id);
    }, { url: testUrl, id: btnId });

    // 等待复制完成
    await expect(page.locator(`#${btnId}`)).toHaveText('已复制', { timeout: 3000 });

    // 验证写入 clipboard 的内容正确
    capturedText = await page.evaluate(() => window.__capturedClipboardText);
    expect(capturedText).toBe(testUrl);
  });

  test('fallbackCopy copies text to clipboard via execCommand', async ({ page }) => {
    const btnId = 'copyBtn-fallback-direct';
    await createTestButton(page, btnId);

    // 移除 clipboard API，强制走 fallback
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });
      document.execCommand = () => true;
    });

    await page.evaluate((id) => {
      window.copyToClipboard('direct-fallback-text', id);
    }, btnId);

    await expect(page.locator(`#${btnId}`)).toHaveText('已复制', { timeout: 3000 });
  });

  test('showCopyResult timeout restores button text', async ({ page }) => {
    const btnId = 'copyBtn-timeout';
    await createTestButton(page, btnId);

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.resolve(),
        },
        configurable: true,
      });
    });

    await page.evaluate((id) => {
      window.copyToClipboard('timeout-test', id);
    }, btnId);

    // 立即检查为 "已复制"
    await expect(page.locator(`#${btnId}`)).toHaveText('已复制', { timeout: 3000 });

    // 等待 2 秒超时恢复
    await page.waitForTimeout(2100);
    await expect(page.locator(`#${btnId}`)).toHaveText('复制');
  });
});
