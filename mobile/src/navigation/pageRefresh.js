import { createContext, useContext, useEffect, useRef } from 'react';
import { createRefreshQueue } from '../../../shared/network/refreshQueue.js';
import { DATA_CHANGED_EVENT, isReadOnlyRoute } from './dataChanges';

export const PageActivityContext = createContext(true);
export const PageRouteContext = createContext('');

export const RefreshRegistrationContext = createContext(null);

export function usePageRefresh(refreshPage, options = {}) {
  const register = useContext(RefreshRegistrationContext);
  const active = useContext(PageActivityContext);
  const route = useContext(PageRouteContext);
  const path = options.dataPath || route;
  const refreshRef = useRef(refreshPage);
  const reconcileRef = useRef(options.reconcilePage || refreshPage);
  const enabled = Boolean(refreshPage);
  const fallback = Boolean(options.fallback);
  refreshRef.current = refreshPage;
  reconcileRef.current = options.reconcilePage || refreshPage;
  const reconcileEnabled = Boolean(options.reconcilePage || refreshPage);
  const visible = useRef(active), dirty = useRef(false), queueRef = useRef(null);
  visible.current = active;

  useEffect(() => {
    const queue = createRefreshQueue(changed => {
      if (!visible.current) { dirty.current = true; return; }
      return changed.includes('manual') ? refreshRef.current?.() : reconcileRef.current?.();
    });
    queueRef.current = queue;
    return () => { queue.stop(); queueRef.current = null; };
  }, []);

  useEffect(() => {
    if (!active || !dirty.current) return;
    dirty.current = false;
    queueRef.current?.enqueue(['data'], true);
  }, [active]);

  useEffect(() => {
    if (!active || !register || !refreshRef.current) return undefined;
    return register(() => queueRef.current?.enqueue(['manual'], true), { fallback });
  }, [active, enabled, fallback, register]);

  useEffect(() => {
    if (!isReadOnlyRoute(path) || !reconcileEnabled) return undefined;
    const module = path.split('/')[1];
    const reconcile = (event) => {
      if (!event.detail?.modules?.some((item) => item === '*' || item === module)) return;
      if (!visible.current) { dirty.current = true; return; }
      queueRef.current?.enqueue(['data']);
    };
    window.addEventListener(DATA_CHANGED_EVENT, reconcile);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reconcile);
  }, [reconcileEnabled, path]);
}
