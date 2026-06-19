/**
 * Mesh Sacabambaspis (萨卡班甲鱼) - 圆盾形头部 + 细尾网格生成器
 *
 * 语义约定：
 *   - 主轴沿 X 方向。
 *   - t=0 为鼻端（头部），t=1 为尾端。
 *   - 摄像机朝向 +Z，近侧表面法线指向 +Z。
 *   - angle=0 对应下方（肚子/底部），angle=±π 为上方（背）。
 *   - 面部区域位于 headT 区间的近侧 (angle=PI/2)。
 *
 * 形状设计：
 *   - 头部为大而扁平的圆盾形 / 水滴形（前宽后窄）
 *   - Y 方向（半宽）显著大于 Z 方向（深度）→ 扁平椭圆截面
 *   - 头部占身体约 55% 长度，尾部迅速收细
 *
 * 说明：不依赖 Live2D Cubism；为程序化 Canvas 2D 网格渲染。
 */

// -------------------- 基础几何参数函数 --------------------

function getSpineX(t, headR, bodyLength) {
  // 脊柱位置：头部在负数一侧（靠近摄像机负 X 端），尾部在 +X。
  // 头盾占身体的大部分比例，萨卡班甲鱼以头部为主。
  const p0 = -headR * 0.15;          // 鼻端（略向前凸）
  const p3 = bodyLength + 20;         // 尾端
  const cp1 = headR * 0.1;
  const cp2 = bodyLength * 0.55;      // 头盾后缘在 55% 位置
  const mt = 1 - t;
  return (mt * mt * mt) * p0
       + 3 * (mt * mt) * t * cp1
       + 3 * mt * (t * t) * cp2
       + (t * t * t) * p3;
}

/**
 * 水滴形截面半宽函数（y 方向：屏幕水平方向，即身体的左右宽度）。
 * 以 bodyWidth 为基础尺寸，而不是 headR。
 *   - t=0：鼻端（较小，圆润过渡）
 *   - t≈0.15：达到最大宽度（圆盾形头部的中心）
 *   - t≈0.15-0.60：缓慢收窄（头盾主体）
 *   - t≈0.60-1.0：快速收细为细尾
 */
function getBodyWidth(t, headR, bodyWidth, bodyLength) {
  const maxW = bodyWidth * 1.0;
  const shieldBaseW = bodyWidth * 0.45;
  const tailBaseW = bodyWidth * 0.16;
  const tailTipW = bodyWidth * 0.04;

  let result;
  if (t < 0.15) {
    // 头盾前段：横向放大 12%，让头盾更宽更扁
    const k = t / 0.15;
    const eased = Math.sin(k * Math.PI * 0.5);
    result = maxW * (0.50 + 0.50 * eased) * 1.12;
  } else if (t < 0.16) {
    // 过渡：保持放大状态
    result = maxW * 1.12;
  } else if (t < 0.28) {
    // 头后 pinch：额外压缩到 93%，形成颈缩感
    const k = (t - 0.16) / 0.12;
    const base = maxW - (maxW - shieldBaseW) * (k * k);
    result = base * (1.0 - (1.0 - 0.93) * k);
  } else if (t < 0.50) {
    // 躯干前半段：从 pinch 后快速收细
    const k = (t - 0.28) / 0.22;
    const eased = 0.5 * (1 - Math.cos(k * Math.PI));
    result = shieldBaseW - (shieldBaseW - bodyWidth * 0.28) * eased;
  } else if (t < 0.75) {
    // 尾柄后半段：继续收细到 16%
    const k = (t - 0.50) / 0.25;
    const eased = 0.5 * (1 - Math.cos(k * Math.PI * 0.9));
    result = (bodyWidth * 0.28) - ((bodyWidth * 0.28) - tailBaseW) * eased;
  } else {
    // 尾尖：快速收细
    const k = (t - 0.75) / 0.25;
    result = tailBaseW * (1 - k * k) + tailTipW * (k * k);
  }
  return result;
}

/**
 * 水滴形截面深度函数（z 方向：比宽度更小，让头盾更扁平）。
 * 前段纵向压缩 90%，让头部更扁。
 */
