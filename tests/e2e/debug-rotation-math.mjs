// 直接在 Node.js 中测试旋转顺序，不依赖浏览器

// 当前代码使用的旋转顺序: _transformVec 在 procedural-mesh-renderer.js 第333-350行
// R = Rz * Rx * Ry (先 yaw, 再 pitch, 再 roll，都是世界固定轴)

// 测试点：局部 rightVec = (tx, ty, tz) = (0.95, 0, 0.30)
// 测试点：局部 downVec = (bx, by, bz) = (-0.03, 0.95, 0.10)

// 模拟不同旋转顺序下 rightVec 在屏幕上的投影方向

function transformVecOld(x, y, z, angleY, angleX, angleZ) {
  // 当前代码: Y -> X -> Z
  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  let x1 = x * cosY + z * sinY;
  let z1 = -x * sinY + z * cosY;
  let y1 = y;
  let y2 = y1 * cosX - z1 * sinX;
  let z2 = y1 * sinX + z1 * cosX;
  let x2 = x1;
  let x3 = x2 * cosZ - y2 * sinZ;
  let y3 = x2 * sinZ + y2 * cosZ;
  let z3 = z2;
  return { x: x3, y: y3, z: z3 };
}

function transformVecNew(x, y, z, angleY, angleX, angleZ) {
  // 新顺序: Z -> X -> Y (先 roll, 再 pitch, 再 yaw)
  // 即: v' = Ry * Rx * Rz * v
  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

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
  return { x: x3, y: y3, z: z3 };
}

// 局部 rightVec：球面切向量，主要沿 +x 方向，有轻微 +z 分量
const rightVec = { x: 0.95, y: 0, z: 0.30 };
// 局部 downVec：球面切向量，主要沿 +y 方向，有轻微 +z 分量
const downVec = { x: -0.03, y: 0.95, z: 0.10 };

console.log('=== 左眼 rightVec 方向测试 ===');
console.log('局部 rightVec:', `(${rightVec.x}, ${rightVec.y}, ${rightVec.z})`);
console.log('');
console.log('yaw/pitch  |  旧顺序(Y→X→Z)  |  新顺序(Z→X→Y)');
console.log('           |  angle | (x,y)  |  angle | (x,y)');
console.log('-----------|------------------|------------------');

const testCases = [
  { yaw: 0, pitch: 0 },
  { yaw: 30, pitch: 0 },
  { yaw: 0, pitch: 30 },
  { yaw: 30, pitch: 30 },
  { yaw: 45, pitch: 15 },
  { yaw: 45, pitch: 30 },
  { yaw: 60, pitch: 30 },
  { yaw: 90, pitch: 30 },
  { yaw: -30, pitch: 30 },
  { yaw: -45, pitch: 30 },
];

for (const tc of testCases) {
  const oldT = transformVecOld(rightVec.x, rightVec.y, rightVec.z, tc.yaw, tc.pitch, 0);
  const newT = transformVecNew(rightVec.x, rightVec.y, rightVec.z, tc.yaw, tc.pitch, 0);

  const oldAngle = Math.atan2(oldT.y, oldT.x) * 180 / Math.PI;
  const newAngle = Math.atan2(newT.y, newT.x) * 180 / Math.PI;

  console.log(
    `${tc.yaw.toString().padStart(3)}/${tc.pitch.toString().padStart(3)}   |  ${oldAngle.toFixed(1).padStart(5)}°  (${oldT.x.toFixed(2)}, ${oldT.y.toFixed(2)})  |  ${newAngle.toFixed(1).padStart(5)}°  (${newT.x.toFixed(2)}, ${newT.y.toFixed(2)})`
  );
}

console.log('\n=== 附加测试：极端角度下方向 ===');
console.log('角度 = atan2(rightVec.y, rightVec.x) —— 0° 表示水平，90° 表示竖直（眼睛横过来）');
console.log('');

// 测试 pure pitch 情况下 rightVec 是否保持水平
console.log('Pure pitch (yaw=0):');
for (const pitch of [0, 30, 60, 90]) {
  const oldT = transformVecOld(rightVec.x, rightVec.y, rightVec.z, 0, pitch, 0);
  const newT = transformVecNew(rightVec.x, rightVec.y, rightVec.z, 0, pitch, 0);
  console.log(`  pitch=${pitch}°: 旧顺序 angle=${Math.atan2(oldT.y, oldT.x) * 180 / Math.PI | 0}°, 新顺序 angle=${Math.atan2(newT.y, newT.x) * 180 / Math.PI | 0}°`);
}

console.log('\nPure yaw (pitch=0):');
for (const yaw of [0, 30, 60, 90]) {
  const oldT = transformVecOld(rightVec.x, rightVec.y, rightVec.z, yaw, 0, 0);
  const newT = transformVecNew(rightVec.x, rightVec.y, rightVec.z, yaw, 0, 0);
  console.log(`  yaw=${yaw}°: 旧顺序 angle=${Math.atan2(oldT.y, oldT.x) * 180 / Math.PI | 0}°, 新顺序 angle=${Math.atan2(newT.y, newT.x) * 180 / Math.PI | 0}°`);
}

console.log('\n=== 附加测试：downVec 是否保持竖直 ===');
console.log('downVec 在纯 pitch 下应保持 (0, 1, 0) 方向');
for (const pitch of [0, 30, 60, 90]) {
  const oldT = transformVecOld(downVec.x, downVec.y, downVec.z, 0, pitch, 0);
  const newT = transformVecNew(downVec.x, downVec.y, downVec.z, 0, pitch, 0);
  console.log(`  pitch=${pitch}°: 旧顺序 angle=${Math.atan2(oldT.y, oldT.x) * 180 / Math.PI | 0}°（应为90°）, 新顺序 angle=${Math.atan2(newT.y, newT.x) * 180 / Math.PI | 0}°`);
}
