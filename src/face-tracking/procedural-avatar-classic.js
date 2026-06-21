/* procedural-avatar-classic.js —— 由 src/face-tracking/*.js 派生。
 * 用于 Android WebView / 不支持 ES Module import 的环境。
 * 自动生成，请勿手工修改。
 */

(function () {
  "use strict";

  // ----- 公共常量（合并时统一声明）-----
  const BASIS_EPSILON = 1e-10;

  // ----- 几何模块 -----
// ========[ mesh-sphere ]========
/**
 * Mesh Sphere - 球体网格生成器
 *
 * 语义约定：
 *   - 球体位于原点。
 *   - 顶部 phi=0，底部 phi=pi。
 *   - 在 phi=pi/3 与 theta=±pi/4 的椭圆区域内存在斑点标记（面部区域）。
 *   - 摄像机朝向 +Z。
 */

function createSphereMesh(options = {}) {
  const {
    radius = 80,
    rings = 16,
    segments = 24,
    baseColor = '#d4d1c8',
    markingColor = '#8B4513',
  } = options;

  const vertices = [];
  const faces = [];

  const markCenterPhi = Math.PI / 3;
  const markCenterTheta = Math.PI / 4;
  const markRadius = 0.4;

  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const x = radius * sinPhi * cosTheta;
      const y = -radius * cosPhi;
      const z = radius * sinPhi * sinTheta;

      // 球面法线（单位向量）
      const nx = sinPhi * cosTheta;
      const ny = -cosPhi;
      const nz = sinPhi * sinTheta;

      // 斑点标记：在 phi ~ pi/3 和 theta ~ ±pi/4 内加权。
      const dphi = phi - markCenterPhi;
      const dthetaRaw = theta - markCenterTheta;
      // 环绕归一化到 [-pi, pi]
      const dtheta = Math.atan2(Math.sin(dthetaRaw), Math.cos(dthetaRaw));
      const markDist = Math.sqrt(dphi * dphi + dtheta * dtheta);
      const markIntensity = markDist < markRadius ? Math.max(0, 1 - markDist / markRadius) : 0;

      vertices.push({
        x, y, z,
        nx, ny, nz,
        u: j / segments, v: i / rings,
        phi, theta,
        spot: markIntensity,
        originalIndex: vertices.length,
        isTop: y < 0,
        isBottom: y >= 0,
      });
    }
  }

  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segments + 1) + j;
      const d = c + 1;
      const va = vertices[a];
    const vb = vertices[b];
    const vc = vertices[c];
    const vd = vertices[d];
    const avgY = (va.y + vb.y + vc.y + vd.y) * 0.25;
    faces.push({
      indices: [a, b, d, c],
      vertices: [va, vb, vd, vc],
      isTop: avgY < 0,
      isBottom: avgY >= 0,
    });
    }
  }

  return {
    vertices, faces,
    radius, rings, segments,
    baseColor, markingColor,
    type: 'sphere',
  };
}

/**
 * 球体上的面部锚点；按球坐标 (phi, theta) 给出。
 * phi=pi/2 → 赤道；theta=0 → 朝向 +X。
 * 保留原 API 以兼容现有代码。
 */
function computeSphereFaceAnchor(mesh, phi, theta, surfaceOffset = 0) {
  const r = mesh.radius;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  const x = r * sinPhi * cosTheta;
  const y = -r * cosPhi;
  const z = r * sinPhi * sinTheta;
  const nx = sinPhi * cosTheta;
  const ny = -cosPhi;
  const nz = sinPhi * sinTheta;

  if (surfaceOffset !== 0) {
    return {
      x: x + nx * surfaceOffset,
      y: y + ny * surfaceOffset,
      z: z + nz * surfaceOffset,
      nx, ny, nz,
      tangentX: cosPhi * cosTheta,
      tangentY: sinPhi,
      tangentZ: cosPhi * sinTheta,
    };
  }
  return {
    x, y, z, nx, ny, nz,
    tangentX: cosPhi * cosTheta,
    tangentY: sinPhi,
    tangentZ: cosPhi * sinTheta,
  };
}

/**
 * 球体的面部局部坐标系锚点生成。
 *
 * 定义：
 *   faceCenter = (0, 0, radius) —— 球体表面中心（朝 +z）
 *   horizontal = (1, 0, 0) —— 屏幕水平方向
 *   vertical = (0, 1, 0) —— 屏幕垂直方向
 *   normal = (0, 0, 1) —— 朝摄像机方向
 *
 * 视觉不变量：
 *   - 左右眼 |horizOffset| 相同 → screenX 有明确间距
 *   - 左右眼 vertOffset 相同 → screenY 等高
 *   - 嘴 vertOffset > 眼 vertOffset → 嘴在眼下
 *   - 眉 vertOffset < 眼 vertOffset → 眉在眼上
 *
 * @param {Object} mesh
 * @param {number} horizOffset - 水平偏移（像素，模型坐标系）
 * @param {number} vertOffset - 垂直偏移（像素，模型坐标系）；正值向下
 * @param {number} [surfaceOffset]
 */
function computeSphereFaceAnchorXYZ(mesh, horizOffset, vertOffset, surfaceOffset = 0) {
  const r = mesh.radius;
  // 求表面点：把 (horizOffset, vertOffset) 投影到球面上
  const xyLen = Math.sqrt(horizOffset * horizOffset + vertOffset * vertOffset);
  const clamped = Math.min(xyLen, r * 0.95);
  const scale = xyLen > 0.001 ? clamped / xyLen : 1;
  const x = horizOffset * scale;
  const y = vertOffset * scale;
  const zSurface = Math.sqrt(Math.max(0, r * r - x * x - y * y));
  const z = zSurface + surfaceOffset;

  // 法线 = 球面径向
  const nLen = r || 1;
  const nx = x / nLen;
  const ny = y / nLen;
  const nz = zSurface / nLen;

  // 切向量（right）：沿 X 方向近似，再 Gram-Schmidt 正交化
  const approxRX = 1.0, approxRY = 0.0;
  const approxRZ = (Math.abs(zSurface) > 0.01) ? -x / zSurface : 0;
  const dot = approxRX * nx + approxRY * ny + approxRZ * nz;
  let tx = approxRX - dot * nx;
  let ty = approxRY - dot * ny;
  let tz = approxRZ - dot * nz;
  const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  tx /= tLen; ty /= tLen; tz /= tLen;

  // binormal（下） = n × t
  let bx = ny * tz - nz * ty;
  let by = nz * tx - nx * tz;
  let bz = nx * ty - ny * tx;
  const bLen = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
  bx /= bLen; by /= bLen; bz /= bLen;

  return {
    x, y, z,
    nx, ny, nz,
    tx, ty, tz,
    bx, by, bz,
    faceWeight: 1.0,
  };
}

