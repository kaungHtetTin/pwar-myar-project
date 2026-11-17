import { afterEach, expect, it, vi } from 'vitest';
import { api as request } from './api';
import { clearBackgroundCooldowns } from './backgroundPolicy';

afterEach(() => { clearBackgroundCooldowns(); vi.useRealTimers(); vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'; });

it('pauses all related background requests after 429, keeps user actions available, and resumes at Retry-After', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  document.cookie = 'XSRF-TOKEN=test; path=/';
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 429,
    headers: { get: () => 'Fri, 23 Oct 2026 12:00:45 GMT' }, json: async () => ({ message: 'Too Many Attempts.' }) })
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [] }) });
  vi.stubGlobal('fetch', fetchMock);
  await expect(request('/office/activity-alerts')).rejects.toMatchObject({ status: 429, retryAfterMs: 45000 });
  await expect(request('/office/activity-alerts/auth', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledOnce();
  await request('/office/financial-book/entries', { method: 'POST', body: '{}' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(44999);
  await expect(request('/office/activity-alerts')).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  await request('/office/activity-alerts');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('shares simultaneous feed requests without automatically retrying mutations', async () => {
  document.cookie = 'XSRF-TOKEN=test; path=/';
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
  vi.stubGlobal('fetch', fetchMock);
  await Promise.all([request('/office/activity-alerts'), request('/office/activity-alerts')]);
  expect(fetchMock).toHaveBeenCalledOnce();
  fetchMock.mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => '60' }, json: async () => ({ message: 'Too Many Attempts.' }) });
  await expect(request('/office/financial-book/entries', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 429 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
