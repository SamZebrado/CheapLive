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
  // 坐标约定（与 _drawMesh 的背面剔除一致）：
  //   摄像机在 +Z 方向，看向原点（-Z 方向）
  //   所以模型的"正面"（鼻端）应该在 +Z（靠近摄像机）
  //   身体和尾巴向 -Z 延伸（远离摄像机）
  //   朝向 +Z 的面：nz > 0，可见
  //   朝向 -Z 的面：nz < 0，被剔除
  //
  // 头部设计（t=0 → t=HEAD_T_END）：圆球形，鼻端钝圆
  //   t=0.00：鼻端中心（突出在最前，z = +headZ*0.98，rx=ry=0）
  //   t≈0.05：第一圈环（z = +headZ*0.92，radius ≈ headX*0.45）
  //   t≈0.25：最大宽度处（z = +headZ*0.35，radius = headX*1.00）
  //   t=0.30：颈端/头后端（z = -headZ*0.10，radius = headX*0.72）
  //
  // 身体设计（t=HEAD_T_END → t=1）：
  //   脊柱向 -Z 延伸 bodyLength 距离
  //   后段向 +X（向右）+ +Y（向下）弯曲，让尾尖在正视角下从头部右下露出
  const HEAD_T_END = 0.30;

  // --- 头部：真正的圆球形（由多段关键节点插值组成）---
  // 用 smoothstep 让半径从 0 平滑过渡到最大再收小
  if (t < HEAD_T_END) {
    const localT = t / HEAD_T_END;  // 0~1 沿头部（从前到后）

    // 定义关键控制点 (localT, rxScale, zScale)：
    //   T=0:   rx=0,    z=+0.98  （鼻端中心，最靠近相机）
    //   T=0.16: rx=0.45, z=+0.92  （第一圈环）
    //   T=0.48: rx=0.85, z=+0.70  （上半段鼓胀）
    //   T=0.75: rx=1.00, z=+0.35  （最大宽度）
    //   T=1.00: rx=0.72, z=-0.10  （颈端/头后端）
    const knots = [
      { t: 0.00, r: 0.00, z: 0.98 },
      { t: 0.16, r: 0.45, z: 0.92 },
      { t: 0.48, r: 0.85, z: 0.70 },
      { t: 0.75, r: 1.00, z: 0.35 },
      { t: 1.00, r: 0.72, z: -0.10 },
    ];
    // 用分段 linear + smoothstep 平滑插值
    let i = 0;
    for (i = 0; i < knots.length - 1; i++) {
      if (localT <= knots[i + 1].t) break;
    }
    const seg = (localT - knots[i].t) / (knots[i + 1].t - knots[i].t);
    const smoothSeg = smoothstep01(seg);
    const rScale = knots[i].r + (knots[i + 1].r - knots[i].r) * smoothSeg;
    const zScale = knots[i].z + (knots[i + 1].z - knots[i].z) * smoothSeg;

    const rx = headX * rScale;
    const ry = headY * rScale;
    const zPos = headZ * zScale;
    const spineX = 0; // 头部保持 X 方向居中
    return { xPos: spineX, zPos, rx, ry, isHead: true };
  }

  // --- 身体：从颈部向 -Z 延伸，尾部向 +X（右）和 +Y（下）弯曲 ---
  const headEndRX = headX * 0.72;
  const headEndRY = headY * 0.72;

  const bodyT = (t - HEAD_T_END) / (1 - HEAD_T_END); // 0~1 沿身体
  const eased = Math.pow(smoothstep01(bodyT), 1.25); // 前段收缩更慢

  const rx = headEndRX * (1 - eased) + bodyEndX * eased;
  const ry = headEndRY * (1 - eased) + bodyEndY * eased;

  // 脊柱位置：从 -headZ*0.10 继续向 -Z 延伸
  const headZBack = -headZ * 0.10;
  const zPos = headZBack - bodyLength * bodyT;

  // 尾巴弯曲：从 bodyT≈0.62 开始向 +X 弯，向 +Y 轻微向下弯
  // 让尾尖中心 x ≈ 68，y ≈ 22（在头部右下露出）
  const tailBendStartT = 0.62;
  const tailBend = smoothstep01(Math.max(0, (bodyT - tailBendStartT) / (1 - tailBendStartT)));
  const tailTipOffsetX = headX * 0.97;  // ≈ 68
  const tailTipOffsetY = headY * 0.38;  // ≈ 22
  const spineX = tailTipOffsetX * tailBend * tailBend;
  const spineY = tailTipOffsetY * tailBend * tailBend;

  return { xPos: spineX, yPos: spineY, zPos, rx, ry, isHead: false };
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

      // 椭圆截面，叠加脊柱的 X/Y 偏移（尾巴的弯曲）
      const spineY = cross.yPos || 0;
      const x = cross.xPos + rx * sinA;  // sinA 在 angle=±PI/2 处最大 → 左右
      const y = spineY + ry * cosA;   // cosA 在 angle=0/PI 处最大 → 上下
      const z = cross.zPos;

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

  // --- 尾端封口（Tail Cap）：从尾端中心顶点扇形三角化到最后一圈 ---
  // 尾端中心：取最后一圈顶点的平均
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
    nx: 0, ny: 0, nz: -1,  // 尾端法线朝 -Z（远离摄像机）
    t: 1, angle: 0, col: columns, row: -1,
    isTop: false, isBottom: true,
    faceWeight: 0,
    isHead: false,
  });
  // 扇形三角化：[tailIdx, curr, next, tailIdx]
  for (let row = 0; row < rows; row++) {
    const curr = lastRingStart + row;
    const next = lastRingStart + row + 1;
    faces.push({
      indices: [tailIdx, curr, next, tailIdx],
      vertices: [vertices[tailIdx], vertices[curr], vertices[next], vertices[tailIdx]],
      isTop: false,
      isBottom: true,
      column: columns, row,
    });
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
export function computeFaceAnchorXYZ(mesh, _, horizOffset, vertOffset, depthOffset = 0.5) {
  // 五官锚定在头部前表面。用椭球方程求正确的 z：
  //   (x/hx)^2 + (y/hy)^2 + (z/hz)^2 = 1
  //   z = hz * sqrt(1 - (x/hx)^2 - (y/hy)^2)
  // 然后再沿法线朝摄像机方向偏移 depthOffset（避免 z-fighting）
  const hx = mesh.headX, hy = mesh.headY, hz = mesh.headZ;
  const x = horizOffset;
  const y = vertOffset;
  const inside = 1 - (x * x) / (hx * hx) - (y * y) / (hy * hy);
  const zSurface = hz * Math.sqrt(Math.max(0.01, inside));
  const z = zSurface + depthOffset;

  return {
    x, y, z,
    nx: 0, ny: 0, nz: 1, // 正面朝 +Z（摄像机方向）
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
