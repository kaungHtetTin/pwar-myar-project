import { afterEach, expect, it, vi } from 'vitest';
import { debounceRefresh, shareBackgroundFeed } from '../../shared/network/backgroundTabs';

const stops = [];
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('delivers bounded batches during a continuous stream instead of waiting indefinitely for silence', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn(), batch = debounceRefresh(refresh);
  for (let i = 0; i < 30; i++) { batch(); await vi.advanceTimersByTimeAsync(50); }
  expect(refresh).toHaveBeenCalledTimes(10);
  batch.cancel();
});

function setup(leader = true) {
  vi.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const channels = [];
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; this.postMessage = vi.fn(); this.close = vi.fn(); channels.push(this); }
  });
  vi.stubGlobal('navigator', { onLine: true, locks: { request: vi.fn((_name, _options, callback) => Promise.resolve(callback(leader ? {} : null))) } });
  return channels;
}

it('refreshes only the requested feed without broadcasting a fake document visibility event', async () => {
  const channels = setup();
  const refresh = vi.fn(), visibility = vi.fn();
  document.addEventListener('visibilitychange', visibility);
  const start = () => Object.assign(vi.fn(), { refresh });
  stops.push(shareBackgroundFeed('chat:/shop-admin/chat:1:2', start, vi.fn(), { refreshEvents: ['mkpos:shop-chat-read'] }));
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 20; i++) channels[0].onmessage({ data: { type: 'refresh', event: 'mkpos:shop-chat-read' } });
  await vi.advanceTimersByTimeAsync(150);
  expect(visibility).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledOnce();
  document.removeEventListener('visibilitychange', visibility);
});

it('does not ask unrelated notification feeds to refresh after a chat read', async () => {
  const channels = setup(false);
  stops.push(shareBackgroundFeed('orders:1:2', () => vi.fn(), vi.fn()));
  stops.push(shareBackgroundFeed('chat:/shop-admin/chat:1:2', () => vi.fn(), vi.fn(), { refreshEvents: ['mkpos:shop-chat-read'] }));
  await vi.advanceTimersByTimeAsync(0);
  channels.forEach(channel => channel.postMessage.mockClear());
  window.dispatchEvent(new Event('mkpos:shop-chat-read'));
  expect(channels[0].postMessage).not.toHaveBeenCalled();
  expect(channels[1].postMessage).toHaveBeenCalledWith({ type: 'refresh', event: 'mkpos:shop-chat-read' });
});

it('hands queued ownership to another tab without a periodic election timer', async () => {
  setup();
  const queue = []; let held = false;
  const grant = () => {
    if (held || !queue.length) return;
    const item = queue.shift();
    if (item.signal.aborted) { grant(); return; }
    held = true;
    Promise.resolve(item.callback({})).finally(() => { held = false; item.resolve(); grant(); });
  };
  navigator.locks.request.mockImplementation((_name, { signal }, callback) => new Promise((resolve, reject) => {
    const item = { signal, callback, resolve };
    queue.push(item);
    signal.addEventListener('abort', () => {
      const index = queue.indexOf(item);
      if (index !== -1) { queue.splice(index, 1); reject(new DOMException('Cancelled', 'AbortError')); }
    });
    grant();
  }));
  const startA = vi.fn(() => vi.fn()), startB = vi.fn(() => vi.fn());
  const a = shareBackgroundFeed('orders:queued:1', startA, vi.fn());
  const b = shareBackgroundFeed('orders:queued:1', startB, vi.fn());
  stops.push(a, b);
  await vi.advanceTimersByTimeAsync(0);
  expect(startA).toHaveBeenCalledTimes(1); expect(startB).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  a();
  await vi.advanceTimersByTimeAsync(0);
  expect(startB).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
