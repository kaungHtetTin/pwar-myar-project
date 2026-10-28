import { useCallback, useEffect, useRef, useState } from 'react';

function appendUnique(current, incoming, itemKey) {
  const seen = new Set();
  return [...current, ...incoming].filter((item) => {
    const key = typeof itemKey === 'function' ? itemKey(item) : item?.[itemKey];
    if (key === undefined || key === null) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useEndlessList({ loadPage, queryKey, pageSize = 20, itemKey = 'id', enabled = true }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [initialLoading, setInitialLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(enabled);
  const [observerSupported] = useState(() => typeof IntersectionObserver !== 'undefined');
  const loaderRef = useRef(loadPage);
  const itemsRef = useRef([]);
  const offsetRef = useRef(0);
  const totalRef = useRef(null);
  const hasMoreRef = useRef(enabled);
  const loadingRef = useRef(false);
  const generationRef = useRef(0);
  const abortRef = useRef(null);
  const observerRef = useRef(null);
  const refreshFailedRef = useRef(false);

  loaderRef.current = loadPage;

  const requestPage = useCallback(async (reset = false) => {
    if (!enabled || loadingRef.current || (!reset && !hasMoreRef.current)) return false;
    const generation = generationRef.current;
    const offset = reset ? 0 : offsetRef.current;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    loadingRef.current = true;
    if (reset) setInitialLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const response = await loaderRef.current({ limit: pageSize, offset, signal: controller.signal });
      if (controller.signal.aborted || generation !== generationRef.current) return false;
      const incoming = Array.isArray(response) ? response : response?.items || [];
      const knownTotal = Array.isArray(response) || response?.total === undefined ? null : Number(response.total || 0);
      const previous = reset ? [] : itemsRef.current;
      const next = appendUnique(previous, incoming, itemKey);
      const nextOffset = offset + incoming.length;
      const nextHasMore = knownTotal !== null ? next.length < knownTotal : incoming.length >= pageSize;

      itemsRef.current = next;
      offsetRef.current = nextOffset;
      totalRef.current = knownTotal;
      hasMoreRef.current = nextHasMore;
      setItems(next);
      setTotal(knownTotal);
      setHasMore(nextHasMore);
      return true;
    } catch (requestError) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setError(requestError.message || 'Unable to load more items.');
      }
      return false;
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false;
        setInitialLoading(false);
        setLoadingMore(false);
      }
    }
  }, [enabled, itemKey, pageSize]);

  const reload = useCallback(() => {
    refreshFailedRef.current = false;
    generationRef.current += 1;
    abortRef.current?.abort();
    loadingRef.current = false;
    itemsRef.current = [];
    offsetRef.current = 0;
    totalRef.current = null;
    hasMoreRef.current = enabled;
    setItems([]);
    setTotal(null);
    setHasMore(enabled);
    setError('');
    if (!enabled) {
      setInitialLoading(false);
      return Promise.resolve(false);
    }
    return requestPage(true);
  }, [enabled, requestPage]);

  const reconcile = useCallback(async () => {
    if (!enabled || itemsRef.current.length === 0) return reload();
    const targetOffset = offsetRef.current;
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadingRef.current = true;
    setLoadingMore(true);
    setError('');
    let rows = [], offset = 0, knownTotal = null, more = true;
    try {
      while (offset < targetOffset && more) {
        const response = await loaderRef.current({ limit: pageSize, offset, signal: controller.signal });
        if (controller.signal.aborted || generation !== generationRef.current) return false;
        const incoming = Array.isArray(response) ? response : response?.items || [];
        knownTotal = Array.isArray(response) || response?.total === undefined ? null : Number(response.total || 0);
        rows = appendUnique(rows, incoming, itemKey);
        offset += incoming.length;
        more = knownTotal !== null ? offset < knownTotal : incoming.length >= pageSize;
        if (!incoming.length) more = false;
      }
      itemsRef.current = rows; offsetRef.current = offset; totalRef.current = knownTotal; hasMoreRef.current = more;
      setItems(rows); setTotal(knownTotal); setHasMore(more);
      refreshFailedRef.current = false;
      return true;
    } catch (error) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        refreshFailedRef.current = true;
        setError(error.message || 'Unable to refresh items.');
      }
      return false;
    } finally {
      if (generation === generationRef.current) { loadingRef.current = false; setInitialLoading(false); setLoadingMore(false); }
    }
  }, [enabled, itemKey, pageSize, reload]);

  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [queryKey, reload]);

  const sentinelRef = useCallback((node) => {
    observerRef.current?.disconnect();
    if (!node || !observerSupported || !hasMore || initialLoading || loadingMore || error) return;
    observerRef.current = new IntersectionObserver((entries) => {
      if (!node.closest('[hidden]') && entries.some((entry) => entry.isIntersecting)) requestPage(false);
    }, { rootMargin: '240px 0px' });
    observerRef.current.observe(node);
  }, [error, hasMore, initialLoading, loadingMore, observerSupported, requestPage]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    items,
    total,
    initialLoading,
    loadingMore,
    error,
    hasMore,
    observerSupported,
    loadMore: () => requestPage(false),
    retry: () => refreshFailedRef.current ? reconcile() : requestPage(itemsRef.current.length === 0),
    reload: reconcile,
    sentinelRef,
  };
}