/**
 * 变形球：整体 yaw/pitch/roll + 呼吸缩放。
 */
function deformSphere(mesh, params = {}) {
  const angleY = params.angleY || 0;
  const angleX = params.angleX || 0;
  const angleZ = params.angleZ || 0;
  const breath = params.breath || 0;

  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
  const bs = 1 + breath * 0.02;

  const transformed = mesh.vertices.map((v) => {
    const x = v.x * bs, y = v.y * bs, z = v.z * bs;
    // 旋转顺序: Z → X → Y (先 roll, 再 pitch, 最后 yaw)
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

    // 法线也用相同的顺序
    let nx1 = v.nx * cosZ - v.ny * sinZ;
    let ny1 = v.nx * sinZ + v.ny * cosZ;
    let nz1 = v.nz;
    let ny2 = ny1 * cosX - nz1 * sinX;
    let nz2 = ny1 * sinX + nz1 * cosX;
    let nx2 = nx1;
    let nx3 = nx2 * cosY + nz2 * sinY;
    let nz3 = -nx2 * sinY + nz2 * cosY;
    let ny3 = ny2;

    return { ...v, tx: x3, ty: y3, tz: z3, nx: nx3, ny: ny3, nz: nz3 };
  });

  const transformedFaces = mesh.faces.map((f) => ({
    ...f,
    vertices: f.indices.map((idx) => transformed[idx]),
  }));

  return { ...mesh, vertices: transformed, faces: transformedFaces };
}

/**
 * 顶点光照（供渲染器使用的独立帮助函数）。
 */
function computeVertexLight(vertex, lightDir) {
  const dot = Math.max(
    0,
    (vertex.nx || 0) * lightDir.x +
      (vertex.ny || 0) * lightDir.y +
      (vertex.nz || 0) * lightDir.z
  );
  return { dot, ambient: 0.45, diffuse: dot * 0.45 };
}


// ========[ mesh-spindle-whale ]========
/**
 * Mesh Sacabambaspis (萨卡班甲鱼) — 鱼雷形：
 *   圆球形头部 + 平滑收窄身体 + 尾鳍 + 正确的 3D 曲面法线
 *
 * 形状的核心是一对 R_x(s) / R_y(s) 半径曲线（s ∈ [0,1]，沿主轴参数）
 *   s=0     → 鼻端（R=0）
 *   s≈0.22  → 头部最大半径（头部球体）
 *   s≈0.22~1 → 身体平滑 taper 收窄到尾尖（R→很小的值）
 *   z(s)    → 从 +headZ（靠近摄像机）线性退到 -bodyLength
 *   yBend(s) → 尾段轻微向上（-Y）翘起
 *
 * 关键改进（对比旧版）：
 *   1. R_x / R_y 统一用 smooth 数学曲线，使侧视轮廓圆润；
 *   2. 每个顶点的法线用参数化曲面 (θ, s) 的切向量叉乘计算：
 *        T_θ = ∂p/∂θ = (-R_x(s)·sinθ,  R_y(s)·cosθ,  0)
 *        T_s = ∂p/∂s ≈ (R_x'(s)·cosθ, R_y'(s)·sinθ, z'(s) + yBend'(s))  【数值差分】
 *        n = T_θ × T_s （归一化）
 *      这样旋转后背面剔除与真实光照都正确，不会出现"明明可见却被隐藏"
 *      的问题。
 */

// smoothstep：平滑插值（0→1）
function smoothstep01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// -------------------- 形状曲线 --------------------

// 头部半径在 s ∈ [0, SPHERE_END] 时为半球（椭球方程）
// s ∈ [SPHERE_END, 1] 时为指数衰减收尾
const SPHERE_END = 0.26;  // 头部最大半径位置（s=0 是鼻端，s=SPHERE_END 是头部最宽处）

/**
 * 沿主轴 s ∈ [0,1] 的归一化半径曲线：
 *   前半段（s ∈ [0, SPHERE_END]）：严格半球形（椭球方程）
 *     r²(s) = SPHERE_END² - (s - SPHERE_END)²
 *     r(s) = sqrt(r²) / SPHERE_END（归一化到 1）
 *   后半段（s ∈ [SPHERE_END, 1]）：余弦衰减，保证连接处导数=0，收尾平滑
 *     r(s) = exp(-tailK * (s - SPHERE_END))
 *
 * 用户要求：增大的速度要慢于减小的速度，这样才会有细长身体。
 * 用余弦衰减确保后半段平滑且持续收窄。
 */
function radiusScale(s) {
  if (s <= SPHERE_END) {
    // 前半球：椭球方程，确保头部轮廓圆润无肩
    const rel = SPHERE_END - s;  // rel ∈ [SPHERE_END, 0]
    const r2 = SPHERE_END * SPHERE_END - rel * rel;
    return Math.sqrt(Math.max(0, r2)) / SPHERE_END;
  }
  // 后半段：余弦衰减，保证 SPHERE_END→r=1, s=1→r=TAIL_RATIO
  // r(s) = TAIL_RATIO + (1-TAIL_RATIO) * cos(π/2 * (s-SPHERE_END)/(1-SPHERE_END))
  // s=SPHERE_END: cos(0)=1, r=1
  // s=1: cos(π/2)≈0, r=TAIL_RATIO
  const TAIL_RATIO = 0.035;
  const t = (s - SPHERE_END) / (1 - SPHERE_END) * (Math.PI / 2);
  return TAIL_RATIO + (1 - TAIL_RATIO) * Math.cos(t);
}

