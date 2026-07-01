/**
 * CheapLive Contest Interactive Demo — Main JS
 * 纯本地运行，无外部依赖
 */

// ====== STATE ======
const state = {
  currentAvatar: 'sacabambaspis',
  showcaseMode: false,
  drawMode: false,
  captureOn: true,
  voiceOn: false,
  voicePreset: 'original',
  guideStep: 0,
  passthrough: false,
  // Simulated face params
  faceParams: { mouthOpen: 0, blink: 0, yaw: 0, pitch: 0, smile: 0 },
};

const VOICE_PRESETS = [
  { id: 'original', name: '原声' },
  { id: 'cute', name: '可爱' },
  { id: 'robot', name: '机器人' },
  { id: 'deep', name: '低沉' },
  { id: 'radio', name: '电台' },
];

const AVATAR_NAMES = {
  sacabambaspis: 'Sacabambaspis',
  cat: '猫 Cat',
  dog: '狗 Dog',
  rabbit: '兔子 Rabbit',
  fox: '狐狸 Fox',
  bear: '小熊 Bear',
};

// ====== GUIDE STEPS ======
const GUIDE_STEPS = [
  {
    title: 'Step 1：打开发送端 App',
    body: `<p>在闲置手机上打开 CheapLive App，启动本地服务。</p>
      <div class="info">左栏模拟手机界面：服务端状态、capture 开关、局域网地址/token。</div>`
  },
  {
    title: 'Step 2：授权摄像头和麦克风',
    body: `<p>摄像头用于面部捕捉；麦克风用于后续变声/直播输出适配。</p>
      <div class="note">麦克风/变声链路为后续适配能力，本 demo 主要展示面捕与悬浮叠加流程。</div>`
  },
  {
    title: 'Step 3：接收端扫码连接',
    body: `<p>接收端扫描二维码或输入局域网 URL 连接发送端。</p>
      <div class="info">当前为模拟扫码流程，不需要真实 QR 码。</div>`
  },
  {
    title: 'Step 4：设置形象和变声效果',
    body: `<p>接收端选择动物形象、表情风格和变声预设；这些设置会存储在服务端状态中，便于多端同步。</p>
      <p>Avatar 选择：猫 / 萨卡班甲鱼 / 更多动物开发中。</p>
      <p>变声预设：原声 / 可爱 / 机器人 / 低沉 / 电台。</p>
      <div class="note">变声效果如果未真实接通，标注为"设置流程演示 / 后续适配直播输出"。</div>`
  },
  {
    title: 'Step 5：演示面部捕捉和变声效果',
    body: `<p>面部参数从发送端输入，接收端根据服务端状态驱动虚拟形象。</p>
      <div class="data-flow">
        <span class="node active">发送端</span>
        <span class="arrow">→</span>
        <span class="node active">服务端</span>
        <span class="arrow">→</span>
        <span class="node active">接收端</span>
      </div>
      <div class="param-row">
        <span class="param-item"><span class="label">mouth:</span> <span class="val" id="guideMouth">0.00</span></span>
        <span class="param-item"><span class="label">blink:</span> <span class="val" id="guideBlink">0.00</span></span>
        <span class="param-item"><span class="label">yaw:</span> <span class="val" id="guideYaw">0.00</span></span>
      </div>
      <div class="note">不要声称当前页面在调用真实摄像头——这是模拟参数变化演示。</div>`
  },
  {
    title: 'Step 6：点击"应用模式"',
    body: `<p>应用模式会隐藏大部分 UI，并将虚拟主播背景切换为透明，方便叠加到游戏画面。</p>
      <p>点击后 receiver 面板中虚拟主播背景变透明。</p>
      <div class="info">实际透明悬浮能力来自 TransparentFloatingBrowser。</div>`
  },
  {
    title: 'Step 7：悬浮透明浏览器叠加到游戏',
    body: `<p>TransparentFloatingBrowser 会加载 receiver 页面，并将网页背景设置为透明。</p>
      <p><b>蓝色顶部栏</b>：拖动位置</p>
      <p><b>右下角蓝色方块</b>：调节大小</p>
      <p><b>橙色手柄</b>：关闭交互 / 启用触摸穿透</p>
      <div class="info">蓝色顶部栏和右下角方块参考 TransparentFloatingBrowser 的交互设计；橙色手柄用于关闭悬浮网页交互。关闭后窗口会变得更透明，这是 Android 悬浮窗触摸穿透状态下的视觉提示。</div>`
  },
  {
    title: 'Step 8：进入直播/游戏场景',
    body: `<p>关闭交互后，虚拟主播悬浮在 Snackabambaspis 游戏画面上，不影响底层游戏触控。</p>
      <p>这样可以在单设备上所见即所得地直播小游戏、教学页面或其他内容。</p>
      <div class="info">Snackabambaspis 游戏可见 · 涂鸦模式可演示触控穿透概念 · 虚拟主播窗口半透明悬浮在右下角。</div>`
  },
];

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
  initAvatarCanvas();
  initGameCanvas();
  initFWAvatarCanvas();
  initFloatingWindow();
  startSimLoop();
});

