/**
 * Mesh Sacabambaspis (萨卡班甲鱼) — 简化版：圆球形头部 + 平滑收细身体
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
 * 设计目标：
 *   - 头部：略微压扁的圆椭球，正面对观众
 *   - 身体：从头后方（-z 方向）平滑收细到尾巴
 *   - 无突兀的角度转折，整体像一条"大头鱼"
 *
 * 说明：不依赖 Live2D Cubism；为程序化 Canvas 2D 网格渲染器。
 */

// -------------------- 参数与辅助 --------------------

// smoothstep：对 t 做平滑处理（0→1 间自然过渡），用于 taper 和 blend
function smoothstep01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// -------------------- 脊柱与截面 --------------------

/**
 * 给定沿脊柱的参数 t ∈ [0, 1]，返回 (zPos, rx, ry)：
 *   zPos —— 该截面的脊柱 z 坐标（沿屏幕深度方向）
 *   rx   —— 椭圆截面的 X 半径（左右宽度）
 *   ry   —— 椭圆截面的 Y 半径（上下高度）
 *
 * t = 0：鼻端（最前，+z 方向）
 * t = 1：尾端（最后，-z 方向）
 *
 * 几何设计：
 *   0.0 ~ 0.35：头部区域 —— 圆球形/椭球
 *   0.35 ~ 1.0：身体区域 —— 从头后方平滑收细到尾巴
 */
function getSpineAndRadius(t, headX, headY, headZ, bodyLength, bodyEndX, bodyEndY) {
  // --- 头部 ---
  // t = 0 (最前)：圆钝鼻端，半径约 0.35*head
  // t ≈ 0.12：达到最大宽度（≈ 1.0*head）
  // t = HEAD_T_END：头部后端/颈部，半径约 0.75*head
  //
  // 使用两段平滑函数：从鼻端圆滑鼓胀到最大，再圆滑收缩到颈部。
  const HEAD_T_END = 0.30;

  if (t < HEAD_T_END) {
    const zFront = headZ * 0.95;
    const zBack  = -headZ * 0.10;
    const localT = t / HEAD_T_END;  // 0~1 沿头部
    const zPos = zFront + (zBack - zFront) * localT;

    // 两段曲线：前 45% 为鼓胀段（从 0.35 → 1.0），后 55% 为收缓段（1.0 → 0.75）
    const mid = 0.45;
    const growShape = Math.sin((localT / mid) * Math.PI * 0.5); // 0 → 1
    const shrinkShape = Math.cos(((localT - mid) / (1 - mid)) * Math.PI * 0.5); // 1 → 0

    let shape;
    if (localT < mid) {
      shape = 0.35 + (1.00 - 0.35) * growShape;
    } else {
      shape = 1.00 * (1 - shrinkShape) + 0.75 * shrinkShape;
    }

    const rx = headX * shape;
    const ry = headY * shape;    // headY 已在构造函数中设置略小，实现自然的椭圆形头部

    return { zPos, rx, ry, isHead: true };
  }

  // --- 身体：从颈部平滑收窄到尾端 ---
  // 头部终点（t = HEAD_T_END）的半径约 0.75*headX/Y
  const headEndRX = headX * 0.75;
  const headEndRY = headY * 0.75;

  const bodyT = (t - HEAD_T_END) / (1 - HEAD_T_END); // 0~1
  // 平滑收细：前期保留较多体积，后期快速收窄
  const eased = Math.pow(smoothstep01(bodyT), 0.7);

  const rx = headEndRX * (1 - eased) + bodyEndX * eased;
  const ry = headEndRY * (1 - eased) + bodyEndY * eased;

  const headZBack = -headZ * 0.10;
  const zPos = headZBack - bodyLength * bodyT;
  return { zPos, rx, ry, isHead: false };
}

// -------------------- 面部区域 --------------------

/**
 * 判断给定 (t, angle) 是否位于头部正面区域（用于给面部着色）。
 * 返回 0~1 的软权重：1 = 面部中心，0 = 非面部。
 */
function getFaceWeight(t, angle) {
  if (t > 0.3) return 0; // 头部区域外
  // 检查是否朝摄像机方向（正面）
  // angle = PI/2 → 朝 -X（左）
  // angle = -PI/2 → 朝 +X（右）
  // angle = 0 → 朝 +Y（下）
  // 面部应该在前端，面部区域通过 angle 的中间部分来决定
  // 简单处理：在 t < 0.2 区域给 faceWeight

  // 面部区域定义：靠近鼻端（t < 0.25），并位于"正面"（angle 靠近中线）
  const distFromNose = t / 0.25; // 0 鼻端，1 头部中段
  if (distFromNose > 1.5) return 0;
  const tWeight = Math.exp(-distFromNose * distFromNose * 2.5);

  // angle 加权：更偏向正面（angle 靠近 0 的圆周区域）
  // 实际上整个前端环形区域都算面部的一部分
  const angleWeight = 1.0;

  return tWeight * angleWeight;
}

