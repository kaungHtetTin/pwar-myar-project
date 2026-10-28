const connectedPrivateFeeds = new Set();
export const resourceRealtimeLive = () => connectedPrivateFeeds.size > 0;

// The calling SPA supplies its own Socket.IO import and authenticated API client.
export function startResourceRealtime({ io, request, receive, base = '/realtime/resources', publicRoom = false, fallback = ['products', 'settings', 'reports'] }) {
  const identity = {};
  let stopped = false, socket, configuring = false, nextConfig = 0, nextAuth = 0, nextPoll = Date.now() + 30000, queued = new Set(), refreshTimer;
  const ready = () => !stopped && !document.hidden && navigator.onLine !== false;
  const notify = resources => {
    resources.forEach(resource => queued.add(resource));
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!ready()) return;
      const resources = [...queued]; queued.clear();
      if (resources.length) receive(resources);
    }, 150);
  };
  async function configure() {
    if (!ready() || socket || configuring || Date.now() < nextConfig) return;
    configuring = true; nextConfig = Date.now() + 300000;
    try {
      const config = await request(`${base}/config`);
      if (stopped || !config.realtime_enabled) return;
      socket = io(`${config.scheme}://${config.host}:${config.port}`, {
        path: config.path || '/socket.io', transports: ['websocket'], reconnectionDelayMax: 30000,
        auth: callback => {
          if (!ready() || Date.now() < nextAuth) { callback({ token: '' }); return; }
          const options = publicRoom ? undefined : { method: 'POST', body: JSON.stringify({ channel_name: config.channel }) };
          const path = publicRoom ? `${base}/auth?channel_name=${encodeURIComponent(config.channel)}` : `${base}/auth`;
          request(path, options).then(data => { if (!stopped) callback({ token: data.token }); }).catch(error => {
            nextAuth = Date.now() + (error.retryAfterMs || 30000);
            if (!stopped) callback({ token: '' });
          });
        },
      });
      socket.on('resources.changed', data => { if (Array.isArray(data?.resources)) notify(data.resources); });
      socket.on('connect', () => { if (!publicRoom) connectedPrivateFeeds.add(identity); nextPoll = Date.now() + 120000; notify(fallback); });
      socket.on('disconnect', () => { connectedPrivateFeeds.delete(identity); nextPoll = Math.min(nextPoll, Date.now() + 30000); });
    } catch (error) { nextConfig = Date.now() + Math.max(300000, error.retryAfterMs || 0); }
    finally { configuring = false; }
  }
  const tick = () => {
    if (!ready()) return;
    void configure();
    if (socket && !socket.connected && !socket.active && Date.now() >= nextAuth) socket.connect();
    if (Date.now() >= nextPoll) { nextPoll = Date.now() + (socket?.connected ? 120000 : 30000); notify(fallback); }
    if (queued.size) notify([]);
  };
  const resume = () => { if (ready()) { notify(fallback); tick(); } };
  const timer = setInterval(tick, 15000);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  void configure();
  return () => {
    stopped = true; connectedPrivateFeeds.delete(identity); clearInterval(timer); clearTimeout(refreshTimer); queued.clear();
    window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume);
    socket?.removeAllListeners(); socket?.disconnect();
  };
}
