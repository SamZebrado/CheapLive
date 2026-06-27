/**
 * Procedural Quadruped Avatar Renderer
 * 
 * 程序化四足动物渲染器 - Canvas 2D pseudo-3D
 * 支持 cat/dog/rabbit/fox/bear 五种动物
 * 每个动物都有：头、身体、四条腿、耳朵、尾巴、眼睛、表情
 * 
 * 与主项目 procedural-mesh-renderer 视觉风格一致：
 * - 深色背景、分层光照、程序化伪 3D
 * - 球形/椭球形基础形体
 * - 表情驱动（眨眼、张嘴、微笑）
 * - 动作驱动（点头、转头、摆尾、弹跳）
 * - 姿态驱动（倾斜、抬爪、蹲伏、跳跃）
 */

export class ProceduralQuadrupedAvatar {
  constructor(canvasOrId) {
    this.canvas = typeof canvasOrId === 'string' 
      ? document.getElementById(canvasOrId) 
      : canvasOrId;
    this.ctx = this.canvas.getContext('2d');
    
    this._dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    
    this.avatarType = 'cat';
    this.avatarName = 'Cat';
    
    this.eyeLeft = 1;
    this.eyeRight = 1;
    this.mouthOpen = 0;
    this.mouthSmile = 0;
    this.browLeft = 0;
    this.browRight = 0;
    
    this.headYaw = 0.5;
    this.headPitch = 0.5;
    this.headRoll = 0.5;
    this.headX = 0.5;
    this.headY = 0.5;
    
    this.bodyPose = 'idle';
    this.bodyLean = 0;
    this.bodyTurn = 0;
    this.bodyCrouch = 0;
    this.bodyBounce = 0;
    this.tailWag = 0;
    this.pawLeftLift = 0;
    this.pawRightLift = 0;
    
    this.animTime = 0;
    this._running = false;
    this._appMode = false;
    
    this._bodyCheckActive = false;
    this._bodyCheckPhase = 0;
    this._bodyCheckTimer = 0;
    
    this._animalProfiles = this._buildAnimalProfiles();
  }

  _buildAnimalProfiles() {
    return {
      cat: {
        id: 'cat',
        labelZh: '猫',
        labelEn: 'Cat',
        bodyWidth: 0.4,
        bodyHeight: 0.26,
        bodyDepth: 0.3,
        headSize: 0.21,
        headHeight: 0.6,
        neckLength: 0.1,
        earShape: 'triangle',
        earSize: 0.15,
        earAngle: -0.2,
        earInnerColor: '#ffb3b3',
        muzzleSize: 0.09,
        muzzleProtrude: 0.03,
        tailLength: 0.5,
        tailCurvature: 0.7,
        tailBaseWidth: 0.04,
        tailTapered: true,
        legLength: 0.24,
        legWidth: 0.03,
        pawSize: 0.04,
        colors: {
          top: '#f5a623',
          side: '#e8941e',
          belly: '#fff3e0',
          accent: '#d4820a',
          dark: '#8b5a00',
          nose: '#ff9999',
          eye: '#2d1b0e',
          eyeWhite: '#fff8f0',
        },
        stripes: true,
        headStripes: true,
        tailStripes: true,
        stripeColor: 'rgba(139, 90, 0, 0.35)',
        whiskers: true,
        sleek: true,
      },
      dog: {
        id: 'dog',
        labelZh: '狗',
        labelEn: 'Dog',
        bodyWidth: 0.52,
        bodyHeight: 0.24,
        bodyDepth: 0.42,
        headSize: 0.28,
        headHeight: 0.56,
        neckLength: 0.12,
        earShape: 'floppy',
        earSize: 0.55,
        earAngle: 1.4,
        earInnerColor: '#c09060',
        muzzleSize: 0.32,
        muzzleProtrude: 0.26,
        tailLength: 0.12,
        tailCurvature: 0.35,
        tailBaseWidth: 0.07,
        legLength: 0.26,
        legWidth: 0.048,
        pawSize: 0.058,
        colors: {
          top: '#c68642',
          side: '#a67030',
          belly: '#f5deb3',
          accent: '#8b5a2b',
          dark: '#5c3a1e',
          nose: '#2d1810',
          eye: '#1a0f08',
          eyeWhite: '#fffaf0',
        },
        stripes: false,
        snout: true,
        longMuzzle: true,
        chestPatch: true,
        floppyEars: true,
      },
      rabbit: {
        id: 'rabbit',
        labelZh: '兔',
        labelEn: 'Rabbit',
        bodyWidth: 0.38,
        bodyHeight: 0.32,
        bodyDepth: 0.28,
        headSize: 0.2,
        headHeight: 0.56,
        neckLength: 0.06,
        earShape: 'long',
        earSize: 0.35,
        earAngle: -0.1,
        earInnerColor: '#ffcccc',
        muzzleSize: 0.07,
        muzzleProtrude: 0.02,
        tailLength: 0.06,
        tailCurvature: 0.05,
        tailBaseWidth: 0.05,
        tailFluffy: true,
        legLength: 0.18,
        legWidth: 0.035,
        pawSize: 0.04,
        hindLegBigger: true,
        hindLegScale: 1.5,
        colors: {
          top: '#f0e6d3',
          side: '#e0d4bc',
          belly: '#ffffff',
          accent: '#d4c4a8',
          dark: '#a89070',
          nose: '#ffb3b3',
          eye: '#4a3728',
          eyeWhite: '#ffffff',
        },
        stripes: false,
        fluffy: true,
        puffTail: true,
      },
      fox: {
        id: 'fox',
        labelZh: '狐狸',
        labelEn: 'Fox',
        bodyWidth: 0.45,
        bodyHeight: 0.26,
        bodyDepth: 0.35,
        headSize: 0.22,
        headHeight: 0.6,
        neckLength: 0.09,
        earShape: 'triangle',
        earSize: 0.16,
        earAngle: -0.15,
        earInnerColor: '#ffcc99',
        earTipBlack: true,
        muzzleSize: 0.13,
        muzzleProtrude: 0.08,
        tailLength: 0.55,
        tailCurvature: 0.5,
        tailBaseWidth: 0.1,
        tailFluffy: true,
        tailLeafShape: true,
        legLength: 0.25,
        legWidth: 0.035,
        pawSize: 0.045,
        colors: {
          top: '#e67e22',
          side: '#d35400',
          belly: '#fff5e6',
          accent: '#c0392b',
          dark: '#8b3a00',
          nose: '#2c1810',
          eye: '#1a0a00',
          eyeWhite: '#fff0e0',
        },
        stripes: false,
        whiteChest: true,
        whiteMuzzle: true,
        whiteTailTip: true,
        blackSocks: true,
        pointyFace: true,
      },
      bear: {
        id: 'bear',
        labelZh: '熊',
        labelEn: 'Bear',
        bodyWidth: 0.55,
        bodyHeight: 0.4,
        bodyDepth: 0.48,
        headSize: 0.28,
        headHeight: 0.54,
        neckLength: 0.05,
        earShape: 'round',
        earSize: 0.1,
        earAngle: 0,
        earInnerColor: '#a08070',
        muzzleSize: 0.14,
        muzzleProtrude: 0.06,
        tailLength: 0.04,
        tailCurvature: 0.05,
        tailBaseWidth: 0.04,
        legLength: 0.2,
        legWidth: 0.07,
        pawSize: 0.08,
        colors: {
          top: '#6b4423',
          side: '#5a3a1c',
          belly: '#8b6914',
          accent: '#4a2f15',
          dark: '#2d1a0a',
          nose: '#1a0f08',
          eye: '#0d0704',
          eyeWhite: '#f5e6d3',
        },
        stripes: false,
        bulky: true,
        muzzleLighter: true,
        shortTail: true,
        thickLegs: true,
      },
    };
  }

