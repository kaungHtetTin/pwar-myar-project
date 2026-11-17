import { useEffect, useRef } from 'react';
import pages from './app-pages.json';

/** Apply one approved destination on initial mount or history activation. */
export function useAiPageLink(module, onOpen, ready = true) {
  const handler = useRef(onOpen), last = useRef(null);
  handler.current = onOpen;
  useEffect(() => {
    if (!ready) return undefined;
    const activate = () => {
      const target = window.history.state?.mkposAiPageLink;
      if (!target || target.module !== module || window.history.state?.mkposDesktopNavigation?.module !== module) { last.current = null; return; }
      if (!Object.hasOwn(pages, target.id) || pages[target.id].module !== module || target.key === last.current) return;
      last.current = target.key;
      handler.current({...pages[target.id], purchaseDraftId: target.purchaseDraftId || null});
    };
    activate();
    window.addEventListener('popstate', activate);
    return () => window.removeEventListener('popstate', activate);
  }, [module, ready]);
}

export function returnFromAiPage(id) {
  if (window.history.state?.mkposAiPageLink?.id === id && window.history.state?.mkposDesktopNavigation?.sourceModule === 'assistant') {
    const state = { ...window.history.state };
    delete state.mkposAiPageLink;
    window.history.replaceState(state, '', window.location.href);
    window.history.back();
  }
}
