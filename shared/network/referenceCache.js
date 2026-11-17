import { productPhotos } from './productPhotos.js';
// Per authenticated application instance. Never caches credentials, sessions or mutations.
const resourcesFor = path => {
  const route = path.split('?')[0];
  if (route === '/settings') return ['settings'];
  if (route === '/app-config') return ['settings', 'access', 'branding'];
  // Category membership has its own invalidation; stock-only writes do not change it.
  if (route === '/categories') return ['categories'];
  if (route === '/price-types') return ['priceTypes', 'price-types', 'settings'];
  return null;
};
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const caches = new Set();
export function invalidateReferenceData(resources) { for (const cache of caches) cache.invalidate(resources); }

export function createReferenceCache() {
  const entries = new Map();
  let scope = '', generation = 0;
  const clear = () => { generation++; entries.clear(); productPhotos.clear(); };
  const invalidate = resources => {
    if (resources.includes('access')) { clear(); return; }
    for (const [key, entry] of entries) {
      if (resources.includes('*') || entry.resources.some(resource => resources.includes(resource))) entries.delete(key);
    }
  };
  const cache = {
    clear,
    identity(value) { if (scope !== value) { scope = value; clear(); } },
    invalidate,
    mutation(path, method) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
      if (path.startsWith('/auth/')) { clear(); return; }
      const root = path.split('/')[1];
      if (['settings', 'categories', 'price-types'].includes(root)) invalidate([root]);
      if (root === 'products') invalidate(['products', 'categories']);
      if (root === 'price-types') invalidate(['settings']);
      if (['roles', 'staff', 'data'].includes(root)) invalidate(['*']);
    },
    async request(path, options, perform) {
      const method = String(options.method || 'GET').toUpperCase();
      const resources = resourcesFor(path);
      if (!scope || method !== 'GET' || !resources) return perform(options);
      if (options.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
      const key = JSON.stringify([path, options.customerAuth, options.headers || {}]);
      if (options.cache === 'reload' || options.cache === 'no-store') entries.delete(key);
      let entry = entries.get(key);
      if (!entry) {
        const epoch = generation;
        entry = { resources };
        // Subscribers own their cancellation; one page cannot abort another page's read.
        entry.promise = Promise.resolve().then(() => perform({ ...options, signal: undefined })).then(value => {
          if (epoch !== generation) throw new DOMException('Session changed.', 'AbortError');
          // A write/event overtook this response. Reuse the current read instead of
          // allowing an older settings/config response to overwrite the new value.
          if (entries.get(key) !== entry) return cache.request(path, { ...options, signal: undefined, cache: undefined }, perform);
          return clone(value);
        }).catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
        entries.set(key, entry);
      }
      const signal = options.signal;
      let abort;
      try {
        const value = await (signal ? Promise.race([entry.promise, new Promise((_, reject) => {
          abort = () => reject(new DOMException('Request cancelled.', 'AbortError'));
          signal.addEventListener('abort', abort, { once: true });
        })]) : entry.promise);
        return clone(value);
      } finally { if (abort) signal.removeEventListener('abort', abort); }
    },
  };
  caches.add(cache);
  // Session invalidation in another tab also invalidates this tab's private data.
  if (typeof window !== 'undefined') window.addEventListener('storage', event => {
    if (event.key === null || event.key?.startsWith('mkpos.auth-generation:') ||
      ['mkpos.accessToken', 'mkpos.office.accessToken', 'mkpos.shop.customerToken'].includes(event.key)) clear();
  });
  return cache;
}
