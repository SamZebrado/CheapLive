/**
 * Procedural Mesh Renderer - 程序化 Canvas 2.5D 网格 Avatar
 *
 * 使用 Canvas 2D 实现 2.5D 体积效果：
 * - 背面剔除、顶点平滑光照、抗锯齿外扩
 * - 五官驱动：眼睛、嘴巴、眉毛
 * - 自动取景
 * - 支持球体和纺锤体+鲸鱼尾巴
 *
 * 注意：这不是 Live2D Cubism 模型。
 */

import { createSphereMesh, deformSphere, computeVertexLight } from './mesh-sphere.js';
import { createSpindleMesh, createWhaleTailMesh, deformSpindle, deformWhaleTail } from './mesh-spindle-whale.js';

// ===================== 主渲染器 =====================

export class ProceduralMeshRenderer {
  constructor(canvasId, avatarType) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.avatarType = avatarType;

    // 参数
    this.angleX = 0; this.angleY = 0; this.angleZ = 0;
    this.tailPitch = 0; this.tailYaw = 0; this.tailWave = 0;
    this.offsetX = 0; this.offsetY = 0;
    this.breath = 0;
    this.scale = 1;

    // 五官参数
    this.eyeLeft = 1; this.eyeRight = 1;
    this.mouthOpen = 0; this.mouthSmile = 0;
    this.browLeft = 0; this.browRight = 0;

    // 调试
    this.debugShowMesh = false;
    this.debugShowLabels = false;

    // 投影参数
    this.fov = 600;
    this.zOffset = 180;

    // 光照
    this.lightDir = { x: 0.35, y: -0.45, z: 0.85 };

    // 初始化网格
    this._initMesh();
    this.deformed = null;
    this.autoScale = 1;

