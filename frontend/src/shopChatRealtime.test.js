import { afterEach, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { connectShopChat } from './shopChatRealtime';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
it('throttles typing, scopes received events, expires them and clears on disconnect', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
  const handlers = {}, socket = { connected: true, on: vi.fn((event, handler) => { handlers[event] = handler; }), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  io.mockReturnValue(socket);
  const received = vi.fn();
  const stop = connectShopChat({ realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080 }, 'private-shop.chat.thread.test', vi.fn(), vi.fn(), vi.fn(), vi.fn(), () => true, vi.fn(), received);
  stop.typing(true); stop.typing(true);
  expect(socket.emit.mock.calls.filter(([event, value]) => event === 'chat.typing' && value)).toHaveLength(1);
  handlers['chat.typing']({ thread: 'other', sender: 'owner', typing: true }); expect(received).not.toHaveBeenCalled();
  handlers['chat.typing']({ thread: 'test', sender: 'owner', typing: true });
  vi.advanceTimersByTime(6000); expect(received).toHaveBeenLastCalledWith({ thread: 'test', sender: 'owner', typing: false });
  handlers.disconnect('transport close'); expect(received).toHaveBeenLastCalledWith(null);
  stop(); expect(socket.disconnect).toHaveBeenCalled();
});
afterEach(() => { vi.useRealTimers(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });

it('records last activity every thirty seconds and immediately when the visible chat is hidden', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
  const handlers = {};
  const socket = { connected: true, on: vi.fn((event, handler) => { handlers[event] = handler; }), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
  io.mockReturnValue(socket);
  const heartbeat = vi.fn().mockResolvedValue({ ok: true });
  const stop = connectShopChat({ realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080 }, 'private-room', vi.fn(), vi.fn(), vi.fn(), vi.fn(), () => true, heartbeat);
  handlers.connect(); await Promise.resolve();
  expect(heartbeat).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(28000);
  expect(heartbeat).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2000);
  expect(heartbeat).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
  expect(heartbeat).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(60000);
  expect(heartbeat).toHaveBeenCalledTimes(3);
  stop();
});

it('publishes visible activity and clears remote presence on disconnect, then cleans up', () => {
  vi.useFakeTimers();
  const handlers = {};
  const socket = { connected: true, on: vi.fn((event, handler) => { handlers[event] = handler; }), emit: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn(), connect: vi.fn() };
  io.mockReturnValue(socket);
  const presence = vi.fn(); let visible = true;
  const stop = connectShopChat({ realtime_enabled: true, scheme: 'http', host: 'localhost', port: 8080 }, 'private-room', vi.fn(), vi.fn(), vi.fn(), presence, () => visible);
  handlers.connect();
  expect(socket.emit).toHaveBeenLastCalledWith('chat.activity', true);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(socket.emit).toHaveBeenLastCalledWith('chat.activity', false);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  visible = false; vi.advanceTimersByTime(2000);
  expect(socket.emit).toHaveBeenLastCalledWith('chat.activity', false);
  handlers['chat.presence']({ customer_active: true });
  expect(presence).toHaveBeenLastCalledWith({ customer_active: true });
  handlers.disconnect('transport close'); expect(presence).toHaveBeenLastCalledWith(null);
  stop(); socket.emit.mockClear();
  document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(4000);
  expect(socket.emit).not.toHaveBeenCalled(); expect(socket.disconnect).toHaveBeenCalled();
});
