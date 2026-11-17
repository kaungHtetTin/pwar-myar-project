import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DesktopCacheAgent } from './DesktopExperience';
import { refreshDesktopCache } from '../desktop';

vi.mock('../desktop', async importOriginal => ({ ...await importOriginal(), refreshDesktopCache: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it('coalesces resource bursts and session refreshes without overlapping full catalog downloads', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  let finish;
  refreshDesktopCache.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(null);
  const session = { user: { id: 1 }, business: { id: 2 }, permissions: ['sell'], subscription: { is_valid: true } };
  const view = render(<DesktopCacheAgent session={session} />);
  expect(refreshDesktopCache).toHaveBeenCalledTimes(1);
  view.rerender(<DesktopCacheAgent session={{ ...session, permissions: ['sell'], subscription: { is_valid: true } }} />);
  await act(async () => {
    for (let i = 0; i < 50; i++) window.dispatchEvent(new CustomEvent('mkpos:data-change', { detail: { resources: ['products', 'settings'] } }));
  });
  expect(refreshDesktopCache).toHaveBeenCalledTimes(1);
  await act(async () => finish(null));
  await act(async () => vi.advanceTimersByTimeAsync(59999));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(2);
  view.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(600000));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(2);
});

it('refreshes immediately for a different business and cancels the prior trailing refresh', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0); refreshDesktopCache.mockResolvedValue(null);
  const view = render(<DesktopCacheAgent session={{ user: { id: 1 }, business: { id: 2 }, permissions: ['sell'], subscription: { is_valid: true } }} />);
  await act(async () => {});
  window.dispatchEvent(new CustomEvent('mkpos:data-change', { detail: { resources: ['products'] } }));
  view.rerender(<DesktopCacheAgent session={{ user: { id: 3 }, business: { id: 4 }, permissions: ['sell'], subscription: { is_valid: true } }} />);
  await act(async () => {});
  expect(refreshDesktopCache).toHaveBeenCalledTimes(2);
  expect(refreshDesktopCache).toHaveBeenLastCalledWith(expect.objectContaining({ business: { id: 4 } }), undefined, expect.objectContaining({ isCurrent: expect.any(Function) }));
  expect(refreshDesktopCache.mock.calls[0][2].isCurrent()).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(60000));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(2);
});

it('does not download unchanged data after elapsed time or a navigation/session-object refresh', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0); refreshDesktopCache.mockResolvedValue(null);
  const session = { user: { id: 1 }, business: { id: 2 }, permissions: ['sell'], subscription: { is_valid: true } };
  const view = render(<DesktopCacheAgent session={session} />);
  await act(async () => {});
  view.rerender(<DesktopCacheAgent session={{ ...session }} />);
  await act(async () => vi.advanceTimersByTimeAsync(179999));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(600000));
  expect(refreshDesktopCache).toHaveBeenCalledTimes(1);
});
