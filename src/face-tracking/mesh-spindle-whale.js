/**
 * Mesh Sacabambaspis (萨卡班甲鱼) — 鱼雷形：圆球形头部 + 流线型收窄身体 + 尾鳍
 *
 * 坐标约定（面向摄像机）：
 *   - X：屏幕水平（右为正）
 *   - Y：屏幕垂直（下为正，Canvas 坐标）
 *   - Z：屏幕深度（+z = 朝向摄像机/近，-z = 远离摄像机/远）
 *   - 身体主轴沿 Z：鼻端在 +z，尾端在 -z
 *   - angle 环绕角度：angle = 0 在 +Y（下），逆时针环绕
 *   - angle = PI/2 在 -X（左），angle = -PI/2 在 +X（右）
 *
 * 投影到屏幕：
 *   - screenX = originX + tx * scale
 *   - screenY = originY + ty * scale
 *   - depth = tz（越大越近，最后画）
 *
 * 设计目标（鱼雷形状）：
 *   - 头部：接近完美的圆球形，从鼻端快速膨胀到最大半径
 *   - 身体：最大半径之后**平滑、缓慢地收窄**（前段慢、后段快），形成流线型
 *   - 尾鳍：在身体后段向外延伸出一个扁平的三角形尾鳍，尖尾收尾
 *   - 整体比例：头直径 : 身体长度 ≈ 1 : 3（鱼雷/潜艇比例）
 *   - 尾尖向上轻微翘起（萨卡班甲鱼的尾鳍特征）
 *
 * 说明：不依赖 Live2D Cubism；为程序化 Canvas 2D 网格渲染器。
 */

// -------------------- 参数与辅助 --------------------

// smoothstep：对 t 做平滑处理（0→1 间自然过渡），用于 taper 和 blend
function smoothstep01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// 从圆方程得到"完美半圆"膨胀曲线：r = sqrt(1 - (1 - t)^2)
// 用于头部区域：鼻端 r=0，t=HEAD_T_END 时 r=headX（最大半径）
function semicircleExpansion(tLocal) {
  // tLocal: 0 鼻端，1 最大半径处
  const s = 1 - tLocal;
  return Math.sqrt(Math.max(0, 1 - s * s));
}

// -------------------- 脊柱与截面 --------------------

/**
 * 给定沿脊柱的参数 t ∈ [0, 1]，返回 (xPos, yPos, zPos, rx, ry, isHead)。
 *
 * 鱼雷形设计（关键参数比例）：
 *   t=0 ~ HEAD_T_END：头部 —— 完美的圆球形（按圆方程膨胀到最大半径）
 *   t=HEAD_T_END ~ TAIL_T_START：身体 —— 缓慢平滑收窄（前段慢、后段快）
 *   t=TAIL_T_START ~ 1：尾端收尖 —— 快速收尖到尾尖，同时脊柱向 +Y 上方微翘
 *
 *   HEAD_T_END = 0.22（头部占比 22%）：头直径≈104，身体长度≈180 → 头:身 ≈ 1:3
 */
