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

const BASIS_EPSILON = 1e-10;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function isFiniteVec3(v) {
  return v != null && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function normVec3(v, fallback) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (!Number.isFinite(len) || len < BASIS_EPSILON) {
    return { x: fallback.x, y: fallback.y, z: fallback.z };
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dotVec3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function crossVec3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function buildFaceBasis(local) {
  const rawN = { x: local.nx, y: local.ny, z: local.nz };
  const n = normVec3(isFiniteVec3(rawN) ? rawN : { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 });

  let rawT = { x: local.tx, y: local.ty, z: local.tz };

  if (!isFiniteVec3(rawT)) {
    // 从 n 构造一个正交的 rawT
    rawT = { x: 1 - n.x * n.x, y: -n.x * n.y, z: -n.x * n.z };
    if (Math.sqrt(rawT.x * rawT.x + rawT.y * rawT.y + rawT.z * rawT.z) < BASIS_EPSILON) {
      rawT = { x: -n.y * n.x, y: 1 - n.y * n.y, z: -n.y * n.z };
    }
  }

  // Gram-Schmidt 正交化
  const tDotN = dotVec3(rawT, n);
  let t = {
    x: rawT.x - tDotN * n.x,
    y: rawT.y - tDotN * n.y,
    z: rawT.z - tDotN * n.z,
  };

  // 检查 t 是否退化（与 n 平行导致 Gram-Schmidt 给出零向量）
  const tLen = Math.sqrt(t.x * t.x + t.y * t.y + t.z * t.z);
  if (tLen < BASIS_EPSILON) {
    // 选择与 n 最不平行的参考轴，投影到切平面
    const refX = Math.abs(n.x) < 0.9 ? 1 : 0;
    const refY = Math.abs(n.y) < 0.9 ? 1 : 0;
    const refZ = Math.abs(n.z) < 0.9 ? 1 : 0;
    const ref = { x: refX, y: refY, z: refZ };
    // 投影到 n 的法平面
    const refDotN = dotVec3(ref, n);
    t = {
      x: ref.x - refDotN * n.x,
      y: ref.y - refDotN * n.y,
      z: ref.z - refDotN * n.z,
    };
  }

  t = normVec3(t, { x: 1, y: 0, z: 0 });

  // b = n × t，保证正交
  const bRaw = crossVec3(n, t);
  const b = normVec3(bRaw, { x: 0, y: 1, z: 0 });

  return { n, t, b };
}

function computeProjectedEllipse(rx, ry, bx, by, halfWidth, halfHeight) {
  const ax = rx * halfWidth;
  const ay = ry * halfWidth;
  const bxx = bx * halfHeight;
  const byy = by * halfHeight;

  const cxx = ax * ax + bxx * bxx;
  const cxy = ax * ay + bxx * byy;
  const cyy = ay * ay + byy * byy;

  const trace = cxx + cyy;
  const delta = Math.sqrt((cxx - cyy) * (cxx - cyy) + 4 * cxy * cxy);

  const lambdaMajor = Math.max(0, (trace + delta) * 0.5);
  const lambdaMinor = Math.max(0, (trace - delta) * 0.5);

  let angle;
  if (delta < 1e-10) {
    angle = Math.atan2(ry, rx);
  } else {
    angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  }

  return {
    radiusX: Math.sqrt(lambdaMajor),
    radiusY: Math.sqrt(lambdaMinor),
    angle,
  };
}

function mapFaceLocalPoint(anchor, u, v) {
  return {
    x: anchor.screenX + anchor.rightVec.x * u + anchor.downVec.x * v,
    y: anchor.screenY + anchor.rightVec.y * u + anchor.downVec.y * v,
  };
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

function applyLight(faceCenterNormal, lightDir, baseColor, ambient) {
  // 点积表示朝向光源的程度，映射到 [ambient, 1.0]
  const dot =
    (faceCenterNormal.x || 0) * lightDir.x +
    (faceCenterNormal.y || 0) * lightDir.y +
    (faceCenterNormal.z || 0) * lightDir.z;
  const a = Number.isFinite(ambient) && ambient >= 0 && ambient <= 1 ? ambient : 0.55;
  const factor = a + (1 - a) * clamp(dot, -0.2, 1.0);
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
    const { w, h, scale, originX, originY, baseColorTop, baseColorBottom, faceTopColor, faceBottomColor, lightDir, ambient } = options;
    const vertices = mesh.vertices;
    const faces = mesh.faces;
    if (!vertices || !faces || faces.length === 0) return;

    const cullThreshold = options.cullThreshold !== undefined ? options.cullThreshold : -0.05;

    // 1) 先把顶点投影到屏幕空间
    const projected = new Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const tx = (v.tx !== undefined ? v.tx : v.x);
      const ty = (v.ty !== undefined ? v.ty : v.y);
      const tz = (v.tz !== undefined ? v.tz : v.z);
      projected[i] = { sx: originX + tx * scale, sy: originY + ty * scale, sz: tz, nx: v.nx ?? 0, ny: v.ny ?? 0, nz: v.nz ?? 0, v };
    }

    // 2) 计算每个面的平均深度和法线（支持任意多边形，不再硬编码4顶点）
    const drawList = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const idxs = f.indices;
      const nPoints = idxs.length;

      let avgSz = 0;
      let avgNx = 0, avgNy = 0, avgNz = 0;
      for (let k = 0; k < nPoints; k++) {
        const p = projected[idxs[k]];
        avgSz += p.sz;
        avgNx += p.nx;
        avgNy += p.ny;
        avgNz += p.nz;
      }
      avgSz /= nPoints;
      avgNx /= nPoints;
      avgNy /= nPoints;
      avgNz /= nPoints;
      const nLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz) || 1;

      // 背面剔除：摄像机朝 +Z，所以 -Z 方向的面不画
      // 对于薄鳍/双面结构（如尾鳍）: doubleSided = true 时两侧都画
      if (!f.doubleSided) {
        const facing = avgNz / nLen;
        if (facing < cullThreshold) continue;
      }

      // 选择颜色：使用原始坐标判断上下，不随旋转变化
      // 对于球体：y < 0 为上半（灰），y >= 0 为下半（白）
      // 对于鲸鱼：sin(angle) < 0 为上半（灰），sin(angle) >= 0 为下半（白）
      // 使用顶点原始属性来判断，而不是旋转后的坐标
      let isTop = false;
      if (f.isTop !== undefined) {
        isTop = f.isTop;
      } else {
        // 兼容旧网格：使用原始 y 坐标判断（按实际顶点数平均）
        let origYSum = 0;
        for (let k = 0; k < nPoints; k++) origYSum += f.vertices[k].y;
        isTop = (origYSum / nPoints) < 0;
      }

      // 如果是纺锤/鲸鱼，顶点可能带 faceWeight，用它来过渡面部颜色
      let faceWeight = 0;
      for (let k = 0; k < nPoints; k++) {
        const vv = f.vertices[k];
        if (vv && typeof vv.faceWeight === 'number') faceWeight += vv.faceWeight;
      }
      faceWeight /= nPoints;

      let base = (isTop ? baseColorTop : baseColorBottom);
      if (faceWeight > 0.01 && faceTopColor && faceBottomColor) {
        const faceBase = isTop ? faceTopColor : faceBottomColor;
        base = lerpColor(base, faceBase, faceWeight);
      }

      const lit = applyLight(
        { x: avgNx / nLen, y: avgNy / nLen, z: avgNz / nLen },
        lightDir,
        base,
        ambient,
      );

      // 构建多边形点数组（支持任意顶点数）
      const polyPoints = new Array(nPoints);
      for (let k = 0; k < nPoints; k++) {
        const p = projected[idxs[k]];
        polyPoints[k] = [p.sx, p.sy];
      }

      drawList.push({
        points: polyPoints,
        avgZ: avgSz,
        fill: lit,
        stroke: this.debugMesh ? 'rgba(255,255,255,0.4)' : null,
      });
    }

    // 3) 深度由小到大排序（先画远的，再画近的）
    drawList.sort((a, b) => a.avgZ - b.avgZ);

    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      ctx.beginPath();
      const points = d.points;
      ctx.moveTo(points[0][0], points[0][1]);
      for (let k = 1; k < points.length; k++) {
        ctx.lineTo(points[k][0], points[k][1]);
      }
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
   * 把局部 (x, y, z, n, t, b) 旋转到世界坐标，并投影到屏幕。
   * 除了 anchor 的 (screenX, screenY, nx, ny, nz)，还额外返回：
   *   rightVec: screen 空间"右"方向（tangent 的投影）
   *   downVec : screen 空间"下"方向（binormal 的投影）
   *   depthFacing: nz（越大越朝向摄像机；用于在侧视时隐藏五官）
   */
  _transformVec(x, y, z, rotParams) {
    const radY = rotParams.angleY * Math.PI / 180;
    const radX = rotParams.angleX * Math.PI / 180;
    const radZ = rotParams.angleZ * Math.PI / 180;
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

    // 旋转顺序: Z → X → Y (先 roll, 再 pitch, 最后 yaw)
    // 等价于: v' = Ry * Rx * Rz * v
    // 这种顺序下 pitch 绕的是"yaw 后的局部 x 轴"，避免 yaw+pitch 组合时眼睛横过来
    // Z (roll):
    let x1 = x * cosZ - y * sinZ;
    let y1 = x * sinZ + y * cosZ;
    let z1 = z;
    // X (pitch):
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;
    // Y (yaw):
    let x3 = x2 * cosY + z2 * sinY;
    let z3 = -x2 * sinY + z2 * cosY;
    let y3 = y2;
    return { x: x3, y: y3, z: z3 };
  }

  _transformAnchor(local, rotParams, originX, originY, scale) {
    const p = this._transformVec(local.x, local.y, local.z, rotParams);

    const basis = buildFaceBasis(local);

    const n = this._transformVec(basis.n.x, basis.n.y, basis.n.z, rotParams);
    const t = this._transformVec(basis.t.x, basis.t.y, basis.t.z, rotParams);
    const b = this._transformVec(basis.b.x, basis.b.y, basis.b.z, rotParams);

    return {
      worldX: p.x, worldY: p.y, worldZ: p.z,
      screenX: originX + p.x * scale,
      screenY: originY + p.y * scale,
      nx: n.x, ny: n.y, nz: n.z,
      rightVec: { x: t.x, y: t.y, z: t.z },
      downVec:  { x: b.x, y: b.y, z: b.z },
      rightLen: Math.sqrt(t.x * t.x + t.y * t.y),
      downLen:  Math.sqrt(b.x * b.x + b.y * b.y),
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
    // 球体是封闭凸形，使用严格的背面剔除阈值 -0.05，ambient 0.55 让暗部不糊死
    this._drawMesh(ctx, deformed, {
      w, h, scale, originX, originY,
      baseColorTop: '#bdb8aa',
      baseColorBottom: '#f3f0e6',
      faceTopColor: '#c8c2b4',
      faceBottomColor: '#fffaf0',
      lightDir,
      cullThreshold: -0.05,
      ambient: 0.55,
    });

    // 五官
    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);

    // 统一画"一只眼睛"：使用完整投影椭圆计算主轴角度
    const drawEye = (anchor, openness) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;

      // 眼睛椭圆的半宽/高：直接用 eyeSize，不预乘 rl/dl
      // 因为 computeProjectedEllipse 会将 halfWidth/halfH 与 rightVec/downVec 分量相乘
      // rightVec 已包含投影后的完整长度信息
      const eyeSize = 10 * scale;
      const eyeHalfW = eyeSize;
      const eyeHalfH = eyeSize;

      // 使用完整投影椭圆（考虑 rightVec + downVec 可能不正交）
      const proj = computeProjectedEllipse(t.rightVec.x, t.rightVec.y, t.downVec.x, t.downVec.y, eyeHalfW, eyeHalfH);
      const rx = Math.max(0.1, proj.radiusX);
      const ry = Math.max(0.1, proj.radiusY);
      const ang = proj.angle;

      ctx.save();
      ctx.globalAlpha = facing;

      // 1) 眼白
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx, ry, ang, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.8 * scale);
      ctx.strokeStyle = '#222';
      ctx.stroke();

      // 2) 瞳孔（永远画）
      const pupilRx = rx * 0.55;
      const pupilRy = ry * 0.55;
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, pupilRx, pupilRy, ang, 0, Math.PI * 2);
      ctx.fillStyle = '#1f1f1f';
      ctx.fill();

      // 3) 眨眼遮罩（在椭圆内，用同色块盖）
      const cover = 1 - openness;
      if (cover > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(t.screenX, t.screenY, rx + 0.5, ry + 0.5, ang, 0, Math.PI * 2);
        ctx.clip();
        ctx.translate(t.screenX, t.screenY);
        ctx.rotate(ang);
        const coverH = 2 * ry * cover;
        ctx.fillStyle = this.mesh.faceTopColor || '#d9d2be';
        ctx.fillRect(-rx - 2, -ry - 2, rx * 2 + 4, coverH + 2);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      // 眉毛长度和抬升量：直接用 scale，不预乘 rl/dl
      // 因为 mapFaceLocalPoint 会与 rightVec/downVec 相乘，已包含投影长度
      const len = 22 * scale;
      const upAmt = raise * 8 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      ctx.beginPath();
      // 使用 mapFaceLocalPoint：眉毛沿 rightVec 展开，顶部沿 -downVec 方向拱起
      const left = mapFaceLocalPoint(t, -len * 0.5, -upAmt);
      const peak = mapFaceLocalPoint(t, 0, -upAmt * 1.2);
      const right = mapFaceLocalPoint(t, len * 0.5, -upAmt);
      ctx.moveTo(left.x, left.y);
      ctx.quadraticCurveTo(peak.x, peak.y, right.x, right.y);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeSphereFaceAnchorXYZ(this.mesh, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      // 嘴巴尺寸参数：直接用 scale，不预乘 rl/dl
      // mapFaceLocalPoint 会与 rightVec/downVec 相乘，已包含投影长度
      const smileWiden = 1 + smile * 0.4;
      const halfW = 22 * scale * smileWiden;
      const openH = (3 * scale + 14 * scale * open);
      const cornerUp = -smile * 8 * scale;
      const centerUp = -smile * 3 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);

      if (open < 0.05 && smile < 0.1) {
        const left = mapFaceLocalPoint(t, -halfW, cornerUp);
        const right = mapFaceLocalPoint(t, halfW, cornerUp);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      } else if (open < 0.05) {
        const left = mapFaceLocalPoint(t, -halfW, cornerUp);
        const mid = mapFaceLocalPoint(t, 0, centerUp + 2 * scale);
        const right = mapFaceLocalPoint(t, halfW, cornerUp);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.quadraticCurveTo(mid.x, mid.y, right.x, right.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4a2020';
        const left = mapFaceLocalPoint(t, -halfW, cornerUp);
        const topMid = mapFaceLocalPoint(t, 0, centerUp - openH * 0.35);
        const right = mapFaceLocalPoint(t, halfW, cornerUp);
        const botMid = mapFaceLocalPoint(t, 0, centerUp + openH * 0.55);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.quadraticCurveTo(topMid.x, topMid.y, right.x, right.y);
        ctx.quadraticCurveTo(botMid.x, botMid.y, left.x, left.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    drawEye(anchors.leftEye, np.eyeLeft);
    drawEye(anchors.rightEye, np.eyeRight);
    drawBrow(anchors.browLeft, np.browLeft);
    drawBrow(anchors.browRight, np.browRight);
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
  }
}

// 辅助：在当前 transform 内，在局部坐标画一个"从 -halfW 到 halfW、从 -halfH 到 (2*coverRatio*halfH- halfH 的矩形（填充）
function skinFill(ctx, coverH, halfW) {
  // 颜色先使用画布背景色的近似（浅褐）
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(-halfW - 2, -halfW - 2, halfW*2+4, coverH + 4);
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

    // 萨卡班甲鱼是扁平椭球，旋转时侧面仍应可见，放宽到 -0.15
    // 尾鳍是双面的，不受这个阈值影响
    const lightDir = { x: -0.3, y: -0.5, z: 0.8 };
    const deformedBody = deformSpindle(this.spindleMesh, rot);
    this._drawMesh(ctx, deformedBody, {
      w, h, scale, originX, originY,
      baseColorTop: this.spindleMesh.topColor,
      baseColorBottom: this.spindleMesh.bottomColor,
      faceTopColor: this.spindleMesh.faceTopColor,
      faceBottomColor: this.spindleMesh.faceBottomColor,
      lightDir,
      cullThreshold: -0.15,
      ambient: 0.58,
    });

    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);
    const mesh = this.spindleMesh;

    const eyeBase = Math.max(8, mesh.headX * 0.25);

    const drawEye = (anchor, openness) => {
      const local = computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;

      // 眼睛椭圆的半宽/高：直接用 base size，不预乘 rl/dl
      // 因为 computeProjectedEllipse 会将 halfWidth/halfH 与 rightVec/downVec 分量相乘
      // rightVec 已包含投影后的完整长度信息
      const eyeHalfW = eyeBase * scale;
      const eyeHalfH = eyeBase * scale;

      // 使用完整投影椭圆（考虑 rightVec + downVec 可能不正交）
      const proj = computeProjectedEllipse(t.rightVec.x, t.rightVec.y, t.downVec.x, t.downVec.y, eyeHalfW, eyeHalfH);
      const rx = Math.max(0.1, proj.radiusX);
      const ry = Math.max(0.1, proj.radiusY);
      const ang = proj.angle;

      ctx.save();
      ctx.globalAlpha = facing;

      // 1) 眼白
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx, ry, ang, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = Math.max(1, 2.0 * scale);
      ctx.strokeStyle = '#222';
      ctx.stroke();

      // 2) 瞳孔
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx * 0.55, ry * 0.55, ang, 0, Math.PI * 2);
      ctx.fillStyle = '#1f1f1f';
      ctx.fill();

      // 3) 眨眼遮罩
      const cover = 1 - openness;
      if (cover > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(t.screenX, t.screenY, rx + 0.5, ry + 0.5, ang, 0, Math.PI * 2);
        ctx.clip();
        ctx.translate(t.screenX, t.screenY);
        ctx.rotate(ang);
        const coverH = 2 * ry * cover;
        ctx.fillStyle = mesh.faceTopColor || '#bdb8aa';
        ctx.fillRect(-rx - 2, -ry - 2, rx * 2 + 4, coverH + 2);
        ctx.restore();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise) => {
      const local = computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      // 眉毛长度和抬升量：直接用 scale，不预乘 rl/dl
      // 因为 mapFaceLocalPoint 会与 rightVec/downVec 相乘，已包含投影长度
      const len = mesh.headX * 0.26 * scale;
      const upAmt = raise * 8 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);
      ctx.beginPath();
      const left = mapFaceLocalPoint(t, -len * 0.5, -upAmt);
      const peak = mapFaceLocalPoint(t, 0, -upAmt * 1.2);
      const right = mapFaceLocalPoint(t, len * 0.5, -upAmt);
      ctx.moveTo(left.x, left.y);
      ctx.quadraticCurveTo(peak.x, peak.y, right.x, right.y);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeFaceAnchorXYZ(mesh, anchor.bodyT, anchor.horizOffset, anchor.vertOffset, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      // 嘴巴尺寸参数：直接用 scale，不预乘 rl/dl
      // mapFaceLocalPoint 会与 rightVec/downVec 相乘，已包含投影长度
      const smileWiden = 1 + smile * 0.40;
      const halfW = (anchor.mouthWidth || mesh.headX * 0.28) * scale * smileWiden;
      const openH = (3 * scale + 12 * scale * open);
      const cornerUp = -smile * 7 * scale;
      const centerUp = -smile * 3 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);

      if (open < 0.05 && smile < 0.1) {
        const left = mapFaceLocalPoint(t, -halfW, cornerUp);
        const right = mapFaceLocalPoint(t, halfW, cornerUp);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      } else if (open < 0.05) {
        const left = mapFaceLocalPoint(t, -halfW, cornerUp);
        const mid = mapFaceLocalPoint(t, 0, centerUp + 2 * scale);
        const right = mapFaceLocalPoint(t, halfW, cornerUp);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.quadraticCurveTo(mid.x, mid.y, right.x, right.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4a2020';
        const left = mapFaceLocalPoint(t, -halfW, cornerUp);
        const topMid = mapFaceLocalPoint(t, 0, centerUp - openH * 0.35);
        const right = mapFaceLocalPoint(t, halfW, cornerUp);
        const botMid = mapFaceLocalPoint(t, 0, centerUp + openH * 0.55);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.quadraticCurveTo(topMid.x, topMid.y, right.x, right.y);
        ctx.quadraticCurveTo(botMid.x, botMid.y, left.x, left.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    const hx = mesh.headX, hy = mesh.headY;
    const nostrilHoriz = hx * 0.06;
    const nostrilVert = -hy * 0.06;
    const nostrilSize = Math.max(1.8, hx * 0.022);
    const drawNostril = (hSign) => {
      const local = computeFaceAnchorXYZ(mesh, 0, nostrilHoriz * hSign, nostrilVert, 0.2);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      ctx.save();
      ctx.globalAlpha = 0.8 * facing;
      ctx.beginPath();
      // 鼻孔椭圆的半宽/高：直接用 nostrilSize * scale，不预乘 rl/dl
      // computeProjectedEllipse 会与 rightVec/downVec 分量相乘，已包含投影长度
      const halfW = nostrilSize * scale;
      const halfH = nostrilSize * scale;
      const proj = computeProjectedEllipse(t.rightVec.x, t.rightVec.y, t.downVec.x, t.downVec.y, halfW, halfH);
      ctx.ellipse(t.screenX, t.screenY,
        Math.max(0.1, proj.radiusX), Math.max(0.1, proj.radiusY),
        proj.angle, 0, Math.PI * 2);
      ctx.fillStyle = '#8a7a4a';
      ctx.fill();
      ctx.restore();
    };

    drawEye(anchors.leftEye, np.eyeLeft);
    drawEye(anchors.rightEye, np.eyeRight);
    drawBrow(anchors.browLeft, np.browLeft);
    drawBrow(anchors.browRight, np.browRight);
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
    drawNostril(-1);
    drawNostril(+1);
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
