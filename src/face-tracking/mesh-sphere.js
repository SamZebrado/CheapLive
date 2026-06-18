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
      });
    }
  }

  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segments + 1) + j;
      const d = c + 1;
      faces.push({
        indices: [a, b, d, c],
        vertices: [vertices[a], vertices[b], vertices[d], vertices[c]],
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
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const y1 = y;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;
    const x2 = x1;
    const x3 = x2 * cosZ - y2 * sinZ;
    const y3 = x2 * sinZ + y2 * cosZ;
    const z3 = z2;

    const nx1 = v.nx * cosY + v.nz * sinY;
    const nz1 = -v.nx * sinY + v.nz * cosY;
    const ny1 = v.ny;
    const ny2 = ny1 * cosX - nz1 * sinX;
    const nz2 = ny1 * sinX + nz1 * cosX;
    const nx2 = nx1;
    const nx3 = nx2 * cosZ - ny2 * sinZ;
    const ny3 = nx2 * sinZ + ny2 * cosZ;
    const nz3 = nz2;

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