// -------------------- 网格生成 --------------------

/**
 * 创建萨卡班甲鱼网格（简化版：圆头 + 平滑收细身体）。
 *
 * 参数：
 *   headX    — 头部左右半径
 *   headY    — 头部上下半径
 *   headZ    — 头部前后半径
 *   bodyLength — 身体长度（沿 -z 方向延伸的距离）
 *   bodyEndX  — 身体末端左右半径（越小尾巴越细）
 *   bodyEndY  — 身体末端上下半径
 */
export function createSpindleMesh(options = {}) {
  const {
    headX = 52,
    headY = 46,
    headZ = 48,
    bodyLength = 120,
    bodyEndX = 6,
    bodyEndY = 5,
    columns = 28,
    rows = 16,
    topColor = '#bdb8aa',
    bottomColor = '#f2f1ea',
    faceTopColor = '#c8c2b4',
    faceBottomColor = '#fff8ee',
  } = options;

  const vertices = [];
  const faces = [];

  // --- 生成顶点：沿脊柱 t 分布，绕 angle 环形 ---
  for (let col = 0; col <= columns; col++) {
    const t = col / columns;
    const cross = getSpineAndRadius(t, headX, headY, headZ, bodyLength, bodyEndX, bodyEndY);
    const zPos = cross.zPos;
    const rx = cross.rx;
    const ry = cross.ry;

    for (let row = 0; row <= rows; row++) {
      // angle: 0 在 +Y（下），顺时针/逆时针环绕
      const angle = -Math.PI + (row / rows) * 2 * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 椭圆截面
      const x = rx * sinA;  // sinA 在 angle=±PI/2 处最大 → 左右
      const y = ry * cosA;   // cosA 在 angle=0/PI 处最大 → 上下
      const z = zPos;

      // 椭圆外法线（用于光照和背面剔除）
      const nxRaw = sinA / Math.max(rx, 0.001);
      const nyRaw = cosA / Math.max(ry, 0.001);
      const nzRaw = 0;
      const nLen = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw + nzRaw * nzRaw) || 1;
      // 让法线指向"向外 + 稍微朝向摄像机方向"，通过 cross product 计算正确方向
      const nx = nxRaw / nLen;
      const ny = nyRaw / nLen;
      const nz = 0; // 初始 z 法线为 0；在变形后会自动考虑

      // 面部权重
      const fw = getFaceWeight(t, angle);

      // 判断上下
      const isTop = cosA < 0; // angle 在上方（y 负）时为顶
      const isBottom = cosA >= 0;

      // 保存 head/body 相关参数用于外部引用
      const vMesh = { headX, headY, headZ, bodyLength };

      vertices.push({
        x, y, z,
        nx, ny, nz,
        t, angle, col, row,
        isTop, isBottom,
        faceWeight: fw,
        isHead: cross.isHead,
      });
    }
  }

  // --- 生成面（四边形） ---
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
 * 简化版锚点计算：五官锚定在头部前表面。
 *
 * 输入：
 *   horizOffset —— 水平偏移（X 方向，正值向右）
 *   vertOffset  —— 垂直偏移（Y 方向，正值向下）
 *   depthOffset —— 沿深度的偏移（用于从表面外推一点，避免 z-fighting）
 *
 * 返回模型空间下的 (x, y, z) 和法线方向。
 */
export function computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0) {
  // 面部位于头部前表面：z ≈ +headZ * 0.75 处
  const zFront = mesh.headZ * 0.75;
  const xBase = horizOffset;
  const yBase = vertOffset;

  // 将锚点推到椭球表面（近似），并沿法线略外推
  const zLocal = zFront + depthOffset;

  return {
    x: xBase,
    y: yBase,
    z: zLocal,
    nx: 0,
    ny: 0,
    nz: 1, // 正面朝 +Z（摄像机方向）
    tangentX: 1, tangentY: 0, tangentZ: 0,
    faceWeight: 1.0,
  };
}

// 保留 API 兼容（原 computeFaceAnchor 用 bodyT 和 surfAngle）
export function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
  return computeFaceAnchorXYZ(mesh, 0, 0, 0, surfaceOffset);
}

// -------------------- 兼容旧 API --------------------

/**
 * 兼容性占位：新模型中尾巴和身体一体，不再需要独立的尾部 mesh。
 * 返回一个空 mesh，避免旧代码抛出 "does not provide an export" 错误。
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
/**
 * 注意：旋转约定与 _transformAnchor 保持一致，确保网格与五官锚点
 * 在相同旋转下一致。
 */
function applyYawPitchRoll(x, y, z, nx, ny, nz, params) {
  const { angleY = 0, angleX = 0, angleZ = 0 } = params;
  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  // Yaw (绕 Y 轴) — 与 _transformAnchor 保持一致
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
