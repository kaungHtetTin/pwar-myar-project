import { shareBackgroundFeed } from './backgroundTabs.js';
import { resourceRealtimeLive } from './resourceRealtime.js';

// Delivery reconciliation is read-only, including after a lost submit response.
export function monitorAssistantDelivery(api, path, scope, receive) {
  return shareBackgroundFeed(scope ? `ai-delivery:${scope}:${path}` : null, emit => {
    let stopped = false, timer, controller, inFlight = false, retryAt = 0, failures = 0, rateLimited = false, pendingWake = false;
    const poll = async () => {
      if (stopped || inFlight || document.hidden || navigator.onLine === false) return;
      if (Date.now() < retryAt) { timer = setTimeout(poll, retryAt - Date.now()); return; }
      inFlight = true; controller = new AbortController();
      try {
        const receipt = await api(path, { signal: controller.signal, timeoutMs: 10000 });
        if (stopped) return;
        failures = 0; rateLimited = false;
        emit({ receipt });
        if (receipt.status === 'completed' || receipt.status === 'failed') return;
      } catch (error) {
        if (stopped) return;
        if ([401, 403, 404].includes(error.status)) {
          emit({ denied: { status: error.status, message: error.message } }); return;
        }
        rateLimited = error.status === 429;
        const delay = rateLimited ? (error.retryAfterMs || 60000) : Math.min(60000, 2000 * 2 ** Math.min(failures++, 5));
        retryAt = Math.max(retryAt, Date.now() + delay);
      } finally { inFlight = false; controller = undefined; }
      if (!stopped) {
        const interval = pendingWake && !rateLimited ? 0 : (resourceRealtimeLive() ? 15000 : 2000);
        pendingWake = false;
        timer = setTimeout(poll, Math.max(interval, retryAt - Date.now()));
      }
    };
    const wake = () => { if (!rateLimited) retryAt = 0; if (inFlight) { pendingWake = true; } else { clearTimeout(timer); void poll(); } };
    void poll();
    window.addEventListener('mkpos:assistant-delivery-changed', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true; clearTimeout(timer); controller?.abort();
      window.removeEventListener('mkpos:assistant-delivery-changed', wake);
      window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake);
    };
  }, receive);
}
