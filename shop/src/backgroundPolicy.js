import { createCooldownChannel, invalidateBackgroundSession } from '../../shared/network/backgroundTabs.js';
export { shareBackgroundFeed, debounceRefresh } from '../../shared/network/backgroundTabs.js';
// Each SPA owns a copy: no runtime imports across application boundaries.
export function retryAfterMilliseconds(value, now = Date.now()) {
  if (value === null || value === undefined || value === '') return 60000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1000, date - now) : 60000;
}

export function createPollPolicy({ intervalMs = 15000, liveIntervalMs = 120000 } = {}) {
  let lastSuccess = -Infinity, retryAt = 0, failures = 0;
  return {
    ready: ({ allowHidden = false } = {}) => Date.now() >= retryAt && (allowHidden || !document.hidden) && navigator.onLine !== false,
    due(live = false) { return Date.now() >= retryAt && Date.now() - lastSuccess >= (live ? liveIntervalMs : intervalMs); },
    success() { lastSuccess = Date.now(); failures = 0; },
    failure(error) {
      const delay = error.status === 429 ? (error.retryAfterMs || 60000) : Math.min(300000, intervalMs * 2 ** Math.min(failures++, 5));
      retryAt = Math.max(retryAt, Date.now() + delay);
    },
  };
}

const cooldowns = new Map();
let identity = '';
const cooldownChannel = createCooldownChannel((key, until) => cooldowns.set(key, Math.max(cooldowns.get(key) || 0, until)));
export function setBackgroundIdentity(value, invalidate = false) {
  if (invalidate) invalidateBackgroundSession((value || identity).split(':')[0] || 'business');
  if (identity === value) return;
  clearBackgroundCooldowns(); identity = value || ''; cooldownChannel.identity(identity);
}
export function backgroundIdentity() { return identity; }
function backgroundBudget(path, method) {
  const route = path.split('?')[0].replace(/^\/ecommerce/, '');
  if (method === 'GET' && /^\/ai-assistant\/conversations\/[^/]+\/messages\/[^/]+\/delivery$/.test(route)) return 'ai-delivery';
  if (method === 'GET' && /^\/products\/[0-9]+\/photo$/.test(route)) return 'product-photos';
  if (method === 'GET' && /^\/(?:office\/)?activity-alerts(?:\/config)?$/.test(route)) return 'alerts';
  if (method === 'POST' && /^\/(?:office\/)?activity-alerts\/auth$/.test(route)) return 'alerts';
  if ((method === 'GET' && /^\/(shop-admin\/order-notifications|subscription\/alerts)(\/config)?$/.test(route)) ||
      (method === 'POST' && /^\/(shop-admin\/order-notifications|subscription\/alerts)\/auth$/.test(route))) return 'alerts';
  if (method === 'POST' && /^\/order-alerts\/(feed|config|auth)$/.test(route)) return 'customer-background';
  if (method === 'GET' && /^\/customer\/notifications$/.test(route)) return 'customer-background';
  const chat = route.startsWith('/shop-admin/chat') ? route.slice('/shop-admin/chat'.length) : route.startsWith('/chat') ? route.slice('/chat'.length) : null;
  if (chat !== null && ((method === 'GET' && (chat === '' || chat.startsWith('/'))) ||
      (method === 'POST' && (/^\/(presence|auth)$/.test(chat) || /^\/[^/]+\/(presence|read)$/.test(chat))))) {
    return route.startsWith('/shop-admin/') ? 'chat-background' : 'customer-background';
  }
  return null;
}

export function guardBackgroundRequest(path, method = 'GET') {
  const key = backgroundBudget(path, method);
  const retryAfterMs = (cooldowns.get(key) || 0) - Date.now();
  if (key && retryAfterMs > 0) {
    throw Object.assign(new Error('Background updates are paused until the server retry time.'), { status: 429, retryAfterMs });
  }
}

export function recordBackgroundFailure(path, method, error) {
  const key = backgroundBudget(path, method);
  if (key && error.status === 429) {
    const until = Math.max(cooldowns.get(key) || 0, Date.now() + (error.retryAfterMs || 60000));
    cooldowns.set(key, until); cooldownChannel.send(key, until);
  }
}

export function clearBackgroundCooldowns() { cooldowns.clear(); inFlight.clear(); }

const inFlight = new Map();
export function coalesceBackgroundRequest(path, options, perform) {
  const method = String(options.method || 'GET').toUpperCase();
  // Independent abort signals must keep independent request lifecycles.
  if (method !== 'GET' || options.signal || !backgroundBudget(path, method)) return perform();
  const key = JSON.stringify([identity, path, options.customerAuth, options.headers || {}]);
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve().then(perform).finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

// Socket.IO does not automatically retry a server-rejected authentication.
// Recover those connections without issuing a fresh auth request on every tick.
export function createSocketRecovery(socket, isActive = () => true) {
  let lastAttempt = -Infinity;
  const retry = () => {
    if (!isActive() || socket.connected || document.hidden || navigator.onLine === false || Date.now() - lastAttempt < 30000) return;
    lastAttempt = Date.now();
    socket.connect?.();
  };
  const timer = setInterval(() => { if (!socket.active) retry(); }, 30000);
  return { retry, stop: () => clearInterval(timer) };
}

// Hosting/proxy throttles and application quotas are distinct from API counters.
export function rateLimitDetails(response, payload = {}) {
  if (response.status !== 429) return undefined;
  const header = name => response.headers?.get?.(name) || response.headers?.[name.toLowerCase()];
  return { source: payload?.code ? (payload.code === 'rate_limited' ? 'application' : payload.code) : (header('X-RateLimit-Scope') ? 'application' : 'upstream_or_application'),
    scope: payload?.rate_limit_scope || header('X-RateLimit-Scope') || 'unknown',
    requestId: payload?.request_id || header('X-Request-ID') || '' };
}