function getSpineAndRadius(t, headX, headY, headZ, bodyLength, bodyEndX, bodyEndY) {
  // 坐标约定：
  //   摄像机在 +Z 方向，看向原点（-Z 方向）
  //   模型的"正面"（鼻端）应该在 +Z（靠近摄像机）
  //   身体和尾巴向 -Z 延伸（远离摄像机）
  //   朝向 +Z 的面：nz > 0，可见
  //   朝向 -Z 的面：nz < 0，被剔除

  const HEAD_T_END = 0.22;      // 头部/最大半径位置
  const TAIL_T_START = 0.65;    // 尾端快速收尖的起点
  const TIP_T = 1.0;

  // --- 头部：完美圆球形（按半圆方程膨胀） ---
  //   t=0:   鼻端（z=+headZ*0.98, rx=0）
  //   t=0.22:最大半径处（z≈+headZ*0.0, rx=headX）
  if (t <= HEAD_T_END) {
    const localT = t / HEAD_T_END; // 0~1 沿头部
    const rScale = semicircleExpansion(localT);  // 完美半圆膨胀
    // z 从 +headZ (鼻端) 线性退到 0 (头部最鼓处)
    const zScale = 1.0 - localT * 1.0;

    const rx = headX * rScale;
    const ry = headY * rScale;
    const zPos = headZ * zScale;
    return { xPos: 0, yPos: 0, zPos, rx, ry, isHead: true };
  }

  // --- 身体 + 尾端 ---
  // bodyT: 0 在 HEAD_T_END（最大半径），1 在尾尖
  const bodyT = (t - HEAD_T_END) / (1 - HEAD_T_END);

  // 1) 半径曲线（平滑收窄 —— 鱼雷风格）：
  //    前段（0~0.55）：缓慢收窄到 0.65 * headX
  //    后段（0.55~1）：加速收尖到 bodyEndX/Y
  //    整体用 smoothstep 的指数曲线让过渡更自然
  let rxFinal, ryFinal;
  if (bodyT <= 0.55) {
    // 前段：慢收窄
    const localT = bodyT / 0.55;
    const eased = 1 - Math.pow(1 - localT, 1.8); // 上凸曲线 = 先快后慢
    const target = 0.65; // 保留 65% 最大半径
    const scale = 1 * (1 - eased) + target * eased;
    rxFinal = headX * scale;
    ryFinal = headY * scale;
  } else {
    // 后段：快速收尖
    const localT = (bodyT - 0.55) / 0.45;
    const eased = Math.pow(localT, 1.5); // 下凸 = 先慢后快，末端加速
    const startRX = headX * 0.65;
    const startRY = headY * 0.65;
    rxFinal = startRX * (1 - eased) + bodyEndX * eased;
    ryFinal = startRY * (1 - eased) + bodyEndY * eased;
  }

  // 2) 脊柱 z：从头部后端（z ≈ 0）线性向 -Z 延伸 bodyLength
  const zPos = 0 - bodyLength * bodyT;

  // 3) 脊柱 y：尾端向 -Y（屏幕上方）轻微翘起
  //    从 bodyT=0.7 开始向上弯，尾尖抬高 ≈ headY*0.45
  const tailBendStartT = 0.7;
  const tailBend = smoothstep01(
    Math.max(0, (bodyT - tailBendStartT) / (1 - tailBendStartT))
  );
  const tailTipOffsetY = -headY * 0.45; // 向上（-Y）翘
  const spineY = tailTipOffsetY * tailBend * tailBend; // 平方让弯曲更平滑

  // 脊柱保持左右对称（spineX = 0）
  return { xPos: 0, yPos: spineY, zPos, rx: rxFinal, ry: ryFinal, isHead: false };
}

// -------------------- 面部区域 --------------------

/**
 * 判断给定 (t, angle) 是否位于头部正面区域（用于给面部着色）。
 * 返回 0~1 的软权重：1 = 面部中心，0 = 非面部。
 */
function getFaceWeight(t, angle) {
  if (t > 0.25) return 0; // 头部区域外
  // 面部区域：靠近鼻端（t < 0.22）
  const distFromNose = t / 0.22;
  const tWeight = Math.exp(-distFromNose * distFromNose * 3.0);
  return tWeight;
}

// -------------------- 主网格生成 --------------------

/**
 * 创建萨卡班甲鱼鱼雷形网格：圆球形头 + 平滑收窄身体 + 尾鳍。
 *
 * 参数：
 *   headX/headY/headZ — 头部三个方向半径
 *   bodyLength         — 身体长度（沿 -z 方向延伸的距离，不包括尾鳍延伸）
 *   bodyEndX/bodyEndY  — 身体末端半径（越小尾巴越尖）
 *   flukeEnabled       — 是否生成尾鳍（默认 true）
 *   flukeSize          — 尾鳍的左右/上下伸展倍数（默认 1.0）
 */
