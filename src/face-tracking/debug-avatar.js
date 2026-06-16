/**
 * CheapLive Debug Avatar - Sacabambaspis Edition
 * 萨卡班甲鱼调试形象，根据面捕参数实时变形
 * 参考 HaageemeeOtamatone 项目的鱼脸模式配色和造型
 */

export class DebugAvatar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1,      // 0=闭眼, 1=睁眼
      eyeRight: 1,
      mouthOpen: 0,    // 0=闭嘴, 1=张嘴
      mouthSmile: 0,   // 0=中性, 1=微笑
      browLeft: 0,     // 0=正常, 1=上扬
      browRight: 0,
      headYaw: 0.5,    // 0=左, 0.5=中, 1=右
      headPitch: 0.5,  // 0=上, 0.5=中, 1=下
      headRoll: 0.5,   // 0=左倾, 0.5=正, 1=右倾
      headX: 0.5,      // 0=左, 0.5=中, 1=右 (头部在画面中的水平位置)
      headY: 0.5,      // 0=上, 0.5=中, 1=下 (头部在画面中的垂直位置)
    };
    this.mirror = false; // 镜像翻转

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

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, w, h);

    // 计算头部位置（基于 headX/headY，模拟人在画面中的位置）
    // headX: 0=左, 0.5=中, 1=右  →  偏移范围 ±60px
    // headY: 0=上, 0.5=中, 1=下  →  偏移范围 ±40px
    const posX = (this.params.headX - 0.5) * 120;
    const posY = (this.params.headY - 0.5) * 80;

    // 头部姿态影响（相对于自身中心的旋转/倾斜）
    const headYaw = (this.params.headYaw - 0.5) * 40;
    const headPitch = (this.params.headPitch - 0.5) * 30;
    const headRoll = (this.params.headRoll - 0.5) * 20;

    const cx = w / 2 + posX;
    const cy = h / 2 + posY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(headRoll * Math.PI / 180);

    // 镜像翻转
    if (this.mirror) {
      ctx.scale(-1, 1);
    }

    // 头部朝向微调（yaw/pitch 影响绘制时的偏移）
    ctx.translate(headYaw * 0.5, headPitch * 0.5);

    const scale = Math.min(w, h) * 0.0035;
    ctx.scale(scale, scale);

    this.drawSacabambaspis(ctx);

    ctx.restore();

    // 参数标签
    this.drawLabels(ctx, w, h);
  }

  drawSacabambaspis(ctx) {
    const p = this.params;

    // === 身体（扁平鱼形，参考电音蝌蚪配色） ===
    ctx.beginPath();
    // 头部圆弧（左侧）
    ctx.arc(-60, 0, 70, Math.PI * 0.5, Math.PI * 1.5, true);
    // 背部弧线
    ctx.bezierCurveTo(-20, -85, 80, -75, 130, -40);
    // 尾部
    ctx.bezierCurveTo(160, -20, 170, 0, 160, 20);
    ctx.bezierCurveTo(170, 40, 160, 60, 130, 50);
    // 腹部弧线
    ctx.bezierCurveTo(80, 75, -20, 85, -60, 70);
    ctx.closePath();

    // 身体渐变（上半灰褐 #bdb8aa，下半米白 #f2f1ea）
    const bodyGrad = ctx.createLinearGradient(0, -85, 0, 85);
    bodyGrad.addColorStop(0, '#bdb8aa');
    bodyGrad.addColorStop(0.52, '#bdb8aa');
    bodyGrad.addColorStop(0.52, '#f2f1ea');
    bodyGrad.addColorStop(1, '#f2f1ea');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 身体轮廓（灰色描边，较粗）
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 4;
    ctx.stroke();

    // === 背部鳍 ===
    ctx.beginPath();
    ctx.moveTo(20, -78);
    ctx.quadraticCurveTo(45, -115, 75, -88);
    ctx.quadraticCurveTo(55, -82, 20, -78);
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // === 腹部鳍 ===
    ctx.beginPath();
    ctx.moveTo(20, 78);
    ctx.quadraticCurveTo(45, 115, 75, 88);
    ctx.quadraticCurveTo(55, 82, 20, 78);
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // === 尾鳍 ===
    ctx.beginPath();
    ctx.moveTo(155, 0);
    ctx.quadraticCurveTo(195, -38, 185, -12);
    ctx.quadraticCurveTo(205, 0, 185, 12);
    ctx.quadraticCurveTo(195, 38, 155, 0);
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // === 眼睛（大圆眼睛，白色底，黑色瞳孔） ===
    // 眼睛位置：参考电音蝌蚪，占脸宽 24%，高度在 36%
    const eyeY = -18;
    const leftEyeX = -42;
    const rightEyeX = 42;
    const eyeRadius = 32;

    this.drawSacabaEye(ctx, leftEyeX, eyeY, eyeRadius, p.eyeLeft);
    this.drawSacabaEye(ctx, rightEyeX, eyeY, eyeRadius, p.eyeRight);

    // === 鼻孔（两个黑色小椭圆，在脸中央） ===
    ctx.fillStyle = '#1a1a1a';
    // 左鼻孔
    ctx.beginPath();
    ctx.ellipse(-6, 18, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 右鼻孔
    ctx.beginPath();
    ctx.ellipse(6, 18, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // === 嘴巴（三角形嘴） ===
    this.drawSacabaMouth(ctx, 0, 38, p.mouthOpen, p.mouthSmile);

    // === 身体纹理（鳞片感， subtle） ===
    ctx.strokeStyle = 'rgba(124, 122, 114, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-10 + i * 28, 5, 32, Math.PI * 0.3, Math.PI * 0.7);
      ctx.stroke();
    }
  }

  drawSacabaEye(ctx, x, y, radius, openness) {
    // 眼白（大圆，白色）
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 瞳孔（黑色实心圆，根据 openness 调整大小）
    const pupilRadius = radius * 0.38 * (0.15 + openness * 0.85);
    const pupilY = y + 2;

    ctx.beginPath();
    ctx.arc(x, pupilY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#111111';
    ctx.fill();

    // 闭眼效果（灰色覆盖 + 闭眼线）
    if (openness < 0.25) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#c5c2ba';
      ctx.fill();
      ctx.strokeStyle = '#7c7a72';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 闭眼线
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.8, y);
      ctx.quadraticCurveTo(x, y + radius * 0.3, x + radius * 0.8, y);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  drawSacabaMouth(ctx, x, y, openness, smile) {
    const width = 32;
    const openHeight = 18 * openness;
    const smileOffset = smile * 6;

    if (openness > 0.2) {
      // 张嘴（三角形）
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y - smileOffset);
      ctx.lineTo(x + width / 2, y - smileOffset);
      ctx.lineTo(x, y + openHeight + smileOffset);
      ctx.closePath();

      ctx.fillStyle = '#8b3a3a';
      ctx.fill();
      ctx.strokeStyle = '#5a2a2a';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      // 闭嘴（倒三角/微笑线）
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + smileOffset * 0.5);
      ctx.quadraticCurveTo(x, y - 4 - smileOffset, x + width / 2, y + smileOffset * 0.5);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = 2.5;
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
