/**
 * CheapLive Debug Avatar - Sacabambaspis Edition
 * 萨卡班甲鱼调试形象，根据面捕参数实时变形
 * 灰白配色、大圆眼睛、三角形嘴
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

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, w, h);

    // 头部姿态影响
    const headYaw = (this.params.headYaw - 0.5) * 40;
    const headPitch = (this.params.headPitch - 0.5) * 30;
    const headRoll = (this.params.headRoll - 0.5) * 20;

    ctx.save();
    ctx.translate(cx + headYaw, cy + headPitch);
    ctx.rotate(headRoll * Math.PI / 180);

    const scale = Math.min(w, h) * 0.0035;
    ctx.scale(scale, scale);

    this.drawSacabambaspis(ctx);

    ctx.restore();

    // 参数标签
    this.drawLabels(ctx, w, h);
  }

  drawSacabambaspis(ctx) {
    const p = this.params;

    // === 身体（扁平鱼形） ===
    ctx.beginPath();
    // 头部圆弧
    ctx.arc(-60, 0, 70, Math.PI * 0.5, Math.PI * 1.5, true);
    // 背部弧线
    ctx.bezierCurveTo(-20, -85, 80, -75, 130, -40);
    // 尾部
    ctx.bezierCurveTo(160, -20, 170, 0, 160, 20);
    ctx.bezierCurveTo(170, 40, 160, 60, 130, 50);
    // 腹部弧线
    ctx.bezierCurveTo(80, 75, -20, 85, -60, 70);
    ctx.closePath();

    // 身体渐变（灰白配色）
    const bodyGrad = ctx.createLinearGradient(-60, -80, 130, 80);
    bodyGrad.addColorStop(0, '#D0D5DD');
    bodyGrad.addColorStop(0.5, '#E8ECF0');
    bodyGrad.addColorStop(1, '#C5CCD6');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 身体轮廓
    ctx.strokeStyle = '#8B95A5';
    ctx.lineWidth = 3;
    ctx.stroke();

    // === 背部鳍 ===
    ctx.beginPath();
    ctx.moveTo(20, -75);
    ctx.quadraticCurveTo(40, -110, 70, -85);
    ctx.quadraticCurveTo(50, -80, 20, -75);
    ctx.fillStyle = '#B8C0CC';
    ctx.fill();
    ctx.strokeStyle = '#8B95A5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // === 腹部鳍 ===
    ctx.beginPath();
    ctx.moveTo(20, 75);
    ctx.quadraticCurveTo(40, 110, 70, 85);
    ctx.quadraticCurveTo(50, 80, 20, 75);
    ctx.fillStyle = '#B8C0CC';
    ctx.fill();
    ctx.stroke();

    // === 尾鳍 ===
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.quadraticCurveTo(190, -35, 180, -10);
    ctx.quadraticCurveTo(200, 0, 180, 10);
    ctx.quadraticCurveTo(190, 35, 150, 0);
    ctx.fillStyle = '#B8C0CC';
    ctx.fill();
    ctx.strokeStyle = '#8B95A5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // === 眼睛（大圆眼睛） ===
    const eyeY = -15;
    const eyeX = -35;
    const eyeRadius = 28;

    // 左眼
    this.drawSacabaEye(ctx, eyeX - 5, eyeY, eyeRadius, p.eyeLeft);
    // 右眼
    this.drawSacabaEye(ctx, eyeX + 55, eyeY, eyeRadius, p.eyeRight);

    // === 嘴巴（三角形嘴） ===
    this.drawSacabaMouth(ctx, 10, 25, p.mouthOpen, p.mouthSmile);

    // === 腮红 ===
    ctx.beginPath();
    ctx.ellipse(-55, 20, 18, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 160, 170, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(65, 20, 18, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 160, 170, 0.25)';
    ctx.fill();

    // === 身体纹理（鳞片感） ===
    ctx.strokeStyle = 'rgba(139, 149, 165, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-20 + i * 25, 0, 35, Math.PI * 0.3, Math.PI * 0.7);
      ctx.stroke();
    }
  }

  drawSacabaEye(ctx, x, y, radius, openness) {
    // 眼白（大圆）
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.strokeStyle = '#8B95A5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 瞳孔（根据 openness 调整）
    const pupilRadius = radius * 0.45 * (0.2 + openness * 0.8);
    const pupilY = y + 3;

    ctx.beginPath();
    ctx.arc(x, pupilY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#2C3E50';
    ctx.fill();

    // 瞳孔高光
    ctx.beginPath();
    ctx.arc(x - pupilRadius * 0.35, pupilY - pupilRadius * 0.35, pupilRadius * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();

    // 闭眼效果
    if (openness < 0.3) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#D0D5DD';
      ctx.fill();
      ctx.strokeStyle = '#8B95A5';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 闭眼线
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.8, y);
      ctx.quadraticCurveTo(x, y + radius * 0.3, x + radius * 0.8, y);
      ctx.strokeStyle = '#5A6575';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  drawSacabaMouth(ctx, x, y, openness, smile) {
    const width = 35;
    const openHeight = 20 * openness;
    const smileOffset = smile * 8;

    if (openness > 0.2) {
      // 张嘴（三角形）
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y - smileOffset);
      ctx.lineTo(x + width / 2, y - smileOffset);
      ctx.lineTo(x, y + openHeight + smileOffset);
      ctx.closePath();

      ctx.fillStyle = '#C0392B';
      ctx.fill();
      ctx.strokeStyle = '#922B21';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 舌头
      if (openness > 0.5) {
        ctx.beginPath();
        ctx.moveTo(x - width * 0.25, y + openHeight * 0.3);
        ctx.quadraticCurveTo(x, y + openHeight * 0.8, x + width * 0.25, y + openHeight * 0.3);
        ctx.fillStyle = '#E74C3C';
        ctx.fill();
      }
    } else {
      // 闭嘴（倒三角/微笑线）
      ctx.beginPath();
      ctx.moveTo(x - width / 2, y + smileOffset * 0.5);
      ctx.quadraticCurveTo(x, y - 5 - smileOffset, x + width / 2, y + smileOffset * 0.5);
      ctx.strokeStyle = '#5A6575';
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
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}
