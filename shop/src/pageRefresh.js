import { createContext, useContext, useEffect, useRef } from 'react';
import { useShopPageActive } from './RetainedViews';

export const ShopRefreshContext = createContext(null);

export function useShopRefresh(refresh, enabled = true) {
  const register = useContext(ShopRefreshContext);
  const active = useShopPageActive();
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!register || !active || !enabled) return undefined;
    return register(() => callback.current());
  }, [register, active, enabled]);
}