  setAvatar(type) {
    if (this._animalProfiles[type]) {
      this.avatarType = type;
      this.avatarName = this._animalProfiles[type].labelEn;
      return true;
    }
    return false;
  }

  updateParams(params) {
    if (params.eyeLeft !== undefined) this.eyeLeft = params.eyeLeft;
    if (params.eyeRight !== undefined) this.eyeRight = params.eyeRight;
    if (params.mouthOpen !== undefined) this.mouthOpen = params.mouthOpen;
    if (params.mouthSmile !== undefined) this.mouthSmile = params.mouthSmile;
    if (params.browLeft !== undefined) this.browLeft = params.browLeft;
    if (params.browRight !== undefined) this.browRight = params.browRight;
    if (params.headYaw !== undefined) this.headYaw = params.headYaw;
    if (params.headPitch !== undefined) this.headPitch = params.headPitch;
    if (params.headRoll !== undefined) this.headRoll = params.headRoll;
    if (params.headX !== undefined) this.headX = params.headX;
    if (params.headY !== undefined) this.headY = params.headY;
    if (params.bodyPose !== undefined) {
      this.bodyPose = params.bodyPose;
      this._updatePoseParams();
    }
    if (params.tailWag !== undefined) this.tailWag = params.tailWag;
    if (params.bodyBounce !== undefined) this.bodyBounce = params.bodyBounce;
  }

  _updatePoseParams() {
    switch (this.bodyPose) {
      case 'lean_left':
        this.bodyLean = -0.5;
        this.bodyTurn = -0.25;
        this.bodyCrouch = 0;
        this.pawLeftLift = 0;
        this.pawRightLift = 0;
        break;
      case 'lean_right':
        this.bodyLean = 0.5;
        this.bodyTurn = 0.25;
        this.bodyCrouch = 0;
        this.pawLeftLift = 0;
        this.pawRightLift = 0;
        break;
      case 'paw_left':
        this.bodyLean = 0.4;
        this.bodyTurn = 0;
        this.bodyCrouch = 0.35;
        this.pawLeftLift = 1.2;
        this.pawRightLift = 0;
        break;
      case 'paw_right':
        this.bodyLean = -0.25;
        this.bodyTurn = 0;
        this.bodyCrouch = 0.25;
        this.pawLeftLift = 0;
        this.pawRightLift = 1.2;
        break;
      case 'crouch':
        this.bodyLean = 0;
        this.bodyTurn = 0;
        this.bodyCrouch = 1.1;
        this.pawLeftLift = 0;
        this.pawRightLift = 0;
        break;
      case 'jump':
        this.bodyLean = 0;
        this.bodyTurn = 0;
        this.bodyCrouch = -0.6;
        this.bodyBounce = 2.0;
        this.pawLeftLift = 1.2;
        this.pawRightLift = 1.2;
        break;
      case 'turn_left':
        this.bodyLean = 0;
        this.bodyTurn = -0.5;
        this.bodyCrouch = 0;
        this.pawLeftLift = 0;
        this.pawRightLift = 0;
        break;
      case 'turn_right':
        this.bodyLean = 0;
        this.bodyTurn = 0.5;
        this.bodyCrouch = 0;
        this.pawLeftLift = 0;
        this.pawRightLift = 0;
        break;
      case 'tail_wag':
        this.bodyLean = 0;
        this.bodyTurn = 0;
        this.bodyCrouch = 0;
        this.tailWag = 2;
        break;
      case 'bounce':
        this.bodyBounce = 2;
        break;
      case 'body_check':
        this.bodyBounce = 0.5;
        break;
      case 'idle':
      default:
        this.bodyLean = 0;
        this.bodyTurn = 0;
        this.bodyCrouch = 0;
        this.pawLeftLift = 0;
        this.pawRightLift = 0;
        break;
    }
  }

