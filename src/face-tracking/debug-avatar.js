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

    // 头部旋转角度：从 0-1 归一化值映射到实际弧度
    // yaw 范围增大到 ±80°，pitch ±60°，roll ±60°，确保旋转响应明显
    const yaw = (this.params.headYaw - 0.5) * Math.PI * 0.88;
    const pitch = (this.params.headPitch - 0.5) * Math.PI * 0.66;
    const roll = (this.params.headRoll - 0.5) * Math.PI * 0.66;

    const cx = w / 2 + posX;
    const cy = h / 2 + posY;

    const scale = Math.min(w, h) * 0.0035;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const s = this.spindle;

    // === 构建3D纺锤体：多层椭圆截面堆叠 ===
    // 沿身体长轴方向采样截面，每个截面是一个椭圆
    const sections = [];
    const numSections = 28;
    for (let i = 0; i <= numSections; i++) {
      const t = i / numSections;
      // 身体轮廓：头部圆钝 → 中部最宽 → 尾部渐细
      const sx = this.spineX(t);
      const sy = 0; // 脊柱中线
      const sz = 0;
      // 截面宽度（身体轮廓）
      const sw = this.bodyWidthAt(t);
      // 截面高度（z 方向深度，体现3D体积）
      const sh = this.bodyDepthAt(t);

      const rotated = this.rotate3D(sx, sy, sz, yaw, pitch, roll);
      sections.push({
        x: rotated.x,
        y: rotated.y,
        z: rotated.z,
        rx: sw,
        ry: sh,
        t: t,
      });
    }

    // 按 z 深度排序（远的先画，实现画家算法遮挡）
    sections.sort((a, b) => a.z - b.z);

    // 收集特征点
    const featureList = [];
    const addFeature = (feat, type, extra) => {
      const r = this.rotate3D(feat.x, feat.y, feat.z, yaw, pitch, roll);
      featureList.push({ type, ...r, ...extra });
    };
    addFeature(this.features.eyeLeft, 'eye', { r: this.features.eyeLeft.r, openness: this.params.eyeLeft });
    addFeature(this.features.eyeRight, 'eye', { r: this.features.eyeRight.r, openness: this.params.eyeRight });
    addFeature(this.features.nostrilLeft, 'nostril', { rx: this.features.nostrilLeft.rx, ry: this.features.nostrilLeft.ry });
    addFeature(this.features.nostrilRight, 'nostril', { rx: this.features.nostrilRight.rx, ry: this.features.nostrilRight.ry });
    addFeature(this.features.mouth, 'mouth', { w: this.features.mouth.w, openness: this.params.mouthOpen, smile: this.params.mouthSmile });

    featureList.sort((a, b) => a.z - b.z);

    // 合并截面和特征点，统一按 z 排序
    const allItems = [
      ...sections.map(sec => ({ type: 'section', ...sec })),
      ...featureList,
    ];
    allItems.sort((a, b) => a.z - b.z);

    // 绘制所有元素
    const tailEnd = this.rotate3D(s.bodyLength, 0, 0, yaw, pitch, roll);

    for (const item of allItems) {
      const perspective = Math.max(0.3, (item.z + 80) / 140);
      const opacity = item.z < -20 ? 0.2 : 1;

      if (item.type === 'section') {
        this.drawSection(ctx, item.x, item.y, item.rx * perspective, item.ry * perspective, roll, opacity, item.t);
      } else if (item.type === 'eye') {
        this.draw3DEye(ctx, item.x, item.y, item.r * perspective, item.openness, opacity);
      } else if (item.type === 'nostril') {
        this.draw3DNostril(ctx, item.x, item.y, item.rx * perspective, item.ry * perspective, opacity);
      } else if (item.type === 'mouth') {
        this.draw3DMouth(ctx, item.x, item.y, item.w * perspective, item.openness, item.smile, opacity);
      }
    }

    // 最后画尾巴（在所有截面之后）
    this.draw3DTail(ctx, tailEnd, s.tailLength, yaw, pitch, perspective);

    ctx.restore();

    if (!this.appMode) {
      this.drawLabels(ctx, w, h);
    }
  }

  // 身体脊柱 X 坐标（从头部到尾部）
  spineX(t) {
    const s = this.spindle;
    // 使用贝塞尔曲线模拟纺锤体轮廓
    // 头部在 x=0 附近，身体延伸到 x=s.bodyLength
    const p0 = -s.headR * 0.3;  // 头部前端
    const p3 = s.bodyLength + s.tailLength * 0.5; // 尾端
    // 贝塞尔曲线：头部圆钝，中部平直，尾部渐细
    const cp1 = s.headR * 0.5;
    const cp2 = s.bodyLength * 0.7;
    return this.cubicBezier(p0, cp1, cp2, p3, t);
  }

  // 身体截面宽度（轮廓）
  bodyWidthAt(t) {
    const s = this.spindle;
    // 头部最宽，中部略窄，尾部急剧变细
    if (t < 0.15) {
      // 头部圆钝区域
      return s.headR * Math.sin(t / 0.15 * Math.PI * 0.5);
    } else if (t < 0.6) {
      // 身体中部，保持宽度
      return s.bodyWidth * (1 - (t - 0.15) * 0.2);
    } else {
      // 尾部渐细
      const tailT = (t - 0.6) / 0.4;
      return s.bodyWidth * (1 - tailT) * (1 - tailT * 0.5);
    }
  }

  // 身体截面深度（z 方向，体现3D体积）
  bodyDepthAt(t) {
    const d = this.spindle.bodyDepth;
    if (t < 0.15) {
      return d * 0.8 * Math.sin(t / 0.15 * Math.PI * 0.5);
    } else if (t < 0.6) {
      return d * 0.8 * (1 - (t - 0.15) * 0.15);
    } else {
      const tailT = (t - 0.6) / 0.4;
      return d * 0.8 * (1 - tailT) * (1 - tailT);
    }
  }

  cubicBezier(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  // 绘制单个身体截面（半椭圆：上半灰色，下半白色）
  drawSection(ctx, cx, cy, rx, ry, roll, opacity, t) {
    ctx.save();
    ctx.globalAlpha = opacity;

    // 上半身（灰色/棕色）
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, roll, Math.PI, 0, false);
    ctx.closePath();
    // 使用径向渐变模拟3D光照
    const gradTop = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, rx * 0.1, cx, cy, rx);
    gradTop.addColorStop(0, '#d4cec0'); // 亮部（高光）
    gradTop.addColorStop(0.5, '#bdb8aa'); // 中间色
    gradTop.addColorStop(1, '#9a9588'); // 暗部（边缘）
    ctx.fillStyle = gradTop;
    ctx.fill();

    // 下半身（白色/米色）
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, roll, 0, Math.PI, false);
    ctx.closePath();
    const gradBottom = ctx.createRadialGradient(cx + rx * 0.1, cy + ry * 0.2, rx * 0.1, cx, cy, rx);
    gradBottom.addColorStop(0, '#ffffff'); // 亮部
    gradBottom.addColorStop(0.6, '#f2f1ea'); // 中间色
    gradBottom.addColorStop(1, '#d5d2c8'); // 暗部（边缘）
    ctx.fillStyle = gradBottom;
    ctx.fill();

    // 轮廓线（只在首尾截面画完整轮廓，中间截面省去减少杂乱）
    if (t < 0.05 || t > 0.9 || Math.abs(t - 0.5) < 0.05) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, roll, 0, Math.PI * 2);
      ctx.strokeStyle = '#9a9588';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // 3D尾巴
  draw3DTail(ctx, tailEnd, tailLen, yaw, pitch, perspective) {
    const t = tailLen * perspective;
    const x = tailEnd.x;
    const y = tailEnd.y;
    const tailAngle = Math.sin(yaw) * 0.3;

    ctx.save();

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
    const gradTop = ctx.createLinearGradient(x, y - t * 0.3, x + t * 0.5, y);
    gradTop.addColorStop(0, '#c5bfb0');
    gradTop.addColorStop(1, '#a8a49c');
    ctx.fillStyle = gradTop;
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
    const gradBottom = ctx.createLinearGradient(x, y, x + t * 0.5, y + t * 0.3);
    gradBottom.addColorStop(0, '#f2f1ea');
    gradBottom.addColorStop(1, '#d5d2c8');
    ctx.fillStyle = gradBottom;
    ctx.fill();
    ctx.strokeStyle = '#7c7a72';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
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
