/**
 * ASR 离线模型清单 (ASR Model Manifest)
 *
 * 仅记录模型元信息，不包含模型权重。
 * 模型权重通过 Release/镜像分发，不提交到 git 仓库。
 *
 * 下载顺序：本地已安装 → 项目本地路径 → Gitee Release → ModelScope → GitHub Release → 官方源
 */

export const ASR_MODEL_MANIFEST = {
  zhCN: [
    {
      id: 'vosk-model-small-cn-0.22',
      engine: 'vosk',
      lang: 'zh-CN',
      sizeMB: 42,
      license: 'Apache-2.0',
      redistributable: true,
      recommendedFor: ['offline-fallback', 'low-resource-device', 'accessibility-caption'],
      accuracyNote: '轻量中文模型，适合作为离线 fallback；效果可能不如在线识别或大模型。',
      localPath: './models/vosk-model-small-cn-0.22/',
      mirrors: [
        { type: 'local', url: './models/vosk-model-small-cn-0.22/', label: '本地已安装' },
        { type: 'gitee', url: 'https://gitee.com/<owner>/<repo>/releases/download/asr-models/vosk-model-small-cn-0.22.zip', label: 'Gitee Release' },
        { type: 'modelscope', url: 'https://modelscope.cn/<namespace>/<model>/resolve/master/vosk-model-small-cn-0.22.zip', label: 'ModelScope' },
        { type: 'github', url: 'https://github.com/<owner>/<repo>/releases/download/asr-models/vosk-model-small-cn-0.22.zip', label: 'GitHub Release' },
        { type: 'official', url: 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip', label: 'Vosk 官方源' }
      ],
      sha256: '<待模型资产准备好后填入>',
      licenseFiles: ['LICENSE', 'NOTICE']
    }
  ],
  enUS: [
    {
      id: 'vosk-model-small-en-us-0.15',
      engine: 'vosk',
      lang: 'en-US',
      sizeMB: 40,
      license: 'Apache-2.0',
      redistributable: true,
      recommendedFor: ['offline-fallback', 'english-caption'],
      mirrors: [
        { type: 'local', url: './models/vosk-model-small-en-us-0.15/', label: '本地已安装' },
        { type: 'gitee', url: 'https://gitee.com/<owner>/<repo>/releases/download/asr-models/vosk-model-small-en-us-0.15.zip', label: 'Gitee Release' },
        { type: 'github', url: 'https://github.com/<owner>/<repo>/releases/download/asr-models/vosk-model-small-en-us-0.15.zip', label: 'GitHub Release' },
        { type: 'official', url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip', label: 'Vosk 官方源' }
      ],
      sha256: '<待模型资产准备好后填入>'
    }
  ]
};

/**
 * 获取指定语言的首选离线模型
 * @param {string} lang - 语言代码，如 'zh-CN', 'en-US'
 * @returns {object|null} 模型条目，或 null
 */
export function getPreferredModel(lang) {
  const candidates = ASR_MODEL_MANIFEST[lang];
  if (!candidates || candidates.length === 0) return null;
  return candidates[0];
}

/**
 * 获取模型的镜像下载顺序（已排序：中国网络优先）
 * 跳过 local 类型（本地已安装），返回需要下载的镜像列表
 * @param {object} model - 模型条目
 * @returns {Array<{type: string, url: string, label: string}>}
 */
export function getDownloadMirrors(model) {
  if (!model || !model.mirrors) return [];
  return model.mirrors.filter(m => m.type !== 'local');
}