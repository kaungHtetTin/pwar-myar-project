import { withAdminAuthorization } from '../../../shared/network/adminAuthorization';
import { coalesceBackgroundRequest, guardBackgroundRequest, recordBackgroundFailure, retryAfterMilliseconds, clearBackgroundCooldowns, setBackgroundIdentity, rateLimitDetails } from '../backgroundPolicy';
import { configureTimezone } from '../timezone';
import { publishDataChange } from '../navigation/dataChanges';
import { ACCESS_TOKEN_KEY, clearAccessToken } from './authStorage';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const API_ORIGIN = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : '';
const TOKEN_AUTH = import.meta.env.VITE_AUTH_MODE === 'token';
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
    'X-MKPOS-Client': 'android',
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
  return payload;
}

function readCookie(name) {
  const prefix = `${name}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : '';
}

export async function ensureCsrfCookie() {
  if (readCookie('XSRF-TOKEN')) return;

  if (!csrfRequest) {
    csrfRequest = fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, {
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

export function apiRequest(path, options = {}) {
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
  // Preserve the header for server revocation, but end local authentication now,
  // including when offline, timed out or returning an empty response.
  const authHeaders = clientAuthHeaders();
  if (path === '/auth/logout') clearAccessToken();

  if (!TOKEN_AUTH && !['GET', 'HEAD', 'OPTIONS'].includes(method)) await ensureCsrfCookie();

  let timedOut = false;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });

  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...authHeaders,
        ...(readCookie('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') } : {}),
        ...(headers || {}),
      },
      credentials: 'include',
      ...fetchOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ detail: response.statusText }));
      const validationMessage = Object.values(payload.errors || {})[0]?.[0];
      const error = new Error(validationMessage || payload.detail || payload.message || 'Request failed.');
      error.status = response.status;
      if (response.status === 429) error.retryAfterMs = retryAfterMilliseconds(response.headers.get('Retry-After'));
      error.rateLimit = rateLimitDetails(response, payload);
      error.code = payload.code;
      error.payload = payload;
      if (response.status === 402 || payload.code === 'trial_feature_restricted') {
        publishSubscriptionEntitlement(payload);
      }
      navigateToBillingForBlockedMutation(method, response.status, payload);
      if (TOKEN_AUTH && response.status === 401) window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      recordBackgroundFailure(path, method, error);
      throw error;
    }

    const payload = response.status === 204 ? null : acceptAuthPayload(path, await response.json());
    publishDataChange(path, method);
    return payload;
  } catch (error) {
    if (timedOut) throw new Error('Request timed out. Check your connection and try again.');
    if (externalSignal?.aborted) throw new Error('Request cancelled.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

export async function apiDownload(path, { accept = 'application/octet-stream', timeoutMs = 120000 } = {}) {
  guardBackgroundRequest(path, 'GET');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'GET',
      credentials: 'include',
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
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}
