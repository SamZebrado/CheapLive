/**
 * ProceduralMeshRenderer
 *
 * 统一的程序化 Canvas 2.5D 网格渲染器。
 *
 * 目标：
 *   - 球体头像 + 纺锤鲸鱼共用同一套渲染管线；
 *   - 所有五官（眼睛、嘴巴、眉毛）绑定到表面参数坐标，而非固定世界坐标；
 *   - 根据表面法线判断可见性；远侧五官在侧转时被压缩/隐藏；
 *   - 不直接修改 canvas.style.width/height，避免尺寸闪烁（由 CSS 的
 *     aspect-ratio 100% 驱动布局）。
 *
 * 仅使用 mesh-sphere.js / mesh-spindle-whale.js 的公开几何函数；
 * 不包含 Live2D / Cubism 相关逻辑。
 */

import {
  createSphereMesh,
  deformSphere,
  computeSphereFaceAnchor,
  computeSphereFaceAnchorXYZ,
} from './mesh-sphere.js';
import {
  createSpindleMesh,
  deformSpindle,
  computeFaceAnchor,
  computeFaceAnchorXYZ,
} from './mesh-spindle-whale.js';

// ---------------- 公共工具 ----------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  const p1 = parseHex(c1);
  const p2 = parseHex(c2);
  const r = Math.round(lerp(p1.r, p2.r, t));
  const g = Math.round(lerp(p1.g, p2.g, t));
  const b = Math.round(lerp(p1.b, p2.b, t));
  return `rgb(${r}, ${g}, ${b})`;
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function applyLight(faceCenterNormal, lightDir, baseColor) {
  // 点积表示朝向光源的程度，映射到 [ambient, 1.0]
  const dot =
    (faceCenterNormal.x || 0) * lightDir.x +
    (faceCenterNormal.y || 0) * lightDir.y +
    (faceCenterNormal.z || 0) * lightDir.z;
  const factor = 0.55 + 0.45 * clamp(dot, -0.2, 1.0);
  const rgb = parseRGB(baseColor);
  const r = Math.round(clamp(rgb.r * factor, 0, 255));
  const g = Math.round(clamp(rgb.g * factor, 0, 255));
  const b = Math.round(clamp(rgb.b * factor, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

function parseRGB(c) {
  if (!c) return { r: 0, g: 0, b: 0 };
  if (c.startsWith('#')) return parseHex(c);
  const m = c.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
  if (m) return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
  return { r: 0, g: 0, b: 0 };
}

/**
 * 将 face-tracker 的 [0, 1] 归一化参数转为渲染器可用的值。
 */
function normalizeParams(p) {
  return {
    eyeLeft: clamp(p.eyeLeft ?? 1, 0, 1),
    eyeRight: clamp(p.eyeRight ?? 1, 0, 1),
    mouthOpen: clamp(p.mouthOpen ?? 0, 0, 1),
    mouthSmile: clamp(p.mouthSmile ?? 0, 0, 1),
    browLeft: clamp(p.browLeft ?? 0, 0, 1),
    browRight: clamp(p.browRight ?? 0, 0, 1),
    // headYaw/Pitch/Roll: 0.5 居中；向外扩展到 ±60° yaw, ±45° pitch, ±40° roll
    headYaw: (clamp(p.headYaw ?? 0.5, 0, 1) - 0.5) * 120,
    headPitch: (clamp(p.headPitch ?? 0.5, 0, 1) - 0.5) * 90,
    headRoll: (clamp(p.headRoll ?? 0.5, 0, 1) - 0.5) * 80,
    headX: clamp(p.headX ?? 0.5, 0, 1),
    headY: clamp(p.headY ?? 0.5, 0, 1),
  };
}

// ---------------- 基类 ----------------

class ProceduralMeshRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas "${canvasId}" not found`);
    }
    this.ctx = this.canvas.getContext('2d');
    this.params = {
      eyeLeft: 1, eyeRight: 1,
      mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.mirror = true;
    this.appMode = false;

    // 调试网格显示（默认关闭，不展示给用户）
    this.debugMesh = false;

    // 用于 resize 事件绑定
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);

    // 基类只初始化，不调用 draw()——子类创建 mesh 后再调用
    // this.draw() 移到子类构造函数末尾
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.draw();
  }

  setMirror(enabled) {
    this.mirror = !!enabled;
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = !!enabled;
    this.draw();
  }

  /**
   * resize：只读取 CSS 已经布局完成后的容器尺寸，按 DPR 设置内部像素。
   * 不改动 canvas.style.width/height，由 .avatar-wrapper canvas 的
   * 100% / 100% 直接承接。这样避免尺寸闪烁循环。
   */
  resize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const parent = this.canvas.parentElement;
    // 读取 CSS 已经计算好的容器大小（单位：CSS 像素）
    const cssW = Math.max(100, parent.clientWidth);
    const cssH = Math.max(100, parent.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const newW = Math.round(cssW * dpr);
    const newH = Math.round(cssH * dpr);
    if (this.canvas.width !== newW || this.canvas.height !== newH) {
      this.canvas.width = newW;
      this.canvas.height = newH;
    }
  }

  draw() {
    this.resize();
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!this.appMode) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    } else {
      // 应用模式下用浅色背景，保证面部灰度对比明显
      ctx.fillStyle = '#F7F5EE';
      ctx.fillRect(0, 0, w, h);
    }

    this._render(ctx, w, h);
  }

  /** 子类覆盖 */
  _render(ctx, w, h) {
    // noop
  }

  // 可被测试代码直接调用：按 (phi,theta) 或 (bodyT,surfAngle) 给子类返回锚点
  _computeAnchors() {
    return {};
  }

  /**
   * 渲染一组四边形网格。
   * mesh 经过 deformXxx 处理后，每个顶点应带有 (tx, ty, tz)
   * 和 (nx, ny, nz)。
   */
  _drawMesh(ctx, mesh, options) {
    const { w, h, scale, originX, originY, baseColorTop, baseColorBottom, faceTopColor, faceBottomColor, lightDir } = options;
    const vertices = mesh.vertices;
    const faces = mesh.faces;
    if (!vertices || !faces || faces.length === 0) return;

    // 1) 先把顶点投影到屏幕空间，并做简单的背面剔除准备
    const projected = new Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const tx = (v.tx !== undefined ? v.tx : v.x);
      const ty = (v.ty !== undefined ? v.ty : v.y);
      const tz = (v.tz !== undefined ? v.tz : v.z);
      const sx = originX + tx * scale;
      const sy = originY + ty * scale;
      projected[i] = { sx, sy, sz: tz, nx: v.nx || 0, ny: v.ny || 0, nz: v.nz || 0, v };
    }

    // 2) 计算每个面的平均深度和法线，做背面剔除和光照
    const drawList = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const idxs = f.indices;
      const p0 = projected[idxs[0]];
      const p1 = projected[idxs[1]];
      const p2 = projected[idxs[2]];
      const p3 = projected[idxs[3]];
      const avgZ = (p0.sz + p1.sz + p2.sz + p3.sz) * 0.25;
      const avgNx = (p0.nx + p1.nx + p2.nx + p3.nx) * 0.25;
      const avgNy = (p0.ny + p1.ny + p2.ny + p3.ny) * 0.25;
      const avgNz = (p0.nz + p1.nz + p2.nz + p3.nz) * 0.25;
      const nLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz) || 1;

      // 背面剔除：摄像机朝 +Z，所以 -Z 方向的面不画
      const facing = avgNz / nLen;
      if (facing < -0.05) continue;

      // 选择颜色：使用原始坐标判断上下，不随旋转变化
      // 对于球体：y < 0 为上半（灰），y >= 0 为下半（白）
      // 对于鲸鱼：cos(angle) < 0 为上半（灰），cos(angle) >= 0 为下半（白）
      // 使用顶点原始属性来判断，而不是旋转后的坐标
      let isTop = false;
      if (f.isTop !== undefined) {
        isTop = f.isTop;
      } else {
        // 兼容旧网格：使用原始 y 坐标判断
        const avgOriginalY = (f.vertices[0].y + f.vertices[1].y + f.vertices[2].y + f.vertices[3].y) * 0.25;
        isTop = avgOriginalY < 0;
      }

      // 如果是纺锤/鲸鱼，顶点可能带 faceWeight，用它来过渡面部颜色
      let faceWeight = 0;
      for (let k = 0; k < 4; k++) {
        const vv = f.vertices[k];
        if (vv && typeof vv.faceWeight === 'number') faceWeight += vv.faceWeight;
      }
      faceWeight *= 0.25;

      let base = (isTop ? baseColorTop : baseColorBottom);
      if (faceWeight > 0.01 && faceTopColor && faceBottomColor) {
        const faceBase = isTop ? faceTopColor : faceBottomColor;
        base = lerpColor(base, faceBase, faceWeight);
      }

      const lit = applyLight(
        { x: avgNx / nLen, y: avgNy / nLen, z: avgNz / nLen },
        lightDir,
        base
      );

      drawList.push({
        points: [
          [p0.sx, p0.sy], [p1.sx, p1.sy], [p2.sx, p2.sy], [p3.sx, p3.sy]
        ],
        avgZ,
        fill: lit,
        stroke: this.debugMesh ? 'rgba(255,255,255,0.4)' : null,
      });
    }

    // 3) 深度由小到大排序（先画远的，再画近的）
    drawList.sort((a, b) => a.avgZ - b.avgZ);

    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      ctx.beginPath();
      ctx.moveTo(d.points[0][0], d.points[0][1]);
      ctx.lineTo(d.points[1][0], d.points[1][1]);
      ctx.lineTo(d.points[2][0], d.points[2][1]);
      ctx.lineTo(d.points[3][0], d.points[3][1]);
      ctx.closePath();
      ctx.fillStyle = d.fill;
      ctx.fill();
      if (d.stroke) {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    return { projected };
  }

  /**
   * 对已经算出的 "锚点参数坐标" 应用 yaw/pitch/roll 得到屏幕坐标。
   * 对球：输入 mesh + phi/theta + surfaceOffset，变形后从 mesh 查询。
   * 对鲸鱼：输入 mesh + bodyT/surfAngle。
   *
   * 为避免与球/鲸鱼模块的内部坐标约定耦合，这里直接调用各自的
   * computeFaceAnchor / computeSphereFaceAnchor 得到局部 (x,y,z,n)，
   * 再按相同的 yaw/pitch/roll 做一次旋转，最终投影到屏幕坐标。
   */
  _transformAnchor(local, rotParams, originX, originY, scale) {
    // 局部 -> 旋转后
    const radY = rotParams.angleY * Math.PI / 180;
    const radX = rotParams.angleX * Math.PI / 180;
    const radZ = rotParams.angleZ * Math.PI / 180;
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

    let x = local.x, y = local.y, z = local.z;
    let nx = local.nx, ny = local.ny, nz = local.nz;

    // Yaw (Y)
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;
    let nx1 = nx * cosY + nz * sinY;
    let nz1 = -nx * sinY + nz * cosY;
    let ny1 = ny;

    // Pitch (X)
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;
    let ny2 = ny1 * cosX - nz1 * sinX;
    let nz2 = ny1 * sinX + nz1 * cosX;
    let nx2 = nx1;

    // Roll (Z)
    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;
    let nx3 = nx2 * cosZ - ny2 * sinZ;
    let ny3 = nx2 * sinZ + ny2 * cosZ;
    let nz3 = nz2;

    return {
      worldX: x3, worldY: y3, worldZ: z3,
      screenX: originX + x3 * scale,
      screenY: originY + y3 * scale,
      nx: nx3, ny: ny3, nz: nz3,
    };
  }
}

// ---------------- 球体头像 ----------------

export class ProceduralSphereAvatar extends ProceduralMeshRenderer {
  constructor(canvasId) {
    super(canvasId);
    this.mesh = createSphereMesh({ rings: 18, segments: 28, radius: 85 });
    this.draw();
  }

  /**
   * 返回五官锚点的球坐标参数（供测试和渲染使用）。
   * 坐标约定：球坐标 (phi, theta)；
   *   phi=0 顶部, phi=pi 底部
   *   theta=0 朝 +X, theta=pi/2 朝 +Z（朝向摄像机）
   * 我们让面部朝 +Z，所以眼睛的 theta 应接近 pi/2。
   */
  /**
   * 返回五官锚点的局部坐标参数（球面头像）。
   *   faceCenter = (0, 0, radius) —— 朝 +z
   *   horizontal = (1, 0, 0) —— 屏幕水平
   *   vertical = (0, 1, 0) —— 屏幕垂直
   *
   * 视觉不变量：
   *   - 左右眼 |horizOffset| 相同 → screenX 有明确间距
   *   - 左右眼 vertOffset 相同 → screenY 等高
   *   - 嘴 vertOffset > 眼 vertOffset → 嘴在眼下
   *   - 眉 vertOffset < 眼 vertOffset → 眉在眼上
   */
  getAnchors(params) {
    const r = this.mesh.radius;
    const eyeSpacing = r * 0.32;
    const eyeHeight = -r * 0.15;    // 眼在中心偏上
    const mouthHeight = r * 0.25;    // 嘴在中心下方
    const browOffset = -r * 0.28;    // 眉在眼上方
    const browSpacing = r * 0.28;    // 眉水平间距

    return {
      leftEye:  { horizOffset: -eyeSpacing,  vertOffset: eyeHeight, surfaceOffset: 2 },
      rightEye: { horizOffset:  eyeSpacing,  vertOffset: eyeHeight, surfaceOffset: 2 },
      mouth:    { horizOffset: 0,            vertOffset: mouthHeight, surfaceOffset: 2 },
      browLeft: { horizOffset: -browSpacing, vertOffset: browOffset, surfaceOffset: 3 },
      browRight:{ horizOffset:  browSpacing, vertOffset: browOffset, surfaceOffset: 3 },
    };
  }

  _render(ctx, w, h) {
    const np = normalizeParams(this.params);
    const rot = { angleY: np.headYaw, angleX: np.headPitch, angleZ: np.headRoll };
    const deformed = deformSphere(this.mesh, rot);

    // 布局：居中 + 留出边距；scale 按画布短边计算
    const margin = 0.12;
    const minSide = Math.min(w, h);
    const scale = (minSide * (1 - margin * 2)) / (this.mesh.radius * 2.1);
    const originX = w * 0.5 + (np.headX - 0.5) * minSide * 0.30;
    const originY = h * 0.5 + (np.headY - 0.5) * minSide * 0.20;

    const lightDir = { x: -0.35, y: -0.4, z: 0.8 };
    // 球体的"上半=灰，下半=白"的简单配色：
    this._drawMesh(ctx, deformed, {
      w, h, scale, originX, originY,
      baseColorTop: '#bdb8aa',
      baseColorBottom: '#f3f0e6',
      faceTopColor: '#c8c2b4',
      faceBottomColor: '#fffaf0',
      lightDir,
    });

    // 五官
    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);

    const drawEye = (anchor, openness) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;
      // 两眼完全等大对称，不做远近眼缩放
      const rx = 10 * scale;
      const ry = 10 * scale * (0.4 + 0.6 * openness);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = facing;
      ctx.fill();
      ctx.lineWidth = 1.5 * (scale / 1.0);
      ctx.strokeStyle = '#222';
      ctx.stroke();
      if (openness > 0.1) {
        ctx.beginPath();
        const pupilRx = rx * 0.55;
        const pupilRy = rx * 0.55;
        ctx.ellipse(t.screenX, t.screenY, pupilRx, pupilRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1f1f1f';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const len = 20 * scale;
      const up = -raise * 6 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      ctx.beginPath();
      // 眉毛水平对称，不做左右倾斜
      ctx.moveTo(t.screenX - len * 0.5, t.screenY + up);
      ctx.lineTo(t.screenX + len * 0.5, t.screenY + up);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      // 正视角对称绘制，不做侧视图压缩
      const smileWiden = 1 + smile * 0.4;
      const halfW = 22 * scale * smileWiden;
      const openH = 3 * scale + 14 * scale * open;
      const cornerUp = -smile * 8 * scale;    // 嘴角上移
      const centerUp = -smile * 3 * scale;     // 中心轻微上移
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      if (open < 0.05 && smile < 0.1) {
        // 平静闭合嘴
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY);
        ctx.lineTo(t.screenX + halfW, t.screenY);
        ctx.stroke();
      } else if (open < 0.05) {
        // 闭嘴上扬（纯微笑）
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY + cornerUp);
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + centerUp + 2 * scale,
          t.screenX + halfW,
          t.screenY + cornerUp
        );
        ctx.stroke();
      } else {
        // 张嘴（可能带微笑）：上唇弧 + 下唇弧 + 口腔填充
        ctx.fillStyle = '#4a2020';
        ctx.beginPath();
        // 上唇：从左嘴角到右嘴角，向上弧
        ctx.moveTo(t.screenX - halfW, t.screenY + cornerUp);
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + centerUp - openH * 0.35,
          t.screenX + halfW,
          t.screenY + cornerUp
        );
        // 下唇：从右嘴角到左嘴角，向下弧
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + centerUp + openH * 0.55,
          t.screenX - halfW,
          t.screenY + cornerUp
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    // 正视角：左右眼完全对称等大
    drawEye(anchors.leftEye, np.eyeLeft);
    drawEye(anchors.rightEye, np.eyeRight);
    drawBrow(anchors.browLeft, np.browLeft);
    drawBrow(anchors.browRight, np.browRight);
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
  }
}

// ---------------- 纺锤鲸鱼 ----------------

export class ProceduralSpindleWhaleAvatar extends ProceduralMeshRenderer {
  constructor(canvasId) {
    super(canvasId);
    this.spindleMesh = createSpindleMesh({
        headX: 70,
        headY: 58,
        headZ: 54,
        bodyLength: 102,
        bodyEndX: 9,
        bodyEndY: 5,
        columns: 30,
        rows: 35,
        topColor: '#c3b681',
        bottomColor: '#eee1bc',
        faceTopColor: '#d1c394',
        faceBottomColor: '#f4e8c8',
      });
    // 真正正面视角，没有 3/4 视图的不对称
    this.baseYaw = 0;
    this.basePitch = 0;
    this.baseRoll = 0;
    this.draw();
  }

  /**
   * 五官锚点：基于头部椭球前表面的 (x, y) 偏移，z 固定在头部前方。
   *   - 左右眼：x = ±headX * 0.30
   *   - 嘴：在两眼下方中央
   *   - 眉：在两眼上方，略宽于眼间距
   */
  getAnchors(params) {
    const mesh = this.spindleMesh;
    const hx = mesh.headX;   // 左右半径
    const hy = mesh.headY;   // 上下半径

    // 卡通版：大圆眼、适中眼距、眼睛在脸部上部
    const eyeSpacing = hx * 0.31;    // 眼左右位置（放宽眼距，避免两眼挤在一起）
    const eyeHeight = -hy * 0.15;   // 眼上下位置（脸的上半部分）
    const mouthHeight = hy * 0.30;  // 嘴在眼下稍远的位置（GPT 建议：避免张嘴时上缘碰到眼睛）
    const mouthHalfWidth = hx * 0.22; // 嘴的半宽，约占头部宽度 44%
    const browOffset = -hy * 0.48;  // 眉在眼上方（相对中心）
    const browSpacing = hx * 0.31;  // 眉水平间距与眼一致

    return {
      leftEye:  { bodyT: 0, horizOffset: -eyeSpacing,  vertOffset: eyeHeight, surfaceOffset: 0.5 },
      rightEye: { bodyT: 0, horizOffset:  eyeSpacing,  vertOffset: eyeHeight, surfaceOffset: 0.5 },
      mouth:    { bodyT: 0, horizOffset: 0,            vertOffset: mouthHeight, surfaceOffset: 0.5, mouthWidth: mouthHalfWidth },
      browLeft: { bodyT: 0, horizOffset: -browSpacing, vertOffset: browOffset, surfaceOffset: 0.8 },
      browRight:{ bodyT: 0, horizOffset:  browSpacing, vertOffset: browOffset, surfaceOffset: 0.8 },
    };
  }

  _render(ctx, w, h) {
    const np = normalizeParams(this.params);
    // 用户头摆 + 默认正面视角（无旋转）
    const rot = {
      angleY: np.headYaw + this.baseYaw,
      angleX: np.headPitch + this.basePitch,
      angleZ: np.headRoll + this.baseRoll,
    };

    const minSide = Math.min(w, h);
    // scale：以头部左右直径为基准，占画面 ~55%
    const headDiameter = this.spindleMesh.headX * 2;
    const margin = 0.18;
    const scale = (minSide * (1 - margin * 2)) / headDiameter;

    // 头部中心稍微向上偏移，让下方有空间展示身体
    const originX = w * 0.5 + (np.headX - 0.5) * minSide * 0.22;
    const originY = h * 0.48 + (np.headY - 0.5) * minSide * 0.18;

    // 单 mesh 渲染：头部 + 身体 + 尾巴都已经在 spindleMesh 中
    const lightDir = { x: -0.3, y: -0.5, z: 0.8 };
    const deformedBody = deformSpindle(this.spindleMesh, rot);
    this._drawMesh(ctx, deformedBody, {
      w, h, scale, originX, originY,
      baseColorTop: this.spindleMesh.topColor,
      baseColorBottom: this.spindleMesh.bottomColor,
      faceTopColor: this.spindleMesh.faceTopColor,
      faceBottomColor: this.spindleMesh.faceBottomColor,
      lightDir,
    });

    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);
    const mesh = this.spindleMesh;

    // 卡通版：大圆眼，半径约占头部宽度 25%
    const eyeRadius = Math.max(8, mesh.headX * 0.25);

    const drawEye = (anchor, openness) => {
      const local = computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;
      // 正面视角：两眼完全等大，没有远侧/近侧的不对称
      const rx = eyeRadius * scale;
      const ry = eyeRadius * scale * (0.75 + 0.25 * openness);  // 圆眼睛
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = facing;
      ctx.fill();
      ctx.lineWidth = Math.max(1, 2.0 * scale);
      ctx.strokeStyle = '#222';
      ctx.stroke();
      if (openness > 0.1) {
        ctx.beginPath();
        const pupilRx = rx * 0.53;
        const pupilRy = ry * 0.53;
        ctx.ellipse(t.screenX, t.screenY + 1.5, pupilRx, pupilRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1f1f1f';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise) => {
      const local = computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const len = mesh.headX * 0.26 * scale;
      const up = -raise * 6 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);
      ctx.beginPath();
      ctx.moveTo(t.screenX - len * 0.5, t.screenY + up);
      ctx.lineTo(t.screenX + len * 0.5, t.screenY + up);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      // 微笑：嘴角上扬 + 嘴宽增加；张开：高度增加
      const smileWiden = 1 + smile * 0.40;
      const halfW = (anchor.mouthWidth || mesh.headX * 0.28) * scale * smileWiden;
      const openH = 3 * scale + 12 * scale * open;
      const cornerUp = -smile * 7 * scale;
      const centerUp = -smile * 3 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);
      if (open < 0.05 && smile < 0.1) {
        // 平静闭合嘴
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY);
        ctx.lineTo(t.screenX + halfW, t.screenY);
        ctx.stroke();
      } else if (open < 0.05) {
        // 闭嘴上扬（纯微笑）
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY + cornerUp);
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + centerUp + 2 * scale,
          t.screenX + halfW,
          t.screenY + cornerUp
        );
        ctx.stroke();
      } else {
        // 张嘴（可能带微笑）：上唇弧 + 下唇弧 + 口腔填充
        ctx.fillStyle = '#4a2020';
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY + cornerUp);
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + centerUp - openH * 0.35,
          t.screenX + halfW,
          t.screenY + cornerUp
        );
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + centerUp + openH * 0.55,
          t.screenX - halfW,
          t.screenY + cornerUp
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    // 正面视角：两眼完全对称，没有远近侧的差异
    drawEye(anchors.leftEye, np.eyeLeft);
    drawEye(anchors.rightEye, np.eyeRight);
    drawBrow(anchors.browLeft, np.browLeft);
    drawBrow(anchors.browRight, np.browRight);
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
  }
}

// ---------------- 导出（用于测试与外部构造） ----------------

export function createSphereAvatar(canvasId) {
  return new ProceduralSphereAvatar(canvasId);
}

export function createSpindleWhaleAvatar(canvasId) {
  return new ProceduralSpindleWhaleAvatar(canvasId);
}

// 同时挂到 window 上，方便 Android 经典脚本使用时在全局引用。
// Web ES Module 环境下 window 可能存在但此文件不会自动执行它；
// 由派生的 classic 脚本再自行挂载。
if (typeof window !== 'undefined') {
  window.CheapLiveProceduralMeshRenderer = ProceduralMeshRenderer;
  window.ProceduralSphereAvatar = ProceduralSphereAvatar;
  window.ProceduralSpindleWhaleAvatar = ProceduralSpindleWhaleAvatar;
}
