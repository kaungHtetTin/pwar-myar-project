// Cache invalidations are sets, so a short bounded window can merge bursts safely.
export function createResourceBatcher(emit, delayMs = 100) {
  const pending = new Map();
  let stopped = false;
  return {
    enqueue(channel, resources) {
      if (stopped) return;
      let batch = pending.get(channel);
      if (!batch) {
        batch = { resources: new Set() };
        pending.set(channel, batch);
        batch.timer = setTimeout(() => {
          pending.delete(channel);
          if (!stopped) emit(channel, { resources: [...batch.resources] });
        }, delayMs);
        batch.timer.unref?.();
      }
      for (const resource of resources) batch.resources.add(resource);
    },
    stop() { stopped = true; for (const batch of pending.values()) clearTimeout(batch.timer); pending.clear(); },
  };
}
