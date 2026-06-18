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
 * 返回 0~1 的软权重：1 为面部中心，0 为非面部区域。
 */
function getFaceWeight(t, angle) {
  // t 在 0.02 ~ 0.22 之间，角度在 [-55°, +55°]，随距离高斯衰减。
  const tCenter = 0.12;
  const tHalf = 0.10;
  const angleDeg = angle * 180 / Math.PI;
  const angleHalf = 55;

  const dt = (t - tCenter) / tHalf;
  const da = angleDeg / angleHalf;

  const val = Math.exp(-(dt * dt + da * da));

  // 只在 t 和 angle 的合理范围内生效；背部不参与。
  if (t < 0.02 || t > 0.28) return 0;
  if (Math.abs(angle) > Math.PI * 0.75) return 0;
  return val;
}

// -------------------- 网格生成 --------------------

export function createSpindleMesh(options = {}) {
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
export function computeFaceAnchor(mesh, bodyT, surfAngle, surfaceOffset = 0) {
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
