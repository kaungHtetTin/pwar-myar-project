// Retry failed connections only. A healthy socket owns no recovery timer.
export function createSocketRecovery(socket, isActive = () => true) {
  let stopped = false, timer, lastAttempt = -Infinity, nextAttempt = 0, failures = 0;
  const notify = () => queueMicrotask(() => window.dispatchEvent(new Event('mkpos:socket-state')));
  const ready = () => !stopped && isActive() && !socket.connected && !document.hidden && navigator.onLine !== false;
  const schedule = () => {
    clearTimeout(timer);
    if (!ready()) return;
    if (!nextAttempt) {
      const delay = Math.min(300000, 30000 * 2 ** Math.min(Math.max(0, failures - 1), 4));
      nextAttempt = Date.now() + delay + Math.floor(Math.random() * delay * 0.2);
    }
    timer = setTimeout(retry, Math.max(0, nextAttempt - Date.now(), lastAttempt + 30000 - Date.now()));
  };
  const retry = () => {
    if (!ready()) return;
    if (Date.now() < nextAttempt || Date.now() - lastAttempt < 30000) { schedule(); return; }
    clearTimeout(timer); lastAttempt = Date.now(); nextAttempt = 0;
    socket.connect?.();
    schedule();
  };
  const failed = () => { failures++; nextAttempt = 0; schedule(); notify(); };
  const connected = () => { clearTimeout(timer); timer = undefined; failures = 0; nextAttempt = 0; lastAttempt = -Infinity; notify(); };
  const resume = () => { if (ready()) retry(); else { clearTimeout(timer); timer = undefined; } };
  socket.on?.('connect', connected);
  socket.on?.('connect_error', failed);
  const disconnected = () => { schedule(); notify(); };
  socket.on?.('disconnect', disconnected);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  document.addEventListener('visibilitychange', resume);
  return {
    retry,
    stop() {
      stopped = true; clearTimeout(timer);
      socket.off?.('connect', connected); socket.off?.('connect_error', failed); socket.off?.('disconnect', disconnected);
      window.removeEventListener('online', resume); window.removeEventListener('offline', resume); document.removeEventListener('visibilitychange', resume);
    },
  };
}
