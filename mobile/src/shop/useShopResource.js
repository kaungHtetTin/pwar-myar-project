import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { usePageRefresh } from '../navigation/pageRefresh';

export function useShopResource(path) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const generation = useRef(0);
  const reload = useCallback(async (signal) => {
    const version = ++generation.current;
    if (!path) return;
    try { const result = await apiRequest(path, { signal }); if (!signal?.aborted && version === generation.current) { setData(result); setError(''); } }
    catch (e) { if (!signal?.aborted && version === generation.current) setError(e.message); }
  }, [path]);
  useEffect(() => { const controller = new AbortController(); void reload(controller.signal); return () => controller.abort(); }, [reload]);
  useEffect(() => {
    const orderId = Number(path?.match(/^\/shop-admin\/orders\/(\d+)$/)?.[1]);
    if (!orderId) return undefined;
    let controller;
    const changed = event => {
      if (!event.detail?.orderIds?.includes(orderId)) return;
      controller?.abort(); controller = new AbortController(); void reload(controller.signal);
    };
    window.addEventListener('mkpos:shop-order-changed', changed);
    return () => { controller?.abort(); window.removeEventListener('mkpos:shop-order-changed', changed); };
  }, [path, reload]);
  usePageRefresh(reload, { fallback: true });
  return { data, error, reload, setData };
}
