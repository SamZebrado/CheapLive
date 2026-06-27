// 简化的程序化球体变形（供 Android capture 页使用）
// 为极简实现，不依赖主仓库 mesh-sphere.js，避免跨文件拷贝。
export function createSphereMesh(opts = {}) {
  return { rings: opts.rings || 12, segments: opts.segments || 20, radius: opts.radius || 60 };
}
export function deformSphere(mesh, params = {}) {
  return { ...mesh, params };
}
export function computeVertexLight(_, __) {
  return { dot: 0.6, ambient: 0.4 };
}
export function computeSphereFaceColor(face, light, mesh) {
  return { r: 200, g: 190, b: 170 };
}
