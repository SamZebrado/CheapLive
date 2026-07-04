(function () {
  'use strict';

  const diag = {
    rendererKey: 'sacabambaspis3d',
    source: 'src/face-tracking',
    fallbackActive: false,
    fallbackReason: null,
    rendererReady: false,
    error: null,
    faceFrameActive: false,
    frameSource: null,
    lastAppliedSeq: 0,
    lastAppliedFrame: null,
    lastAppliedValues: null,
    idleActive: true,
    canvasWidth: null,
    canvasHeight: null,
    displayWidth: null,
    displayHeight: null,
    lastRenderTime: null,
    rendererClass: null,
    mainCanvasDiag: null,
    fwCanvasDiag: null,
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
          diag.rendererClass = 'ProceduralSpindleWhaleAvatar';
          resolve(_AvatarClass);
        })
        .catch((err) => {
          diag.error = String(err);
          diag.fallbackActive = true;
          diag.fallbackReason = String(err);
          reject(err);
        });
    });
    return _loadPromise;
  }

  const _instances = new Map();

  function _snapshotCanvas(canvas) {
    if (!canvas) return null;
    return {
      w: canvas.width,
      h: canvas.height,
      dw: canvas.clientWidth,
      dh: canvas.clientHeight,
      aspectRatio:
        canvas.width && canvas.height ? canvas.width / canvas.height : null,
      isSquare: !!(canvas.width && canvas.height && canvas.width === canvas.height),
    };
  }

  function _refreshCanvasDiag() {
    const main = document.getElementById('avatarCanvas');
    const fw = document.getElementById('fwAvatarCanvas');
    diag.mainCanvasDiag = _snapshotCanvas(main);
    diag.fwCanvasDiag = _snapshotCanvas(fw);
    if (main) {
      diag.canvasWidth = main.width;
      diag.canvasHeight = main.height;
      diag.displayWidth = main.clientWidth;
      diag.displayHeight = main.clientHeight;
    }
  }

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
        _refreshCanvasDiag();
        return inst;
      })
      .catch((err) => {
        diag.fallbackActive = true;
        diag.fallbackReason = String(err);
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
    diag.lastRenderTime = performance.now ? performance.now() : Date.now();
    _refreshCanvasDiag();
    return true;
  };

  window.setContestFishAvatarTransparentMode = function setContestFishAvatarTransparentMode(canvasIdOrCanvas, enabled) {
    const canvasId =
      typeof canvasIdOrCanvas === 'string' ? canvasIdOrCanvas : canvasIdOrCanvas.id;
    const inst = _instances.get(canvasId);
    if (!inst) return false;
    if (typeof inst.setTransparentMode === 'function') {
      inst.setTransparentMode(enabled);
    }
    return true;
  };

  window.destroyContestFishAvatar = function destroyContestFishAvatar(canvasIdOrCanvas) {
    const canvasId =
      typeof canvasIdOrCanvas === 'string' ? canvasIdOrCanvas : canvasIdOrCanvas.id;
    _instances.delete(canvasId);
  };

  // 暴露一个 debug helper 供测试和发布后排查
  window.__cheapLiveContestAvatarRefreshCanvasDiag = _refreshCanvasDiag;
})();
