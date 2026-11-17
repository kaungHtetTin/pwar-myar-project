import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiRequest } from './client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
});

describe('mobile API client', () => {
  it('replaces the portable token after changing the account password', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'token'); vi.resetModules();
    localStorage.setItem('mkpos.mobile.accessToken', 'old-token');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { id: 1 }, access_token: 'rotated-token', token_type: 'Bearer' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest: tokenRequest } = await import('./client.js');
    await expect(tokenRequest('/auth/profile', { method: 'PUT', body: '{}' })).resolves.toEqual({ user: { id: 1 } });
    expect(localStorage.getItem('mkpos.mobile.accessToken')).toBe('rotated-token');
    await tokenRequest('/auth/me');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer rotated-token');
  });
  it.each(['success', 'empty', 'network', 'server'])('clears token authentication on %s logout while revoking with the original token', async outcome => {
    vi.resetModules(); vi.stubEnv('VITE_AUTH_MODE', 'token');
    localStorage.setItem('mkpos.mobile.accessToken', 'fixture-token');
    const request = vi.fn(async () => {
      expect(localStorage.getItem('mkpos.mobile.accessToken')).toBeNull();
      if (outcome === 'network') throw new Error('Network unavailable');
      return { ok: outcome !== 'server', status: outcome === 'empty' ? 204 : outcome === 'server' ? 503 : 200, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal('fetch', request);
    const { apiRequest: tokenRequest } = await import('./client.js');
    await tokenRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    expect(localStorage.getItem('mkpos.mobile.accessToken')).toBeNull();
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-token');
    await tokenRequest('/auth/me').catch(() => undefined);
    expect(request.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
  it('exposes the server retry delay for a rate-limited request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429,
      headers: { get: name => name === 'Retry-After' ? '45' : null }, json: async () => ({ message: 'Too Many Attempts.' }) })));
    await expect(apiRequest('/shop-admin/chat/notifications')).rejects.toMatchObject({ status: 429, retryAfterMs: 45000 });
  });
  it('uses the existing relative API contract', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 1 } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/auth/me')).resolves.toEqual({ user: { id: 1 } });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('gets a Sanctum cookie before mutations', async () => {
    const fetchMock = vi.fn((url) => {
      if (url === '/sanctum/csrf-cookie') {
        document.cookie = 'XSRF-TOKEN=mobile-token; path=/';
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/logout', { method: 'POST' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/sanctum/csrf-cookie', expect.objectContaining({ credentials: 'include' }));
    expect(fetchMock.mock.calls[1][1].headers['X-XSRF-TOKEN']).toBe('mobile-token');
  });

  it('returns null for an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 204 })));
    await expect(apiRequest('/empty')).resolves.toBeNull();
  });

  it('publishes entitlement updates from subscription-related API errors', async () => {
    const entitlement = { is_valid: true, access_type: 'trial', lifecycle_notice: { stage: 'reminder' } };
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

    const failure = await apiRequest('/data/export').catch((error) => error);
    expect(failure.message).toContain('paid subscription');
    expect(failure).toMatchObject({ status: 403, code: 'trial_feature_restricted', payload: { subscription: entitlement } });
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

    await expect(apiRequest('/products', { method: 'POST', body: '{}' })).rejects.toThrow('Subscription expired.');
    expect(navigateBilling).toHaveBeenCalledOnce();
  });

  it('navigates mobile web and Android clients to billing when a suspended subscription rejects a mutation', async () => {
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

    await expect(apiRequest('/sales/58', { method: 'PATCH', body: '{}' })).rejects.toThrow('suspended');
    expect(navigateBilling).toHaveBeenCalledOnce();
    expect(navigateBilling.mock.calls[0][0].detail).toMatchObject({ can_mutate: false, reason: 'cancelled' });
  });

  it('uses the same structured trial error for backup downloads', async () => {
    const entitlement = { is_valid: true, access_type: 'trial' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false, status: 403, statusText: 'Forbidden',
      json: () => Promise.resolve({ message: 'This feature requires a paid subscription.', code: 'trial_feature_restricted', subscription: entitlement }),
    })));

    const failure = await apiDownload('/data/export').catch((error) => error);
    expect(failure).toMatchObject({ status: 403, code: 'trial_feature_restricted', payload: { subscription: entitlement } });
    expect(failure.message).toContain('paid subscription');
  });

  it('authenticates production APK downloads with the saved bearer token', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_MODE', 'token');
    window.localStorage.setItem('mkpos.mobile.accessToken', 'android-download-token');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const { apiDownload: tokenDownload } = await import('./client.js');

    await tokenDownload('/reports/summary.csv', { accept: 'text/csv' });

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Accept: 'text/csv',
      Authorization: 'Bearer android-download-token',
      'X-MKPOS-Auth': 'token',
      'X-MKPOS-Client': 'android',
    });
  });
});