function getBodyDepth(t, headR, bodyDepth, bodyLength) {
  const maxD = bodyDepth * 1.0;
  const shieldBaseD = bodyDepth * 0.42;
  const tailBaseD = bodyDepth * 0.14;
  const tailTipD = bodyDepth * 0.04;

  let result;
  if (t < 0.15) {
    // 头盾前段：纵向压缩 90%，让头盾更扁
    const k = t / 0.15;
    const eased = Math.sin(k * Math.PI * 0.5);
    result = maxD * (0.50 + 0.50 * eased) * 0.90;
  } else if (t < 0.16) {
    result = maxD * 0.90;
  } else if (t < 0.28) {
    // 头后 pinch：深度压缩更明显到 88%
    const k = (t - 0.16) / 0.12;
    const base = maxD - (maxD - shieldBaseD) * (k * k);
    result = base * (1.0 - (1.0 - 0.88) * k);
  } else if (t < 0.50) {
    const k = (t - 0.28) / 0.22;
    const eased = 0.5 * (1 - Math.cos(k * Math.PI));
    result = shieldBaseD - (shieldBaseD - bodyDepth * 0.25) * eased;
  } else if (t < 0.75) {
    const k = (t - 0.50) / 0.25;
    const eased = 0.5 * (1 - Math.cos(k * Math.PI * 0.9));
    result = (bodyDepth * 0.25) - ((bodyDepth * 0.25) - tailBaseD) * eased;
  } else {
    const k = (t - 0.75) / 0.25;
    result = tailBaseD * (1 - k * k) + tailTipD * (k * k);
  }
  return result;
}

/**
 * 面部区域：判断给定 (t, angle) 是否位于头部正面/近侧。
 * 坐标约定：angle = PI/2 朝摄像机（+Z 方向）；
 *   angle = 0      指向 Y 正方向（身体侧前）；
 *   angle = PI     指向 Y 负方向（身体另一侧）。
 *
 * 返回 0~1 的软权重：1 为面部中心，0 为非面部区域。
 * 使用最短弧角距离，避免 ±π 边界错误。
 */
function shortestAngleDist(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function getFaceWeight(t, angle) {
  const FACE_CENTER_T = 0.12;
  const FACE_CENTER_ANGLE = Math.PI / 2; // 朝摄像机
  const tHalf = 0.10;
  const angleHalf = 0.55; // ~31°

  const dt = (t - FACE_CENTER_T) / tHalf;
  const da = shortestAngleDist(angle, FACE_CENTER_ANGLE) / angleHalf;

  const val = Math.exp(-(dt * dt + da * da));

  // 只在 t 和 angle 的合理范围内生效；背部（angle 接近 0 或 PI）不参与。
  if (t < 0.02 || t > 0.28) return 0;
  // 排除背部：angle 接近 0 或 PI 时权重为 0
  const awayFromFace = Math.abs(shortestAngleDist(angle, FACE_CENTER_ANGLE));
  if (awayFromFace > Math.PI * 0.7) return 0;
  return val;
}

// -------------------- 网格生成 --------------------

export function createSpindleMesh(options = {}) {
  const {
    headR = 95,
    bodyLength = 150,
    bodyWidth = 52,
    bodyDepth = 31,
    columns = 26,
    rows = 14,
    topColor = '#bdb8aa',       // 背部/上半灰色
    bottomColor = '#f2f1ea',    // 腹部/下半白色
    faceTopColor = '#c8c2b4',   // 面部区域略暖
    faceBottomColor = '#fff8ee',
  } = options;

  const vertices = [];
  const faces = [];

  // t ∈ [0, 1]，沿脊柱
  for (let col = 0; col <= columns; col++) {
    const t = col / columns;
    const spineX = getSpineX(t, headR, bodyLength);
    const bw = getBodyWidth(t, headR, bodyWidth, bodyLength);
    const bd = getBodyDepth(t, headR, bodyDepth, bodyLength);

    // angle ∈ [-π, +π]，环绕身体。angle=0 指向下方（肚子）。
    for (let row = 0; row <= rows; row++) {
      const angle = -Math.PI + (row / rows) * 2 * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 椭圆截面：y = bw * cos(angle), z = bd * sin(angle)
      const localY = bw * cosA;
      const localZ = bd * sinA;
      const x = spineX;

      // 椭圆外法线（非单位法，后续再归一化）
      const rawNx = 0;
      const rawNy = cosA / Math.max(bw, 0.001);
      const rawNz = sinA / Math.max(bd, 0.001);
      const rawNlen = Math.sqrt(rawNx * rawNx + rawNy * rawNy + rawNz * rawNz) || 1;
      let nx = rawNx / rawNlen;
      let ny = rawNy / rawNlen;
      let nz = rawNz / rawNlen;

      // 面部区域的额外凸起：让头看起来更圆。
      const fw = getFaceWeight(t, angle);
      if (fw > 0.1) {
        // 在法向微凸，使面部区域更饱满但连续。
        const bulge = 2.5 * fw;
        // localZ += bulge * sign(angle near 0)；实际操作在表面点上做微位移。
        // 直接沿局部 (y,z) 平面外推：
        const radialLen = Math.max(1e-3, Math.sqrt(localY * localY + localZ * localZ));
        const ry = localY / radialLen;
        const rz = localZ / radialLen;
        const xNew = x;
        const yNew = localY + ry * bulge;
        const zNew = localZ + rz * bulge;

        vertices.push({
          x: xNew, y: yNew, z: zNew,
          nx, ny, nz,
          t, angle, col, row,
          isTop: cosA < 0,
          isBottom: cosA >= 0,
          faceWeight: fw,
        });
      } else {
        vertices.push({
          x, y: localY, z: localZ,
          nx, ny, nz,
          t, angle, col, row,
          isTop: cosA < 0,
          isBottom: cosA >= 0,
          faceWeight: fw,
        });
      }
    }
  }

  // 生成面（四边形）
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

      // 判断面属于上半还是下半：基于平均 cos(angle)
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
    vertices,
    faces,
    headR, bodyLength, bodyWidth, bodyDepth,
    columns, rows,
    topColor, bottomColor, faceTopColor, faceBottomColor,
    type: 'spindle',
  };
}