/**
 * 数值计算半径曲线的导数 dR/ds（用于法线计算）。
 * 用中心差分，端点用单边差分。
 */
function radiusScaleDeriv(s) {
  const h = 0.002;
  if (s <= h) return (radiusScale(s + h) - radiusScale(s)) / h;
  if (s >= 1 - h) return (radiusScale(s) - radiusScale(s - h)) / h;
  return (radiusScale(s + h) - radiusScale(s - h)) / (2 * h);
}

/**
 * 脊柱 y 方向偏移（尾尖向上翘）。
 * s ∈ [0, TAIL_BEND_START] 时为 0；之后 smoothstep 上升到 -headY*0.40（向上）。
 */
const TAIL_BEND_START = 0.72;
function spineYOffset(s, headY) {
  if (s < TAIL_BEND_START) return 0;
  const u = (s - TAIL_BEND_START) / (1 - TAIL_BEND_START);
  const eased = smoothstep01(u);
  // 平方一下让弯曲过程先慢后快，尾尖最终上扬
  return -headY * 0.40 * eased * eased;
}
function spineYOffsetDeriv(s, headY) {
  if (s < TAIL_BEND_START - 0.01) return 0;
  const h = 0.003;
  const s0 = Math.max(0, s - h);
  const s1 = Math.min(1, s + h);
  return (spineYOffset(s1, headY) - spineYOffset(s0, headY)) / (s1 - s0);
}

// -------------------- 脊柱与截面 --------------------

/**
 * 返回 s 处的 (spineX, spineY, spineZ, rx, ry, rxDeriv, ryDeriv, spineZDeriv, spineYDeriv, isHead)。
 * 加入导数信息，以便计算真正的曲面法线。
 */
function getSection(s, headX, headY, headZ, bodyLength) {
  const sc = radiusScale(s);
  const scDeriv = radiusScaleDeriv(s);

  // 沿 Z 的位置：s=0 → +headZ，s=1 → -bodyLength
  // z(s) = headZ - s * (headZ + bodyLength)，z'(s) = -(headZ + bodyLength)
  const spineZ = headZ - s * (headZ + bodyLength);
  const spineZDeriv = -(headZ + bodyLength);

  // 半径：略扁椭圆（正面更圆，侧面略瘦）—— rx/ry 用同样曲线但乘不同"椭圆度"
  const rx = headX * sc;
  const ry = headY * sc * (0.88 + 0.12 * sc);  // 头部处接近 headY，身体处略扁
  const rxDeriv = headX * scDeriv;
  const ryDeriv = headY * (scDeriv * (0.88 + 0.12 * sc) + sc * (0.12 * scDeriv));

  const spineY = spineYOffset(s, headY);
  const spineYDeriv = spineYOffsetDeriv(s, headY);

  return {
    xPos: 0,
    yPos: spineY,
    zPos: spineZ,
    rx, ry,
    rxDeriv, ryDeriv,
    spineZDeriv,
    spineYDeriv,
    isHead: s <= SPHERE_END + 0.02,
  };
}

// -------------------- 面部区域 --------------------

/**
 * 给定 (s, θ) 返回面部权重：1 = 鼻端正中央，0 = 非面部区域。
 * 用于让面部颜色比身体略亮一点。
 */
function getFaceWeight(s, angle) {
  if (s > SPHERE_END + 0.04) return 0;
  // 鼻端附近权重更高；同时让 "朝前" 的半球 +θ 靠近 0 的带形区域有效。
  const u = s / SPHERE_END;         // 0 在鼻端，1 在头部最鼓处
  const distFromFront = u;
  // 让朝前半球（|angle| 小 → cosθ 大 → 接近 1）权重更高
  const lat = Math.max(0, Math.cos(angle));
  const falloff = Math.exp(-distFromFront * distFromFront * 2.5) * (0.4 + 0.6 * lat);
  return falloff;
}

// -------------------- 主网格生成 --------------------

/**
 * 基于参数化曲面 (s, θ) → (x, y, z)：
 *   x = rx(s) · cosθ
 *   y = yBend(s) + ry(s) · sinθ   （注意 angle=0 → +Y 上方；保持与旧约定一致）
 *   z = spineZ(s) = headZ - s*(headZ + bodyLength)
 *
 * 真正的曲面法线用 T_s × T_θ 的叉乘计算：
 *   T_θ = (-rx·sinθ,  ry·cosθ,  0)
 *   T_s = (rx'·cosθ, yBend' + ry'·sinθ, z')
 *
 * 注意：为了让法线朝向"外侧"（远离主轴），叉乘顺序是 T_θ × T_s，
 * 然后检查 z 分量符号是否正确（朝前的半球 nz > 0）。
 */
