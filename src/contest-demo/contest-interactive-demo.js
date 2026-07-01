/**
 * CheapLive Contest Interactive Demo — Main JS
 * 纯本地运行，无外部依赖
 */

// ====== STATE ======
const state = {
  currentAvatar: 'sacabambaspis3d',
  showcaseMode: false,
  drawMode: false,
  captureOn: true,
  voiceOn: false,
  voicePreset: 'original',
  guideStep: 0,
  appMode: false,
  faceScale: 1.0,
  mouthSensitivity: 1.0, 
  blinkSensitivity: 1.0,
  smileSensitivity: 1.0,
  keyColor: '#00ff00',
  floatingMode: 'edit', // 'edit' | 'display'
  // Simulated face params
  // Unified face state (updated by real tracker or simulated)
  faceParams: {
    mouthOpen: 0, blink: 0, yaw: 0.5, pitch: 0.5, smile: 0,
    eyeLeft: 1, eyeRight: 1, faceDetected: false,
  },
  micLevel: 0,
  micMonitorOn: false,
  effectMode: 'off',
  processedLevel: 0,
};

const VOICE_PRESETS = [
  { id: 'off', name: '原声' },
  { id: 'robot', name: '机器人' },
  { id: 'lowpass', name: '低通' },
  { id: 'monster', name: '怪兽' },
];

const AVATAR_NAMES = {
  sacabambaspis3d: '3D Sacabambaspis',
  sacabambaspis: '2D 萨卡班',
  cat: '猫 Cat',
  dog: '狗 Dog',
  rabbit: '兔子 Rabbit',
  fox: '狐狸 Fox',
  bear: '小熊 Bear',
};

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
      <div class="info">中间面板显示 Receiver：选择动物形象（3D/2D 萨卡班甲鱼 / 猫 / 更多动物），点击"应用模式"将背景设为透明，准备作为网页小窗显示。</div>
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
  scale = scale || 1;
  const cx = w / 2;
  const cy = h / 2;
  const isShowcase = state.showcaseMode;

  if (avatar === 'sacabambaspis3d') {
    if (isShowcase) {
      // Transparent bg + draw 3D avatar
      ctx.clearRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, w, h);
    }
    // Insert 3D draw function inline
    drawSacabambaspis3D(ctx, cx, cy, params, scale);
  } else if (avatar === 'sacabambaspis') {
    if (isShowcase) {
      ctx.clearRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.clearRect(0, 0, w, h);
    if (!isShowcase) {
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, w, h);
    }
    drawSacabambaspis(ctx, cx, cy, params, scale);
  } else if (avatar === 'cat') {
    ctx.clearRect(0, 0, w, h);
    if (!isShowcase) {
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, w, h);
    }
    drawCat(ctx, cx, cy, params, scale);
  } else {
    ctx.clearRect(0, 0, w, h);
    if (!isShowcase) {
      ctx.fillStyle = '#0d1420';
      ctx.fillRect(0, 0, w, h);
    }
    drawPlaceholder(ctx, cx, cy, avatar, scale);
  }
}

