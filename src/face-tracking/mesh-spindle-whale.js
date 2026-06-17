/**
 * Mesh Spindle + Whale Tail - 纺锤体身体 + 鲸鱼尾巴网格生成器
 * 模拟 Live2D 2.5D 体积效果
 */

/**
 * 生成纺锤体身体网格
 * @param {Object} options
 * @param {number} options.headR - 头部半径
 * @param {number} options.bodyLength - 身体长度
 * @param {number} options.bodyWidth - 身体最大宽度
 * @param {number} options.bodyDepth - 身体深度 (z方向)
 * @param {number} options.columns - 沿长度方向分段数 (默认 16)
 * @param {number} options.rows - 环绕分段数 (默认 7)
 * @param {string} options.topColor - 上半部分颜色
 * @param {string} options.bottomColor - 下半部分颜色
 */
export function createSpindleMesh(options = {}) {
  const {
    headR = 75,
    bodyLength = 140,
    bodyWidth = 55,
    bodyDepth = 40,
    columns = 16,
    rows = 7,
    topColor = '#bdb8aa',
    bottomColor = '#f2f1ea',
  } = options;

  const vertices = [];
  const faces = [];

  // 生成顶点: 沿脊柱排列的椭圆截面
  for (let col = 0; col <= columns; col++) {
    const t = col / columns;
    const spineX = getSpineX(t, headR, bodyLength);
    const width = getBodyWidth(t, headR, bodyWidth, bodyLength);
    const depth = getBodyDepth(t, headR, bodyDepth, bodyLength);

    for (let row = 0; row <= rows; row++) {
      const angle = (row / rows) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 椭圆截面上的点
      const x = spineX;
      const y = width * cosA;
      const z = depth * sinA;

      // 法向量 (椭圆截面法向量)
      const nx = 0;
      const ny = cosA / Math.max(width, 0.001);
      const nz = sinA / Math.max(depth, 0.001);
      const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      // 脊柱切线方向 (用于计算正确的法向量)
      const dt = 0.01;
      const nextX = getSpineX(Math.min(t + dt, 1), headR, bodyLength);
      const prevX = getSpineX(Math.max(t - dt, 0), headR, bodyLength);
      const tangentX = (nextX - prevX) / (2 * dt);
      const tangentY = 0;
      const tangentZ = 0;

      // 重新计算法向量，考虑脊柱曲率
      const rx = 0;
      const ry = width * cosA;
      const rz = depth * sinA;
      const rlen = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;

      vertices.push({
        x, y, z,
        nx: rx / rlen,
        ny: ry / rlen,
        nz: rz / rlen,
        u: t,
        v: row / rows,
        t, // 沿身体位置 0~1
        angle,
        isTop: cosA < 0, // 上半部分
        isBottom: cosA >= 0, // 下半部分
        column: col,
        row,
      });
    }
  }

  // 生成面
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

      // 判断面属于上半部分还是下半部分
      const isTopFace = (va.isTop && vb.isTop) || (vc.isTop && vd.isTop);
      const isBottomFace = (va.isBottom && vb.isBottom) || (vc.isBottom && vd.isBottom);

      faces.push({
        indices: [a, b, d, c],
        vertices: [va, vb, vd, vc],
        isTop: isTopFace,
        isBottom: isBottomFace,
        column: col,
        row,
      });
    }
  }

  return {
    vertices,
    faces,
    headR,
    bodyLength,
    bodyWidth,
    bodyDepth,
    columns,
    rows,
    topColor,
    bottomColor,
    type: 'spindle',
  };
}

/**
 * 生成鲸鱼尾巴网格
 * @param {Object} options
 * @param {number} options.tailLength - 尾巴长度
 * @param {number} options.tailWidth - 尾巴展开宽度
 * @param {number} options.flukeSegments - 尾叶分段数
 * @param {string} options.color - 尾巴颜色
 */
