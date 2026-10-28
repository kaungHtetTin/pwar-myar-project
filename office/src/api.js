import { coalesceBackgroundRequest, guardBackgroundRequest, recordBackgroundFailure, retryAfterMilliseconds, clearBackgroundCooldowns, setBackgroundIdentity, rateLimitDetails } from './backgroundPolicy';
import { setOfficeTimezone } from './dateTime';
function integratedApiUrl() {
  const marker = '/office';
  const officeIndex = window.location.pathname.indexOf(marker);
  return officeIndex >= 0 ? `${window.location.pathname.slice(0, officeIndex)}/api` : '/api';
}

const API = (import.meta.env.VITE_API_URL || integratedApiUrl()).replace(/\/$/, '');
export const officeApiBase = API;
const ROOT = API.endsWith('/api') ? API.slice(0, -4) : '';
const TOKEN_MODE = import.meta.env.VITE_AUTH_MODE === 'token';
const TOKEN_KEY = 'mkpos.office.accessToken';

function accessToken() {
  return TOKEN_MODE ? localStorage.getItem(TOKEN_KEY) || '' : '';
}

function clearToken() {
  if (TOKEN_MODE) localStorage.removeItem(TOKEN_KEY);
}

function cookie(name) {
  const value = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}

async function csrf(force = false) {
  if (TOKEN_MODE) return;
  if (!force && cookie('XSRF-TOKEN')) return;
  const response = await fetch(`${ROOT}/sanctum/csrf-cookie`, { credentials: 'include', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Unable to start a secure office session.');
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) await csrf();
  const token = accessToken();
  const apiPath = path.startsWith('/api/') ? path.slice(4) : path;
  const requestOptions = {
    ...options,
    credentials: TOKEN_MODE ? 'omit' : 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(TOKEN_MODE ? { 'X-MKPOS-Auth': 'token', 'X-MKPOS-Client': 'office' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!TOKEN_MODE && cookie('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': cookie('XSRF-TOKEN') } : {}),
      ...(options.headers || {}),
    },
  };
  if (options.body instanceof FormData) delete requestOptions.headers['Content-Type'];
  let response = await fetch(`${API}${apiPath}`, requestOptions);
  if (!TOKEN_MODE && response.status === 419 && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await csrf(true);
    const refreshedToken = cookie('XSRF-TOKEN');
    if (refreshedToken) requestOptions.headers['X-XSRF-TOKEN'] = refreshedToken;
    response = await fetch(`${API}${apiPath}`, requestOptions);
  }
  if (response.status === 401) clearToken();
  return response;
}

async function responseError(response) {
  const payload = await response.json().catch(() => ({}));
  const validation = Object.values(payload.errors || {})[0]?.[0];
  const error = new Error(validation || payload.message || payload.detail || 'Request failed');
  error.status = response.status;
  if (response.status === 429) error.retryAfterMs = retryAfterMilliseconds(response.headers.get('Retry-After'));
  error.payload = payload;
  error.rateLimit = rateLimitDetails(response, payload);
  return error;
}

export function api(path, options = {}) {
  return coalesceBackgroundRequest(path, options, () => performRequest(path, options));
}

async function performRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  guardBackgroundRequest(path, method);
  const response = await request(path, options);
  if (!response.ok) {
    const error = await responseError(response);
    recordBackgroundFailure(path, method, error);
    throw error;
  }
  const payload = await response.json();
  if (path === '/office/auth/login' || path === '/office/auth/logout') clearBackgroundCooldowns();
  if (payload.admin) { setOfficeTimezone(payload.timezone); setBackgroundIdentity(`office:${payload.admin.id}`, path === '/office/auth/login'); }
  if (path === '/office/auth/logout') setBackgroundIdentity('', true);
  if (TOKEN_MODE && payload.access_token) {
    localStorage.setItem(TOKEN_KEY, payload.access_token);
    delete payload.access_token;
    delete payload.token_type;
  }
  if (path === '/office/auth/logout') clearToken();
  return payload;
}

export async function apiUpload(path, file, metadata = {}) {
  const query = new URLSearchParams({
    ...metadata,
    original_name: file.name,
    file_size: String(file.size),
  });
  const response = await request(`${path}?${query}`, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!response.ok) throw await responseError(response);
  return response.json();
}

export async function apiBlob(path) {
  const response = await request(path, { headers: { Accept: '*/*' } });
  if (!response.ok) throw await responseError(response);
  return response.blob();
}
