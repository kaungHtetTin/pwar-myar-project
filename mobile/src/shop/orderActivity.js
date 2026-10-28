import { createPollPolicy, createSocketRecovery, shareBackgroundFeed, backgroundIdentity, debounceRefresh } from '../backgroundPolicy';
import { io } from 'socket.io-client';
import { DATA_CHANGED_EVENT } from '../navigation/dataChanges';

// Identifiers arrive over the socket; order details always use the authorized API.
export function monitorOrders(apiRequest, onOrders, onActivity = () => {}) {
  const scope = backgroundIdentity();
  return shareBackgroundFeed(scope ? `orders:${scope}` : null, emit => startOrders(apiRequest, emit), data => {
    if (data.orderIds?.length) window.dispatchEvent(new CustomEvent('mkpos:shop-order-changed', { detail: { orderIds: data.orderIds } }));
    onActivity(data.count);
    if (data.items.length || data.clear) onOrders(data.items);
  });
}

function startOrders(apiRequest, onSnapshot) {
  const base = '/shop-admin/order-notifications';
  let active = true, running = false, pending = false, cursor, eventCursor, socket, configuring = false, retryAfter = 0;
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
        const query = new URLSearchParams();
        if (cursor !== undefined) query.set('after_id', cursor);
        if (eventCursor !== undefined) query.set('after_event_id', eventCursor);
        const data = await apiRequest(`${base}${query.size ? `?${query}` : ''}`);
        if (!active) return;
        poll.success();
        cursor = data.cursor;
        if (data.event_cursor !== undefined) eventCursor = data.event_cursor;
        const orderIds = [...new Set((data.changes || []).map(event => Number(event.order_id)).filter(id => Number.isSafeInteger(id) && id > 0))];
        onSnapshot({ count: Math.max(0, Math.floor(Number(data.action_required_count) || 0)), items: data.items || [], orderIds });
        pending ||= Boolean(data.has_more || data.has_more_changes);
      } while (active && pending && pages < 3 && poll.ready());
    } catch (error) {
      poll.failure(error);
      if (error.status === 401 || error.status === 403) { stop(); onSnapshot({ count: 0, items: [], clear: true }); }
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
              if (error.status === 401 || error.status === 403) { stop(); onSnapshot({ count: 0, items: [], clear: true }); }
              else callback({ token: '' });
            });
        },
      });
      recovery = createSocketRecovery(socket, () => active);
      socket.on('order.submitted', socketRefresh);
      socket.on('order.changed', socketRefresh);
      socket.on('connect', socketRefresh);
      socket.on('disconnect', reason => { if (active && reason === 'io server disconnect') recovery.retry(); });
    } catch (error) {
      configPoll.failure(error);
      if (error.status === 429) retryAfter = Date.now() + (error.retryAfterMs || 60000);
    } finally { configuring = false; }
  }
  const resume = () => { refresh().then(configure); };
  const changed = event => { if (event.detail?.modules?.some(module => module === 'shop' || module === '*')) resume(); };
  const timer = setInterval(() => { if (pending || poll.due(Boolean(socket?.connected))) resume(); }, 5000);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener(DATA_CHANGED_EVENT, changed);
  window.addEventListener('mkpos:owner-order-activity', resume);
  function stop() {
    socketRefresh.cancel(); active = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener(DATA_CHANGED_EVENT, changed);
    window.removeEventListener('mkpos:owner-order-activity', resume);
    recovery?.stop();
    socket?.removeAllListeners();
    socket?.disconnect();
  }
  resume();
  return stop;
}
