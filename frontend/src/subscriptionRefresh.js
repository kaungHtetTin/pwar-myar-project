export function registerSubscriptionRefresh(refresh) {
  let refreshing = false;
  const run = () => {
    if (refreshing) return;
    refreshing = true;
    Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => { refreshing = false; });
  };
  const resume = () => { if (document.visibilityState === 'visible') run(); };

  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', resume);

  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', resume);
  };
}
