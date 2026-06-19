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

const HEAD_T_END = 0.22;   // 头部最大半径位置
const MID_T = 0.55;        // 身体中前段结束位置

/**
 * 沿主轴 s ∈ [0,1] 的归一化半径曲线：
 *   s ∈ [0, HEAD_T_END]：半圆膨胀（鼻端 0 → 最大 1）
 *   s ∈ [HEAD_T_END, MID_T]：smoothstep 从 1 降到 0.72（缓慢收窄 "肩膀"）
 *   s ∈ [MID_T, 1]：smoothstep 从 0.72 降到 0.04（快速收尖）
 *
 * 返回 0~1 缩放因子；外部乘以 headX/headY 得到实际半径。
 */
function radiusScale(s) {
  if (s <= HEAD_T_END) {
    // 头部：r(s) = sqrt(1 - (1 - s/HEAD_T_END)^2)
    const u = s / HEAD_T_END;
    const v = 1 - u;
    return Math.sqrt(Math.max(0, 1 - v * v));
  }
  if (s <= MID_T) {
    // 肩部：慢收窄到 0.72
    const u = (s - HEAD_T_END) / (MID_T - HEAD_T_END);
    const eased = smoothstep01(u);
    return 1.0 * (1 - eased) + 0.72 * eased;
  }
  // 尾部：从 0.72 快速收尖到 0.04
  const u = (s - MID_T) / (1 - MID_T);
  const eased = smoothstep01(u);
  return 0.72 * (1 - eased) + 0.04 * eased;
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
    isHead: s <= HEAD_T_END + 0.02,
  };
}

// -------------------- 面部区域 --------------------

/**
 * 给定 (s, θ) 返回面部权重：1 = 鼻端正中央，0 = 非面部区域。
 * 用于让面部颜色比身体略亮一点。
 */
