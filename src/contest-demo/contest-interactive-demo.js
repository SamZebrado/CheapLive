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
  floatingMode: 'edit', // 'edit' | 'display'
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
  sacabambaspis: '萨卡班 2D',
  'sacabambaspis-3d': '3D 萨卡班',
  cat: '猫 Cat',
  dog: '狗 Dog',
  rabbit: '兔子 Rabbit',
  fox: '狐狸 Fox',
  bear: '小熊 Bear',
};

let _main3DRenderer = null;
let _fw3DRenderer = null;

// ====== GUIDE STEPS ======
const GUIDE_STEPS = [
  {
    title: 'Step 1：发送端 · 面部 / 声音输入',
    body: `<p>发送端负责采集面部参数和声音输入。</p>
      <div class="info">左侧手机界面模拟发送端：开启摄像头/麦克风，采集 headYaw、mouthOpen、blink 等参数，通过局域网发送到 Receiver。</div>
      <div class="note">当前 demo 使用模拟参数动画驱动；Android 发送端链路正在接入与调试中。</div>`
  },
  {
    title: 'Step 2：Receiver · 虚拟主播',
    body: `<p>Receiver 接收面部/声音输入，选择虚拟形象，设置背景透明。</p>
      <div class="info">中间面板显示 Receiver：选择动物形象（萨卡班甲鱼 / 猫 / 更多开发中），点击"应用模式"将背景设为透明，准备作为网页小窗显示。</div>
      <div class="note">用透明悬浮浏览器打开，可设置背景透明。</div>`
  },
  {
    title: 'Step 3：透明悬浮浏览器打开 Receiver',
    body: `<p>TransparentFloatingBrowser 加载 Receiver 页面，设置背景透明后叠加到直播端。</p>
      <div class="info">右侧直播端中的悬浮小窗 → 打开的是中间 Receiver 的网页。蓝色顶部栏拖动位置，右下角蓝色方块调节大小。透明悬浮能力来自开源项目 TransparentFloatingBrowser。</div>`
  },
  {
    title: 'Step 4：编辑模式',
    body: `<p>左侧橙色按钮显示"编辑"时，小窗可交互。</p>
      <div class="info">编辑模式下：小窗可拖动、可缩放、内容可点击。触摸落在小窗网页上，不穿透到底层直播端。</div>
      <div class="note">橙色按钮可沿左侧上下拖动调整位置。</div>`
  },
  {
    title: 'Step 5：显示模式',
    body: `<p>点击橙色按钮切换到"显示"模式。</p>
      <div class="info">显示模式下：小窗不可交互、不可拖动、不可缩放。触摸穿透小窗落到底层直播端。小窗半透明表示穿透状态。</div>
      <div class="note">只有左侧橙色按钮仍可点击，用于切回编辑模式。</div>`
  },
  {
    title: 'Step 6：直播端应用场景',
    body: `<p>透明悬浮小窗可叠加在直播端画面上。</p>
      <div class="info">右侧面板代表直播端——打游戏、绘图、做手工、展示内容的那台手机。虚拟主播小窗悬浮在上方，不影响底层触控。</div>
      <div class="note">开启"涂鸦模式"可在直播端画面上手绘，直观体验显示模式下的触摸穿透效果。</div>`
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
  if (avatar === 'sacabambaspis-3d') {
    return;
  }
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

function update3DRenderers(params) {
  if (_main3DRenderer) {
    _main3DRenderer.updateParams(params);
  }
  if (_fw3DRenderer) {
    _fw3DRenderer.updateParams(params);
  }
}

function faceParamsToRendererParams(fp) {
  return {
    mouthOpen: fp.mouthOpen ?? 0,
    mouthSmile: fp.smile ?? 0,
    eyeLeft: 1 - (fp.blink ?? 0),
    eyeRight: 1 - (fp.blink ?? 0),
    headYaw: (fp.yaw ?? 0) * 0.5 + 0.5,
    headPitch: (fp.pitch ?? 0) * 0.5 + 0.5,
    browLeft: 0,
    browRight: 0,
  };
}

function ensure3DRenderers() {
  if (!_main3DRenderer) {
    _main3DRenderer = new _ProceduralSpindleWhaleAvatar('avatarCanvas');
  }
  if (!_fw3DRenderer) {
    _fw3DRenderer = new _ProceduralSpindleWhaleAvatar('fwAvatarCanvas');
  }
}

function set3DRenderersVisible(visible) {
  const mainCanvas = document.getElementById('avatarCanvas');
  const fwCanvas = document.getElementById('fwAvatarCanvas');
  if (visible) {
    mainCanvas.style.display = '';
    fwCanvas.style.display = '';
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

  // Start in edit mode
  fw.classList.add('fw-edit-mode');

  bar.addEventListener('mousedown', e => {
    if (state.floatingMode !== 'edit') return; // 显示模式下不允许拖动
    fwDragging = true;
    fwOffX = e.clientX - fw.offsetLeft;
    fwOffY = e.clientY - fw.offsetTop;
    e.preventDefault();
  });
  bar.addEventListener('touchstart', e => {
    if (state.floatingMode !== 'edit') return; // 显示模式下不允许拖动
    fwDragging = true;
    const t = e.touches[0];
    fwOffX = t.clientX - fw.offsetLeft;
    fwOffY = t.clientY - fw.offsetTop;
    e.preventDefault();
  }, { passive: false });

  resize.addEventListener('mousedown', e => {
    if (state.floatingMode !== 'edit') return; // 显示模式下不允许缩放
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

  // Mode button vertical drag (snaps to left edge)
  initModeButtonDrag();
}

// ====== MODE BUTTON DRAG (vertical, snaps left edge) ======
let modeBtnDragging = false, modeBtnStartY = 0, modeBtnStartTop = 0, modeBtnMoved = false;

function initModeButtonDrag() {
  const btn = document.getElementById('fwModeBtn');
  if (!btn) return;

  btn.addEventListener('mousedown', e => {
    modeBtnDragging = true;
    modeBtnMoved = false;
    modeBtnStartY = e.clientY;
    modeBtnStartTop = btn.offsetTop;
    btn.style.cursor = 'grabbing';
    e.preventDefault();
  });
  btn.addEventListener('touchstart', e => {
    modeBtnDragging = true;
    modeBtnMoved = false;
    modeBtnStartY = e.touches[0].clientY;
    modeBtnStartTop = btn.offsetTop;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('mousemove', onModeBtnMove);
  document.addEventListener('touchmove', onModeBtnMoveTouch, { passive: false });
}

function onModeBtnMove(e) {
  if (!modeBtnDragging) return;
  const delta = Math.abs(e.clientY - modeBtnStartY);
  if (delta > 3) modeBtnMoved = true;
  if (!modeBtnMoved) return;
  const btn = document.getElementById('fwModeBtn');
  const panel = btn.parentElement;
  const panelRect = panel.getBoundingClientRect();
  const maxTop = panelRect.height - btn.offsetHeight - 8;
  const newTop = Math.max(8, Math.min(maxTop, modeBtnStartTop + e.clientY - modeBtnStartY));
  btn.style.top = newTop + 'px';
  btn.style.bottom = 'auto';
}

function onModeBtnMoveTouch(e) {
  if (!modeBtnDragging) return;
  const delta = Math.abs(e.touches[0].clientY - modeBtnStartY);
  if (delta > 3) modeBtnMoved = true;
  if (!modeBtnMoved) return;
  e.preventDefault();
  const btn = document.getElementById('fwModeBtn');
  const panel = btn.parentElement;
  const panelRect = panel.getBoundingClientRect();
  const maxTop = panelRect.height - btn.offsetHeight - 8;
  const newTop = Math.max(8, Math.min(maxTop, modeBtnStartTop + e.touches[0].clientY - modeBtnStartY));
  btn.style.top = newTop + 'px';
  btn.style.bottom = 'auto';
}

// Extend onFWEnd to also handle mode button
const _origOnFWEnd = onFWEnd;
onFWEnd = function() {
  _origOnFWEnd();
  modeBtnDragging = false;
  const btn = document.getElementById('fwModeBtn');
  if (btn) btn.style.cursor = 'grab';
};

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

  // Simulate face params (only when real face tracking is NOT running)
  if (!_faceLandmarker) {
    state.faceParams.mouthOpen = 0.5 + 0.5 * Math.sin(simTime * 1.2);
    state.faceParams.blink = Math.max(0, Math.sin(simTime * 3) > 0.95 ? 1 : 0);
    state.faceParams.yaw = Math.sin(simTime * 0.5);
    state.faceParams.smile = 0.3 + 0.3 * Math.sin(simTime * 0.8);
  }

  // Draw avatar on main canvas
  const bg = state.showcaseMode ? 'transparent' : '#0d1420';
  const panelBody = document.getElementById('avatarPanelBody');
  if (state.showcaseMode) {
    panelBody.style.background = 'transparent';
  } else {
    panelBody.style.background = '';
  }

  if (state.currentAvatar === 'sacabambaspis-3d') {
    const rendererParams = faceParamsToRendererParams(state.faceParams);
    update3DRenderers(rendererParams);
  } else {
    drawAvatar(avatarCtx, avatarW, avatarH, state.currentAvatar, state.faceParams, 1);
    const fc = document.getElementById('fwAvatarCanvas');
    drawAvatar(fwCtx, fc.width, fc.height, state.currentAvatar, state.faceParams, fc.width / 360);
  }

  // Update guide params if open
  const gm = document.getElementById('guideMouth');
  if (gm) gm.textContent = state.faceParams.mouthOpen.toFixed(2);
  const gb = document.getElementById('guideBlink');
  if (gb) gb.textContent = state.faceParams.blink.toFixed(2);
  const gy = document.getElementById('guideYaw');
  if (gy) gy.textContent = state.faceParams.yaw.toFixed(2);

  // Update sender panel params
  const hd = document.getElementById('headYawVal');
  if (hd) hd.textContent = state.faceParams.yaw.toFixed(2);
  const mo = document.getElementById('mouthOpenVal');
  if (mo) mo.textContent = state.faceParams.mouthOpen.toFixed(2);
  const bl = document.getElementById('blinkVal');
  if (bl) bl.textContent = state.faceParams.blink.toFixed(2);

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

  if (avatar === 'sacabambaspis-3d') {
    ensure3DRenderers();
    const rendererParams = faceParamsToRendererParams(state.faceParams);
    update3DRenderers(rendererParams);
  }
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

function toggleFloatingMode() {
  // If user was dragging the button (not clicking), skip toggle
  if (modeBtnMoved) { modeBtnMoved = false; return; }

  const isEdit = state.floatingMode === 'edit';
  state.floatingMode = isEdit ? 'display' : 'edit';

  const fw = document.getElementById('floatingWindow');
  const btn = document.getElementById('fwModeBtn');
  const status = document.getElementById('fwStatusText');

  // Clear any active drag/resize state
  fwDragging = false;
  fwResizing = false;

  fw.classList.toggle('fw-edit-mode', state.floatingMode === 'edit');
  fw.classList.toggle('fw-display-mode', state.floatingMode === 'display');
  btn.classList.toggle('display-mode', state.floatingMode === 'display');

  if (state.floatingMode === 'edit') {
    btn.textContent = '编辑';
    status.textContent = '悬浮窗：编辑模式 · 可拖动/缩放/交互';
  } else {
    btn.textContent = '显示';
    status.textContent = '悬浮窗：显示模式 · 触摸穿透 · 底层可触控';
  }
}

// ====== GUIDE ======
function openGuide() {
  state.guideStep = 0;
  renderGuide();
  document.getElementById('guideOverlay').classList.add('open');
  updateGuideHighlights();
}

function closeGuide() {
  document.getElementById('guideOverlay').classList.remove('open');
  clearGuideHighlights();
}

function guideNav(dir) {
  state.guideStep = Math.max(0, Math.min(GUIDE_STEPS.length - 1, state.guideStep + dir));
  renderGuide();
  if (state.guideStep === GUIDE_STEPS.length - 1) {
    document.getElementById('guideNext').textContent = '完成';
  } else {
    document.getElementById('guideNext').textContent = '下一步';
  }
  updateGuideHighlights();
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

// ====== GUIDE HIGHLIGHTS ======
const GUIDE_TARGETS = [
  { el: '#phoneFrame', bubble: '发送端采集', pos: 'right' },
  { el: '#receiverPanel', bubble: 'Receiver 选择形象', pos: 'left' },
  { el: '#floatingWindow', from: '#receiverPanel', bubble: '悬浮窗叠加', pos: 'top' },
  { el: '#fwModeBtn', bubble: '编辑模式：可拖动', pos: 'right' },
  { el: '#floatingWindow', bubble: '显示模式：穿透', pos: 'top' },
  { el: '#gamePanel', bubble: '直播端应用场景', pos: 'left' },
];

function updateGuideHighlights() {
  clearGuideHighlights();
  const cfg = GUIDE_TARGETS[state.guideStep];
  if (!cfg) return;

  const target = document.querySelector(cfg.el);
  if (!target) return;
  const rect = target.getBoundingClientRect();

  // Create highlight box
  const box = document.createElement('div');
  box.className = 'guide-highlight-box';
  box.style.left = (rect.left - 4) + 'px';
  box.style.top = (rect.top - 4) + 'px';
  box.style.width = (rect.width + 8) + 'px';
  box.style.height = (rect.height + 8) + 'px';
  document.body.appendChild(box);

  // Create bubble
  const bubble = document.createElement('div');
  bubble.className = 'guide-bubble bubble-' + cfg.pos;
  bubble.textContent = cfg.bubble;
  document.body.appendChild(bubble);

  // Position bubble
  const bRect = bubble.getBoundingClientRect();
  let bLeft, bTop;
  switch (cfg.pos) {
    case 'right':
      bLeft = rect.right + 12;
      bTop = rect.top + rect.height / 2 - bRect.height / 2;
      break;
    case 'left':
      bLeft = rect.left - bRect.width - 12;
      bTop = rect.top + rect.height / 2 - bRect.height / 2;
      break;
    case 'top':
      bLeft = rect.left + rect.width / 2 - bRect.width / 2;
      bTop = rect.top - bRect.height - 12;
      break;
    case 'bottom':
      bLeft = rect.left + rect.width / 2 - bRect.width / 2;
      bTop = rect.bottom + 12;
      break;
  }
  bubble.style.left = Math.max(8, bLeft) + 'px';
  bubble.style.top = Math.max(8, bTop) + 'px';

  // Arrow from receiver to floating window (Step 3)
  if (cfg.from) {
    const fromEl = document.querySelector(cfg.from);
    if (fromEl) {
      const fromRect = fromEl.getBoundingClientRect();
      createArrow(fromRect, rect);
    }
  }
}

function createArrow(fromRect, toRect) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'fixed';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '151';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'guideArrowHead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
  polygon.setAttribute('fill', '#ff6b4a');
  marker.appendChild(polygon);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const x1 = fromRect.right;
  const y1 = fromRect.top + fromRect.height / 2;
  const x2 = toRect.left;
  const y2 = toRect.top + toRect.height / 2;
  const midX = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  path.setAttribute('d', d);
  path.setAttribute('stroke', '#ff6b4a');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-dasharray', '8 4');
  path.setAttribute('marker-end', 'url(#guideArrowHead)');
  svg.appendChild(path);
  document.body.appendChild(svg);
}

function clearGuideHighlights() {
  document.querySelectorAll('.guide-highlight-box, .guide-bubble').forEach(el => el.remove());
  document.querySelectorAll('svg').forEach(el => {
    if (el.style.zIndex === '151') el.remove();
  });
}

// ====== FACE TRACKING (MediaPipe) ======
let _faceLandmarker = null;
let _faceVideoStream = null;
let _faceDetectRAF = null;

async function startFaceTracking() {
  const btn = document.getElementById('faceCamBtn');
  const status = document.getElementById('faceCamStatus');
  const videoWrap = document.getElementById('faceVideoWrap');

  if (_faceLandmarker || _faceVideoStream) {
    stopFaceTracking();
    return;
  }

  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = '请求摄像头权限...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
    });
    _faceVideoStream = stream;
    const video = document.getElementById('faceVideo');
    video.srcObject = stream;
    await video.play();

    status.textContent = '加载 MediaPipe 模型（约 3MB）...';

    const mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/+esm');
    const { FilesetResolver, FaceLandmarker } = mp;

    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
    );

    _faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    status.textContent = '面捕运行中';
    videoWrap.style.display = 'block';
    btn.textContent = '停止面捕';
    btn.disabled = false;

    startFaceDetectionLoop(video);

  } catch (err) {
    console.error('Face tracking error:', err);
    status.textContent = '错误: ' + (err.message || '无法启动摄像头或加载模型');
    btn.disabled = false;
    if (_faceVideoStream) {
      _faceVideoStream.getTracks().forEach(t => t.stop());
      _faceVideoStream = null;
    }
  }
}

function startFaceDetectionLoop(video) {
  let lastTime = -1;
  function loop() {
    if (!_faceLandmarker || !_faceVideoStream) return;
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      try {
        const results = _faceLandmarker.detectForVideo(video, performance.now());
        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          updateFaceParamsFromBlendshapes(results.faceBlendshapes[0], results.facialTransformationMatrixes);
        }
      } catch (e) { /* ignore per-frame errors */ }
    }
    _faceDetectRAF = requestAnimationFrame(loop);
  }
  loop();
}

function updateFaceParamsFromBlendshapes(blendshapes, matrices) {
  const categories = blendshapes.categories || [];
  const getVal = (name) => {
    const cat = categories.find(c => c.categoryName === name);
    return cat ? cat.score : 0;
  };

  const mouthOpen = getVal('jawOpen');
  const blinkLeft = getVal('eyeBlinkLeft');
  const blinkRight = getVal('eyeBlinkRight');
  const smileLeft = getVal('mouthSmileLeft');
  const smileRight = getVal('mouthSmileRight');

  state.faceParams.mouthOpen = mouthOpen;
  state.faceParams.blink = Math.max(blinkLeft, blinkRight);
  state.faceParams.smile = (smileLeft + smileRight) / 2;
  state.faceParams.faceDetected = true;

  // Extract yaw from transformation matrix if available
  if (matrices && matrices.length > 0) {
    const m = matrices[0].data;
    // 4x4 matrix: extract yaw from rotation
    const yaw = Math.atan2(m[8], m[10]);
    state.faceParams.yaw = (yaw / Math.PI + 1) / 2; // normalize to 0-1
  }

  document.getElementById('faceDetectedVal').textContent = 'true';
  document.getElementById('mouthOpenVal').textContent = mouthOpen.toFixed(2);
  document.getElementById('blinkVal').textContent = Math.max(blinkLeft, blinkRight).toFixed(2);
  document.getElementById('smileVal').textContent = state.faceParams.smile.toFixed(2);
}

function stopFaceTracking() {
  if (_faceDetectRAF) {
    cancelAnimationFrame(_faceDetectRAF);
    _faceDetectRAF = null;
  }
  if (_faceVideoStream) {
    _faceVideoStream.getTracks().forEach(t => t.stop());
    _faceVideoStream = null;
  }
  _faceLandmarker = null;
  const btn = document.getElementById('faceCamBtn');
  const status = document.getElementById('faceCamStatus');
  const videoWrap = document.getElementById('faceVideoWrap');
  btn.textContent = '开启摄像头';
  status.style.display = 'none';
  videoWrap.style.display = 'none';
  document.getElementById('faceDetectedVal').textContent = 'false';
}

// ====== MIC LEVEL (Web Audio API) ======
let _micAudioContext = null;
let _micAnalyser = null;
let _micStream = null;
let _micInterval = null;

async function startMicLevel() {
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('micStatus');
  const valEl = document.getElementById('micLevelVal');

  if (_micAudioContext) {
    stopMicLevel();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _micStream = stream;
    _micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = _micAudioContext.createMediaStreamSource(stream);
    _micAnalyser = _micAudioContext.createAnalyser();
    _micAnalyser.fftSize = 256;
    source.connect(_micAnalyser);

    const dataArray = new Uint8Array(_micAnalyser.frequencyBinCount);

    _micInterval = setInterval(() => {
      _micAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      const normalized = Math.min(1, avg / 128);
      valEl.textContent = normalized.toFixed(2);
      valEl.style.color = normalized > 0.05 ? 'var(--cl-green)' : 'var(--cl-text-muted)';
    }, 100);

    btn.textContent = '停止麦克风';
    status.textContent = '麦克风运行中';

  } catch (err) {
    status.textContent = '错误: ' + (err.message || '无法访问麦克风');
    console.error('Mic error:', err);
  }
}

function stopMicLevel() {
  if (_micInterval) {
    clearInterval(_micInterval);
    _micInterval = null;
  }
  if (_micAudioContext) {
    _micAudioContext.close();
    _micAudioContext = null;
  }
  if (_micStream) {
    _micStream.getTracks().forEach(t => t.stop());
    _micStream = null;
  }
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('micStatus');
  const valEl = document.getElementById('micLevelVal');
  btn.textContent = '开启麦克风';
  status.textContent = '点击开启麦克风';
  valEl.textContent = '—';
  valEl.style.color = 'var(--cl-text-muted)';
}

// ============================================================
// 3D 萨卡班甲鱼渲染器（来自开源 face-tracking 模块）
// ============================================================

// ---------- 工具函数 ----------
function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function _lerp(a, b, t) { return a + (b - a) * t; }

function _parseHex(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

function _parseRGB(c) {
  if (!c) return { r: 0, g: 0, b: 0 };
  if (c.startsWith('#')) return _parseHex(c);
  const m = c.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
  if (m) return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
  return { r: 0, g: 0, b: 0 };
}

function _lerpColor(c1, c2, t) {
  const p1 = _parseHex(c1);
  const p2 = _parseHex(c2);
  const r = Math.round(_lerp(p1.r, p2.r, t));
  const g = Math.round(_lerp(p1.g, p2.g, t));
  const b = Math.round(_lerp(p1.b, p2.b, t));
  return `rgb(${r}, ${g}, ${b})`;
}

function _applyLight(faceCenterNormal, lightDir, baseColor, ambient) {
  const dot = (faceCenterNormal.x || 0) * lightDir.x + (faceCenterNormal.y || 0) * lightDir.y + (faceCenterNormal.z || 0) * lightDir.z;
  const a = Number.isFinite(ambient) && ambient >= 0 && ambient <= 1 ? ambient : 0.55;
  const factor = a + (1 - a) * _clamp(dot, -0.2, 1.0);
  const rgb = _parseRGB(baseColor);
  const r = Math.round(_clamp(rgb.r * factor, 0, 255));
  const g = Math.round(_clamp(rgb.g * factor, 0, 255));
  const b = Math.round(_clamp(rgb.b * factor, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

const _BASIS_EPSILON = 1e-10;

function _normVec3(v, fallback) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (!Number.isFinite(len) || len < _BASIS_EPSILON) {
    return { x: fallback.x, y: fallback.y, z: fallback.z };
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function _dotVec3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

function _crossVec3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function _buildFaceBasis(local) {
  const rawN = { x: local.nx, y: local.ny, z: local.nz };
  const n = _normVec3((rawN.x !== undefined && rawN.y !== undefined && rawN.z !== undefined) ? rawN : { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 });

  let rawT = { x: local.tx, y: local.ty, z: local.tz };
  if (rawT.x === undefined || rawT.y === undefined || rawT.z === undefined) {
    rawT = { x: 1 - n.x * n.x, y: -n.x * n.y, z: -n.x * n.z };
    if (Math.sqrt(rawT.x * rawT.x + rawT.y * rawT.y + rawT.z * rawT.z) < _BASIS_EPSILON) {
      rawT = { x: -n.y * n.x, y: 1 - n.y * n.y, z: -n.y * n.z };
    }
  }

  const tDotN = _dotVec3(rawT, n);
  let t = { x: rawT.x - tDotN * n.x, y: rawT.y - tDotN * n.y, z: rawT.z - tDotN * n.z };
  const tLen = Math.sqrt(t.x * t.x + t.y * t.y + t.z * t.z);
  if (tLen < _BASIS_EPSILON) {
    let ref;
    if (Math.abs(n.x) <= Math.abs(n.y) && Math.abs(n.x) <= Math.abs(n.z)) {
      ref = { x: 1, y: 0, z: 0 };
    } else if (Math.abs(n.y) <= Math.abs(n.z)) {
      ref = { x: 0, y: 1, z: 0 };
    } else {
      ref = { x: 0, y: 0, z: 1 };
    }
    const refDotN = _dotVec3(ref, n);
    t = { x: ref.x - refDotN * n.x, y: ref.y - refDotN * n.y, z: ref.z - refDotN * n.z };
  }

  t = _normVec3(t, { x: 1, y: 0, z: 0 });
  let b = _normVec3(_crossVec3(n, t), { x: 0, y: 1, z: 0 });
  t = _normVec3(_crossVec3(b, n), { x: 1, y: 0, z: 0 });
  b = _normVec3(_crossVec3(n, t), { x: 0, y: 1, z: 0 });

  return { n, t, b };
}

function _computeProjectedEllipse(rx, ry, bx, by, halfWidth, halfHeight) {
  const ax = rx * halfWidth;
  const ay = ry * halfWidth;
  const bxx = bx * halfHeight;
  const byy = by * halfHeight;
  const cxx = ax * ax + bxx * bxx;
  const cxy = ax * ay + bxx * byy;
  const cyy = ay * ay + byy * byy;
  const trace = cxx + cyy;
  const delta = Math.sqrt((cxx - cyy) * (cxx - cyy) + 4 * cxy * cxy);
  const lambdaMajor = Math.max(0, (trace + delta) * 0.5);
  const lambdaMinor = Math.max(0, (trace - delta) * 0.5);
  let angle;
  if (delta < 1e-10) { angle = Math.atan2(ry, rx); }
  else { angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy); }
  return { radiusX: Math.sqrt(lambdaMajor), radiusY: Math.sqrt(lambdaMinor), angle };
}

function _mapFaceLocalPoint(anchor, u, v) {
  return {
    x: anchor.screenX + anchor.rightVec.x * u + anchor.downVec.x * v,
    y: anchor.screenY + anchor.rightVec.y * u + anchor.downVec.y * v,
  };
}

// ---------- 形状曲线 ----------
const _SPHERE_END = 0.26;

function _smoothstep01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function _radiusScale(s) {
  if (s <= _SPHERE_END) {
    const rel = _SPHERE_END - s;
    const r2 = _SPHERE_END * _SPHERE_END - rel * rel;
    return Math.sqrt(Math.max(0, r2)) / _SPHERE_END;
  }
  const TAIL_RATIO = 0.035;
  const t = (s - _SPHERE_END) / (1 - _SPHERE_END) * (Math.PI / 2);
  return TAIL_RATIO + (1 - TAIL_RATIO) * Math.cos(t);
}

function _radiusScaleDeriv(s) {
  const h = 0.002;
  if (s <= h) return (_radiusScale(s + h) - _radiusScale(s)) / h;
  if (s >= 1 - h) return (_radiusScale(s) - _radiusScale(s - h)) / h;
  return (_radiusScale(s + h) - _radiusScale(s - h)) / (2 * h);
}

const _TAIL_BEND_START = 0.72;
function _spineYOffset(s, headY) {
  if (s < _TAIL_BEND_START) return 0;
  const u = (s - _TAIL_BEND_START) / (1 - _TAIL_BEND_START);
  const eased = _smoothstep01(u);
  return -headY * 0.40 * eased * eased;
}
function _spineYOffsetDeriv(s, headY) {
  if (s < _TAIL_BEND_START - 0.01) return 0;
  const h = 0.003;
  const s0 = Math.max(0, s - h);
  const s1 = Math.min(1, s + h);
  return (_spineYOffset(s1, headY) - _spineYOffset(s0, headY)) / (s1 - s0);
}

function _getSection(s, headX, headY, headZ, bodyLength) {
  const sc = _radiusScale(s);
  const scDeriv = _radiusScaleDeriv(s);
  const spineZ = headZ - s * (headZ + bodyLength);
  const spineZDeriv = -(headZ + bodyLength);
  const rx = headX * sc;
  const ry = headY * sc * (0.88 + 0.12 * sc);
  const rxDeriv = headX * scDeriv;
  const ryDeriv = headY * (scDeriv * (0.88 + 0.12 * sc) + sc * (0.12 * scDeriv));
  const spineY = _spineYOffset(s, headY);
  const spineYDeriv = _spineYOffsetDeriv(s, headY);
  return {
    xPos: 0, yPos: spineY, zPos: spineZ,
    rx, ry, rxDeriv, ryDeriv,
    spineZDeriv, spineYDeriv,
    isHead: s <= _SPHERE_END + 0.02,
  };
}

function _getFaceWeight(s, angle) {
  if (s > _SPHERE_END + 0.04) return 0;
  const u = s / _SPHERE_END;
  const distFromFront = u;
  const lat = Math.max(0, Math.cos(angle));
  const falloff = Math.exp(-distFromFront * distFromFront * 2.5) * (0.4 + 0.6 * lat);
  return falloff;
}

// ---------- 主网格生成 ----------
function _createSpindleMesh(options = {}) {
  const {
    headX = 52, headY = 46, headZ = 50, bodyLength = 180,
    columns = 34, rows = 24, flukeEnabled = true, flukeSize = 1.2,
    topColor = '#bdb8aa', bottomColor = '#f2f1ea',
    faceTopColor = '#c8c2b4', faceBottomColor = '#fff8ee',
  } = options;

  const vertices = [];
  const faces = [];

  vertices.push({
    x: 0, y: 0, z: headZ, nx: 0, ny: 0, nz: 1,
    t: 0, angle: 0, col: 0, row: 0,
    isTop: false, isBottom: false, faceWeight: 1.0, isHead: true,
  });
  const APEX_IDX = 0;

  for (let col = 1; col <= columns; col++) {
    const s = col / columns;
    const sec = _getSection(s, headX, headY, headZ, bodyLength);
    const rx = sec.rx, ry = sec.ry;
    const rxDeriv = sec.rxDeriv, ryDeriv = sec.ryDeriv;
    const zDeriv = sec.spineZDeriv, yBendDeriv = sec.spineYDeriv;

    for (let row = 0; row <= rows; row++) {
      const angle = -Math.PI + (row / rows) * 2 * Math.PI;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const x = sec.xPos + rx * cosA;
      const y = sec.yPos + ry * sinA;
      const z = sec.zPos;

      const tthX = -rx * sinA, tthY = ry * cosA, tthZ = 0;
      const tsX = rxDeriv * cosA, tsY = yBendDeriv + ryDeriv * sinA, tsZ = zDeriv;

      let nx = tsY * tthZ - tsZ * tthY;
      let ny = tsZ * tthX - tsX * tthZ;
      let nz = tsX * tthY - tsY * tthX;

      if (s < 0.02) { nx = 0; ny = 0; nz = 1; }

      const nLenRaw = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nLenRaw > 1e-6) { nx /= nLenRaw; ny /= nLenRaw; nz /= nLenRaw; }
      else { nx = 0; ny = 0; nz = 1; }

      const fw = _getFaceWeight(s, angle);
      const isTop = sinA < 0;

      vertices.push({
        x, y, z, nx, ny, nz, t: s, angle, col, row,
        isTop, isBottom: !isTop, faceWeight: fw, isHead: sec.isHead,
      });
    }
  }

  for (let col = 1; col < columns; col++) {
    const colA = 1 + (col - 1) * (rows + 1);
    const colB = colA + (rows + 1);
    for (let row = 0; row < rows; row++) {
      const a = colA + row, b = a + 1, c = colB + row, d = c + 1;
      const va = vertices[a], vb = vertices[b], vc = vertices[c], vd = vertices[d];
      const avgSin = (Math.sin(va.angle) + Math.sin(vb.angle) + Math.sin(vc.angle) + Math.sin(vd.angle)) * 0.25;
      faces.push({
        indices: [a, b, d, c],
        vertices: [va, vb, vd, vc],
        isTop: avgSin < 0, isBottom: avgSin >= 0,
        column: col, row,
      });
    }
  }

  {
    const ringStart = 1;
    for (let row = 0; row < rows; row++) {
      const a = ringStart + row, b = ringStart + row + 1;
      const va = vertices[a], vb = vertices[b], vApex = vertices[APEX_IDX];
      const avgSin = (Math.sin(va.angle) + Math.sin(vb.angle)) * 0.5;
      faces.push({
        indices: [APEX_IDX, a, b],
        vertices: [vApex, va, vb],
        isTop: avgSin < 0, isBottom: avgSin >= 0,
        column: 0, row,
      });
    }
  }

  if (flukeEnabled) {
    const flukeStartIdx = vertices.length;
    const flukeHalfHeight = headY * 0.35 * flukeSize;
    const flukeThickness = headX * 0.08 * flukeSize;
    const tailExtensionZ = 40;
    const flukeTipBackZ = -bodyLength - headZ * 0.2 - tailExtensionZ;

    const lastRingStart = 1 + (columns - 1) * (rows + 1);
    let bodyEndCenterX = 0, bodyEndCenterY = 0, bodyEndCenterZ = 0;
    for (let row = 0; row < rows; row++) {
      bodyEndCenterX += vertices[lastRingStart + row].x;
      bodyEndCenterY += vertices[lastRingStart + row].y;
      bodyEndCenterZ += vertices[lastRingStart + row].z;
    }
    bodyEndCenterX /= rows; bodyEndCenterY /= rows; bodyEndCenterZ /= rows;
    const flukeBaseZ = bodyEndCenterZ - 3;

    const vBase = { x: bodyEndCenterX, y: bodyEndCenterY, z: flukeBaseZ, nx: 0, ny: 0, nz: -1, t: 1.02, angle: 0, col: columns + 1, row: 0, isTop: false, isBottom: false, faceWeight: 0, isHead: false };
    const vTop = { x: bodyEndCenterX, y: bodyEndCenterY - flukeHalfHeight, z: flukeBaseZ - 15, nx: 0, ny: -1, nz: 0, t: 1.05, angle: -Math.PI / 2, col: columns + 1, row: 0, isTop: true, isBottom: false, faceWeight: 0, isHead: false };
    const vBottom = { x: bodyEndCenterX, y: bodyEndCenterY + flukeHalfHeight, z: flukeBaseZ - 15, nx: 0, ny: 1, nz: 0, t: 1.05, angle: Math.PI / 2, col: columns + 1, row: 0, isTop: false, isBottom: true, faceWeight: 0, isHead: false };
    const vTip = { x: bodyEndCenterX, y: bodyEndCenterY - headY * 0.05, z: flukeTipBackZ, nx: 0, ny: 0, nz: -1, t: 1.1, angle: 0, col: columns + 2, row: 0, isTop: true, isBottom: false, faceWeight: 0, isHead: false };
    const vBaseThick = { x: bodyEndCenterX + flukeThickness, y: bodyEndCenterY, z: flukeBaseZ, nx: 1, ny: 0, nz: 0, t: 1.02, angle: 0, col: columns + 1, row: 0, isTop: false, isBottom: false, faceWeight: 0, isHead: false };
    const vTopThick = { x: bodyEndCenterX + flukeThickness * 0.5, y: bodyEndCenterY - flukeHalfHeight, z: flukeBaseZ - 15, nx: 1, ny: 0, nz: 0, t: 1.05, angle: 0, col: columns + 1, row: 0, isTop: true, isBottom: false, faceWeight: 0, isHead: false };
    const vBottomThick = { x: bodyEndCenterX + flukeThickness * 0.5, y: bodyEndCenterY + flukeHalfHeight, z: flukeBaseZ - 15, nx: 1, ny: 0, nz: 0, t: 1.05, angle: 0, col: columns + 1, row: 0, isTop: false, isBottom: true, faceWeight: 0, isHead: false };
    const vTipThick = { x: bodyEndCenterX + flukeThickness * 0.3, y: bodyEndCenterY - headY * 0.05, z: flukeTipBackZ, nx: 1, ny: 0, nz: 0, t: 1.1, angle: 0, col: columns + 2, row: 0, isTop: true, isBottom: false, faceWeight: 0, isHead: false };

    vertices.push(vBase, vTop, vBottom, vTip, vBaseThick, vTopThick, vBottomThick, vTipThick);
    const iBase = flukeStartIdx + 0, iTop = flukeStartIdx + 1, iBottom = flukeStartIdx + 2, iTip = flukeStartIdx + 3;
    const iBaseT = flukeStartIdx + 4, iTopT = flukeStartIdx + 5, iBottomT = flukeStartIdx + 6, iTipT = flukeStartIdx + 7;

    faces.push({ indices: [iBase, iTop, iTip], vertices: [vBase, vTop, vTip], isTop: true, isBottom: false, column: columns + 1, row: 0, doubleSided: true });
    faces.push({ indices: [iBaseT, iTipT, iTopT], vertices: [vBaseThick, vTipThick, vTopThick], isTop: true, isBottom: false, column: columns + 1, row: 0, doubleSided: true });
    faces.push({ indices: [iBase, iTip, iBottom], vertices: [vBase, vTip, vBottom], isTop: false, isBottom: true, column: columns + 1, row: 0, doubleSided: true });
    faces.push({ indices: [iBaseT, iBottomT, iTipT], vertices: [vBaseThick, vBottomThick, vTipThick], isTop: false, isBottom: true, column: columns + 1, row: 0, doubleSided: true });

    let topIdx = lastRingStart, bottomIdx = lastRingStart;
    let topDiff = Infinity, bottomDiff = Infinity;
    for (let row = 0; row < rows; row++) {
      const v = vertices[lastRingStart + row];
      const d1 = Math.abs(v.angle - (-Math.PI / 2));
      const d2 = Math.abs(v.angle - Math.PI / 2);
      if (d1 < topDiff) { topDiff = d1; topIdx = lastRingStart + row; }
      if (d2 < bottomDiff) { bottomDiff = d2; bottomIdx = lastRingStart + row; }
    }
    faces.push({ indices: [topIdx, iBase, iTop], vertices: [vertices[topIdx], vBase, vTop], isTop: true, isBottom: false, column: columns, row: 0 });
    faces.push({ indices: [bottomIdx, iBottom, iBase], vertices: [vertices[bottomIdx], vBottom, vBase], isTop: false, isBottom: true, column: columns, row: 0 });
  }

  return {
    vertices, faces, headX, headY, headZ, headR: headX, bodyLength,
    columns, rows, topColor, bottomColor, faceTopColor, faceBottomColor,
    type: 'spindle',
  };
}

// ---------- 面部锚点 ----------
function _normalizeVec3XYZ(x, y, z, fallback) {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(len) || len < _BASIS_EPSILON) {
    return { x: fallback.x, y: fallback.y, z: fallback.z };
  }
  return { x: x / len, y: y / len, z: z / len };
}

function _crossVec3XYZ(ax, ay, az, bx, by, bz) {
  return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
}

function _computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0.5) {
  const hx = mesh.headX, hy = mesh.headY, hz = mesh.headZ;
  const x = horizOffset, y = vertOffset;
  const invHx2 = 1 / (hx * hx), invHy2 = 1 / (hy * hy), invHz2 = 1 / (hz * hz);
  const inside = 1 - x * x * invHx2 - y * y * invHy2;
  const zSurface = hz * Math.sqrt(Math.max(0.02, inside));
  const z = zSurface + depthOffset;

  const n = _normalizeVec3XYZ(x * invHx2, y * invHy2, zSurface * invHz2, { x: 0, y: 0, z: 1 });
  let t = _normalizeVec3XYZ(zSurface * invHz2, 0, -x * invHx2, { x: 1, y: 0, z: 0 });
  const rawB = _crossVec3XYZ(n.x, n.y, n.z, t.x, t.y, t.z);
  let b = _normalizeVec3XYZ(rawB.x, rawB.y, rawB.z, { x: 0, y: 1, z: 0 });
  const rawT2 = _crossVec3XYZ(b.x, b.y, b.z, n.x, n.y, n.z);
  t = _normalizeVec3XYZ(rawT2.x, rawT2.y, rawT2.z, { x: 1, y: 0, z: 0 });
  const rawB2 = _crossVec3XYZ(n.x, n.y, n.z, t.x, t.y, t.z);
  b = _normalizeVec3XYZ(rawB2.x, rawB2.y, rawB2.z, { x: 0, y: 1, z: 0 });

  return { x, y, z, nx: n.x, ny: n.y, nz: n.z, tx: t.x, ty: t.y, tz: t.z, bx: b.x, by: b.y, bz: b.z, faceWeight: 1.0 };
}

function _computeNostrilSize(headX) {
  return Math.max(2.0, headX * 0.045);
}

// ---------- 变形与旋转 ----------
const _BEND_COEF_YAW = 0.80;
const _BEND_COEF_PITCH = 0.60;

function _bendProfile(s) {
  const t = Math.max(0, Math.min(1, s));
  const faceEnd = 0.08, headEnd = 0.28, tailStart = 0.80;
  if (t <= faceEnd) return 0;
  if (t <= headEnd) {
    const u = (t - faceEnd) / (headEnd - faceEnd);
    return 0.30 * u * u * (3 - 2 * u);
  }
  if (t <= tailStart) {
    const u = (t - headEnd) / (tailStart - headEnd);
    return 0.30 + 0.70 * u * u * (3 - 2 * u);
  }
  return 1;
}

function _applySoftRotation(x, y, z, nx, ny, nz, s, params) {
  const { angleY = 0, angleX = 0, angleZ = 0, tailSway = 0 } = params;
  const bend = _bendProfile(s);
  const effectiveYaw = angleY * (1 - _BEND_COEF_YAW * bend);
  const effectivePitch = angleX * (1 - _BEND_COEF_PITCH * bend);
  const effectiveRoll = angleZ * (1 - 0.6 * bend);

  const radY = effectiveYaw * Math.PI / 180;
  const radX = effectivePitch * Math.PI / 180;
  const radZ = effectiveRoll * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  let x1 = x * cosZ - y * sinZ;
  let y1 = x * sinZ + y * cosZ;
  let z1 = z;
  let nx1 = nx * cosZ - ny * sinZ;
  let ny1 = nx * sinZ + ny * cosZ;
  let nz1 = nz;

  let y2 = y1 * cosX - z1 * sinX;
  let z2 = y1 * sinX + z1 * cosX;
  let x2 = x1;
  let ny2 = ny1 * cosX - nz1 * sinX;
  let nz2 = ny1 * sinX + nz1 * cosX;
  let nx2 = nx1;

  let x3 = x2 * cosY + z2 * sinY;
  let z3 = -x2 * sinY + z2 * cosY;
  let y3 = y2;
  let nx3 = nx2 * cosY + nz2 * sinY;
  let nz3 = -nx2 * sinY + nz2 * cosY;
  let ny3 = ny2;

  if (tailSway !== 0) {
    const swayStart = 0.45;
    const t = s < swayStart ? 0 : Math.max(0, Math.min(1, (s - swayStart) / (1.0 - swayStart)));
    const swayWeight = t * t * (3 - 2 * t);
    const x4 = x3 + tailSway * swayWeight;
    return { x: x4, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
  }
  return { x: x3, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
}

function _deformSpindle(mesh, params = {}) {
  const transformed = mesh.vertices.map((v) => {
    const s = v.t !== undefined ? v.t : 0;
    const r = _applySoftRotation(v.x, v.y, v.z, v.nx, v.ny, v.nz, s, params);
    const newIsTop = r.y < 0;
    const newIsBottom = r.y >= 0;
    return { ...v, tx: r.x, ty: r.y, tz: r.z, nx: r.nx, ny: r.ny, nz: r.nz, isTop: newIsTop, isBottom: newIsBottom };
  });

  const rows = mesh.rows;
  const ringStart = 1;
  let ringCenterX = 0, ringCenterY = 0, ringCenterZ = 0;
  for (let row = 0; row <= rows; row++) {
    ringCenterX += transformed[ringStart + row].tx;
    ringCenterY += transformed[ringStart + row].ty;
    ringCenterZ += transformed[ringStart + row].tz;
  }
  ringCenterX /= (rows + 1); ringCenterY /= (rows + 1); ringCenterZ /= (rows + 1);
  const BLEND = 0.15;
  transformed[0].tx = transformed[0].tx * (1 - BLEND) + ringCenterX * BLEND;
  transformed[0].ty = transformed[0].ty * (1 - BLEND) + ringCenterY * BLEND;
  transformed[0].tz = transformed[0].tz * (1 - BLEND) + ringCenterZ * BLEND;

  const transformedFaces = mesh.faces.map((f) => ({
    ...f,
    vertices: f.indices.map((idx) => transformed[idx]),
  }));
  return { ...mesh, vertices: transformed, faces: transformedFaces };
}

// ---------- 参数归一化 ----------
function _normalizeParams(p) {
  return {
    eyeLeft: _clamp(p.eyeLeft ?? 1, 0, 1),
    eyeRight: _clamp(p.eyeRight ?? 1, 0, 1),
    eyeWideLeft: _clamp(p.eyeWideLeft ?? 0, 0, 1),
    eyeWideRight: _clamp(p.eyeWideRight ?? 0, 0, 1),
    eyeSquintLeft: _clamp(p.eyeSquintLeft ?? 0, 0, 1),
    eyeSquintRight: _clamp(p.eyeSquintRight ?? 0, 0, 1),
    mouthOpen: _clamp(p.mouthOpen ?? 0, 0, 1),
    mouthSmile: _clamp(p.mouthSmile ?? 0, 0, 1),
    mouthFunnel: _clamp(p.mouthFunnel ?? 0, 0, 1),
    mouthPress: _clamp(p.mouthPress ?? 0, 0, 1),
    browLeft: _clamp(p.browLeft ?? 0, 0, 1),
    browRight: _clamp(p.browRight ?? 0, 0, 1),
    headYaw: (_clamp(p.headYaw ?? 0.5, 0, 1) - 0.5) * 120,
    headPitch: (_clamp(p.headPitch ?? 0.5, 0, 1) - 0.5) * 90,
    headRoll: (_clamp(p.headRoll ?? 0.5, 0, 1) - 0.5) * 80,
    headX: _clamp(p.headX ?? 0.5, 0, 1),
    headY: _clamp(p.headY ?? 0.5, 0, 1),
    gazeLeftX: _clamp(p.gazeLeftX ?? 0, -1, 1),
    gazeLeftY: _clamp(p.gazeLeftY ?? 0, -1, 1),
    gazeRightX: _clamp(p.gazeRightX ?? 0, -1, 1),
    gazeRightY: _clamp(p.gazeRightY ?? 0, -1, 1),
    lightDir: p.lightDir,
    ambient: p.ambient,
  };
}

// ---------- 3D 渲染器基类 ----------
class _ProceduralMeshRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error(`Canvas "${canvasId}" not found`);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0, headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.mirror = true;
    this.appMode = false;
    this.debugMesh = false;
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = !!enabled;
    this.draw();
  }

  resize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const parent = this.canvas.parentElement;
    const cssW = Math.max(100, parent.clientWidth);
    const cssH = Math.max(100, parent.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const newW = Math.round(cssW * dpr);
    const newH = Math.round(cssH * dpr);
    if (this.canvas.width !== newW || this.canvas.height !== newH) {
      this.canvas.width = newW;
      this.canvas.height = newH;
    }
  }

  draw() {
    this.resize();
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.appMode) {
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = 'transparent';
      ctx.clearRect(0, 0, w, h);
    }

    this._render(ctx, w, h);
  }

  _render(ctx, w, h) { /* noop */ }

  _drawMesh(ctx, mesh, options) {
    const { w, h, scale, originX, originY, baseColorTop, baseColorBottom, faceTopColor, faceBottomColor, lightDir, ambient } = options;
    const vertices = mesh.vertices;
    const faces = mesh.faces;
    if (!vertices || !faces || faces.length === 0) return;

    const cullThreshold = options.cullThreshold !== undefined ? options.cullThreshold : -0.05;

    const projected = new Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const tx = (v.tx !== undefined ? v.tx : v.x);
      const ty = (v.ty !== undefined ? v.ty : v.y);
      const tz = (v.tz !== undefined ? v.tz : v.z);
      projected[i] = { sx: originX + tx * scale, sy: originY + ty * scale, sz: tz, nx: v.nx ?? 0, ny: v.ny ?? 0, nz: v.nz ?? 0, v };
    }

    const drawList = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const idxs = f.indices;
      const nPoints = idxs.length;
      let avgSz = 0, avgNx = 0, avgNy = 0, avgNz = 0;
      for (let k = 0; k < nPoints; k++) {
        const p = projected[idxs[k]];
        avgSz += p.sz; avgNx += p.nx; avgNy += p.ny; avgNz += p.nz;
      }
      avgSz /= nPoints; avgNx /= nPoints; avgNy /= nPoints; avgNz /= nPoints;
      const nLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz) || 1;

      if (!f.doubleSided) {
        const facing = avgNz / nLen;
        if (facing < cullThreshold) continue;
      }

      let isTop = false;
      if (f.isTop !== undefined) { isTop = f.isTop; }
      else {
        let origYSum = 0;
        for (let k = 0; k < nPoints; k++) origYSum += f.vertices[k].y;
        isTop = (origYSum / nPoints) < 0;
      }

      let faceWeight = 0;
      for (let k = 0; k < nPoints; k++) {
        const vv = f.vertices[k];
        if (vv && typeof vv.faceWeight === 'number') faceWeight += vv.faceWeight;
      }
      faceWeight /= nPoints;

      let base = (isTop ? baseColorTop : baseColorBottom);
      if (faceWeight > 0.01 && faceTopColor && faceBottomColor) {
        const faceBase = isTop ? faceTopColor : faceBottomColor;
        base = _lerpColor(base, faceBase, faceWeight);
      }

      const lit = _applyLight({ x: avgNx / nLen, y: avgNy / nLen, z: avgNz / nLen }, lightDir, base, ambient);

      const polyPoints = new Array(nPoints);
      for (let k = 0; k < nPoints; k++) {
        const p = projected[idxs[k]];
        polyPoints[k] = [p.sx, p.sy];
      }

      drawList.push({
        points: polyPoints, avgZ: avgSz, fill: lit,
        stroke: this.debugMesh ? 'rgba(255,255,255,0.4)' : null,
      });
    }

    drawList.sort((a, b) => a.avgZ - b.avgZ);

    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      ctx.beginPath();
      const points = d.points;
      ctx.moveTo(points[0][0], points[0][1]);
      for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
      ctx.closePath();
      ctx.fillStyle = d.fill;
      ctx.fill();
      if (d.stroke) {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    return { projected };
  }

  _transformVec(x, y, z, rotParams) {
    const radY = rotParams.angleY * Math.PI / 180;
    const radX = rotParams.angleX * Math.PI / 180;
    const radZ = rotParams.angleZ * Math.PI / 180;
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

    let x1 = x * cosZ - y * sinZ;
    let y1 = x * sinZ + y * cosZ;
    let z1 = z;
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;
    let x3 = x2 * cosY + z2 * sinY;
    let z3 = -x2 * sinY + z2 * cosY;
    let y3 = y2;
    return { x: x3, y: y3, z: z3 };
  }

  _transformAnchor(local, rotParams, originX, originY, scale) {
    const p = this._transformVec(local.x, local.y, local.z, rotParams);
    const basis = _buildFaceBasis(local);
    const n = this._transformVec(basis.n.x, basis.n.y, basis.n.z, rotParams);
    const t = this._transformVec(basis.t.x, basis.t.y, basis.t.z, rotParams);
    const b = this._transformVec(basis.b.x, basis.b.y, basis.b.z, rotParams);
    return {
      worldX: p.x, worldY: p.y, worldZ: p.z,
      screenX: originX + p.x * scale, screenY: originY + p.y * scale,
      nx: n.x, ny: n.y, nz: n.z,
      rightVec: { x: t.x, y: t.y, z: t.z },
      downVec: { x: b.x, y: b.y, z: b.z },
      rightLen: Math.sqrt(t.x * t.x + t.y * t.y),
      downLen: Math.sqrt(b.x * b.x + b.y * b.y),
    };
  }
}

