import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, requestAllPages, requestDownload } from './api';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  delete window.mkposDesktop;
});

describe('API helpers', () => {
  it('replaces the portable token after changing the account password', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'token'); vi.resetModules();
    localStorage.setItem('mkpos.accessToken', 'old-token');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { id: 1 }, access_token: 'rotated-token', token_type: 'Bearer' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { request: tokenRequest } = await import('./api');
    await expect(tokenRequest('/auth/profile', { method: 'PUT', body: '{}' })).resolves.toEqual({ user: { id: 1 } });
    expect(localStorage.getItem('mkpos.accessToken')).toBe('rotated-token');
    await tokenRequest('/auth/me');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer rotated-token');
  });
  it('exposes the server retry delay for a rate-limited request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429,
      headers: { get: name => name === 'Retry-After' ? '45' : null }, json: async () => ({ message: 'Too Many Attempts.' }) })));
    await expect(request('/shop-admin/chat/notifications')).rejects.toMatchObject({ status: 429, retryAfterMs: 45000 });
  });
  it('loads large collections in bounded pages', async () => {
    const fetchMock = vi.fn((url) => {
      const offset = Number(new URL(url, 'http://mkpos.local').searchParams.get('offset'));
      const rows = offset === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: rows, total: 3 }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestAllPages('/products', { pageSize: 2 })).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails clearly when a request exceeds its timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));

    const pending = request('/health', { timeoutMs: 25 });
    const assertion = expect(pending).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it('uses a Sanctum CSRF cookie for mutation requests', async () => {
    const fetchMock = vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') {
        document.cookie = 'XSRF-TOKEN=secure-token; path=/';
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/auth/logout', { method: 'POST' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/sanctum/csrf-cookie', expect.objectContaining({ credentials: 'include' }));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('secure-token');
  });

  it('refreshes an expired session CSRF token once after a 419 response', async () => {
    document.cookie = 'XSRF-TOKEN=expired-token; path=/';
    let mutations = 0;
    const fetchMock = vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') {
        document.cookie = 'XSRF-TOKEN=refreshed-token; path=/';
        return Promise.resolve({ ok: true, status: 204 });
      }
      mutations += 1;
      if (mutations === 1) {
        return Promise.resolve({ ok: false, status: 419, json: () => Promise.resolve({ message: 'CSRF token mismatch.' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/settings', { method: 'PUT', body: '{}' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers['X-XSRF-TOKEN']).toBe('refreshed-token');
  });

  it('never mixes cookies or stale CSRF headers into portable token requests', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_MODE', 'token');
    document.cookie = 'XSRF-TOKEN=stale-session-token; path=/';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { id: 7 }, access_token: 'portable-token', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { request: portableRequest } = await import('./api.js');

    await portableRequest('/auth/login', { method: 'POST', body: '{}' });
    await portableRequest('/products', { method: 'POST', body: '{}' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-XSRF-TOKEN');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer portable-token');
    expect(fetchMock.mock.calls[1][1].headers['X-MKPOS-Auth']).toBe('token');
  });

  it('lets the browser set the multipart boundary for file uploads', async () => {
    document.cookie = 'XSRF-TOKEN=upload-token; path=/';
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('payment_screenshot', new File(['proof'], 'payment.png', { type: 'image/png' }));

    await request('/subscription/requests', { method: 'POST', body: formData });

    expect(fetchMock.mock.calls[0][1].body).toBe(formData);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
    expect(fetchMock.mock.calls[0][1].headers['X-XSRF-TOKEN']).toBe('upload-token');
  });

  it('sends desktop requests through the secure main-process API bridge', async () => {
    const apiRequest = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: JSON.stringify({ user: { id: 7 } }),
    }));
    window.mkposDesktop = { apiRequest };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/auth/me')).resolves.toEqual({ user: { id: 7 } });
    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ path: '/auth/me', method: 'GET' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serializes desktop file uploads without exposing filesystem paths', async () => {
    const apiRequest = vi.fn(() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', body: '{"ok":true}' }));
    window.mkposDesktop = { apiRequest };
    const formData = new FormData();
    formData.append('payment_screenshot', new File(['proof'], 'payment.png', { type: 'image/png' }));

    await request('/subscription/requests', { method: 'POST', body: formData });

    const payload = apiRequest.mock.calls[0][0];
    expect(payload.body.kind).toBe('form-data');
    expect(payload.body.entries[0]).toMatchObject({
      kind: 'file', name: 'payment_screenshot', filename: 'payment.png', type: 'image/png',
    });
    expect(payload.headers).not.toHaveProperty('Content-Type');
  });

  it('publishes entitlement updates from subscription-related API errors', async () => {
    const entitlement = { is_valid: true, access_type: 'trial', lifecycle_notice: { stage: 'warning' } };
    const listener = vi.fn();
    window.addEventListener('mkpos:subscription-entitlement', listener, { once: true });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      status: 403,
      json: () => Promise.resolve({
        message: 'This feature requires a paid subscription.',
        code: 'trial_feature_restricted',
        subscription: entitlement,
      }),
    })));

    await expect(request('/data/export')).rejects.toThrow('paid subscription');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toEqual(entitlement);
  });

  it('navigates to billing when an expired subscription rejects a mutation', async () => {
    const navigateBilling = vi.fn();
    window.addEventListener('mkpos:navigate-billing', navigateBilling, { once: true });
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') return Promise.resolve({ ok: true });
      return Promise.resolve({
        ok: false,
        status: 402,
        json: () => Promise.resolve({ message: 'Subscription expired.', subscription: { is_valid: false, reason: 'expired' } }),
      });
    }));

    await expect(request('/products', { method: 'POST', body: '{}' })).rejects.toThrow('Subscription expired.');
    expect(navigateBilling).toHaveBeenCalledOnce();
  });

  it('navigates desktop and web clients to billing when a suspended subscription rejects a mutation', async () => {
    const navigateBilling = vi.fn();
    window.addEventListener('mkpos:navigate-billing', navigateBilling, { once: true });
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') return Promise.resolve({ ok: true });
      return Promise.resolve({
        ok: false,
        status: 402,
        json: () => Promise.resolve({
          message: 'This subscription is suspended. Reactivate it to make changes.',
          code: 'subscription_suspended',
          subscription: { is_valid: true, can_mutate: false, reason: 'cancelled' },
        }),
      });
    }));

    await expect(request('/sales/58', { method: 'PUT', body: '{}' })).rejects.toThrow('suspended');
    expect(navigateBilling).toHaveBeenCalledOnce();
    expect(navigateBilling.mock.calls[0][0].detail).toMatchObject({ can_mutate: false, reason: 'cancelled' });
  });

  it('preserves the same trial restriction contract for browser downloads', async () => {
    const entitlement = { is_valid: true, access_type: 'trial' };
    const listener = vi.fn();
    window.addEventListener('mkpos:subscription-entitlement', listener, { once: true });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false, status: 403, statusText: 'Forbidden',
      json: () => Promise.resolve({ message: 'This feature requires a paid subscription.', code: 'trial_feature_restricted', subscription: entitlement }),
    })));

    const failure = await requestDownload('/data/export').catch((error) => error);
    expect(failure).toMatchObject({ status: 403, code: 'trial_feature_restricted', payload: { subscription: entitlement } });
    expect(failure.message).toContain('paid subscription');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('preserves the same trial restriction contract for desktop downloads', async () => {
    const payload = { message: 'This feature requires a paid subscription.', code: 'trial_feature_restricted', subscription: { is_valid: true, access_type: 'trial' } };
    window.mkposDesktop = { apiRequest: vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden', body: btoa(JSON.stringify(payload)) }) };

    const failure = await requestDownload('/data/export').catch((error) => error);
    expect(failure).toMatchObject({ status: 403, code: 'trial_feature_restricted', payload });
  });

  it('authenticates portable desktop downloads with the saved bearer token', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_MODE', 'token');
    window.localStorage.setItem('mkpos.accessToken', 'desktop-download-token');
    const apiRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/csv' },
      body: btoa('report,data\r\n'),
    });
    window.mkposDesktop = { apiRequest };
    const { requestDownload: portableDownload } = await import('./api.js');

    await portableDownload('/reports/summary.csv', { accept: 'text/csv' });

    expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: '/reports/summary.csv',
      responseType: 'base64',
      headers: expect.objectContaining({
        Accept: 'text/csv',
        Authorization: 'Bearer desktop-download-token',
        'X-MKPOS-Auth': 'token',
        'X-MKPOS-Client': 'desktop',
      }),
    }));
  });
});
