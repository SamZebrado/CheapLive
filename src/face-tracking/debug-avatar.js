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
      eyeLeft: { x: -35, y: -12, z: 60, r: 22 },
      eyeRight: { x: 20, y: -12, z: 60, r: 22 },
      nostrilLeft: { x: -10, y: 14, z: 65, rx: 5, ry: 4 },
      nostrilRight: { x: 2, y: 14, z: 65, rx: 5, ry: 4 },
      mouth: { x: -4, y: 34, z: 55, w: 24 },
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
    // yaw (Y轴旋转)
    let cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;

    // pitch (X轴旋转)
    let cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    let y2 = y1 * cosP - z1 * sinP;
    let z2 = y1 * sinP + z1 * cosP;
    let x2 = x1;

    // roll (Z轴旋转)
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

    // 头部姿态角度（从 0~1 归一化值转换到弧度）
    // yaw: 左右转头 (-60~+60度)
    // pitch: 低头抬头 (-40~+40度)
    // roll: 歪头 (-45~+45度)
    const yaw = (this.params.headYaw - 0.5) * Math.PI * 0.66;
    const pitch = (this.params.headPitch - 0.5) * Math.PI * 0.44;
    const roll = (this.params.headRoll - 0.5) * Math.PI * 0.5;

    const cx = w / 2 + posX;
    const cy = h / 2 + posY;

    const scale = Math.min(w, h) * 0.0035;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 绘制球体基底（正圆，随 pitch/yaw 有轻微透视变形）
    this.drawSphereBase(ctx, yaw, pitch);

    // 收集所有特征点，按 z 深度排序（远的先画）
    const featureList = [];

    // 左眼
    const leftEye3D = this.rotate3D(
      this.features.eyeLeft.x,
      this.features.eyeLeft.y,
      this.features.eyeLeft.z,
      yaw, pitch, roll
    );
    featureList.push({ type: 'eye', ...leftEye3D, r: this.features.eyeLeft.r, openness: this.params.eyeLeft, side: 'left' });

    // 右眼
    const rightEye3D = this.rotate3D(
      this.features.eyeRight.x,
      this.features.eyeRight.y,
      this.features.eyeRight.z,
      yaw, pitch, roll
    );
    featureList.push({ type: 'eye', ...rightEye3D, r: this.features.eyeRight.r, openness: this.params.eyeRight, side: 'right' });

    // 左鼻孔
    const leftNostril3D = this.rotate3D(
      this.features.nostrilLeft.x,
      this.features.nostrilLeft.y,
      this.features.nostrilLeft.z,
      yaw, pitch, roll
    );
    featureList.push({ type: 'nostril', ...leftNostril3D, rx: this.features.nostrilLeft.rx, ry: this.features.nostrilLeft.ry });

    // 右鼻孔
    const rightNostril3D = this.rotate3D(
      this.features.nostrilRight.x,
      this.features.nostrilRight.y,
      this.features.nostrilRight.z,
      yaw, pitch, roll
    );
    featureList.push({ type: 'nostril', ...rightNostril3D, rx: this.features.nostrilRight.rx, ry: this.features.nostrilRight.ry });

    // 嘴巴
    const mouth3D = this.rotate3D(
      this.features.mouth.x,
      this.features.mouth.y,
      this.features.mouth.z,
      yaw, pitch, roll
    );
    featureList.push({ type: 'mouth', ...mouth3D, w: this.features.mouth.w, openness: this.params.mouthOpen, smile: this.params.mouthSmile });

    // 按 z 值排序（z 小的先画，z 大的后画）
    featureList.sort((a, b) => a.z - b.z);

    // 绘制特征点
    for (const f of featureList) {
      // 透视缩放：z 越大（越靠近观察者），越大；z 越小（越远），越小
      const perspective = Math.max(0.3, (f.z + 80) / 140);
      // z 为负（背面）时淡化
      const opacity = f.z < -20 ? 0.15 : 1;

      if (f.type === 'eye') {
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

  drawSphereBase(ctx, yaw, pitch) {
    const r = this.sphereR;

    // 球体透视：pitch 影响高度压缩，yaw 影响宽度压缩
    const scaleY = 1 - Math.abs(Math.sin(pitch)) * 0.15;
    const scaleX = 1 - Math.abs(Math.sin(yaw)) * 0.1;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    // 正圆头部
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);

    // 填充：上半灰褐，下半米白，水平分界线在 52%
    const bodyGrad = ctx.createLinearGradient(0, -r, 0, r);
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

    ctx.restore();
  }

  draw3DEye(ctx, x, y, radius, openness, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    // 眼白
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 瞳孔
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
