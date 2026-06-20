/**
 * Spindle whale mesh dry-run 不变量测试
 *
 * 目标：
 *   - 在一组 yaw 角度 (0°, ±30°, ±45°, ±60°) 下调用 createSpindleMesh + deformSpindle
 *   - 断言：
 *       1) 所有顶点/锚点坐标、法线均为有限值
 *       2) 所有面的 indices 均在 [0, vertices.length) 范围内
 *       3) 没有退化面（3 点共线或面积为零）
 *       4) 法线基本朝外（头部半球 nz > 0 的比例合理）
 *       5) 主体 (head) 在正面可见；尾鳍在大 yaw 时也有可见比例
 *   - flukeEnabled=true 与 flukeEnabled=false 两个分支都测试
 *
 * 运行：
 *   node tests/unit/spindle-dry-run.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SRC = path.join(REPO_ROOT, 'src', 'face-tracking');

const meshWhale = await import(`file://${path.join(SRC, 'mesh-spindle-whale.js')}`);
const { createSpindleMesh, deformSpindle } = meshWhale;

function isFinite3(x, y, z) {
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
}

function cross2D(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function triangleAreaSq2D(ax, ay, bx, by, cx, cy) {
  const ux = bx - ax, uy = by - ay;
  const vx = cx - ax, vy = cy - ay;
  const c = cross2D(ux, uy, vx, vy);
  return c * c; // 用两倍有符号面积的平方度量退化
}

function faceIsDegenerate(face, tol2 = 1e-10) {
  const v = face.vertices;
  if (!v || v.length < 3) return true;
  // 索引去重后少于 3 → 真退化
  const seen = new Set();
  let hasDupIdx = false;
  for (const i of face.indices) {
    if (seen.has(i)) { hasDupIdx = true; break; }
    seen.add(i);
  }
  if (hasDupIdx || seen.size < 3) return true;
  // 三角形：仅 [0,1,2]。
  // 四边形：拆分为 [0,1,2]、[0,2,3]、[1,2,3]；任一子三角退化即视为整体退化。
  const triplets = [[0, 1, 2]];
  if (v.length >= 4) {
    triplets.push([0, 2, 3]);
    triplets.push([1, 2, 3]);
  }
  for (const [a, b, c] of triplets) {
    const ux = v[b].x - v[a].x, uy = v[b].y - v[a].y, uz = v[b].z - v[a].z;
    const vxx = v[c].x - v[a].x, vyy = v[c].y - v[a].y, vzz = v[c].z - v[a].z;
    const cx = uy * vzz - uz * vyy;
    const cy = uz * vxx - ux * vzz;
    const cz = ux * vyy - uy * vxx;
    const m2 = cx * cx + cy * cy + cz * cz;
    if (m2 <= tol2) return true;
  }
  return false;
}

function analyzeMesh(mesh) {
  const N = mesh.vertices.length;
  let finiteCount = 0;
  let headNzPos = 0;
  let headTotal = 0;
  let bodyNzPos = 0;
  let bodyTotal = 0;

  for (let i = 0; i < N; i++) {
    const v = mesh.vertices[i];
    if (
      Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z) &&
      Number.isFinite(v.nx) && Number.isFinite(v.ny) && Number.isFinite(v.nz) &&
      // 若 deformSpindle 后带有 tx/ty/tz，也一并校验有限
      (v.tx === undefined || Number.isFinite(v.tx)) &&
      (v.ty === undefined || Number.isFinite(v.ty)) &&
      (v.tz === undefined || Number.isFinite(v.tz))
    ) finiteCount++;
    if (v.isHead) {
      headTotal++;
      if (v.nz > 0) headNzPos++;
    } else {
      bodyTotal++;
      if (v.nz > 0) bodyNzPos++;
    }
  }

  const F = mesh.faces.length;
  let idxOk = 0;
  let nonDeg = 0;
  let nzVisibleFaces = 0;

  for (let i = 0; i < F; i++) {
    const f = mesh.faces[i];
    const idx = f.indices;
    let ok = idx.length >= 3;
    for (let j = 0; j < idx.length; j++) {
      if (!Number.isFinite(idx[j]) || idx[j] < 0 || idx[j] >= N) ok = false;
    }
    if (ok) idxOk++;
    if (!faceIsDegenerate(f)) nonDeg++;

    // 平均 nz > -0.05 视为可绘制（与 renderer 的剔除一致）
    let avgNz = 0;
    for (let k = 0; k < f.vertices.length; k++) avgNz += f.vertices[k].nz;
    avgNz /= f.vertices.length;
    if (f.doubleSided || avgNz > -0.05) nzVisibleFaces++;
  }

  return {
    vertices: N,
    faces: F,
    finiteVertices: finiteCount,
    headNzPos, headTotal,
    bodyNzPos, bodyTotal,
    indexOkFaces: idxOk,
    nonDegenerateFaces: nonDeg,
    visibleFaces: nzVisibleFaces,
  };
}

const YAW_ANGLES = [0, -30, 30, -45, 45, -60, 60];

describe('spindle dry-run — 顶点/索引/退化 不变量', () => {
  for (const fluke of [true, false]) {
    for (const yaw of YAW_ANGLES) {
      it(`fluke=${fluke}, yaw=${yaw}°：所有顶点/法线有限、索引合法、无退化面`, () => {
        const mesh = createSpindleMesh({ flukeEnabled: fluke });
        const deformed = deformSpindle(mesh, { angleY: yaw });
        const stats = analyzeMesh(deformed);

        assert.equal(stats.finiteVertices, stats.vertices,
          `存在非有限顶点/法线（${stats.finiteVertices}/${stats.vertices}）`);
        assert.equal(stats.indexOkFaces, stats.faces,
          `存在索引越界的面（${stats.indexOkFaces}/${stats.faces}）`);
        assert.equal(stats.nonDegenerateFaces, stats.faces,
          `存在退化面（${stats.nonDegenerateFaces}/${stats.faces}）`);
      });
    }
  }
});

describe('spindle dry-run — 头部法线朝 +Z 比例', () => {
  for (const fluke of [true, false]) {
    it(`fluke=${fluke}, yaw=0°：头部至少 40% 顶点 nz > 0`, () => {
      const mesh = createSpindleMesh({ flukeEnabled: fluke });
      const deformed = deformSpindle(mesh, { angleY: 0 });
      const stats = analyzeMesh(deformed);
      assert.ok(stats.headTotal > 0, '头部顶点数应为正');
      const ratio = stats.headNzPos / stats.headTotal;
      assert.ok(ratio >= 0.40,
        `头部 nz>0 比例=${ratio.toFixed(3)}，低于 0.40 阈值，法线可能反了`);
    });

    it(`fluke=${fluke}, yaw=±60°：仍有 ≥ 15% 面可见（不整体消失）`, () => {
      for (const yaw of [-60, 60]) {
        const mesh = createSpindleMesh({ flukeEnabled: fluke });
        const deformed = deformSpindle(mesh, { angleY: yaw });
        const stats = analyzeMesh(deformed);
        const ratio = stats.visibleFaces / stats.faces;
        assert.ok(ratio >= 0.15,
          `yaw=${yaw}° 可见面比例=${ratio.toFixed(3)}，低于 0.15；鱼可能整体消失`);
      }
    });
  }
});

describe('spindle dry-run — 退化检测的负向用例', () => {
  it('人工退化三角形（顶点 0/1/2 共线）应被判定为退化', () => {
    const fakeFace = {
      indices: [0, 1, 2],
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
    };
    assert.ok(faceIsDegenerate(fakeFace), '共线三点应被判定为退化');
  });

  it('人工退化四边形（3 落在 2-0 边上）应被判定为退化', () => {
    const fakeFace = {
      indices: [0, 1, 2, 3],
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0.5, y: 0.5, z: 0 }, // 在 0-2 边上
      ],
    };
    assert.ok(faceIsDegenerate(fakeFace), '存在退化子三角的四边形应被判定为退化');
  });

  it('人工非退化四边形不应被判定为退化', () => {
    const fakeFace = {
      indices: [0, 1, 2, 3],
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
    };
    assert.ok(!faceIsDegenerate(fakeFace), '单位方块不应被判定为退化');
  });

  it('重复索引的四边形应被判定为退化', () => {
    const fakeFace = {
      indices: [0, 0, 1, 2],
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
    };
    assert.ok(faceIsDegenerate(fakeFace), '重复索引应被判定为退化');
  });
});
