/**
 * Face Tracking to Cubism Parameter Mapper
 *
 * 将 MediaPipe Face Landmarker 的面部追踪数据映射到
 * Live2D Cubism 模型的标准参数体系。
 *
 * 映射关系基于 Cubism 4 标准参数规范：
 *   https://docs.live2d.com/cubism-editor-manual/standard-parameter-list/
 *
 * 标准 Cubism 参数（来自 Live2D 官方文档）：
 *   - ParamAngleX: 头部左右旋转 (Yaw, -30~30)
 *   - ParamAngleY: 头部上下旋转 (Pitch, -30~30)
 *   - ParamAngleZ: 头部倾斜 (Roll, -30~30)
 *   - ParamEyeBallX: 眼球左右移动 (-1~1)
 *   - ParamEyeBallY: 眼球上下移动 (-1~1)
 *   - ParamEyeLOpen / ParamEyeROpen: 左右眼开合 (0~1)
 *   - ParamMouthOpenY: 嘴巴纵向开合 (0~1)
 *   - ParamMouthForm: 嘴型 (-1~1, 负=微笑, 正=撇嘴)
 *   - ParamBrowLY / ParamBrowRY: 左右眉毛上下 (-1~1)
 *   - ParamBodyAngleX / Y / Z: 身体旋转
 *   - ParamBreath: 呼吸 (0~1, 周期性)
 */

// ===================== 映射配置 =====================

/**
 * 默认映射配置
 * 每个映射项定义：
 *   - source: MediaPipe 数据源路径
 *   - paramId: Cubism 参数 ID
 *   - scale: 缩放系数
 *   - offset: 偏移量
 *   - deadZone: 死区（小于此值的变动被忽略）
 *   - smooth: 平滑系数（0=不平滑，1=完全平滑，即不更新）
 *   - invert: 是否反转
 *   - clampMin: 输出最小值
 *   - clampMax: 输出最大值
 */
const DEFAULT_MAPPINGS = [
  // === 头部旋转 ===
  {
    source: 'headYaw',
    paramId: 'ParamAngleX',
    scale: 60,        // 0~1 -> -30~30 度
    offset: -30,      // 居中偏移
    deadZone: 0.01,
    smooth: 0.1,
    invert: false,
    clampMin: -30,
    clampMax: 30,
  },
  {
    source: 'headPitch',
    paramId: 'ParamAngleY',
    scale: 60,
    offset: -30,
    deadZone: 0.01,
    smooth: 0.1,
    invert: false,
    clampMin: -30,
    clampMax: 30,
  },
  {
    source: 'headRoll',
    paramId: 'ParamAngleZ',
    scale: 60,
    offset: -30,
    deadZone: 0.01,
    smooth: 0.1,
    invert: false,
    clampMin: -30,
    clampMax: 30,
  },

  // === 眼睛开合 ===
  {
    source: 'eyeLeft',
    paramId: 'ParamEyeLOpen',
    scale: 1,
    offset: 0,
    deadZone: 0.02,
    smooth: 0.15,
    invert: false,
    clampMin: 0,
    clampMax: 1,
  },
  {
    source: 'eyeRight',
    paramId: 'ParamEyeROpen',
    scale: 1,
    offset: 0,
    deadZone: 0.02,
    smooth: 0.15,
    invert: false,
    clampMin: 0,
    clampMax: 1,
  },

  // === 眼球方向 ===
  {
    source: 'headYaw',
    paramId: 'ParamEyeBallX',
    scale: 2,         // 0~1 -> -1~1
    offset: -1,
    deadZone: 0.02,
    smooth: 0.15,
    invert: false,
    clampMin: -1,
    clampMax: 1,
  },
  {
    source: 'headPitch',
    paramId: 'ParamEyeBallY',
    scale: 2,
    offset: -1,
    deadZone: 0.02,
    smooth: 0.15,
    invert: false,
    clampMin: -1,
    clampMax: 1,
  },

  // === 嘴巴 ===
  {
    source: 'mouthOpen',
    paramId: 'ParamMouthOpenY',
    scale: 1.5,
    offset: 0,
    deadZone: 0.05,
    smooth: 0.2,
    invert: false,
    clampMin: 0,
    clampMax: 1.5,
  },
  {
    source: 'mouthSmile',
    paramId: 'ParamMouthForm',
    scale: -2,        // 微笑=正值 -> Cubism MouthForm 负值=微笑
    offset: 1,
    deadZone: 0.05,
    smooth: 0.2,
    invert: false,
    clampMin: -1,
    clampMax: 1,
  },

  // === 眉毛 ===
  {
    source: 'browLeft',
    paramId: 'ParamBrowLY',
    scale: 2,
    offset: -1,
    deadZone: 0.03,
    smooth: 0.12,
    invert: false,
    clampMin: -1,
    clampMax: 1,
  },
  {
    source: 'browRight',
    paramId: 'ParamBrowRY',
    scale: 2,
    offset: -1,
    deadZone: 0.03,
    smooth: 0.12,
    invert: false,
    clampMin: -1,
    clampMax: 1,
  },

  // === 头部位置映射到身体 ===
  {
    source: 'headX',
    paramId: 'ParamBodyAngleX',
    scale: 20,        // 0~1 -> -10~10
    offset: -10,
    deadZone: 0.03,
    smooth: 0.15,
    invert: false,
    clampMin: -10,
    clampMax: 10,
  },
  {
    source: 'headY',
    paramId: 'ParamBodyAngleY',
    scale: 20,
    offset: -10,
    deadZone: 0.03,
    smooth: 0.15,
    invert: false,
    clampMin: -10,
    clampMax: 10,
  },
];