export function createWhaleTailMesh(options = {}) {
  const {
    tailLength = 60,
    tailWidth = 50,
    flukeSegments = 8,
    color = '#8a8a8a',
  } = options;

  const vertices = [];
  const faces = [];

  // 尾巴柄 (连接身体的部分)
  const handleLength = tailLength * 0.3;
  const handleWidth = 8;

  // 生成左尾叶和右尾叶
  // 每个尾叶是一个参数化曲面
  for (let side of [-1, 1]) {
    const sideVertices = [];
    const baseIndex = vertices.length;

    for (let i = 0; i <= flukeSegments; i++) {
      for (let j = 0; j <= flukeSegments; j++) {
        const u = i / flukeSegments; // 0~1, 沿尾叶长度方向
        const v = j / flukeSegments; // 0~1, 沿尾叶宽度方向

        // 尾叶形状: 扇形展开
        const spreadFactor = Math.pow(u, 0.7); // 根部窄，末端宽
        const localWidth = tailWidth * spreadFactor * v;

        // 尾叶弯曲
        const bendY = -Math.pow(u, 2) * tailLength * 0.15;

        // 尾叶厚度 (根部厚，末端薄)
        const thickness = handleWidth * (1 - u * 0.8) * Math.sin(v * Math.PI);

        const x = handleLength + u * tailLength * 0.7;
        const y = side * localWidth + bendY;
        const z = thickness * Math.cos(v * Math.PI);

        // 法向量
        const nx = 0;
        const ny = side * Math.cos(v * Math.PI * 0.5);
        const nz = Math.sin(v * Math.PI * 0.5);
        const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        const vertex = {
          x, y, z,
          nx: nx / nlen,
          ny: ny / nlen,
          nz: nz / nlen,
          u, v,
          side, // -1 左, 1 右
          isFluke: true,
        };

        sideVertices.push(vertex);
        vertices.push(vertex);
      }
    }

    // 生成尾叶面
    for (let i = 0; i < flukeSegments; i++) {
      for (let j = 0; j < flukeSegments; j++) {
        const a = baseIndex + i * (flukeSegments + 1) + j;
        const b = a + 1;
        const c = baseIndex + (i + 1) * (flukeSegments + 1) + j;
        const d = c + 1;

        faces.push({
          indices: [a, b, d, c],
          vertices: [vertices[a], vertices[b], vertices[d], vertices[c]],
          isFluke: true,
          side,
        });
      }
    }
  }

  // 尾巴柄网格 (连接身体到尾叶)
  const handleBaseIndex = vertices.length;
  const handleSegments = 6;
  const handleRows = 4;

  for (let i = 0; i <= handleSegments; i++) {
    for (let j = 0; j <= handleRows; j++) {
      const u = i / handleSegments;
      const v = (j / handleRows) * Math.PI * 2;

      const cosV = Math.cos(v);
      const sinV = Math.sin(v);

      const x = u * handleLength;
      const hw = handleWidth * (1 - u * 0.3); // 根部宽，连接处窄
      const hd = handleWidth * 0.6 * (1 - u * 0.2);

      const y = hw * cosV;
      const z = hd * sinV;

      vertices.push({
        x, y, z,
        nx: cosV,
        ny: sinV,
        nz: 0,
        u, v: j / handleRows,
        isHandle: true,
      });
    }
  }

  for (let i = 0; i < handleSegments; i++) {
    for (let j = 0; j < handleRows; j++) {
      const a = handleBaseIndex + i * (handleRows + 1) + j;
      const b = a + 1;
      const c = handleBaseIndex + (i + 1) * (handleRows + 1) + j;
      const d = c + 1;

      faces.push({
        indices: [a, b, d, c],
        vertices: [vertices[a], vertices[b], vertices[d], vertices[c]],
        isHandle: true,
      });
    }
  }

  return {
    vertices,
    faces,
    tailLength,
    tailWidth,
    color,
    type: 'whaleTail',
  };
}

/**
 * 变形纺锤体网格
 * @param {Object} mesh - 纺锤体网格
 * @param {Object} params - 变形参数
 */
