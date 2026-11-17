import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startResourceRealtime, resourceRealtimeLive } from '../../shared/network/resourceRealtime.js';

let stop, handlers, socket, io, request, receive;
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  handlers = {};
  socket = { connected: false, active: true, on: vi.fn((name, handler) => { handlers[name] = handler; }), removeAllListeners: vi.fn(), disconnect: vi.fn(), connect: vi.fn() };
  io = vi.fn(() => socket);
  request = vi.fn(async path => path.endsWith('/config') ? { realtime_enabled: true, host: 'socket.test', port: 443, scheme: 'https', channel: 'private-business.resources.42' } : { token: 'signed-ticket' });
  receive = vi.fn();
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.restoreAllMocks(); });

it('coalesces socket bursts, refreshes after reconnect, and clears delivery state on logout', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  socket.connected = true; handlers.connect();
  handlers['resources.changed']({ resources: ['products'] });
  handlers['resources.changed']({ resources: ['products', 'assistant'] });
  await vi.advanceTimersByTimeAsync(150);
  expect(receive).toHaveBeenCalledTimes(1);
  expect(receive).toHaveBeenCalledWith(['products', 'assistant']);
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
  expect(receive).toHaveBeenCalledWith(['assistant']);
});

it('does not poll data or disabled socket configuration', async () => {
  request.mockResolvedValue({ realtime_enabled: false });
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(60150);
  expect(io).not.toHaveBeenCalled();
  expect(receive).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(300000);
  expect(request).toHaveBeenCalledTimes(1);
});

it('does not refresh on time or tab resume; reconciles exactly once on reconnect', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  socket.connected = true; handlers.connect();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(600000);
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(150);
  expect(receive).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
  handlers['resources.changed']({ resources: ['products'] });
  await vi.advanceTimersByTimeAsync(150);
  expect(receive).toHaveBeenLastCalledWith(['products']);
  socket.connected = false; handlers.disconnect();
  await vi.advanceTimersByTimeAsync(600000);
  expect(receive).toHaveBeenCalledTimes(1);
  socket.connected = true; handlers.connect();
  await vi.advanceTimersByTimeAsync(150);
  expect(receive).toHaveBeenCalledTimes(2);
  expect(receive).toHaveBeenLastCalledWith(['*']);
});

it('backs off rejected authorization and reconnects with a fresh signed ticket', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  request.mockRejectedValueOnce(Object.assign(new Error('Limited'), { retryAfterMs: 60000 }));
  const callback = vi.fn(); io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  expect(callback).not.toHaveBeenCalled();
  expect(socket.disconnect).toHaveBeenCalledOnce();
  socket.active = false;
  await vi.advanceTimersByTimeAsync(45000);
  expect(socket.connect).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15000);
  expect(socket.connect).toHaveBeenCalledTimes(1);
  io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  expect(callback).toHaveBeenLastCalledWith({ token: 'signed-ticket' });
});

it('backs off repeated database outages and closes transports without submitting empty tickets', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  request.mockRejectedValue(Object.assign(new Error('Database unavailable'), { status: 503, retryAfterMs: 15000 }));
  const callback = vi.fn();
  io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  socket.active = false;
  await vi.advanceTimersByTimeAsync(30000);
  expect(socket.connect).toHaveBeenCalledTimes(1);
  io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(45000);
  expect(socket.connect).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15000);
  expect(socket.connect).toHaveBeenCalledTimes(2);
  expect(callback).not.toHaveBeenCalled();
});

it('recovers an expired server-disconnected ticket using a new authorization request', async () => {
  stop = startResourceRealtime({ io, request, receive });
  await vi.advanceTimersByTimeAsync(0);
  socket.connected = true; handlers.connect();
  socket.connected = false; socket.active = false; handlers.disconnect('io server disconnect');
  await vi.advanceTimersByTimeAsync(15000);
  expect(socket.connect).toHaveBeenCalledOnce();
  const callback = vi.fn(); io.mock.calls[0][1].auth(callback);
  await vi.advanceTimersByTimeAsync(0);
  expect(callback).toHaveBeenCalledWith({ token: 'signed-ticket' });
});
