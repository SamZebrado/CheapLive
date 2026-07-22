// Keep the Worker global in classic mode because MediaPipe's Emscripten loader
// uses importScripts for its WASM support files. The actual runtime remains an
// ES module and is loaded dynamically after the classic Worker is established.
const queuedMessages = [];
self.onmessage = (event) => queuedMessages.push(event);

import('/web/shared/motion/pose-worker.js')
  .then(async () => {
    const runtimeHandler = self.onmessage;
    for (const event of queuedMessages.splice(0)) await runtimeHandler(event);
  })
  .catch((error) => {
    self.postMessage({ type: 'error', error: error?.message || String(error) });
  });