function createSpindleMesh(options = {}) {
  const {
    headX = 52,
    headY = 46,
    headZ = 50,
    bodyLength = 180,
    bodyEndX = 0,    // 保留命名但不再参与形状（曲线决定收窄）
    bodyEndY = 0,
    columns = 34,
    rows = 24,
    flukeEnabled = true,
    flukeSize = 1.2,
    topColor = '#bdb8aa',
    bottomColor = '#f2f1ea',
    faceTopColor = '#c8c2b4',
    faceBottomColor = '#fff8ee',
  } = options;

  const vertices = [];
  const faces = [];

  // 鼻端 apex（单独一个顶点，避免 col=0 的 25 个重复点）
  vertices.push({
    x: 0, y: 0, z: headZ,
    nx: 0, ny: 0, nz: 1,
    t: 0, angle: 0, col: 0, row: 0,
    isTop: false, isBottom: false,
    faceWeight: 1.0,
    isHead: true,
  });
  const APEX_IDX = 0;

  // --- 主体顶点：参数化曲面 ---
  // col 从 1 开始（s ≈ 1/columns），到 columns（s=1，尾端）
  // 每列 rows+1 个顶点，angle ∈ [-π, π]
  for (let col = 1; col <= columns; col++) {
    const s = col / columns;
    const sec = getSection(s, headX, headY, headZ, bodyLength);
    const rx = sec.rx;
    const ry = sec.ry;
    const rxDeriv = sec.rxDeriv;
    const ryDeriv = sec.ryDeriv;
    const zDeriv = sec.spineZDeriv;
    const yBendDeriv = sec.spineYDeriv;

    for (let row = 0; row <= rows; row++) {
      // 与旧版保持一致：angle ∈ [-π, π]
      const angle = -Math.PI + (row / rows) * 2 * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 顶点位置（y 偏移 = 脊柱弯曲）
      const x = sec.xPos + rx * cosA;
      const y = sec.yPos + ry * sinA;
      const z = sec.zPos;

      // --- 曲面法线：T_s × T_θ（务必先沿 s 的切向量，再叉 θ 切向量）---
      // 目的：让头部正面半球（鼻端附近 +Z 附近）法线 nz > 0（朝向摄像机）
      // T_θ = (-rx·sinθ,  ry·cosθ,  0)
      const tthX = -rx * sinA;
      const tthY = ry * cosA;
      const tthZ = 0;
      // T_s = (rx'·cosθ, yBend' + ry'·sinθ, z')
      const tsX = rxDeriv * cosA;
      const tsY = yBendDeriv + ryDeriv * sinA;
      const tsZ = zDeriv;

      // n = T_s × T_θ （注意顺序！——必须先 T_s 后 T_θ）
      let nx = tsY * tthZ - tsZ * tthY;
      let ny = tsZ * tthX - tsX * tthZ;
      let nz = tsX * tthY - tsY * tthX;

      // 鼻端（s→0）处 rx→ry→0，导致 T_θ→0，叉乘结果为零向量；
      // 给这些顶点一个默认朝外的法线（鼻端朝 +Z）
      if (s < 0.02) {
        nx = 0; ny = 0; nz = 1;
      }

      // 归一化（保证有限值）
      const nLenRaw = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nLenRaw > 1e-6) {
        nx /= nLenRaw; ny /= nLenRaw; nz /= nLenRaw;
      } else {
        nx = 0; ny = 0; nz = 1; // 兜底：朝摄像机
      }

      // 面部权重 & 上下：sinA > 0 → +Y → 下方；sinA < 0 → 上方
      const fw = getFaceWeight(s, angle);
      // isTop: 上方半（-Y 半球，即 sinA < 0）
      const isTop = sinA < 0;

      vertices.push({
        x, y, z,
        nx, ny, nz,
        t: s, angle, col, row,
        isTop, isBottom: !isTop,
        faceWeight: fw,
        isHead: sec.isHead,
      });
    }
  }

  // --- 主体面 ---
  // col 1 → col 2：每相邻两列构成 rows 个四边形面
  for (let col = 1; col < columns; col++) {
    const colA = 1 + (col - 1) * (rows + 1); // col 顶点起始：col=1 → idx 1
    const colB = colA + (rows + 1);
    for (let row = 0; row < rows; row++) {
      const a = colA + row;
      const b = a + 1;
      const c = colB + row;
      const d = c + 1;
      const va = vertices[a];
      const vb = vertices[b];
      const vc = vertices[c];
      const vd = vertices[d];
      const avgSin = (Math.sin(va.angle) + Math.sin(vb.angle) + Math.sin(vc.angle) + Math.sin(vd.angle)) * 0.25;
      faces.push({
        indices: [a, b, d, c],
        vertices: [va, vb, vd, vc],
        isTop: avgSin < 0,
        isBottom: avgSin >= 0,
        column: col, row,
      });
    }
  }

  // 鼻端连接：apex → col=1 环，构成 rows 个三角面
  {
    const ringStart = 1; // col=1 顶点起始
    for (let row = 0; row < rows; row++) {
      const a = ringStart + row;
      const b = ringStart + row + 1;
      const va = vertices[a];
      const vb = vertices[b];
      const vApex = vertices[APEX_IDX];
      const avgSin = (Math.sin(va.angle) + Math.sin(vb.angle)) * 0.5;
      faces.push({
        indices: [APEX_IDX, a, b],
        vertices: [vApex, va, vb],
        isTop: avgSin < 0,
        isBottom: avgSin >= 0,
        column: 0, row,
      });
    }
  }

  // --- 尾鳍（Tail）：萨卡班甲鱼式对称尾鳍叶 ---
  //     设计（GPT审阅后修正）：
  //       R：尾柄中心（主体最后一圈的中心）
  //       A：尾鳍上顶点（-Y）
  //       C：尾鳍下端点（+Y）
  //       BL：尾鳍左边缘（-X）
  //       BR：尾鳍右边缘（+X）
  //       T：尾尖（向 -Z 延伸）
  //     上下尾叶是真正对称的：R-A-T（上）和 R-C-T（下）
  //     尾鳍是薄鳍结构（doubleSided），从左右两侧都可见
  //     尾鳍是三角面原生表示，不是退化四边形
  if (flukeEnabled) {
    const flukeStartIdx = vertices.length;
    const flukeHalfWidth = headX * 0.18 * flukeSize;   // 尾鳍左右宽度（较窄）
    const flukeHalfHeight = headY * 0.22 * flukeSize;  // 尾鳍上下高度
    const tailExtensionZ = 30;                         // 尾巴延伸长度（实际使用）
    const flukeTipBackZ = -bodyLength - headZ * 0.2 - tailExtensionZ; // 尾尖最终位置

    // 主体最后一圈的中心（不含 seam 端点重复）
    // 顶点布局：[0]=apex，然后 col=1..columns，每列 rows+1 个顶点
    const lastRingStart = 1 + (columns - 1) * (rows + 1);
    let bodyEndCenterX = 0, bodyEndCenterY = 0, bodyEndCenterZ = 0;
    for (let row = 0; row < rows; row++) {
      bodyEndCenterX += vertices[lastRingStart + row].x;
      bodyEndCenterY += vertices[lastRingStart + row].y;
      bodyEndCenterZ += vertices[lastRingStart + row].z;
    }
    bodyEndCenterX /= rows;
    bodyEndCenterY /= rows;
    bodyEndCenterZ /= rows;

    // 尾柄中心 R（基础位置 = 主体末端后 3 单位）
    const flukeBaseZ = bodyEndCenterZ - 3;
    const vR = {
      x: bodyEndCenterX, y: bodyEndCenterY, z: flukeBaseZ,
      nx: 0, ny: 0, nz: -1, t: 1.03, angle: 0, col: columns + 1, row: 0,
      isTop: false, isBottom: false, faceWeight: 0, isHead: false,
    };
    // 上顶点 A
    const vA = {
      x: bodyEndCenterX, y: bodyEndCenterY - flukeHalfHeight, z: flukeBaseZ - 10,
      nx: 0, ny: -1, nz: 0, t: 1.04, angle: -Math.PI / 2, col: columns + 1, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };
    // 下顶点 C
    const vC = {
      x: bodyEndCenterX, y: bodyEndCenterY + flukeHalfHeight, z: flukeBaseZ - 10,
      nx: 0, ny: 1, nz: 0, t: 1.04, angle: Math.PI / 2, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };
    // 左边缘 BL
    const vBL = {
      x: bodyEndCenterX - flukeHalfWidth, y: bodyEndCenterY, z: flukeBaseZ,
      nx: -1, ny: 0, nz: 0, t: 1.03, angle: Math.PI, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };
    // 右边缘 BR
    const vBR = {
      x: bodyEndCenterX + flukeHalfWidth, y: bodyEndCenterY, z: flukeBaseZ,
      nx: 1, ny: 0, nz: 0, t: 1.03, angle: 0, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };
    // 尾尖 T（向 -Z 延伸，略上翘）
    const vT = {
      x: bodyEndCenterX, y: bodyEndCenterY - headY * 0.05, z: flukeTipBackZ,
      nx: 0, ny: 0, nz: -1, t: 1.1, angle: 0, col: columns + 2, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };

    // 顶点 push 顺序：R, A, C, BL, BR, T
    vertices.push(vR, vA, vC, vBL, vBR, vT);
    const iR = flukeStartIdx + 0;
    const iA = flukeStartIdx + 1;
    const iC = flukeStartIdx + 2;
    const iBL = flukeStartIdx + 3;
    const iBR = flukeStartIdx + 4;
    const iT = flukeStartIdx + 5;

    // --- 真正对称的上下尾鳍叶（原生三角面，非退化四边形） ---
    // 上尾叶：R -> A -> T（从尾柄到上顶点到尾尖）
    faces.push({
      indices: [iR, iA, iT],
      vertices: [vR, vA, vT],
      isTop: true, isBottom: false,
      column: columns + 1, row: 0,
      doubleSided: true,
    });

    // 下尾叶：R -> T -> C（从尾柄到尾尖到下顶点）
    faces.push({
      indices: [iR, iT, iC],
      vertices: [vR, vT, vC],
      isTop: false, isBottom: true,
      column: columns + 1, row: 0,
      doubleSided: true,
    });

    // 左右侧尾鳍连接（薄鳍的左右边缘补充）
    // 左尾叶：R -> BL -> T
    faces.push({
      indices: [iR, iBL, iT],
      vertices: [vR, vBL, vT],
      isTop: false, isBottom: false,
      column: columns + 1, row: 0,
      doubleSided: true,
    });

    // 右尾叶：R -> T -> BR
    faces.push({
      indices: [iR, iT, iBR],
      vertices: [vR, vT, vBR],
      isTop: false, isBottom: false,
      column: columns + 1, row: 0,
      doubleSided: true,
    });

    // --- 连接主体最后一圈到尾鳍边缘：非交叉顺序 ---
    // 找到主体最后一圈的四个关键点（top/bottom/left/right）
    let topIdx = lastRingStart, bottomIdx = lastRingStart, leftIdx = lastRingStart, rightIdx = lastRingStart;
    let topDiff = Infinity, bottomDiff = Infinity, leftDiff = Infinity, rightDiff = Infinity;
    for (let row = 0; row < rows; row++) {
      const v = vertices[lastRingStart + row];
      const d1 = Math.abs(v.angle - (-Math.PI / 2));
      const d2 = Math.abs(v.angle - Math.PI / 2);
      const d3 = Math.abs(Math.abs(v.angle) - Math.PI);
      const d4 = Math.abs(v.angle - 0);
      if (d1 < topDiff) { topDiff = d1; topIdx = lastRingStart + row; }
      if (d2 < bottomDiff) { bottomDiff = d2; bottomIdx = lastRingStart + row; }
      if (d3 < leftDiff) { leftDiff = d3; leftIdx = lastRingStart + row; }
      if (d4 < rightDiff) { rightDiff = d4; rightIdx = lastRingStart + row; }
    }

    // 连接四边形（绕序正确，避免 bowtie）
    // 上-右连接：主体上 -> 主体右 -> BR -> R
    faces.push({
      indices: [topIdx, rightIdx, iBR, iR],
      vertices: [vertices[topIdx], vertices[rightIdx], vBR, vR],
      isTop: true, isBottom: false,
      column: columns, row: 0,
    });
    // 右-下连接：主体右 -> 主体下 -> C -> R
    faces.push({
      indices: [rightIdx, bottomIdx, iC, iR],
      vertices: [vertices[rightIdx], vertices[bottomIdx], vC, vR],
      isTop: false, isBottom: true,
      column: columns, row: 0,
    });
    // 下-左连接：主体下 -> 主体左 -> BL -> R
    faces.push({
      indices: [bottomIdx, leftIdx, iBL, iR],
      vertices: [vertices[bottomIdx], vertices[leftIdx], vBL, vR],
      isTop: false, isBottom: true,
      column: columns, row: 0,
    });
    // 左-上连接：主体左 -> 主体上 -> A -> R
    faces.push({
      indices: [leftIdx, topIdx, iA, iR],
      vertices: [vertices[leftIdx], vertices[topIdx], vA, vR],
      isTop: true, isBottom: false,
      column: columns, row: 0,
    });
  } else {
    // 无尾鳍模式：简单从尾端中心扇形三角化到最后一圈
    // 顶点布局：[0]=apex，然后 col=1..columns，每列 rows+1 个顶点
    const lastRingStart = 1 + (columns - 1) * (rows + 1);
    const tailIdx = vertices.length;
    let tailAvgX = 0, tailAvgY = 0, tailAvgZ = 0;
    for (let row = 0; row <= rows; row++) {
      const v = vertices[lastRingStart + row];
      tailAvgX += v.x;
      tailAvgY += v.y;
      tailAvgZ += v.z;
    }
    tailAvgX /= (rows + 1);
    tailAvgY /= (rows + 1);
    tailAvgZ /= (rows + 1);
    vertices.push({
      x: tailAvgX, y: tailAvgY, z: tailAvgZ,
      nx: 0, ny: 0, nz: -1,
      t: 1, angle: 0, col: columns, row: -1,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    });
    for (let row = 0; row < rows; row++) {
      const curr = lastRingStart + row;
      const next = lastRingStart + row + 1;
      // 三角形面（不再重复 tailIdx 伪装成四边形）
      faces.push({
        indices: [tailIdx, curr, next],
        vertices: [vertices[tailIdx], vertices[curr], vertices[next]],
        isTop: false, isBottom: true,
        column: columns, row,
      });
    }
  }

  return {
    vertices, faces,
    headX, headY, headZ, headR: headX, bodyLength, bodyEndX, bodyEndY,
    columns, rows,
    topColor, bottomColor, faceTopColor, faceBottomColor,
    type: 'spindle',
  };
}

