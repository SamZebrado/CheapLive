/**
 * Mesh Sphere - 球体网格生成器
 *
 * 语义约定：
 *   - 球体位于原点。
 *   - 顶部 phi=0，底部 phi=pi。
 *   - 在 phi=pi/3 与 theta=±pi/4 的椭圆区域内存在斑点标记（面部区域）。
 *   - 摄像机朝向 +Z。
 */

export function createSphereMesh(options = {}) {
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
export function computeSphereFaceAnchor(mesh, phi, theta, surfaceOffset = 0) {
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
export function computeSphereFaceAnchorXYZ(mesh, horizOffset, vertOffset, surfaceOffset = 0) {
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
export function deformSphere(mesh, params = {}) {
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
export function computeVertexLight(vertex, lightDir) {
  const dot = Math.max(
    0,
    (vertex.nx || 0) * lightDir.x +
      (vertex.ny || 0) * lightDir.y +
      (vertex.nz || 0) * lightDir.z
  );
  return { dot, ambient: 0.45, diffuse: dot * 0.45 };
}
