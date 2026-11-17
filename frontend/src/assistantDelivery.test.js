import { afterEach, expect, it, vi } from 'vitest';
import { monitorAssistantDelivery } from '../../shared/network/assistantDelivery';

vi.mock('../../shared/network/resourceRealtime.js', () => ({ resourceRealtimeLive: () => false }));
let stop;
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.restoreAllMocks(); });
const wake = () => window.dispatchEvent(new Event('mkpos:assistant-delivery-changed'));

it('keeps the database Retry-After deadline even during repeated resume/change events', async () => {
  vi.useFakeTimers();
  const api = vi.fn().mockRejectedValueOnce({ status: 503, retryAfterMs: 60000 }).mockResolvedValue({ status: 'pending' });
  stop = monitorAssistantDelivery(api, '/delivery', '', vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 20; i++) {
    wake();
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
  }
  await vi.advanceTimersByTimeAsync(59999);
  expect(api).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(api).toHaveBeenCalledTimes(2);
});

it.each(['completed', 'failed'])('does not restart a %s receipt monitor after resource events', async status => {
  vi.useFakeTimers();
  const api = vi.fn().mockResolvedValue({ status });
  stop = monitorAssistantDelivery(api, '/delivery', '', vi.fn());
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 20; i++) wake();
  await vi.advanceTimersByTimeAsync(600000);
  expect(api).toHaveBeenCalledTimes(1);
});

it('bounds change-event bursts while keeping only one request in flight', async () => {
  vi.useFakeTimers();
  let finish;
  const api = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ status: 'pending' });
  stop = monitorAssistantDelivery(api, '/delivery', '', vi.fn());
  for (let i = 0; i < 100; i++) wake();
  expect(api).toHaveBeenCalledTimes(1);
  finish({ status: 'pending' });
  await vi.advanceTimersByTimeAsync(0);
  // One prompt reconciliation is allowed for a socket hint received during the request.
  expect(api).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 100; i++) wake();
  await vi.advanceTimersByTimeAsync(1999);
  expect(api).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(api).toHaveBeenCalledTimes(3);
});
