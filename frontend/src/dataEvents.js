import { useEffect, useRef } from 'react';
import { invalidateReferenceData } from '../../shared/network/referenceCache.js';
import { createRefreshQueue } from '../../shared/network/refreshQueue.js';
import { useRetainedActivity } from './components/retainedActivity';

const DATA_CHANGE_EVENT = 'mkpos:data-change';
const pendingRefreshes = new Map();

export function consumePendingDataRefresh(source) {
  const pending = pendingRefreshes.has(source);
  pendingRefreshes.delete(source);
  return pending;
}

export function consumePendingDataResources(source) {
  const resources = pendingRefreshes.get(source);
  pendingRefreshes.delete(source);
  return resources ? [...resources] : [];
}

export function emitDataChange(resources, source = '', target = '') {
  const list = [...new Set((Array.isArray(resources) ? resources : [resources]).filter(Boolean))];
  if (!list.length) return;
  invalidateReferenceData(list);
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, {
    detail: { resources: list, source, target },
  }));
}

export function requestRefreshEvent(name, detail = {}) {
  const tasks = [];
  window.dispatchEvent(new CustomEvent(name, {
    detail: { ...detail, waitUntil: task => tasks.push(Promise.resolve(task)) },
  }));
  return Promise.allSettled(tasks);
}

export function requestDataRefresh(resources = ['*'], source = 'navigation', target = '') {
  const list = [...new Set((Array.isArray(resources) ? resources : [resources]).filter(Boolean))];
  invalidateReferenceData(list);
  return requestRefreshEvent(DATA_CHANGE_EVENT, { resources: list, source, target });
}

export function useDataRefresh(resources, source, refresh) {
  const active = useRetainedActivity();
  const activeRef = useRef(active), nestedPending = useRef(new Set());
  activeRef.current = active;
  const queueRef = useRef(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const resourceKey = [...resources].sort().join('|');

  useEffect(() => {
    const expected = new Set(resourceKey.split('|').filter(Boolean));
    const queue = createRefreshQueue(changed => {
      const moduleView = document.querySelector(`.module-view[data-module="${source}"]`);
      if (moduleView?.hidden) {
        const pending = pendingRefreshes.get(source) || new Set();
        changed.forEach(resource => pending.add(resource));
        pendingRefreshes.set(source, pending);
        return;
      }
      if (!activeRef.current) { changed.forEach(resource => nestedPending.current.add(resource)); return; }
      return refreshRef.current?.(changed);
    });
    queueRef.current = queue;
    function handleDataChange(event) {
      const changed = event.detail?.resources || [];
      if (event.detail?.source === source) return;
      if (event.detail?.target && event.detail.target !== source) return;
      if (!changed.includes('*') && !changed.some((resource) => expected.has(resource))) return;
      const moduleView = document.querySelector(`.module-view[data-module="${source}"]`);
      if (moduleView?.hidden) {
        const pending = pendingRefreshes.get(source) || new Set();
        changed.forEach(resource => pending.add(resource));
        pendingRefreshes.set(source, pending);
        return;
      }
      if (!activeRef.current) { changed.forEach(resource => nestedPending.current.add(resource)); return; }
      try {
        const completion = queue.enqueue(changed);
        event.detail?.waitUntil?.(completion);
      } catch {
        // Individual screen loaders display their own request errors.
      }
    }
    window.addEventListener(DATA_CHANGE_EVENT, handleDataChange);
    return () => { queue.stop(); queueRef.current = null; window.removeEventListener(DATA_CHANGE_EVENT, handleDataChange); };
  }, [resourceKey, source]);

  useEffect(() => {
    if (!active || !nestedPending.current.size) return;
    const changed = [...nestedPending.current]; nestedPending.current.clear();
    queueRef.current?.enqueue(changed, true);
  }, [active]);
}
