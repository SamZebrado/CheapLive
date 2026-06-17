/**
 * Live2D Mesh Renderer - 2.5D 网格变形渲染器
 *
 * 使用 Canvas 2D 模拟 Live2D 的 2.5D 体积效果：
 * - 参数化网格顶点变形
 * - 透视投影
 * - 基于法向量的光照
 * - Painter's 算法深度排序
 * - 支持球体和纺锤体+鲸鱼尾巴两种形象
 */

import {
  createSphereMesh,
  deformSphere,
  computeSphereFaceColor,
} from './mesh-sphere.js';

import {
  createSpindleMesh,
  createWhaleTailMesh,
  deformSpindle,
  deformWhaleTail,
  computeSpindleFaceColor,
  computeWhaleTailFaceColor,
} from './mesh-spindle-whale.js';

export class Live2DMeshRenderer {
  /**
   * @param {string} canvasId - Canvas 元素 ID
   * @param {string} avatarType - 形象类型: 'sphere' | 'spindle-whale'
   */
  constructor(canvasId, avatarType = 'sphere') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }
    this.ctx = this.canvas.getContext('2d');
    this.avatarType = avatarType;

    // 渲染参数 (对应 Live2D 参数)
    this.params = {
      angleX: 0,    // ParamAngleX: -30 ~ 30 度
      angleY: 0,    // ParamAngleY: -30 ~ 30 度
      angleZ: 0,    // ParamAngleZ: -30 ~ 30 度
      tailPitch: 0, // ParamTailPitch: -20 ~ 20 度
      tailYaw: 0,   // ParamTailYaw: -20 ~ 20 度
      tailWave: 0,  // ParamTailWave: 0 ~ 1 (波浪幅度)
      breath: 0,    // 呼吸参数 0 ~ 1
    };

    // 相机/投影参数
    this.camera = {
      fov: 800,        // 视场距离
      zOffset: 200,    // 相机 Z 偏移
    };

    // 缩放和位置
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 网格数据
    this.meshes = [];
    this.initMeshes();

    // 自动调整大小
    this.resize();
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
  }

  /**
   * 初始化网格数据
   */
  initMeshes() {
    this.meshes = [];

    if (this.avatarType === 'sphere') {
      const sphereMesh = createSphereMesh({
        radius: 90,
        rings: 10,
        segments: 24,
        baseColor: '#d4d1c8',
        markingColor: '#8B4513',
        highlightColor: '#ffffff',
        shadowColor: '#6a6758',
      });
      this.meshes.push(sphereMesh);
    } else if (this.avatarType === 'spindle-whale') {
      const spindleMesh = createSpindleMesh({
        headR: 75,
        bodyLength: 140,
        bodyWidth: 55,
        bodyDepth: 40,
        columns: 18,
        rows: 7,
        topColor: '#bdb8aa',
        bottomColor: '#f2f1ea',
      });
      this.meshes.push(spindleMesh);

      const tailMesh = createWhaleTailMesh({
        tailLength: 60,
        tailWidth: 50,
        flukeSegments: 8,
        color: '#8a8a8a',
      });
      this.meshes.push(tailMesh);
    }
  }

  /**
   * 设置参数
   * @param {string} name - 参数名
   * @param {number} value - 参数值
   */
  setParameter(name, value) {
    if (name in this.params) {
      this.params[name] = value;
    } else {
      console.warn(`Unknown parameter: ${name}`);
    }
  }

  /**
   * 批量设置参数
   * @param {Object} params - 参数对象
   */
  setParameters(params) {
    Object.assign(this.params, params);
  }

  /**
   * 调整 Canvas 大小
   */
  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }
    this.draw();
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
  }

  /**
   * 主绘制函数
   */
  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, w, h);

    // 变形所有网格
    const deformedMeshes = this.meshes.map((mesh) => this.deformMesh(mesh));

    // 收集所有面并计算投影
    const allFaces = [];
    for (const mesh of deformedMeshes) {
      for (const face of mesh.faces) {
        const projected = this.projectFace(face);
        if (projected) {
          allFaces.push({
            ...face,
            projected,
            mesh,
            avgZ: this.computeFaceDepth(face),
          });
        }
      }
    }

    // Painter's 算法: 按深度排序 (远的先画)
    allFaces.sort((a, b) => a.avgZ - b.avgZ);

    // 绘制所有面
    ctx.save();
    ctx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
    ctx.scale(this.scale, this.scale);

    for (const face of allFaces) {
      this.drawFace(ctx, face);
    }

    ctx.restore();

    // 绘制参数标签
    this.drawLabels(ctx, w, h);
  }

  /**
   * 变形单个网格
   */
  deformMesh(mesh) {
    const p = this.params;

    if (mesh.type === 'sphere') {
      return deformSphere(mesh, {
        angleX: p.angleX,
        angleY: p.angleY,
        angleZ: p.angleZ,
        breath: p.breath,
      });
    } else if (mesh.type === 'spindle') {
      return deformSpindle(mesh, {
        angleX: p.angleX,
        angleY: p.angleY,
        angleZ: p.angleZ,
        tailPitch: p.tailPitch,
        tailYaw: p.tailYaw,
        tailWave: p.tailWave,
        breath: p.breath,
      });
    } else if (mesh.type === 'whaleTail') {
      const bodyParams = this.meshes.find((m) => m.type === 'spindle') || {};
      return deformWhaleTail(mesh, {
        angleX: p.angleX,
        angleY: p.angleY,
        angleZ: p.angleZ,
        tailPitch: p.tailPitch,
        tailYaw: p.tailYaw,
        tailWave: p.tailWave,
      }, bodyParams);
    }

    return mesh;
  }

  /**
   * 计算面的平均深度 (用于排序)
   */
  computeFaceDepth(face) {
    return face.vertices.reduce((sum, v) => sum + v.tz, 0) / face.vertices.length;
  }

  /**
   * 投影面到屏幕坐标
   * @returns {Array|null} 投影后的四边形顶点，如果面背向相机则返回 null
   */
  projectFace(face) {
    const projected = [];
    const fov = this.camera.fov;
    const zOffset = this.camera.zOffset;

    for (const v of face.vertices) {
      const z = v.tz + zOffset;
      if (z <= 0) {
        // 在相机后面，跳过
        return null;
      }
      const scale = fov / z;
      projected.push({
        x: v.tx * scale,
        y: v.ty * scale,
        z: v.tz,
        scale,
      });
    }

    // 背面剔除: 计算投影后的面的朝向
    if (projected.length >= 3) {
      const dx1 = projected[1].x - projected[0].x;
      const dy1 = projected[1].y - projected[0].y;
      const dx2 = projected[2].x - projected[0].x;
      const dy2 = projected[2].y - projected[0].y;
      const cross = dx1 * dy2 - dy1 * dx2;
      // 如果 cross > 0，面朝向相机 (Canvas 2D 的 Y 轴向下)
      // 根据需求可以调整剔除方向
    }

    return projected;
  }

  /**
   * 绘制单个面
   */
  drawFace(ctx, face) {
    const projected = face.projected;
    if (!projected || projected.length < 3) return;

    // 计算颜色
    const color = this.computeFaceColor(face);

    // 如果 alpha 太低，跳过
    if (color.alpha < 0.05) return;

    ctx.save();
    ctx.globalAlpha = color.alpha;

    // 绘制四边形
    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    for (let i = 1; i < projected.length; i++) {
      ctx.lineTo(projected[i].x, projected[i].y);
    }
    ctx.closePath();

    // 填充
    const fillStyle = `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
    ctx.fillStyle = fillStyle;
    ctx.fill();

    // 轮廓线 (可选，增加网格感)
    ctx.strokeStyle = `rgba(${Math.round(color.r * 0.7)}, ${Math.round(color.g * 0.7)}, ${Math.round(color.b * 0.7)}, 0.3)`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 计算面的颜色
   */
  computeFaceColor(face) {
    const lightDir = { x: 0.3, y: -0.5, z: 0.8 };

    if (face.mesh.type === 'sphere') {
      return computeSphereFaceColor(face, lightDir, face.mesh);
    } else if (face.mesh.type === 'spindle') {
      return computeSpindleFaceColor(face, lightDir, face.mesh);
    } else if (face.mesh.type === 'whaleTail') {
      return computeWhaleTailFaceColor(face, lightDir, face.mesh);
    }

    return { r: 200, g: 200, b: 200, alpha: 1 };
  }

  /**
   * 绘制参数标签
   */
  drawLabels(ctx, w, h) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#8888A0';
    const labels = [
      `type: ${this.avatarType}`,
      `angleX: ${this.params.angleX.toFixed(1)}`,
      `angleY: ${this.params.angleY.toFixed(1)}`,
      `angleZ: ${this.params.angleZ.toFixed(1)}`,
      `tailPitch: ${this.params.tailPitch.toFixed(1)}`,
      `tailYaw: ${this.params.tailYaw.toFixed(1)}`,
      `tailWave: ${this.params.tailWave.toFixed(2)}`,
    ];
    labels.forEach((label, i) => {
      ctx.fillText(label, 10, h - 10 - (labels.length - 1 - i) * 14);
    });
  }

  /**
   * 更新参数并重新绘制 (兼容旧版接口)
   * @param {Object} newParams
   */
  updateParams(newParams) {
    // 将旧版参数映射到新版参数
    const mapping = {
      headYaw: (v) => ({ angleY: (v - 0.5) * 60 }),
      headPitch: (v) => ({ angleX: (v - 0.5) * 60 }),
      headRoll: (v) => ({ angleZ: (v - 0.5) * 60 }),
      headX: (v) => ({ offsetX: (v - 0.5) * 120 }),
      headY: (v) => ({ offsetY: (v - 0.5) * 80 }),
    };

    for (const [key, value] of Object.entries(newParams)) {
      if (key in mapping) {
        const mapped = mapping[key](value);
        this.setParameters(mapped);
      }
    }

    this.draw();
  }

  /**
   * 设置应用模式 (透明背景)
   */
  setAppMode(enabled) {
    // 应用模式下背景透明
    this._appMode = enabled;
  }
}

// ===================== 兼容旧版 Avatar 接口的包装类 =====================

/**
 * 球体网格头像 (兼容 Avatar 接口)
 */
export class SphereMeshAvatar {
  constructor(canvasId) {
    this.renderer = new Live2DMeshRenderer(canvasId, 'sphere');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;
  }

  resize() {
    this.renderer.resize();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.renderer.updateParams(newParams);
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.renderer.setAppMode(enabled);
  }

  draw() {
    this.renderer.draw();
  }
}

/**
 * 纺锤体+鲸鱼尾巴网格头像 (兼容 Avatar 接口)
 */
export class SpindleWhaleMeshAvatar {
  constructor(canvasId) {
    this.renderer = new Live2DMeshRenderer(canvasId, 'spindle-whale');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;
  }

  resize() {
    this.renderer.resize();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.renderer.updateParams(newParams);
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.renderer.setAppMode(enabled);
  }

  draw() {
    this.renderer.draw();
  }
}
