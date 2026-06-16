/**
 * CheapLive Debug Avatar
 * 手搓 Canvas 调试小人，根据面捕参数实时变形
 * 用于在没有 Live2D 模型时测试面捕参数驱动效果
 */

export class DebugAvatar {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 0,      // 0=闭眼, 1=睁眼
      eyeRight: 0,
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
    const headYaw = (this.params.headYaw - 0.5) * 40;   // -20 ~ +20
    const headPitch = (this.params.headPitch - 0.5) * 30; // -15 ~ +15
    const headRoll = (this.params.headRoll - 0.5) * 20;   // -10 ~ +10

    ctx.save();
    ctx.translate(cx + headYaw, cy + headPitch);
    ctx.rotate(headRoll * Math.PI / 180);

    // 头部轮廓
    const headRadius = Math.min(w, h) * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFDBAC';
    ctx.fill();
    ctx.strokeStyle = '#E8A87C';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 头发
    ctx.beginPath();
    ctx.arc(0, -headRadius * 0.1, headRadius * 1.05, Math.PI, 0);
    ctx.fillStyle = '#4A3728';
    ctx.fill();

    // 眼睛参数
    const eyeY = -headRadius * 0.15;
    const eyeX = headRadius * 0.35;
    const eyeRadius = headRadius * 0.18;

    // 左眼
    this.drawEye(ctx, -eyeX, eyeY, eyeRadius, this.params.eyeLeft);
    // 右眼
    this.drawEye(ctx, eyeX, eyeY, eyeRadius, this.params.eyeRight);

    // 眉毛
    const browY = -headRadius * 0.4;
    const browOffset = this.params.browLeft * 15;
    this.drawBrow(ctx, -eyeX, browY - browOffset, headRadius * 0.3, -5 - this.params.browLeft * 10);

    const browOffsetR = this.params.browRight * 15;
    this.drawBrow(ctx, eyeX, browY - browOffsetR, headRadius * 0.3, 5 + this.params.browRight * 10);

    // 嘴巴
    const mouthY = headRadius * 0.35;
    this.drawMouth(ctx, 0, mouthY, headRadius * 0.4, this.params.mouthOpen, this.params.mouthSmile);

    // 腮红
    ctx.beginPath();
    ctx.arc(-headRadius * 0.55, headRadius * 0.1, headRadius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(headRadius * 0.55, headRadius * 0.1, headRadius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
    ctx.fill();

    ctx.restore();

    // 绘制参数标签
    this.drawLabels(ctx, w, h);
  }

  drawEye(ctx, x, y, radius, openness) {
    // 眼白
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 瞳孔（根据 openness 调整大小和位置）
    const pupilRadius = radius * 0.35 * (0.3 + openness * 0.7);
    const pupilY = y + radius * 0.1;

    ctx.beginPath();
    ctx.arc(x, pupilY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#2C3E50';
    ctx.fill();

    // 高光
    ctx.beginPath();
    ctx.arc(x - pupilRadius * 0.3, pupilY - pupilRadius * 0.3, pupilRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();

    // 眼皮（闭眼效果）
    if (openness < 0.3) {
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFDBAC';
      ctx.fill();
      ctx.strokeStyle = '#E8A87C';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 眼线
      ctx.beginPath();
      ctx.moveTo(x - radius, y);
      ctx.quadraticCurveTo(x, y + radius * 0.3, x + radius, y);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  drawBrow(ctx, x, y, width, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);

    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.quadraticCurveTo(0, -width * 0.15, width / 2, 0);
    ctx.strokeStyle = '#4A3728';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  drawMouth(ctx, x, y, width, openness, smile) {
    ctx.save();
    ctx.translate(x, y);

    const openHeight = width * 0.6 * openness;
    const smileCurve = smile * width * 0.3;

    if (openness > 0.15) {
      // 张嘴
      ctx.beginPath();
      ctx.moveTo(-width / 2, -smileCurve);
      ctx.quadraticCurveTo(0, smileCurve + openHeight, width / 2, -smileCurve);
      ctx.quadraticCurveTo(0, -smileCurve - openHeight * 0.3, -width / 2, -smileCurve);
      ctx.fillStyle = '#C0392B';
      ctx.fill();
      ctx.strokeStyle = '#922B21';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 牙齿
      if (openness > 0.4) {
        ctx.beginPath();
        ctx.moveTo(-width * 0.35, -smileCurve * 0.3);
        ctx.quadraticCurveTo(0, smileCurve * 0.5, width * 0.35, -smileCurve * 0.3);
        ctx.lineTo(width * 0.3, -smileCurve * 0.3 - openHeight * 0.2);
        ctx.quadraticCurveTo(0, smileCurve * 0.3 - openHeight * 0.2, -width * 0.3, -smileCurve * 0.3 - openHeight * 0.2);
        ctx.closePath();
        ctx.fillStyle = '#FFF';
        ctx.fill();
      }
    } else {
      // 闭嘴
      ctx.beginPath();
      ctx.moveTo(-width / 2, smileCurve * 0.5);
      ctx.quadraticCurveTo(0, -smileCurve, width / 2, smileCurve * 0.5);
      ctx.strokeStyle = '#C0392B';
      ctx.lineWidth = 2.5;
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
      `smile: ${this.params.mouthSmile.toFixed(2)}`,
      `yaw: ${this.params.headYaw.toFixed(2)}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}
