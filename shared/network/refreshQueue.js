// Collapse event bursts and serialize reads. A change during a read gets one follow-up.
export function createRefreshQueue(refresh, { delay = 150 } = {}) {
  let timer, running = false, stopped = false;
  const pending = new Set();
  let waiters = [];
  const run = () => {
    clearTimeout(timer); timer = undefined;
    if (stopped || running || !pending.size) return;
    const changed = [...pending], completed = waiters; waiters = [];
    pending.clear(); running = true;
    let result;
    try { result = refresh(changed); } catch { /* The screen owns its error UI. */ }
    return Promise.resolve(result).catch(() => {}).finally(() => {
      running = false;
      completed.forEach(resolve => resolve());
      if (!stopped && pending.size) timer = setTimeout(run, delay);
    });
  };
  return {
    enqueue(resources = ['*'], immediate = false) {
      if (stopped) return;
      resources.forEach(resource => pending.add(resource));
      const completion = new Promise(resolve => waiters.push(resolve));
      if (immediate) run();
      else if (!running && timer === undefined) timer = setTimeout(run, delay);
      return completion;
    },
    stop() { stopped = true; clearTimeout(timer); pending.clear(); waiters.splice(0).forEach(resolve => resolve()); },
  };
}
