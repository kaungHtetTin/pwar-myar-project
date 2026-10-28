import { useEffect, useRef, useState } from 'react';

const KEY = 'mkposShopNavigation';
let navigation = null;
const routeNow = root => window.location.hash.slice(1) || root;
const snapshot = root => ({ route: routeNow(root), url: window.location.href, state: window.history.state, entry: window.history.state?.[KEY] });
const valid = (entry, root) => entry?.root === root && typeof entry.stack === 'string' && typeof entry.key === 'string' && Number.isInteger(entry.index) && entry.index >= 0;
function installRoot(root) {
  const entry = { root, stack: crypto.randomUUID(), key: crypto.randomUUID(), source: null, index: 0, kind: 'base' };
  const state = { ...window.history.state, [KEY]: entry };
  window.history.replaceState(state, '', `#${root}`);
  window.history.pushState({ ...state, [KEY]: { ...entry, kind: 'active' } }, '', `#${root}`);
  return entry;
}
function pageEntry(entry) {
  return { ...entry, key: crypto.randomUUID(), source: entry.key, index: entry.index + 1, kind: 'page' };
}
function initialize(root) {
  const destination = routeNow(root), saved = window.history.state?.[KEY];
  if (!valid(saved, root)) {
    const entry = installRoot(root);
    if (destination !== root) window.history.pushState({ ...window.history.state, [KEY]: pageEntry(entry) }, '', `#${destination}`);
  } else if (saved.kind === 'base') {
    window.history.pushState({ ...window.history.state, [KEY]: { ...saved, kind: 'active' } }, '', `#${root}`);
  }
  return snapshot(root);
}

export function go(path) {
  if (navigation) navigation.go(path);
  else window.location.hash = path;
}
export function goBack(fallback) {
  if (navigation) navigation.back(fallback);
  else { window.location.hash = fallback || '/marketplace'; }
}

/** Home is a browser-history boundary, including when entering through a deep link. */
export function useShopRoute(defaultRoute) {
  const current = useRef(null);
  const [state, setState] = useState(() => {
    current.current = initialize(defaultRoute);
    return { route: current.current.route, key: current.current.entry.key };
  });
  useEffect(() => {
    const root = defaultRoute;
    let traversing = false;
    const remember = () => {
      current.current = snapshot(root);
      const { route, entry } = current.current;
      setState(previous => previous.route === route && previous.key === entry.key ? previous : { route, key: entry.key });
    };
    const update = () => {
      let entry = window.history.state?.[KEY];
      if (!valid(entry, root)) {
        if (routeNow(root) === root) {
          installRoot(root);
        } else {
          // Unhandled hash links still belong to the current app stack.
          entry = pageEntry(current.current.entry);
          window.history.replaceState({ ...window.history.state, [KEY]: entry }, '', window.location.href);
        }
      } else if (entry.stack !== current.current.entry.stack) {
        installRoot(root);
      } else if (entry.kind === 'base') {
        // Re-arm the same-URL boundary without remounting the retained Home page.
        window.history.pushState({ ...window.history.state, [KEY]: { ...entry, kind: 'active' } }, '', `#${root}`);
      }
      traversing = false;
      remember();
    };
    const actions = {
      go(path) {
        if (routeNow(root) === path) return;
        if (path === root) installRoot(root);
        else window.history.pushState({ ...window.history.state, [KEY]: pageEntry(current.current.entry) }, '', `#${path}`);
        remember();
      },
      back(fallback) {
        if (traversing || routeNow(root) === root) return;
        if (current.current.entry.index > 0) { traversing = true; window.history.back(); }
        else actions.go(fallback || root);
      },
    };
    const followLink = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href), here = new URL(window.location.href);
      if (url.origin !== here.origin || url.pathname !== here.pathname || url.search !== here.search || !url.hash.startsWith('#/')) return;
      event.preventDefault(); actions.go(url.hash.slice(1));
    };
    const hardwareBack = event => { event.preventDefault(); actions.back(root); };
    navigation = actions;
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    document.addEventListener('click', followLink);
    document.addEventListener('backbutton', hardwareBack);
    return () => {
      if (navigation === actions) navigation = null;
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      document.removeEventListener('click', followLink);
      document.removeEventListener('backbutton', hardwareBack);
    };
    // The configured Home route is stable for this app session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