// ---------- 3D 萨卡班甲鱼渲染器 ----------
const _SPINDLE_DEFAULT_LIGHT_DIR = { x: -0.3, y: -0.5, z: 0.8 };
const _SPINDLE_DEFAULT_AMBIENT = 0.58;

class _ProceduralSpindleWhaleAvatar extends _ProceduralMeshRenderer {
  constructor(canvasId, options = {}) {
    super(canvasId);
    this._modelOptions = {
      headX: 70, headY: 58, headZ: 54,
      bodyLength: 210, bodyEndX: 9, bodyEndY: 5,
      tailLength: 35, columns: 42, rows: 35,
      topColor: '#c3b681', bottomColor: '#eee1bc',
      faceTopColor: '#d1c394', faceBottomColor: '#f4e8c8',
    };
    this.spindleMesh = _createSpindleMesh(this._modelOptions);
    this.baseYaw = 0; this.basePitch = 0; this.baseRoll = 0;
    this.lightDir = options.lightDir ?? { ..._SPINDLE_DEFAULT_LIGHT_DIR };
    this.ambient = options.ambient ?? _SPINDLE_DEFAULT_AMBIENT;
    this._lastYaw = 0; this._yawVelocity = 0; this._tailSway = 0;
    this._tailSwayDecay = 0.92;
    this.draw();
  }

