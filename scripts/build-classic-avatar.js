/**
 * build-classic-avatar.js
 *
 * 将 src/face-tracking/{mesh-sphere,mesh-spindle-whale,procedural-mesh-renderer}.js
 * 合并为单一经典脚本 procedural-avatar-classic.js，用于验证 ES Module 兼容性。
 *
 * 用法：
 *   node scripts/build-classic-avatar.js
 *
 * 输出：
 *   src/face-tracking/procedural-avatar-classic.js
 *
 * 【2026-06-20 冻结说明】
 *   本脚本曾同时输出到 android-capture/app/src/main/assets/web/demo/，
 *   但因 Android APP 功能已移交参赛项目独立开发，主项目不再
 *   不再写入 Android assets 目录。Android 侧如需最新脚本，由参赛项目
 *   在其独立仓库中自行维护。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src', 'face-tracking');
// ANDROID_DEMO 输出路径已冻结（2026-06-20）
// const ANDROID_DEMO = path.join(ROOT, 'android-capture', 'app', 'src', 'main', 'assets', 'web', 'demo');

function load(name) {
  return fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
}

/**
 * 把模块文件去 import/export：
 *   - 移除 import ... from './...'; 开头行
 *   - export function -> function
 *   - export class -> class
 *   - 末尾添加 window 挂载
 */
function stripModule(raw, moduleName) {
  // 先去掉多行 "import { ... } from '...';" 块
  let out = raw.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"\n]+['"];?\s*\n?/g, '');
  // 再去掉单行 import
  out = out.replace(/^import[^\n]*;\s*\n?/gm, '');
  // "export function foo(...)" -> "function foo(...)"
  out = out.replace(/^export\s+function\s+/gm, 'function ');
  // "export class Foo" -> "class Foo"
  out = out.replace(/^export\s+class\s+/gm, 'class ');
  // "export const FOO = ..." -> "const FOO = ..."（保留赋值语句）
  out = out.replace(/^export\s+const\s+/gm, 'const ');
  // "export let FOO = ..." -> "let FOO = ..."（保留赋值语句）
  out = out.replace(/^export\s+let\s+/gm, 'let ');
  // "export { ... }" -> 空行
  out = out.replace(/^export\s*\{[\s\S]*?\};?\s*\n?/gm, '');
  return `\n// ========[ ${moduleName} ]========\n${out}\n`;
}

const meshSphere = stripModule(load('mesh-sphere.js'), 'mesh-sphere');
const meshWhale = stripModule(load('mesh-spindle-whale.js'), 'mesh-spindle-whale');
const renderer = stripModule(load('procedural-mesh-renderer.js'), 'procedural-mesh-renderer');

// 将 renderer 中原本挂到 window 的代码替换为完整的显式导出
const banner =
  '/* procedural-avatar-classic.js —— 由 src/face-tracking/*.js 派生。\n' +
  ' * 用于 Android WebView / 不支持 ES Module import 的环境。\n' +
  ' * 自动生成，请勿手工修改。\n' +
  ' */\n\n' +
  '(function () {\n' +
  '  "use strict";\n\n' +
  '  // ----- 几何模块 -----';

const tail =
  '\n\n' +
  '  // ========[ 显式挂到 window ]========\n' +
  '  if (typeof window !== "undefined") {\n' +
  '    window.CheapLiveProceduralMeshRenderer = ProceduralMeshRenderer;\n' +
  '    window.ProceduralSphereAvatar = ProceduralSphereAvatar;\n' +
  '    window.ProceduralSpindleWhaleAvatar = ProceduralSpindleWhaleAvatar;\n' +
  '    window.createSphereAvatar = createSphereAvatar;\n' +
  '    window.createSpindleWhaleAvatar = createSpindleWhaleAvatar;\n' +
  '    window.createSpindleMesh = createSpindleMesh;\n' +
  '    window.createSphereMesh = createSphereMesh;\n' +
  '    window.computeFaceAnchor = computeFaceAnchor;\n' +
  '    window.computeSphereFaceAnchor = computeSphereFaceAnchor;\n' +
  '  }\n' +
  '})();\n';

const combined = banner + meshSphere + meshWhale + renderer + tail;

// 仅写入 src/face-tracking/ 供网页验证
// Android assets 目录已冻结，不再写入（2026-06-20）
fs.writeFileSync(path.join(SRC_DIR, 'procedural-avatar-classic.js'), combined, 'utf8');

console.log('OK, wrote procedural-avatar-classic.js to:');
console.log('  -', path.join(SRC_DIR, 'procedural-avatar-classic.js'));
console.log('（Android assets 目录已冻结，不再同步）');
