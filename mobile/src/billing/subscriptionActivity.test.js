import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { monitorSubscription } from './subscriptionActivity';
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

it('recovers missed orders on connect, drains bounded pages, and cleans up', async () => {
  vi.useFakeTimers();
  const handlers = {};
  const socket = { on: vi.fn((name, handler) => { handlers[name] = handler; }), connect: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  io.mockReturnValue(socket);
  const responses = [{ cursor: 10, items: [] }, { cursor: 11, items: [{ id: 11 }], has_more: true }, { cursor: 12, items: [{ id: 12 }] }, { cursor: 12, items: [] }];
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080, channel: 'private-shop.subscription.business.1' } : path.endsWith('/auth') ? { token: 'ticket' } : responses.shift());
  const incoming = vi.fn();
  const stop = monitorSubscription(api, 'owner:1', incoming);
  await vi.advanceTimersByTimeAsync(0);
  expect(incoming).not.toHaveBeenCalled();
  const authorize = vi.fn();
  await io.mock.calls.at(-1)[1].auth(authorize);
  await vi.advanceTimersByTimeAsync(0);
  expect(authorize).toHaveBeenCalledWith({ token: 'ticket' });
  await handlers.connect(); await vi.advanceTimersByTimeAsync(150);
  expect(incoming.mock.calls).toEqual([[[{ id: 11 }], undefined], [[{ id: 12 }], undefined]]);
  expect(api).toHaveBeenCalledWith('/subscription/alerts?after_id=11');
  await handlers['subscription.approved']({ order_id: 12 }); await vi.advanceTimersByTimeAsync(150);
  expect(incoming).toHaveBeenCalledTimes(2);
  handlers.disconnect('io server disconnect'); expect(socket.connect).toHaveBeenCalledOnce();
  stop();
  expect(socket.disconnect).toHaveBeenCalledOnce();
  const calls = api.mock.calls.length;
  await vi.advanceTimersByTimeAsync(30000);
  window.dispatchEvent(new Event('online'));
  expect(api).toHaveBeenCalledTimes(calls);
});

it('falls back to polling, respects throttling, and ignores late responses after logout', async () => {
  vi.useFakeTimers();
  let rejectOnce = true;
  const api = vi.fn(async path => {
    if (path.endsWith('/config')) return { realtime_enabled: false };
    if (rejectOnce) { rejectOnce = false; throw { status: 429, retryAfterMs: 30000 }; }
    return { cursor: 0, items: [] };
  });
  const stop = monitorSubscription(api, 'owner:1', vi.fn());
  await vi.advanceTimersByTimeAsync(15000);
  expect(api).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15000);
  expect(api).toHaveBeenCalledWith('/subscription/alerts/config');
  stop();
  let resolve;
  const delayed = vi.fn(() => new Promise(done => { resolve = done; }));
  const incoming = vi.fn();
  const close = monitorSubscription(delayed, 'owner:1', incoming); close();
  resolve({ cursor: 1, items: [{ id: 1 }] });
  await vi.advanceTimersByTimeAsync(0);
  expect(incoming).not.toHaveBeenCalled();
});

it('revoked permissions stop the monitor and clear pending alerts', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async () => { throw { status: 403 }; });
  const incoming = vi.fn();
  const stop = monitorSubscription(api, 'owner:1', incoming);
  await vi.advanceTimersByTimeAsync(30000);
  expect(incoming).toHaveBeenCalledWith([]);
  expect(api).toHaveBeenCalledOnce();
  stop();
});

it('persists delivery across remounts and ignores repeated approval identifiers', async () => {
  vi.useFakeTimers();
  localStorage.setItem('mkpos.subscription-alert-cursor:owner:1', '10');
  const subscription = { is_valid: true };
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: false } : { cursor: 11, items: [{ id: 11, plan_name: 'Pro' }], subscription });
  const receive = vi.fn();const stop = monitorSubscription(api, 'owner:1', receive);
  await vi.advanceTimersByTimeAsync(15000);
  expect(receive).toHaveBeenCalledExactlyOnceWith([{ id: 11, plan_name: 'Pro' }], subscription);
  stop();const resume = monitorSubscription(api, 'owner:1', receive);
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledOnce();expect(api).toHaveBeenCalledWith('/subscription/alerts?after_id=11');resume();
});
