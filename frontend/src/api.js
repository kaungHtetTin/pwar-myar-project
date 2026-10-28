import { withAdminAuthorization } from '../../shared/network/adminAuthorization';
import { coalesceBackgroundRequest, guardBackgroundRequest, recordBackgroundFailure, retryAfterMilliseconds, clearBackgroundCooldowns, setBackgroundIdentity, rateLimitDetails } from './backgroundPolicy';
import { configureTimezone } from './timezone';
const API = import.meta.env.VITE_API_URL || '/api';
const API_ROOT = API.endsWith('/api') ? API.slice(0, -4) : '';
const TOKEN_AUTH = import.meta.env.VITE_AUTH_MODE === 'token';
const ACCESS_TOKEN_KEY = 'mkpos.accessToken';
let csrfRequest = null;

function publishSubscriptionEntitlement(payload) {
  if (!payload?.subscription) return;
  window.dispatchEvent(new CustomEvent('mkpos:subscription-entitlement', { detail: payload.subscription }));
}

function navigateToBillingForBlockedMutation(method, status, payload) {
  if (status !== 402 || ['GET', 'HEAD', 'OPTIONS'].includes(method) || !payload?.subscription) return;
  window.dispatchEvent(new CustomEvent('mkpos:navigate-billing', { detail: payload.subscription }));
}

function accessToken() {
  return TOKEN_AUTH ? window.localStorage.getItem(ACCESS_TOKEN_KEY) || '' : '';
}

function clientAuthHeaders() {
  return TOKEN_AUTH ? {
    'X-MKPOS-Auth': 'token',
    'X-MKPOS-Client': typeof window !== 'undefined' && window.mkposDesktop ? 'desktop' : 'web',
    ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}),
  } : {};
}

function acceptAuthPayload(path, payload) {
  const session = payload?.session || payload;
  if (path.startsWith('/auth/') && session?.user?.id) setBackgroundIdentity(`business:${session.user.id}:${session.business?.id || session.user.business_id || ''}`, ['/auth/login', '/auth/register'].includes(path));
  if (path === '/auth/logout') setBackgroundIdentity('', true);
  configureTimezone(payload?.session || payload);
  if (['/auth/login', '/auth/register', '/auth/logout'].includes(path)) clearBackgroundCooldowns();
  if (!TOKEN_AUTH || !payload || typeof payload !== 'object') return payload;
  if (payload.access_token && ['/auth/login', '/auth/register', '/auth/profile'].includes(path)) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, payload.access_token);
    const session = { ...payload };
    delete session.access_token;
    delete session.token_type;
    return session;
  }
  if (path === '/auth/logout') window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  return payload;
}

async function desktopBody(body) {
  if (!body) return null;
  if (!(typeof FormData !== 'undefined' && body instanceof FormData)) {
    return { kind: 'text', value: String(body) };
  }

  const entries = [];
  for (const [name, value] of body.entries()) {
    if (typeof File !== 'undefined' && value instanceof File) {
      entries.push({
        kind: 'file',
        name,
        filename: value.name,
        type: value.type,
        bytes: new Uint8Array(await value.arrayBuffer()),
      });
    } else {
      entries.push({ kind: 'text', name, value: String(value) });
    }
  }
  return { kind: 'form-data', entries };
}

async function desktopRequest(path, { timeoutMs, headers, ...fetchOptions }) {
  const result = await window.mkposDesktop.apiRequest({
    path,
    method: String(fetchOptions.method || 'GET').toUpperCase(),
    headers: headers || {},
    body: await desktopBody(fetchOptions.body),
    timeoutMs,
  });
  let payload;
  try { payload = result.body ? JSON.parse(result.body) : {}; }
  catch { payload = { detail: result.body || result.statusText }; }
  return { ...result, payload };
}

