import { startChatFallback, hasVisibleChatFallback } from '../../../shared/network/chatFallback.js';
import { io } from 'socket.io-client';
import { createPollPolicy, createSocketRecovery, shareBackgroundFeed, debounceRefresh } from '../backgroundPolicy';

// One app-level feed supplies alerts and unread badges on every foreground page.
export function monitorChat(apiRequest, basePath, onUpdate, scope) {
  return shareBackgroundFeed(scope ? `chat:${basePath}:${scope}` : null, emit => startChat(apiRequest, basePath, emit, scope), onUpdate, {
    refreshEvents: [basePath === '/shop-admin/chat' ? 'mkpos:shop-chat-read' : 'mkpos:customer-chat-read'],
  });
}

function startChat(apiRequest, basePath, onUpdate, scope) {
  const storageKey = scope ? `mkpos.chat-alert-cursor:${basePath}:${scope}` : null;
  const savedCursor = () => {
    try {
      const value = storageKey ? localStorage.getItem(storageKey) : null;
      return value !== null && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
    } catch { return undefined; }
  };
  let recovery;
  const poll = createPollPolicy(), presencePoll = createPollPolicy({ intervalMs: 30000 });
  const configPoll = createPollPolicy({ intervalMs: 300000 }), authPoll = createPollPolicy();
  let active = true, running = false, pending = false, cursor = savedCursor(), enabled = false, initialized = false, initialSnapshot = true;
  let socket, configuring = false, nextConfig = 0, presenceBusy = false;

  function pauseBudget(error) {
    if (error.status === 429) for (const policy of [poll, presencePoll, configPoll, authPoll]) policy.failure(error);
  }

  async function heartbeat() {
    if (socket?.connected || !hasVisibleChatFallback() || !active || !poll.ready() || !enabled || presenceBusy || !presencePoll.ready() || !presencePoll.due()) return;
    presenceBusy = true;
    try { await apiRequest(`${basePath}/presence`, { method: 'POST', body: '{}' }); presencePoll.success(); }
    catch (error) { presencePoll.failure(error); pauseBudget(error); }
    finally { presenceBusy = false; }
  }

  const socketRefresh = debounceRefresh(() => { pending = true; void refresh(); });
  async function refresh() {
    if (!active || !poll.ready()) return;
    if (running) { pending = true; return; }
    running = true;
    let pages = 0;
    try {
      do {
        pages++;
        pending = false;
        const query = cursor === undefined ? '' : `?after_id=${cursor}`;
        const data = await apiRequest(`${basePath}/notifications${query}`);
        if (!active) return;
        poll.success(); initialized = true; enabled = Boolean(data.enabled);
        const previous = Math.max(cursor ?? -1, savedCursor() ?? -1);
        const items = (data.items || []).filter(item => Number.isSafeInteger(Number(item.id)) && Number(item.id) > previous);
        cursor = Math.max(previous, Number(data.cursor) || 0, ...items.map(item => Number(item.id)));
        try { if (storageKey) localStorage.setItem(storageKey, String(cursor)); } catch { /* Retain the in-memory cursor. */ }
        onUpdate({ ...data, cursor, items, initialSnapshot });
        pending ||= Boolean(data.has_more);
      } while (active && pending && pages < 3 && poll.ready());
      if (!pending) initialSnapshot = false;
      await heartbeat();
    } catch (error) {
      poll.failure(error); pauseBudget(error);
      if ([401, 403].includes(error.status)) { stop(); onUpdate({ enabled: false, unread_count: 0, items: [] }); }
    } finally { running = false; }
    if (active && pending && poll.ready()) socketRefresh();
  }

  async function configure() {
    if (!active || !poll.ready() || !enabled || socket || configuring || !configPoll.ready() || Date.now() < nextConfig) return;
    configuring = true;
    try {
      const config = await apiRequest(`${basePath}/${basePath === '/chat' ? 'inbox-config' : 'config'}`);
      if (!active) return;
      configPoll.success(); nextConfig = Date.now() + 300000;
      if (!config?.realtime_enabled || !config.channel) return;
      socket = io(`${config.scheme}://${config.host}:${config.port}`, {
        path: config.path || '/socket.io', transports: ['websocket'], reconnection: false,
        auth: callback => {
          if (!active || !authPoll.ready()) { callback({ token: '' }); return; }
          apiRequest(`${basePath}/auth`, { method: 'POST', body: JSON.stringify({ channel_name: config.channel }) })
            .then(data => { authPoll.success(); if (active) callback({ token: data.token }); })
            .catch(error => { authPoll.failure(error); pauseBudget(error); if (active) callback({ token: '' }); });
        },
      });
      recovery = createSocketRecovery(socket, () => active);
      socket.on('connect', () => { fallback.update(); activity(); socketRefresh(); });
      socket.on('chat.changed', socketRefresh);
      socket.on('connect_error', scheduleFallback);
      socket.on('disconnect', reason => { if (active && reason === 'io server disconnect') recovery.retry(); scheduleFallback(); });
    } catch (error) { configPoll.failure(error); pauseBudget(error); }
    finally { configuring = false; }
  }
  const activity = () => { if (socket?.connected) socket.emit?.('chat.activity', !document.hidden); };
  const scheduleFallback = () => fallback.update();
  const resume = event => {
    activity();
    if (socket?.connected && ['visibilitychange', 'online'].includes(event?.type) && !pending) return;
    void refresh().then(configure).finally(scheduleFallback);
  };
  const tick = () => {
    if (pending || poll.due(Boolean(socket?.connected))) resume();
    else { void heartbeat(); scheduleFallback(); }
  };
  const settingsChanged = event => {
    if (event.detail?.resources?.some(resource => ['settings', '*'].includes(resource)) || event.detail?.modules?.some(module => ['settings', '*'].includes(module))) resume();
  };
  window.addEventListener('mkpos:data-change', settingsChanged);
  window.addEventListener('mkpos:mobile-data-changed', settingsChanged);
  const readEvent = basePath === '/shop-admin/chat' ? 'mkpos:shop-chat-read' : 'mkpos:customer-chat-read';
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener(readEvent, resume);
  function stop() {
    socketRefresh.cancel(); active = false; fallback.stop();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener(readEvent, resume);
    window.removeEventListener('mkpos:data-change', settingsChanged);
    window.removeEventListener('mkpos:mobile-data-changed', settingsChanged);
    recovery?.stop();
    socket?.removeAllListeners(); socket?.disconnect();
  }
  const fallback = startChatFallback(tick, () => active && (!initialized || enabled) && !socket?.connected, { view: false });
  resume();
  stop.refresh = resume;
  return stop;
}
