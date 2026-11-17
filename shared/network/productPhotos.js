// Private, memory-only cache. Each SPA bundle owns its own instance.
export function createProductPhotoCache({ concurrency = 3, minStartInterval = 100, maxEntries = 120, maxBytes = 8 * 1024 * 1024 } = {}) {
  const entries = new Map(), queue = [];
  let running = 0, bytes = 0, generation = 0;
  let nextStart = 0, timer;
  const cancelled = () => new DOMException('Photo session changed.', 'AbortError');
  const trim = () => {
    for (const [key, entry] of entries) {
      if (entries.size <= maxEntries && bytes <= maxBytes) break;
      if (entry.size === undefined) continue;
      entries.delete(key); bytes -= entry.size;
    }
  };
  const pump = () => {
    while (running < concurrency && queue.length) {
      const wait = nextStart - Date.now();
      if (wait > 0) {
        if (timer === undefined) timer = setTimeout(() => { timer = undefined; pump(); }, wait);
        return;
      }
      const job = queue.shift();
      if (job.generation !== generation) { job.reject(cancelled()); continue; }
      running++;
      nextStart = Date.now() + minStartInterval;
      Promise.resolve().then(() => {
        if (job.generation !== generation) throw cancelled();
        return job.load();
      }).then(blob => {
        if (job.generation !== generation) throw cancelled();
        job.entry.size = blob.size; bytes += blob.size; trim(); job.resolve(blob);
      }).catch(error => {
        if (entries.get(job.key) === job.entry) entries.delete(job.key);
        job.reject(error);
      }).finally(() => { running--; pump(); });
    }
  };
  return {
    get(key, load) {
      const cached = entries.get(key);
      if (cached) { entries.delete(key); entries.set(key, cached); return cached.promise; }
      const entry = {};
      entry.promise = new Promise((resolve, reject) => queue.push({ key, entry, load, resolve, reject, generation }));
      entries.set(key, entry); pump();
      return entry.promise;
    },
    clear() {
      generation++; entries.clear(); bytes = 0;
      clearTimeout(timer); timer = undefined; nextStart = 0;
      for (const job of queue.splice(0)) job.reject(cancelled());
    },
  };
}

export const productPhotos = createProductPhotoCache();

// Observe before fetching: loading="lazy" on a blob URL cannot defer the API call.
export function observePhoto(element, eager, load) {
  if (eager || typeof IntersectionObserver === 'undefined') { load(); return () => {}; }
  let active = true;
  const observer = new IntersectionObserver(entries => {
    if (active && entries.some(entry => entry.isIntersecting)) { active = false; observer.disconnect(); load(); }
  }, { rootMargin: '150px' });
  observer.observe(element);
  return () => { active = false; observer.disconnect(); };
}
