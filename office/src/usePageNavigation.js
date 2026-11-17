import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const KEY = 'mkposPageNavigation';
export function usePageNavigation(scope, initialView, urlForView, options = {}) {
  const entries = useRef(new Map());
  const snapshots = useRef(new Map()), currentKey = useRef(null), optionsRef = useRef(options);
  const [view, setView] = useState(() => options.resumeHistory !== false && window.history.state?.[KEY]?.scope === scope ? window.history.state[KEY].view : initialView);
  const urlRef = useRef(urlForView);
  useLayoutEffect(() => { optionsRef.current = options; urlRef.current = urlForView; });
  useEffect(() => {
    const saved = window.history.state?.[KEY];
    const entry = saved?.scope === scope ? { ...saved, view: optionsRef.current.resumeHistory === false ? initialView : saved.view } : { scope, key: crypto.randomUUID(), view: initialView, source: null };
    entries.current.set(entry.key, entry);
    currentKey.current = entry.key;
    window.history.replaceState({ ...window.history.state, [KEY]: entry }, '', window.location.href);
    const restore = () => {
      const destination = window.history.state?.[KEY];
      if (destination?.scope === scope) {
        if (currentKey.current) snapshots.current.set(currentKey.current, optionsRef.current.capture?.());
        currentKey.current = destination.key;
        entries.current.set(destination.key, destination); setView(destination.view);
        optionsRef.current.restore?.(destination.view, snapshots.current.get(destination.key));
      }
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
    // The initial entry is captured once for this navigation owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const go = useCallback((nextView, replace = false) => {
    const previous = window.history.state?.[KEY];
    if (previous?.scope === scope) snapshots.current.set(previous.key, optionsRef.current.capture?.());
    const entry = { scope, key: replace && previous?.scope === scope ? previous.key : crypto.randomUUID(), view: nextView, source: replace ? previous?.source : previous?.scope === scope ? previous.key : null };
    entries.current.set(entry.key, entry);
    currentKey.current = entry.key;
    window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, [KEY]: entry }, '', urlRef.current(nextView));
    setView(nextView);
  }, [scope]);
  const back = useCallback((fallback) => {
    const current = window.history.state?.[KEY];
    if (current?.scope === scope && current.source && entries.current.has(current.source)) window.history.back();
    else { go(fallback, true); optionsRef.current.restore?.(fallback); }
  }, [scope, go]);
  return { view, go, back };
}
