import { observeViewVisibility } from './viewVisibility.js';

// One fallback clock per SPA, shared by notifications, inboxes and conversations.
// Healthy sockets, hidden pages and offline devices do not own a polling timer.
export function createChatFallbackClock({ intervalMs = 15000 } = {}) {
  const entries = new Set();
  let timer, stopVisibility;
  const eligible = entry => !document.hidden && navigator.onLine !== false && entry.enabled();
  const update = () => {
    const needed = [...entries].some(eligible);
    if (!needed) { clearTimeout(timer); timer = undefined; }
    else if (timer === undefined) timer = setTimeout(tick, intervalMs);
  };
  const tick = () => {
    timer = undefined;
    for (const entry of entries) {
      if (entry.running || !eligible(entry)) continue;
      entry.running = true;
      Promise.resolve().then(() => {
        if (entries.has(entry) && eligible(entry)) return entry.refresh();
      }).catch(() => {}).finally(() => { entry.running = false; update(); });
    }
    update();
  };
  const subscribe = (refresh, enabled, { view = true } = {}) => {
    const entry = { refresh, enabled, view, running: false };
    if (!entries.size) {
      stopVisibility = observeViewVisibility(update);
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      window.addEventListener('mkpos:socket-state', update);
    }
    entries.add(entry); update();
    return {
      update,
      stop() {
        entries.delete(entry); update();
        if (!entries.size) {
          stopVisibility?.();
          window.removeEventListener('online', update);
          window.removeEventListener('offline', update);
          window.removeEventListener('mkpos:socket-state', update);
        }
      },
    };
  };
  subscribe.hasVisibleView = () => [...entries].some(entry => entry.view && eligible(entry));
  return subscribe;
}

export const startChatFallback = createChatFallbackClock();
export const hasVisibleChatFallback = () => startChatFallback.hasVisibleView();
