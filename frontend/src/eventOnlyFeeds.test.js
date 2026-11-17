import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { monitorActivity } from './activityRealtime';
import { monitorSubscription } from './subscriptionActivity';
import { monitorOrders } from './orderActivity';
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
let stop;
afterEach(() => { stop?.(); stop = undefined; localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

it.each([
  ['activity', (api, receive) => monitorActivity(api, 'idle:42', receive), 'activity.changed'],
  ['subscription', (api, receive) => monitorSubscription(api, 'idle:42', receive), 'subscription.approved'],
  ['orders', (api, receive) => monitorOrders(api, receive), 'order.changed'],
])('%s stays quiet across time, navigation/resume and disconnection, then catches up on a socket event', async (_, monitor, event) => {
  vi.useFakeTimers();
  const handlers = {};
  const socket = { connected: true, active: true, on: vi.fn((name, handler) => { handlers[name] = handler; }), disconnect: vi.fn(), removeAllListeners: vi.fn(), connect: vi.fn() };
  io.mockReturnValue(socket);
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, channel: 'fixture' } : { cursor: 0, items: [] });
  stop = monitor(api, vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  const initial = api.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1200000);
  document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(150);
  expect(api).toHaveBeenCalledTimes(initial);
  socket.connected = false; handlers.disconnect('transport close');
  await vi.advanceTimersByTimeAsync(1200000);
  expect(api).toHaveBeenCalledTimes(initial);
  socket.connected = true; handlers.connect();
  await vi.advanceTimersByTimeAsync(150);
  expect(api).toHaveBeenCalledTimes(initial + 1);
  for (let i = 0; i < 100; i++) handlers[event]();
  await vi.advanceTimersByTimeAsync(150);
  expect(api).toHaveBeenCalledTimes(initial + 2);
});
