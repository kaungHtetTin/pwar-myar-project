import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, apiUpload } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
});

describe('Office API', () => {
  it('lets the browser supply the multipart boundary and keeps CSRF headers', async () => {
    document.cookie = 'XSRF-TOKEN=upload-token; path=/';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
    const data = new FormData();
    data.append('title', 'Tutorial');
    await api('/office/tutorials', { method: 'POST', body: data });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(data);
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.headers['X-XSRF-TOKEN']).toBe('upload-token');
  });
  it('uses Sanctum CSRF protection for office login', async () => {
    const fetchMock = vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') {
        document.cookie = 'XSRF-TOKEN=office-token; path=/';
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ admin: { name: 'Owner' } }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/office/auth/login', { method: 'POST', body: '{}' })).resolves.toEqual({ admin: { name: 'Owner' } });
    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('office-token');
    expect(fetchMock.mock.calls[1][1].credentials).toBe('include');
  });

  it('uses a stored bearer token without a CSRF request in portable mode', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_MODE', 'token');
    document.cookie = 'XSRF-TOKEN=stale-office-session; path=/';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ admin: { name: 'Owner' }, access_token: 'office-secret', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ admin: { name: 'Owner' } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { api: portableApi } = await import('./api.js');

    await portableApi('/office/auth/login', { method: 'POST', body: '{}' });
    expect(localStorage.getItem('mkpos.office.accessToken')).toBe('office-secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await portableApi('/office/auth/me');
    expect(fetchMock.mock.calls[1][1].credentials).toBe('omit');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer office-secret');
    expect(fetchMock.mock.calls[1][1].headers['X-MKPOS-Client']).toBe('office');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('X-XSRF-TOKEN');
  });

  it('refreshes an expired Office session CSRF token once after a 419 response', async () => {
    vi.resetModules();
    document.cookie = 'XSRF-TOKEN=expired-office-token; path=/';
    let mutations = 0;
    const fetchMock = vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') {
        document.cookie = 'XSRF-TOKEN=refreshed-office-token; path=/';
        return Promise.resolve({ ok: true, status: 204 });
      }
      mutations += 1;
      if (mutations === 1) {
        return Promise.resolve({ ok: false, status: 419, json: () => Promise.resolve({ message: 'CSRF token mismatch.' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ admin: { name: 'Owner' } }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { api: sessionApi } = await import('./api.js');

    await expect(sessionApi('/office/auth/profile', { method: 'PUT', body: '{}' })).resolves.toEqual({ admin: { name: 'Owner' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers['X-XSRF-TOKEN']).toBe('refreshed-office-token');
  });

  it('derives the API prefix when Laravel is deployed below the domain root', async () => {
    vi.resetModules();
    window.history.replaceState({}, '', '/public/office/');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ admin: { name: 'Owner' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { api: integratedApi } = await import('./api.js');

    await integratedApi('/office/auth/me');
    expect(fetchMock.mock.calls[0][0]).toBe('/public/api/office/auth/me');
  });

  it('streams application releases as binary data with release metadata', async () => {
    document.cookie = 'XSRF-TOKEN=release-token; path=/';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ release: { platform: 'android', version: '1.2.0' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['apk-content'], 'PwarMyar.apk', { type: 'application/vnd.android.package-archive' });

    await expect(apiUpload('/office/app-releases/android', file, { version: '1.2.0', release_notes: 'Stable' }))
      .resolves.toEqual({ release: { platform: 'android', version: '1.2.0' } });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/office/app-releases/android?');
    expect(url).toContain('version=1.2.0');
    expect(url).toContain('original_name=PwarMyar.apk');
    expect(options.body).toBe(file);
    expect(options.headers['Content-Type']).toBe('application/octet-stream');
    expect(options.headers['X-XSRF-TOKEN']).toBe('release-token');
  });
});
