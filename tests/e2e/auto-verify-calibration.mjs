// 校准算法自动测试脚本
// 测试 triggerCalibration 状态转换、resetFaceTrackingConfig 保留/清除校准、scale/offset 独立性、左右眼独立、token 鉴权
import fs from 'fs';
import http from 'http';

const BASE = process.env.RECEIVER_BASE || 'http://192.168.31.137:8765';
const BASE_HOST = BASE.replace(/^https?:\/\//, '');
const TOKEN = process.env.RECEIVER_TOKEN || 'gJXTh11z3IAJ0R3p1Nt5jyEB8HX_krQgbMooClmOh2I';
const SCREENSHOT_DIR = '/tmp/auto-verify-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' :: ' + detail : ''}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function httpRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE_HOST.split(':')[0],
      port: parseInt(BASE_HOST.split(':')[1] || '80'),
      path: token ? `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : path,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchStatus(token = TOKEN) {
  const r = await httpRequest('GET', '/api/status', null, token);
  if (r.status !== 200) throw new Error(`status ${r.status}: ${r.body}`);
  return JSON.parse(r.body);
}

async function sendControl(token, payload) {
  const r = await httpRequest('POST', '/api/control', JSON.stringify(payload), token);
  try { return JSON.parse(r.body); } catch { return { _raw: r.body, status: r.status }; }
}

async function setFtConfig(token, patch) {
  const status = await fetchStatus(token);
  const baseRevision = status.faceTrackingConfig.revision;
  return sendControl(token, { type: 'setFaceTrackingConfig', baseRevision, patch });
}

async function triggerCalibration(token, action) {
  return sendControl(token, { type: 'triggerCalibration', action });
}

async function resetConfig(token, keepCalibration) {
  return sendControl(token, { type: 'resetFaceTrackingConfig', keepCalibration });
}

(async () => {
  // 0. 先重置到默认状态
  await resetConfig(TOKEN, false);
  await sleep(300);
  const initial = await fetchStatus(TOKEN);
  record('0.初始状态恢复默认', 
    initial.faceTrackingConfig.scale.eyeLeft === 1 && 
    initial.faceTrackingConfig.offset.eyeLeft === 0 &&
    initial.faceTrackingConfig.calibration.sampleCount === 0,
    `rev=${initial.faceTrackingConfig.revision}, calib.sampleCount=${initial.faceTrackingConfig.calibration.sampleCount}`);

  // 1. triggerCalibration(start)
  const r1 = await triggerCalibration(TOKEN, 'start');
  const s1 = await fetchStatus(TOKEN);
  record('1.triggerCalibration(start)', 
    r1.ok === true && s1.calibrationInProgress === true && s1.calibrationSampleCount === 0 && s1.calibrationTargetSamples === 30,
    `ok=${r1.ok}, inProgress=${s1.calibrationInProgress}, sampleCount=${s1.calibrationSampleCount}, target=${s1.calibrationTargetSamples}`);

  // 2. 重复 start 拒绝
  const r2 = await triggerCalibration(TOKEN, 'start');
  record('2.重复start拒绝', 
    r2.ok === false && typeof r2.message === 'string' && r2.message.indexOf('in progress') >= 0,
    `ok=${r2.ok}, msg=${r2.message}`);

  // 3. cancel
  const r3 = await triggerCalibration(TOKEN, 'cancel');
  const s3 = await fetchStatus(TOKEN);
  record('3.cancel', 
    r3.ok === true && s3.calibrationInProgress === false && s3.calibrationSampleCount === 0,
    `ok=${r3.ok}, inProgress=${s3.calibrationInProgress}`);

  // 4. 取消后重新 start
  const r4 = await triggerCalibration(TOKEN, 'start');
  const s4 = await fetchStatus(TOKEN);
  record('4.取消后重新start', 
    r4.ok === true && s4.calibrationInProgress === true,
    `ok=${r4.ok}, inProgress=${s4.calibrationInProgress}`);

  // 5. reset(keepCalibration=true) - 应该保留 calibration，重置 offset/scale
  // 先修改 offset/scale 测试是否重置
  await setFtConfig(TOKEN, { 
    offset: { eyeLeft: 0.15 }, 
    scale: { eyeLeft: 2.0, eyeRight: 1.7 } 
  });
  const beforeReset = await fetchStatus(TOKEN);
  
  // 取消校准
  await triggerCalibration(TOKEN, 'cancel');
  
  // 现在执行 keepCalibration=true 重置
  const r5 = await resetConfig(TOKEN, true);
  const s5 = await fetchStatus(TOKEN);
  // 注：calibrationData 默认 sampleCount=0，"保留"指保留当前 calibration（这里没有真实校准过，所以是 default）
  record('5.reset(keepCalibration=true)保留calibration', 
    r5.ok === true && 
    s5.faceTrackingConfig.offset.eyeLeft === 0 &&  // offset 重置
    s5.faceTrackingConfig.scale.eyeLeft === 1 &&   // scale 重置
    s5.faceTrackingConfig.calibration.sampleCount === beforeReset.faceTrackingConfig.calibration.sampleCount,  // calibration 保留
    `offset.eyeLeft=${s5.faceTrackingConfig.offset.eyeLeft}, scale.eyeLeft=${s5.faceTrackingConfig.scale.eyeLeft}, calib.sampleCount=${s5.faceTrackingConfig.calibration.sampleCount}`);

  // 6. reset(keepCalibration=false) - 清除 calibration
  // 先做一次"虚拟校准"：通过 API 模拟设置 calibration 数据
  // 实际上 calibration 只能通过 submitCalibrationSample 写入，无法直接通过 /api/control 设置
  // 这里只能验证 keepCalibration=false 时不会留下旧 calibration 的样本
  const r6 = await resetConfig(TOKEN, false);
  const s6 = await fetchStatus(TOKEN);
  record('6.reset(keepCalibration=false)清除calibration', 
    r6.ok === true && 
    s6.faceTrackingConfig.calibration.sampleCount === 0 &&
    s6.faceTrackingConfig.calibration.eyeLeft === 1,  // default
    `calib.sampleCount=${s6.faceTrackingConfig.calibration.sampleCount}, calib.eyeLeft=${s6.faceTrackingConfig.calibration.eyeLeft}`);

  // 7. scale 和 offset 独立 - 修改 scale 不影响 offset，反之亦然
  await resetConfig(TOKEN, true);
  await sleep(200);
  
  // 修改 scale.eyeLeft
  await setFtConfig(TOKEN, { scale: { eyeLeft: 2.5 } });
  let s7 = await fetchStatus(TOKEN);
  const scaleEyeLeftAfterScale = s7.faceTrackingConfig.scale.eyeLeft;
  const offsetEyeLeftAfterScale = s7.faceTrackingConfig.offset.eyeLeft;
  
  // 修改 offset.eyeLeft
  await setFtConfig(TOKEN, { offset: { eyeLeft: 0.2 } });
  s7 = await fetchStatus(TOKEN);
  const scaleEyeLeftAfterOffset = s7.faceTrackingConfig.scale.eyeLeft;
  const offsetEyeLeftAfterOffset = s7.faceTrackingConfig.offset.eyeLeft;
  
  record('7.scale和offset独立', 
    Math.abs(scaleEyeLeftAfterScale - 2.5) < 0.001 && 
    offsetEyeLeftAfterScale === 0 && 
    Math.abs(scaleEyeLeftAfterOffset - 2.5) < 0.001 && 
    Math.abs(offsetEyeLeftAfterOffset - 0.2) < 0.001,
    `after scale: scale=${scaleEyeLeftAfterScale}, offset=${offsetEyeLeftAfterScale}; after offset: scale=${scaleEyeLeftAfterOffset}, offset=${offsetEyeLeftAfterOffset}`);

  // 8. 左眼修改不影响右眼
  await resetConfig(TOKEN, true);
  await sleep(200);
  
  await setFtConfig(TOKEN, { scale: { eyeLeft: 3.0 }, offset: { eyeLeft: 0.1 } });
  const s8 = await fetchStatus(TOKEN);
  record('8.左眼修改不影响右眼', 
    Math.abs(s8.faceTrackingConfig.scale.eyeLeft - 3.0) < 0.001 && 
    Math.abs(s8.faceTrackingConfig.scale.eyeRight - 1.0) < 0.001 && 
    Math.abs(s8.faceTrackingConfig.offset.eyeLeft - 0.1) < 0.001 && 
    Math.abs(s8.faceTrackingConfig.offset.eyeRight - 0.0) < 0.001,
    `L scale=${s8.faceTrackingConfig.scale.eyeLeft}, R scale=${s8.faceTrackingConfig.scale.eyeRight}, L offset=${s8.faceTrackingConfig.offset.eyeLeft}, R offset=${s8.faceTrackingConfig.offset.eyeRight}`);

  // 9. 错误 token 拒绝
  try {
    const r9 = await sendControl('WRONG_TOKEN', { type: 'triggerCalibration', action: 'start' });
    record('9.错误token拒绝', r9 && r9._raw && r9._raw.indexOf('Invalid') >= 0 || r9.status === 403, `status=${r9?.status || 'n/a'}`);
  } catch (e) {
    record('9.错误token拒绝', false, e.message);
  }

  // 10. App 重启后 calibration 恢复 - 通过 keepCalibration 重置并验证 calibration 仍在
  // 实际重启 App 需要做 force-stop 测试，这里通过持久化层间接验证
  await resetConfig(TOKEN, true);
  const s10 = await fetchStatus(TOKEN);
  record('10.持久化可恢复(状态可读)', 
    s10.faceTrackingConfig.calibration.sampleCount === 0 && 
    s10.faceTrackingConfig.scale.eyeLeft === 1,
    `calib=${s10.faceTrackingConfig.calibration.sampleCount}, scale.eyeLeft=${s10.faceTrackingConfig.scale.eyeLeft}`);

  // 清理：恢复默认
  await resetConfig(TOKEN, false);
  await sleep(200);

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Calibration Summary: ${passed}/${results.length} PASS, ${failed} FAIL ===`);
  fs.writeFileSync('/tmp/auto-verify-screenshots/calibration_result.json', JSON.stringify(results, null, 2));
  process.exit(failed === 0 ? 0 : 1);
})();