export function createSpindleMesh(options = {}) {
  const {
    headX = 52,
    headY = 46,
    headZ = 50,
    bodyLength = 180,      // 鱼雷形：身体更长
    bodyEndX = 5,          // 末端更尖
    bodyEndY = 4,
    columns = 30,          // 沿脊柱的环数更多，让收窄更平滑
    rows = 18,             // 每环更多分段
    flukeEnabled = true,
    flukeSize = 1.2,
    topColor = '#bdb8aa',
    bottomColor = '#f2f1ea',
    faceTopColor = '#c8c2b4',
    faceBottomColor = '#fff8ee',
  } = options;

  const vertices = [];
  const faces = [];

  // --- 生成主体顶点：沿脊柱 t 分布，绕 angle 环形 ---
  for (let col = 0; col <= columns; col++) {
    const t = col / columns;
    const cross = getSpineAndRadius(t, headX, headY, headZ, bodyLength, bodyEndX, bodyEndY);

    for (let row = 0; row <= rows; row++) {
      // angle: 0 在 +Y（下），绕主轴环绕
      const angle = -Math.PI + (row / rows) * 2 * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 椭圆截面，叠加脊柱的 X/Y 偏移（尾巴的弯曲）
      const x = cross.xPos + cross.rx * sinA;
      const y = cross.yPos + cross.ry * cosA;
      const z = cross.zPos;

      // 椭圆外法线（用于光照和背面剔除）—— 简化为沿截面径向向外
      const nxRaw = sinA / Math.max(cross.rx, 0.001);
      const nyRaw = cosA / Math.max(cross.ry, 0.001);
      const nLen = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw) || 1;
      const nx = nxRaw / nLen;
      const ny = nyRaw / nLen;
      const nz = 0; // 在变形后根据脊柱方向会自然考虑

      // 面部权重 & 上下
      const fw = getFaceWeight(t, angle);
      const isTop = cosA < 0;

      vertices.push({
        x, y, z,
        nx, ny, nz,
        t, angle, col, row,
        isTop, isBottom: !isTop,
        faceWeight: fw,
        isHead: cross.isHead,
      });
    }
  }

  // --- 生成主体面（四边形） ---
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

      const avgCos = (Math.cos(va.angle) + Math.cos(vb.angle) + Math.cos(vc.angle) + Math.cos(vd.angle)) / 4;
      faces.push({
        indices: [a, b, d, c],
        vertices: [va, vb, vd, vc],
        isTop: avgCos < 0,
        isBottom: avgCos >= 0,
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
 * 简化版锚点计算：五官锚定在头部前表面（椭球表面）。
 *
 * 输入：
 *   horizOffset —— 水平偏移（X 方向，正值向右）
 *   vertOffset  —— 垂直偏移（Y 方向，正值向下）
 *   depthOffset —— 沿深度的偏移（用于从表面外推一点，避免 z-fighting）
 *
 * 返回模型空间下的 (x, y, z) 和法线方向。
 */
export function computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0.5) {
  // 五官锚定在头部前表面。用椭球方程求正确的 z：
  //   (x/hx)^2 + (y/hy)^2 + (z/hz)^2 = 1
  //   z = hz * sqrt(1 - (x/hx)^2 - (y/hy)^2)
  const hx = mesh.headX, hy = mesh.headY, hz = mesh.headZ;
  const x = horizOffset;
  const y = vertOffset;
  const inside = 1 - (x * x) / (hx * hx) - (y * y) / (hy * hy);
  const zSurface = hz * Math.sqrt(Math.max(0.01, inside));
  const z = zSurface + depthOffset;

  return {
    x, y, z,
    nx: 0, ny: 0, nz: 1,
    tangentX: 1, tangentY: 0, tangentZ: 0,
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
