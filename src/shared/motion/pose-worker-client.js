import { PERFORMANCE_PROFILES } from './pose-scheduler.js';

export class PoseWorkerClient {
  constructor({
    workerFactory,
    createBitmap,
    timeoutMs = 2000,
    onFrame = () => {},
    onStatus = () => {},
    onStats = () => {},
  }) {
    this.workerFactory = workerFactory;
    this.createBitmap = createBitmap;
    this.timeoutMs = timeoutMs;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.onStats = onStats;
    this.worker = null;
    this.enabled = false;
    this.ready = false;
    this.busy = false;
    this.profile = 'low';
    this.timer = null;
    this.droppedMessages = 0;
  }

  enable({ profile = 'low', mirrored = true } = {}) {
    if (!PERFORMANCE_PROFILES[profile]) throw new Error(`Unknown performance profile: ${profile}`);
    this.enabled = true;
    this.profile = profile;
    this.mirrored = mirrored;
    if (this.worker) return;
    this.worker = this.workerFactory();
    this.worker.onmessage = (event) => this.handleMessage(event.data);
    this.worker.onerror = (event) => this.fail(event?.message || 'pose worker error');
    this.onStatus('loading');
    this.worker.postMessage({ type: 'init', profile, mirrored });
  }

  disable() {
    this.enabled = false;
    this.ready = false;
    this.busy = false;
    clearTimeout(this.timer);
    this.timer = null;
    if (this.worker) {
      this.worker.postMessage({ type: 'close' });
      this.worker.terminate();
      this.worker = null;
    }
    this.onStatus('off');
  }

  configure({ profile = this.profile, mirrored = this.mirrored } = {}) {
    if (!PERFORMANCE_PROFILES[profile]) throw new Error(`Unknown performance profile: ${profile}`);
    this.profile = profile;
    this.mirrored = mirrored;
    if (this.worker) this.worker.postMessage({ type: 'configure', profile, mirrored });
  }

  async process(video, timestampMs) {
    if (!this.enabled || !this.ready || !this.worker) return false;
    if (this.busy) {
      this.droppedMessages++;
      return false;
    }
    this.busy = true;
    const width = PERFORMANCE_PROFILES[this.profile].inputWidth;
    try {
      const height = Math.max(1, Math.round(width * (video.videoHeight || 3) / (video.videoWidth || 4)));
      const bitmap = await this.createBitmap(video, { resizeWidth: width, resizeHeight: height, resizeQuality: 'low' });
      if (!this.enabled || !this.worker) {
        bitmap.close?.();
        this.busy = false;
        return false;
      }
      this.worker.postMessage({ type: 'frame', bitmap, timestampMs, mirrored: this.mirrored }, [bitmap]);
      this.timer = setTimeout(() => this.fail('pose inference timeout'), this.timeoutMs);
      return true;
    } catch (error) {
      this.busy = false;
      this.fail(error?.message || String(error));
      return false;
    }
  }

  handleMessage(message) {
    if (message?.type === 'ready') {
      this.ready = true;
      this.onStatus('ready');
      return;
    }
    if (message?.type === 'frame') {
      clearTimeout(this.timer);
      this.timer = null;
      this.busy = false;
      this.onFrame(message.frame);
      if (message.stats) this.onStats({ ...message.stats, droppedMessages: this.droppedMessages });
      return;
    }
    if (message?.type === 'error') this.fail(message.error || 'pose worker error');
  }

  fail(message) {
    clearTimeout(this.timer);
    this.timer = null;
    this.busy = false;
    this.ready = false;
    this.onStatus('error', message);
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }
}
