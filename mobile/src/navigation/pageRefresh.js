import { createContext, useContext, useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!active || !register || !refreshRef.current) return undefined;
    return register(() => refreshRef.current?.(), { fallback });
  }, [active, enabled, fallback, register]);

  useEffect(() => {
    if (!isReadOnlyRoute(path) || !reconcileEnabled) return undefined;
    const module = path.split('/')[1];
    const reconcile = (event) => {
      if (!event.detail?.modules?.some((item) => item === '*' || item === module)) return;
      Promise.resolve().then(() => reconcileRef.current?.()).catch(() => undefined);
    };
    window.addEventListener(DATA_CHANGED_EVENT, reconcile);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reconcile);
  }, [reconcileEnabled, path]);
}
