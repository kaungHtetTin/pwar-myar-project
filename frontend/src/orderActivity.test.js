import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { monitorOrders } from './orderActivity';
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('recovers missed orders on connect, drains bounded pages, and cleans up', async () => {
  vi.useFakeTimers();
  const handlers = {};
  const socket = { on: vi.fn((name, handler) => { handlers[name] = handler; }), connect: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  io.mockReturnValue(socket);
  const responses = [{ cursor: 10, items: [] }, { cursor: 11, items: [{ id: 11 }], has_more: true }, { cursor: 12, items: [{ id: 12 }] }, { cursor: 12, items: [] }];
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080, channel: 'private-shop.orders.business.1' } : path.endsWith('/auth') ? { token: 'ticket' } : responses.shift());
  const incoming = vi.fn();
  const stop = monitorOrders(api, incoming);
  await vi.advanceTimersByTimeAsync(0);
  expect(incoming).not.toHaveBeenCalled();
  const authorize = vi.fn();
  await io.mock.calls.at(-1)[1].auth(authorize);
  await vi.advanceTimersByTimeAsync(0);
  expect(authorize).toHaveBeenCalledWith({ token: 'ticket' });
  await handlers.connect(); await vi.advanceTimersByTimeAsync(150);
  expect(incoming.mock.calls).toEqual([[[{ id: 11 }]], [[{ id: 12 }]]]);
  expect(api).toHaveBeenCalledWith('/shop-admin/order-notifications?after_id=11');
  await handlers['order.submitted']({ order_id: 12 }); await vi.advanceTimersByTimeAsync(150);
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
  const stop = monitorOrders(api, vi.fn());
  await vi.advanceTimersByTimeAsync(15000);
  expect(api).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15000);
  expect(api).toHaveBeenCalledWith('/shop-admin/order-notifications/config');
  stop();
  let resolve;
  const delayed = vi.fn(() => new Promise(done => { resolve = done; }));
  const incoming = vi.fn();
  const close = monitorOrders(delayed, incoming); close();
  resolve({ cursor: 1, items: [{ id: 1 }] });
  await vi.advanceTimersByTimeAsync(0);
  expect(incoming).not.toHaveBeenCalled();
});

it('revoked permissions stop the monitor and clear pending alerts', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async () => { throw { status: 403 }; });
  const incoming = vi.fn();
  const stop = monitorOrders(api, incoming);
  await vi.advanceTimersByTimeAsync(30000);
  expect(incoming).toHaveBeenCalledWith([]);
  expect(api).toHaveBeenCalledOnce();
  stop();
});

it('reports outstanding actions on baseline and updates without replaying order alerts', async () => {
  vi.useFakeTimers(); let count = 4;
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: false } : { cursor: 5, items: [], action_required_count: count });
  const incoming = vi.fn(), activity = vi.fn();
  const stop = monitorOrders(api, incoming, activity);
  await vi.advanceTimersByTimeAsync(0); expect(activity).toHaveBeenLastCalledWith(4); expect(incoming).not.toHaveBeenCalled();
  count = 2; window.dispatchEvent(new CustomEvent('mkpos:data-change', { detail: { resources: ['ecommerce'], source: 'shop' } }));
  await vi.advanceTimersByTimeAsync(0); expect(activity).toHaveBeenLastCalledWith(2);
  count = 0; window.dispatchEvent(new CustomEvent('mkpos:owner-order-activity'));
  await vi.advanceTimersByTimeAsync(0); expect(activity).toHaveBeenLastCalledWith(0); expect(incoming).not.toHaveBeenCalled();
  stop(); const calls = api.mock.calls.length;
  window.dispatchEvent(new CustomEvent('mkpos:owner-order-activity')); await vi.advanceTimersByTimeAsync(0); expect(api).toHaveBeenCalledTimes(calls);
});


