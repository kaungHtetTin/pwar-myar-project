import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { monitorChat } from './chatActivity';
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
let stop;
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.restoreAllMocks(); });

it('does not poll notifications or HTTP presence while the live socket is healthy; socket bursts fetch once', async () => {
  vi.useFakeTimers();
  const handlers = {};
  const socket = { connected: false, active: true, on: vi.fn((event, handler) => { handlers[event] = handler; }),
    emit: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn(), connect: vi.fn() };
  io.mockReturnValue(socket);
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, channel: 'private-shop.chat.business.42' }
    : { enabled: true, cursor: 0, items: [], unread_count: 0 });
  stop = monitorChat(api, '/shop-admin/chat', vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  socket.connected = true; handlers.connect();
  await vi.advanceTimersByTimeAsync(150);
  expect(socket.emit).toHaveBeenCalledWith('chat.activity', true);
  api.mockClear();
  await vi.advanceTimersByTimeAsync(86400000);
  window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
  expect(api).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  for (let i = 0; i < 100; i++) handlers['chat.changed']();
  await vi.advanceTimersByTimeAsync(150);
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][0]).toBe('/shop-admin/chat/notifications?after_id=0');
});

it('does not keep polling a disabled chat and rechecks only when its settings change', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async () => ({ enabled: false, cursor: 0, items: [] }));
  stop = monitorChat(api, '/shop-admin/chat', vi.fn());
  await vi.advanceTimersByTimeAsync(86400000);
  expect(api).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  window.dispatchEvent(new CustomEvent('mkpos:data-change', { detail: { resources: ['settings'] } }));
  await vi.advanceTimersByTimeAsync(0);
  expect(api).toHaveBeenCalledTimes(2);
});
