import assert from 'node:assert/strict';
import { test } from 'node:test';

await import('../../src/shared/runtime/receiver-transport-controller.js');
const Controller = globalThis.ReceiverTransportController;

function fakeClock() {
  let nextId = 1;
  const timers = new Map();
  return {
    timers,
    setTimeoutFn(callback, delay) { const id = nextId++; timers.set(id, { callback, delay }); return id; },
    clearTimeoutFn(id) { timers.delete(id); },
    run(id) { const timer = timers.get(id); timers.delete(id); timer.callback(); },
  };
}

test('transport retry uses exponential backoff, jitter, and one timer per channel', () => {
  const clock = fakeClock();
  const controller = new Controller({ ...clock, randomFn: () => 0.5, baseDelayMs: 1000, maxDelayMs: 4000 });
  assert.equal(controller.schedule('sse', () => {}), 1000);
  assert.equal(controller.schedule('sse', () => {}), 2000);
  assert.equal(clock.timers.size, 1);
  assert.equal(controller.schedule('sse', () => {}), 4000);
  assert.equal(controller.schedule('sse', () => {}), 4000);
  controller.reset('sse');
  assert.equal(clock.timers.size, 0);
  assert.equal(controller.schedule('sse', () => {}), 1000);
});

test('offline, hidden, unauthorized, and stopped states cancel retries', () => {
  const clock = fakeClock();
  const states = [];
  const controller = new Controller({ ...clock, randomFn: () => 0.5, onState: (state) => states.push(state) });
  controller.schedule('ws', () => {});
  controller.setOnline(false);
  assert.equal(clock.timers.size, 0);
  assert.equal(controller.state, 'offline');
  assert.equal(controller.schedule('ws', () => {}), null);
  controller.setOnline(true);
  controller.setVisible(false);
  assert.equal(controller.schedule('sse', () => {}), null);
  controller.setVisible(true);
  controller.unauthorized();
  assert.equal(controller.state, 'unauthorized');
  assert.equal(controller.schedule('ws', () => {}), null);
  controller.stop();
  assert.equal(controller.state, 'stopped');
  assert.equal(controller.schedule('ws', () => {}), null);
  assert.deepEqual(states, ['offline', 'idle', 'unauthorized', 'stopped']);
});
