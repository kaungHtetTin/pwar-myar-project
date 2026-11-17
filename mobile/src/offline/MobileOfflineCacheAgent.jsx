import { useEffect, useRef } from 'react';
import { startOfflineCacheRefresh } from '../../../shared/network/offlineCacheRefresh.js';
import { DATA_CHANGED_EVENT } from '../navigation/dataChanges';
import { refreshMobileOfflineCache } from './offlineSales';
import { clearOfflineSession } from './offlineStore';
import { shareBackgroundFeed } from '../../../shared/network/backgroundTabs.js';

export function MobileOfflineCacheAgent({ session, appConfig, enabled = true }) {
  const current = useRef({ session, appConfig });
  current.current = { session, appConfig };
  const userId = session?.user?.id, businessId = session?.business?.id;
  const authorization = JSON.stringify([session?.permissions, appConfig?.permissions, session?.subscription]);
  useEffect(() => {
    if (!enabled || !userId || !businessId) return;
    const state = current.current;
    if (!(state.appConfig?.permissions || state.session.permissions || []).includes('sell') || !state.session.subscription?.is_valid) {
      void clearOfflineSession().catch(() => {});
      return;
    }
    const refreshEvent = `mkpos:offline-cache-dirty:${userId}:${businessId}`;
    const stopShared = shareBackgroundFeed(`offline-cache:${userId}:${businessId}`, () => {
      const worker = startOfflineCacheRefresh(isCurrent => refreshMobileOfflineCache(current.current.session, current.current.appConfig, { isCurrent }));
      window.addEventListener(refreshEvent, worker.refresh);
      const stop = () => { worker.stop(); window.removeEventListener(refreshEvent, worker.refresh); };
      stop.refresh = worker.refresh;
      return stop;
    }, () => {}, { refreshEvents: [refreshEvent], keepAliveWhileHidden: true });
    const changed = event => {
      if (event.detail?.modules?.some(module => ['*', 'sell', 'products', 'settings', 'sales', 'access'].includes(module))) window.dispatchEvent(new Event(refreshEvent));
    };
    window.addEventListener(DATA_CHANGED_EVENT, changed);
    return () => { stopShared(); window.removeEventListener(DATA_CHANGED_EVENT, changed); };
  }, [enabled, userId, businessId, authorization]);
  return null;
}
