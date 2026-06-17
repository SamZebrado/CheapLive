/**
 * CheapLive Debug Avatar - Sacabambaspis Edition with Pseudo-3D Sphere
 * 萨卡班甲鱼调试形象，伪3D球体效果
 * 参考 HaageemeeOtamatone 鱼脸模式配色
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
    this.appMode = false;

    // 3D 球体参数
    this.sphereR = 85; // 球半径

    // 特征点在球面上的局部 3D 坐标 (x, y, z)
    // z 正方向朝向观察者
    this.features = {
      eyeLeft: { x: -38, y: -14, z: 58, r: 24 },
      eyeRight: { x: 22, y: -14, z: 58, r: 24 },
      nostrilLeft: { x: -10, y: 16, z: 62, rx: 5, ry: 4 },
      nostrilRight: { x: 2, y: 16, z: 62, rx: 5, ry: 4 },
      mouth: { x: -4, y: 36, z: 52, w: 26 },
    };

    // 纺锤形身体控制点（3D 坐标，用于 rotate3D 旋转）
    // z 坐标赋予不同深度，使旋转时产生真正的3D体积感
    this.spindle = {
      headR: 75,
      bodyLength: 140,
      bodyWidth: 55,
      tailLength: 60,
      bodyDepth: 40, // 身体深度（z方向半径）
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

  setMirror(enabled) {
    this.mirror = enabled;
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.draw();
  }

  // 3D 旋转：先 yaw（Y轴），再 pitch（X轴），再 roll（Z轴）
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
    let z3 = z2;

    return { x: x3, y: y3, z: z3 };
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

    // 收集所有可旋转的元素（身体 + 特征点）
    const renderList = [];

    // === 身体轮廓点（3D 坐标，有真实 z 深度） ===
    const s = this.spindle;
    const d = s.bodyDepth;
    const bodyPoints = [
      // 背部轮廓（z > 0，朝向观察者）
      { x: -s.headR * 0.3, y: -s.headR, z: d * 0.3, type: 'body' },
      { x: s.headR * 0.5, y: -s.bodyWidth, z: d * 0.7, type: 'body' },
      { x: s.bodyLength * 0.6, y: -s.bodyWidth * 0.85, z: d * 0.9, type: 'body' },
      { x: s.bodyLength, y: -s.bodyWidth * 0.3, z: d * 0.6, type: 'body' },
      { x: s.bodyLength + 15, y: -s.bodyWidth * 0.15, z: d * 0.3, type: 'body' },
      { x: s.bodyLength + 25, y: -5, z: d * 0.15, type: 'body' },
      { x: s.bodyLength + s.tailLength * 0.5, y: 0, z: 0, type: 'body' },
      // 腹部轮廓（z < 0，远离观察者）
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

    // 旋转身体点并计算平均 z 值
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

    // === 特征点 ===
    const leftEye3D = this.rotate3D(
      this.features.eyeLeft.x, this.features.eyeLeft.y, this.features.eyeLeft.z,
      yaw, pitch, roll
    );
    renderList.push({ type: 'eye', ...leftEye3D, r: this.features.eyeLeft.r, openness: this.params.eyeLeft, side: 'left' });

    const rightEye3D = this.rotate3D(
      this.features.eyeRight.x, this.features.eyeRight.y, this.features.eyeRight.z,
      yaw, pitch, roll
    );
    renderList.push({ type: 'eye', ...rightEye3D, r: this.features.eyeRight.r, openness: this.params.eyeRight, side: 'right' });

    const leftNostril3D = this.rotate3D(
      this.features.nostrilLeft.x, this.features.nostrilLeft.y, this.features.nostrilLeft.z,
      yaw, pitch, roll
    );
    renderList.push({ type: 'nostril', ...leftNostril3D, rx: this.features.nostrilLeft.rx, ry: this.features.nostrilLeft.ry });

    const rightNostril3D = this.rotate3D(
      this.features.nostrilRight.x, this.features.nostrilRight.y, this.features.nostrilRight.z,
      yaw, pitch, roll
    );
    renderList.push({ type: 'nostril', ...rightNostril3D, rx: this.features.nostrilRight.rx, ry: this.features.nostrilRight.ry });

    const mouth3D = this.rotate3D(
      this.features.mouth.x, this.features.mouth.y, this.features.mouth.z,
      yaw, pitch, roll
    );
    renderList.push({ type: 'mouth', ...mouth3D, w: this.features.mouth.w, openness: this.params.mouthOpen, smile: this.params.mouthSmile });

    // 按 z 值排序（z 小的先画）
    renderList.sort((a, b) => a.z - b.z);

    // 绘制
    for (const f of renderList) {
      const perspective = Math.max(0.3, (f.z + 80) / 140);
      const opacity = f.z < -20 ? 0.15 : 1;

      if (f.type === 'spindleBody') {
        this.drawRotatedSpindle(ctx, f.points, f.tailEnd, f.tailLen, yaw, pitch, perspective, opacity);
      } else if (f.type === 'eye') {
        this.draw3DEye(ctx, f.x, f.y, f.r * perspective, f.openness, opacity);
      } else if (f.type === 'nostril') {
        this.draw3DNostril(ctx, f.x, f.y, f.rx * perspective, f.ry * perspective, opacity);
      } else if (f.type === 'mouth') {
        this.draw3DMouth(ctx, f.x, f.y, f.w * perspective, f.openness, f.smile, opacity);
      }
    }

    ctx.restore();

    if (!this.appMode) {
      this.drawLabels(ctx, w, h);
    }
  }

  drawRotatedSpindle(ctx, points, tailEnd, tailLen, yaw, pitch, perspective, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    // 纺锤形身体路径
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // 背部弧线
    ctx.bezierCurveTo(points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y);

    // 尾柄
    ctx.bezierCurveTo(points[4].x, points[4].y, points[5].x, points[5].y, points[6].x, points[6].y);

    // 尾巴下分叉
    ctx.bezierCurveTo(points[7].x, points[7].y, points[8].x, points[8].y, points[9].x, points[9].y);
    ctx.bezierCurveTo(points[10].x, points[10].y, points[11].x, points[11].y, points[12].x, points[12].y);

    // 腹部弧线
    ctx.bezierCurveTo(points[13].x, points[13].y, points[14].x, points[14].y, points[15].x, points[15].y);

    ctx.closePath();

    // 填充：上半灰褐，下半米白
    const bodyGrad = ctx.createLinearGradient(0, -60 * perspective, 0, 60 * perspective);
    bodyGrad.addColorStop(0, '#bdb8aa');
    bodyGrad.addColorStop(0.50, '#bdb8aa');
    bodyGrad.addColorStop(0.50, '#f2f1ea');
    bodyGrad.addColorStop(1, '#f2f1ea');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 轮廓
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 尾巴
    this.drawRotatedTail(ctx, tailEnd, tailLen, yaw, pitch, perspective);

    ctx.restore();
  }

  drawRotatedTail(ctx, tailEnd, tailLen, yaw, pitch, perspective) {
    const t = tailLen * perspective;
    const x = tailEnd.x;
    const y = tailEnd.y;

    // 根据 yaw 调整尾巴展开角度
    const tailAngle = Math.sin(yaw) * 0.3;

    // 上尾叶
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.quadraticCurveTo(
      x + t * 0.5, y - t * 0.6 + tailAngle * 20,
      x + t, y - t * 0.3 + tailAngle * 10
    );
    ctx.quadraticCurveTo(
      x + t * 0.7, y - t * 0.1,
      x + t * 0.3, y
    );
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 下尾叶
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(
      x + t * 0.5, y + t * 0.6 + tailAngle * 20,
      x + t, y + t * 0.3 + tailAngle * 10
    );
    ctx.quadraticCurveTo(
      x + t * 0.7, y + t * 0.1,
      x + t * 0.3, y
    );
    ctx.closePath();
    ctx.fillStyle = '#a8a49c';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  draw3DEye(ctx, x, y, radius, openness, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const pupilRadius = radius * (0.25 + openness * 0.55);
    const pupilY = y + 1;

    ctx.beginPath();
    ctx.arc(x, pupilY, Math.max(2, pupilRadius), 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

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

    ctx.restore();
  }

  draw3DNostril(ctx, x, y, rx, ry, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw3DMouth(ctx, x, y, width, openness, smile, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

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
      `pitch: ${this.params.headPitch.toFixed(2)}`,
      `roll: ${this.params.headRoll.toFixed(2)}`,
      `pos: ${this.params.headX.toFixed(2)},${this.params.headY.toFixed(2)}`,
      `mirror: ${this.mirror ? 'on' : 'off'}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }
}