// ====== AVATAR CANVAS (Middle Panel) ======
let avatarCtx, avatarW, avatarH;

function initAvatarCanvas() {
  const c = document.getElementById('avatarCanvas');
  avatarCtx = c.getContext('2d');
  avatarW = c.width;
  avatarH = c.height;
}

function drawAvatar(ctx, w, h, avatar, params, scale) {
  scale = scale || 1;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;

  if (avatar === 'sacabambaspis') {
    drawSacabambaspis(ctx, cx, cy, params, scale);
  } else if (avatar === 'cat') {
    drawCat(ctx, cx, cy, params, scale);
  } else {
    drawPlaceholder(ctx, cx, cy, avatar, scale);
  }
}

function drawSacabambaspis(ctx, cx, cy, p, s) {
  const mouth = Math.max(0, Math.min(1, p.mouthOpen));
  const blink = Math.max(0, Math.min(1, p.blink));
  const yaw = p.yaw * 30 * s;
  const mouthH = mouth * 12 * s;
  const eyeH = (1 - blink) * 5 * s;

  ctx.save();
  ctx.translate(cx + yaw * 0.3, cy);

  // Body
  ctx.fillStyle = '#e4e1d3';
  ctx.beginPath();
  ctx.ellipse(0, 0, 70 * s, 35 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Back shading
  ctx.fillStyle = 'rgba(138,135,120,0.3)';
  ctx.beginPath();
  ctx.ellipse(-10 * s, 0, 55 * s, 25 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spot
  ctx.fillStyle = 'rgba(139,115,85,0.35)';
  ctx.beginPath();
  ctx.ellipse(-25 * s, -5 * s, 15 * s, 8 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal fin
  ctx.fillStyle = '#c8c4b4';
  ctx.beginPath();
  ctx.moveTo(-15 * s, -30 * s);
  ctx.lineTo(-30 * s, -55 * s);
  ctx.lineTo(5 * s, -30 * s);
  ctx.closePath();
  ctx.fill();

  // Mouth
  if (mouthH > 1) {
    ctx.fillStyle = '#8a7355';
    ctx.beginPath();
    ctx.ellipse(55 * s, 5 * s, 8 * s, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(30 * s, -12 * s, 8 * s, Math.max(1, eyeH), 0, 0, Math.PI * 2);
  ctx.fill();
  if (eyeH > 2) {
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(32 * s, -12 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(33 * s, -13 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail fin
  ctx.fillStyle = '#c8c4b4';
  ctx.beginPath();
  ctx.moveTo(-65 * s, 0);
  ctx.lineTo(-85 * s, -20 * s);
  ctx.lineTo(-80 * s, 0);
  ctx.lineTo(-85 * s, 20 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCat(ctx, cx, cy, p, s) {
  const mouth = Math.max(0, Math.min(1, p.mouthOpen));
  const blink = Math.max(0, Math.min(1, p.blink));
  const yaw = p.yaw * 25 * s;
  const eyeH = (1 - blink) * 6 * s;
  const mouthOpen = mouth * 5 * s;

  ctx.save();
  ctx.translate(cx + yaw * 0.3, cy);

  // Head
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(0, -10 * s, 40 * s, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.ellipse(0, 35 * s, 30 * s, 25 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#e89530';
  ctx.beginPath();
  ctx.moveTo(-25 * s, -40 * s);
  ctx.lineTo(-35 * s, -70 * s);
  ctx.lineTo(-10 * s, -45 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(25 * s, -40 * s);
  ctx.lineTo(35 * s, -70 * s);
  ctx.lineTo(10 * s, -45 * s);
  ctx.closePath();
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#f0c0a0';
  ctx.beginPath();
  ctx.moveTo(-22 * s, -42 * s);
  ctx.lineTo(-30 * s, -62 * s);
  ctx.lineTo(-14 * s, -44 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22 * s, -42 * s);
  ctx.lineTo(30 * s, -62 * s);
  ctx.lineTo(14 * s, -44 * s);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-12 * s, -14 * s, 8 * s, Math.max(1, eyeH), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12 * s, -14 * s, 8 * s, Math.max(1, eyeH), 0, 0, Math.PI * 2);
  ctx.fill();
  if (eyeH > 2) {
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(-10 * s, -14 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(14 * s, -14 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-9 * s, -16 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15 * s, -16 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose
  ctx.fillStyle = '#e89530';
  ctx.beginPath();
  ctx.moveTo(0, -2 * s);
  ctx.lineTo(-4 * s, 2 * s);
  ctx.lineTo(4 * s, 2 * s);
  ctx.closePath();
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#c07020';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(0, 2 * s);
  ctx.lineTo(0, 2 * s + mouthOpen);
  ctx.stroke();
  if (mouthOpen > 2) {
    ctx.fillStyle = '#c05030';
    ctx.beginPath();
    ctx.ellipse(0, 4 * s + mouthOpen, 5 * s, mouthOpen * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Whiskers
  ctx.strokeStyle = '#e89530';
  ctx.lineWidth = 1 * s;
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.moveTo(side * 15 * s, 0);
    ctx.lineTo(side * 40 * s, -5 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 15 * s, 3 * s);
    ctx.lineTo(side * 40 * s, 5 * s);
    ctx.stroke();
  });

  ctx.restore();
}

function drawPlaceholder(ctx, cx, cy, avatar, s) {
  ctx.fillStyle = 'rgba(74,144,217,0.15)';
  ctx.fillRect(cx - 50 * s, cy - 50 * s, 100 * s, 100 * s);
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 50 * s, cy - 50 * s, 100 * s, 100 * s);
  ctx.fillStyle = '#4a90d9';
  ctx.font = `${12 * s}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(AVATAR_NAMES[avatar] || avatar, cx, cy - 5 * s);
  ctx.font = `${10 * s}px sans-serif`;
  ctx.fillStyle = '#718096';
  ctx.fillText('开发中', cx, cy + 12 * s);
}

// ====== GAME CANVAS (Snackabambaspis Snake) ======
let gameCtx, gameW, gameH;
const GRID = 18;
let snake = [], food = {}, foodType = null, gameDir = { x: 1, y: 0 }, gameNextDir = { x: 1, y: 0 };
let gameScore = 0, gameSpeed = 100, gameRunning = false, gameLoop = null;
let drawing = false, drawPaths = [];
const SNACK_TYPES = [
  { name: 'chocolate-cake', color: '#5c3a1e', glow: '#7a4e2d' },
  { name: 'strawberry-cake', color: '#e8788a', glow: '#e8788a' },
  { name: 'cookie', color: '#c8944a', glow: '#c8944a' },
  { name: 'pudding', color: '#e8c840', glow: '#d8b830' },
];

function initGameCanvas() {
  const c = document.getElementById('gameCanvas');
  const rect = c.parentElement.getBoundingClientRect();
  c.width = Math.floor(rect.width);
  c.height = Math.floor(rect.height);
  gameCtx = c.getContext('2d');
  gameW = c.width;
  gameH = c.height;
  resetGame();
  drawGame();

  c.addEventListener('mousedown', onDrawStart);
  c.addEventListener('mousemove', onDrawMove);
  c.addEventListener('mouseup', onDrawEnd);
  c.addEventListener('touchstart', e => { e.preventDefault(); onDrawStart(e.touches[0]); }, { passive: false });
  c.addEventListener('touchmove', e => { e.preventDefault(); onDrawMove(e.touches[0]); }, { passive: false });
  c.addEventListener('touchend', onDrawEnd);

  document.addEventListener('keydown', onGameKey);
}

function resetGame() {
  const cols = Math.floor(gameW / GRID);
  const rows = Math.floor(gameH / GRID);
  const my = Math.floor(rows / 2);
  snake = [{ x: 6, y: my }, { x: 5, y: my }, { x: 4, y: my }, { x: 3, y: my }];
  gameDir = { x: 1, y: 0 };
  gameNextDir = { x: 1, y: 0 };
  gameScore = 0;
  gameSpeed = 100;
  placeFood();
}

function placeFood() {
  const cols = Math.floor(gameW / GRID);
  const rows = Math.floor(gameH / GRID);
  do {
    food = { x: (Math.random() * cols) | 0, y: (Math.random() * rows) | 0 };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
  foodType = SNACK_TYPES[(Math.random() * SNACK_TYPES.length) | 0];
}

function drawGame() {
  if (!gameCtx) return;
  gameCtx.fillStyle = '#0d1420';
  gameCtx.fillRect(0, 0, gameW, gameH);

  // Grid
  gameCtx.strokeStyle = '#111927';
  gameCtx.lineWidth = 0.5;
  for (let x = 0; x <= gameW; x += GRID) {
    gameCtx.beginPath(); gameCtx.moveTo(x, 0); gameCtx.lineTo(x, gameH); gameCtx.stroke();
  }
  for (let y = 0; y <= gameH; y += GRID) {
    gameCtx.beginPath(); gameCtx.moveTo(0, y); gameCtx.lineTo(gameW, y); gameCtx.stroke();
  }

  // Food
  if (foodType) {
    const fx = food.x * GRID + GRID / 2;
    const fy = food.y * GRID + GRID / 2;
    gameCtx.fillStyle = foodType.color;
    gameCtx.shadowColor = foodType.glow;
    gameCtx.shadowBlur = 10;
    gameCtx.beginPath();
    gameCtx.arc(fx, fy, GRID / 2 - 2, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.shadowBlur = 0;
  }

  // Snake (Sacabambaspis colored)
  for (let i = snake.length - 1; i >= 1; i--) {
    const seg = snake[i];
    const alpha = Math.max(0.4, 1 - i * 0.06);
    const size = Math.max(3, GRID / 2 - 1 - i * 0.3);
    gameCtx.fillStyle = '#e4e1d3';
    gameCtx.globalAlpha = alpha;
    gameCtx.beginPath();
    gameCtx.ellipse(seg.x * GRID + GRID / 2, seg.y * GRID + GRID / 2, size, size * 0.7, 0, 0, Math.PI * 2);
    gameCtx.fill();
  }
  gameCtx.globalAlpha = 1;

  if (snake.length > 0) {
    const head = snake[0];
    const hx = head.x * GRID + GRID / 2;
    const hy = head.y * GRID + GRID / 2;
    gameCtx.fillStyle = '#e4e1d3';
    gameCtx.shadowColor = '#e4e1d3';
    gameCtx.shadowBlur = 8;
    gameCtx.beginPath();
    gameCtx.ellipse(hx, hy, GRID / 2, GRID / 2 * 0.75, Math.atan2(gameDir.y, gameDir.x), 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.shadowBlur = 0;
    // Eye
    const perpX = -gameDir.y;
    const perpY = gameDir.x;
    gameCtx.fillStyle = '#fff';
    gameCtx.beginPath();
    gameCtx.arc(hx + gameDir.x * 3 + perpX * 3, hy + gameDir.y * 3 + perpY * 3, 2.5, 0, Math.PI * 2);
    gameCtx.fill();
    gameCtx.fillStyle = '#1a1a2e';
    gameCtx.beginPath();
    gameCtx.arc(hx + gameDir.x * 3.5 + perpX * 3, hy + gameDir.y * 3.5 + perpY * 3, 1.3, 0, Math.PI * 2);
    gameCtx.fill();
  }

  // Draw paths
  if (drawPaths.length > 0) {
    gameCtx.strokeStyle = 'rgba(255,140,66,0.6)';
    gameCtx.lineWidth = 3;
    gameCtx.lineCap = 'round';
    gameCtx.lineJoin = 'round';
    for (const path of drawPaths) {
      if (path.length < 2) continue;
      gameCtx.beginPath();
      gameCtx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        gameCtx.lineTo(path[i].x, path[i].y);
      }
      gameCtx.stroke();
    }
  }

  // Score
  gameCtx.fillStyle = '#718096';
  gameCtx.font = '12px sans-serif';
  gameCtx.textAlign = 'left';
  gameCtx.fillText('Snacks: ' + gameScore, 8, 16);
}

function updateGame() {
  gameDir = { ...gameNextDir };
  const cols = Math.floor(gameW / GRID);
  const rows = Math.floor(gameH / GRID);
  const head = { x: snake[0].x + gameDir.x, y: snake[0].y + gameDir.y };
  if (head.x < 0) head.x = cols - 1;
  if (head.x >= cols) head.x = 0;
  if (head.y < 0) head.y = rows - 1;
  if (head.y >= rows) head.y = 0;
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameRunning = false;
    clearTimeout(gameLoop);
    resetGame();
    return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    gameScore += 10;
    gameSpeed = Math.max(50, gameSpeed - 2);
    placeFood();
  } else {
    snake.pop();
  }
}

function gameTick() {
  if (!gameRunning) return;
  updateGame();
  drawGame();
  gameLoop = setTimeout(gameTick, gameSpeed);
}

function startGame() { resetGame(); gameRunning = true; gameTick(); }

function onGameKey(e) {
  if (['ArrowUp','w','W'].includes(e.key) && gameDir.y === 0) gameNextDir = { x: 0, y: -1 };
  if (['ArrowDown','s','S'].includes(e.key) && gameDir.y === 0) gameNextDir = { x: 0, y: 1 };
  if (['ArrowLeft','a','A'].includes(e.key) && gameDir.x === 0) gameNextDir = { x: -1, y: 0 };
  if (['ArrowRight','d','D'].includes(e.key) && gameDir.x === 0) gameNextDir = { x: 1, y: 0 };
  if (!gameRunning && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) {
    startGame();
  }
}

// ====== DRAWING ======
function onDrawStart(e) {
  if (!state.drawMode) return;
  drawing = true;
  const c = document.getElementById('gameCanvas');
  const rect = c.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (c.width / rect.width);
  const y = (e.clientY - rect.top) * (c.height / rect.height);
  drawPaths.push([{ x, y }]);
}
function onDrawMove(e) {
  if (!drawing || !state.drawMode) return;
  const c = document.getElementById('gameCanvas');
  const rect = c.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (c.width / rect.width);
  const y = (e.clientY - rect.top) * (c.height / rect.height);
  drawPaths[drawPaths.length - 1].push({ x, y });
  drawGame();
}
function onDrawEnd() { drawing = false; }

// ====== FW AVATAR CANVAS ======
let fwCtx;
function initFWAvatarCanvas() {
  const c = document.getElementById('fwAvatarCanvas');
  fwCtx = c.getContext('2d');
}

// ====== FLOATING WINDOW ======
let fwDragging = false, fwResizing = false, fwOffX = 0, fwOffY = 0, fwStartW = 0, fwStartH = 0;

function initFloatingWindow() {
  const fw = document.getElementById('floatingWindow');
  const bar = document.getElementById('fwTopBar');
  const resize = document.getElementById('fwResize');

  bar.addEventListener('mousedown', e => {
    fwDragging = true;
    fwOffX = e.clientX - fw.offsetLeft;
    fwOffY = e.clientY - fw.offsetTop;
    e.preventDefault();
  });
  bar.addEventListener('touchstart', e => {
    fwDragging = true;
    const t = e.touches[0];
    fwOffX = t.clientX - fw.offsetLeft;
    fwOffY = t.clientY - fw.offsetTop;
    e.preventDefault();
  }, { passive: false });

  resize.addEventListener('mousedown', e => {
    fwResizing = true;
    fwStartW = fw.offsetWidth;
    fwStartH = fw.offsetHeight;
    fwOffX = e.clientX;
    fwOffY = e.clientY;
    e.preventDefault();
  });

  document.addEventListener('mousemove', onFWMove);
  document.addEventListener('touchmove', onFWMoveTouch, { passive: false });
  document.addEventListener('mouseup', onFWEnd);
  document.addEventListener('touchend', onFWEnd);
}

function onFWMove(e) {
  const fw = document.getElementById('floatingWindow');
  if (fwDragging) {
    fw.style.left = (e.clientX - fwOffX) + 'px';
    fw.style.top = (e.clientY - fwOffY) + 'px';
    fw.style.right = 'auto';
    fw.style.bottom = 'auto';
  }
  if (fwResizing) {
    const w = Math.max(100, fwStartW + e.clientX - fwOffX);
    const h = Math.max(100, fwStartH + e.clientY - fwOffY);
    fw.style.width = w + 'px';
    fw.style.height = h + 'px';
    const c = document.getElementById('fwAvatarCanvas');
    c.width = w; c.height = h - 22;
  }
}

function onFWMoveTouch(e) {
  if (!fwDragging && !fwResizing) return;
  e.preventDefault();
  const t = e.touches[0];
  const fw = document.getElementById('floatingWindow');
  if (fwDragging) {
    fw.style.left = (t.clientX - fwOffX) + 'px';
    fw.style.top = (t.clientY - fwOffY) + 'px';
    fw.style.right = 'auto';
    fw.style.bottom = 'auto';
  }
}

function onFWEnd() {
  fwDragging = false;
  fwResizing = false;
}

// ====== SIM LOOP ======
let simTime = 0;
function startSimLoop() {
  if (!gameRunning) startGame();
  requestAnimationFrame(simLoop);
}

function simLoop(ts) {
  simTime = ts * 0.001;

  // Simulate face params
  state.faceParams.mouthOpen = 0.5 + 0.5 * Math.sin(simTime * 1.2);
  state.faceParams.blink = Math.max(0, Math.sin(simTime * 3) > 0.95 ? 1 : 0);
  state.faceParams.yaw = Math.sin(simTime * 0.5);
  state.faceParams.smile = 0.3 + 0.3 * Math.sin(simTime * 0.8);

  // Draw avatar on main canvas
  const bg = state.showcaseMode ? 'transparent' : '#0d1420';
  const panelBody = document.getElementById('avatarPanelBody');
  if (state.showcaseMode) {
    panelBody.style.background = 'transparent';
  } else {
    panelBody.style.background = '';
  }
  drawAvatar(avatarCtx, avatarW, avatarH, state.currentAvatar, state.faceParams, 1);

  // Draw avatar on floating window
  const fc = document.getElementById('fwAvatarCanvas');
  drawAvatar(fwCtx, fc.width, fc.height, state.currentAvatar, state.faceParams, fc.width / 360);

  // Update guide params if open
  const gm = document.getElementById('guideMouth');
  if (gm) gm.textContent = state.faceParams.mouthOpen.toFixed(2);
  const gb = document.getElementById('guideBlink');
  if (gb) gb.textContent = state.faceParams.blink.toFixed(2);
  const gy = document.getElementById('guideYaw');
  if (gy) gy.textContent = state.faceParams.yaw.toFixed(2);

  requestAnimationFrame(simLoop);
}

// ====== UI HANDLERS ======
function toggleCapture() {
  state.captureOn = !state.captureOn;
  const el = document.getElementById('captureToggle');
  el.classList.toggle('on', state.captureOn);
  document.getElementById('cameraPerm').textContent = state.captureOn ? '已授权' : '未授权';
  document.getElementById('cameraPerm').style.color = state.captureOn ? 'var(--cl-green)' : 'var(--cl-text-muted)';
}

function toggleVoice() {
  state.voiceOn = !state.voiceOn;
  document.getElementById('voiceToggle').classList.toggle('on', state.voiceOn);
  document.getElementById('voicePresetDisplay').textContent = state.voiceOn ? VOICE_PRESETS.find(v => v.id === state.voicePreset).name : '原声';
}

function selectAvatar(avatar, el) {
  state.currentAvatar = avatar;
  document.querySelectorAll('#avatarGrid .avatar-btn').forEach(b => b.classList.remove('selected'));
  if (el) el.classList.add('selected');
  document.getElementById('avatarLabel').textContent = AVATAR_NAMES[avatar] || avatar;
}

function toggleShowcase() {
  state.showcaseMode = !state.showcaseMode;
  const body = document.getElementById('avatarPanelBody');
  body.classList.toggle('showcase-mode', state.showcaseMode);
}

function toggleDrawMode() {
  state.drawMode = !state.drawMode;
  const c = document.getElementById('gameCanvas');
  const btn = document.getElementById('drawModeBtn');
  c.classList.toggle('draw-mode', state.drawMode);
  btn.textContent = state.drawMode ? '涂鸦模式：开启中（点击画线）' : '涂鸦模式（触控穿透演示）';
  if (!state.drawMode) drawPaths = [];
}

function togglePassthrough() {
  state.passthrough = !state.passthrough;
  const fw = document.getElementById('floatingWindow');
  const handle = document.getElementById('fwInteract');
  const status = document.getElementById('fwStatusText');
  fw.classList.toggle('passthrough', state.passthrough);
  handle.classList.toggle('off', state.passthrough);
  status.textContent = state.passthrough
    ? '悬浮窗：触摸穿透中 · 半透明 · 底层可触控'
    : '悬浮窗：交互中 · 拖动蓝色顶栏移动';
}

// ====== GUIDE ======
function openGuide() {
  state.guideStep = 0;
  renderGuide();
  document.getElementById('guideOverlay').classList.add('open');
}

function closeGuide() {
  document.getElementById('guideOverlay').classList.remove('open');
}

function guideNav(dir) {
  state.guideStep = Math.max(0, Math.min(GUIDE_STEPS.length - 1, state.guideStep + dir));
  renderGuide();
  if (state.guideStep === GUIDE_STEPS.length - 1) {
    document.getElementById('guideNext').textContent = '完成';
  } else {
    document.getElementById('guideNext').textContent = '下一步';
  }
}

function renderGuide() {
  const step = GUIDE_STEPS[state.guideStep];
  document.getElementById('guideTitle').textContent = step.title;
  document.getElementById('guideStepIndicator').innerHTML = `Step <b>${state.guideStep + 1}</b> / ${GUIDE_STEPS.length}`;
  document.getElementById('guideBody').innerHTML = step.body;

  // Dots
  const dots = document.getElementById('guideDots');
  dots.innerHTML = '';
  for (let i = 0; i < GUIDE_STEPS.length; i++) {
    const d = document.createElement('div');
    d.className = 'step-dot' + (i === state.guideStep ? ' active' : '') + (i < state.guideStep ? ' done' : '');
    dots.appendChild(d);
  }

  document.getElementById('guidePrev').style.visibility = state.guideStep === 0 ? 'hidden' : 'visible';
}
