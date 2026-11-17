import { afterEach, expect, it, vi } from 'vitest';
import { createChatFallbackClock } from '../../shared/network/chatFallback.js';
import { subscribeDisplayClock } from '../../shared/network/displayClock.js';
import { createSocketRecovery } from '../../shared/network/socketRecovery.js';

const cleanups = [];
afterEach(() => {
  cleanups.splice(0).forEach(stop => stop());
  vi.useRealTimers(); vi.restoreAllMocks();
});

it('uses one fallback timer for all disconnected feeds and none while live, hidden or offline', async () => {
  vi.useFakeTimers();
  let live = false, hidden = false, online = true;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  const subscribe = createChatFallbackClock();
  const callbacks = [vi.fn(), vi.fn(), vi.fn()];
  callbacks.forEach(callback => {
    const feed = subscribe(callback, () => !live); cleanups.push(feed.stop);
  });
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(15000);
  callbacks.forEach(callback => expect(callback).toHaveBeenCalledOnce());
  live = true; window.dispatchEvent(new Event('mkpos:socket-state'));
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(300000);
  callbacks.forEach(callback => expect(callback).toHaveBeenCalledOnce());
  live = false; window.dispatchEvent(new Event('mkpos:socket-state'));
  expect(vi.getTimerCount()).toBe(1);
  hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
  hidden = false; online = false; document.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
  online = true; window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(15000);
  callbacks.forEach(callback => expect(callback).toHaveBeenCalledTimes(2));
});

it('serializes fallback reads and cancels a subscription before its queued request starts', async () => {
  vi.useFakeTimers();
  const subscribe = createChatFallbackClock();
  let finish;
  const refresh = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const feed = subscribe(refresh, () => true); cleanups.push(feed.stop);
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).toHaveBeenCalledOnce();
  feed.stop(); finish();
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('shares a local last-seen clock and releases it when all visible labels disappear', async () => {
  vi.useFakeTimers();
  let visible = true;
  const first = vi.fn(), second = vi.fn();
  cleanups.push(subscribeDisplayClock(first, () => visible), subscribeDisplayClock(second, () => visible));
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(30000);
  expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
  visible = false; document.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
  visible = true; document.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(1);
});

it('recovers an active Socket.IO subscription without its automatic retry loop and respects backoff', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  const handlers = new Map();
  const socket = { connected: false, active: true, connect: vi.fn(),
    on: (name, handler) => handlers.set(name, handler), off: vi.fn() };
  const recovery = createSocketRecovery(socket); cleanups.push(recovery.stop);
  handlers.get('connect_error')();
  recovery.retry(); recovery.retry();
  expect(socket.connect).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(30000);
  expect(socket.connect).toHaveBeenCalledOnce();
  handlers.get('connect_error')();
  await vi.advanceTimersByTimeAsync(59999);
  expect(socket.connect).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(socket.connect).toHaveBeenCalledTimes(2);
  socket.connected = true; handlers.get('connect')();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});
