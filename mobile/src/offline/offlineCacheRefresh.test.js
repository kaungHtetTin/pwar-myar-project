import { afterEach, expect, it, vi } from 'vitest';
import { startOfflineCacheRefresh } from '../../../shared/network/offlineCacheRefresh.js';
let worker;
afterEach(() => { worker?.stop(); worker = undefined; vi.useRealTimers(); vi.restoreAllMocks(); });

it('honors server Retry-After across change bursts and reconnect events', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  const download = vi.fn().mockRejectedValueOnce({ status: 503, retryAfterMs: 600000 }).mockResolvedValue(null);
  worker = startOfflineCacheRefresh(download);
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 20; i++) { worker.refresh(); window.dispatchEvent(new Event('online')); }
  await vi.advanceTimersByTimeAsync(599999);
  expect(download).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(download).toHaveBeenCalledTimes(2);
});

it('owns no timer and downloads nothing during a full unchanged day, even on online events', async () => {
  vi.useFakeTimers();
  const download = vi.fn().mockResolvedValue(null);
  worker = startOfflineCacheRefresh(download);
  await vi.advanceTimersByTimeAsync(0);
  expect(download).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(86400000);
  expect(download).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