// -------------------- 面部锚点 --------------------

/**
 * 计算五官锚点 + 局部切向量（right/up），以便在头部旋转后把
 * 眼睛/眉毛/嘴"贴"到曲面上，并在侧视时被椭圆压缩。
 *
 * 输入：
 *   horizOffset —— 水平偏移（X 方向，正值向右）
 *   vertOffset  —— 垂直偏移（Y 方向，正值向下）
 *   depthOffset —— 沿表面法线的外推距离（浮到皮肤外一点）
 *
 * 返回：
 *   (x, y, z)         —— 锚点位置
 *   (nx, ny, nz)      —— 椭球表面法线（≈朝摄像机方向归一化）
 *   (tx, ty, tz)      —— 局部"右"方向（tangent，沿 X 在表面投影）
 *   (bx, by, bz)      —— 局部"下"方向（binormal，沿 Y 投影）
 *
 * 这样，在渲染时，眉毛沿 tangent 画，嘴的垂直方向沿 binormal。
 * 旋转后再投影，侧视椭圆自然出现。
 */
function normalizeVec3(x, y, z, fallback) {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(len) || len < BASIS_EPSILON) {
    return { x: fallback.x, y: fallback.y, z: fallback.z };
  }
  return { x: x / len, y: y / len, z: z / len };
}

