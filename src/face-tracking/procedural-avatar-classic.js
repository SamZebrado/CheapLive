/* procedural-avatar-classic.js —— 由 src/face-tracking/*.js 派生。
 * 用于 Android WebView / 不支持 ES Module import 的环境。
 * 自动生成，请勿手工修改。
 */

(function () {
  "use strict";

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
 * Mesh Spindle + Whale Tail - 纺锤体身体 + 鲸鱼尾巴网格生成器
 *
 * 语义约定：
 *   - 主轴沿 X 方向。
 *   - t=0 为鼻端（头部），t=1 为尾端。
 *   - 摄像机朝向 +Z，近侧表面法线指向 +Z。
 *   - angle=0 对应下方（肚子/底部），angle=±π 为上方（背）。
 *   - 面部区域位于 headT 区间的近侧 (angle 接近 0 的一个带)。
 *
 * 说明：不依赖 Live2D Cubism；为程序化 Canvas 2D 网格渲染。
 */

// -------------------- 基础几何参数函数 --------------------

function getSpineX(t, headR, bodyLength) {
  // 脊柱位置：头部在负数一侧（靠近摄像机负 X 端），尾部在 +X。
  const p0 = -headR * 0.35;          // 鼻端
  const p3 = bodyLength + 30;         // 尾端
  const cp1 = headR * 0.4;
  const cp2 = bodyLength * 0.7;
  const mt = 1 - t;
  return (mt * mt * mt) * p0
       + 3 * (mt * mt) * t * cp1
       + 3 * mt * (t * t) * cp2
       + (t * t * t) * p3;
}

/**
 * 身体横断面的半宽（y 方向）。
 * t 越小越靠前，越圆润；中段保持稳定，尾部收细。
 */
function getBodyWidth(t, headR, bodyWidth, bodyLength) {
  if (t < 0.18) {
    // 头部圆形：从 0 平滑升到 headR 的 1.0 倍
    const k = t / 0.18;
    const fade = Math.sin(k * Math.PI * 0.5);  // 0 → 1 (光滑)
    return headR * fade;
  } else if (t < 0.55) {
    // 头部-身体过渡：略宽，保持圆润
    return bodyWidth * (1 - (t - 0.18) / 0.37 * 0.06);
  } else if (t < 0.82) {
    // 身体中部，略收细
    return bodyWidth * (0.96 - (t - 0.55) * 0.2);
  } else {
    // 尾柄收细
    const tt = (t - 0.82) / 0.18;
    return bodyWidth * 0.85 * (1 - tt) * (1 - tt * 0.6);
  }
}

/**
 * 身体横断面的深度（z 方向）。
 * 与 bodyWidth 协同，使得正面看起来是圆形头部。
 */
function getBodyDepth(t, headR, bodyDepth, bodyLength) {
  if (t < 0.18) {
    const k = t / 0.18;
    const fade = Math.sin(k * Math.PI * 0.5);
    return headR * 0.92 * fade;  // 头部接近球形
  } else if (t < 0.55) {
    return bodyDepth * (0.96 - (t - 0.18) * 0.05);
  } else if (t < 0.82) {
    return bodyDepth * 0.88 * (1 - (t - 0.55) * 0.25);
  } else {
    const tt = (t - 0.82) / 0.18;
    return bodyDepth * 0.8 * (1 - tt) * (1 - tt * 0.6);
  }
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

function createSpindleMesh(options = {}) {
  const {
    headR = 75,
    bodyLength = 140,
    bodyWidth = 55,
    bodyDepth = 40,
    columns = 20,
    rows = 12,
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
 * @param {Object} mesh  - createSpindleMesh 返回的网格对象
 * @param {number} bodyT - 沿脊柱位置（0=鼻端，1=尾端）
 * @param {number} surfAngle - 环绕角度（弧度），0 指向下方（肚子）
 * @param {number} [surfaceOffset] - 沿法线外推的小距离（像素）
 * @returns {{ x:number, y:number, z:number, nx:number, ny:number, nz:number, tangentX:number, tangentY:number, tangentZ:number }}
 */
function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
  const { headR, bodyLength, bodyWidth, bodyDepth } = mesh;
  const spineX = getSpineX(bodyT, headR, bodyLength);
  const bw = getBodyWidth(bodyT, headR, bodyWidth, bodyLength);
  const bd = getBodyDepth(bodyT, headR, bodyDepth, bodyLength);

  const cosA = Math.cos(surfAngle);
  const sinA = Math.sin(surfAngle);

  let x = spineX;
  let y = bw * cosA;
  let z = bd * sinA;

  // 椭圆外法线
  const rawNy = cosA / Math.max(bw, 0.001);
  const rawNz = sinA / Math.max(bd, 0.001);
  const nLen = Math.sqrt(rawNy * rawNy + rawNz * rawNz) || 1;
  let ny = rawNy / nLen;
  let nz = rawNz / nLen;
  let nx = 0;

  // 面部区域微凸，保持与网格顶点一致的形变
  const fw = getFaceWeight(bodyT, surfAngle);
  if (fw > 0.05) {
    const bulge = 2.5 * fw;
    const radialLen = Math.max(1e-3, Math.sqrt(y * y + z * z));
    const ry = y / radialLen;
    const rz = z / radialLen;
    y += ry * bulge;
    z += rz * bulge;
  }

  // 表面偏移（用于防止与主体 z-fighting）
  if (surfaceOffset !== 0) {
    y += ny * surfaceOffset;
    z += nz * surfaceOffset;
  }

  // 沿脊柱方向的切线 (1, 0, 0) 在局部近似
  const tangentX = 1;
  const tangentY = 0;
  const tangentZ = 0;

  return { x, y, z, nx, ny, nz, tangentX, tangentY, tangentZ, faceWeight: fw };
}

// -------------------- 鲸鱼尾巴 --------------------

function createWhaleTailMesh(options = {}) {
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

function applyLight(faceCenterNormal, lightDir, baseColor) {
  // 点积表示朝向光源的程度，映射到 [ambient, 1.0]
  const dot =
    (faceCenterNormal.x || 0) * lightDir.x +
    (faceCenterNormal.y || 0) * lightDir.y +
    (faceCenterNormal.z || 0) * lightDir.z;
  const factor = 0.55 + 0.45 * clamp(dot, -0.2, 1.0);
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
    this.mirror = false;
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
    const { w, h, scale, originX, originY, baseColorTop, baseColorBottom, faceTopColor, faceBottomColor, lightDir } = options;
    const vertices = mesh.vertices;
    const faces = mesh.faces;
    if (!vertices || !faces || faces.length === 0) return;

    // 1) 先把顶点投影到屏幕空间，并做简单的背面剔除准备
    const projected = new Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const tx = (v.tx !== undefined ? v.tx : v.x);
      const ty = (v.ty !== undefined ? v.ty : v.y);
      const tz = (v.tz !== undefined ? v.tz : v.z);
      const sx = originX + tx * scale;
      const sy = originY + ty * scale;
      projected[i] = { sx, sy, sz: tz, nx: v.nx || 0, ny: v.ny || 0, nz: v.nz || 0, v };
    }

    // 2) 计算每个面的平均深度和法线，做背面剔除和光照
    const drawList = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const idxs = f.indices;
      const p0 = projected[idxs[0]];
      const p1 = projected[idxs[1]];
      const p2 = projected[idxs[2]];
      const p3 = projected[idxs[3]];
      const avgZ = (p0.sz + p1.sz + p2.sz + p3.sz) * 0.25;
      const avgNx = (p0.nx + p1.nx + p2.nx + p3.nx) * 0.25;
      const avgNy = (p0.ny + p1.ny + p2.ny + p3.ny) * 0.25;
      const avgNz = (p0.nz + p1.nz + p2.nz + p3.nz) * 0.25;
      const nLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz) || 1;

      // 背面剔除：摄像机朝 +Z，所以 -Z 方向的面不画
      const facing = avgNz / nLen;
      if (facing < -0.05) continue;

      // 选择颜色：根据 "是否上半(y<0)" 区分灰白
      const avgTy = (p0.v.ty !== undefined
        ? (p0.v.ty + p1.v.ty + p2.v.ty + p3.v.ty) * 0.25
        : (p0.v.y + p1.v.y + p2.v.y + p3.v.y) * 0.25);

      // 如果是纺锤/鲸鱼，顶点可能带 faceWeight，用它来过渡面部颜色
      let faceWeight = 0;
      for (let k = 0; k < 4; k++) {
        const vv = f.vertices[k];
        if (vv && typeof vv.faceWeight === 'number') faceWeight += vv.faceWeight;
      }
      faceWeight *= 0.25;

      let base = (avgTy < 0 ? baseColorTop : baseColorBottom);
      if (faceWeight > 0.01 && faceTopColor && faceBottomColor) {
        const faceBase = avgTy < 0 ? faceTopColor : faceBottomColor;
        base = lerpColor(base, faceBase, faceWeight);
      }

      const lit = applyLight(
        { x: avgNx / nLen, y: avgNy / nLen, z: avgNz / nLen },
        lightDir,
        base
      );

      drawList.push({
        points: [
          [p0.sx, p0.sy], [p1.sx, p1.sy], [p2.sx, p2.sy], [p3.sx, p3.sy]
        ],
        avgZ,
        fill: lit,
        stroke: this.debugMesh ? 'rgba(255,255,255,0.4)' : null,
      });
    }

    // 3) 深度由小到大排序（先画远的，再画近的）
    drawList.sort((a, b) => a.avgZ - b.avgZ);

    for (let i = 0; i < drawList.length; i++) {
      const d = drawList[i];
      ctx.beginPath();
      ctx.moveTo(d.points[0][0], d.points[0][1]);
      ctx.lineTo(d.points[1][0], d.points[1][1]);
      ctx.lineTo(d.points[2][0], d.points[2][1]);
      ctx.lineTo(d.points[3][0], d.points[3][1]);
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
   * 对已经算出的 "锚点参数坐标" 应用 yaw/pitch/roll 得到屏幕坐标。
   * 对球：输入 mesh + phi/theta + surfaceOffset，变形后从 mesh 查询。
   * 对鲸鱼：输入 mesh + bodyT/surfAngle。
   *
   * 为避免与球/鲸鱼模块的内部坐标约定耦合，这里直接调用各自的
   * computeFaceAnchor / computeSphereFaceAnchor 得到局部 (x,y,z,n)，
   * 再按相同的 yaw/pitch/roll 做一次旋转，最终投影到屏幕坐标。
   */
  _transformAnchor(local, rotParams, originX, originY, scale) {
    // 局部 -> 旋转后
    const radY = rotParams.angleY * Math.PI / 180;
    const radX = rotParams.angleX * Math.PI / 180;
    const radZ = rotParams.angleZ * Math.PI / 180;
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

    let x = local.x, y = local.y, z = local.z;
    let nx = local.nx, ny = local.ny, nz = local.nz;

    // Yaw (Y)
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;
    let nx1 = nx * cosY + nz * sinY;
    let nz1 = -nx * sinY + nz * cosY;
    let ny1 = ny;

    // Pitch (X)
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;
    let ny2 = ny1 * cosX - nz1 * sinX;
    let nz2 = ny1 * sinX + nz1 * cosX;
    let nx2 = nx1;

    // Roll (Z)
    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;
    let nx3 = nx2 * cosZ - ny2 * sinZ;
    let ny3 = nx2 * sinZ + ny2 * cosZ;
    let nz3 = nz2;

    return {
      worldX: x3, worldY: y3, worldZ: z3,
      screenX: originX + x3 * scale,
      screenY: originY + y3 * scale,
      nx: nx3, ny: ny3, nz: nz3,
    };
  }
}

// ---------------- 球体头像 ----------------

class ProceduralSphereAvatar extends ProceduralMeshRenderer {
  constructor(canvasId) {
    super(canvasId);
    this.mesh = createSphereMesh({ rings: 18, segments: 28, radius: 85 });
    this.draw();
  }

  /**
   * 返回五官锚点的球坐标参数（供测试和渲染使用）。
   * 坐标约定：球坐标 (phi, theta)；
   *   phi=0 顶部, phi=pi 底部
   *   theta=0 朝 +X, theta=pi/2 朝 +Z（朝向摄像机）
   * 我们让面部朝 +Z，所以眼睛的 theta 应接近 pi/2。
   */
  getAnchors(params) {
    // 左眼 (phi, theta)：左 (-X)、中上偏上
    const eyePhi = Math.PI * 0.42; // 约 75°：上半部
    const eyeThetaL = Math.PI * 0.5 - 0.35; // 朝摄像机但偏左
    const eyeThetaR = Math.PI * 0.5 + 0.35;
    const mouthPhi = Math.PI * 0.60; // 眼睛下方
    const mouthTheta = Math.PI * 0.5;

    const browPhi = eyePhi - 0.10;
    const leftEye = { phi: eyePhi, theta: eyeThetaL, surfaceOffset: 2 };
    const rightEye = { phi: eyePhi, theta: eyeThetaR, surfaceOffset: 2 };
    const mouth = { phi: mouthPhi, theta: mouthTheta, surfaceOffset: 2 };
    const browLeft = { phi: browPhi, theta: eyeThetaL, surfaceOffset: 3 };
    const browRight = { phi: browPhi, theta: eyeThetaR, surfaceOffset: 3 };
    return { leftEye, rightEye, mouth, browLeft, browRight };
  }

  _render(ctx, w, h) {
    const np = normalizeParams(this.params);
    const rot = { angleY: np.headYaw, angleX: np.headPitch, angleZ: np.headRoll };
    const deformed = deformSphere(this.mesh, rot);

    // 布局：居中 + 留出边距；scale 按画布短边计算
    const margin = 0.12;
    const minSide = Math.min(w, h);
    const scale = (minSide * (1 - margin * 2)) / (this.mesh.radius * 2.1);
    const originX = w * 0.5 + (np.headX - 0.5) * minSide * 0.15;
    const originY = h * 0.5 + (np.headY - 0.5) * minSide * 0.10;

    const lightDir = { x: -0.35, y: -0.4, z: 0.8 };
    // 球体的"上半=灰，下半=白"的简单配色：
    this._drawMesh(ctx, deformed, {
      w, h, scale, originX, originY,
      baseColorTop: '#bdb8aa',
      baseColorBottom: '#f3f0e6',
      faceTopColor: '#c8c2b4',
      faceBottomColor: '#fffaf0',
      lightDir,
    });

    // 五官
    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);

    const drawEye = (anchor, openness, isLeft) => {
      const local = computeSphereFaceAnchor(this.mesh, anchor.phi, anchor.theta, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      // 可见性：根据法线朝向摄像机 (+Z) 的程度
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return; // 转到后面直接隐藏
      // yaw 过大时压缩横向
      const yawCompress = clamp(facing, 0.3, 1);
      const rx = 10 * scale * yawCompress;
      const ry = 10 * scale * (0.4 + 0.6 * openness);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = facing;
      ctx.fill();
      ctx.lineWidth = 1.5 * (scale / 1.0);
      ctx.strokeStyle = '#222';
      ctx.stroke();

      // 瞳孔
      if (openness > 0.1) {
        ctx.beginPath();
        const pupilRx = rx * 0.55;
        const pupilRy = ry * 0.55 * openness;
        ctx.ellipse(t.screenX, t.screenY, pupilRx, pupilRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1f1f1f';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise, isLeft) => {
      const local = computeSphereFaceAnchor(this.mesh, anchor.phi, anchor.theta, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const len = 20 * scale * yawCompress;
      const up = -raise * 6 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      ctx.beginPath();
      const tilt = isLeft ? -0.1 : 0.1;
      ctx.moveTo(t.screenX - len * 0.5, t.screenY + up);
      ctx.lineTo(t.screenX + len * 0.5, t.screenY + up + tilt * len);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeSphereFaceAnchor(this.mesh, anchor.phi, anchor.theta, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const halfW = 22 * scale * yawCompress;
      const openH = 4 * scale + 14 * scale * open;
      const smileUp = -smile * 5 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      if (open < 0.05) {
        // 闭合成一条上扬曲线
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY + smileUp);
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + smileUp + 4 * scale * (1 - smile),
          t.screenX + halfW,
          t.screenY + smileUp
        );
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4a2020';
        ctx.beginPath();
        ctx.ellipse(t.screenX, t.screenY + smileUp * 0.5, halfW * 0.7, openH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    // 左眼 & 右眼：镜像时对调"左右"
    if (this.mirror) {
      drawEye(anchors.rightEye, np.eyeLeft, true);
      drawEye(anchors.leftEye, np.eyeRight, false);
      drawBrow(anchors.browRight, np.browLeft, true);
      drawBrow(anchors.browLeft, np.browRight, false);
    } else {
      drawEye(anchors.leftEye, np.eyeLeft, true);
      drawEye(anchors.rightEye, np.eyeRight, false);
      drawBrow(anchors.browLeft, np.browLeft, true);
      drawBrow(anchors.browRight, np.browRight, false);
    }
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
  }
}

// ---------------- 纺锤鲸鱼 ----------------

class ProceduralSpindleWhaleAvatar extends ProceduralMeshRenderer {
  constructor(canvasId) {
    super(canvasId);
    this.spindleMesh = createSpindleMesh({
      headR: 75,
      bodyLength: 150,
      bodyWidth: 60,
      bodyDepth: 45,
      columns: 22,
      rows: 16,
      topColor: '#bdb8aa',
      bottomColor: '#f2f0e6',
      faceTopColor: '#c8c2b4',
      faceBottomColor: '#fffaf0',
    });
    this.tailMesh = createWhaleTailMesh({
      tailLength: 75,
      tailWidth: 65,
      flukeSegments: 6,
      color: '#bdb8aa',
    });
    this.draw();
  }

  /**
   * 参数坐标：
   *   bodyT 沿脊柱：0 鼻端，1 尾端
   *   surfAngle 环绕角度：0 指向 Y 正方向（身体侧面偏前），
   *     angle = PI/2 指向 +Z（朝摄像机），
   *     angle = PI   指向 Y 负方向（身体另一侧）
   *
   * 面部区域在 bodyT ≈ 0.1~0.2，surfAngle 接近 PI/2（朝摄像机）。
   * 约定：摄像机方向 +Z；angle = PI/2 时 z = depth * sin(PI/2) = depth > 0。
   */
  getAnchors(params) {
    const faceT = 0.12;
    const faceCenterAngle = Math.PI / 2; // 朝摄像机
    const eyeAngularOffset = 0.38;       // 两眼水平间距（弧度）
    const browAngularOffset = 0.32;      // 眉毛间距，略窄于眼睛

    return {
      leftEye:  { bodyT: faceT,       surfAngle: faceCenterAngle - eyeAngularOffset, surfaceOffset: 1.5 },
      rightEye: { bodyT: faceT,       surfAngle: faceCenterAngle + eyeAngularOffset, surfaceOffset: 1.5 },
      mouth:    { bodyT: faceT + 0.03, surfAngle: faceCenterAngle,                 surfaceOffset: 1.5 },
      browLeft: { bodyT: faceT - 0.018, surfAngle: faceCenterAngle - browAngularOffset, surfaceOffset: 2 },
      browRight:{ bodyT: faceT - 0.018, surfAngle: faceCenterAngle + browAngularOffset, surfaceOffset: 2 },
    };
  }

  _render(ctx, w, h) {
    const np = normalizeParams(this.params);
    const rot = { angleY: np.headYaw, angleX: np.headPitch, angleZ: np.headRoll };

    const minSide = Math.min(w, h);
    // scale：整体身体长度约 bodyLength + tailLength + headR；按此决定像素缩放
    const totalLen =
      this.spindleMesh.bodyLength + this.tailMesh.tailLength + this.spindleMesh.headR;
    const margin = 0.10;
    const scale = (minSide * (1 - margin * 2)) / totalLen * 1.1;

    // 让鲸鱼整体在画布中居中，鼻端偏左一点
    const originX = w * 0.5 - (this.spindleMesh.headR * 0.2) * scale + (np.headX - 0.5) * minSide * 0.08;
    const originY = h * 0.5 + (np.headY - 0.5) * minSide * 0.08;

    // 先画尾巴（更远离摄像机的一端），再画身体，最后画头部五官
    const lightDir = { x: -0.3, y: -0.5, z: 0.8 };

    // 尾巴整体沿 +X，先整体位移到脊柱末端附近再旋转
    const tailOffsetX = this.spindleMesh.headR * 0.2 + this.spindleMesh.bodyLength;
    const tailRot = { angleY: rot.angleY + 8 * Math.sin(Date.now() * 0.002), angleX: rot.angleX, angleZ: rot.angleZ };
    this._drawTranslatedTail(ctx, originX, originY, scale, tailOffsetX, tailRot, lightDir);

    const deformedBody = deformSpindle(this.spindleMesh, rot);
    this._drawMesh(ctx, deformedBody, {
      w, h, scale, originX, originY,
      baseColorTop: this.spindleMesh.topColor,
      baseColorBottom: this.spindleMesh.bottomColor,
      faceTopColor: this.spindleMesh.faceTopColor,
      faceBottomColor: this.spindleMesh.faceBottomColor,
      lightDir,
    });

    this._drawFaceFeatures(ctx, np, rot, originX, originY, scale);
  }

  _drawTranslatedTail(ctx, originX, originY, scale, offsetX, rot, lightDir) {
    // 将尾巴 mesh 的每个顶点沿 +X 平移 offsetX，再按 rot 旋转。
    // 直接克隆顶点数组会很浪费；这里通过在 deform 后再修改 tx/ty/tz 不现实。
    // 简化：临时构造一个"平移后"mesh 委托 deform。
    const translatedVerts = this.tailMesh.vertices.map((v) => ({
      ...v,
      x: v.x + offsetX,
    }));
    const translated = { ...this.tailMesh, vertices: translatedVerts };
    const deformed = deformSpindle(translated, rot);
    this._drawMesh(ctx, deformed, {
      w: 0, h: 0, scale, originX, originY,
      baseColorTop: this.tailMesh.color,
      baseColorBottom: '#d6d1c3',
      faceTopColor: null,
      faceBottomColor: null,
      lightDir,
    });
  }

  _drawFaceFeatures(ctx, np, rot, originX, originY, scale) {
    const anchors = this.getAnchors(np);

    const drawEye = (anchor, openness, isLeft) => {
      const local = computeFaceAnchor(this.spindleMesh, anchor.bodyT, anchor.surfAngle, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, -0.2, 1.0);
      if (facing <= 0) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const rx = 10 * scale * yawCompress;
      const ry = 10 * scale * (0.4 + 0.6 * openness);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(t.screenX, t.screenY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = facing;
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.8 * scale);
      ctx.strokeStyle = '#222';
      ctx.stroke();
      if (openness > 0.1) {
        ctx.beginPath();
        const pupilRx = rx * 0.55;
        const pupilRy = ry * 0.55 * openness;
        ctx.ellipse(t.screenX, t.screenY, pupilRx, pupilRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1f1f1f';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawBrow = (anchor, raise, isLeft) => {
      const local = computeFaceAnchor(this.spindleMesh, anchor.bodyT, anchor.surfAngle, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const len = 18 * scale * yawCompress;
      const up = -raise * 6 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      const tilt = isLeft ? -0.1 : 0.1;
      ctx.moveTo(t.screenX - len * 0.5, t.screenY + up);
      ctx.lineTo(t.screenX + len * 0.5, t.screenY + up + tilt * len);
      ctx.stroke();
      ctx.restore();
    };

    const drawMouth = (anchor, open, smile) => {
      const local = computeFaceAnchor(this.spindleMesh, anchor.bodyT, anchor.surfAngle, anchor.surfaceOffset);
      const t = this._transformAnchor(local, rot, originX, originY, scale);
      const facing = clamp(t.nz, 0, 1);
      if (facing <= 0.05) return;
      const yawCompress = clamp(facing, 0.3, 1);
      const halfW = 20 * scale * yawCompress;
      const openH = 3 * scale + 12 * scale * open;
      const smileUp = -smile * 5 * scale;
      ctx.save();
      ctx.globalAlpha = facing;
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = Math.max(1, 2 * scale);
      if (open < 0.05) {
        ctx.beginPath();
        ctx.moveTo(t.screenX - halfW, t.screenY + smileUp);
        ctx.quadraticCurveTo(
          t.screenX,
          t.screenY + smileUp + 3 * scale * (1 - smile),
          t.screenX + halfW,
          t.screenY + smileUp
        );
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4a2020';
        ctx.beginPath();
        ctx.ellipse(t.screenX, t.screenY + smileUp * 0.5, halfW * 0.7, openH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    if (this.mirror) {
      drawEye(anchors.rightEye, np.eyeLeft, true);
      drawEye(anchors.leftEye, np.eyeRight, false);
      drawBrow(anchors.browRight, np.browLeft, true);
      drawBrow(anchors.browLeft, np.browRight, false);
    } else {
      drawEye(anchors.leftEye, np.eyeLeft, true);
      drawEye(anchors.rightEye, np.eyeRight, false);
      drawBrow(anchors.browLeft, np.browLeft, true);
      drawBrow(anchors.browRight, np.browRight, false);
    }
    drawMouth(anchors.mouth, np.mouthOpen, np.mouthSmile);
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