  getAnchors(params) {
    const mesh = this.spindleMesh;
    const hx = mesh.headX, hy = mesh.headY;
    const eyeSpacing = hx * 0.30;
    const eyeHeight = -hy * 0.28;
    const mouthHeight = hy * 0.06;
    const mouthHalfWidth = hx * 0.20;
    const browOffset = -hy * 0.62;
    const browSpacing = hx * 0.30;
    return {
      leftEye: { bodyT: 0, horizOffset: -eyeSpacing, vertOffset: eyeHeight, surfaceOffset: 0.5 },
      rightEye: { bodyT: 0, horizOffset: eyeSpacing, vertOffset: eyeHeight, surfaceOffset: 0.5 },
      mouth: { bodyT: 0, horizOffset: 0, vertOffset: mouthHeight, surfaceOffset: 0.5, mouthWidth: mouthHalfWidth },
      browLeft: { bodyT: 0, horizOffset: -browSpacing, vertOffset: browOffset, surfaceOffset: 0.8 },
      browRight: { bodyT: 0, horizOffset: browSpacing, vertOffset: browOffset, surfaceOffset: 0.8 },
    };
  }

  _render(ctx, w, h) {
    const np = _normalizeParams(this.params);
    const rot = {
      angleY: np.headYaw + this.baseYaw,
      angleX: np.headPitch + this.basePitch,
      angleZ: np.headRoll + this.baseRoll,
    };

    const currentYaw = np.headYaw;
    this._yawVelocity = currentYaw - this._lastYaw;
    this._lastYaw = currentYaw;
    const maxSway = 15;
    const swayTarget = -this._yawVelocity * 40;
    this._tailSway = this._tailSway * this._tailSwayDecay + swayTarget * (1 - this._tailSwayDecay);
    this._tailSway = Math.max(-maxSway, Math.min(maxSway, this._tailSway));
    rot.tailSway = this._tailSway;

    const minSide = Math.min(w, h);
    const headDiameter = this.spindleMesh.headX * 2;
    const margin = 0.18;
    const scale = (minSide * (1 - margin * 2)) / headDiameter;
    const originX = w * 0.5 + (np.headX - 0.5) * minSide * 0.22;
    const originY = h * 0.48 + (np.headY - 0.5) * minSide * 0.18;

    const renderLightDir = np.lightDir ?? this.lightDir;
    const renderAmbient = np.ambient ?? this.ambient;

    const deformedBody = _deformSpindle(this.spindleMesh, rot);
    this._drawMesh(ctx, deformedBody, {
      w, h, scale, originX, originY,
      baseColorTop: this.spindleMesh.topColor,
      baseColorBottom: this.spindleMesh.bottomColor,
      faceTopColor: this.spindleMesh.faceTopColor,
      faceBottomColor: this.spindleMesh.bottomColor,
      lightDir: renderLightDir,
      cullThreshold: -0.15,
      ambient: renderAmbient,
    });

    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);
    const mesh = this.spindleMesh;
    const eyeBase = Math.max(8, mesh.headX * 0.25);