function crossVec3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0.5) {
  const hx = mesh.headX, hy = mesh.headY, hz = mesh.headZ;
  const x = horizOffset;
  const y = vertOffset;
  const invHx2 = 1 / (hx * hx);
  const invHy2 = 1 / (hy * hy);
  const invHz2 = 1 / (hz * hz);
  const inside = 1 - x * x * invHx2 - y * y * invHy2;
  const zSurface = hz * Math.sqrt(Math.max(0.02, inside));
  const z = zSurface + depthOffset;

  // 椭球表面法线：(x/hx², y/hy², z/hz²)
  const n = normalizeVec3(x * invHx2, y * invHy2, zSurface * invHz2, { x: 0, y: 0, z: 1 });

  // 稳定的水平切向量：(z/hz², 0, -x/hx²)，与椭球梯度点积为零，无除法
  let t = normalizeVec3(zSurface * invHz2, 0, -x * invHx2, { x: 1, y: 0, z: 0 });

  // 下方向：n × t
  const rawB = crossVec3(n, t);
  let b = normalizeVec3(rawB.x, rawB.y, rawB.z, { x: 0, y: 1, z: 0 });

  // 再做一次正交化：t = b × n
  const rawT2 = crossVec3(b, n);
  t = normalizeVec3(rawT2.x, rawT2.y, rawT2.z, { x: 1, y: 0, z: 0 });

  // 最终 b = n × t（再次确保）
  const rawB2 = crossVec3(n, t);
  b = normalizeVec3(rawB2.x, rawB2.y, rawB2.z, { x: 0, y: 1, z: 0 });

  return {
    x, y, z,
    nx: n.x, ny: n.y, nz: n.z,
    tx: t.x, ty: t.y, tz: t.z,
    bx: b.x, by: b.y, bz: b.z,
    faceWeight: 1.0,
  };
}

/**
 * 旧版 API 兼容：按 (bodyT, surfAngle) 返回曲面上的锚点。
 *   bodyT ∈ [0, 1]   —— 沿脊柱的参数位置（0 鼻端，1 尾端）
 *   surfAngle        —— 绕脊柱的圆周角度（0/+/-π 在正面，±π/2 在左右）
 *
 * 实现：在 bodyT 截面上，按 surfAngle 找到表面点，然后用 getSection 的椭圆 rx/ry
 *       映射到 3D 坐标。头部时用椭球逼近（正面 nz>0），身体/尾部时法线
 *       沿径向朝外。
 */
