export function registerPwa() {
  if (!('serviceWorker' in navigator) || window.Capacitor?.isNativePlatform?.()) return;

  if (import.meta.env.DEV) {
    // Retire an earlier PwarMyar worker so stale source files cannot break Vite imports.
    const base = new URL(import.meta.env.BASE_URL, window.location.href);
    const workerUrl = new URL('service-worker.js', base).href;
    void navigator.serviceWorker.getRegistration(base.href).then(async registration => {
      const worker = registration?.active || registration?.waiting || registration?.installing;
      if (worker?.scriptURL !== workerUrl) return;
      await registration.unregister();
      const names = await window.caches.keys();
      await Promise.all(names.filter(name => name.startsWith('mkpos-mobile-shell-')).map(name => window.caches.delete(name)));
    }).catch(error => console.warn('PwarMyar development cache cleanup failed.', error));
    return;
  }

  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('PwarMyar service worker registration failed.', error));
  });
}
