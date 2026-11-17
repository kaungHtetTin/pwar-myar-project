import { flushSync } from 'react-dom';

// Manual refreshes also include reads started by effects after a page revision.
// Track existing requests, without adding polling, delays, or extra API calls.
const operations = new Set();

export function trackRefreshRequest(promise) {
  if (!operations.size) return promise;
  const owners = [...operations];
  owners.forEach(pending => pending.add(promise));
  const settled = () => owners.forEach(pending => pending.delete(promise));
  Promise.resolve(promise).then(settled, settled);
  return promise;
}

export async function runManualRefresh(action) {
  const pending = new Set();
  operations.add(pending);
  let failure;
  try {
    try {
      let result;
      flushSync(() => { result = action?.(); });
      await result;
    } catch (error) { failure = error; }
    // Commit revision updates before deciding whether their reads have finished.
    flushSync(() => {});
    while (pending.size) {
      await Promise.allSettled([...pending]);
      flushSync(() => {});
    }
    if (failure) throw failure;
  } finally { operations.delete(pending); }
}
