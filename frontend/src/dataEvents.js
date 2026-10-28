import { useEffect, useRef } from 'react';

const DATA_CHANGE_EVENT = 'mkpos:data-change';
const pendingRefreshes = new Set();

export function consumePendingDataRefresh(source) {
  const pending = pendingRefreshes.has(source);
  pendingRefreshes.delete(source);
  return pending;
}

export function emitDataChange(resources, source = '', target = '') {
  const list = [...new Set((Array.isArray(resources) ? resources : [resources]).filter(Boolean))];
  if (!list.length) return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, {
    detail: { resources: list, source, target },
  }));
}

export function useDataRefresh(resources, source, refresh) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const resourceKey = [...resources].sort().join('|');

  useEffect(() => {
    const expected = new Set(resourceKey.split('|').filter(Boolean));
    function handleDataChange(event) {
      const changed = event.detail?.resources || [];
      if (event.detail?.source === source) return;
      if (event.detail?.target && event.detail.target !== source) return;
      if (!changed.includes('*') && !changed.some((resource) => expected.has(resource))) return;
      const moduleView = document.querySelector(`.module-view[data-module="${source}"]`);
      if (moduleView?.hidden) {
        pendingRefreshes.add(source);
        return;
      }
      try {
        Promise.resolve(refreshRef.current?.(changed)).catch(() => {});
      } catch {
        // Individual screen loaders display their own request errors.
      }
    }
    window.addEventListener(DATA_CHANGE_EVENT, handleDataChange);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, handleDataChange);
  }, [resourceKey, source]);
}
