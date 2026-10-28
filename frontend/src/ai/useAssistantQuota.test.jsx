import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAssistantChat } from './useAssistantChat';

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
it('refreshes the quota independently, retains drafts, and adopts the server usage after a send', async () => {
  vi.useFakeTimers();
  let remaining = 50;
  const usage = () => ({ limit: 50, remaining, remaining_percent: remaining * 2 });
  const api = vi.fn(async (path, options) => {
    if (path === '/ai-assistant/config') return { enabled: true, configured: true, storage_ready: true, weekly_usage: usage() };
    if (path === '/ai-assistant/conversations') return {};
    if (options?.method === 'POST') { remaining--; return { items: [], weekly_usage: usage() }; }
    return { items: [], has_more: false, weekly_usage: usage() };
  });
  const view = renderHook(() => useAssistantChat({ api, scope: 'quota-test', app: 'business_web' }));
  await act(async () => {});
  expect(view.result.current.config.weekly_usage.remaining).toBe(50);
  act(() => view.result.current.setDraft('Keep this draft'));
  remaining = 25;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(view.result.current.config.weekly_usage.remaining).toBe(25);
  expect(view.result.current.draft).toBe('Keep this draft');
  expect(api.mock.calls.every(([path]) => path === '/ai-assistant/config')).toBe(true);
  await act(async () => { await view.result.current.send(); });
  expect(view.result.current.config.weekly_usage.remaining).toBe(24);
  const calls = api.mock.calls.length;
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(api).toHaveBeenCalledTimes(calls);
});
