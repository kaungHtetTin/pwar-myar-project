import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MobileOfflineCacheAgent } from './MobileOfflineCacheAgent';
import { refreshMobileOfflineCache } from './offlineSales';
import { DATA_CHANGED_EVENT } from '../navigation/dataChanges';
vi.mock('./offlineSales', () => ({ refreshMobileOfflineCache: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });
const session = { user: { id: 1 }, business: { id: 2 }, permissions: ['sell'], subscription: { is_valid: true } };

it('prepares once, coalesces sale/resource bursts and stays quiet when unchanged', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  let finish;
  refreshMobileOfflineCache.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(null);
  const view = render(<MobileOfflineCacheAgent session={session} appConfig={{}} />);
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 100; i++) window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { modules: ['sell'] } }));
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(1);
  await act(async () => finish(null));
  await act(async () => vi.advanceTimersByTimeAsync(59999));
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(2);
  view.rerender(<MobileOfflineCacheAgent session={{ ...session, permissions: ['sell'] }} appConfig={{}} />);
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(86400000));
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(600000));
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(2);
});

it('rejects an old account download on scope change and pauses when switching offline', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0); refreshMobileOfflineCache.mockResolvedValue(null);
  const view = render(<MobileOfflineCacheAgent session={session} appConfig={{}} />);
  const first = refreshMobileOfflineCache.mock.calls[0][2].isCurrent;
  expect(first()).toBe(true);
  view.rerender(<MobileOfflineCacheAgent session={{ ...session, business: { id: 3 } }} appConfig={{}} />);
  expect(first()).toBe(false);
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(2);
  const second = refreshMobileOfflineCache.mock.calls[1][2].isCurrent;
  view.rerender(<MobileOfflineCacheAgent session={session} appConfig={{}} enabled={false} />);
  expect(second()).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(600000));
  expect(refreshMobileOfflineCache).toHaveBeenCalledTimes(2);
});

it('does not download a catalog for accounts without offline Sell access', () => {
  refreshMobileOfflineCache.mockResolvedValue(null);
  const view = render(<MobileOfflineCacheAgent session={{ ...session, permissions: ['products'] }} appConfig={{}} />);
  expect(refreshMobileOfflineCache).not.toHaveBeenCalled(); view.unmount();
});