function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
  const s = Math.max(0, Math.min(1, bodyT));
  const sec = getSection(s, mesh.headX, mesh.headY, mesh.headZ, mesh.bodyLength);

  // 约定：surfAngle = PI/2  → 正面（朝摄像机，+Z 推出最多）
  //       surfAngle = 0     → 上侧
  //       surfAngle = ±π    → 下侧
  //       surfAngle = -π/2  → 左 / 右背面之一
  // 让 (latX, latY) = (-cos(surfAngle), sin(surfAngle))，
  // 这样 surfAngle=PI/2 时 latX=0, latY=1 → 截面上 y 正方向，
  // 再通过 "朝向摄像机" 的 faceLift 把 PI/2 方向映射到 +Z。
  const latX = -Math.cos(surfAngle);
  const latY = Math.sin(surfAngle);

  // 在截面上的表面点
  // 加入一个随 bodyT 变化的微小 x 偏移：头部 (s 小) 更靠右，身体更靠中间。
  // 这样即使 latX=0（正面中心），不同 bodyT 也能体现位置差异。
  const bodyTXShift = Math.cos(s * Math.PI) * sec.rx * 0.05;
  let x = sec.xPos + bodyTXShift + sec.rx * latX;
  let y = sec.yPos + sec.ry * latY;
  let z = sec.zPos;

  // surfAngle=PI/2 表示"正面" → 向 +Z 推出最多（越靠近摄像机）
  // 用 max(0, sin(surfAngle)) 作为正面权重，保证 PI/2 时取得最大值
  if (sec.isHead) {
    const faceWeight = Math.max(0, Math.sin(surfAngle));
    const faceLift = faceWeight * sec.rx * 0.9;
    z += faceLift;
  }

  // 径向法线近似（椭圆表面向外）
  let nx = latX / (sec.rx > 0.01 ? sec.rx : 1);
  let ny = latY / (sec.ry > 0.01 ? sec.ry : 1);
  let nz = sec.isHead ? 0.5 : 0;
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= nLen; ny /= nLen; nz /= nLen;

  // surfaceOffset：沿法线方向推出
  x += nx * surfaceOffset;
  y += ny * surfaceOffset;
  z += nz * surfaceOffset;

  // 切向量（沿 bodyT 方向）与 binormal
  const tLen = Math.sqrt(1 + sec.spineZDeriv * sec.spineZDeriv) || 1;
  const tx = 0, ty = sec.spineYDeriv / tLen, tz = sec.spineZDeriv / tLen;
  // binormal = n × t
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;
  const bLen2 = Math.sqrt(bx * bx + by * by + bz * bz) || 1;

  return {
    x, y, z, nx, ny, nz,
    tx, ty, tz,
    bx: bx / bLen2, by: by / bLen2, bz: bz / bLen2,
    faceWeight: sec.isHead ? 1.0 : 0.0,
  };
}

// -------------------- 兼容旧 API --------------------

/**
 * 返回一个最小可用的独立尾鳍 mesh（用于测试和兼容性）。
 * 真实渲染时萨卡班甲鱼尾鳍已由 createSpindleMesh 统一生成，
 * 这里提供一个独立表示，方便引用"tailMesh"的旧代码继续工作。
 */
function createWhaleTailMesh(options = {}) {
  const tailLength = options.tailLength ?? 60;
  const flukeHalfWidth = options.flukeHalfWidth ?? 22;
  const flukeHalfHeight = options.flukeHalfHeight ?? 28;
  const baseHalfWidth = options.baseHalfWidth ?? 12;
  const baseHalfHeight = options.baseHalfHeight ?? 14;

  // 关键顶点（Z 方向从 0 退到 -tailLength）
  //   R = 尾柄中心（基础点）
  //   A = 尾鳍上顶点（-Y）
  //   C = 尾鳍下端点（+Y）
  //   BL = 左边缘（-X）
  //   BR = 右边缘（+X）
  //   T = 尾尖（向 -Z 延伸）
  const vR = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: -1, col: 0, row: 0, isTop: false, isBottom: false, faceWeight: 0, isHead: false };
  const vA = { x: 0, y: -flukeHalfHeight, z: -tailLength * 0.25, nx: 0, ny: -1, nz: 0, col: 0, row: 0, isTop: true, isBottom: false, faceWeight: 0, isHead: false };
  const vC = { x: 0, y: flukeHalfHeight, z: -tailLength * 0.25, nx: 0, ny: 1, nz: 0, col: 0, row: 0, isTop: false, isBottom: true, faceWeight: 0, isHead: false };
  const vBL = { x: -baseHalfWidth, y: 0, z: -tailLength * 0.1, nx: -1, ny: 0, nz: 0, col: 0, row: 0, isTop: false, isBottom: false, faceWeight: 0, isHead: false };
  const vBR = { x: baseHalfWidth, y: 0, z: -tailLength * 0.1, nx: 1, ny: 0, nz: 0, col: 0, row: 0, isTop: false, isBottom: false, faceWeight: 0, isHead: false };
  const vT = { x: 0, y: -flukeHalfHeight * 0.1, z: -tailLength, nx: 0, ny: 0, nz: -1, col: 0, row: 0, isTop: true, isBottom: false, faceWeight: 0, isHead: false };

  const vertices = [vR, vA, vC, vBL, vBR, vT];
  const faces = [
    { indices: [0, 1, 5], vertices: [vR, vA, vT], isTop: true, isBottom: false, doubleSided: true },
    { indices: [0, 5, 2], vertices: [vR, vT, vC], isTop: false, isBottom: true, doubleSided: true },
    { indices: [0, 3, 5], vertices: [vR, vBL, vT], isTop: false, isBottom: false, doubleSided: true },
    { indices: [0, 5, 4], vertices: [vR, vT, vBR], isTop: false, isBottom: false, doubleSided: true },
  ];

  return {
    vertices,
    faces,
    tailLength,
    tailWidth: flukeHalfWidth * 2,
    flukeSegments: faces.length,
    color: options.color || '#bdb8aa',
    type: 'whaleTail',
  };
}

// -------------------- 变形与旋转 --------------------

/**
 * 对网格应用 yaw/pitch/roll 旋转（角度制）。
 * 复制原有顶点并增加 (tx, ty, tz) 旋转后坐标。
 */
