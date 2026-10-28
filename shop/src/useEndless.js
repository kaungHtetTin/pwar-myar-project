import { useShopRefresh } from './pageRefresh';
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";

export function useEndless(path, apiRequest = request) {
  const [state, setState] = useState({
    path,
    items: [],
    busy: true,
    error: "",
    more: true,
  });
  const cursor = useRef(0),
    generation = useRef(0),
    busy = useRef(false),
    sentinel = useRef(null);
  const queued = useRef(false), revalidateRef = useRef(null), refreshFailed = useRef(false);
  const load = useCallback(
    async (reset = false) => {
      if (busy.current && !reset) return;
      if (reset) {
        refreshFailed.current = false;
        generation.current++;
        cursor.current = 0;
      }
      const version = generation.current;
      busy.current = true;
      setState((s) => ({
        ...s,
        ...(reset ? { items: [], path } : {}),
        busy: true,
        error: "",
      }));
      try {
        const data = await apiRequest(
          `${path}${path.includes("?") ? "&" : "?"}offset=${cursor.current}&limit=24`,
        );
        if (version !== generation.current) return;
        const { items, ...meta } = data;
        cursor.current += data.items.length;
        setState((s) => ({
          path,
          items: [...new Map([...(reset ? [] : s.items), ...data.items].map(item => [
            item.favorite_id ?? item.alert_id ?? item.uuid ?? item.reference ?? item.id ?? item.slug,
            item,
          ])).values()],
          busy: false,
          error: "",
          more: data.has_more,
          meta,
        }));
      } catch (e) {
        if (version === generation.current)
          setState((s) => ({ ...s, busy: false, error: e.message }));
      } finally {
        if (version === generation.current) {
          busy.current = false;
          if (queued.current) { queued.current = false; void revalidateRef.current(); }
        }
      }
    },
    [path, apiRequest],
  );
  const revalidate = useCallback(async () => {
    if (busy.current) { queued.current = true; return; }
    const version = generation.current, target = Math.max(24, cursor.current);
    busy.current = true;
    try {
      let rows = [], offset = 0, data;
      do {
        data = await apiRequest(`${path}${path.includes('?') ? '&' : '?'}offset=${offset}&limit=24`);
        if (version !== generation.current) return;
        rows.push(...data.items); offset += data.items.length;
      } while (offset < target && data.has_more && data.items.length);
      const { items: ignored, ...meta } = data;
      cursor.current = offset;
      refreshFailed.current = false;
      setState({ path, items: [...new Map(rows.map(item => [item.favorite_id ?? item.alert_id ?? item.uuid ?? item.reference ?? item.id ?? item.slug, item])).values()], busy: false, error: '', more: data.has_more, meta });
    } catch (error) {
      if (version === generation.current) {
        refreshFailed.current = true;
        setState(current => ({ ...current, error: error.message }));
      }
    } finally {
      if (version === generation.current) {
        busy.current = false;
        if (queued.current) { queued.current = false; void revalidateRef.current(); }
      }
    }
  }, [path, apiRequest]);
  revalidateRef.current = revalidate;
  useEffect(() => {
    load(true);
    const version = generation.current;
    return () => {
      generation.current = version + 1;
      busy.current = false;
      queued.current = false;
    };
  }, [load]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !sentinel.current || state.busy || state.error || !state.more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!sentinel.current?.closest('[hidden]') && entries[0].isIntersecting) load();
      },
      { rootMargin: "250px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [load, state.busy, state.error, state.more]);
  const reconcile = useCallback((operation, { cursorDelta = 0 } = {}) => { cursor.current = Math.max(0, cursor.current + cursorDelta); setState(current => ({ ...current, items: operation(current.items) })); }, []);
  useShopRefresh(() => load(true));
  const visible = state.path === path ? state : { path, items: [], busy: true, error: '', more: true };
  return { ...visible, sentinel, retry: () => refreshFailed.current ? revalidate() : load(), refresh: () => load(true), reconcile, revalidate };
}
