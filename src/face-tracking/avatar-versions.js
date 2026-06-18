/**
 * Avatar Versions Registry
 * 管理所有可用形象版本
 */

// 旧版兼容：saka → mesh-spindle-whale
const OLD_TO_NEW = {
  saka: 'mesh-spindle-whale',
  'saka-whale': 'mesh-spindle-whale',
  sphere: 'mesh-sphere',
};

export function migrateOldVersion(oldId) {
  return OLD_TO_NEW[oldId] || null;
}

export const AVATAR_REGISTRY = {
  'mesh-sphere': () => {
    return import('./procedural-mesh-renderer.js').then((m) => new m.ProceduralSphereAvatar('avatar_canvas'));
  },
  'mesh-spindle-whale': () => {
    return import('./procedural-mesh-renderer.js').then((m) => new m.ProceduralSpindleWhaleAvatar('avatar_canvas'));
  },
  'saka-memorial': () => {
    return import('./avatar-versions.js').then((m) => {
      if (m._createMemorial) return m._createMemorial();
      // 懒加载
      return import('./debug-avatar.js').then((dm) => new dm.MemorialAvatar('avatar_canvas'));
    });
  },
  'live2d-cubism': () => {
    return import('./cubism-runtime.js').then((m) => {
      if (m.CubismAvatarWrapper) {
        return new m.CubismAvatarWrapper('avatar_canvas');
      }
      throw new Error('Cubism runtime not available');
    });
  },
};

export const AVATAR_VERSIONS = [
  { id: 'mesh-spindle-whale', name: '纺锤鲸鱼', desc: '萨卡班甲鱼风格纺锤体 + 鲸鱼尾巴' },
  { id: 'mesh-sphere', name: '球形头像', desc: '程序化 2.5D 球形卡通头像' },
  { id: 'saka-memorial', name: '纪念版', desc: '原版萨卡班甲鱼' },
  { id: 'live2d-cubism', name: 'Live2D 自定义模型（实验）', desc: '导入 Cubism 模型（需模型文件）' },
];

export const DEFAULT_AVATAR = 'mesh-spindle-whale';

export async function createAvatar(versionId) {
  // 迁移旧版本
  const migrated = migrateOldVersion(versionId);
  const effectiveId = migrated || versionId;

  const factory = AVATAR_REGISTRY[effectiveId];
  if (!factory) {
    console.warn(`Unknown avatar version: ${effectiveId}, falling back to default`);
    return AVATAR_REGISTRY[DEFAULT_AVATAR]();
  }
  return factory();
}