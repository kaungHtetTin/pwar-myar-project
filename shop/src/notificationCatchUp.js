// Keep every recovery page quiet, even when a backlog takes multiple polls.
export function trackNotificationCatchUp() {
  let catchingUp = true, generation = 0;
  let recoveryId = crypto.randomUUID();
  const mark = () => { if (!catchingUp) recoveryId = crypto.randomUUID(); catchingUp = true; generation++; };
  const visibility = () => { if (document.hidden) mark(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('offline', mark);
  window.addEventListener('online', mark);
  return {
    mark,
    snapshot: () => ({ catchUp: catchingUp, recoveryId, generation }),
    settled(snapshot, more) {
      if (!more && snapshot.generation === generation && !document.hidden && navigator.onLine !== false) catchingUp = false;
    },
    stop() {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('offline', mark);
      window.removeEventListener('online', mark);
    },
  };
}