// ===================== 映射器类 =====================

export class FaceTrackingToCubismMapper {
  /**
   * @param {Array<Object>} [customMappings] - 自定义映射配置（覆盖默认）
   */
  constructor(customMappings = null) {
    this.mappings = customMappings || this._cloneMappings(DEFAULT_MAPPINGS);

    // 平滑状态：{ source: smoothedValue }
    this._smoothState = {};
    for (const m of this.mappings) {
      this._smoothState[m.source] = 0;
    }

    // 诊断信息
    this._diagnostics = {
      rawInputs: {},
      outputValues: {},
      lastUpdateTime: 0,
    };
  }

  /**
   * 克隆映射配置（深拷贝，不共享引用）
   */
  _cloneMappings(mappings) {
    return mappings.map(m => ({ ...m }));
  }

  /**
   * 获取映射配置
   */
  getMappings() {
    return this.mappings;
  }

  /**
   * 更新映射配置
   * @param {Array<Object>} newMappings
   */
  setMappings(newMappings) {
    this.mappings = this._cloneMappings(newMappings);
    this._smoothState = {};
    for (const m of this.mappings) {
      this._smoothState[m.source] = 0;
    }
  }

  /**
   * 主映射函数：将面部追踪数据转换为 Cubism 参数
   *
   * @param {Object} faceTrackingData - MediaPipe 面部追踪数据
   *   {
   *     eyeLeft: number,    // 0~1, 左眼开合度
   *     eyeRight: number,   // 0~1, 右眼开合度
   *     mouthOpen: number,  // 0~1, 嘴巴开合度
   *     mouthSmile: number, // 0~1, 微笑程度
   *     browLeft: number,   // 0~1, 左眉上扬
   *     browRight: number,  // 0~1, 右眉上扬
   *     headYaw: number,    // 0~1, 头部左右旋转（0.5=正面）
   *     headPitch: number,  // 0~1, 头部上下旋转（0.5=正面）
   *     headRoll: number,   // 0~1, 头部倾斜（0.5=正面）
   *     headX: number,      // 0~1, 头部水平位置
   *     headY: number,      // 0~1, 头部垂直位置
   *   }
   * @returns {Object} Cubism 参数映射: { paramId: value }
   */
  map(faceTrackingData) {
    const result = {};
    const now = performance.now();

    // 更新原始输入诊断
    this._diagnostics.rawInputs = { ...faceTrackingData };

    for (const mapping of this.mappings) {
      const rawValue = faceTrackingData[mapping.source];
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      // 映射计算
      let value = rawValue * mapping.scale + mapping.offset;

      // 反转
      if (mapping.invert) {
        value = -value;
      }

      // 死区处理
      if (Math.abs(value - this._smoothState[mapping.source]) < mapping.deadZone) {
        value = this._smoothState[mapping.source];
      }

      // 平滑处理
      if (mapping.smooth > 0 && mapping.smooth < 1) {
        const previous = this._smoothState[mapping.source] || 0;
        value = previous + (value - previous) * (1 - mapping.smooth);
      }

      // Clamp
      if (mapping.clampMin !== undefined) {
        value = Math.max(mapping.clampMin, value);
      }
      if (mapping.clampMax !== undefined) {
        value = Math.min(mapping.clampMax, value);
      }

      // 更新平滑状态
      this._smoothState[mapping.source] = value;

      // 输出
      result[mapping.paramId] = value;
    }

    // 更新诊断
    this._diagnostics.outputValues = { ...result };
    this._diagnostics.lastUpdateTime = now;

    return result;
  }

