/**
 * CheapLive Debug Avatar - Sacabambaspis Edition
 * 萨卡班甲鱼调试形象，根据面捕参数实时变形
 * 参考真实 Sacabambaspis 化石复原图和 HaageemeeOtamatone 鱼脸模式
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
      browLeft: 0,
      browRight: 0,
      headYaw: 0.5,    // 0=左, 0.5=中, 1=右
      headPitch: 0.5,  // 0=上, 0.5=中, 1=下
      headRoll: 0.5,   // 0=左倾, 0.5=正, 1=右倾
      headX: 0.5,      // 0=左, 0.5=中, 1=右
      headY: 0.5,      // 0=上, 0.5=中, 1=下
    };
    this.mirror = false;

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

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, w, h);

    const posX = (this.params.headX - 0.5) * 120;
    const posY = (this.params.headY - 0.5) * 80;
    const headYaw = (this.params.headYaw - 0.5) * 40;
    const headPitch = (this.params.headPitch - 0.5) * 30;
    const headRoll = (this.params.headRoll - 0.5) * 20;

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
    this.drawLabels(ctx, w, h);
  }

  drawSacabambaspis(ctx) {
    const p = this.params;

    // === 身体：Sacabambaspis 是扁平的盾皮鱼 ===
    // 整体呈圆角菱形/盾牌状，头部圆钝，身体向后逐渐收窄
    ctx.beginPath();
    // 头顶（圆弧形）
    ctx.arc(-40, -10, 75, Math.PI * 1.15, Math.PI * 1.85, false);
    // 右侧背部弧线
    ctx.bezierCurveTo(50, -75, 110, -50, 140, -15);
    // 尾部上沿
    ctx.bezierCurveTo(165, 0, 170, 5, 160, 15);
    // 尾部下沿
    ctx.bezierCurveTo(170, 25, 165, 30, 140, 35);
    // 右侧腹部弧线
    ctx.bezierCurveTo(110, 60, 50, 65, -20, 55);
    // 底部（较平）
    ctx.bezierCurveTo(-60, 50, -80, 40, -90, 20);
    // 左侧腹部回到头部
    ctx.bezierCurveTo(-100, 0, -95, -20, -85, -40);
    ctx.closePath();

    // 身体填充：上半灰褐，下半米白，水平分界线
    const bodyGrad = ctx.createLinearGradient(0, -80, 0, 70);
    bodyGrad.addColorStop(0, '#b5b0a2');
    bodyGrad.addColorStop(0.50, '#b5b0a2');
    bodyGrad.addColorStop(0.50, '#f0eee6');
    bodyGrad.addColorStop(1, '#f0eee6');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 身体轮廓
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // === 背鳍（小三角形，在背部中央偏后） ===
    ctx.beginPath();
    ctx.moveTo(30, -72);
    ctx.lineTo(55, -105);
    ctx.lineTo(75, -68);
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // === 臀鳍（小三角形，在腹部中央偏后） ===
    ctx.beginPath();
    ctx.moveTo(30, 62);
    ctx.lineTo(55, 95);
    ctx.lineTo(75, 58);
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // === 尾鳍（对称分叉） ===
    ctx.beginPath();
    ctx.moveTo(155, 5);
    ctx.quadraticCurveTo(190, -30, 185, -5);
    ctx.quadraticCurveTo(200, 5, 185, 15);
    ctx.quadraticCurveTo(190, 40, 155, 15);
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // === 眼睛（萨卡班甲鱼标志性的大圆眼，位置偏前上方） ===
    // 眼睛在头部前侧，间距较大，非常圆
    const eyeY = -35;
    const leftEyeX = -55;
    const rightEyeX = 15;
    const eyeRadius = 26;

    this.drawSacabaEye(ctx, leftEyeX, eyeY, eyeRadius, p.eyeLeft);
    this.drawSacabaEye(ctx, rightEyeX, eyeY, eyeRadius, p.eyeRight);

    // === 鼻孔（两个小黑点，在两眼之间偏下） ===
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(-22, -5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-14, -5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // === 嘴巴（小三角形嘴，在头部前端下方） ===
    this.drawSacabaMouth(ctx, -18, 18, p.mouthOpen, p.mouthSmile);

    // === 头部侧线（Sacabambaspis 特征：感觉沟） ===
    ctx.strokeStyle = 'rgba(124, 122, 114, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-70, -10);
    ctx.quadraticCurveTo(-30, -5, 20, -8);
    ctx.quadraticCurveTo(80, -12, 130, -5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-70, 15);
    ctx.quadraticCurveTo(-30, 20, 20, 18);
    ctx.quadraticCurveTo(80, 15, 130, 20);
    ctx.stroke();

    // === 身体鳞片纹理（ subtle 的菱形鳞片） ===
    ctx.strokeStyle = 'rgba(124, 122, 114, 0.12)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const sx = 10 + col * 22;
        const sy = -15 + row * 18;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 6);
        ctx.lineTo(sx + 8, sy);
        ctx.lineTo(sx, sy + 6);
        ctx.lineTo(sx - 8, sy);
        ctx.closePath();
        ctx.stroke();
      }
    }
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
    const pupilRadius = radius * (0.25 + openness * 0.55); // 0.25~0.80
    const pupilY = y + 1;

    ctx.beginPath();
    ctx.arc(x, pupilY, Math.max(2, pupilRadius), 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // 闭眼效果：当 openness < 0.3 时，用眼皮覆盖
    if (openness < 0.3) {
      const closedAmount = 1 - (openness / 0.3); // 0~1
      const eyelidY = y - radius + (radius * 2 * (1 - closedAmount * 0.85));

      // 上眼皮（灰褐色，覆盖眼睛上半部分）
      ctx.beginPath();
      ctx.ellipse(x, eyelidY - radius * 0.1, radius + 2, radius * closedAmount * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b5b0a2';
      ctx.fill();

      // 闭眼线
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
    const width = 22;
    const openHeight = 14 * openness;
    const smileOffset = smile * 4;

    if (openness > 0.2) {
      // 张嘴（小三角形）
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
      // 闭嘴（小弧线）
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