    // 高 DPI
    this._dpr = window.devicePixelRatio || 1;
  }

  _initMesh() {
    if (this.avatarType === 'sphere') {
      this.baseMesh = createSphereMesh({ radius: 80, rings: 16, segments: 24, spotColor: '#8b7355' });
    } else {
      this.spindleMesh = createSpindleMesh({
        headR: 75, bodyLength: 140, bodyWidth: 55, bodyDepth: 40, columns: 18, rows: 9,
        topColor: '#bdb8aa', bottomColor: '#f2f1ea',
      });
      this.tailMesh = createWhaleTailMesh({
        tailLength: 60, tailWidth: 50, flukeSegments: 8, color: '#8a8a8a',
      });
    }
  }

  setParameters(params) {
    if (params.angleX !== undefined) this.angleX = params.angleX;
    if (params.angleY !== undefined) this.angleY = params.angleY;
    if (params.angleZ !== undefined) this.angleZ = params.angleZ;
    if (params.tailPitch !== undefined) this.tailPitch = params.tailPitch;
    if (params.tailYaw !== undefined) this.tailYaw = params.tailYaw;
    if (params.tailWave !== undefined) this.tailWave = params.tailWave;
    if (params.offsetX !== undefined) this.offsetX = params.offsetX;
    if (params.offsetY !== undefined) this.offsetY = params.offsetY;
    if (params.breath !== undefined) this.breath = params.breath;
    if (params.eyeLeft !== undefined) this.eyeLeft = params.eyeLeft;
    if (params.eyeRight !== undefined) this.eyeRight = params.eyeRight;
    if (params.mouthOpen !== undefined) this.mouthOpen = params.mouthOpen;
    if (params.mouthSmile !== undefined) this.mouthSmile = params.mouthSmile;
    if (params.browLeft !== undefined) this.browLeft = params.browLeft;
    if (params.browRight !== undefined) this.browRight = params.browRight;
    if (params.scale !== undefined) this.scale = params.scale;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this._dpr;

    // 设置高 DPI backing store
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);

    // 背景
    if (this.appMode !== true) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }

    if (this.avatarType === 'sphere') {
      this._drawSphere(ctx, w, h);
    } else {
      this._drawSpindleWhale(ctx, w, h);
    }

    if (this.debugShowLabels) {
      this._drawLabels(ctx, w, h);
    }
  }

  // ===================== 球体 =====================

  _drawSphere(ctx, w, h) {
    const deformParams = {
      angleX: this.angleX, angleY: this.angleY, angleZ: this.angleZ,
      breath: this.breath,
    };
    this.deformed = deformSphere(this.baseMesh, deformParams);

    const cx = w / 2 + this.offsetX;
    const cy = h / 2 + this.offsetY;

    // 计算 auto scale
    const projFaces = this._projectAll(this.deformed.faces);
    const bbox = this._computeBBox(projFaces);
    this.autoScale = this._calcAutoScale(bbox, w, h);

    const useScale = this.scale * this.autoScale;

    ctx.save();
    ctx.translate(cx, cy);

    // 绘制面（背面剔除 + 无描边）
    const sorted = this._sortByDepth(projFaces);
    for (const pf of sorted) {
      if (pf.culled) continue;
      this._drawFace(ctx, pf, useScale, this.deformed);
    }

    // 绘制五官
    this._drawFacialFeatures(ctx, useScale);

    // 调试网格
    if (this.debugShowMesh) {
      for (const pf of sorted) {
        if (pf.culled) continue;
        this._drawFaceWire(ctx, pf, useScale);
      }
    }
    ctx.restore();
  }

  // ===================== 纺锤体+鲸鱼尾巴 =====================

  _drawSpindleWhale(ctx, w, h) {
    const deformParams = {
      angleX: this.angleX, angleY: this.angleY, angleZ: this.angleZ,
      tailPitch: this.tailPitch, tailYaw: this.tailYaw, tailWave: this.tailWave,
      breath: this.breath,
    };
    this.deformed = deformSpindle(this.spindleMesh, deformParams);
    this.deformedTail = deformWhaleTail(this.tailMesh, deformParams, this.spindleMesh);

    const cx = w / 2 + this.offsetX;
    const cy = h / 2 + this.offsetY;

    // 合并所有投影面
    const allProj = [
      ...this._projectAll(this.deformed.faces),
      ...this._projectAll(this.deformedTail.faces),
    ];

    const bbox = this._computeBBox(allProj);
    this.autoScale = this._calcAutoScale(bbox, w, h);
    const useScale = this.scale * this.autoScale;

    ctx.save();
    ctx.translate(cx, cy);

    // 深度排序
    const sorted = this._sortByDepth(allProj);
    for (const pf of sorted) {
      if (pf.culled) continue;
      const mesh = pf.isFluke || pf.isHandle ? this.deformedTail : this.deformed;
      this._drawFace(ctx, pf, useScale, mesh);
    }

    // 调试网格
    if (this.debugShowMesh) {
      for (const pf of sorted) {
        if (pf.culled) continue;
        this._drawFaceWire(ctx, pf, useScale);
      }
    }

    // 绘制五官
    this._drawFacialFeatures(ctx, useScale);

    ctx.restore();
  }

  // ===================== 投影 =====================

  _projectAll(faces) {
    const fov = this.fov;
    const zOff = this.zOffset;
    return faces.map(f => this._projectFace(f, fov, zOff));
  }

  _projectFace(face, fov, zOff) {
    const vs = face.vertices;
    const projected = vs.map(v => {
      const z = v.tz + zOff;
      const p = z > 0.1 ? fov / z : fov / 0.1;
      return {
        px: v.tx * p,
        py: v.ty * p,
        pz: v.tz,
        v, // 保留原始顶点引用
      };
    });

    // 背面剔除
    const ax = projected[1].px - projected[0].px;
    const ay = projected[1].py - projected[0].py;
    const bx = projected[2].px - projected[0].px;
    const by = projected[2].py - projected[0].py;
    const cross = ax * by - ay * bx;
    const culled = cross <= 0;

    const avgZ = projected.reduce((s, p) => s + p.pz, 0) / projected.length;

    return {
      projected,
      avgZ,
      culled,
      face,
      isFluke: face.isFluke,
      isHandle: face.isHandle,
      isTop: face.isTop,
      isBottom: face.isBottom,
    };
  }

  // ===================== 绘制 =====================

  _drawFace(ctx, pf, scale, mesh) {
    const pts = pf.projected;
    const s = scale;

    // 顶点光照（平滑插值）
    const colors = pts.map(p => {
      const v = p.v;
      const nx = v.nx || 0, ny = v.ny || 0, nz = v.nz || 0;
      const l = this.lightDir;
      const dot = Math.max(0, nx * l.x + ny * l.y + nz * l.z);
      return this._shadeVertex(dot, v, mesh);
    });

    // 使用平均颜色，实现平滑面
    const avgR = colors.reduce((s, c) => s + c.r, 0) / colors.length;
    const avgG = colors.reduce((s, c) => s + c.g, 0) / colors.length;
    const avgB = colors.reduce((s, c) => s + c.b, 0) / colors.length;

    ctx.beginPath();
    ctx.moveTo(pts[0].px * s, pts[0].py * s);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].px * s, pts[i].py * s);
    }
    ctx.closePath();

    ctx.fillStyle = `rgb(${Math.round(avgR)},${Math.round(avgG)},${Math.round(avgB)})`;
    ctx.fill();
  }

  _drawFaceWire(ctx, pf, scale) {
    const pts = pf.projected;
    const s = scale;
    ctx.beginPath();
    ctx.moveTo(pts[0].px * s, pts[0].py * s);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].px * s, pts[i].py * s);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,255,128,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  _shadeVertex(dot, vertex, mesh) {
    // 基础颜色选择
    let baseR, baseG, baseB;
    if (mesh.type === 'sphere') {
      // 球体：米白色主体
      baseR = 235; baseG = 230; baseB = 220;
      // 表面标记（棕色斑点）- 只在局部区域
      if (vertex.spot > 0.6) {
        const sf = Math.min(1, (vertex.spot - 0.6) / 0.4);
        baseR = 235 * (1 - sf) + 180 * sf;
        baseG = 230 * (1 - sf) + 155 * sf;
        baseB = 220 * (1 - sf) + 120 * sf;
      }
    } else if (mesh.type === 'spindle') {
      // 纺锤体：上灰下白
      if (vertex.isTop) {
        baseR = 189; baseG = 184; baseB = 170;
      } else {
        baseR = 242; baseG = 241; baseB = 234;
      }
    } else {
      // 尾巴
      baseR = 138; baseG = 138; baseB = 138;
    }

    // 环境光 + 漫反射 + 高光
    const ambient = 0.6;
    const diffuse = dot * 0.35;
    const specular = Math.pow(Math.max(0, dot - 0.5), 3) * 0.12;

    const r = baseR * (ambient + diffuse) + 255 * specular;
    const g = baseG * (ambient + diffuse) + 255 * specular;
    const b = baseB * (ambient + diffuse) + 255 * specular;

    // 柔和阴影
    const shadow = dot < 0.3 ? (0.3 - dot) / 0.3 * 0.3 : 0;

    return {
      r: Math.max(0, Math.min(255, r * (1 - shadow))),
      g: Math.max(0, Math.min(255, g * (1 - shadow))),
      b: Math.max(0, Math.min(255, b * (1 - shadow))),
    };
  }

  // ===================== 五官 =====================

  _drawFacialFeatures(ctx, scale) {
    const s = scale;
    const yaw = this.angleY * Math.PI / 180;
    const pitch = this.angleX * Math.PI / 180;
    const roll = this.angleZ * Math.PI / 180;

    // 定义五官锚点（模型局部坐标）
    const anchors = [];

    if (this.avatarType === 'sphere') {
      anchors.push(
        { type: 'eye', side: 'left',  x: -28, y: -15, z: 65, openness: this.eyeLeft },
        { type: 'eye', side: 'right', x: 28,  y: -15, z: 65, openness: this.eyeRight },
        { type: 'mouth', x: 0, y: 28, z: 60, openness: this.mouthOpen, smile: this.mouthSmile },
        { type: 'brow', side: 'left',  x: -28, y: -38, z: 62, value: this.browLeft },
        { type: 'brow', side: 'right', x: 28,  y: -38, z: 62, value: this.browRight },
      );
    } else {
      // 纺锤鲸鱼：五官在头部区域
      anchors.push(
        { type: 'eye', side: 'left',  x: -30, y: -12, z: 50, openness: this.eyeLeft },
        { type: 'eye', side: 'right', x: 15,  y: -12, z: 50, openness: this.eyeRight },
        { type: 'mouth', x: -5, y: 28, z: 45, openness: this.mouthOpen, smile: this.mouthSmile },
        { type: 'brow', side: 'left',  x: -30, y: -35, z: 48, value: this.browLeft },
        { type: 'brow', side: 'right', x: 15,  y: -35, z: 48, value: this.browRight },
      );
    }

    // 旋转并投影五官
    const projected = anchors.map(a => {
      const r = this._rotate3D(a.x, a.y, a.z, yaw, pitch, roll);
      const z = r.z + this.zOffset;
      const p = z > 0.1 ? this.fov / z : this.fov / 0.1;
      return { ...a, px: r.x * p * s, py: r.y * p * s, pz: r.z, persp: p / (this.fov / (80 + this.zOffset)) };
    });

    // 按深度排序
    projected.sort((a, b) => a.pz - b.pz);

    for (const f of projected) {
      const opacity = f.pz > -30 ? 1 : Math.max(0, 1 - (Math.abs(f.pz + 30) / 50));
      if (opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = opacity;

      if (f.type === 'eye') {
        this._drawEye(ctx, f.px, f.py, f.persp, f.openness, f.side, yaw);
      } else if (f.type === 'mouth') {
        this._drawMouth(ctx, f.px, f.py, f.persp, f.openness, f.smile);
      } else if (f.type === 'brow') {
        this._drawBrow(ctx, f.px, f.py, f.persp, f.value, f.side, yaw);
      }

      ctx.restore();
    }
  }

  _rotate3D(x, y, z, yaw, pitch, roll) {
    let x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    let z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    let y1 = y;
    let y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    let z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);
    let x2 = x1;
    let x3 = x2 * Math.cos(roll) - y2 * Math.sin(roll);
    let y3 = x2 * Math.sin(roll) + y2 * Math.cos(roll);
    return { x: x3, y: y3, z: z2 };
  }

  _drawEye(ctx, x, y, persp, openness, side, yaw) {
    const baseR = 18 * persp;
    const r = Math.max(4, baseR);

    // 远侧眼睛压缩
    const isNear = (side === 'left' && yaw > 0) || (side === 'right' && yaw < 0);
    const isFar = (side === 'left' && yaw < 0) || (side === 'right' && yaw > 0);
    const yawCompress = isFar ? Math.max(0.5, 1 - Math.abs(yaw) * 0.8) : Math.min(1.2, 1 + Math.abs(yaw) * 0.4);

    // 眼白
    ctx.beginPath();
    ctx.ellipse(x, y, r * yawCompress, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#8a8870';
    ctx.lineWidth = Math.max(1, 2 * persp);
    ctx.stroke();

    // 瞳孔
    const pr = r * 0.35 * openness;
    if (pr > 1) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, pr), 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    }

    // 高光
    if (pr > 2) {
      ctx.beginPath();
      ctx.arc(x - r * 0.2, y - r * 0.2, Math.max(1, r * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // 闭眼
    if (openness < 0.4) {
      const ca = 1 - (openness / 0.4);
      const ey = y - r * 0.85 + (r * 1.7 * (1 - ca * 0.9));
      ctx.beginPath();
      ctx.ellipse(x, ey - r * 0.05, r * 1.05 * yawCompress, r * 0.5 * ca, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.avatarType === 'sphere' ? '#dcd9d0' : '#bdb8aa';
      ctx.fill();
    }
  }

  _drawMouth(ctx, x, y, persp, openness, smile) {
    const w = 22 * persp;
    const oh = 14 * openness * persp;
    const so = smile * 5 * persp;

    ctx.save();

    if (openness > 0.15) {
      // 张嘴
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - so);
      ctx.quadraticCurveTo(x - w * 0.2, y - oh * 0.3 - so, x, y + oh * 0.5);
      ctx.quadraticCurveTo(x + w * 0.2, y - oh * 0.3 - so, x + w / 2, y - so);
      ctx.quadraticCurveTo(x + w * 0.3, y + oh * 0.7, x, y + oh);
      ctx.quadraticCurveTo(x - w * 0.3, y + oh * 0.7, x - w / 2, y - so);
      ctx.closePath();
      ctx.fillStyle = '#6a2525';
      ctx.fill();
      ctx.strokeStyle = '#4a1a1a';
      ctx.lineWidth = Math.max(1, 1.5 * persp);
      ctx.stroke();
    } else {
      // 闭嘴弧线
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + so * 0.2);
      ctx.quadraticCurveTo(x, y - 3 * persp - so, x + w / 2, y + so * 0.2);
      ctx.strokeStyle = '#5a5850';
      ctx.lineWidth = Math.max(1.5, 2.5 * persp);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawBrow(ctx, x, y, persp, value, side, yaw) {
    const w = 16 * persp;
    const lift = value * 8 * persp;
    const isFar = (side === 'left' && yaw < 0) || (side === 'right' && yaw > 0);
    const yawCompress = isFar ? Math.max(0.5, 1 - Math.abs(yaw) * 0.8) : 1;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5 * yawCompress, y - lift);
    ctx.quadraticCurveTo(x, y - 5 * persp - lift, x + w * 0.5 * yawCompress, y - lift);
    ctx.strokeStyle = '#5a5850';
    ctx.lineWidth = Math.max(1.5, 2.5 * persp);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // ===================== 工具 =====================

  _computeBBox(projFaces) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pf of projFaces) {
      if (pf.culled) continue;
      for (const p of pf.projected) {
        if (p.px < minX) minX = p.px;
        if (p.px > maxX) maxX = p.px;
        if (p.py < minY) minY = p.py;
        if (p.py > maxY) maxY = p.py;
      }
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  _calcAutoScale(bbox, canvasW, canvasH) {
    if (!bbox.w || !bbox.h) return 1;
    const margin = 0.9; // 10% 安全边距
    const sx = (canvasW * margin) / bbox.w;
    const sy = (canvasH * margin) / bbox.h;
    return Math.min(sx, sy);
  }

  _sortByDepth(projFaces) {
    return [...projFaces].sort((a, b) => b.avgZ - a.avgZ);
  }

  _drawLabels(ctx, w, h) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#8888A0';
    const labels = [
      `type: ${this.avatarType}`,
      `angleX: ${this.angleX.toFixed(1)} angleY: ${this.angleY.toFixed(1)} angleZ: ${this.angleZ.toFixed(1)}`,
      `autoScale: ${this.autoScale.toFixed(2)}`,
      `eyeL: ${this.eyeLeft.toFixed(2)} eyeR: ${this.eyeRight.toFixed(2)}`,
      `mouth: ${this.mouthOpen.toFixed(2)} smile: ${this.mouthSmile.toFixed(2)}`,
    ];
    labels.forEach((l, i) => ctx.fillText(l, 10, h - 10 - (labels.length - 1 - i) * 14));
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }
}

// ===================== 兼容旧版 Avatar 接口的包装类 =====================

export class ProceduralSphereAvatar {
  constructor(canvasId) {
    this.renderer = new ProceduralMeshRenderer(canvasId, 'sphere');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;
    this.canvas = this.renderer.canvas;
    this.ctx = this.renderer.ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    const p = this.params;
    this.renderer.setParameters({
      angleY: (p.headYaw - 0.5) * 60,
      angleX: (p.headPitch - 0.5) * 40,
      angleZ: (p.headRoll - 0.5) * 40,
      offsetX: (p.headX - 0.5) * 120,
      offsetY: (p.headY - 0.5) * 80,
      eyeLeft: p.eyeLeft, eyeRight: p.eyeRight,
      mouthOpen: p.mouthOpen, mouthSmile: p.mouthSmile,
      browLeft: p.browLeft, browRight: p.browRight,
    });
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.renderer.appMode = enabled;
    this.draw();
  }

  draw() {
    if (!this.appMode) {
      this.ctx.fillStyle = '#1A1A2E';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.renderer.draw();
  }
}

export class ProceduralSpindleWhaleAvatar {
  constructor(canvasId) {
    this.renderer = new ProceduralMeshRenderer(canvasId, 'spindle-whale');
    this.params = {
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    };
    this.appMode = false;
    this.canvas = this.renderer.canvas;
    this.ctx = this.renderer.ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    const p = this.params;
    this.renderer.setParameters({
      angleY: (p.headYaw - 0.5) * 60,
      angleX: (p.headPitch - 0.5) * 40,
      angleZ: (p.headRoll - 0.5) * 40,
      offsetX: (p.headX - 0.5) * 120,
      offsetY: (p.headY - 0.5) * 80,
      eyeLeft: p.eyeLeft, eyeRight: p.eyeRight,
      mouthOpen: p.mouthOpen, mouthSmile: p.mouthSmile,
      browLeft: p.browLeft, browRight: p.browRight,
    });
    this.draw();
  }

  setAppMode(enabled) {
    this.appMode = enabled;
    this.renderer.appMode = enabled;
    this.draw();
  }

  draw() {
    if (!this.appMode) {
      this.ctx.fillStyle = '#1A1A2E';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.renderer.draw();
  }
}