// receiver 端简化的程序化球体模块
export function createSphereMesh(opts = {}) {
  return { rings: opts.rings || 12, segments: opts.segments || 20, radius: opts.radius || 60 };
}
export function deformSphere(mesh, params = {}) {
  return { ...mesh, params };
}
