import { trackNotificationCatchUp } from './notificationCatchUp';
import { createPollPolicy, createSocketRecovery, shareBackgroundFeed, debounceRefresh } from './backgroundPolicy';
import { io } from 'socket.io-client';

export function monitorCustomerOrders(apiRequest, { customerId, reference, credential }, onEvents) {
  return shareBackgroundFeed(customerId ? `orders:customer:${customerId}` : null, emit => startOrders(apiRequest, { customerId, reference, credential }, emit), onEvents);
}

function startOrders(apiRequest, { customerId, reference, credential }, onEvents) {
  const credentials = customerId ? {} : { reference, credential };
  const storageKey = `mkpos.order-alert-cursor:${customerId ? `customer:${customerId}` : `tracking:${reference}`}`;
  const saved = () => { try { const value = localStorage.getItem(storageKey); return value !== null && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : undefined; } catch { return undefined; } };
  let active = true, running = false, pending = false, configuring = false, cursor = saved(), socket, retryAfter = 0;
  const post = (path, data = {}) => apiRequest(`/order-alerts/${path}`, { method: 'POST', customerAuth: Boolean(customerId), body: JSON.stringify({ ...credentials, ...data }) });
  let recovery;
  const catchUp = trackNotificationCatchUp();
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
        const delivery = catchUp.snapshot();
        const data = await post('feed', cursor === undefined ? {} : { after_id: cursor });
        if (!active) return;
        poll.success();
        const previous = Math.max(cursor ?? -1, saved() ?? -1);
        const items = (data.items || []).filter(item => Number(item.id) > previous);
        cursor = Math.max(previous, Number(data.cursor) || 0, ...items.map(item => Number(item.id)));
        try { localStorage.setItem(storageKey, String(cursor)); } catch { /* Memory still prevents duplicate delivery. */ }
        if (items.length) onEvents(items, { catchUp: delivery.catchUp, recoveryId: delivery.recoveryId });
        catchUp.settled(delivery, data.has_more);
        pending ||= Boolean(data.has_more);
      } while (active && pending && pages < 3 && poll.ready());
    } catch (error) {
      catchUp.mark(); poll.failure(error);
      if ([401, 403, 404].includes(error.status)) { stop(); onEvents([]); }
      if (error.status === 429) retryAfter = Date.now() + (error.retryAfterMs || 60000);
    } finally { running = false; }
  }
  async function configure() {
    if (!active || !configPoll.ready() || Date.now() < nextConfig || configuring || socket || cursor === undefined || Date.now() < retryAfter) return;
    configuring = true;
    try {
      const config = await post('config');
      nextConfig = Date.now() + 300000;
      configPoll.success();
      if (!active || !config.realtime_enabled) return;
      socket = io(`${config.scheme}://${config.host}:${config.port}`, {
        path: config.path || '/socket.io', transports: ['websocket'], reconnectionDelayMax: 10000,
        auth: callback => {
          if (!active || !authPoll.ready()) { callback({ token: '' }); return; }
          return post('auth', { channel_name: config.channel }).then(data => { authPoll.success(); if (active) callback({ token: data.token }); })
          .catch(error => { authPoll.failure(error); if (!active) return; if ([401,403,404].includes(error.status)) { stop(); onEvents([]); } else callback({ token: '' }); });
        },
      });
      recovery = createSocketRecovery(socket, () => active);
      socket.on('order.updated', socketRefresh);
      socket.on('connect', socketRefresh);
      socket.on('disconnect', reason => { catchUp.mark(); if (active && reason === 'io server disconnect') recovery.retry(); });
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
    catchUp.stop(); socketRefresh.cancel(); active = false; clearInterval(timer);
    document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume);
    recovery?.stop();
    socket?.removeAllListeners(); socket?.disconnect();
  }
  resume();
  return stop;
}