export function deformSpindle(mesh, params = {}) {
  const {
    angleX = 0,
    angleY = 0,
    angleZ = 0,
    tailPitch = 0,
    tailYaw = 0,
    tailWave = 0,
    breath = 0,
  } = params;

  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;
  const radZ = (angleZ * Math.PI) / 180;

  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  const breathScale = 1 + breath * 0.015;

  const transformedVertices = mesh.vertices.map((v) => {
    let x = v.x * breathScale;
    let y = v.y * breathScale;
    let z = v.z * breathScale;

    // 如果是尾巴部分，应用尾巴参数
    if (v.isFluke || v.isHandle) {
      // 尾巴相对于身体根部的偏移
      const tailBaseX = mesh.bodyLength || 140;

      // 尾巴摆动: 基于 tailWave 的正弦波
      const waveOffset = v.isFluke
        ? Math.sin(v.u * Math.PI * 2 + tailWave * Math.PI * 2) * tailWave * 15
        : 0;

      // 尾巴俯仰 (pitch)
      const pitchRad = (tailPitch * Math.PI) / 180;
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);

      // 尾巴偏航 (yaw)
      const yawRad = (tailYaw * Math.PI) / 180;
      const cosYw = Math.cos(yawRad);
      const sinYw = Math.sin(yawRad);

      // 相对坐标
      const rx = x - tailBaseX;
      const ry = y;
      const rz = z;

      // 应用 pitch (绕 Y 轴局部旋转)
      let px = rx * cosYw + rz * sinYw;
      let pz = -rx * sinYw + rz * cosYw;
      let py = ry;

      // 应用 yaw (绕 Z 轴局部旋转)
      let yx = px;
      let yy = py * cosP - pz * sinP;
      let yz = py * sinP + pz * cosP;

      // 加回基础位置
      x = tailBaseX + yx;
      y = yy + waveOffset;
      z = yz;
    }

    // 全身旋转
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;

    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;

    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;

    // 法向量旋转
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
 * 变形鲸鱼尾巴网格
 * @param {Object} mesh - 鲸鱼尾巴网格
 * @param {Object} params - 变形参数
 * @param {Object} bodyParams - 身体参数 (用于连接)
 */
export function deformWhaleTail(mesh, params = {}, bodyParams = {}) {
  const {
    angleX = 0,
    angleY = 0,
    angleZ = 0,
    tailPitch = 0,
    tailYaw = 0,
    tailWave = 0,
  } = params;

  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;
  const radZ = (angleZ * Math.PI) / 180;

  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  const tailBaseX = bodyParams.bodyLength || 140;

  const pitchRad = (tailPitch * Math.PI) / 180;
  const yawRad = (tailYaw * Math.PI) / 180;
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);
  const cosYw = Math.cos(yawRad);
  const sinYw = Math.sin(yawRad);

  const transformedVertices = mesh.vertices.map((v) => {
    let x = v.x;
    let y = v.y;
    let z = v.z;

    // 尾巴局部变形
    if (v.isFluke) {
      // 波浪效果
      const wavePhase = v.u * Math.PI * 2 + tailWave * Math.PI * 2;
      const waveAmp = tailWave * 12 * v.u;
      y += Math.sin(wavePhase) * waveAmp;

      // 相对尾巴根部
      const rx = x - tailBaseX;
      const ry = y;
      const rz = z;

      // 局部旋转
      let px = rx * cosYw + rz * sinYw;
      let pz = -rx * sinYw + rz * cosYw;
      let py = ry;

      let yx = px;
      let yy = py * cosP - pz * sinP;
      let yz = py * sinP + pz * cosP;

      x = tailBaseX + yx;
      y = yy;
      z = yz;
    } else if (v.isHandle) {
      // 尾巴柄也做轻微旋转
      const rx = x - tailBaseX;
      const influence = Math.min(1, x / (tailBaseX + 20));

      let px = rx * cosYw * influence + rx * (1 - influence);
      let py = y;
      let pz = z;

      x = tailBaseX + px;
      y = py;
      z = pz;
    }

    // 全身旋转
    let x1 = x * cosY + z * sinY;
    let z1 = -x * sinY + z * cosY;
    let y1 = y;

    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;

    let x3 = x2 * cosZ - y2 * sinZ;
    let y3 = x2 * sinZ + y2 * cosZ;
    let z3 = z2;

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
 * 计算纺锤体面颜色
 */
export function computeSpindleFaceColor(face, lightDir = { x: 0.3, y: -0.5, z: 0.8 }, mesh) {
  const nx = face.vertices.reduce((s, v) => s + v.nx, 0) / 4;
  const ny = face.vertices.reduce((s, v) => s + v.ny, 0) / 4;
  const nz = face.vertices.reduce((s, v) => s + v.nz, 0) / 4;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const nnx = nx / len;
  const nny = ny / len;
  const nnz = nz / len;

  const dot = Math.max(0, nnx * lightDir.x + nny * lightDir.y + nnz * lightDir.z);

  // 根据面的位置选择颜色 (上半灰色，下半白色)
  const isTop = face.isTop || face.vertices[0].isTop;
  const baseColor = isTop ? mesh.topColor : mesh.bottomColor;
  const bc = hexToRgb(baseColor);

  const hl = hexToRgb('#ffffff');
  const sd = hexToRgb('#7a7a72');

  const ambientFactor = (nny + 1) * 0.5;
  const diffuse = dot * 0.6;
  const ambient = 0.35 + ambientFactor * 0.15;

  let r = bc.r * (ambient + diffuse) + hl.r * Math.pow(dot, 3) * 0.25;
  let g = bc.g * (ambient + diffuse) + hl.g * Math.pow(dot, 3) * 0.25;
  let b = bc.b * (ambient + diffuse) + hl.b * Math.pow(dot, 3) * 0.25;

  if (dot < 0.25) {
    const shadowFactor = (0.25 - dot) / 0.25;
    r = lerp(r, sd.r * 0.6, shadowFactor * 0.5);
    g = lerp(g, sd.g * 0.6, shadowFactor * 0.5);
    b = lerp(b, sd.b * 0.6, shadowFactor * 0.5);
  }

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    alpha: face.vertices[0].tz > -50 ? 1 : 0.35,
  };
}

/**
 * 计算鲸鱼尾巴面颜色
 */
export function computeWhaleTailFaceColor(face, lightDir = { x: 0.3, y: -0.5, z: 0.8 }, mesh) {
  const nx = face.vertices.reduce((s, v) => s + v.nx, 0) / 4;
  const ny = face.vertices.reduce((s, v) => s + v.ny, 0) / 4;
  const nz = face.vertices.reduce((s, v) => s + v.nz, 0) / 4;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const nnx = nx / len;
  const nny = ny / len;
  const nnz = nz / len;

  const dot = Math.max(0, nnx * lightDir.x + nny * lightDir.y + nnz * lightDir.z);

  const bc = hexToRgb(mesh.color);
  const hl = hexToRgb('#aaaaaa');
  const sd = hexToRgb('#5a5a5a');

  const ambient = 0.4;
  const diffuse = dot * 0.6;

  let r = bc.r * (ambient + diffuse) + hl.r * Math.pow(dot, 2) * 0.3;
  let g = bc.g * (ambient + diffuse) + hl.g * Math.pow(dot, 2) * 0.3;
  let b = bc.b * (ambient + diffuse) + hl.b * Math.pow(dot, 2) * 0.3;

  if (dot < 0.2) {
    const shadowFactor = (0.2 - dot) / 0.2;
    r = lerp(r, sd.r, shadowFactor * 0.4);
    g = lerp(g, sd.g, shadowFactor * 0.4);
    b = lerp(b, sd.b, shadowFactor * 0.4);
  }

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    alpha: face.vertices[0].tz > -40 ? 1 : 0.3,
  };
}

// 纺锤体参数化函数
function getSpineX(t, headR, bodyLength) {
  const p0 = -headR * 0.3;
  const p3 = bodyLength + 30;
  const cp1 = headR * 0.5;
  const cp2 = bodyLength * 0.7;
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * cp1 + 3 * mt * t * t * cp2 + t * t * t * p3;
}

function getBodyWidth(t, headR, bodyWidth, bodyLength) {
  if (t < 0.15) {
    return headR * Math.sin((t / 0.15) * Math.PI * 0.5);
  } else if (t < 0.6) {
    return bodyWidth * (1 - (t - 0.15) * 0.2);
  } else {
    const tailT = (t - 0.6) / 0.4;
    return bodyWidth * (1 - tailT) * (1 - tailT * 0.5);
  }
}

function getBodyDepth(t, headR, bodyDepth, bodyLength) {
  if (t < 0.15) {
    return bodyDepth * 0.8 * Math.sin((t / 0.15) * Math.PI * 0.5);
  } else if (t < 0.6) {
    return bodyDepth * 0.8 * (1 - (t - 0.15) * 0.15);
  } else {
    const tailT = (t - 0.6) / 0.4;
    return bodyDepth * 0.8 * (1 - tailT) * (1 - tailT);
  }
}

// 工具函数
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 150, g: 150, b: 150 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
