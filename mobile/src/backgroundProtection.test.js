import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest as request } from './api/client';
import { apiDownload } from './api/client';
import { clearBackgroundCooldowns } from './backgroundPolicy';

afterEach(() => { clearBackgroundCooldowns(); vi.useRealTimers(); vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'; });

it('pauses other product photos after a throttled image download', async () => {
  const fetchMock = vi.fn(async () => ({ ok: false, status: 429, headers: { get: () => '45' }, json: async () => ({ message: 'Too Many Attempts.' }) }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(apiDownload('/products/1/photo')).rejects.toMatchObject({ status: 429, retryAfterMs: 45000 });
  await expect(apiDownload('/products/2/photo')).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('pauses all related background requests after 429, keeps user actions available, and resumes at Retry-After', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  document.cookie = 'XSRF-TOKEN=test; path=/';
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 429,
    headers: { get: () => 'Fri, 23 Oct 2026 12:00:45 GMT' }, json: async () => ({ message: 'Too Many Attempts.' }) })
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) });
  vi.stubGlobal('fetch', fetchMock);
  await expect(request('/shop-admin/chat/notifications')).rejects.toMatchObject({ status: 429, retryAfterMs: 45000 });
  await expect(request('/shop-admin/chat/presence', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledOnce();
  await request('/sales', { method: 'POST', body: '{}' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(44999);
  await expect(request('/shop-admin/chat/notifications')).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  await request('/shop-admin/chat/notifications');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('shares simultaneous feed requests without automatically retrying mutations', async () => {
  document.cookie = 'XSRF-TOKEN=test; path=/';
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
  vi.stubGlobal('fetch', fetchMock);
  await Promise.all([request('/shop-admin/chat/notifications'), request('/shop-admin/chat/notifications')]);
  expect(fetchMock).toHaveBeenCalledOnce();
  fetchMock.mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => '60' }, json: async () => ({ message: 'Too Many Attempts.' }) });
  await expect(request('/sales', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