// -------------------- 面部锚点 --------------------

/**
 * 给定身体参数坐标 (bodyT, surfAngle) 和表面偏移，计算模型空间下
 * 五官锚点的位置 + 法线 + 局部切线。
 *
 * 保留原 API 以兼容现有测试代码，不用于正式渲染。
 *
 * @param {Object} mesh
 * @param {number} bodyT
 * @param {number} surfAngle
 * @param {number} [surfaceOffset]
 */
export function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
  const { headR, bodyLength, bodyWidth, bodyDepth } = mesh;
  const spineX = getSpineX(bodyT, headR, bodyLength);
  const bw = getBodyWidth(bodyT, headR, bodyWidth, bodyLength);
  const bd = getBodyDepth(bodyT, headR, bodyDepth, bodyLength);

  const cosA = Math.cos(surfAngle);
  const sinA = Math.sin(surfAngle);

  let y = bw * cosA;
  let z = bd * sinA;

  // 椭圆外法线
  const nyLen = Math.sqrt((cosA * cosA) / (bw * bw) + (sinA * sinA) / (bd * bd)) || 1;
  const ny = (cosA / bw) / nyLen;
  const nz = (sinA / bd) / nyLen;

  // 表面偏移（法线方向外推）
  if (surfaceOffset !== 0) {
    y += ny * surfaceOffset;
    z += nz * surfaceOffset;
  }

  return {
    x: spineX, y, z,
    nx: 0, ny, nz,
    tangentX: 1, tangentY: 0, tangentZ: 0,
    faceWeight: getFaceWeight(bodyT, surfAngle),
  };
}

/**
 * 面部局部坐标系锚点生成。
 *
 * 定义：
 *   faceCenter = (spineX(faceT), 0, bodyDepth(faceT)) —— 脸部表面中心，朝 +z
 *   horizontal = (1, 0, 0) —— 沿脊柱方向 → 屏幕水平方向
 *   vertical = (0, 1, 0) —— 沿横截面 y 方向 → 屏幕垂直方向
 *   normal = (0, 0, 1) —— 朝摄像机方向
 *
 * 每个五官由 (horizOffset, vertOffset) 生成：
 *   position = faceCenter + horizontal * horizOffset + vertical * vertOffset
 *
 * 视觉不变量：
 *   - 左右眼 |horizOffset| 相同 → 屏幕 x 有明确间距
 *   - 左右眼 vertOffset 相同 → 屏幕 y 等高
 *   - 嘴 vertOffset > 眼 vertOffset → 嘴在眼下
 *   - 眉 vertOffset < 眼 vertOffset → 眉在眼上
 *
 * @param {Object} mesh - createSpindleMesh 的返回值
 * @param {number} faceT - 面部中心的 bodyT（沿脊柱位置）
 * @param {number} horizOffset - 水平偏移（像素，模型坐标系）
 * @param {number} vertOffset - 垂直偏移（像素，模型坐标系）；正值向下
 * @param {number} [surfaceOffset] - 沿法线的小偏移（防止 z-fighting）
 */
export function computeFaceAnchorXYZ(mesh, faceT, horizOffset, vertOffset, surfaceOffset = 0) {
  const { headR, bodyLength, bodyWidth, bodyDepth } = mesh;
  const faceCenterX = getSpineX(faceT, headR, bodyLength);
  const faceCenterY = 0;
  // 朝摄像机方向（surfAngle=PI/2 → sin=1 → z=bd）
  const faceCenterZ = getBodyDepth(faceT, headR, bodyDepth, bodyLength);

  const x = faceCenterX + horizOffset;
  const y = faceCenterY + vertOffset;
  const z = faceCenterZ + surfaceOffset;

  return {
    x, y, z,
    nx: 0, ny: 0, nz: 1,
    tangentX: 1, tangentY: 0, tangentZ: 0,
    faceWeight: 1.0,
  };
}

