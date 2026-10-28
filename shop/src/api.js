import { coalesceBackgroundRequest, guardBackgroundRequest, recordBackgroundFailure, retryAfterMilliseconds, clearBackgroundCooldowns, setBackgroundIdentity, rateLimitDetails } from './backgroundPolicy';
export const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const CUSTOMER_TOKEN_KEY = "mkpos.shop.customerToken";
export const customerToken = () => localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
export function setCustomerToken(token, customer) {
  if (token !== customerToken()) { setBackgroundIdentity('customer:anonymous', true); clearBackgroundCooldowns(); }
  if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  if (token && customer?.id) setBackgroundIdentity(`customer:${customer.id}`);
}

export async function requestChatImage(path) {
  guardBackgroundRequest(path, 'GET');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API}/ecommerce${path}`, { credentials: 'omit', signal: controller.signal, headers: { Accept: 'image/*', Authorization: `Bearer ${customerToken()}` } });
    if (!response.ok) {
      const error = new Error('Unable to load image'); error.status = response.status;
      error.rateLimit = rateLimitDetails(response);
      if (response.status === 429) error.retryAfterMs = retryAfterMilliseconds(response.headers.get('Retry-After'));
      recordBackgroundFailure(path, 'GET', error);
      throw error;
    }
    return { blob: await response.blob() };
  } finally { clearTimeout(timer); }
}

export function request(path, options = {}) {
  return coalesceBackgroundRequest(path, options, () => performRequest(path, options));
}

async function performRequest(path, options = {}) {
  const { customerAuth = path.startsWith("/customer/"), timeoutMs = 30000, ...fetchOptions } = options;
  const method = String(options.method || 'GET').toUpperCase();
  guardBackgroundRequest(path, method);
  const form = options.body instanceof FormData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}/ecommerce${path}`, {
      ...fetchOptions,
      credentials: "omit",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(!form && options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
        ...(customerAuth && customerToken() ? { Authorization: `Bearer ${customerToken()}` } : {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && customerAuth) {
        setCustomerToken("");
        window.dispatchEvent(new Event("mkpos.shop.customer-session-expired"));
      }
      const message =
        Object.values(data.errors || {})
          .flat()
          .join(" ") ||
        data.message ||
        "Unable to connect. Please try again.";
      const error = new Error(message);
      error.status = response.status;
      error.payload = data;
      error.rateLimit = rateLimitDetails(response, data);
      if (response.status === 429) error.retryAfterMs = retryAfterMilliseconds(response.headers.get('Retry-After'));
      recordBackgroundFailure(path, method, error);
      throw error;
    }
    if (['/customer/login', '/customer/register', '/customer/logout'].includes(path)) clearBackgroundCooldowns();
    if (path.startsWith('/customer/') && data.customer?.id) setBackgroundIdentity(`customer:${data.customer.id}`);
    if (path === '/customer/logout') setBackgroundIdentity('');
    return data;
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error("Connection timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const post = (path, body, options = {}) =>
  request(path, { ...options, method: "POST", body: JSON.stringify(body) });
