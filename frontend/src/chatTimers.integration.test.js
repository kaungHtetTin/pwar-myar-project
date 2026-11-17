import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { monitorChat } from './chatActivity';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
let stop;
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.restoreAllMocks(); });

it('has no polling timer or periodic HTTP requests after the chat socket connects', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  const handlers = new Map();
  const socket = { connected: false, active: true, connect: vi.fn(), disconnect: vi.fn(), emit: vi.fn(),
    on: (name, handler) => handlers.set(name, [...(handlers.get(name) || []), handler]),
    off: vi.fn(), removeAllListeners: vi.fn() };
  io.mockReturnValue(socket);
  const api = vi.fn(async path => path.endsWith('/config')
    ? { realtime_enabled: true, channel: 'private-inbox', scheme: 'https', host: 'socket.test', port: 443 }
    : { enabled: true, cursor: 1, unread_count: 0, items: [] });
  stop = monitorChat(api, '/shop-admin/chat', vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  expect(io.mock.calls[0][1].reconnection).toBe(false);
  socket.connected = true;
  for (const handler of handlers.get('connect')) handler();
  await vi.advanceTimersByTimeAsync(150);
  const requests = api.mock.calls.length;
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(600000);
  expect(api).toHaveBeenCalledTimes(requests);
  socket.connected = false;
  for (const handler of handlers.get('disconnect')) handler('transport close');
  await vi.advanceTimersByTimeAsync(15000);
  expect(api.mock.calls.length).toBeGreaterThan(requests);
  await vi.advanceTimersByTimeAsync(15000);
  expect(socket.connect).toHaveBeenCalledOnce();
});

it('does not send HTTP presence heartbeats from unrelated foreground pages during an outage', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: false }
    : { enabled: true, cursor: 1, unread_count: 0, items: [] });
  stop = monitorChat(api, '/shop-admin/chat', vi.fn());
  await vi.advanceTimersByTimeAsync(120000);
  expect(api.mock.calls.filter(([path]) => path.endsWith('/presence'))).toHaveLength(0);
  expect(api.mock.calls.filter(([path]) => path.includes('/notifications')).length).toBeGreaterThan(1);
});
