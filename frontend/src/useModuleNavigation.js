import { useCallback, useEffect, useRef } from 'react';

export const MODULE_HISTORY_KEY = 'mkposDesktopNavigation';
const PAGE_KEY = 'mkposPageNavigation';

export function useModuleNavigation({ identity, active, ready, enabled, onRestore }) {
  const sources = useRef(new Map());
  const latest = useRef({ identity, active, enabled, onRestore });
  latest.current = { identity, active, enabled, onRestore };

  useEffect(() => {
    if (!ready) return undefined;
    const saved = window.history.state?.[MODULE_HISTORY_KEY];
    const entry = saved?.identity === identity ? { ...saved, module: active } : { identity, module: active, index: 0 };
    window.history.replaceState({ ...window.history.state, [MODULE_HISTORY_KEY]: entry }, '', window.location.href);
    const restore = () => {
      const next = window.history.state?.[MODULE_HISTORY_KEY];
      const owner = latest.current;
      if (next?.identity === owner.identity && owner.enabled.includes(next.module)) owner.onRestore(next.module);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
    // Initialize once per authenticated navigation owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, ready]);

  const visit = useCallback((module, pageTarget = null, { reset = false, source = null, pageLink = null, purchaseDraftId = null } = {}) => {
    const owner = latest.current;
    const assistantSource = source === 'assistant' && owner.enabled.includes('assistant');
    if (reset) {
      sources.current.delete(module);
      const state = { ...window.history.state, [MODULE_HISTORY_KEY]: { identity: owner.identity, module, index: 0 } };
      delete state[PAGE_KEY];
      const url = new URL(window.location.href);
      ['shopOrder', 'shopCustomer', 'shopTab', 'shopTopup'].forEach(key => url.searchParams.delete(key));
      if (url.searchParams.get('page') === 'assistant') url.searchParams.delete('page');
      window.history.replaceState(state, '', url.href);
      return;
    }
    if (module === owner.active && !pageTarget && !assistantSource && !pageLink) return;
    if (pageTarget && module === owner.active && JSON.stringify(window.history.state?.[PAGE_KEY]?.view) === JSON.stringify(pageTarget.view)) return;
    window.dispatchEvent(new CustomEvent('mkpos:capture-page-source'));
    sources.current.set(owner.active, { page: window.history.state?.[PAGE_KEY], url: window.location.href, aiPage: window.history.state?.mkposAiPageLink });
    if (assistantSource && owner.active !== 'assistant') {
      const previous = window.history.state?.[MODULE_HISTORY_KEY];
      const assistantUrl = new URL(window.location.href);
      assistantUrl.searchParams.set('page', 'assistant');
      const assistantState = { ...window.history.state, [MODULE_HISTORY_KEY]: { identity: owner.identity, module: 'assistant', index: (previous?.index || 0) + 1, sourceModule: owner.active } };
      delete assistantState[PAGE_KEY];
      delete assistantState.mkposAiPageLink;
      window.history.pushState(assistantState, '', assistantUrl.href);
      sources.current.set('assistant', { url: assistantUrl.href });
    }
    const destination = sources.current.get(module);
    const previous = window.history.state?.[MODULE_HISTORY_KEY];
    const state = { ...window.history.state, [MODULE_HISTORY_KEY]: { identity: owner.identity, module, index: (previous?.identity === owner.identity ? previous.index : 0) + 1, sourceModule: assistantSource ? 'assistant' : owner.active } };
    if (pageLink) state.mkposAiPageLink = { id: pageLink, module, key: crypto.randomUUID(), purchaseDraftId: pageLink === 'purchases_new' && /^[a-f0-9-]{36}$/i.test(purchaseDraftId || '') ? purchaseDraftId : null };
    else if (destination?.aiPage) state.mkposAiPageLink = destination.aiPage;
    else delete state.mkposAiPageLink;
    if (destination?.page) state[PAGE_KEY] = destination.page;
    else delete state[PAGE_KEY];
    if (pageLink) delete state[PAGE_KEY];
    let url = destination?.url || (() => {
      const next = new URL(window.location.href);
      ['shopOrder', 'shopCustomer', 'shopTab', 'shopTopup'].forEach((key) => next.searchParams.delete(key));
      return next.href;
    })();
    if (pageTarget) {
      state[PAGE_KEY] = { ...pageTarget, key: crypto.randomUUID(), source: module === owner.active ? window.history.state?.[PAGE_KEY]?.key : null };
      const next = new URL(url);
      ['shopOrder', 'shopCustomer', 'shopTopup'].forEach(key => next.searchParams.delete(key));
      next.searchParams.set('shopTab', pageTarget.view.tab);
      if (pageTarget.view.id) next.searchParams.set('shopOrder', pageTarget.view.id);
      if (pageTarget.view.topupId) next.searchParams.set('shopTopup', pageTarget.view.topupId);
      if (pageTarget.view.customerKey) next.searchParams.set('shopCustomer', pageTarget.view.customerKey);
      url = next.href;
    }
    const targetUrl = new URL(url);
    if (module === 'assistant') targetUrl.searchParams.set('page', 'assistant');
    else if (targetUrl.searchParams.get('page') === 'assistant') targetUrl.searchParams.delete('page');
    window.history.pushState(state, '', targetUrl.href);
    if (pageTarget || pageLink) window.dispatchEvent(new PopStateEvent('popstate', { state }));
  }, []);
  return visit;
}
