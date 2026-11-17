import { shareBackgroundFeed } from './backgroundTabs.js';

// Delivery reconciliation is read-only, including after a lost submit response.
export function monitorAssistantDelivery(api, path, scope, receive) {
  return shareBackgroundFeed(scope ? `ai-delivery:${scope}:${path}` : null, emit => {
    let stopped = false, terminal = false, timer, controller, inFlight = false, retryAt = 0, failures = 0, pendingWake = false, lastAttempt = -Infinity;
    let expedited = false, lastWake = -Infinity, networkFailure = false;
    const poll = async () => {
      if (stopped || terminal || inFlight || document.hidden || navigator.onLine === false) return;
      const nextAttempt = Math.max(retryAt, expedited ? 0 : lastAttempt + 2000);
      if (Date.now() < nextAttempt) { timer = setTimeout(poll, nextAttempt - Date.now()); return; }
      inFlight = true; pendingWake = false; expedited = false; lastAttempt = Date.now(); controller = new AbortController();
      try {
        const receipt = await api(path, { signal: controller.signal, timeoutMs: 10000 });
        if (stopped) return;
        failures = 0; retryAt = 0; networkFailure = false;
        terminal = receipt.status === 'completed' || receipt.status === 'failed';
        emit({ receipt });
        if (terminal) return;
      } catch (error) {
        if (stopped) return;
        if ([401, 403, 404].includes(error.status)) {
          terminal = true;
          emit({ denied: { status: error.status, message: error.message } }); return;
        }
        networkFailure = !error.status && !error.retryAfterMs;
        const delay = error.status === 429 ? (error.retryAfterMs || 60000) : Math.max(error.retryAfterMs || 0, Math.min(60000, 2000 * 2 ** Math.min(failures++, 5)));
        retryAt = Math.max(retryAt, Date.now() + delay);
      } finally { inFlight = false; controller = undefined; }
      if (!stopped && pendingWake) {
        pendingWake = false;
        timer = setTimeout(poll, Math.max(0, retryAt - Date.now()));
      }
    };
    // Resume/change events must not reset Retry-After or resurrect a finished run.
    const wake = event => {
      if (stopped || terminal) return;
      if (event.type === 'visibilitychange' && !pendingWake) return;
      pendingWake = true;
      if (document.hidden) return;
      // A real reconnect can recover a transport failure, but never bypass a server cooldown.
      if (event.type === 'online' && networkFailure) retryAt = 0;
      if (event.type !== 'visibilitychange' && Date.now() - lastWake >= 2000) {
        expedited = true; lastWake = Date.now();
      }
      if (inFlight) { pendingWake = true; } else { clearTimeout(timer); void poll(); }
    };
    void poll();
    window.addEventListener('mkpos:assistant-delivery-changed', wake);
    window.addEventListener('online', wake);
    window.addEventListener('mkpos:realtime-connected', wake);
    document.addEventListener('visibilitychange', wake);
    const stop = () => {
      stopped = true; clearTimeout(timer); controller?.abort();
      window.removeEventListener('mkpos:assistant-delivery-changed', wake);
      window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('mkpos:realtime-connected', wake);
    };
    stop.refresh = () => wake({ type: 'mkpos:assistant-delivery-changed' });
    return stop;
  }, receive, { refreshEvents: ['mkpos:assistant-delivery-changed'] });
}