  /**
   * 获取当前映射诊断信息
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      ...this._diagnostics,
      smoothState: { ...this._smoothState },
      mappingCount: this.mappings.length,
      activeMappings: this.mappings.map(m => ({
        source: m.source,
        paramId: m.paramId,
        deadZone: m.deadZone,
        smooth: m.smooth,
      })),
    };
  }

  /**
   * 重置平滑状态
   */
  resetSmoothState() {
    this._smoothState = {};
    for (const m of this.mappings) {
      this._smoothState[m.source] = 0;
    }
  }

  /**
   * 添加自定义映射
   * @param {Object} mapping - 映射配置项
   */
  addMapping(mapping) {
    this.mappings.push({ ...mapping });
    this._smoothState[mapping.source] = 0;
  }

  /**
   * 移除指定参数 ID 的映射
   * @param {string} paramId
   */
  removeMapping(paramId) {
    const idx = this.mappings.findIndex(m => m.paramId === paramId);
    if (idx >= 0) {
      const removed = this.mappings.splice(idx, 1)[0];
      delete this._smoothState[removed.source];
    }
  }
}

// ===================== 预设映射配置 =====================

/**
 * Cubism 标准参数列表（贴纸规格）
 * 用于参考，不直接修改模型
 */
export const CUBISM_STANDARD_PARAMS = {
  // 头部旋转
  ParamAngleX: { min: -30, max: 30, default: 0, desc: '头部左右旋转 (Yaw)' },
  ParamAngleY: { min: -30, max: 30, default: 0, desc: '头部上下旋转 (Pitch)' },
  ParamAngleZ: { min: -30, max: 30, default: 0, desc: '头部倾斜 (Roll)' },

  // 眼睛
  ParamEyeLOpen: { min: 0, max: 1, default: 1, desc: '左眼开合' },
  ParamEyeROpen: { min: 0, max: 1, default: 1, desc: '右眼开合' },
  ParamEyeBallX: { min: -1, max: 1, default: 0, desc: '眼球左右移动' },
  ParamEyeBallY: { min: -1, max: 1, default: 0, desc: '眼球上下移动' },
  ParamEyeLSmile: { min: 0, max: 1, default: 0, desc: '左眼笑眼' },
  ParamEyeRSmile: { min: 0, max: 1, default: 0, desc: '右眼笑眼' },

  // 嘴巴
  ParamMouthOpenY: { min: 0, max: 1, default: 0, desc: '嘴巴纵向开合' },
  ParamMouthForm: { min: -1, max: 1, default: 0, desc: '嘴型 (负=微笑)' },

  // 眉毛
  ParamBrowLY: { min: -1, max: 1, default: 0, desc: '左眉上下' },
  ParamBrowRY: { min: -1, max: 1, default: 0, desc: '右眉上下' },
  ParamBrowLAngle: { min: -1, max: 1, default: 0, desc: '左眉角度' },
  ParamBrowRAngle: { min: -1, max: 1, default: 0, desc: '右眉角度' },

  // 身体
  ParamBodyAngleX: { min: -10, max: 10, default: 0, desc: '身体左右旋转' },
  ParamBodyAngleY: { min: -10, max: 10, default: 0, desc: '身体上下旋转' },
  ParamBodyAngleZ: { min: -10, max: 10, default: 0, desc: '身体倾斜' },

  // 呼吸
  ParamBreath: { min: 0, max: 1, default: 0, desc: '呼吸' },
};

export default FaceTrackingToCubismMapper;