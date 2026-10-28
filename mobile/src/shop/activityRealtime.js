import { createPollPolicy, createSocketRecovery, shareBackgroundFeed, debounceRefresh } from '../backgroundPolicy';
import { io } from 'socket.io-client';

// Socket events carry identifiers; details always come from the authenticated API.
export function monitorActivity(apiRequest, scope, onEvents, base = '/activity-alerts') {
  return shareBackgroundFeed(scope ? `activity:${base}:${scope}` : null, emit => startActivity(apiRequest, scope, emit, base), onEvents);
}

function startActivity(apiRequest, scope, onEvents, base) {
  const storageKey = `mkpos.activity-alert-cursor:${base}:${scope}`;
  const saved = () => { try { const value = localStorage.getItem(storageKey); return value !== null && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : undefined; } catch { return undefined; } };
  let active = true, running = false, pending = false, cursor = saved(), socket, configuring = false, retryAfter = 0;
  let recovery;
  const poll = createPollPolicy();
  const configPoll = createPollPolicy({ intervalMs: 300000 });
  const authPoll = createPollPolicy();
  let nextConfig = 0;
  const socketRefresh = debounceRefresh(() => { void refresh(); });
  async function refresh() {
    if (!active || !poll.ready() || Date.now() < retryAfter || (document.hidden && cursor !== undefined)) return;
    if (running) { pending = true; return; }
    running = true;
    let pages = 0;
    try {
      do {
        pages++;
        pending = false;
        const data = await apiRequest(`${base}${cursor === undefined ? '' : `?after_id=${cursor}`}`);
        if (!active) return;
        poll.success();
        const previous = Math.max(cursor ?? -1, saved() ?? -1);
        const items = (data.items || []).filter(item => Number(item.id) > previous);
        cursor = Math.max(previous, Number(data.cursor) || 0, ...items.map(item => Number(item.id)));
        try { localStorage.setItem(storageKey, String(cursor)); } catch { /* Keep the in-memory cursor. */ }
        if (items.length) {
          if (data.sales_ai) onEvents(items, data.subscription, data.sales_ai);
          else onEvents(items, data.subscription);
        }
        pending ||= Boolean(data.has_more);
      } while (active && pending && pages < 3 && poll.ready());
    } catch (error) {
      poll.failure(error);
      if (error.status === 401 || error.status === 403) { stop(); onEvents([]); }
      if (error.status === 429) retryAfter = Date.now() + (error.retryAfterMs || 60000);
    } finally { running = false; }
  }
  async function configure() {
    if (!active || !configPoll.ready() || Date.now() < nextConfig || configuring || socket || cursor === undefined || Date.now() < retryAfter) return;
    configuring = true;
    try {
      const config = await apiRequest(`${base}/config`);
      nextConfig = Date.now() + 300000;
      configPoll.success();
      if (!active || !config.realtime_enabled) return;
      socket = io(`${config.scheme}://${config.host}:${config.port}`, {
        path: config.path || '/socket.io', transports: ['websocket'], reconnectionDelayMax: 10000,
        auth: callback => {
          if (!active || !authPoll.ready()) { callback({ token: '' }); return; }
          apiRequest(`${base}/auth`, { method: 'POST', body: JSON.stringify({ channel_name: config.channel }) })
            .then(data => { authPoll.success(); if (active) callback({ token: data.token }); })
            .catch(error => {
              authPoll.failure(error);
              if (!active) return;
              if (error.status === 401 || error.status === 403) { stop(); onEvents([]); }
              else callback({ token: '' });
            });
        },
      });
      recovery = createSocketRecovery(socket, () => active);
      socket.on('activity.changed', socketRefresh);
      socket.on('connect', socketRefresh);
      socket.on('disconnect', reason => { if (active && reason === 'io server disconnect') recovery.retry(); });
    } catch (error) {
      configPoll.failure(error);
      if (error.status === 429) retryAfter = Date.now() + (error.retryAfterMs || 60000);
    } finally { configuring = false; }
  }
  const resume = () => { refresh().then(configure); };
  const timer = setInterval(() => { if (pending || poll.due(Boolean(socket?.connected))) resume(); }, 15000);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  function stop() {
    socketRefresh.cancel(); active = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    recovery?.stop();
    socket?.removeAllListeners();
    socket?.disconnect();
  }
  resume();
  return stop;
}