function drawSacabambaspis(ctx, cx, cy, p, s) {
  const mouth = Math.max(0, Math.min(1, p.mouthOpen || 0));
  const blinkR = Math.max(0, Math.min(1, 1 - (p.eyeRight !== undefined ? p.eyeRight : (1 - (p.blink || 0)))));
  const yawOffset = ((p.yaw || 0.5) - 0.5) * 40 * s;
  const pitchOffset = ((p.pitch || 0.5) - 0.5) * 15 * s;
  const smile = Math.max(0, Math.min(1, p.smile || 0));
  const mouthH = (mouth + smile * 0.3) * 12 * s;
  const eyeH = Math.max(1, (1 - blinkR) * 6 * s);

  ctx.save();
  ctx.translate(cx + yawOffset * 0.4, cy + pitchOffset);

  // Body (ellipse)
  ctx.fillStyle = '#e4e1d3';
  ctx.beginPath();
  ctx.ellipse(0, 0, 70 * s, 35 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = 'rgba(120,115,100,0.3)';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  // Back shading
  ctx.fillStyle = 'rgba(138,135,120,0.25)';
  ctx.beginPath();
  ctx.ellipse(-10 * s, 0, 55 * s, 25 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Armor plates (decorative)
  ctx.strokeStyle = 'rgba(160,155,135,0.2)';
  ctx.lineWidth = 1 * s;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-30 * s, i * 18 * s);
    ctx.quadraticCurveTo(-5 * s, i * 22 * s, 30 * s, i * 18 * s);
    ctx.stroke();
  }

  // Dorsal fin
  ctx.fillStyle = '#c8c4b4';
  ctx.beginPath();
  ctx.moveTo(-15 * s, -30 * s);
  ctx.lineTo(-30 * s, -55 * s);
  ctx.lineTo(5 * s, -30 * s);
  ctx.closePath();
  ctx.fill();

  // Mouth (triangular wedge style)
  const mouthOpen = mouth + smile * 0.5;
  if (mouthOpen > 0.02) {
    const tipY = 12 * s * mouthOpen;
    const hw = 10 * s;
    ctx.fillStyle = '#2a1810';
    ctx.beginPath();
    ctx.moveTo(55 * s - hw, 5 * s);
    ctx.quadraticCurveTo(55 * s, 5 * s - tipY * 0.4, 55 * s + hw, 5 * s);
    ctx.lineTo(55 * s, 5 * s + tipY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a0f08';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.stroke();
  }

  // Eyes (two separate eyes for independent blink)
  const drawEye = (ex, ey) => {
    const eh = Math.max(1, (1 - (1 - (p.eyeRight || 1))) * 6 * s);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex * s, -12 * s, 7 * s, eh, 0, 0, Math.PI * 2);
    ctx.fill();
    if (eh > 2) {
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(ex * s + 2 * s, -12 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex * s + 3 * s, -13 * s, 1.3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawEye(25, p.eyeLeft !== undefined ? p.eyeLeft : 1);
  drawEye(40, p.eyeRight !== undefined ? p.eyeRight : 1);

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

function drawSacabambaspis3D(ctx, cx, cy, p, s) {
  const mouth = Math.max(0, Math.min(1, p.mouthOpen || 0));
  const blinkL = 1 - Math.max(0, Math.min(1, 1 - (p.eyeLeft !== undefined ? p.eyeLeft : 1)));
  const blinkR = 1 - Math.max(0, Math.min(1, 1 - (p.eyeRight !== undefined ? p.eyeRight : 1)));
  const yawNorm = (p.yaw || 0.5) - 0.5;
  const pitchNorm = (p.pitch || 0.5) - 0.5;
  const smile = Math.max(0, Math.min(1, p.smile || 0));

  ctx.save();
  ctx.translate(cx, cy);

  // ===== 3D Body: shadow -> base -> highlight layers =====
  // Shadow drop
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(4 * s, 6 * s, 68 * s, 34 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body gradient (top-bottom for 3D volume)
  const bodyGrad = ctx.createLinearGradient(0, -35 * s, 0, 35 * s);
  bodyGrad.addColorStop(0, '#dad5c4');
  bodyGrad.addColorStop(0.35, '#e8e4d8');
  bodyGrad.addColorStop(0.55, '#f2efe5');
  bodyGrad.addColorStop(0.8, '#d4cfbc');
  bodyGrad.addColorStop(1, '#b8b29a');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 70 * s, 35 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = 'rgba(100,95,80,0.35)';
  ctx.lineWidth = 1.8 * s;
  ctx.stroke();

  // ===== Armor plates (3D perspective lines) =====
  ctx.strokeStyle = 'rgba(140,130,105,0.3)';
  ctx.lineWidth = 1.8 * s;
  // Horizontal bands
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-50 * s, i * 20 * s);
    ctx.quadraticCurveTo(5 * s, i * 24 * s, 50 * s, i * 18 * s);
    ctx.stroke();
  }
  // Vertical center line (dorsal ridge)
  ctx.strokeStyle = 'rgba(160,150,120,0.25)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(0, -30 * s);
  ctx.quadraticCurveTo(8 * s, 0, 0, 32 * s);
  ctx.stroke();
  // Side armor lines
  ctx.strokeStyle = 'rgba(130,120,95,0.18)';
  ctx.lineWidth = 1.2 * s;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(side * 20 * s, -22 * s);
    ctx.quadraticCurveTo(side * 25 * s, 5 * s, side * 15 * s, 28 * s);
    ctx.stroke();
  }

  // ===== 3D rotation effect via yaw/pitch shading =====
  if (Math.abs(yawNorm) > 0.02) {
    const shadeAlpha = Math.min(0.35, Math.abs(yawNorm) * 0.5);
    const shadeDir = yawNorm > 0 ? -1 : 1;
    const shadeGrad = ctx.createLinearGradient(shadeDir * 60 * s, 0, shadeDir * -40 * s, 0);
    shadeGrad.addColorStop(0, 'rgba(80,70,50,' + shadeAlpha + ')');
    shadeGrad.addColorStop(0.5, 'rgba(80,70,50,0)');
    shadeGrad.addColorStop(1, 'rgba(255,255,240,' + (shadeAlpha * 0.6) + ')');
    ctx.fillStyle = shadeGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 70 * s, 35 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== Dorsal fin (3D) =====
  ctx.fillStyle = '#c0baa8';
  ctx.beginPath();
  ctx.moveTo(-18 * s, -28 * s);
  ctx.lineTo(-35 * s, -58 * s);
  ctx.lineTo(-5 * s, -52 * s);
  ctx.lineTo(5 * s, -28 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,95,80,0.3)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  // Fin highlight
  ctx.fillStyle = 'rgba(220,215,200,0.4)';
  ctx.beginPath();
  ctx.moveTo(-15 * s, -30 * s);
  ctx.lineTo(-30 * s, -52 * s);
  ctx.lineTo(-10 * s, -46 * s);
  ctx.lineTo(2 * s, -30 * s);
  ctx.closePath();
  ctx.fill();

  // ===== Mouth (triangular wedge, 3D depth) =====
  const mouthOpen = mouth + smile * 0.5;
  if (mouthOpen > 0.02) {
    const tipY = 14 * s * mouthOpen;
    const hw = 12 * s;
    // Mouth cavity shadow
    ctx.fillStyle = '#1a0f08';
    ctx.beginPath();
    ctx.moveTo(55 * s - hw, 3 * s);
    ctx.quadraticCurveTo(55 * s, 3 * s - tipY * 0.3, 55 * s + hw, 3 * s);
    ctx.lineTo(55 * s, 3 * s + tipY);
    ctx.closePath();
    ctx.fill();
    // Mouth inner highlight
    if (mouthOpen > 0.1) {
      ctx.fillStyle = 'rgba(60,25,10,0.6)';
      ctx.beginPath();
      ctx.ellipse(55 * s, 3 * s + tipY * 0.5, 5 * s, tipY * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#0f0805';
    ctx.lineWidth = Math.max(1.2, 2 * s);
    ctx.stroke();
  }

  // ===== Eyes (two independent eyes with 3D sockets) =====
  const drawEye3D = (ex, eyeOpen) => {
    const eOpen = Math.max(0.05, eyeOpen);
    const eh = eOpen * 6 * s;
    // Eye socket shadow
    ctx.fillStyle = 'rgba(60,50,40,0.25)';
    ctx.beginPath();
    ctx.ellipse(ex * s, -11 * s, 9 * s, eh + 1.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sclera (white)
    ctx.fillStyle = '#fafaf7';
    ctx.beginPath();
    ctx.ellipse(ex * s, -11 * s, 7.5 * s, eh, 0, 0, Math.PI * 2);
    ctx.fill();
    if (eh > 1.5) {
      // Iris
      ctx.fillStyle = '#2a1a0e';
      ctx.beginPath();
      ctx.arc(ex * s + 1 * s, -11 * s, 3.8 * s, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#0a0808';
      ctx.beginPath();
      ctx.arc(ex * s + 1.5 * s, -11 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex * s + 2.5 * s, -12.5 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
      // Small secondary highlight
      ctx.beginPath();
      ctx.arc(ex * s - 0.5 * s, -10 * s, 0.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawEye3D(26, p.eyeLeft !== undefined ? p.eyeLeft : 1);
  drawEye3D(42, p.eyeRight !== undefined ? p.eyeRight : 1);

  // ===== Tail fin (3D layered) =====
  const tailSway = Math.sin(Date.now() * 0.002) * 3 * s;
  ctx.fillStyle = '#b8b298';
  ctx.beginPath();
  ctx.moveTo(-62 * s, -2 * s);
  ctx.quadraticCurveTo(-78 * s, -24 * s + tailSway, -88 * s, -10 * s + tailSway);
  ctx.quadraticCurveTo(-78 * s, 0, -62 * s, 4 * s);
  ctx.quadraticCurveTo(-78 * s, 4 * s + tailSway, -88 * s, 16 * s + tailSway);
  ctx.quadraticCurveTo(-78 * s, 24 * s + tailSway, -62 * s, 2 * s);
  ctx.closePath();
  ctx.fill();
  // Tail highlight
  ctx.fillStyle = 'rgba(210,200,180,0.5)';
  ctx.beginPath();
  ctx.moveTo(-62 * s, -1 * s);
  ctx.quadraticCurveTo(-76 * s, -16 * s + tailSway, -82 * s, -6 * s + tailSway);
  ctx.quadraticCurveTo(-76 * s, 0, -62 * s, 3 * s);
  ctx.closePath();
  ctx.fill();

  // ===== Pectoral fins (side) =====
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = 'rgba(180,175,155,0.7)';
    ctx.beginPath();
    ctx.moveTo(side * 30 * s, 20 * s);
    ctx.quadraticCurveTo(side * 50 * s, 30 * s, side * 40 * s, 22 * s);
    ctx.quadraticCurveTo(side * 35 * s, 15 * s, side * 28 * s, 18 * s);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawCat(ctx, cx, cy, p, s) {
  const mouth = Math.max(0, Math.min(1, p.mouthOpen || 0));
  const blinkR = Math.max(0, Math.min(1, 1 - (p.eyeRight !== undefined ? p.eyeRight : (1 - (p.blink || 0)))));
  const yawOffset = ((p.yaw || 0.5) - 0.5) * 30 * s;
  const pitchOffset = ((p.pitch || 0.5) - 0.5) * 12 * s;
  const smile = Math.max(0, Math.min(1, p.smile || 0));
  const eyeH = Math.max(1, (1 - blinkR) * 7 * s);
  const mouthOpen = (mouth + smile * 0.4) * 6 * s;

  ctx.save();
  ctx.translate(cx + yawOffset * 0.35, cy + pitchOffset);

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
  ctx.fillText('（' + (AVATAR_NAMES[avatar] || avatar) + ' 开发中)', cx, cy + 14 * s);
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
  btn.style.transform = 'none';
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
  btn.style.transform = 'none';
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
    state.faceParams.yaw = 0.5 + 0.5 * Math.sin(simTime * 0.5);
    state.faceParams.pitch = 0.5 + 0.3 * Math.sin(simTime * 0.7);
    state.faceParams.smile = 0.3 + 0.3 * Math.sin(simTime * 0.8);
    state.faceParams.eyeLeft = 1 - state.faceParams.blink * 0.8;
    state.faceParams.eyeRight = 1 - state.faceParams.blink * 0.8;
  }

  // MicLevel-assisted mouthOpen fallback when no face detected
  if (_faceLandmarker && !state.faceParams.faceDetected && state.micLevel > 0.02) {
    const micMouth = Math.min(1, state.micLevel * 2.5);
    state.faceParams.mouthOpen = Math.max(state.faceParams.mouthOpen || 0, micMouth * 0.6);
  }

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
  const fwContent = document.getElementById('fwContent');
  // Always use keyColor when showcaseMode is on (both edit and display)
  if (fwContent) {
    fwContent.style.background = state.showcaseMode ? state.keyColor : '';
  }
  if (fwCtx && fc) {
    drawAvatar(fwCtx, fc.width, fc.height, state.currentAvatar, state.faceParams, fc.width / 360);
  }

  // Update guide params if open
  const gm = document.getElementById('guideMouth');
  if (gm) gm.textContent = state.faceParams.mouthOpen.toFixed(2);
  const gb = document.getElementById('guideBlink');
  if (gb) gb.textContent = state.faceParams.blink.toFixed(2);
  const gy = document.getElementById('guideYaw');
  if (gy) gy.textContent = state.faceParams.yaw.toFixed(2);

  // Update face params live display
  const fd = document.getElementById('fpDetected');
  if (fd) fd.textContent = _faceLandmarker ? '已检测' : '—';
  const fpm = document.getElementById('fpMouth');
  if (fpm) fpm.textContent = state.faceParams.mouthOpen.toFixed(2);
  const fpb = document.getElementById('fpBlink');
  if (fpb) fpb.textContent = state.faceParams.blink.toFixed(2);
  const fps = document.getElementById('fpSmile');
  if (fps) fps.textContent = state.faceParams.smile.toFixed(2);
  const fpy = document.getElementById('fpYaw');
  if (fpy) fpy.textContent = state.faceParams.yaw.toFixed(2);

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
async function toggleCapture() {
  if (_faceLandmarker || _faceVideoStream) {
    stopFaceTracking();
  } else {
    await startFaceTracking();
  }
}

async function toggleVoice() {
  if (_micAudioContext) {
    stopMicLevel();
  } else {
    await startMicLevel();
  }
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
  const btn = document.body.querySelector('button[onclick*="toggleShowcase"]');
  body.classList.toggle('showcase-mode', state.showcaseMode);
  if (btn) btn.textContent = state.showcaseMode ? '返回设置模式' : '应用模式（透明背景）';
  // In app mode on floating window: use key color background
  const fwContent = document.getElementById('fwContent');
  if (fwContent) {
    fwContent.style.background = state.showcaseMode ? state.keyColor : '';
  }
  // Also update main receiver canvas bg
  if (avatarCtx) {
    // redraw will happen in simLoop
  }
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
  if (document.getElementById('guideOverlay').classList.contains('open')) {
    updateGuideHighlights();
  }
}

// ====== GUIDE ======
function openGuide() {
  state.guideStep = 0;
  renderGuide();
  document.getElementById('guideOverlay').classList.add('open');
  updateGuideHighlights();
  _startGuideDynamicListeners();
}

function _startGuideDynamicListeners() {
  window.addEventListener('resize', _onGuideDynamicChange);
  window.addEventListener('scroll', _onGuideDynamicChange, { passive: true });
  // Observe floating window for size changes
  const fw = document.getElementById('floatingWindow');
  if (fw && !_guideResizeObserver) {
    _guideResizeObserver = new ResizeObserver(() => {
      if (document.getElementById('guideOverlay').classList.contains('open')) {
        updateGuideHighlights();
      }
    });
    _guideResizeObserver.observe(fw);
  }
  // Observe mode button
  const mb = document.getElementById('fwModeBtn');
  if (mb && _guideResizeObserver) {
    _guideResizeObserver.observe(mb);
  }
}

function _onGuideDynamicChange() {
  if (document.getElementById('guideOverlay').classList.contains('open')) {
    updateGuideHighlights();
  }
}

function _stopGuideDynamicListeners() {
  window.removeEventListener('resize', _onGuideDynamicChange);
  window.removeEventListener('scroll', _onGuideDynamicChange);
}

function closeGuide() {
  document.getElementById('guideOverlay').classList.remove('open');
  clearGuideHighlights();
  _stopGuideDynamicListeners();
}

function guideNav(dir) {
  if (state.guideStep === GUIDE_STEPS.length - 1 && dir === 1) {
    closeGuide();
    return;
  }
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

let _guideResizeRAF = null, _guideResizeObserver = null;

function updateGuideHighlights() {
  // Use rAF to ensure layout is settled
  if (_guideResizeRAF) cancelAnimationFrame(_guideResizeRAF);
  _guideResizeRAF = requestAnimationFrame(() => {
    _updateGuideHighlightsNow();
  });
}

function _updateGuideHighlightsNow() {
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
  if (_faceLandmarker || _faceVideoStream) {
    stopFaceTracking();
    return;
  }

  const toggle = document.getElementById('captureToggle');
  const perm = document.getElementById('cameraPerm');
  toggle.classList.add('on');
  perm.textContent = '请求摄像头权限...';
  perm.style.color = 'var(--cl-blue)';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
    });
    _faceVideoStream = stream;
    const video = document.getElementById('faceVideo');
    video.srcObject = stream;
    await video.play();

    perm.textContent = '加载模型（约 3MB）...';

    let mp;
    try {
      mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/+esm');
    } catch {
      mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm');
    }
    const { FilesetResolver, FaceLandmarker } = mp;

    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
    );

    _faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    perm.textContent = '已授权 · 面捕运行中';
    perm.style.color = 'var(--cl-green)';

    startFaceDetectionLoop(video);

  } catch (err) {
    console.error('Face tracking error:', err);
    const msg = err.name === 'NotAllowedError' ? '权限被拒绝' :
      err.name === 'NotFoundError' ? '未找到摄像头' :
      err.name === 'NotReadableError' ? '摄像头被占用' :
      (err.message || '无法启动摄像头');
    perm.textContent = '错误: ' + msg.slice(0, 40);
    perm.style.color = 'var(--cl-orange)';
    toggle.classList.remove('on');
    document.getElementById('fpDetected').textContent = '—';
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
  state.faceParams.eyeLeft = 1 - blinkLeft;
  state.faceParams.eyeRight = 1 - blinkRight;
  state.faceParams.faceDetected = true;

  if (matrices && matrices.length > 0) {
    const m = matrices[0].data;
    const sy = Math.sqrt(m[0] * m[0] + m[4] * m[4]);
    const yaw = Math.atan2(m[8], m[10]);
    state.faceParams.yaw = (yaw / Math.PI + 1) / 2;
    if (sy > 0.001) {
      const pitch = Math.atan2(-m[9], sy);
      state.faceParams.pitch = 1 - ((pitch / (Math.PI / 2) + 1) / 2);
    }
  }

  applyFaceParamsToAvatars(state.faceParams);

  document.getElementById('cameraPerm').textContent = '已授权 · 面捕运行中';
  document.getElementById('cameraPerm').style.color = 'var(--cl-green)';
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
  const toggle = document.getElementById('captureToggle');
  const perm = document.getElementById('cameraPerm');
  toggle.classList.remove('on');
  perm.textContent = '未开启';
  perm.style.color = 'var(--cl-text-muted)';
}

// ====== APPLY FACE PARAMS TO AVATARS ======
function applyFaceParamsToAvatars(fp) {
  state.faceParams.faceDetected = fp.faceDetected;
  // Both avatars share the same faceParams object, drawn in simLoop
  // This function also handles micLevel-assisted mouthOpen fallback
}

function applyFaceParamsToState(fp) {
  // Called by face tracker with raw params — normalizes and stores
  state.faceParams.mouthOpen = fp.mouthOpen || 0;
  state.faceParams.blink = fp.blink || 0;
  state.faceParams.yaw = fp.yaw !== undefined ? fp.yaw : 0.5;
  state.faceParams.pitch = fp.pitch !== undefined ? fp.pitch : 0.5;
  state.faceParams.smile = fp.smile || 0;
  state.faceParams.eyeLeft = fp.eyeLeft !== undefined ? fp.eyeLeft : 1;
  state.faceParams.eyeRight = fp.eyeRight !== undefined ? fp.eyeRight : 1;
  state.faceParams.faceDetected = fp.faceDetected || false;
}

// ====== MIC LEVEL (Web Audio API) ======
let _micAudioContext = null;
let _micAnalyser = null;
let _micStream = null;
let _micInterval = null;
let _micSource = null;
let _micGain = null;
let _micDestinationConnected = false;


// ====== VOICE EFFECT CHAIN ======
let _voiceEffectNodes = null;
let _micProcessedAnalyser = null;

function buildEffectChain() {
  const ctx = _micAudioContext;
  // Create nodes
  const input = ctx.createGain();
  input.gain.value = 1.0;

  // Low-pass filter (shared, used by lowpass/monster)
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 2000;
  lowpass.Q.value = 1;

  // High-pass for robot
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 800;
  highpass.Q.value = 0.7;

  // Distortion for monster/robot
  const distortion = ctx.createWaveShaper();
  distortion.curve = makeDistortionCurve(50);
  distortion.oversample = '2x';

  const output = ctx.createGain();
  output.gain.value = 1.0;

  // Connect: input → [effect chain depending on mode] → output
  // For 'off': input → output
  // For 'robot': input → highpass → distortion → output
  // For 'lowpass': input → lowpass → output
  // For 'monster': input → lowpass → distortion → output
  input.connect(output); // default dry path

  return { input, lowpass, highpass, distortion, output };
}

function makeDistortionCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function applyEffectMode(mode) {
  if (!_voiceEffectNodes) return;
  const n = _voiceEffectNodes;
  const ctx = _micAudioContext;

  // Disconnect all
  try { n.input.disconnect(); } catch(e) {}
  try { n.lowpass.disconnect(); } catch(e) {}
  try { n.highpass.disconnect(); } catch(e) {}
  try { n.distortion.disconnect(); } catch(e) {}

  switch (mode) {
    case 'off':
      n.input.connect(n.output);
      break;
    case 'lowpass':
      n.lowpass.frequency.value = 1200;
      n.input.connect(n.lowpass);
      n.lowpass.connect(n.output);
      break;
    case 'monster':
      n.lowpass.frequency.value = 800;
      n.input.connect(n.lowpass);
      n.lowpass.connect(n.distortion);
      n.distortion.connect(n.output);
      n.output.gain.value = 0.7;
      break;
    case 'robot':
      n.highpass.frequency.value = 900;
      n.input.connect(n.highpass);
      n.highpass.connect(n.distortion);
      n.distortion.connect(n.output);
      n.output.gain.value = 0.6;
      break;
    default:
      n.input.connect(n.output);
      break;
  }
  state.effectMode = mode;
}

function setVoiceEffect(mode) {
  if (!_voiceEffectNodes) {
    document.getElementById('effectStatus').textContent = '请先开启麦克风';
    return;
  }
  applyEffectMode(mode);
  const preset = VOICE_PRESETS.find(v => v.id === mode);
  document.getElementById('voicePresetDisplay').textContent = preset ? preset.name : mode;
  document.getElementById('effectStatus').textContent = mode === 'off' ? '无效果' : '效果: ' + (preset ? preset.name : mode);
  document.getElementById('effectStatus').style.color = mode === 'off' ? 'var(--cl-text-muted)' : 'var(--cl-accent)';
  // Rebuild monitor connection with new effect chain if monitor is on
  if (_micDestinationConnected) {
    stopMicMonitor();
    startMicMonitor();
  }
}

function toggleMicMonitor() {
  if (!_micAudioContext || !_micAnalyser) {
    alert('请先开启麦克风');
    return;
  }
  if (_micDestinationConnected) {
    stopMicMonitor();
    return;
  }
  startMicMonitor();
}

function startMicMonitor() {
  if (_micDestinationConnected) return;
  try {
    if (_micAudioContext.state === 'suspended') {
      _micAudioContext.resume();
    }
    if (!_micGain) {
      _micGain = _micAudioContext.createGain();
      _micGain.gain.value = 0.8;
    }
    // Connect effect chain output → micGain → destination
    if (_voiceEffectNodes) {
      _voiceEffectNodes.output.connect(_micGain);
      _micGain.connect(_micAudioContext.destination);
      _micDestinationConnected = true;
      state.micMonitorOn = true;
      document.getElementById('monitorBtn').textContent = '关闭监听';
      document.getElementById('monitorStatus').textContent = '监听中';
      document.getElementById('monitorStatus').style.color = 'var(--cl-green)';
    }
  } catch(e) {
    console.error('Monitor error:', e);
    document.getElementById('monitorStatus').textContent = '启动失败: ' + (e.message || '');
  }
}

function stopMicMonitor() {
  if (!_micDestinationConnected) return;
  try {
    if (_micGain) {
      _micGain.disconnect();
    }
    if (_voiceEffectNodes) {
      try { _voiceEffectNodes.output.disconnect(); } catch(e) {}
    }
    _micDestinationConnected = false;
    state.micMonitorOn = false;
    document.getElementById('monitorBtn').textContent = '监听变声';
    document.getElementById('monitorStatus').textContent = '监听已关闭';
    document.getElementById('monitorStatus').style.color = 'var(--cl-text-muted)';
  } catch(e) {}
}

async function startMicLevel() {
  if (_micAudioContext) {
    stopMicLevel();
    return;
  }

  const toggle = document.getElementById('voiceToggle');
  const perm = document.getElementById('micPerm');
  toggle.classList.add('on');
  perm.textContent = '请求麦克风权限...';
  perm.style.color = 'var(--cl-blue)';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _micStream = stream;
    _micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    _micSource = _micAudioContext.createMediaStreamSource(stream);
    // Raw analyser (before effects)
    _micAnalyser = _micAudioContext.createAnalyser();
    _micAnalyser.fftSize = 256;
    _micSource.connect(_micAnalyser);
    // NOTE: source is NOT connected to destination by default
    // User must click "监听变声" to hear processed audio output

    // ===== Effect chain =====
    _voiceEffectNodes = buildEffectChain();
    // Wire: source → effect chain → processed analyser → (monitor later connects to destination)
    _micProcessedAnalyser = _micAudioContext.createAnalyser();
    _micProcessedAnalyser.fftSize = 256;
    _micSource.connect(_voiceEffectNodes.input);
    _voiceEffectNodes.output.connect(_micProcessedAnalyser);

    const dataArray = new Uint8Array(_micAnalyser.frequencyBinCount);
    const processedArray = new Uint8Array(_micProcessedAnalyser.frequencyBinCount);

    _micInterval = setInterval(() => {
      _micAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const normalized = Math.min(1, sum / dataArray.length / 128);
      state.micLevel = normalized;

      _micProcessedAnalyser.getByteFrequencyData(processedArray);
      let psum = 0;
      for (let i = 0; i < processedArray.length; i++) psum += processedArray[i];
      state.processedLevel = Math.min(1, psum / processedArray.length / 128);

      const valEl = document.getElementById('micLevelVal');
      if (valEl) valEl.textContent = normalized.toFixed(2);
      const pValEl = document.getElementById('processedLevelVal');
      if (pValEl) pValEl.textContent = state.processedLevel.toFixed(2);
      perm.textContent = '已授权 · 音量: ' + (normalized * 100).toFixed(0) + '%';
      perm.style.color = normalized > 0.05 ? 'var(--cl-green)' : 'var(--cl-text-muted)';
    }, 100);

    document.getElementById('voicePresetDisplay').textContent = '原声（可切换效果）';
  document.getElementById('effectStatus').textContent = '无效果';

  } catch (err) {
    const msg = err.name === 'NotAllowedError' ? '权限被拒绝' :
      err.name === 'NotFoundError' ? '未找到麦克风' :
      (err.message || '无法访问麦克风');
    perm.textContent = '错误: ' + msg.slice(0, 40);
    perm.style.color = 'var(--cl-orange)';
    toggle.classList.remove('on');
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
  if (_micGain) {
    try { _micGain.disconnect(); } catch(e) {}
    _micGain = null;
  }
  _micSource = null;
  _voiceEffectNodes = null;
  _micProcessedAnalyser = null;
  _micDestinationConnected = false;
  state.micMonitorOn = false;
  state.micLevel = 0;
  state.processedLevel = 0;
  state.effectMode = 'off';
  const toggle = document.getElementById('voiceToggle');
  const perm = document.getElementById('micPerm');
  const valEl = document.getElementById('micLevelVal');
  toggle.classList.remove('on');
  perm.textContent = '未开启';
  perm.style.color = 'var(--cl-text-muted)';
  document.getElementById('voicePresetDisplay').textContent = '原声';
  if (valEl) valEl.textContent = '—';
}
