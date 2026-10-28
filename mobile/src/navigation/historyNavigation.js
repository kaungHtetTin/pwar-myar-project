import { routePathFromLocation } from './routeBase';

const HISTORY_INDEX_KEY = 'mkposHistoryIndex';

export function historyIndex(state = window.history.state) {
  const value = state?.[HISTORY_INDEX_KEY];
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function ensureHistoryEntry() {
  if (Number.isInteger(window.history.state?.[HISTORY_INDEX_KEY])) return;
  window.history.replaceState({ ...(window.history.state || {}), [HISTORY_INDEX_KEY]: 0 }, '', window.location.href);
}

export function nextHistoryState() {
  return { ...(window.history.state || {}), mkposRootEntry: 'page', [HISTORY_INDEX_KEY]: historyIndex() + 1, mkposHistorySourcePath: routePathFromLocation(window.location.pathname) };
}

export function backSourcePath(fallbackPath) {
  const source = window.history.state?.mkposHistorySourcePath;
  return hasInAppBackEntry() && typeof source === 'string' && source.startsWith('/') ? source : fallbackPath;
}

export function isParentReturn(sourcePath, destinationPath) {
  const source = sourcePath.split('?')[0].replace(/\/$/, '');
  const destination = destinationPath.split('?')[0].replace(/\/$/, '');
  return Boolean(destination && source.startsWith(`${destination}/`));
}

export function replacementHistoryState() {
  return { ...(window.history.state || {}), [HISTORY_INDEX_KEY]: historyIndex() };
}

export function hasInAppBackEntry() {
  return historyIndex() > 0;
}

export function clearNavigationRoot() {
  const state = { ...(window.history.state || {}), [HISTORY_INDEX_KEY]: 0 };
  delete state.mkposRootPath;
  delete state.mkposRootIdentity;
  delete state.mkposRootEntry;
  delete state.mkposRootStack;
  delete state.mkposHistorySourcePath;
  window.history.replaceState(state, '', window.location.href);
}

export function rootHistoryState(root, identity, entry = 'active') {
  const state = { ...(window.history.state || {}), [HISTORY_INDEX_KEY]: 0, mkposRootPath: root, mkposRootIdentity: identity, mkposRootEntry: entry };
  delete state.mkposHistorySourcePath;
  return state;
}

// Two same-URL entries provide a browser Back boundary inside this document.
// Logical depth is zero for both: neither can navigate to an older app page.
export function installNavigationRoot(root, identity, locationForPath) {
  const stack = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.history.replaceState({ ...rootHistoryState(root, identity, 'base'), mkposRootStack: stack }, '', locationForPath(root));
  window.history.pushState(rootHistoryState(root, identity), '', locationForPath(root));
}
