(function () {
  'use strict';

  const diag = {
    rendererKey: 'sacabambaspis3d',
    source: 'src/face-tracking',
    fallbackActive: false,
    rendererReady: false,
    error: null,
  };

  window.__cheapLiveContestAvatarDiag = diag;

  let _AvatarClass = null;
  let _loadPromise = null;

  function _loadRenderer() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise((resolve, reject) => {
      const base = document.currentScript
        ? new URL('.', document.currentScript.src).pathname
        : '';
      const rendererUrl = new URL(
        '../face-tracking/procedural-mesh-renderer.js',
        base || window.location.href
      ).href;
      import(rendererUrl)
        .then((mod) => {
          if (!mod.ProceduralSpindleWhaleAvatar) {
            throw new Error('ProceduralSpindleWhaleAvatar not exported');
          }
          _AvatarClass = mod.ProceduralSpindleWhaleAvatar;
          diag.rendererReady = true;
          resolve(_AvatarClass);
        })
        .catch((err) => {
          diag.error = String(err);
          diag.fallbackActive = true;
          reject(err);
        });
    });
    return _loadPromise;
  }

  const _instances = new Map();

  window.createContestFishAvatar = function createContestFishAvatar(canvasIdOrCanvas) {
    const canvasId =
      typeof canvasIdOrCanvas === 'string' ? canvasIdOrCanvas : canvasIdOrCanvas.id;
    if (_instances.has(canvasId)) {
      return Promise.resolve(_instances.get(canvasId));
    }
    return _loadRenderer()
      .then((Cls) => {
        const inst = new Cls(canvasId);
        _instances.set(canvasId, inst);
        return inst;
      })
      .catch((err) => {
        diag.fallbackActive = true;
        diag.error = String(err);
        throw err;
      });
  };

  window.renderContestFishAvatar = function renderContestFishAvatar(canvasIdOrCanvas, params) {
    const canvasId =
      typeof canvasIdOrCanvas === 'string' ? canvasIdOrCanvas : canvasIdOrCanvas.id;
    const inst = _instances.get(canvasId);
    if (!inst) return false;
    inst.updateParams(params || {});
    return true;
  };

  window.destroyContestFishAvatar = function destroyContestFishAvatar(canvasIdOrCanvas) {
    const canvasId =
      typeof canvasIdOrCanvas === 'string' ? canvasIdOrCanvas : canvasIdOrCanvas.id;
    _instances.delete(canvasId);
  };
})();