it('catches cross-device changes through the authenticated event cursor on socket and polling', async () => {
  vi.useFakeTimers();
  const handlers = {};
  io.mockReturnValue({ on: vi.fn((name, handler) => { handlers[name] = handler; }), removeAllListeners: vi.fn(), disconnect: vi.fn() });
  const responses = [
    { cursor: 5, event_cursor: 30, items: [], changes: [] },
    { cursor: 5, event_cursor: 32, items: [], changes: [{ order_id: 4, event_id: 31 }, { order_id: 4, event_id: 32 }] },
    { cursor: 5, event_cursor: 33, items: [], changes: [{ order_id: 6, event_id: 33 }] },
  ];
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080, channel: 'private-shop.orders.business.1' } : responses.shift());
  const changed = vi.fn(), incoming = vi.fn(); window.addEventListener('mkpos:shop-order-changed', changed);
  const stop = monitorOrders(api, incoming); await vi.advanceTimersByTimeAsync(0);
  expect(changed).not.toHaveBeenCalled(); await handlers['order.changed']({ event_id: 32, order_id: 4 }); await vi.advanceTimersByTimeAsync(150);
  expect(changed.mock.calls[0][0].detail).toEqual({ orderIds: [4] });
  expect(api).toHaveBeenCalledWith('/shop-admin/order-notifications?after_id=5&after_event_id=30');
  await vi.advanceTimersByTimeAsync(20000);
  expect(changed.mock.calls[1][0].detail).toEqual({ orderIds: [6] });
  expect(api).toHaveBeenCalledWith('/shop-admin/order-notifications?after_id=5&after_event_id=32');
  expect(incoming).not.toHaveBeenCalled(); stop(); window.removeEventListener('mkpos:shop-order-changed', changed);
});

it('uses socket events with a slow safety sync and resumes regular polling after disconnect', async () => {
  vi.useFakeTimers();
  const handlers = {}, socket = { connected: true, on: vi.fn((event, handler) => { handlers[event] = handler; }), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  io.mockReturnValue(socket);
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080, channel: 'private-shop.orders.business.1' } : { cursor: 0, items: [] });
  const stop = monitorOrders(api, vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  const baseline = api.mock.calls.length;
  await vi.advanceTimersByTimeAsync(105000);
  expect(api).toHaveBeenCalledTimes(baseline);
  await handlers['order.changed'](); await vi.advanceTimersByTimeAsync(150);
  expect(api).toHaveBeenCalledTimes(baseline + 1);
  await vi.advanceTimersByTimeAsync(125000);
  expect(api).toHaveBeenCalledTimes(baseline + 2);
  socket.connected = false;
  await vi.advanceTimersByTimeAsync(15000);
  expect(api).toHaveBeenCalledTimes(baseline + 3);
  stop();
});

it('caches disabled socket configuration for five minutes', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: false } : { cursor: 0, items: [] });
  const stop = monitorOrders(api, vi.fn());
  await vi.advanceTimersByTimeAsync(299999);
  expect(api.mock.calls.filter(([path]) => path.endsWith('/config'))).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(api.mock.calls.filter(([path]) => path.endsWith('/config'))).toHaveLength(2);
  stop();
});

it('does not repeat socket auth requests during a server cooldown', async () => {
  vi.useFakeTimers();
  io.mockReturnValue({ connected: false, on: vi.fn(), connect: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() });
  const api = vi.fn(async path => {
    if (path.endsWith('/auth')) throw { status: 429, retryAfterMs: 45000 };
    return path.endsWith('/config') ? { realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080, channel: 'private-shop.orders.business.1' } : { cursor: 0, items: [] };
  });
  const stop = monitorOrders(api, vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  const authorize = io.mock.calls.at(-1)[1].auth;
  authorize(vi.fn()); await vi.advanceTimersByTimeAsync(0);
  authorize(vi.fn()); authorize(vi.fn());
  expect(api.mock.calls.filter(([path]) => path.endsWith('/auth'))).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(45000);
  authorize(vi.fn()); await vi.advanceTimersByTimeAsync(0);
  expect(api.mock.calls.filter(([path]) => path.endsWith('/auth'))).toHaveLength(2);
  stop();
});
