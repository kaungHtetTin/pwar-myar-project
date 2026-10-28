import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startResourceRealtime, resourceRealtimeLive } from '../../shared/network/resourceRealtime.js';

let stop, handlers, socket, io, request, receive;
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  handlers = {};
  socket = { connected: false, active: true, on: vi.fn((name, handler) => { handlers[name] = handler; }), removeAllListeners: vi.fn(), disconnect: vi.fn(), connect: vi.fn() };
  io = vi.fn(() => socket);
  request = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, host: 'socket.test', port: 443, scheme: 'https', channel: 'private-business.resources.42' } : { token: 'signed-ticket' });
  receive = vi.fn();
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });

it('coalesces socket bursts, refreshes after reconnect, and clears delivery state on logout', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  socket.connected = true; handlers.connect();
  handlers['resources.changed']({ resources: ['products'] });
  handlers['resources.changed']({ resources: ['products', 'assistant'] });
  await vi.advanceTimersByTimeAsync(150);
  expect(receive).toHaveBeenCalledTimes(1);
  expect(receive).toHaveBeenCalledWith(['products', 'settings', 'reports', 'assistant']);
  expect(resourceRealtimeLive()).toBe(true);
  const callback = vi.fn(); io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledWith('/realtime/resources/auth', expect.objectContaining({ method: 'POST', body: JSON.stringify({ channel_name: 'private-business.resources.42' }) }));
  expect(callback).toHaveBeenCalledWith({ token: 'signed-ticket' });
  stop(); stop = undefined;
  expect(resourceRealtimeLive()).toBe(false);
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(180000);
  expect(receive).toHaveBeenCalledTimes(1);
});

it('defers hidden notifications and recovers on visibility without replaying individual mutations', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  handlers['resources.changed']({ resources: ['assistant'] });
  await vi.advanceTimersByTimeAsync(500);
  expect(receive).not.toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(150);
  expect(receive).toHaveBeenCalledWith(['assistant', 'products', 'settings', 'reports']);
});

it('retains periodic API reconciliation when sockets are disabled and retries configuration', async () => {
  request.mockResolvedValue({ realtime_enabled: false });
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(45150);
  expect(io).not.toHaveBeenCalled();
  expect(receive).toHaveBeenCalledWith(['products', 'settings', 'reports']);
  await vi.advanceTimersByTimeAsync(300000);
  expect(request.mock.calls.length).toBeGreaterThan(1);
});

it('backs off rejected authorization and reconnects with a fresh signed ticket', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  request.mockRejectedValueOnce(Object.assign(new Error('Limited'), { retryAfterMs: 60000 }));
  const callback = vi.fn(); io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  socket.active = false;
  await vi.advanceTimersByTimeAsync(45000);
  expect(socket.connect).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15000);
  expect(socket.connect).toHaveBeenCalledTimes(1);
  io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  expect(callback).toHaveBeenLastCalledWith({ token: 'signed-ticket' });
});