function applyYawPitchRoll(x, y, z, nx, ny, nz, params) {
  const { angleY = 0, angleX = 0, angleZ = 0 } = params;
  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  // 旋转顺序: Z → X → Y (先 roll, 再 pitch, 最后 yaw)
  // 与 _transformVec 保持一致，避免 yaw+pitch 组合时五官横过来
  // Z (roll):
  let x1 = x * cosZ - y * sinZ;
  let y1 = x * sinZ + y * cosZ;
  let z1 = z;
  let nx1 = nx * cosZ - ny * sinZ;
  let ny1 = nx * sinZ + ny * cosZ;
  let nz1 = nz;

  // X (pitch):
  let y2 = y1 * cosX - z1 * sinX;
  let z2 = y1 * sinX + z1 * cosX;
  let x2 = x1;
  let ny2 = ny1 * cosX - nz1 * sinX;
  let nz2 = ny1 * sinX + nz1 * cosX;
  let nx2 = nx1;

  // Y (yaw):
  let x3 = x2 * cosY + z2 * sinY;
  let z3 = -x2 * sinY + z2 * cosY;
  let y3 = y2;
  let nx3 = nx2 * cosY + nz2 * sinY;
  let nz3 = -nx2 * sinY + nz2 * cosY;
  let ny3 = ny2;

  return { x: x3, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
}

function deformSpindle(mesh, params = {}) {
  const transformed = mesh.vertices.map((v) => {
    const r = applyYawPitchRoll(v.x, v.y, v.z, v.nx, v.ny, v.nz, params);
    return { ...v, tx: r.x, ty: r.y, tz: r.z, nx: r.nx, ny: r.ny, nz: r.nz };
  });
  const transformedFaces = mesh.faces.map((f) => ({
    ...f,
    vertices: f.indices.map((idx) => transformed[idx]),
  }));
  return { ...mesh, vertices: transformed, faces: transformedFaces };
}

/**
 * Compute nostril size scaled by head width.
 * Break-even: 2.0 / 0.045 ≈ 44.44 — below this the floor dominates,
 * above this the linear term dominates.
 */
function computeNostrilSize(headX) {
  return Math.max(2.0, headX * 0.045);
}


// ========[ procedural-mesh-renderer ]========
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

// ---------------- 公共工具 ----------------

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
    // 选择与 n 的最小绝对分量对应的坐标轴（最不同于 n 的轴），作为参考向量
    let ref;
    if (Math.abs(n.x) <= Math.abs(n.y) && Math.abs(n.x) <= Math.abs(n.z)) {
      ref = { x: 1, y: 0, z: 0 };
    } else if (Math.abs(n.y) <= Math.abs(n.z)) {
      ref = { x: 0, y: 1, z: 0 };
    } else {
      ref = { x: 0, y: 0, z: 1 };
    }
    // 将参考轴投影到 n 的法平面得到 t
    const refDotN = dotVec3(ref, n);
    t = {
      x: ref.x - refDotN * n.x,
      y: ref.y - refDotN * n.y,
      z: ref.z - refDotN * n.z,
    };
  }

  // 确保 t 单位长
  t = normVec3(t, { x: 1, y: 0, z: 0 });

  // 用双重叉积确保 t 与 n 正交：b = n × t，然后 t = b × n
  let b = normVec3(crossVec3(n, t), { x: 0, y: 1, z: 0 });
  t = normVec3(crossVec3(b, n), { x: 1, y: 0, z: 0 });
  b = normVec3(crossVec3(n, t), { x: 0, y: 1, z: 0 });

  return { n, t, b };
}

// 导出用于测试（仅限测试使用）
function buildFaceBasisTest(local) {
  return buildFaceBasis(local);
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

// 默认光照配置（球体）
const SPHERE_DEFAULT_LIGHT_DIR = { x: -0.35, y: -0.4, z: 0.8 };
const SPHERE_DEFAULT_AMBIENT = 0.55;

class ProceduralSphereAvatar extends ProceduralMeshRenderer {
  constructor(canvasId, options = {}) {
    super(canvasId);
    this.mesh = createSphereMesh({ rings: 18, segments: 28, radius: 85 });
    // 光照参数（可选）
    this.lightDir = options.lightDir ?? { ...SPHERE_DEFAULT_LIGHT_DIR };
    this.ambient = options.ambient ?? SPHERE_DEFAULT_AMBIENT;
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

    // 球体是封闭凸形，使用严格的背面剔除阈值 -0.05，ambient 0.55 让暗部不糊死
    this._drawMesh(ctx, deformed, {
      w, h, scale, originX, originY,
      baseColorTop: '#bdb8aa',
      baseColorBottom: '#f3f0e6',
      faceTopColor: '#c8c2b4',
      faceBottomColor: '#fffaf0',
      lightDir: this.lightDir,
      cullThreshold: -0.05,
      ambient: this.ambient,
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

// 默认光照配置（纺锤鲸鱼）
const SPINDLE_DEFAULT_LIGHT_DIR = { x: -0.3, y: -0.5, z: 0.8 };
const SPINDLE_DEFAULT_AMBIENT = 0.58;

class ProceduralSpindleWhaleAvatar extends ProceduralMeshRenderer {
  constructor(canvasId, options = {}) {
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
    // 光照参数（可选）
    this.lightDir = options.lightDir ?? { ...SPINDLE_DEFAULT_LIGHT_DIR };
    this.ambient = options.ambient ?? SPINDLE_DEFAULT_AMBIENT;
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
    const deformedBody = deformSpindle(this.spindleMesh, rot);
    this._drawMesh(ctx, deformedBody, {
      w, h, scale, originX, originY,
      baseColorTop: this.spindleMesh.topColor,
      baseColorBottom: this.spindleMesh.bottomColor,
      faceTopColor: this.spindleMesh.faceTopColor,
      faceBottomColor: this.spindleMesh.faceBottomColor,
      lightDir: this.lightDir,
      cullThreshold: -0.15,
      ambient: this.ambient,
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
    const nostrilSize = computeNostrilSize(hx);
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

function createSphereAvatar(canvasId) {
  return new ProceduralSphereAvatar(canvasId);
}

function createSpindleWhaleAvatar(canvasId) {
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



  // ========[ 显式挂到 window ]========
  if (typeof window !== "undefined") {
    window.CheapLiveProceduralMeshRenderer = ProceduralMeshRenderer;
    window.ProceduralSphereAvatar = ProceduralSphereAvatar;
    window.ProceduralSpindleWhaleAvatar = ProceduralSpindleWhaleAvatar;
    window.createSphereAvatar = createSphereAvatar;
    window.createSpindleWhaleAvatar = createSpindleWhaleAvatar;
    window.createSpindleMesh = createSpindleMesh;
    window.createSphereMesh = createSphereMesh;
    window.computeFaceAnchor = computeFaceAnchor;
    window.computeSphereFaceAnchor = computeSphereFaceAnchor;
  }
})();
