import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'mkposPageNavigation';
export function usePageNavigation(scope, initialView, urlForView, options = {}) {
  const entries = useRef(new Map());
  const initialEntry = useRef(null);
  const snapshots = useRef(new Map()), currentKey = useRef(null), optionsRef = useRef(options);
  optionsRef.current = options;
  const [view, setView] = useState(() => options.resumeHistory !== false && window.history.state?.[KEY]?.scope === scope ? window.history.state[KEY].view : initialView);
  const urlRef = useRef(urlForView); urlRef.current = urlForView;
  useEffect(() => {
    const saved = window.history.state?.[KEY];
    const entry = saved?.scope === scope ? { ...saved, view: optionsRef.current.resumeHistory === false ? initialView : saved.view } : { scope, key: crypto.randomUUID(), view: initialView, source: null };
    entries.current.set(entry.key, entry);
    initialEntry.current = entry;
    currentKey.current = entry.key;
    window.history.replaceState({ ...window.history.state, [KEY]: entry }, '', window.location.href);
    const restore = () => {
      let destination = window.history.state?.[KEY];
      if (!destination && optionsRef.current.module && optionsRef.current.module === window.history.state?.mkposDesktopNavigation?.module) {
        destination = initialEntry.current;
        window.history.replaceState({ ...window.history.state, [KEY]: destination }, '', window.location.href);
      }
      if (destination?.scope === scope) {
        if (currentKey.current) snapshots.current.set(currentKey.current, optionsRef.current.capture?.());
        currentKey.current = destination.key;
        entries.current.set(destination.key, destination); setView(destination.view);
        optionsRef.current.restore?.(destination.view, snapshots.current.get(destination.key));
      }
    };
    window.addEventListener('popstate', restore);
    const captureSource = () => { if (currentKey.current) snapshots.current.set(currentKey.current, optionsRef.current.capture?.()); };
    window.addEventListener('mkpos:capture-page-source', captureSource);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('mkpos:capture-page-source', captureSource); };
    // The initial entry is captured once for this navigation owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const go = useCallback((nextView, replace = false) => {
    const previous = window.history.state?.[KEY];
    if (previous?.scope === scope) snapshots.current.set(previous.key, optionsRef.current.capture?.());
    const entry = { scope, key: replace && previous?.scope === scope ? previous.key : crypto.randomUUID(), view: nextView, source: replace ? previous?.source : previous?.scope === scope ? previous.key : null };
    entries.current.set(entry.key, entry);
    currentKey.current = entry.key;
    const state = { ...window.history.state, [KEY]: entry };
    if (!replace && state.mkposDesktopNavigation) state.mkposDesktopNavigation = { ...state.mkposDesktopNavigation, index: state.mkposDesktopNavigation.index + 1, sourceModule: state.mkposDesktopNavigation.module };
    window.history[replace ? 'replaceState' : 'pushState'](state, '', urlRef.current(nextView));
    setView(nextView);
  }, [scope]);
  const back = useCallback((fallback) => {
    const current = window.history.state?.[KEY];
    if (window.history.state?.mkposDesktopNavigation?.index > 0 || (current?.scope === scope && current.source && entries.current.has(current.source))) window.history.back();
    else { go(fallback, true); optionsRef.current.restore?.(fallback); }
  }, [scope, go]);
  return { view, go, back };
}