    const drawEye = (anchor, openness, eyeWide, eyeSquint, gazeX, gazeY) => {
      const local = _computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = _clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;

      const eyeHalfW = eyeBase * scale;
      const eyeHalfH = eyeBase * scale;
      const proj = _computeProjectedEllipse(t.rightVec.x, t.rightVec.y, t.downVec.x, t.downVec.y, eyeHalfW, eyeHalfH);
      let rx = Math.max(0.1, proj.radiusX);
      let ry = Math.max(0.1, proj.radiusY);

      const wideScale = 1 + (eyeWide || 0) * 0.47;
      rx *= wideScale; ry *= wideScale;
      const squintScaleY = 1 - (eyeSquint || 0) * 0.55;
      const squintScaleX = 1 + (eyeSquint || 0) * 0.08;
      rx *= squintScaleX; ry *= squintScaleY;
      const ang = proj.angle;

      const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
      const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
      const easedClosed = 1 - easedOpen;

      const irisScale = 0.50;
      const pupilScale = 0.28;
      const irisR = Math.min(rx, ry) * irisScale;
      const pupilR2 = Math.min(rx, ry) * pupilScale;

      const maxOffsetX = Math.max(0, rx - irisR) * 0.55;
      const maxOffsetY = Math.max(0, ry - irisR) * 0.55;
      const gazeOffsetX = (gazeX || 0) * maxOffsetX;
      const gazeOffsetY = (gazeY || 0) * maxOffsetY;
      const irisCX = t.screenX + gazeOffsetX;
      const irisCY = t.screenY + gazeOffsetY;

      ctx.save();
      ctx.globalAlpha = facing;

      if (easedOpen < 0.12) {
        const closedH = ry * 0.08;
        ctx.beginPath();
        ctx.moveTo(t.screenX - rx * 0.85, t.screenY);
        ctx.quadraticCurveTo(t.screenX, t.screenY + closedH, t.screenX + rx * 0.85, t.screenY);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = Math.max(1.5, 2.5 * scale);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(t.screenX, t.screenY, rx, ry, ang, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = Math.max(1, 2.0 * scale);
        ctx.strokeStyle = '#222';
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(t.screenX, t.screenY, rx - 1, ry - 1, ang, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(irisCX, irisCY, irisR, irisR * (ry / Math.max(rx, 0.1)) * 0.85, ang, 0, Math.PI * 2);
        ctx.fillStyle = '#7a6b5c';
        ctx.globalAlpha = Math.max(0.4, facing) * easedOpen;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(irisCX, irisCY, pupilR2, pupilR2 * (ry / Math.max(rx, 0.1)) * 0.85, ang, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        if (easedOpen > 0.5) {
          const hlX = irisCX + irisR * 0.3;
          const hlY = irisCY - irisR * 0.3;
          ctx.beginPath();
          ctx.arc(hlX, hlY, Math.max(1, irisR * 0.15), 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = Math.max(0.3, facing) * 0.7;
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = facing;
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise) => {
      const local = _computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = _clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const len = mesh.headX * 0.26 * scale;
      const upAmt = raise * 8 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);
      ctx.beginPath();
      const left = _mapFaceLocalPoint(t, -len * 0.5, -upAmt);
      const peak = _mapFaceLocalPoint(t, 0, -upAmt * 1.2);
      const right = _mapFaceLocalPoint(t, len * 0.5, -upAmt);
      ctx.moveTo(left.x, left.y);
      ctx.quadraticCurveTo(peak.x, peak.y, right.x, right.y);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile, mouthFunnel, mouthPress) => {
      const local = _computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = _clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const smileWiden = 1 + smile * 0.40;
      const effectiveOpen = Math.max(0, open - (mouthPress || 0) * 0.3);
      const funnelNarrow = 1 - (mouthFunnel || 0) * 0.5;
      const funnelTall = 1 + (mouthFunnel || 0) * 0.8;
      const halfW = (anchor.mouthWidth || mesh.headX * 0.28) * scale * smileWiden * funnelNarrow;
      const openH = (3 * scale + 12 * scale * effectiveOpen) * funnelTall;
      const cornerUp = smile * 3 * scale;
      const centerDown = smile * 5 * scale + effectiveOpen * openH * 0.5;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);

      if (effectiveOpen < 0.05 && smile < 0.1) {
        const left = _mapFaceLocalPoint(t, -halfW, cornerUp);
        const right = _mapFaceLocalPoint(t, halfW, cornerUp);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      } else if (effectiveOpen < 0.05) {
        const left = _mapFaceLocalPoint(t, -halfW, cornerUp);
        const mid = _mapFaceLocalPoint(t, 0, centerDown - 2 * scale);
        const right = _mapFaceLocalPoint(t, halfW, cornerUp);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.quadraticCurveTo(mid.x, mid.y, right.x, right.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4a2020';
        const left = _mapFaceLocalPoint(t, -halfW, cornerUp);
        const topMid = _mapFaceLocalPoint(t, 0, centerDown - openH * 0.85);
        const right = _mapFaceLocalPoint(t, halfW, cornerUp);
        const botMid = _mapFaceLocalPoint(t, 0, centerDown + openH * 0.15);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.quadraticCurveTo(topMid.x, topMid.y, right.x, right.y);
        ctx.quadraticCurveTo(botMid.x, botMid.y, left.x, left.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    const hx = mesh.headX, hy = mesh.headY;
    const nostrilHoriz = hx * 0.06;
    const nostrilVert = -hy * 0.06;
    const nostrilSize = _computeNostrilSize(hx);
    const drawNostril = (hSign) => {
      const local = _computeFaceAnchorXYZ(mesh, 0, nostrilHoriz * hSign, nostrilVert, 0.2);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = _clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      ctx.save();
      ctx.globalAlpha = 0.8 * facing;
      ctx.beginPath();
      const halfW = nostrilSize * scale;
      const halfH = nostrilSize * scale;
      const proj = _computeProjectedEllipse(t.rightVec.x, t.rightVec.y, t.downVec.x, t.downVec.y, halfW, halfH);
      ctx.ellipse(t.screenX, t.screenY,
        Math.max(0.1, proj.radiusX), Math.max(0.1, proj.radiusY),
        proj.angle, 0, Math.PI * 2);
      ctx.fillStyle = '#8a7a4a';
      ctx.fill();
      ctx.restore();
    };

    drawEye(anchors.leftEye, np.eyeLeft, np.eyeWideLeft, np.eyeSquintLeft, np.gazeLeftX, np.gazeLeftY);
    drawEye(anchors.rightEye, np.eyeRight, np.eyeWideRight, np.eyeSquintRight, np.gazeRightX, np.gazeRightY);
    drawBrow(anchors.browLeft, np.browLeft);
    drawBrow(anchors.browRight, np.browRight);
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile, np.mouthFunnel, np.mouthPress);
    drawNostril(-1);
    drawNostril(+1);
  }
}
