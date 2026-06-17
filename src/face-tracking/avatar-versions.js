/**
 * CheapLive Avatar Versions - 多形象版本懒加载系统
 *
 * 支持的形象版本：
 * - saka: 当前3D纺锤体萨卡班甲鱼（默认）
 * - saka-memorial: 纪念版（原始平面纺锤体）
 * - sphere: 球体基础版（纯球体，无身体）
 * - saka-whale: 3D纺锤体+灰色横向鲸鱼尾巴
 *
 * 懒加载：仅在切换时动态创建对应 Avatar 类
 */

// ===================== 基础球体版 =====================

class SphereAvatar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;
    this.sphereR = 85;

    this.features = {
      eyeLeft: { x: -30, y: -18, z: 55, r: 22 },
      eyeRight: { x: 30, y: -18, z: 55, r: 22 },
      nostrilLeft: { x: -8, y: 12, z: 58, rx: 4, ry: 3 },
      nostrilRight: { x: 8, y: 12, z: 58, rx: 4, ry: 3 },
      mouth: { x: 0, y: 32, z: 50, w: 24 },
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.draw();
  }

  rotate3D(x, y, z, yaw, pitch, roll) {
    let cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;
    let cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    let y2 = y1 * cosP - z1 * sinP;
    let z2 = y1 * sinP + z1 * cosP;
    let x2 = x1;
    let cosR = Math.cos(roll), sinR = Math.sin(roll);
    let x3 = x2 * cosR - y2 * sinR;
    let y3 = x2 * sinR + y2 * cosR;
    return { x: x3, y: y3, z: z2 };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.appMode) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }

    const posX = (this.params.headX - 0.5) * 120;
    const posY = (this.params.headY - 0.5) * 80;
    const yaw = (this.params.headYaw - 0.5) * Math.PI * 0.66;
    const pitch = (this.params.headPitch - 0.5) * Math.PI * 0.44;
    const roll = (this.params.headRoll - 0.5) * Math.PI * 0.5;
    const cx = w / 2 + posX;
    const cy = h / 2 + posY;
    const scale = Math.min(w, h) * 0.0035;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 球体轮廓
    const spherePoints = [];
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const sx = Math.cos(angle) * this.sphereR;
      const sy = Math.sin(angle) * this.sphereR;
      const sz = 0;
      spherePoints.push(this.rotate3D(sx, sy, sz, yaw, pitch, roll));
    }

    // 绘制球体（用椭圆近似，根据z排序）
    const avgZ = spherePoints.reduce((s, p) => s + p.z, 0) / spherePoints.length;
    const perspective = Math.max(0.3, (avgZ + 80) / 140);

    ctx.beginPath();
    ctx.ellipse(0, 0, this.sphereR * perspective, this.sphereR * perspective * 0.92, roll, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-20, -20, 10, 0, 0, this.sphereR);
    grad.addColorStop(0, '#e8e6df');
    grad.addColorStop(0.6, '#d4d1c8');
    grad.addColorStop(1, '#b8b5ac');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#9a9890';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 特征点
    const renderList = [];
    for (const [key, f] of Object.entries(this.features)) {
      const r = this.rotate3D(f.x, f.y, f.z, yaw, pitch, roll);
      if (key.startsWith('eye')) {
        renderList.push({ type: 'eye', ...r, r: f.r, openness: this.params[key.replace('eye', 'eye')] });
      } else if (key.startsWith('nostril')) {
        renderList.push({ type: 'nostril', ...r, rx: f.rx, ry: f.ry });
      } else if (key === 'mouth') {
        renderList.push({ type: 'mouth', ...r, w: f.w, openness: this.params.mouthOpen, smile: this.params.mouthSmile });
      }
    }

    renderList.sort((a, b) => a.z - b.z);
    for (const f of renderList) {
      const p = Math.max(0.3, (f.z + 80) / 140);
      const op = f.z < -20 ? 0.15 : 1;
      if (f.type === 'eye') this.drawEye(ctx, f.x, f.y, f.r * p, f.openness, op);
      else if (f.type === 'nostril') this.drawNostril(ctx, f.x, f.y, f.rx * p, f.ry * p, op);
      else if (f.type === 'mouth') this.drawMouth(ctx, f.x, f.y, f.w * p, f.openness, f.smile, op);
    }

    ctx.restore();

    if (!this.appMode) this.drawLabels(ctx, w, h);
  }

  drawEye(ctx, x, y, radius, openness, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2;
    ctx.stroke();
    const pr = radius * (0.25 + openness * 0.55);
    ctx.beginPath();
    ctx.arc(x, y + 1, Math.max(2, pr), 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    if (openness < 0.3) {
      const ca = 1 - (openness / 0.3);
      const ey = y - radius + (radius * 2 * (1 - ca * 0.85));
      ctx.beginPath();
      ctx.ellipse(x, ey - radius * 0.1, radius + 2, radius * ca * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d4d1c8';
      ctx.fill();
    }
    ctx.restore();
  }

  drawNostril(ctx, x, y, rx, ry, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMouth(ctx, x, y, width, openness, smile, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const oh = 16 * openness;
    const so = smile * 4;
    if (openness > 0.2) {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y - so);
      ctx.lineTo(x + width / 2, y - so);
      ctx.lineTo(x, y + oh + so);
      ctx.closePath();
      ctx.fillStyle = '#7a2e2e';
      ctx.fill();
      ctx.strokeStyle = '#5a2a2a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + so * 0.3);
      ctx.quadraticCurveTo(x, y - 2 - so, x + width / 2, y + so * 0.3);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLabels(ctx, w, h) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#8888A0';
    const labels = [
      `eyeL: ${this.params.eyeLeft.toFixed(2)}`,
      `eyeR: ${this.params.eyeRight.toFixed(2)}`,
      `mouth: ${this.params.mouthOpen.toFixed(2)}`,
      `yaw: ${this.params.headYaw.toFixed(2)}`,
      `pitch: ${this.params.headPitch.toFixed(2)}`,
      `roll: ${this.params.headRoll.toFixed(2)}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}

// ===================== 纪念版（原始平面纺锤体）=====================

class MemorialAvatar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;

    this.features = {
      eyeLeft: { x: -38, y: -14, z: 58, r: 24 },
      eyeRight: { x: 22, y: -14, z: 58, r: 24 },
      nostrilLeft: { x: -10, y: 16, z: 62, rx: 5, ry: 4 },
      nostrilRight: { x: 2, y: 16, z: 62, rx: 5, ry: 4 },
      mouth: { x: -4, y: 36, z: 52, w: 26 },
    };

    this.spindle = {
      headR: 75, bodyLength: 140, bodyWidth: 55, tailLength: 60,
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.draw();
  }

  rotate3D(x, y, z, yaw, pitch, roll) {
    let cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;
    let cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    let y2 = y1 * cosP - z1 * sinP;
    let z2 = y1 * sinP + z1 * cosP;
    let x2 = x1;
    let cosR = Math.cos(roll), sinR = Math.sin(roll);
    let x3 = x2 * cosR - y2 * sinR;
    let y3 = x2 * sinR + y2 * cosR;
    return { x: x3, y: y3, z: z2 };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.appMode) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }

    const posX = (this.params.headX - 0.5) * 120;
    const posY = (this.params.headY - 0.5) * 80;
    const yaw = (this.params.headYaw - 0.5) * Math.PI * 0.66;
    const pitch = (this.params.headPitch - 0.5) * Math.PI * 0.44;
    const roll = (this.params.headRoll - 0.5) * Math.PI * 0.5;
    const cx = w / 2 + posX;
    const cy = h / 2 + posY;
    const scale = Math.min(w, h) * 0.0035;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const s = this.spindle;
    const bodyPoints = [
      { x: -s.headR * 0.3, y: -s.headR, z: 0 },
      { x: s.headR * 0.5, y: -s.bodyWidth, z: 0 },
      { x: s.bodyLength * 0.6, y: -s.bodyWidth * 0.85, z: 0 },
      { x: s.bodyLength, y: -s.bodyWidth * 0.3, z: 0 },
      { x: s.bodyLength + 15, y: -s.bodyWidth * 0.15, z: 0 },
      { x: s.bodyLength + 25, y: -5, z: 0 },
      { x: s.bodyLength + s.tailLength * 0.5, y: 0, z: 0 },
      { x: s.bodyLength + 25, y: 8, z: 0 },
      { x: s.bodyLength + 20, y: 15, z: 0 },
      { x: s.bodyLength + s.tailLength * 0.3, y: 18, z: 0 },
      { x: s.bodyLength + 10, y: 22, z: 0 },
      { x: s.bodyLength + 5, y: 18, z: 0 },
      { x: s.bodyLength, y: 12, z: 0 },
      { x: s.bodyLength * 0.6, y: s.bodyWidth * 0.7, z: 0 },
      { x: s.headR * 0.5, y: s.bodyWidth * 0.9, z: 0 },
      { x: -s.headR * 0.3, y: s.headR, z: 0 },
    ];

    const rotatedBody = bodyPoints.map(p => this.rotate3D(p.x, p.y, p.z, yaw, pitch, roll));
    const bodyZ = rotatedBody.reduce((sum, p) => sum + p.z, 0) / rotatedBody.length;

    // 绘制平面纺锤体
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(rotatedBody[0].x, rotatedBody[0].y);
    ctx.bezierCurveTo(rotatedBody[1].x, rotatedBody[1].y, rotatedBody[2].x, rotatedBody[2].y, rotatedBody[3].x, rotatedBody[3].y);
    ctx.bezierCurveTo(rotatedBody[4].x, rotatedBody[4].y, rotatedBody[5].x, rotatedBody[5].y, rotatedBody[6].x, rotatedBody[6].y);
    ctx.bezierCurveTo(rotatedBody[7].x, rotatedBody[7].y, rotatedBody[8].x, rotatedBody[8].y, rotatedBody[9].x, rotatedBody[9].y);
    ctx.bezierCurveTo(rotatedBody[10].x, rotatedBody[10].y, rotatedBody[11].x, rotatedBody[11].y, rotatedBody[12].x, rotatedBody[12].y);
    ctx.bezierCurveTo(rotatedBody[13].x, rotatedBody[13].y, rotatedBody[14].x, rotatedBody[14].y, rotatedBody[15].x, rotatedBody[15].y);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(0, -60, 0, 60);
    bodyGrad.addColorStop(0, '#bdb8aa');
    bodyGrad.addColorStop(0.50, '#bdb8aa');
    bodyGrad.addColorStop(0.50, '#f2f1ea');
    bodyGrad.addColorStop(1, '#f2f1ea');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 尾巴
    const tailEnd = this.rotate3D(s.bodyLength, 0, 0, yaw, pitch, roll);
    const t = s.tailLength;
    const ta = Math.sin(yaw) * 0.3;
    ctx.beginPath();
    ctx.moveTo(tailEnd.x, tailEnd.y - 2);
    ctx.quadraticCurveTo(tailEnd.x + t * 0.5, tailEnd.y - t * 0.6 + ta * 20, tailEnd.x + t, tailEnd.y - t * 0.3 + ta * 10);
    ctx.quadraticCurveTo(tailEnd.x + t * 0.7, tailEnd.y - t * 0.1, tailEnd.x + t * 0.3, tailEnd.y);
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tailEnd.x, tailEnd.y + 2);
    ctx.quadraticCurveTo(tailEnd.x + t * 0.5, tailEnd.y + t * 0.6 + ta * 20, tailEnd.x + t, tailEnd.y + t * 0.3 + ta * 10);
    ctx.quadraticCurveTo(tailEnd.x + t * 0.7, tailEnd.y + t * 0.1, tailEnd.x + t * 0.3, tailEnd.y);
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // 特征点
    const renderList = [];
    const leftEye3D = this.rotate3D(this.features.eyeLeft.x, this.features.eyeLeft.y, this.features.eyeLeft.z, yaw, pitch, roll);
    renderList.push({ type: 'eye', ...leftEye3D, r: this.features.eyeLeft.r, openness: this.params.eyeLeft, side: 'left' });
    const rightEye3D = this.rotate3D(this.features.eyeRight.x, this.features.eyeRight.y, this.features.eyeRight.z, yaw, pitch, roll);
    renderList.push({ type: 'eye', ...rightEye3D, r: this.features.eyeRight.r, openness: this.params.eyeRight, side: 'right' });
    const leftNostril3D = this.rotate3D(this.features.nostrilLeft.x, this.features.nostrilLeft.y, this.features.nostrilLeft.z, yaw, pitch, roll);
    renderList.push({ type: 'nostril', ...leftNostril3D, rx: this.features.nostrilLeft.rx, ry: this.features.nostrilLeft.ry });
    const rightNostril3D = this.rotate3D(this.features.nostrilRight.x, this.features.nostrilRight.y, this.features.nostrilRight.z, yaw, pitch, roll);
    renderList.push({ type: 'nostril', ...rightNostril3D, rx: this.features.nostrilRight.rx, ry: this.features.nostrilRight.ry });
    const mouth3D = this.rotate3D(this.features.mouth.x, this.features.mouth.y, this.features.mouth.z, yaw, pitch, roll);
    renderList.push({ type: 'mouth', ...mouth3D, w: this.features.mouth.w, openness: this.params.mouthOpen, smile: this.params.mouthSmile });

    renderList.sort((a, b) => a.z - b.z);
    for (const f of renderList) {
      const perspective = Math.max(0.3, (f.z + 80) / 140);
      const opacity = f.z < -20 ? 0.15 : 1;
      if (f.type === 'eye') this.drawEye(ctx, f.x, f.y, f.r * perspective, f.openness, opacity);
      else if (f.type === 'nostril') this.drawNostril(ctx, f.x, f.y, f.rx * perspective, f.ry * perspective, opacity);
      else if (f.type === 'mouth') this.drawMouth(ctx, f.x, f.y, f.w * perspective, f.openness, f.smile, opacity);
    }

    ctx.restore();
    if (!this.appMode) this.drawLabels(ctx, w, h);
  }

  drawEye(ctx, x, y, radius, openness, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const pr = radius * (0.25 + openness * 0.55);
    ctx.beginPath();
    ctx.arc(x, y + 1, Math.max(2, pr), 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    if (openness < 0.3) {
      const ca = 1 - (openness / 0.3);
      const ey = y - radius + (radius * 2 * (1 - ca * 0.85));
      ctx.beginPath();
      ctx.ellipse(x, ey - radius * 0.1, radius + 2, radius * ca * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#bdb8aa';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.85, ey);
      ctx.quadraticCurveTo(x, ey + 3, x + radius * 0.85, ey);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  drawNostril(ctx, x, y, rx, ry, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMouth(ctx, x, y, width, openness, smile, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const oh = 16 * openness;
    const so = smile * 4;
    if (openness > 0.2) {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y - so);
      ctx.lineTo(x + width / 2, y - so);
      ctx.lineTo(x, y + oh + so);
      ctx.closePath();
      ctx.fillStyle = '#7a2e2e';
      ctx.fill();
      ctx.strokeStyle = '#5a2a2a';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + so * 0.3);
      ctx.quadraticCurveTo(x, y - 2 - so, x + width / 2, y + so * 0.3);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLabels(ctx, w, h) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#8888A0';
    const labels = [
      `eyeL: ${this.params.eyeLeft.toFixed(2)}`,
      `eyeR: ${this.params.eyeRight.toFixed(2)}`,
      `mouth: ${this.params.mouthOpen.toFixed(2)}`,
      `yaw: ${this.params.headYaw.toFixed(2)}`,
      `pitch: ${this.params.headPitch.toFixed(2)}`,
      `roll: ${this.params.headRoll.toFixed(2)}`,
      `pos: ${this.params.headX.toFixed(2)},${this.params.headY.toFixed(2)}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}

// ===================== 鲸鱼尾巴版3D纺锤体 =====================

class WhaleTailAvatar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;
    this.sphereR = 85;

    this.features = {
      eyeLeft: { x: -38, y: -14, z: 58, r: 24 },
      eyeRight: { x: 22, y: -14, z: 58, r: 24 },
      nostrilLeft: { x: -10, y: 16, z: 62, rx: 5, ry: 4 },
      nostrilRight: { x: 2, y: 16, z: 62, rx: 5, ry: 4 },
      mouth: { x: -4, y: 36, z: 52, w: 26 },
    };

    this.spindle = {
      headR: 75, bodyLength: 140, bodyWidth: 55, tailLength: 60, bodyDepth: 40,
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.draw();
  }

  rotate3D(x, y, z, yaw, pitch, roll) {
    let cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;
    let cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    let y2 = y1 * cosP - z1 * sinP;
    let z2 = y1 * sinP + z1 * cosP;
    let x2 = x1;
    let cosR = Math.cos(roll), sinR = Math.sin(roll);
    let x3 = x2 * cosR - y2 * sinR;
    let y3 = x2 * sinR + y2 * cosR;
    return { x: x3, y: y3, z: z2 };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.appMode) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }

    const posX = (this.params.headX - 0.5) * 120;
    const posY = (this.params.headY - 0.5) * 80;
    const yaw = (this.params.headYaw - 0.5) * Math.PI * 0.66;
    const pitch = (this.params.headPitch - 0.5) * Math.PI * 0.44;
    const roll = (this.params.headRoll - 0.5) * Math.PI * 0.5;
    const cx = w / 2 + posX;
    const cy = h / 2 + posY;
    const scale = Math.min(w, h) * 0.0035;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const renderList = [];
    const s = this.spindle;
    const d = s.bodyDepth;

    // 3D身体点
    const bodyPoints = [
      { x: -s.headR * 0.3, y: -s.headR, z: d * 0.3, type: 'body' },
      { x: s.headR * 0.5, y: -s.bodyWidth, z: d * 0.7, type: 'body' },
      { x: s.bodyLength * 0.6, y: -s.bodyWidth * 0.85, z: d * 0.9, type: 'body' },
      { x: s.bodyLength, y: -s.bodyWidth * 0.3, z: d * 0.6, type: 'body' },
      { x: s.bodyLength + 15, y: -s.bodyWidth * 0.15, z: d * 0.3, type: 'body' },
      { x: s.bodyLength + 25, y: -5, z: d * 0.15, type: 'body' },
      { x: s.bodyLength + s.tailLength * 0.5, y: 0, z: 0, type: 'body' },
      { x: s.bodyLength + 25, y: 8, z: -d * 0.15, type: 'body' },
      { x: s.bodyLength + 20, y: 15, z: -d * 0.3, type: 'body' },
      { x: s.bodyLength + s.tailLength * 0.3, y: 18, z: -d * 0.2, type: 'body' },
      { x: s.bodyLength + 10, y: 22, z: -d * 0.4, type: 'body' },
      { x: s.bodyLength + 5, y: 18, z: -d * 0.5, type: 'body' },
      { x: s.bodyLength, y: 12, z: -d * 0.6, type: 'body' },
      { x: s.bodyLength * 0.6, y: s.bodyWidth * 0.7, z: -d * 0.9, type: 'body' },
      { x: s.headR * 0.5, y: s.bodyWidth * 0.9, z: -d * 0.7, type: 'body' },
      { x: -s.headR * 0.3, y: s.headR, z: -d * 0.3, type: 'body' },
    ];

    const rotatedBody = bodyPoints.map(p => ({
      ...this.rotate3D(p.x, p.y, p.z, yaw, pitch, roll),
      type: 'body'
    }));
    const bodyZ = rotatedBody.reduce((sum, p) => sum + p.z, 0) / rotatedBody.length;

    renderList.push({
      type: 'spindleBody',
      z: bodyZ,
      points: rotatedBody,
      tailEnd: this.rotate3D(s.bodyLength, 0, 0, yaw, pitch, roll),
      tailLen: s.tailLength,
    });

    // 特征点
    const leftEye3D = this.rotate3D(this.features.eyeLeft.x, this.features.eyeLeft.y, this.features.eyeLeft.z, yaw, pitch, roll);
    renderList.push({ type: 'eye', ...leftEye3D, r: this.features.eyeLeft.r, openness: this.params.eyeLeft, side: 'left' });
    const rightEye3D = this.rotate3D(this.features.eyeRight.x, this.features.eyeRight.y, this.features.eyeRight.z, yaw, pitch, roll);
    renderList.push({ type: 'eye', ...rightEye3D, r: this.features.eyeRight.r, openness: this.params.eyeRight, side: 'right' });
    const leftNostril3D = this.rotate3D(this.features.nostrilLeft.x, this.features.nostrilLeft.y, this.features.nostrilLeft.z, yaw, pitch, roll);
    renderList.push({ type: 'nostril', ...leftNostril3D, rx: this.features.nostrilLeft.rx, ry: this.features.nostrilLeft.ry });
    const rightNostril3D = this.rotate3D(this.features.nostrilRight.x, this.features.nostrilRight.y, this.features.nostrilRight.z, yaw, pitch, roll);
    renderList.push({ type: 'nostril', ...rightNostril3D, rx: this.features.nostrilRight.rx, ry: this.features.nostrilRight.ry });
    const mouth3D = this.rotate3D(this.features.mouth.x, this.features.mouth.y, this.features.mouth.z, yaw, pitch, roll);
    renderList.push({ type: 'mouth', ...mouth3D, w: this.features.mouth.w, openness: this.params.mouthOpen, smile: this.params.mouthSmile });

    renderList.sort((a, b) => a.z - b.z);

    for (const f of renderList) {
      const perspective = Math.max(0.3, (f.z + 80) / 140);
      const opacity = f.z < -20 ? 0.15 : 1;
      if (f.type === 'spindleBody') this.drawSpindle(ctx, f.points, f.tailEnd, f.tailLen, yaw, pitch, perspective, opacity);
      else if (f.type === 'eye') this.drawEye(ctx, f.x, f.y, f.r * perspective, f.openness, opacity);
      else if (f.type === 'nostril') this.drawNostril(ctx, f.x, f.y, f.rx * perspective, f.ry * perspective, opacity);
      else if (f.type === 'mouth') this.drawMouth(ctx, f.x, f.y, f.w * perspective, f.openness, f.smile, opacity);
    }

    ctx.restore();
    if (!this.appMode) this.drawLabels(ctx, w, h);
  }

  drawSpindle(ctx, points, tailEnd, tailLen, yaw, pitch, perspective, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.bezierCurveTo(points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y);
    ctx.bezierCurveTo(points[4].x, points[4].y, points[5].x, points[5].y, points[6].x, points[6].y);
    ctx.bezierCurveTo(points[7].x, points[7].y, points[8].x, points[8].y, points[9].x, points[9].y);
    ctx.bezierCurveTo(points[10].x, points[10].y, points[11].x, points[11].y, points[12].x, points[12].y);
    ctx.bezierCurveTo(points[13].x, points[13].y, points[14].x, points[14].y, points[15].x, points[15].y);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(0, -60 * perspective, 0, 60 * perspective);
    bodyGrad.addColorStop(0, '#bdb8aa');
    bodyGrad.addColorStop(0.50, '#bdb8aa');
    bodyGrad.addColorStop(0.50, '#f2f1ea');
    bodyGrad.addColorStop(1, '#f2f1ea');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 灰色横向鲸鱼尾巴
    this.drawWhaleTail(ctx, tailEnd, tailLen, yaw, pitch, perspective);

    ctx.restore();
  }

  drawWhaleTail(ctx, tailEnd, tailLen, yaw, pitch, perspective) {
    const t = tailLen * perspective;
    const x = tailEnd.x;
    const y = tailEnd.y;

    // 鲸鱼尾巴：横向展开的扇形尾叶
    const spread = t * 0.8; // 尾叶展开宽度
    const tailAngle = Math.sin(yaw) * 0.2;

    ctx.save();

    // 上尾叶（灰色）
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.quadraticCurveTo(x + t * 0.3, y - spread * 0.5 + tailAngle * 15, x + t * 0.6, y - spread + tailAngle * 10);
    ctx.quadraticCurveTo(x + t * 0.4, y - spread * 0.3, x + t * 0.2, y - 2);
    ctx.closePath();
    ctx.fillStyle = '#8a8a8a';
    ctx.fill();
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 下尾叶（灰色）
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.quadraticCurveTo(x + t * 0.3, y + spread * 0.5 + tailAngle * 15, x + t * 0.6, y + spread + tailAngle * 10);
    ctx.quadraticCurveTo(x + t * 0.4, y + spread * 0.3, x + t * 0.2, y + 2);
    ctx.closePath();
    ctx.fillStyle = '#8a8a8a';
    ctx.fill();
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 尾柄连接处
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 4);
    ctx.lineTo(x + t * 0.15, y - 1);
    ctx.lineTo(x + t * 0.15, y + 1);
    ctx.lineTo(x - 5, y + 4);
    ctx.closePath();
    ctx.fillStyle = '#9a9a9a';
    ctx.fill();

    ctx.restore();
  }

  drawEye(ctx, x, y, radius, openness, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const pr = radius * (0.25 + openness * 0.55);
    ctx.beginPath();
    ctx.arc(x, y + 1, Math.max(2, pr), 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    if (openness < 0.3) {
      const ca = 1 - (openness / 0.3);
      const ey = y - radius + (radius * 2 * (1 - ca * 0.85));
      ctx.beginPath();
      ctx.ellipse(x, ey - radius * 0.1, radius + 2, radius * ca * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#bdb8aa';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.85, ey);
      ctx.quadraticCurveTo(x, ey + 3, x + radius * 0.85, ey);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  drawNostril(ctx, x, y, rx, ry, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMouth(ctx, x, y, width, openness, smile, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const oh = 16 * openness;
    const so = smile * 4;
    if (openness > 0.2) {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y - so);
      ctx.lineTo(x + width / 2, y - so);
      ctx.lineTo(x, y + oh + so);
      ctx.closePath();
      ctx.fillStyle = '#7a2e2e';
      ctx.fill();
      ctx.strokeStyle = '#5a2a2a';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + so * 0.3);
      ctx.quadraticCurveTo(x, y - 2 - so, x + width / 2, y + so * 0.3);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLabels(ctx, w, h) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#8888A0';
    const labels = [
      `eyeL: ${this.params.eyeLeft.toFixed(2)}`,
      `eyeR: ${this.params.eyeRight.toFixed(2)}`,
      `mouth: ${this.params.mouthOpen.toFixed(2)}`,
      `yaw: ${this.params.headYaw.toFixed(2)}`,
      `pitch: ${this.params.headPitch.toFixed(2)}`,
      `roll: ${this.params.headRoll.toFixed(2)}`,
      `pos: ${this.params.headX.toFixed(2)},${this.params.headY.toFixed(2)}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}

// ===================== 懒加载工厂 =====================

const AVATAR_REGISTRY = {
  saka: () => {
    // 动态导入当前默认版本（3D纺锤体）
    return import('./debug-avatar.js').then(m => new m.DebugAvatar('avatar_canvas'));
  },
  'saka-memorial': () => Promise.resolve(new MemorialAvatar('avatar_canvas')),
  sphere: () => Promise.resolve(new SphereAvatar('avatar_canvas')),
  'saka-whale': () => Promise.resolve(new WhaleTailAvatar('avatar_canvas')),
  'mesh-sphere': () => {
    return import('./live2d-mesh-renderer.js').then(m => new m.SphereMeshAvatar('avatar_canvas'));
  },
  'mesh-spindle-whale': () => {
    return import('./live2d-mesh-renderer.js').then(m => new m.SpindleWhaleMeshAvatar('avatar_canvas'));
  },
};

export async function createAvatar(version) {
  const factory = AVATAR_REGISTRY[version];
  if (!factory) {
    console.warn(`未知形象版本: ${version}，使用默认`);
    return AVATAR_REGISTRY.sphere();
  }
  return factory();
}

export const AVATAR_VERSIONS = [
  { id: 'saka', name: '3D纺锤体', desc: '当前默认版本' },
  { id: 'saka-whale', name: '鲸鱼尾巴', desc: '3D纺锤体+灰色鲸尾' },
  { id: 'sphere', name: '球体基础', desc: '纯球体无身体' },
  { id: 'saka-memorial', name: '纪念版', desc: '原始平面纺锤体' },
  { id: 'mesh-sphere', name: '网格球体', desc: 'Live2D风格2.5D球体网格' },
  { id: 'mesh-spindle-whale', name: '网格鲸鱼', desc: 'Live2D风格2.5D纺锤体+鲸尾' },
];
