(function(root) {
  'use strict';

  class ReceiverTransportController {
    constructor(options) {
      options = options || {};
      this._setTimeout = options.setTimeoutFn || function(callback, delay) { return setTimeout(callback, delay); };
      this._clearTimeout = options.clearTimeoutFn || function(timer) { clearTimeout(timer); };
      this._random = options.randomFn || Math.random;
      this._onState = options.onState || function() {};
      this.baseDelayMs = options.baseDelayMs || 1000;
      this.maxDelayMs = options.maxDelayMs || 30000;
      this.state = 'idle';
      this.online = true;
      this.visible = true;
      this.authorized = true;
      this.stopped = false;
      this._timers = new Map();
      this._attempts = new Map();
    }

    transition(next) {
      if (this.stopped && next !== 'stopped') return;
      if (this.state === next) return;
      this.state = next;
      this._onState(next);
    }

    canRun() {
      return !this.stopped && this.online && this.visible && this.authorized;
    }

    schedule(key, callback, baseDelayMs) {
      this.cancel(key);
      if (!this.canRun()) return null;
      const attempt = this._attempts.get(key) || 0;
      const base = baseDelayMs || this.baseDelayMs;
      const cap = Math.min(this.maxDelayMs, base * Math.pow(2, attempt));
      const jitter = 0.8 + Math.max(0, Math.min(1, this._random())) * 0.4;
      const delay = Math.max(1, Math.round(cap * jitter));
      this._attempts.set(key, attempt + 1);
      const timer = this._setTimeout(() => {
        this._timers.delete(key);
        if (this.canRun()) callback();
      }, delay);
      this._timers.set(key, timer);
      return delay;
    }

    reset(key) {
      this.cancel(key);
      this._attempts.delete(key);
    }

    cancel(key) {
      const timer = this._timers.get(key);
      if (timer !== undefined) this._clearTimeout(timer);
      this._timers.delete(key);
    }

    cancelAll() {
      for (const key of Array.from(this._timers.keys())) this.cancel(key);
    }

    setOnline(online) {
      this.online = !!online;
      if (!this.online) {
        this.cancelAll();
        this.transition('offline');
      } else if (!this.stopped) {
        this.transition('idle');
      }
    }

    setVisible(visible) {
      this.visible = !!visible;
      if (!this.visible) {
        this.cancelAll();
        this.transition('idle');
      }
    }

    unauthorized() {
      this.cancelAll();
      this.authorized = false;
      this.transition('unauthorized');
    }

    stop() {
      if (this.stopped) return;
      this.cancelAll();
      this.stopped = true;
      this.transition('stopped');
    }
  }

  root.ReceiverTransportController = ReceiverTransportController;
})(typeof globalThis !== 'undefined' ? globalThis : window);