function cookie(name) {
  const prefix = `${name}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : '';
}

export async function ensureCsrfCookie(force = false) {
  if (TOKEN_AUTH) return;
  if (!force && cookie('XSRF-TOKEN')) return;
  if (!csrfRequest) {
    csrfRequest = fetch(`${API_ROOT}/sanctum/csrf-cookie`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then((response) => {
      if (!response.ok) throw new Error('Unable to start a secure session.');
    }).finally(() => {
      csrfRequest = null;
    });
  }
  return csrfRequest;
}

export function request(path, options = {}) {
  return coalesceBackgroundRequest(path, options, () => withAdminAuthorization(path, options, performRequest));
}

async function performRequest(path, options = {}) {
  const {
    adminPinPrompt: _adminPinPrompt,
    timeoutMs = 15000,
    signal: externalSignal,
    headers,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  guardBackgroundRequest(path, method);
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const desktop = typeof window !== 'undefined' && typeof window.mkposDesktop?.apiRequest === 'function';
  if (!desktop && !TOKEN_AUTH && !['GET', 'HEAD', 'OPTIONS'].includes(method)) await ensureCsrfCookie();
  let timedOut = false;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const requestHeaders = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
      ...clientAuthHeaders(),
      ...(!desktop && !TOKEN_AUTH && cookie('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': cookie('XSRF-TOKEN') } : {}),
      ...(headers || {}),
    };
    let response = desktop
      ? await desktopRequest(path, { timeoutMs, headers: requestHeaders, ...fetchOptions })
      : await fetch(`${API}${path}`, {
        headers: requestHeaders,
        credentials: TOKEN_AUTH ? 'omit' : 'include',
        ...fetchOptions,
        signal: controller.signal,
      });
    if (!desktop && !TOKEN_AUTH && response.status === 419 && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await ensureCsrfCookie(true);
      const refreshedToken = cookie('XSRF-TOKEN');
      if (refreshedToken) requestHeaders['X-XSRF-TOKEN'] = refreshedToken;
      response = await fetch(`${API}${path}`, {
        headers: requestHeaders,
        credentials: 'include',
        ...fetchOptions,
        signal: controller.signal,
      });
    }
    if (!response.ok) {
      const error = desktop
        ? response.payload
        : await response.json().catch(() => ({ detail: response.statusText }));
      if (response.status === 402 && error.subscription) {
        window.dispatchEvent(new CustomEvent('mkpos:subscription-required', { detail: error.subscription }));
      }
      navigateToBillingForBlockedMutation(method, response.status, error);
      if (response.status === 402 || error.code === 'trial_feature_restricted') {
        publishSubscriptionEntitlement(error);
      }
      const validationMessage = Object.values(error.errors || {})[0]?.[0];
      const requestError = new Error(validationMessage || error.detail || error.message || 'Request failed');
      requestError.status = response.status;
      if (response.status === 429) requestError.retryAfterMs = retryAfterMilliseconds(response.headers?.get?.('Retry-After') ?? response.headers?.['retry-after']);
      requestError.rateLimit = rateLimitDetails(response, error);
      requestError.code = error.code;
      requestError.payload = error;
      if (TOKEN_AUTH && response.status === 401) window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      recordBackgroundFailure(path, method, requestError);
      throw requestError;
    }
    const payload = desktop ? response.payload : await response.json();
    return acceptAuthPayload(path, payload);
  } catch (error) {
    if (timedOut) throw new Error('Request timed out. Check that PwarMyar is running and try again.');
    if (externalSignal?.aborted) throw new Error('Request cancelled.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

export async function requestDownload(path, { accept = 'application/octet-stream', timeoutMs = 120000 } = {}) {
  guardBackgroundRequest(path, 'GET');
  const desktop = typeof window !== 'undefined' && typeof window.mkposDesktop?.apiRequest === 'function';
  if (desktop) {
    const result = await window.mkposDesktop.apiRequest({
      path,
      method: 'GET',
      headers: { Accept: accept, ...clientAuthHeaders() },
      timeoutMs,
      responseType: 'base64',
    });
    if (!result.ok) {
      let payload = {};
      try { payload = JSON.parse(atob(result.body || '')); } catch { /* Non-JSON download error. */ }
      publishSubscriptionEntitlement(payload);
      const error = new Error(payload.message || result.statusText || 'Download failed.');
      error.status = result.status;
      if (result.status === 429) error.retryAfterMs = retryAfterMilliseconds(result.headers?.['retry-after']);
      error.rateLimit = rateLimitDetails(result, payload);
      error.code = payload.code;
      error.payload = payload;
      recordBackgroundFailure(path, 'GET', error);
      throw error;
    }
    const bytes = Uint8Array.from(atob(result.body), (character) => character.charCodeAt(0));
    return { blob: new Blob([bytes], { type: result.headers?.['content-type'] || accept }), headers: result.headers || {} };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, {
      method: 'GET',
      credentials: TOKEN_AUTH ? 'omit' : 'include',
      headers: { Accept: accept, ...clientAuthHeaders() },
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      publishSubscriptionEntitlement(payload);
      const error = new Error(payload.message || payload.detail || response.statusText || 'Download failed.');
      error.status = response.status;
      if (response.status === 429) error.retryAfterMs = retryAfterMilliseconds(response.headers.get('Retry-After'));
      error.rateLimit = rateLimitDetails(response, payload);
      error.code = payload.code;
      error.payload = payload;
      recordBackgroundFailure(path, 'GET', error);
      throw error;
    }
    return { blob: await response.blob(), headers: Object.fromEntries(response.headers.entries()) };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function requestAllPages(path, { pageSize = 500, maxItems = 50000 } = {}) {
  const items = [];
  let offset = 0;
  let knownTotal = null;
  while (items.length < maxItems) {
    const separator = path.includes('?') ? '&' : '?';
    const payload = await request(
      `${path}${separator}with_total=true&limit=${pageSize}&offset=${offset}`,
      { timeoutMs: 30000 },
    );
    const pageItems = Array.isArray(payload) ? payload : payload.items || [];
    items.push(...pageItems);
    knownTotal = Array.isArray(payload) ? pageItems.length : Number(payload.total || 0);
    if (!pageItems.length || items.length >= knownTotal) break;
    offset += pageItems.length;
  }
  if (knownTotal !== null && knownTotal > items.length) {
    throw new Error(`This action is limited to ${maxItems.toLocaleString()} records.`);
  }
  return items;
}