  draw() {
    const ctx = this.ctx;
    const dpr = this._dpr;
    const profile = this._animalProfiles[this.avatarType];
    
    const cssW = this.canvas.clientWidth || this.canvas.width || 600;
    const cssH = this.canvas.clientHeight || this.canvas.height || 320;
    const w = cssW;
    const h = cssH;
    
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    ctx.clearRect(0, 0, w, h);
    
    if (!this._appMode) {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }
    
    // bodyCheck 动作更新
    let bodyCheckLean = 0;
    let bodyCheckTurn = 0;
    let bodyCheckCrouch = 0;
    let bodyCheckLiftL = 0;
    let bodyCheckLiftR = 0;
    let bodyCheckTail = 0;
    let bodyCheckShiftX = 0;
    if (this._bodyCheckActive) {
      this._bodyCheckTimer++;
      const phase = this._bodyCheckTimer / 50;
      if (phase >= 1) {
        this._bodyCheckActive = false;
        this._bodyCheckPhase = 0;
        this._bodyCheckTimer = 0;
      } else {
        this._bodyCheckPhase = phase;
      }
      bodyCheckLean = this._bcLean(phase);
      bodyCheckTurn = this._bcTurn(phase);
      bodyCheckCrouch = this._bcCrouch(phase);
      bodyCheckLiftL = this._bcLiftL(phase);
      bodyCheckLiftR = this._bcLiftR(phase);
      bodyCheckTail = this._bcTail(phase);
      bodyCheckShiftX = this._bcShiftX(phase);
    }
    
    const cx = w / 2;
    const cy = h * 0.58;
    const size = Math.min(w, h) * 1.1;
    
    const yawOffset = (this.headYaw - 0.5) * size * 0.25;
    const pitchOffset = (this.headPitch - 0.5) * size * 0.15;
    const bounceOffset = Math.sin(this.animTime * 0.1) * size * 0.04 * (this.bodyBounce + (this.bodyPose === 'bounce' ? 1.5 : 0));
    
    const bodyCx = cx + yawOffset * 0.4 + (this.bodyLean + bodyCheckLean) * size * 0.2 + bodyCheckShiftX * size * 0.3;
    const bodyCy = cy + bounceOffset + (this.bodyCrouch + bodyCheckCrouch) * size * 0.2;
    
    ctx.save();
    ctx.translate(bodyCx, bodyCy);
    
    const bodyW = profile.bodyWidth * size;
    const bodyH = profile.bodyHeight * size * (1 - (this.bodyCrouch + bodyCheckCrouch) * 0.3);
    const bodyD = profile.bodyDepth * size;
    
    this._drawBodyShadow(ctx, bodyW, bodyH, size);
    this._drawBody(ctx, profile, bodyW, bodyH, bodyD, size);
    this._drawLegs(ctx, profile, bodyW, bodyH, size, bodyCheckLiftL, bodyCheckLiftR);
    this._drawTail(ctx, profile, bodyW, bodyH, bodyD, size, bodyCheckTail);
    this._drawHead(ctx, profile, bodyW, bodyH, size, yawOffset, pitchOffset, bodyCheckTurn);
    
    ctx.restore();
  }

  _bcShiftX(phase) {
    if (phase < 0.28) {
      const t = phase / 0.28;
      return -t * 0.15;
    } else if (phase < 0.45) {
      const t = (phase - 0.28) / 0.17;
      const e = 1 - t;
      return -0.15 + (1 - e * e) * 0.55;
    } else if (phase < 0.58) {
      return 0.4;
    } else if (phase < 0.78) {
      const t = (phase - 0.58) / 0.20;
      return 0.4 - t * 0.25;
    } else {
      const t = (phase - 0.78) / 0.22;
      const e = 1 - t;
      return 0.15 * e * e;
    }
  }

  _bcLean(phase) {
    if (phase < 0.28) {
      const t = phase / 0.28;
      return -t * 0.12;
    } else if (phase < 0.45) {
      const t = (phase - 0.28) / 0.17;
      return -0.12 + t * 0.58;
    } else if (phase < 0.58) {
      return 0.46;
    } else if (phase < 0.78) {
      const t = (phase - 0.58) / 0.20;
      return 0.46 - t * 0.26;
    } else {
      const t = (phase - 0.78) / 0.22;
      const e = 1 - t;
      return 0.2 * e * e;
    }
  }

  _bcTurn(phase) {
    if (phase < 0.28) {
      const t = phase / 0.28;
      return -t * 0.15;
    } else if (phase < 0.45) {
      const t = (phase - 0.28) / 0.17;
      return -0.15 + t * 0.55;
    } else if (phase < 0.58) {
      return 0.4;
    } else if (phase < 0.78) {
      const t = (phase - 0.58) / 0.20;
      return 0.4 - t * 0.2;
    } else {
      const t = (phase - 0.78) / 0.22;
      const e = 1 - t;
      return 0.2 * e * e;
    }
  }

  _bcCrouch(phase) {
    if (phase < 0.28) {
      const t = phase / 0.28;
      return t * 0.35;
    } else if (phase < 0.42) {
      const t = (phase - 0.28) / 0.14;
      return 0.35 - t * 0.15;
    } else if (phase < 0.52) {
      const t = (phase - 0.42) / 0.10;
      return 0.2 + t * 0.7;
    } else if (phase < 0.72) {
      const t = (phase - 0.52) / 0.20;
      return 0.9 - t * 0.5;
    } else {
      const t = (phase - 0.72) / 0.28;
      const e = 1 - t;
      return 0.4 * e * e;
    }
  }

