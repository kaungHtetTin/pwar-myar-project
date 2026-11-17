import { invalidateReferenceData } from './referenceCache.js';
const connectedPrivateFeeds = new Set();
export const resourceRealtimeLive = () => connectedPrivateFeeds.size > 0;

// The calling SPA supplies its own Socket.IO import and authenticated API client.
export function startResourceRealtime({ io, request, receive, base = '/realtime/resources', publicRoom = false, fallback = ['*'] }) {
  const identity = {};
  let stopped = false, socket, configuring = false, configured = false, nextConfig = 0, nextAuth = 0, connectedOnce = false, queued = new Set(), refreshTimer, retryTimer;
  let authFailures = 0, connectionFailures = 0;
  const ready = () => !stopped && !document.hidden && navigator.onLine !== false;
  const scheduleRetry = deadline => {
    clearTimeout(retryTimer);
    if (!ready()) return;
    const delay = Math.max(15000, deadline - Date.now(), nextAuth - Date.now());
    retryTimer = setTimeout(() => { retryTimer = undefined; tick(); }, delay + Math.floor(Math.random() * delay * 0.2));
  };
  const notify = resources => {
    invalidateReferenceData(resources);
    resources.forEach(resource => queued.add(resource));
    if (!ready()) return;
    if (refreshTimer !== undefined) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      if (!ready()) return;
      const resources = [...queued]; queued.clear();
      if (resources.length) receive(resources);
    }, 150);
  };
  async function configure() {
    if (!ready() || socket || configuring || configured || Date.now() < nextConfig) return;
    configuring = true; nextConfig = Date.now() + 300000;
    try {
      const config = await request(`${base}/config`);
      configured = true;
      clearTimeout(retryTimer);
      if (stopped || !config.realtime_enabled) return;
      socket = io(`${config.scheme}://${config.host}:${config.port}`, {
        path: config.path || '/socket.io', transports: ['websocket'], reconnection: false,
        auth: callback => {
          if (!ready() || Date.now() < nextAuth) { socket?.disconnect(); return; }
          const options = publicRoom ? undefined : { method: 'POST', body: JSON.stringify({ channel_name: config.channel }) };
          const path = publicRoom ? `${base}/auth?channel_name=${encodeURIComponent(config.channel)}` : `${base}/auth`;
          request(path, options).then(data => { if (!stopped) callback({ token: data.token }); }).catch(error => {
            nextAuth = Date.now() + Math.max(error.retryAfterMs || 0, Math.min(300000, 30000 * 2 ** Math.min(authFailures++, 4)));
            // Close the transport instead of submitting an invalid empty ticket.
            if (!stopped) socket?.disconnect();
            scheduleRetry(nextAuth);
          });
        },
      });
      socket.on('resources.changed', data => { if (Array.isArray(data?.resources)) notify(data.resources); });
      socket.on('connect', () => {
        authFailures = 0;
        connectionFailures = 0; clearTimeout(retryTimer);
        if (!publicRoom) connectedPrivateFeeds.add(identity);
        // Initial page loaders supply the first snapshot. Reconcile only a real reconnect.
        if (connectedOnce) notify(fallback);
        connectedOnce = true;
        window.dispatchEvent(new Event('mkpos:realtime-connected'));
      });
      socket.on('connect_error', () => {
        nextAuth = Math.max(nextAuth, Date.now() + Math.min(300000, 30000 * 2 ** Math.min(connectionFailures++, 4)));
        scheduleRetry(nextAuth);
      });
      socket.on('disconnect', () => { connectedPrivateFeeds.delete(identity); scheduleRetry(nextAuth); });
    } catch (error) { nextConfig = Date.now() + Math.max(300000, error.retryAfterMs || 0); scheduleRetry(nextConfig); }
    finally { configuring = false; }
  }
  const tick = () => {
    if (!ready()) return;
    if (!socket && !configured && Date.now() < nextConfig) scheduleRetry(nextConfig);
    else void configure();
    if (socket && !socket.connected) {
      if (Date.now() < nextAuth) scheduleRetry(nextAuth);
      else socket.connect();
    }
    if (queued.size) notify([]);
  };
  const resume = () => { if (ready()) tick(); else clearTimeout(retryTimer); };
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  void configure();
  return () => {
    stopped = true; connectedPrivateFeeds.delete(identity); clearTimeout(retryTimer); clearTimeout(refreshTimer); queued.clear();
    window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume);
    socket?.removeAllListeners(); socket?.disconnect();
  };
}
