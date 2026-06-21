import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 700 } });

// 捕获所有 console 消息
const logs = [];
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'log' || msg.type() === 'warning' || msg.type() === 'error') {
    logs.push({ type: msg.type(), text: msg.text() });
  }
});

await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });

// 等待更长时间
await page.waitForTimeout(3000);

// 直接检查 faceTracker 对象
const ftInfo = await page.evaluate(() => {
  if (!window.faceTracker) return { exists: false };
  const ft = window.faceTracker;
  const result = {
    hasAvatar: !!ft.avatar,
    avatarVersion: ft.avatarVersion,
    statusText: ft.status?.textContent || null,
    loadingText: ft.loading?.textContent || null,
    allAvatarKeys: Object.keys(ft).slice(0, 30),
  };
  // 检查 avatar 的详细信息
  if (ft.avatar) {
    result.avatarKeys = Object.keys(ft.avatar).slice(0, 30);
    result.avatarConstructor = ft.avatar.constructor?.name;
  }
  return result;
});

console.log('faceTracker 信息:');
console.log(JSON.stringify(ftInfo, null, 2));

console.log('\nConsole 日志:');
for (const log of logs.slice(-30)) {
  console.log(`  [${log.type}] ${log.text}`);
}

await browser.close();
