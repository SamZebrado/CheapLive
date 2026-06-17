/**
 * Mesh Sphere - 球体网格生成器
 * 使用经纬度网格生成球体，支持不对称表面标记
 * 模拟 Live2D 2.5D 体积效果
 */

/**
 * 生成球体网格
 * @param {Object} options
 * @param {number} options.radius - 球体半径
 * @param {number} options.rings - 纬度环数 (默认 8)
 * @param {number} options.segments - 经度分段数 (默认 20)
 * @param {string} options.baseColor - 基础颜色
 * @param {string} options.markingColor - 标记颜色
 * @param {string} options.highlightColor - 高光颜色
 * @param {string} options.shadowColor - 阴影颜色
 */
export function createSphereMesh(options = {}) {
  const {
    radius = 100,
    rings = 8,
    segments = 20,
    baseColor = '#d4d1c8',
    markingColor = '#8B4513',
    highlightColor = '#ffffff',
    shadowColor = '#6a6758',
  } = options;

  const vertices = [];
  const faces = [];

  // 生成顶点 (latitude/longitude 风格)
  // phi: 0 ~ PI (从上到下)
  // theta: 0 ~ 2*PI (围绕 Y 轴)
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let j = 0; j <= segments; j++) {
      const theta = (j / segments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      // 球面坐标转笛卡尔坐标
      const x = radius * sinPhi * cosTheta;
      const y = -radius * cosPhi; // 翻转 Y 使顶部朝上
      const z = radius * sinPhi * sinTheta;

      // 法向量 (单位化)
      const nx = sinPhi * cosTheta;
      const ny = -cosPhi;
      const nz = sinPhi * sinTheta;

      // UV 坐标
      const u = j / segments;
      const v = i / rings;

      // 表面标记: 在球体右侧偏上的位置有一个斑点
      // 标记中心在 (phi=PI/3, theta=PI/4)
      const markCenterPhi = Math.PI / 3;
      const markCenterTheta = Math.PI / 4;
      const markRadius = 0.35; // 标记的角半径

      const dPhi = phi - markCenterPhi;
      const dTheta = Math.atan2(
        Math.sin(theta - markCenterTheta),
        Math.cos(theta - markCenterTheta)
      );
      const markDist = Math.sqrt(dPhi * dPhi + dTheta * dTheta);
      const isMarking = markDist < markRadius;
      const markIntensity = isMarking
        ? Math.max(0, 1 - markDist / markRadius)
        : 0;

      vertices.push({
        x, y, z,
        nx, ny, nz,
        u, v,
        phi, theta,
        isMarking,
        markIntensity,
        originalIndex: vertices.length,
      });
    }
  }

  // 生成面 (四边形网格，每个面由两个三角形组成或作为一个四边形)
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (segments + 1) + j;
      const d = c + 1;

      faces.push({
        indices: [a, b, d, c], // 四边形
        vertices: [vertices[a], vertices[b], vertices[d], vertices[c]],
        isMarking:
          vertices[a].isMarking ||
          vertices[b].isMarking ||
          vertices[c].isMarking ||
          vertices[d].isMarking,
        markIntensity: Math.max(
          vertices[a].markIntensity,
          vertices[b].markIntensity,
          vertices[c].markIntensity,
          vertices[d].markIntensity
        ),
      });
    }
  }

  return {
    vertices,
    faces,
    radius,
    rings,
    segments,
    baseColor,
    markingColor,
    highlightColor,
    shadowColor,
    type: 'sphere',
  };
}

/**
 * 根据参数变形球体网格顶点
 * @param {Object} mesh - 网格数据
 * @param {Object} params - 变形参数
 * @param {number} params.angleX - X轴旋转角度 (度)
 * @param {number} params.angleY - Y轴旋转角度 (度)
 * @param {number} params.angleZ - Z轴旋转角度 (度)
 * @param {number} params.breath - 呼吸参数 0-1
 */