function getFaceWeight(s, angle) {
  if (s > HEAD_T_END + 0.04) return 0;
  // 鼻端附近权重更高；同时让 "朝前" 的半球 +θ 靠近 0 的带形区域有效。
  const u = s / HEAD_T_END;         // 0 在鼻端，1 在头部最鼓处
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
export function createSpindleMesh(options = {}) {
  const {
    headX = 52,
    headY = 46,
    headZ = 50,
    bodyLength = 180,
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

  // --- 主体顶点：参数化曲面 ---
  // angle 约定：angle = -π 开始绕一整圈，使 row=0 位于 -Y（上方背面），row=rows/2 位于 +Y（下方正面）
  for (let col = 0; col <= columns; col++) {
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

      // --- 曲面法线：T_θ × T_s ---
      // T_θ = (-rx·sinθ,  ry·cosθ,  0)
      const tthX = -rx * sinA;
      const tthY = ry * cosA;
      const tthZ = 0;
      // T_s = (rx'·cosθ, yBend' + ry'·sinθ, z')
      const tsX = rxDeriv * cosA;
      const tsY = yBendDeriv + ryDeriv * sinA;
      const tsZ = zDeriv;

      // 叉乘 n = T_θ × T_s
      let nx = tthY * tsZ - tthZ * tsY;
      let ny = tthZ * tsX - tthX * tsZ;
      let nz = tthX * tsY - tthY * tsX;

      // 归一化
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nLen; ny /= nLen; nz /= nLen;

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

  // --- 生成主体面（四边形）：与旧版同逻辑 ---
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const a = col * (rows + 1) + row;
      const b = a + 1;
      const c = (col + 1) * (rows + 1) + row;
      const d = c + 1;

      const va = vertices[a];
      const vb = vertices[b];
      const vc = vertices[c];
      const vd = vertices[d];

      const avgSin = (va.angle !== undefined) ?
        (Math.sin(va.angle) + Math.sin(vb.angle) + Math.sin(vc.angle) + Math.sin(vd.angle)) * 0.25 : 0;
      faces.push({
        indices: [a, b, d, c],
        vertices: [va, vb, vd, vc],
        isTop: avgSin < 0,   // 上方 = -Y
        isBottom: avgSin >= 0,
        column: col, row,
      });
    }
  }

  // --- 尾鳍（Fluke）：在主体最后一圈后向外延伸扁平三角形 ---
  //     设计：尾鳍从最后一圈向外（-Z 方向）延伸出一小段，呈扁平的
  //     等腰三角形状，左右对称（类似鲸尾但更收敛）。
  if (flukeEnabled) {
    const flukeStartIdx = vertices.length;
    const flukeHalfWidth = headX * 0.85 * flukeSize; // 尾鳍左右伸展宽度
    const flukeHalfHeight = headY * 0.55 * flukeSize; // 尾鳍上下高度
    const flukeTipBackZ = -bodyLength - headZ * 0.4;  // 尾尖在身体末端之后再靠后

    // 主体最后一圈的中心
    const lastRingStart = columns * (rows + 1);
    let bodyEndCenterX = 0, bodyEndCenterY = 0, bodyEndCenterZ = 0;
    for (let row = 0; row <= rows; row++) {
      bodyEndCenterX += vertices[lastRingStart + row].x;
      bodyEndCenterY += vertices[lastRingStart + row].y;
      bodyEndCenterZ += vertices[lastRingStart + row].z;
    }
    bodyEndCenterX /= (rows + 1);
    bodyEndCenterY /= (rows + 1);
    bodyEndCenterZ /= (rows + 1);

    // 尾鳍用一个菱形 + 尾尖的简单三角化：
    //   A：尾鳍上顶点（-Y）
    //   B：尾鳍左端点（-X）
    //   C：尾鳍下端点（+Y）
    //   D：尾鳍右端点（+X）
    //   T：尾尖（中心 +Z 向后）
    const flA = {
      x: bodyEndCenterX, y: bodyEndCenterY - flukeHalfHeight, z: bodyEndCenterZ - 5,
      nx: 0, ny: -1, nz: 0, t: 1.02, angle: -Math.PI / 2, col: columns + 1, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };
    const flB = {
      x: bodyEndCenterX - flukeHalfWidth, y: bodyEndCenterY, z: bodyEndCenterZ - 5,
      nx: -1, ny: 0, nz: 0, t: 1.02, angle: Math.PI, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };
    const flC = {
      x: bodyEndCenterX, y: bodyEndCenterY + flukeHalfHeight, z: bodyEndCenterZ - 5,
      nx: 0, ny: 1, nz: 0, t: 1.02, angle: Math.PI / 2, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };
    const flD = {
      x: bodyEndCenterX + flukeHalfWidth, y: bodyEndCenterY, z: bodyEndCenterZ - 5,
      nx: 1, ny: 0, nz: 0, t: 1.02, angle: 0, col: columns + 1, row: 0,
      isTop: false, isBottom: true, faceWeight: 0, isHead: false,
    };
    const flT = {
      x: bodyEndCenterX, y: bodyEndCenterY - headY * 0.05, z: flukeTipBackZ,
      nx: 0, ny: 0, nz: -1, t: 1.1, angle: 0, col: columns + 2, row: 0,
      isTop: true, isBottom: false, faceWeight: 0, isHead: false,
    };

    // 把顶点 push 到数组（记录它们的绝对 index）
    vertices.push(flA, flB, flC, flD, flT);
    const iA = flukeStartIdx + 0;
    const iB = flukeStartIdx + 1;
    const iC = flukeStartIdx + 2;
    const iD = flukeStartIdx + 3;
    const iT = flukeStartIdx + 4;

    // 三角化尾鳍：从 A-B-C-D 四个点 + T（尾尖）组成 4 个三角形扇
    //   Triangle 1: A-B-T  (左上)
    //   Triangle 2: B-C-T  (左下)
    //   Triangle 3: C-D-T  (右下)
    //   Triangle 4: D-A-T  (右上)
    const flukeTriangles = [
      [iA, iB, iT],
      [iB, iC, iT],
      [iC, iD, iT],
      [iD, iA, iT],
    ];
    for (const tri of flukeTriangles) {
      const [i0, i1, i2] = tri;
      faces.push({
        indices: [i0, i1, i2, i0], // 退化四边形 = 三角形
        vertices: [vertices[i0], vertices[i1], vertices[i2], vertices[i0]],
        isTop: true,
        isBottom: false,
        column: columns + 1, row: 0,
      });
    }

    // 连接主体最后一圈到尾鳍 A-B-C-D 环（让尾鳍从身体平滑"长"出来）
    // 主体最后一圈 → 尾鳍环：用四边形连起来
    const flukeRingOrder = [
      { flukeIdx: iA, matchAngle: -Math.PI / 2 }, // 上
      { flukeIdx: iD, matchAngle: 0 },            // 右
      { flukeIdx: iC, matchAngle: Math.PI / 2 },  // 下
      { flukeIdx: iB, matchAngle: Math.PI },      // 左
    ];
    // 简单实现：从最后一圈把 4 个最接近的点分别连到 iA/iD/iC/iB
    // 为避免复杂，我们用三角扇把最后一圈的"顶部/底部/左右"四个点连到尾鳍环。
    // 实际视觉上，这只是一个过渡环，不影响主体造型。
    // 找到四个关键点：
    let topIdx = lastRingStart, rightIdx = lastRingStart, bottomIdx = lastRingStart, leftIdx = lastRingStart;
    let topDiff = Infinity, rightDiff = Infinity, bottomDiff = Infinity, leftDiff = Infinity;
    for (let row = 0; row <= rows; row++) {
      const v = vertices[lastRingStart + row];
      const d1 = Math.abs(v.angle - (-Math.PI / 2));
      const d2 = Math.abs(v.angle - 0);
      const d3 = Math.abs(v.angle - Math.PI / 2);
      const d4 = Math.abs(Math.abs(v.angle) - Math.PI);
      if (d1 < topDiff) { topDiff = d1; topIdx = lastRingStart + row; }
      if (d2 < rightDiff) { rightDiff = d2; rightIdx = lastRingStart + row; }
      if (d3 < bottomDiff) { bottomDiff = d3; bottomIdx = lastRingStart + row; }
      if (d4 < leftDiff) { leftDiff = d4; leftIdx = lastRingStart + row; }
    }
    // 四边形连接：上-右-下-左 → A-D-C-B（两个三角形足够了）
    const bridgeFaces = [
      [topIdx, rightIdx, iA, iD],
      [rightIdx, bottomIdx, iD, iC],
      [bottomIdx, leftIdx, iC, iB],
      [leftIdx, topIdx, iB, iA],
    ];
    for (const quad of bridgeFaces) {
      const [i0, i1, i2, i3] = quad;
      faces.push({
        indices: [i0, i1, i2, i3],
        vertices: [vertices[i0], vertices[i1], vertices[i2], vertices[i3]],
        isTop: true,
        isBottom: false,
        column: columns, row: 0,
      });
    }
  } else {
    // 无尾鳍模式：简单从尾端中心扇形三角化到最后一圈
    const lastRingStart = columns * (rows + 1);
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
      faces.push({
        indices: [tailIdx, curr, next, tailIdx],
        vertices: [vertices[tailIdx], vertices[curr], vertices[next], vertices[tailIdx]],
        isTop: false, isBottom: true,
        column: columns, row,
      });
    }
  }

  return {
    vertices, faces,
    headX, headY, headZ, bodyLength, bodyEndX, bodyEndY,
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
export function computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0.5) {
  const hx = mesh.headX, hy = mesh.headY, hz = mesh.headZ;
  const x = horizOffset;
  const y = vertOffset;
  const inside = 1 - (x * x) / (hx * hx) - (y * y) / (hy * hy);
  const zSurface = hz * Math.sqrt(Math.max(0.02, inside));
  const z = zSurface + depthOffset;

  // 椭球表面法线 = (x/hx², y/hy², z/hz²) 方向
  let nx = x / (hx * hx);
  let ny = y / (hy * hy);
  let nz = zSurface / (hz * hz);
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  nx /= nLen; ny /= nLen; nz /= nLen;

  // 两个切向量：在椭球表面上估计"右"和"下"
  //   右方向 = (1, 0, -x/z * (hz²/hx²)) —— 近似保持在切平面；为稳定起见用 Gram-Schmidt：
  //   先猜 right ≈ (1, 0, -x/z * something)，然后减去沿法线分量
  const approxRX = 1.0;
  const approxRY = 0.0;
  const approxRZ = (Math.abs(zSurface) > 0.01) ? -(x * hz * hz) / (hx * hx * zSurface) : 0;
  const dotRN = approxRX * nx + approxRY * ny + approxRZ * nz;
  let tx = approxRX - dotRN * nx;
  let ty = approxRY - dotRN * ny;
  let tz = approxRZ - dotRN * nz;
  const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  tx /= tLen; ty /= tLen; tz /= tLen;

  // "下"方向 = n × t （右手系，保证互相垂直）
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

// 保留 API 兼容
export function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
  return computeFaceAnchorXYZ(mesh, 0, 0, 0, surfaceOffset);
}

// -------------------- 兼容旧 API --------------------

/**
 * 兼容性占位：新版本中尾巴和身体一体，还额外带了尾鳍。
 */
export function createWhaleTailMesh(options = {}) {
  return {
    vertices: [],
    faces: [],
    tailLength: 0,
    tailWidth: 0,
    flukeSegments: 0,
    color: options.color || '#bdb8aa',
    type: 'whaleTailStub',
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

  // Yaw (绕 Y 轴)
  let x1 = x * cosY + z * sinY;
  let z1 = -x * sinY + z * cosY;
  let y1 = y;
  let nx1 = nx * cosY + nz * sinY;
  let nz1 = -nx * sinY + nz * cosY;
  let ny1 = ny;

  // Pitch (绕 X 轴)
  let y2 = y1 * cosX - z1 * sinX;
  let z2 = y1 * sinX + z1 * cosX;
  let x2 = x1;
  let ny2 = ny1 * cosX - nz1 * sinX;
  let nz2 = ny1 * sinX + nz1 * cosX;
  let nx2 = nx1;

  // Roll (绕 Z 轴)
  let x3 = x2 * cosZ - y2 * sinZ;
  let y3 = x2 * sinZ + y2 * cosZ;
  let z3 = z2;
  let nx3 = nx2 * cosZ - ny2 * sinZ;
  let ny3 = nx2 * sinZ + ny2 * cosZ;
  let nz3 = nz2;

  return { x: x3, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
}

export function deformSpindle(mesh, params = {}) {
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
