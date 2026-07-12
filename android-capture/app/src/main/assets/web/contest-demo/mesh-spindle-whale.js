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
 *        n = T_s × T_θ （归一化）
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
export function radiusScale(s) {
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
export function radiusScaleDeriv(s) {
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
 * 注意：为了让法线朝向"外侧"（远离主轴），叉乘顺序是 T_s × T_θ，
 * 并检查 z 分量符号是否正确（朝前的半球 nz > 0）。
 */
export function createSpindleMesh(options = {}) {
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

  // --- 尾鳍（Tail）：竖向三角形，主平面在 Y-Z 平面 ---
  //     萨卡班甲鱼特征：
  //       - 尾鳍竖起来，像两片竖向的纸贴在身体延长线上
  //       - 主平面是 Y-Z 平面（上下展开），不是 X-Z 平面（左右展开）
  //       - 从正后方看是一个竖线，居中位置稍微厚一点
  //       - 所有面都是三角形，避免退化问题
  if (flukeEnabled) {
    const flukeStartIdx = vertices.length;
    const flukeHalfHeight = headY * 0.35 * flukeSize;  // 竖向高度
    const flukeThickness = headX * 0.08 * flukeSize;   // 厚度（X方向）
    const tailExtensionZ = 40;
    const flukeTipBackZ = -bodyLength - headZ * 0.2 - tailExtensionZ;

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

    const flukeBaseZ = bodyEndCenterZ - 3;

    // 尾鳍根节点（身体末端中心，稍微厚一点）
    const vBase = {
      x: bodyEndCenterX, y: bodyEndCenterY, z: flukeBaseZ,
      nx: 0, ny: 0, nz: -1, t: 1.02, angle: 0, col: columns + 1, row: 0,
      isTop: false, isBottom: false, faceWeight: 0, isHead: false,
    };

    // 上尾鳍顶点（-Y 方向）
    const vTop = {
      x: bodyEndCenterX, y: bodyEndCenterY - flukeHalfHeight, z: flukeBaseZ - 15,
      nx: 0, ny: -1, nz: 0, t: 1.05, angle: -Math.PI / 2, col: columns + 1, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };

    // 下尾鳍顶点（+Y 方向）
    const vBottom = {
      x: bodyEndCenterX, y: bodyEndCenterY + flukeHalfHeight, z: flukeBaseZ - 15,
      nx: 0, ny: 1, nz: 0, t: 1.05, angle: Math.PI / 2, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };

    // 尾尖（向后延伸，稍微向上翘）
    const vTip = {
      x: bodyEndCenterX, y: bodyEndCenterY - headY * 0.05, z: flukeTipBackZ,
      nx: 0, ny: 0, nz: -1, t: 1.1, angle: 0, col: columns + 2, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };

    // 厚度偏移点（用于创建有厚度的尾鳍）
    const vBaseThick = {
      x: bodyEndCenterX + flukeThickness, y: bodyEndCenterY, z: flukeBaseZ,
      nx: 1, ny: 0, nz: 0, t: 1.02, angle: 0, col: columns + 1, row: 0,
      isTop: false, isBottom: false, faceWeight: 0, isHead: false,
    };

    const vTopThick = {
      x: bodyEndCenterX + flukeThickness * 0.5, y: bodyEndCenterY - flukeHalfHeight, z: flukeBaseZ - 15,
      nx: 1, ny: 0, nz: 0, t: 1.05, angle: 0, col: columns + 1, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };

    const vBottomThick = {
      x: bodyEndCenterX + flukeThickness * 0.5, y: bodyEndCenterY + flukeHalfHeight, z: flukeBaseZ - 15,
      nx: 1, ny: 0, nz: 0, t: 1.05, angle: 0, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };

    const vTipThick = {
      x: bodyEndCenterX + flukeThickness * 0.3, y: bodyEndCenterY - headY * 0.05, z: flukeTipBackZ,
      nx: 1, ny: 0, nz: 0, t: 1.1, angle: 0, col: columns + 2, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };

    vertices.push(vBase, vTop, vBottom, vTip, vBaseThick, vTopThick, vBottomThick, vTipThick);
    const iBase = flukeStartIdx + 0;
    const iTop = flukeStartIdx + 1;
    const iBottom = flukeStartIdx + 2;
    const iTip = flukeStartIdx + 3;
    const iBaseT = flukeStartIdx + 4;
    const iTopT = flukeStartIdx + 5;
    const iBottomT = flukeStartIdx + 6;
    const iTipT = flukeStartIdx + 7;

    // 上尾鳍面（主平面 Y-Z）
    faces.push({
      indices: [iBase, iTop, iTip],
      vertices: [vBase, vTop, vTip],
      isTop: true, isBottom: false,
      column: columns + 1, row: 0,
      doubleSided: true,
    });
    faces.push({
      indices: [iBaseT, iTipT, iTopT],
      vertices: [vBaseThick, vTipThick, vTopThick],
      isTop: true, isBottom: false,
      column: columns + 1, row: 0,
      doubleSided: true,
    });

    // 下尾鳍面（主平面 Y-Z）
    faces.push({
      indices: [iBase, iTip, iBottom],
      vertices: [vBase, vTip, vBottom],
      isTop: false, isBottom: true,
      column: columns + 1, row: 0,
      doubleSided: true,
    });
    faces.push({
      indices: [iBaseT, iBottomT, iTipT],
      vertices: [vBaseThick, vBottomThick, vTipThick],
      isTop: false, isBottom: true,
      column: columns + 1, row: 0,
      doubleSided: true,
    });

    // 连接主体到尾鳍根
    let topIdx = lastRingStart, bottomIdx = lastRingStart;
    let topDiff = Infinity, bottomDiff = Infinity;
    for (let row = 0; row < rows; row++) {
      const v = vertices[lastRingStart + row];
      const d1 = Math.abs(v.angle - (-Math.PI / 2));
      const d2 = Math.abs(v.angle - Math.PI / 2);
      if (d1 < topDiff) { topDiff = d1; topIdx = lastRingStart + row; }
      if (d2 < bottomDiff) { bottomDiff = d2; bottomIdx = lastRingStart + row; }
    }

    faces.push({
      indices: [topIdx, iBase, iTop],
      vertices: [vertices[topIdx], vBase, vTop],
      isTop: true, isBottom: false,
      column: columns, row: 0,
    });
    faces.push({
      indices: [bottomIdx, iBottom, iBase],
      vertices: [vertices[bottomIdx], vBottom, vBase],
      isTop: false, isBottom: true,
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
const BASIS_EPSILON = 1e-10;

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

export function computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0.5) {
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
export function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
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
export function createWhaleTailMesh(options = {}) {
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

const BEND_COEF_YAW = 0.80;
const BEND_COEF_PITCH = 0.60;

/**
 * 弯曲系数曲线：沿身体主轴 s∈[0,1] 的连续单调曲线。
 * 脸部刚性跟随 → 头后部轻微滞后 → 身体逐渐过渡 → 尾部最大滞后。
 * 保证连续、单调不下降，避免折痕。
 */
function bendProfile(s) {
  const t = Math.max(0, Math.min(1, s));
  const faceEnd = 0.08;   // 脸部刚性跟随区域
  const headEnd = 0.28;   // 头部后段过渡结束
  const tailStart = 0.80;  // 尾部开始进入最大滞后

  if (t <= faceEnd) return 0;
  if (t <= headEnd) {
    // 头部后段：smoothstep 从 0 到 0.30
    const u = (t - faceEnd) / (headEnd - faceEnd);
    return 0.30 * u * u * (3 - 2 * u);
  }
  if (t <= tailStart) {
    // 身体主体：smoothstep 从 0.30 到 1.0
    const u = (t - headEnd) / (tailStart - headEnd);
    return 0.30 + 0.70 * u * u * (3 - 2 * u);
  }
  return 1;
}

function bendProfileDeriv(s) {
  const h = 0.002;
  if (s <= h) return (bendProfile(s + h) - bendProfile(s)) / h;
  if (s >= 1 - h) return (bendProfile(s) - bendProfile(s - h)) / h;
  return (bendProfile(s + h) - bendProfile(s - h)) / (2 * h);
}

function applySoftRotation(x, y, z, nx, ny, nz, s, params) {
  const { angleY = 0, angleX = 0, angleZ = 0, tailSway = 0 } = params;

  const bend = bendProfile(s);

  // 头部带动、身体滞后：头部旋转最大，身体逐渐滞后
  const effectiveYaw = angleY * (1 - BEND_COEF_YAW * bend);
  const effectivePitch = angleX * (1 - BEND_COEF_PITCH * bend);
  const effectiveRoll = angleZ * (1 - 0.6 * bend);

  const radY = effectiveYaw * Math.PI / 180;
  const radX = effectivePitch * Math.PI / 180;
  const radZ = effectiveRoll * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  let x1 = x * cosZ - y * sinZ;
  let y1 = x * sinZ + y * cosZ;
  let z1 = z;
  let nx1 = nx * cosZ - ny * sinZ;
  let ny1 = nx * sinZ + ny * cosZ;
  let nz1 = nz;

  let y2 = y1 * cosX - z1 * sinX;
  let z2 = y1 * sinX + z1 * cosX;
  let x2 = x1;
  let ny2 = ny1 * cosX - nz1 * sinX;
  let nz2 = ny1 * sinX + nz1 * cosX;
  let nx2 = nx1;

  let x3 = x2 * cosY + z2 * sinY;
  let z3 = -x2 * sinY + z2 * cosY;
  let y3 = y2;
  let nx3 = nx2 * cosY + nz2 * sinY;
  let nz3 = -nx2 * sinY + nz2 * cosY;
  let ny3 = ny2;

  // 动态甩尾：基于 yawVelocity 的横向位移，从身体后半段开始，到尾部最大
  if (tailSway !== 0) {
    const swayStart = 0.45;
    const t = s < swayStart ? 0 : Math.max(0, Math.min(1, (s - swayStart) / (1.0 - swayStart)));
    const swayWeight = t * t * (3 - 2 * t);
    const x4 = x3 + tailSway * swayWeight;
    return { x: x4, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
  }

  return { x: x3, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
}

export function deformSpindle(mesh, params = {}) {
  const transformed = mesh.vertices.map((v) => {
    const s = v.t !== undefined ? v.t : 0;
    const r = applySoftRotation(v.x, v.y, v.z, v.nx, v.ny, v.nz, s, params);
    // 旋转后更新 isTop：让灰白分界线跟随头部旋转
    // 萨卡班甲鱼：灰白分界线是水平线，旋转后应基于新的 y 坐标判断
    const newIsTop = r.y < 0;
    const newIsBottom = r.y >= 0;
    return { ...v, tx: r.x, ty: r.y, tz: r.z, nx: r.nx, ny: r.ny, nz: r.nz, isTop: newIsTop, isBottom: newIsBottom };
  });

  // 鼻端平滑：将 apex 顶点向第一环中心轻微混合，
  // 防止抬头时鼻端三角面被拉成尖刺
  const rows = mesh.rows;
  const ringStart = 1; // col=1 顶点起始索引
  let ringCenterX = 0, ringCenterY = 0, ringCenterZ = 0;
  for (let row = 0; row <= rows; row++) {
    ringCenterX += transformed[ringStart + row].tx;
    ringCenterY += transformed[ringStart + row].ty;
    ringCenterZ += transformed[ringStart + row].tz;
  }
  ringCenterX /= (rows + 1);
  ringCenterY /= (rows + 1);
  ringCenterZ /= (rows + 1);
  const BLEND = 0.15;
  transformed[0].tx = transformed[0].tx * (1 - BLEND) + ringCenterX * BLEND;
  transformed[0].ty = transformed[0].ty * (1 - BLEND) + ringCenterY * BLEND;
  transformed[0].tz = transformed[0].tz * (1 - BLEND) + ringCenterZ * BLEND;

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
export function computeNostrilSize(headX) {
  return Math.max(2.0, headX * 0.045);
}