export function deformSphere(mesh, params = {}) {
  const {
    angleX = 0,
    angleY = 0,
    angleZ = 0,
    breath = 0,
  } = params;

  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;
  const radZ = (angleZ * Math.PI) / 180;

  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  const breathScale = 1 + breath * 0.02;

  const transformedVertices = mesh.vertices.map((v) => {
    let x = v.x * breathScale;
    let y = v.y * breathScale;
    let z = v.z * breathScale;

    // 旋转变换: Z -> Y -> X (Tait-Bryan angles)
    // 绕 Y 轴 (yaw)
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;

    // 绕 X 轴 (pitch)
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;

    // 绕 Z 轴 (roll)
    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;

    // 法向量也做相同旋转
    let nx = v.nx, ny = v.ny, nz = v.nz;
    let nx1 = nx * cosY + nz * sinY;
    let nz1 = -nx * sinY + nz * cosY;
    let ny1 = ny;
    let ny2 = ny1 * cosX - nz1 * sinX;
    let nz2 = ny1 * sinX + nz1 * cosX;
    let nx2 = nx1;
    let nx3 = nx2 * cosZ - ny2 * sinZ;
    let ny3 = nx2 * sinZ + ny2 * cosZ;
    let nz3 = nz2;

    return {
      ...v,
      tx: x3, ty: y3, tz: z3,
      nx: nx3, ny: ny3, nz: nz3,
    };
  });

  // 更新面的顶点引用
  const transformedFaces = mesh.faces.map((f) => ({
    ...f,
    vertices: f.indices.map((idx) => transformedVertices[idx]),
  }));

  return {
    ...mesh,
    vertices: transformedVertices,
    faces: transformedFaces,
  };
}

/**
 * 计算球体网格的光照颜色
 * @param {Object} face - 面数据
 * @param {Object} lightDir - 光源方向
 * @param {Object} mesh - 网格材质参数
 */
export function computeSphereFaceColor(face, lightDir = { x: 0.3, y: -0.5, z: 0.8 }, mesh) {
  // 计算面的平均法向量
  const nx = face.vertices.reduce((s, v) => s + v.nx, 0) / 4;
  const ny = face.vertices.reduce((s, v) => s + v.ny, 0) / 4;
  const nz = face.vertices.reduce((s, v) => s + v.nz, 0) / 4;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const nnx = nx / len;
  const nny = ny / len;
  const nnz = nz / len;

  // 点积计算光照强度
  const dot = Math.max(0, nnx * lightDir.x + nny * lightDir.y + nnz * lightDir.z);

  // 基础颜色
  let baseR, baseG, baseB;
  if (face.markIntensity > 0) {
    // 标记区域混合标记色
    const m = face.markIntensity;
    const bc = hexToRgb(mesh.baseColor);
    const mc = hexToRgb(mesh.markingColor);
    baseR = lerp(bc.r, mc.r, m);
    baseG = lerp(bc.g, mc.g, m);
    baseB = lerp(bc.b, mc.b, m);
  } else {
    const bc = hexToRgb(mesh.baseColor);
    baseR = bc.r;
    baseG = bc.g;
    baseB = bc.b;
  }

  // 高光
  const hl = hexToRgb(mesh.highlightColor);
  const sd = hexToRgb(mesh.shadowColor);

  // 根据法向量 Y 分量添加上下渐变 (模拟环境光)
  const ambientFactor = (nny + 1) * 0.5; // 0 ~ 1

  // 漫反射 + 环境光
  const diffuse = dot * 0.7;
  const ambient = 0.3 + ambientFactor * 0.2;

  let r = baseR * (ambient + diffuse) + hl.r * Math.pow(dot, 3) * 0.3;
  let g = baseG * (ambient + diffuse) + hl.g * Math.pow(dot, 3) * 0.3;
  let b = baseB * (ambient + diffuse) + hl.b * Math.pow(dot, 3) * 0.3;

  // 阴影区域
  if (dot < 0.3) {
    const shadowFactor = (0.3 - dot) / 0.3;
    r = lerp(r, sd.r * 0.5, shadowFactor * 0.5);
    g = lerp(g, sd.g * 0.5, shadowFactor * 0.5);
    b = lerp(b, sd.b * 0.5, shadowFactor * 0.5);
  }

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    alpha: face.vertices[0].tz > -mesh.radius * 0.8 ? 1 : 0.4, // 背面半透明
  };
}

// 工具函数
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 200, g: 200, b: 200 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
