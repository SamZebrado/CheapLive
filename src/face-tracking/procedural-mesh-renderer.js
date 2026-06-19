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
  createWhaleTailMesh,
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

    const drawEye = (anchor, openness, isNear) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;
      // 远侧眼缩小到 76% 并向中线收 20%
      const farScale = isNear ? 1.0 : 0.76;
      const farYOffset = isNear ? 0 : -anchor.vertOffset * 0.20;
      const yawCompress = clamp(facing, 0.3, 1);
      const rx = 10 * scale * yawCompress * farScale;
      const ry = 10 * scale * (0.4 + 0.6 * openness) * farScale;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY + farYOffset, rx, ry, 0, 0, Math.PI * 2);
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
        ctx.ellipse(t.screenX, t.screenY + farYOffset, pupilRx, pupilRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1f1f1f';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise, isLeft) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const len = 20 * scale * yawCompress;
      const up = -raise * 6 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      ctx.beginPath();
      const tilt = isLeft ? -0.1 : 0.1;
      ctx.moveTo(t.screenX - len * 0.5, t.screenY + up);
      ctx.lineTo(t.screenX + len * 0.5, t.screenY + up + tilt * len);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      // 微笑：嘴角上扬 + 嘴宽增加；张开：高度增加
      const smileWiden = 1 + smile * 0.4;     // 最大加宽 40%
      const halfW = 22 * scale * yawCompress * smileWiden;
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

    // 左眼 & 右眼：镜像时对调"左右"，远侧眼缩小到 76% 并向中线收
    if (this.mirror) {
      drawEye(anchors.rightEye, np.eyeLeft, true);   // 近侧（屏幕左侧）：rightEye 锚点，左眼参数
      drawEye(anchors.leftEye, np.eyeRight, false);   // 远侧（屏幕右侧）：leftEye 锚点，右眼参数（缩小到 76%）
      drawBrow(anchors.browRight, np.browLeft, true);
      drawBrow(anchors.browLeft, np.browRight, false);
    } else {
      drawEye(anchors.leftEye, np.eyeLeft, true);    // 近侧（屏幕左侧）：leftEye 锚点，左眼参数
      drawEye(anchors.rightEye, np.eyeRight, false); // 远侧（屏幕右侧）：rightEye 锚点，右眼参数
      drawBrow(anchors.browLeft, np.browLeft, true);
      drawBrow(anchors.browRight, np.browRight, false);
    }
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
  }
}

// ---------------- 纺锤鲸鱼 ----------------

export class ProceduralSpindleWhaleAvatar extends ProceduralMeshRenderer {
  constructor(canvasId) {
    super(canvasId);
    this.spindleMesh = createSpindleMesh({
      headR: 95,
      bodyLength: 120,
      bodyWidth: 70,
      bodyDepth: 55,
      columns: 26,
      rows: 18,
      topColor: '#bdb8aa',
      bottomColor: '#f2f0e6',
      faceTopColor: '#c8c2b4',
      faceBottomColor: '#fffaf0',
    });
    this.tailMesh = createWhaleTailMesh({
      tailLength: 60,
      tailWidth: 70,
      flukeSegments: 6,
      color: '#bdb8aa',
    });
    this.draw();
  }