  _bcLiftL(phase) {
    if (phase < 0.38) return 0;
    if (phase < 0.52) {
      const t = (phase - 0.38) / 0.14;
      return t * 0.6;
    } else if (phase < 0.72) {
      const t = (phase - 0.52) / 0.20;
      return 0.6 - t * 0.4;
    } else {
      const t = (phase - 0.72) / 0.28;
      return 0.2 * (1 - t) * (1 - t);
    }
  }

  _bcLiftR(phase) {
    return 0;
  }

  _bcTail(phase) {
    if (phase < 0.35) {
      return Math.sin(phase * Math.PI * 2) * 0.06;
    } else if (phase < 0.6) {
      const t = (phase - 0.35) / 0.25;
      return 0.06 + t * 0.15;
    } else if (phase < 0.85) {
      const t = (phase - 0.6) / 0.25;
      return 0.21 - t * 0.25;
    } else {
      const t = (phase - 0.85) / 0.15;
      return -0.04 * Math.sin(t * Math.PI);
    }
  }

  triggerBodyCheck() {
    this._bodyCheckActive = true;
    this._bodyCheckPhase = 0;
    this._bodyCheckTimer = 0;
  }

  _drawBodyShadow(ctx, bodyW, bodyH, size) {
    ctx.save();
    ctx.translate(0, bodyH * 0.5 + size * 0.02);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyW * 0.45, bodyH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawBody(ctx, profile, bodyW, bodyH, bodyD, size) {
    const c = profile.colors;
    
    // Body shape with more volume: slightly elongated ellipse
    const bodyRx = bodyW * 0.5;
    const bodyRy = bodyH * 0.5;
    
    // Base body gradient (top -> bottom)
    const grad = ctx.createLinearGradient(0, -bodyRy, 0, bodyRy);
    grad.addColorStop(0, this._lightenColor(c.top, 0.08));
    grad.addColorStop(0.25, c.top);
    grad.addColorStop(0.55, c.side);
    grad.addColorStop(0.85, c.belly);
    grad.addColorStop(1, this._darkenColor(c.belly, 0.08));
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Back highlight (volume)
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.05, -bodyH * 0.28, bodyW * 0.3, bodyH * 0.15, -0.1, 0, Math.PI * 2);
    ctx.fill();
    
    // Belly area (lighter, softer)
    ctx.fillStyle = c.belly;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, bodyH * 0.18, bodyW * 0.32, bodyH * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Belly shadow (underbelly line)
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, bodyH * 0.38, bodyW * 0.28, bodyH * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Species-specific markings
    if (profile.stripes) {
      // Cat-style stripes: curved, uneven
      ctx.fillStyle = profile.stripeColor || 'rgba(0,0,0,0.2)';
      ctx.globalAlpha = 0.7;
      const stripeCount = 6;
      for (let i = 0; i < stripeCount; i++) {
        const t = i / (stripeCount - 1);
        const sx = -bodyW * 0.35 + t * bodyW * 0.7;
        const sw = bodyW * 0.025 + Math.sin(i * 1.7) * bodyW * 0.008;
        const sh = bodyH * 0.5 + Math.cos(i * 1.3) * bodyH * 0.08;
        const curve = -0.2 + Math.sin(i * 0.8) * 0.15;
        ctx.beginPath();
        ctx.ellipse(sx, -bodyH * 0.05 + Math.sin(i) * bodyH * 0.03, sw, sh, curve, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    
    if (profile.whiteChest) {
      // Fox/dog white chest patch
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.ellipse(-bodyW * 0.38, bodyH * 0.05, bodyW * 0.13, bodyH * 0.32, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    if (profile.chestPatch) {
      // Dog lighter chest
      ctx.fillStyle = c.belly;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(-bodyW * 0.32, bodyH * 0.02, bodyW * 0.18, bodyH * 0.28, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // Body outline (subtle)
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Top contour highlight (thin bright line along the back)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -bodyRy * 0.15, bodyRx * 0.92, bodyRy * 0.7, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    
    // Bottom shadow contour
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, bodyRy * 0.1, bodyRx * 0.85, bodyRy * 0.65, 0, 0, Math.PI);
    ctx.stroke();
  }

  _drawLegs(ctx, profile, bodyW, bodyH, size, extraLiftL = 0, extraLiftR = 0) {
    const c = profile.colors;
    const legLen = profile.legLength * size * (1 - this.bodyCrouch * 0.4);
    const legW = profile.legWidth * size;
    const pawSize = profile.pawSize * size;
    
    const farLegScale = 0.72;
    const farLegOffset = bodyW * 0.32;
    const farLegYOffset = -size * 0.01;
    
    const frontSpacing = bodyW * 0.24;
    const hindSpacing = bodyW * 0.22;
    
    const legDrawOrder = [
      { x: frontSpacing + farLegOffset, side: 'front', left: false, far: true },
      { x: hindSpacing + farLegOffset, side: 'hind', left: false, far: true },
      { x: -frontSpacing, side: 'front', left: true, far: false },
      { x: -hindSpacing, side: 'hind', left: true, far: false },
    ];
    
    legDrawOrder.forEach((pos, i) => {
      const isHind = pos.side === 'hind';
      const isFar = pos.far;
      const baseScale = (isHind && profile.hindLegBigger) ? profile.hindLegScale : 1;
      const scale = baseScale * (isFar ? farLegScale : 1);
      const len = legLen * scale;
      const w = legW * scale;
      
      let liftAmount = 0;
      if (pos.side === 'front' && pos.left) liftAmount = this.pawLeftLift + extraLiftL;
      if (pos.side === 'front' && !pos.left) liftAmount = this.pawRightLift + extraLiftR;
      if (isHind && this.bodyPose === 'jump') liftAmount = 0.8;
      
      const topY = bodyH * 0.3 + (isFar ? farLegYOffset : 0);
      const bottomY = bodyH * 0.5 + len * 0.5 - liftAmount * len * 0.5;
      
      const legGrad = ctx.createLinearGradient(pos.x - w, topY, pos.x + w, bottomY);
      if (isFar) {
        legGrad.addColorStop(0, c.dark);
        legGrad.addColorStop(0.5, c.accent);
        legGrad.addColorStop(1, profile.blackSocks ? '#1a0f08' : c.dark);
      } else {
        legGrad.addColorStop(0, this._lightenColor(c.side, 0.15));
        legGrad.addColorStop(0.3, c.side);
        legGrad.addColorStop(0.7, c.dark);
        legGrad.addColorStop(1, this._darkenColor(c.dark, 0.15));
      }
      
      ctx.fillStyle = legGrad;
      ctx.beginPath();
      ctx.roundRect(pos.x - w * 0.5, topY, w, len, w * 0.3);
      ctx.fill();

      // 腿部高光（前侧）
      if (!isFar) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.roundRect(pos.x - w * 0.45, topY + 2, w * 0.3, len - 4, w * 0.2);
        ctx.fill();
      }

      // 腿部阴影（后侧）
      if (!isFar) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.roundRect(pos.x + w * 0.12, topY + 2, w * 0.35, len - 4, w * 0.2);
        ctx.fill();
      }
      
      if (profile.blackSocks && !isFar) {
        ctx.fillStyle = '#1a0f08';
        ctx.beginPath();
        ctx.roundRect(pos.x - w * 0.55, topY + len * 0.65, w * 1.1, len * 0.35, w * 0.3);
        ctx.fill();
      }
      if (profile.blackSocks && isFar) {
        ctx.fillStyle = '#0d0704';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.roundRect(pos.x - w * 0.55, topY + len * 0.65, w * 1.1, len * 0.35, w * 0.3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      const pawColor = isFar ? c.dark : c.dark;
      ctx.fillStyle = pawColor;
      ctx.beginPath();
      ctx.ellipse(pos.x, topY + len + pawSize * 0.2 * scale, pawSize * scale, pawSize * 0.6 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      if (!isFar) {
        ctx.fillStyle = c.accent;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(pos.x, topY + len + pawSize * 0.15 * scale, pawSize * 0.7 * scale, pawSize * 0.4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }

  _drawTail(ctx, profile, bodyW, bodyH, bodyD, size, extraWag = 0) {
    const c = profile.colors;
    const tailLen = profile.tailLength * size;
    const tailBaseW = profile.tailBaseWidth * size;
    const curvature = profile.tailCurvature;
    
    const baseX = -bodyW * 0.48;
    const baseY = -bodyH * 0.1;
    
    const wagAngle = Math.sin(this.animTime * 0.2) * 0.8 * (this.tailWag + extraWag + (this.bodyPose === 'tail_wag' ? 2.0 : 0));
    const swayX = Math.sin(this.animTime * 0.15) * size * 0.05 * (this.tailWag + extraWag + (this.bodyPose === 'tail_wag' ? 2.0 : 0));
    
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(-0.3 + wagAngle);
    
    if (profile.tailLeafShape) {
      const endX = -tailLen + swayX;
      const endY = -tailLen * 0.7 * curvature;
      const cp1x = -tailLen * 0.35 + swayX * 0.3;
      const cp1y = -tailLen * 0.35 * curvature;
      const cp2x = -tailLen * 0.7 + swayX * 0.7;
      const cp2y = -tailLen * 0.65 * curvature;
      
      ctx.fillStyle = c.top;
      ctx.beginPath();
      ctx.moveTo(-tailBaseW * 0.5, 0);
      ctx.bezierCurveTo(
        -tailLen * 0.3 - tailBaseW * 0.8, -tailLen * 0.2 * curvature,
        -tailLen * 0.6 - tailBaseW * 1.2, -tailLen * 0.5 * curvature,
        endX - tailBaseW * 0.3, endY
      );
      ctx.bezierCurveTo(
        -tailLen * 0.6 + tailBaseW * 1.2, -tailLen * 0.55 * curvature,
        -tailLen * 0.3 + tailBaseW * 0.8, -tailLen * 0.25 * curvature,
        tailBaseW * 0.5, 0
      );
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = c.side;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-tailBaseW * 0.3, 0);
      ctx.bezierCurveTo(
        -tailLen * 0.3 - tailBaseW * 0.4, -tailLen * 0.15 * curvature,
        -tailLen * 0.55 - tailBaseW * 0.6, -tailLen * 0.4 * curvature,
        endX - tailBaseW * 0.1, endY + tailBaseW * 0.2
      );
      ctx.bezierCurveTo(
        -tailLen * 0.55 + tailBaseW * 0.2, -tailLen * 0.45 * curvature,
        -tailLen * 0.3, -tailLen * 0.2 * curvature,
        tailBaseW * 0.3, 0
      );
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      
      if (profile.whiteTailTip) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(endX, endY, tailBaseW * 0.9, tailBaseW * 0.7, -0.3 + wagAngle, 0, Math.PI * 2);
        ctx.fill();
      }
      
    } else if (profile.puffTail || profile.tailFluffy && profile.tailLength < 0.1) {
      ctx.fillStyle = c.top;
      ctx.beginPath();
      ctx.arc(-tailLen * 0.3, -tailLen * 0.2 * curvature, tailBaseW * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = c.belly;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(-tailLen * 0.3 + tailBaseW * 0.3, -tailLen * 0.2 * curvature + tailBaseW * 0.3, tailBaseW * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      
    } else {
      ctx.strokeStyle = c.top;
      ctx.lineWidth = tailBaseW;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      
      const cp1x = -tailLen * 0.3 + swayX * 0.3;
      const cp1y = -tailLen * 0.3 * curvature;
      const cp2x = -tailLen * 0.6 + swayX * 0.7;
      const cp2y = -tailLen * 0.6 * curvature;
      const endX = -tailLen + swayX;
      const endY = -tailLen * 0.8 * curvature;
      
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();
      
      if (profile.tailStripes && profile.stripes) {
        ctx.strokeStyle = profile.stripeColor || 'rgba(0,0,0,0.2)';
        ctx.lineWidth = tailBaseW * 0.3;
        ctx.globalAlpha = 0.5;
        for (let i = 1; i <= 4; i++) {
          const t = i * 0.2;
          const tx = -tailLen * t + swayX * t;
          const ty = -tailLen * t * 0.8 * curvature;
          ctx.beginPath();
          ctx.arc(tx, ty, tailBaseW * 0.55, -0.2, 0.8);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      
      // 短尾：绘制一个小蓬松绒球（用于 dog 等短尾动物）
      if (tailLen < size * 0.18) {
        ctx.fillStyle = c.side;
        ctx.beginPath();
        ctx.arc(-tailLen * 0.4, -tailLen * 0.1, tailBaseW * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(-tailLen * 0.4 + tailBaseW * 0.1, -tailLen * 0.1 + tailBaseW * 0.1, tailBaseW * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      if (profile.tailFluffy && !profile.tailLeafShape) {
        ctx.fillStyle = c.top;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < 6; i++) {
          const t = 0.3 + i * 0.12;
          const fx = -tailLen * t + swayX * t;
          const fy = -tailLen * t * 0.8 * curvature;
          const r = tailBaseW * (0.7 + Math.sin(i * 1.2) * 0.3);
          ctx.beginPath();
          ctx.arc(fx, fy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      
      if (profile.whiteTailTip && !profile.tailLeafShape) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(endX, endY, tailBaseW * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  }

  _drawHead(ctx, profile, bodyW, bodyH, size, yawOffset, pitchOffset, extraTurn = 0) {
    const c = profile.colors;
    const headSize = profile.headSize * size;
    const neckLen = profile.neckLength * size;
    const headY = -bodyH * 0.3 - neckLen * 0.5 - headSize * 0.2;
    
    const headCx = bodyW * 0.3 + (yawOffset + extraTurn * size * 0.15) * 0.5;
    const headCy = headY + pitchOffset;
    
    ctx.save();
    ctx.translate(headCx, headCy);
    
    const rollAngle = (this.headRoll - 0.5) * 0.45;
    ctx.rotate(rollAngle);
    
    // Neck
    ctx.fillStyle = c.top;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(-headSize * 0.05, headSize * 0.35, headSize * 0.35, neckLen * 1.2, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.side;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(-headSize * 0.1, headSize * 0.45, headSize * 0.25, neckLen * 0.8, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    const headRx = headSize * 0.55;
    const headRy = headSize * 0.5;
    
    // Head gradient (more volume)
    const headGrad = ctx.createRadialGradient(
      -headSize * 0.12, -headSize * 0.2, headSize * 0.08,
      0, 0, headSize * 0.65
    );
    headGrad.addColorStop(0, this._lightenColor(c.top, 0.12));
    headGrad.addColorStop(0.3, c.top);
    headGrad.addColorStop(0.65, c.side);
    headGrad.addColorStop(1, c.accent);
    
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Top of head highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-headSize * 0.08, -headSize * 0.3, headSize * 0.25, headSize * 0.12, -0.1, 0, Math.PI * 2);
    ctx.fill();
    
    // Cheek / lower face area (slightly lighter)
    ctx.fillStyle = c.belly;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(0, headSize * 0.12, headSize * 0.32, headSize * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Muzzle area (protruding snout)
    if (profile.whiteMuzzle) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
    } else if (profile.muzzleLighter) {
      ctx.fillStyle = c.belly;
      ctx.globalAlpha = 0.75;
    } else {
      ctx.fillStyle = c.side;
      ctx.globalAlpha = 0.6;
    }
    const muzzleW = profile.muzzleSize * size;
    const muzzleH = muzzleW * 0.65;
    const muzzleY = headSize * 0.15;
    ctx.beginPath();
    ctx.ellipse(0, muzzleY, muzzleW, muzzleH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Muzzle shadow (underneath)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, muzzleY + muzzleH * 0.6, muzzleW * 0.7, muzzleH * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Muzzle bridge highlight (pointy face / snout)
    if (profile.pointyFace || profile.longMuzzle) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, muzzleY - muzzleH * 0.1, muzzleW * 0.25, muzzleH * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Head stripes
    if (profile.stripes && profile.headStripes) {
      ctx.fillStyle = profile.stripeColor || 'rgba(0,0,0,0.2)';
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 4; i++) {
        const sx = -headSize * 0.25 + i * headSize * 0.17;
        const sw = headSize * 0.022 + Math.sin(i * 1.5) * headSize * 0.005;
        const sh = headSize * 0.18 + Math.cos(i * 1.2) * headSize * 0.04;
        ctx.beginPath();
        ctx.ellipse(sx, -headSize * 0.2 + Math.sin(i * 0.9) * headSize * 0.03, sw, sh, -0.15 + i * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    
    // Eye socket shading
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    [-1, 1].forEach(side => {
      const ex = side * headSize * 0.22;
      const ey = -headSize * 0.05;
      ctx.beginPath();
      ctx.ellipse(ex, ey + headSize * 0.02, headSize * 0.13, headSize * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Whiskers
    if (profile.whiskers) {
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      const whiskerY = headSize * 0.12;
      const whiskerX = headSize * 0.18;
      for (let i = 0; i < 3; i++) {
        const offsetY = -headSize * 0.04 + i * headSize * 0.04;
        const angle = -0.1 + i * 0.08;
        ctx.beginPath();
        ctx.moveTo(-whiskerX, whiskerY + offsetY);
        ctx.lineTo(-whiskerX - headSize * 0.28, whiskerY + offsetY - headSize * 0.03 + i * headSize * 0.015);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(whiskerX, whiskerY + offsetY);
        ctx.lineTo(whiskerX + headSize * 0.28, whiskerY + offsetY - headSize * 0.03 + i * headSize * 0.015);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    
    this._drawEars(ctx, profile, headSize, this.bodyCrouch);
    this._drawMuzzle(ctx, profile, headSize);
    this._drawEyes(ctx, profile, headSize);
    this._drawNose(ctx, profile, headSize);
    
    // Head outline (subtle)
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Top contour highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-headSize * 0.05, -headSize * 0.1, headRx * 0.85, headRy * 0.7, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    
    ctx.restore();
  }

  _drawEars(ctx, profile, headSize, bodyCrouch = 0) {
    const c = profile.colors;
    const earSize = profile.earSize * headSize;
    const earAngle = profile.earAngle;
    
    const earPositions = [
      { x: -headSize * 0.35, y: -headSize * 0.35, left: true },
      { x: headSize * 0.35, y: -headSize * 0.35, left: false },
    ];
    
    earPositions.forEach(pos => {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      
      const angle = earAngle + (pos.left ? -0.1 : 0.1) + this.bodyLean * 0.5;
      ctx.rotate(angle);
      
      if (profile.earShape === 'triangle') {
        ctx.fillStyle = c.top;
        ctx.beginPath();
        ctx.moveTo(0, -earSize);
        ctx.lineTo(-earSize * 0.4, earSize * 0.3);
        ctx.lineTo(earSize * 0.4, earSize * 0.3);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = profile.earInnerColor;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, -earSize * 0.6);
        ctx.lineTo(-earSize * 0.25, earSize * 0.15);
        ctx.lineTo(earSize * 0.25, earSize * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        
        if (profile.earTipBlack) {
          ctx.fillStyle = '#1a0f08';
          ctx.beginPath();
          ctx.moveTo(0, -earSize);
          ctx.lineTo(-earSize * 0.25, -earSize * 0.5);
          ctx.lineTo(earSize * 0.25, -earSize * 0.5);
          ctx.closePath();
          ctx.fill();
        }
        
      } else if (profile.earShape === 'floppy') {
        // 外耳：大椭圆下垂
        ctx.fillStyle = c.side;
        ctx.beginPath();
        ctx.ellipse(0, earSize * 0.25, earSize * 0.55, earSize * 1.1, 0.4 + (pos.left ? -0.25 : 0.25), 0, Math.PI * 2);
        ctx.fill();
        
        // 内耳：大椭圆下垂，内耳更浅
        ctx.fillStyle = profile.earInnerColor;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.ellipse(0, earSize * 0.3, earSize * 0.38, earSize * 0.8, 0.4 + (pos.left ? -0.25 : 0.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // 耳尖深色
        ctx.fillStyle = c.dark;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(earSize * 0.08, earSize * 0.6, earSize * 0.18, earSize * 0.35, 0.4 + (pos.left ? -0.15 : 0.15), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
      } else if (profile.earShape === 'long') {
        // 蹲伏时耳朵略向后压
        const crouchTilt = bodyCrouch * 0.35;
        ctx.fillStyle = c.top;
        ctx.beginPath();
        ctx.ellipse(0, earSize * 0.2, earSize * 0.28, earSize * 1.0, -0.08 - crouchTilt + (pos.left ? -0.05 : 0.05), 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = profile.earInnerColor;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.ellipse(0, earSize * 0.3, earSize * 0.16, earSize * 0.75, -0.08 - crouchTilt + (pos.left ? -0.05 : 0.05), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        ctx.fillStyle = c.dark;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(-earSize * 0.05, earSize * 0.15, earSize * 0.05, earSize * 0.5, -0.1 - crouchTilt, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
      } else if (profile.earShape === 'round') {
        ctx.fillStyle = c.top;
        ctx.beginPath();
        ctx.arc(0, 0, earSize * 0.55, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = profile.earInnerColor;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, earSize * 0.1, earSize * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        ctx.fillStyle = c.dark;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(-earSize * 0.1, -earSize * 0.05, earSize * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      ctx.restore();
    });
  }

  _drawMuzzle(ctx, profile, headSize) {
    const c = profile.colors;
    const muzzleSize = profile.muzzleSize * headSize;
    const muzzleProtrude = profile.muzzleProtrude * headSize;
    
    const muzzleY = headSize * 0.1;
    
    let muzzleColor = c.belly;
    if (profile.whiteMuzzle) muzzleColor = '#ffffff';
    if (profile.muzzleLighter) muzzleColor = c.belly;
    
    ctx.fillStyle = muzzleColor;
    ctx.globalAlpha = profile.whiteMuzzle ? 0.95 : 0.7;
    ctx.beginPath();
    ctx.ellipse(0, muzzleY, muzzleSize, muzzleSize * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    if (this.mouthOpen > 0.05 || this.mouthSmile > 0.05) {
      ctx.fillStyle = c.dark;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      const mouthW = muzzleSize * 0.6;
      const mouthH = muzzleSize * 0.4 * this.mouthOpen + muzzleSize * 0.15 * this.mouthSmile;
      ctx.ellipse(0, muzzleY + muzzleSize * 0.3, mouthW, mouthH, 0, 0, Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      
      if (this.mouthOpen > 0.2) {
        ctx.fillStyle = '#ff6b6b';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(0, muzzleY + muzzleSize * 0.28, mouthW * 0.6, mouthH * 0.5, 0, 0, Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  _drawNose(ctx, profile, headSize) {
    const c = profile.colors;
    const noseY = headSize * 0.02;
    const noseW = headSize * 0.12;
    const noseH = headSize * 0.08;
    
    ctx.fillStyle = c.nose;
    ctx.beginPath();
    ctx.moveTo(0, noseY - noseH * 0.3);
    ctx.bezierCurveTo(
      noseW * 0.8, noseY - noseH * 0.2,
      noseW, noseY + noseH * 0.5,
      0, noseY + noseH * 0.5
    );
    ctx.bezierCurveTo(
      -noseW, noseY + noseH * 0.5,
      -noseW * 0.8, noseY - noseH * 0.2,
      0, noseY - noseH * 0.3
    );
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-noseW * 0.2, noseY - noseH * 0.1, noseW * 0.25, noseH * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawEyes(ctx, profile, headSize) {
    const c = profile.colors;
    const eyeY = -headSize * 0.05;
    const eyeSpacing = headSize * 0.42;
    const eyeW = headSize * 0.2;
    const eyeH = headSize * 0.26;
    
    [-1, 1].forEach((side, i) => {
      const ex = side * eyeSpacing * 0.5;
      const openness = i === 0 ? this.eyeLeft : this.eyeRight;
      const openH = eyeH * openness;
      
      // Layer 1: Eye socket (deep shadow)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + eyeH * 0.05, eyeW * 0.75, openH * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      
      if (openness < 0.05) {
        // Closed eye: just upper and lower lash lines
        ctx.strokeStyle = c.dark;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - eyeW * 0.55, eyeY + openH * 0.05);
        ctx.quadraticCurveTo(ex, eyeY - openH * 0.1, ex + eyeW * 0.55, eyeY + openH * 0.05);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(ex - eyeW * 0.4, eyeY + openH * 0.1);
        ctx.quadraticCurveTo(ex, eyeY + openH * 0.15, ex + eyeW * 0.4, eyeY + openH * 0.1);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      
      // Layer 2: Eye white base with slight inner shadow
      const eyeWhiteGrad = ctx.createRadialGradient(
        ex - eyeW * 0.1, eyeY - openH * 0.15, eyeW * 0.1,
        ex, eyeY, eyeW * 0.65
      );
      eyeWhiteGrad.addColorStop(0, '#ffffff');
      eyeWhiteGrad.addColorStop(0.7, c.eyeWhite || '#f8f0e8');
      eyeWhiteGrad.addColorStop(1, '#d4c8b8');
      ctx.fillStyle = eyeWhiteGrad;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW * 0.62, openH * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye white border (fine dark ring)
      ctx.strokeStyle = c.dark;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW * 0.62, openH * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Layer 3: Iris with radial gradient
      const irisR = Math.min(eyeW * 0.38, openH * 0.48);
      const irisGrad = ctx.createRadialGradient(
        ex - irisR * 0.15, eyeY + openH * 0.02 - irisR * 0.1, irisR * 0.1,
        ex, eyeY + openH * 0.05, irisR
      );
      irisGrad.addColorStop(0, this._lightenColor(c.eye, 0.4));
      irisGrad.addColorStop(0.5, c.eye);
      irisGrad.addColorStop(1, this._darkenColor(c.eye, 0.3));
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(ex, eyeY + openH * 0.05, irisR, 0, Math.PI * 2);
      ctx.fill();
      
      // Iris detail: concentric ring
      ctx.strokeStyle = this._darkenColor(c.eye, 0.2);
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ex, eyeY + openH * 0.05, irisR * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Layer 4: Pupil
      const pupilR = irisR * 0.5;
      ctx.fillStyle = '#0a0604';
      ctx.beginPath();
      ctx.arc(ex, eyeY + openH * 0.05, pupilR, 0, Math.PI * 2);
      ctx.fill();
      
      // Pupil catchlight reflection (subtle)
      ctx.fillStyle = c.eye;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(ex - pupilR * 0.1, eyeY + openH * 0.05 + pupilR * 0.1, pupilR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      
      // Layer 5: Highlights (two for cartoon style)
      // Main highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex - irisR * 0.35, eyeY + openH * 0.05 - irisR * 0.35, irisR * 0.22, irisR * 0.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Secondary smaller highlight
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(ex + irisR * 0.25, eyeY + openH * 0.05 + irisR * 0.3, irisR * 0.12, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyelid overlay: upper eyelid
      ctx.fillStyle = c.top;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY - openH * 0.3, eyeW * 0.65, openH * 0.25, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      
      // Upper eyelash line
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - eyeW * 0.6, eyeY - openH * 0.15);
      ctx.quadraticCurveTo(ex, eyeY - openH * 0.55, ex + eyeW * 0.6, eyeY - openH * 0.15);
      ctx.stroke();
      
      // Lower eyelid line (subtle)
      ctx.strokeStyle = c.dark;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex - eyeW * 0.45, eyeY + openH * 0.4);
      ctx.quadraticCurveTo(ex, eyeY + openH * 0.52, ex + eyeW * 0.45, eyeY + openH * 0.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Eyebrow / brow
      if (this.browLeft > 0.1 || this.browRight > 0.1) {
        const brow = i === 0 ? this.browLeft : this.browRight;
        ctx.strokeStyle = c.dark;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - eyeW * 0.55, eyeY - openH * 0.85 - brow * openH * 0.25);
        ctx.quadraticCurveTo(
          ex,
          eyeY - openH * 0.95 - brow * openH * 0.15,
          ex + eyeW * 0.55,
          eyeY - openH * 0.85 - brow * openH * 0.1
        );
        ctx.stroke();
      }
    });
  }
  
  _lightenColor(hex, amount) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * amount));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * amount));
    return `rgb(${r},${g},${b})`;
  }
  
  _darkenColor(hex, amount) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * amount));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * amount));
    return `rgb(${r},${g},${b})`;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._animate();
  }

  stop() {
    this._running = false;
  }

  _animate() {
    if (!this._running) return;
    this.animTime++;
    this.draw();
    requestAnimationFrame(() => this._animate());
  }

  resize() {
    this.draw();
  }
}