// -------------------- 鲸鱼尾巴 --------------------

export function createWhaleTailMesh(options = {}) {
  const {
    tailLength = 60,
    tailWidth = 55,
    flukeSegments = 10,
    color = '#8a8a8a',
  } = options;

  const vertices = [];
  const faces = [];

  // 尾柄 + 尾叶以参数化曲面生成。
  const handleLen = tailLength * 0.3;
  const handleW = 8;

  // --- 尾叶（左右两叶） ---
  for (let side of [-1, 1]) {
    for (let i = 0; i <= flukeSegments; i++) {
      for (let j = 0; j <= flukeSegments; j++) {
        const u = i / flukeSegments;
        const v = j / flukeSegments;

        // 沿尾柄方向厚度：根部厚，末端薄
        const thickness = handleW * (1 - u * 0.8) * Math.sin(v * Math.PI);
        // 尾叶展开宽度
        const spreadFactor = Math.pow(u, 0.75);
        const localW = tailWidth * spreadFactor * v;

        // 尾叶弯曲：末端上翘
        const bendY = -Math.pow(u, 2) * tailLength * 0.18;

        const x = handleLen + u * tailLength * 0.7;
        const y = side * localW + bendY;
        const z = thickness * Math.cos(v * Math.PI);

        // 法线：指向外侧 (侧+前)
        const nyDir = side;
        const nxDir = 0.2;
        const nzDir = Math.sin(v * Math.PI - Math.PI / 2);
        const nLen = Math.sqrt(nxDir * nxDir + nyDir * nyDir + nzDir * nzDir) || 1;

        vertices.push({
          x, y, z,
          nx: nxDir / nLen,
          ny: nyDir / nLen,
          nz: nzDir / nLen,
          u, v,
          side, isFluke: true,
        });
      }
    }

    // 面
    for (let i = 0; i < flukeSegments; i++) {
      for (let j = 0; j < flukeSegments; j++) {
        const a = side === -1
          ? i * (flukeSegments + 1) + j
          : (flukeSegments + 1) * (flukeSegments + 1) + i * (flukeSegments + 1) + j;
        const b = a + 1;
        const c = a + (flukeSegments + 1);
        const d = c + 1;
        faces.push({
          indices: [a, b, d, c],
          vertices: [vertices[a], vertices[b], vertices[d], vertices[c]],
          isFluke: true, side,
        });
      }
    }
  }

  // --- 尾柄（圆柱连接身体） ---
  const handleBase = vertices.length;
  const handleSegs = 8;
  const handleRows = 6;
  for (let i = 0; i <= handleSegs; i++) {
    for (let j = 0; j <= handleRows; j++) {
      const u = i / handleSegs;
      const ang = (j / handleRows) * Math.PI * 2;
      const x = u * handleLen;
      const hw = handleW * (1 - u * 0.3);
      const hd = handleW * 0.6 * (1 - u * 0.2);
      const y = hw * Math.cos(ang);
      const z = hd * Math.sin(ang);
      vertices.push({
        x, y, z,
        nx: Math.cos(ang), ny: Math.sin(ang), nz: 0,
        u, v: j / handleRows, isHandle: true,
      });
    }
  }
  for (let i = 0; i < handleSegs; i++) {
    for (let j = 0; j < handleRows; j++) {
      const a = handleBase + i * (handleRows + 1) + j;
      const b = a + 1;
      const c = handleBase + (i + 1) * (handleRows + 1) + j;
      const d = c + 1;
      faces.push({
        indices: [a, b, d, c],
        vertices: [vertices[a], vertices[b], vertices[d], vertices[c]],
        isHandle: true,
      });
    }
  }

  return {
    vertices, faces, tailLength, tailWidth, color,
    type: 'whaleTail',
  };
}

// -------------------- 变形与旋转 --------------------

function applyYawPitchRoll(x, y, z, nx, ny, nz, params) {
  const { angleY = 0, angleX = 0, angleZ = 0 } = params;
  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  // Yaw (绕 Y)
  let x1 = x * cosY + z * sinY;
  let z1 = -x * sinY + z * cosY;
  let y1 = y;
  let nx1 = nx * cosY + nz * sinY;
  let nz1 = -nx * sinY + nz * cosY;
  let ny1 = ny;

  // Pitch (绕 X)
  let y2 = y1 * cosX - z1 * sinX;
  let z2 = y1 * sinX + z1 * cosX;
  let x2 = x1;
  let ny2 = ny1 * cosX - nz1 * sinX;
  let nz2 = ny1 * sinX + nz1 * cosX;
  let nx2 = nx1;

  // Roll (绕 Z)
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
