// A changed snapshot is downloaded once, never periodically while nothing changed.
export function startOfflineCacheRefresh(download, { minimumMs = 60000, jitterMs = 10000, onError = () => {} } = {}) {
  let stopped = false, running = false, pending = true, timer, lastStarted = -Infinity, retryAt = 0, failures = 0;
  const update = async () => {
    if (stopped || !pending) return;
    if (navigator.onLine === false) { pending = true; return; }
    if (running) { pending = true; return; }
    clearTimeout(timer);
    const delay = Math.max(lastStarted + minimumMs, retryAt) - Date.now();
    if (delay > 0) { timer = setTimeout(update, delay + Math.floor(Math.random() * jitterMs)); return; }
    running = true; pending = false; lastStarted = Date.now();
    try { await download(() => !stopped); retryAt = 0; failures = 0; }
    catch (error) {
      if ([401, 403].includes(error.status)) { stopped = true; }
      else { pending = true; retryAt = Date.now() + Math.max(minimumMs * 2 ** Math.min(failures++, 4), error.retryAfterMs || 0); }
      if (!stopped) onError(error);
    }
    finally { running = false; if (!stopped && pending) void update(); }
  };
  const online = () => { void update(); };
  window.addEventListener('online', online);
  void update();
  return {
    refresh: () => { pending = true; void update(); },
    stop() { stopped = true; clearTimeout(timer); window.removeEventListener('online', online); },
  };
}
