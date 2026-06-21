// 验证五官旋转矩阵问题：yaw右+pitch抬头时眼睛横过来
// 调试不同旋转顺序下的 rightVec 方向

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const page = await context.newPage();

await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

console.log('=== 测试五官锚点旋转 ===');

// 直接调用 _transformVec 和 computeSphereFaceAnchorXYZ
const result = await page.evaluate(() => {
  // 获取 avatar 实例
  const avatar = window.faceTracker.avatar;
  const mesh = avatar.mesh || window.faceTracker.mesh;

  // 直接调用 avatar 的内部函数
  // 测试不同 yaw/pitch 组合下左眼和右眼 rightVec 的方向
  const testPoints = [];

  const leftEyeOffset = { horizOffset: -mesh.radius * 0.32, vertOffset: -mesh.radius * 0.15 };
  const rightEyeOffset = { horizOffset: mesh.radius * 0.32, vertOffset: -mesh.radius * 0.15 };

  const yawValues = [0, 15, 30, 45, 60, -30, -45, -60];
  const pitchValues = [0, 15, 30, 45, -30];

  for (const yaw of yawValues) {
    for (const pitch of pitchValues) {
      // 左眼
      const leftAnchor = computeSphereFaceAnchorXYZ(mesh, leftEyeOffset.horizOffset, leftEyeOffset.vertOffset, 2);
      const leftTransform = avatar._transformAnchor(leftAnchor, { angleY: yaw, angleX: pitch, angleZ: 0 }, 500, 350, 300);
      const leftAngle = Math.atan2(leftTransform.rightVec.y, leftTransform.rightVec.x) * 180 / Math.PI;

      // 右眼
      const rightAnchor = computeSphereFaceAnchorXYZ(mesh, rightEyeOffset.horizOffset, rightEyeOffset.vertOffset, 2);
      const rightTransform = avatar._transformAnchor(rightAnchor, { angleY: yaw, angleX: pitch, angleZ: 0 }, 500, 350, 300);
      const rightAngle = Math.atan2(rightTransform.rightVec.y, rightTransform.rightVec.x) * 180 / Math.PI;

      testPoints.push({
        yaw, pitch,
        leftAngle: leftAngle.toFixed(1),
        rightAngle: rightAngle.toFixed(1),
        leftRightVec: `(${leftTransform.rightVec.x.toFixed(2)}, ${leftTransform.rightVec.y.toFixed(2)})`,
        rightRightVec: `(${rightTransform.rightVec.x.toFixed(2)}, ${rightTransform.rightVec.y.toFixed(2)})`,
      });
    }
  }

  // 测试不同旋转顺序
  const oldOrder = (x, y, z, yaw, pitch, roll) => {
    const radY = yaw * Math.PI / 180;
    const radX = pitch * Math.PI / 180;
    const radZ = roll * Math.PI / 180;
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
    // 当前代码的顺序: Y -> X -> Z
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
  };

  const newOrder = (x, y, z, yaw, pitch, roll) => {
    const radY = yaw * Math.PI / 180;
    const radX = pitch * Math.PI / 180;
    const radZ = roll * Math.PI / 180;
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
    // 新顺序: Z -> X -> Y (先roll, 再 pitch, 再 yaw)
    // Z:
    let x1 = x * cosZ - y * sinZ;
    let y1 = x * sinZ + y * cosZ;
    let z1 = z;
    // X:
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;
    let x2 = x1;
    // Y:
    let x3 = x2 * cosY + z2 * sinY;
    let z3 = -x2 * sinY + z2 * cosY;
    let y3 = y2;
    return { x: x3, y: y3, z: z3 };
  };

  return {
    testPoints,
    debug: {
      leftEyeLocal: computeSphereFaceAnchorXYZ(mesh, leftEyeOffset.horizOffset, leftEyeOffset.vertOffset, 2),
      meshRadius: mesh.radius,
    }
  };
});

console.log('\n网格半径:', result.debug.meshRadius);
console.log('左眼局部切向量 (rightVec/tx,ty,tz):',
  `(${result.debug.leftEyeLocal.tx.toFixed(2)}, ${result.debug.leftEyeLocal.ty.toFixed(2)}, ${result.debug.leftEyeLocal.tz.toFixed(2)})`);

console.log('\n=== 当前旋转顺序（Y→X→Z）下眼睛朝向角度:');
console.log('yaw | pitch | 左眼角度 | 右眼角度 | 左眼 rightVec | 右眼 rightVec');
console.log('-----|-------|---------|---------|---------------|---------------');
for (const p of result.testPoints) {
  console.log(`${p.yaw.toString().padStart(4)}/${p.pitch.toString().padStart(3)} |  ${p.leftAngle.padStart(6)} |  ${p.rightAngle.padStart(6)} | ${p.leftRightVec} | ${p.rightRightVec}`);
}

await browser.close();
console.log('\n完成！');
