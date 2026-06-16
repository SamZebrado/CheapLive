/**
 * CheapLive Debug Avatar - Sacabambaspis Edition
 * 萨卡班甲鱼调试形象，根据面捕参数实时变形
 * 参考 HaageemeeOtamatone 鱼脸模式：正圆形脸，灰白水平分界
 */

export class DebugAvatar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1,
      eyeRight: 1,
      mouthOpen: 0,
      mouthSmile: 0,
      browLeft: 0,
      browRight: 0,
      headYaw: 0.5,
      headPitch: 0.5,
      headRoll: 0.5,
      headX: 0.5,
      headY: 0.5,
    };
    this.mirror = false;
    this.appMode = false; // 应用模式：隐藏调试标签

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

  setMirror(enabled) {
    this.mirror = enabled;
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 应用模式下背景透明（或纯色），调试模式下用深色背景
    if (!this.appMode) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }

    const posX = (this.params.headX - 0.5) * 120;
    const posY = (this.params.headY - 0.5) * 80;
    const headYaw = (this.params.headYaw - 0.5) * 40;
    const headPitch = (this.params.headPitch - 0.5) * 30;
    const headRoll = (this.params.headRoll - 0.5) * 45; // 增大到 ±45 度

    const cx = w / 2 + posX;
    const cy = h / 2 + posY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(headRoll * Math.PI / 180);
    if (this.mirror) ctx.scale(-1, 1);
    ctx.translate(headYaw * 0.5, headPitch * 0.5);

    const scale = Math.min(w, h) * 0.0035;
    ctx.scale(scale, scale);

    this.drawSacabambaspis(ctx);

    ctx.restore();

    if (!this.appMode) {
      this.drawLabels(ctx, w, h);
    }
  }

  drawSacabambaspis(ctx) {
    const p = this.params;
    const faceR = 85; // 正圆半径

    // === 正圆形头部 ===
    ctx.beginPath();
    ctx.arc(0, 0, faceR, 0, Math.PI * 2);

    // 填充：上半灰褐 #bdb8aa，下半米白 #f2f1ea，水平分界线在 52%
    const bodyGrad = ctx.createLinearGradient(0, -faceR, 0, faceR);
    bodyGrad.addColorStop(0, '#bdb8aa');
    bodyGrad.addColorStop(0.52, '#bdb8aa');
    bodyGrad.addColorStop(0.52, '#f2f1ea');
    bodyGrad.addColorStop(1, '#f2f1ea');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 轮廓
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 4;
    ctx.stroke();

    // === 眼睛（大圆眼，间距更大） ===
    // 增大眼间距：左眼在 -0.42，右眼在 +0.22（之前是 -0.35 / +0.15）
    const eyeY = -faceR * 0.12;
    const leftEyeX = -faceR * 0.42;
    const rightEyeX = faceR * 0.22;
    const eyeRadius = faceR * 0.26;

    this.drawSacabaEye(ctx, leftEyeX, eyeY, eyeRadius, p.eyeLeft);
    this.drawSacabaEye(ctx, rightEyeX, eyeY, eyeRadius, p.eyeRight);

    // === 鼻孔（两个小黑椭圆，在两眼之间偏下） ===
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(-faceR * 0.12, faceR * 0.15, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(faceR * 0.02, faceR * 0.15, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // === 嘴巴（小三角形嘴，在头部前端下方） ===
    this.drawSacabaMouth(ctx, -faceR * 0.05, faceR * 0.38, p.mouthOpen, p.mouthSmile);
  }

  drawSacabaEye(ctx, x, y, radius, openness) {
    // openness: 1=完全睁眼, 0=完全闭眼

    // 眼白（大圆，白色）
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 瞳孔（黑色实心圆）
    // 睁眼时瞳孔大，闭眼时瞳孔小
    const pupilRadius = radius * (0.25 + openness * 0.55);
    const pupilY = y + 1;

    ctx.beginPath();
    ctx.arc(x, pupilY, Math.max(2, pupilRadius), 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // 闭眼效果
    if (openness < 0.3) {
      const closedAmount = 1 - (openness / 0.3);
      const eyelidY = y - radius + (radius * 2 * (1 - closedAmount * 0.85));

      ctx.beginPath();
      ctx.ellipse(x, eyelidY - radius * 0.1, radius + 2, radius * closedAmount * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#bdb8aa';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x - radius * 0.85, eyelidY);
      ctx.quadraticCurveTo(x, eyelidY + 3, x + radius * 0.85, eyelidY);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  drawSacabaMouth(ctx, x, y, openness, smile) {
    const width = 24;
    const openHeight = 16 * openness;
    const smileOffset = smile * 4;

    if (openness > 0.2) {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y - smileOffset);
      ctx.lineTo(x + width / 2, y - smileOffset);
      ctx.lineTo(x, y + openHeight + smileOffset);
      ctx.closePath();

      ctx.fillStyle = '#7a2e2e';
      ctx.fill();
      ctx.strokeStyle = '#5a2a2a';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + smileOffset * 0.3);
      ctx.quadraticCurveTo(x, y - 2 - smileOffset, x + width / 2, y + smileOffset * 0.3);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  drawLabels(ctx, w, h) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#8888A0';
    const labels = [
      `eyeL: ${this.params.eyeLeft.toFixed(2)}`,
      `eyeR: ${this.params.eyeRight.toFixed(2)}`,
      `mouth: ${this.params.mouthOpen.toFixed(2)}`,
      `smile: ${this.params.mouthSmile.toFixed(2)}`,
      `yaw: ${this.params.headYaw.toFixed(2)}`,
      `pos: ${this.params.headX.toFixed(2)},${this.params.headY.toFixed(2)}`,
      `mirror: ${this.mirror ? 'on' : 'off'}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}