  /**
   * 参数坐标：
   *   bodyT 沿脊柱：0 鼻端，1 尾端
   *   surfAngle 环绕角度：0 指向 Y 正方向（身体侧面偏前），
   *     angle = PI/2 指向 +Z（朝摄像机），
   *     angle = PI   指向 Y 负方向（身体另一侧）
   *
   * 面部区域在 bodyT ≈ 0.1~0.2，surfAngle 接近 PI/2（朝摄像机）。
   * 约定：摄像机方向 +Z；angle = PI/2 时 z = depth * sin(PI/2) = depth > 0。
   */
  /**
   * 面部局部坐标系参数（萨卡班甲鱼）。
   *   faceCenter = (spineX(faceT), 0, bodyDepth(faceT)) —— 朝 +z
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
    const faceT = 0.08;

    // 五官位置基于 bodyWidth（Y方向，屏幕上下），确保与身体宽度成比例
    const mesh = this.spindleMesh;
    const w = mesh.bodyWidth;
    const eyeSpacing = w * 0.33;   // 两眼水平间距（再收一点，保证落在头盾轮廓内）
    const eyeHeight = -w * 0.10;   // 眼在中心略上（负 = 向上）
    const mouthHeight = w * 0.26;  // 嘴在中心下方（正 = 向下）
    const mouthWidth = w * 0.16;   // 嘴宽：头宽的 16%（更小更像古鱼）
    const browOffset = -w * 0.18;  // 眉在眼上方（更靠近眼睛）
    const browSpacing = w * 0.28;  // 眉水平间距

    return {
      leftEye:  { bodyT: faceT, horizOffset: -eyeSpacing, vertOffset: eyeHeight, surfaceOffset: 1.5 },
      rightEye: { bodyT: faceT, horizOffset:  eyeSpacing, vertOffset: eyeHeight, surfaceOffset: 1.5 },
      mouth:    { bodyT: faceT, horizOffset: 0,           vertOffset: mouthHeight, surfaceOffset: 1.5, mouthWidth: mouthWidth },
      browLeft: { bodyT: faceT, horizOffset: -browSpacing, vertOffset: browOffset, surfaceOffset: 2 },
      browRight:{ bodyT: faceT, horizOffset:  browSpacing, vertOffset: browOffset, surfaceOffset: 2 },
    };
  }

  _render(ctx, w, h) {
    const np = normalizeParams(this.params);
    const rot = { angleY: np.headYaw, angleX: np.headPitch, angleZ: np.headRoll };

    const minSide = Math.min(w, h);
    // scale：整体身体长度约 bodyLength + tailLength（主身体），按此决定像素缩放
    const totalLen = this.spindleMesh.bodyLength + this.tailMesh.tailLength + this.spindleMesh.headR * 0.2;
    const margin = 0.10;
    const scale = (minSide * (1 - margin * 2)) / totalLen * 1.1;

    // 让鲸鱼整体在画布中居中，鼻端偏左一点
    const originX = w * 0.5 - (this.spindleMesh.headR * 0.2) * scale + (np.headX - 0.5) * minSide * 0.25;
    const originY = h * 0.5 + (np.headY - 0.5) * minSide * 0.18;

    // 先画尾巴（更远离摄像机的一端），再画身体，最后画头部五官
    const lightDir = { x: -0.3, y: -0.5, z: 0.8 };

    // 尾巴整体沿 +X，先整体位移到脊柱末端附近再旋转
    const tailOffsetX = this.spindleMesh.headR * 0.2 + this.spindleMesh.bodyLength;
    const tailRot = { angleY: rot.angleY + 8 * Math.sin(Date.now() * 0.002), angleX: rot.angleX, angleZ: rot.angleZ };
    this._drawTranslatedTail(ctx, originX, originY, scale, tailOffsetX, tailRot, lightDir);

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

  _drawTranslatedTail(ctx, originX, originY, scale, offsetX, rot, lightDir) {
    // 将尾巴 mesh 的每个顶点沿 +X 平移 offsetX，再按 rot 旋转。
    // 直接克隆顶点数组会很浪费；这里通过在 deform 后再修改 tx/ty/tz 不现实。
    // 简化：临时构造一个"平移后"mesh 委托 deform。
    const translatedVerts = this.tailMesh.vertices.map((v) => ({
      ...v,
      x: v.x + offsetX,
    }));
    const translated = { ...this.tailMesh, vertices: translatedVerts };
    const deformed = deformSpindle(translated, rot);
    this._drawMesh(ctx, deformed, {
      w: 0, h: 0, scale, originX, originY,
      baseColorTop: this.tailMesh.color,
      baseColorBottom: '#d6d1c3',
      faceTopColor: null,
      faceBottomColor: null,
      lightDir,
    });
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);

    const drawEye = (anchor, openness, isNear) => {
      const local = computeFaceAnchorXYZ(this.spindleMesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;
      // 远侧眼（isNear=false）缩小到 76% 并向中线收 20%
      const farScale = isNear ? 1.0 : 0.76;
      const farYOffset = isNear ? 0 : -anchor.vertOffset * 0.20;
      const yawCompress = clamp(facing, 0.3, 1);
      const rx = 10 * scale * yawCompress * farScale;
      const ry = 10 * scale * (0.4 + 0.6 * openness) * farScale;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY + farYOffset, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = facing;
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.8 * scale);
      ctx.strokeStyle = '#222';
      ctx.stroke();
      if (openness > 0.1) {
        ctx.beginPath();
        const pupilRx = rx * 0.55;
        const pupilRy = rx * 0.55;  // 固定尺寸，不随 openness 缩放
        ctx.ellipse(t.screenX, t.screenY + farYOffset, pupilRx, pupilRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1f1f1f';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise, isLeft) => {
      const local = computeFaceAnchorXYZ(this.spindleMesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const len = 18 * scale * yawCompress;
      const up = -raise * 6 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      const tilt = isLeft ? -0.1 : 0.1;
      ctx.moveTo(t.screenX - len * 0.5, t.screenY + up);
      ctx.lineTo(t.screenX + len * 0.5, t.screenY + up + tilt * len);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeFaceAnchorXYZ(this.spindleMesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      // 微笑：嘴角上扬 + 嘴宽增加；张开：高度增加
      const smileWiden = 1 + smile * 0.35;
      // 嘴宽基于 bodyWidth 的 18%，比原来更小更像古鱼
      const halfW = (anchor.mouthWidth || 20 * scale) * yawCompress * smileWiden;
      const openH = 3 * scale + 12 * scale * open;
      const cornerUp = -smile * 7 * scale;
      const centerUp = -smile * 3 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2 * scale);
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

    if (this.mirror) {
      drawEye(anchors.rightEye, np.eyeLeft, true);
      drawEye(anchors.leftEye, np.eyeRight, false);
      drawBrow(anchors.browRight, np.browLeft, true);
      drawBrow(anchors.browLeft, np.browRight, false);
    } else {
      drawEye(anchors.leftEye, np.eyeLeft, true);
      drawEye(anchors.rightEye, np.eyeRight, false);
      drawBrow(anchors.browLeft, np.browLeft, true);
      drawBrow(anchors.browRight, np.browRight, false);
    }
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
