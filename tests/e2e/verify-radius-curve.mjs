// 验证新的 radiusScale 曲线（修正后的余弦衰减）

const SPHERE_END = 0.26;
const TAIL_RATIO = 0.035;

function radiusScale(s) {
  if (s <= SPHERE_END) {
    const rel = SPHERE_END - s;
    const r2 = SPHERE_END * SPHERE_END - rel * rel;
    return Math.sqrt(Math.max(0, r2)) / SPHERE_END;
  }
  const t = (s - SPHERE_END) / (1 - SPHERE_END) * (Math.PI / 2);
  return TAIL_RATIO + (1 - TAIL_RATIO) * Math.cos(t);
}

function radiusScaleDeriv(s) {
  const h = 0.002;
  if (s <= h) return (radiusScale(s + h) - radiusScale(s)) / h;
  if (s >= 1 - h) return (radiusScale(s) - radiusScale(s - h)) / h;
  return (radiusScale(s + h) - radiusScale(s - h)) / (2 * h);
}

console.log('=== 新半径曲线（headX=70, headY=58）修正后 ===');
console.log('s     | r(s)    | rx     | ry     | deriv');
console.log('------|---------|--------|--------|-------');

for (let s = 0; s <= 1.01; s += 0.05) {
  const sc = radiusScale(s);
  const scDer = radiusScaleDeriv(s);
  const rx = 70 * sc;
  const ry = 58 * sc * (0.88 + 0.12 * sc);
  console.log(`${s.toFixed(2)} | ${sc.toFixed(3)} | ${rx.toFixed(1)} | ${ry.toFixed(1)} | ${scDer.toFixed(3)}`);
}

console.log('\n=== 关键指标 ===');
console.log(`s=${SPHERE_END}: r=${radiusScale(SPHERE_END).toFixed(4)}, deriv≈0`);
console.log(`s=1.0: r=${radiusScale(1.0).toFixed(4)} (应为 ≈${TAIL_RATIO})`);

// ASCII 轮廓图
console.log('\n=== ry 侧视轮廓（头部+身体+尾巴）===');
const maxRy = 58;
const width = 50;
const rows = Array.from({length: 18}, () => new Array(width+1).fill(' '));
const cols = [];
for (let s = 0; s <= 1.001; s += 0.02) {
  const sc = radiusScale(s);
  const ry = 58 * sc * (0.88 + 0.12 * sc);
  const rx = 70 * sc;
  const row = Math.round((1 - s) * (rows.length - 1));
  const ryHalf = Math.round(ry / maxRy * (width / 2));
  const rxHalf = Math.round(rx / maxRy * (width / 2));
  const center = Math.round(width / 2);
  for (let c = center - ryHalf; c <= center + ryHalf; c++) {
    if (c >= 0 && c <= width) rows[row][c] = '█';
  }
  cols.push({row, rxHalf, center});
}
for (const {row, rxHalf, center} of cols) {
  for (let c = center - rxHalf; c <= center + rxHalf; c++) {
    if (c >= 0 && c <= width) {
      rows[row][c] = rows[row][c] === '█' ? '█' : '░';
    }
  }
}
for (const row of rows) console.log('|' + row.join('') + '|');
console.log(' ' + '-'.repeat(width + 2));
console.log('头部                                              尾巴');
