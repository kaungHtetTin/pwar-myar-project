import { useLayoutEffect, useRef, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { appBarRoute } from './appBarRoute';
import { hasInAppBackEntry, historyIndex, installNavigationRoot, nextHistoryState, replacementHistoryState, rootHistoryState } from './historyNavigation';
import { routeLocation, routePathFromLocation } from './routeBase';

const pathNow = () => routePathFromLocation(window.location.pathname);
const snapshot = () => ({ path: pathNow(), url: window.location.href, state: window.history.state, index: historyIndex() });
const dismissOverlay = () => {
  const event = new CustomEvent('mkpos:hardware-back', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

export function useRootNavigation({ rootPath, identity, pathname, onPathChange }) {
  const current = useRef(snapshot());
  const config = useRef({ rootPath, identity, onPathChange });
  config.current = { rootPath, identity, onPathChange };
  const traversing = useRef(false), restoring = useRef(false), exiting = useRef(false);
  const remember = () => { current.current = snapshot(); };

  useLayoutEffect(() => {
    if (!rootPath) { remember(); return; }
    if (!window.history.state?.mkposRootStack || window.history.state?.mkposRootPath !== rootPath || window.history.state?.mkposRootIdentity !== identity) {
      const destination = pathNow();
      const destinationURL = window.location.href;
      const parents = [], visited = new Set([destination, rootPath]);
      let parent = appBarRoute(destination).backPath;
      while (destination !== rootPath && parent && !visited.has(parent)) {
        parents.unshift(parent); visited.add(parent); parent = appBarRoute(parent).backPath;
      }
      installNavigationRoot(rootPath, identity, routeLocation);
      for (const path of destination === rootPath ? [] : [...parents, destination]) {
        window.history.pushState(nextHistoryState(), '', path === destination ? destinationURL : routeLocation(path));
      }
      onPathChange(pathNow());
    } else if (pathNow() === rootPath && window.history.state?.mkposRootEntry === 'base') {
      window.history.pushState(rootHistoryState(rootPath, identity), '', routeLocation(rootPath));
    }
    remember();
  }, [rootPath, identity, onPathChange]);

  useLayoutEffect(remember, [pathname]);

  useEffect(() => {
    function pop() {
      const { rootPath: root, identity: owner, onPathChange: update } = config.current;
      const previous = current.current, destination = snapshot();
      if (restoring.current) { restoring.current = false; traversing.current = false; remember(); return; }
      const hardwareTraversal = traversing.current;
      traversing.current = false;
      if (root && !hardwareTraversal && dismissOverlay()) {
        if (destination.state?.mkposRootEntry === 'base') {
          window.history.pushState(previous.state, '', previous.url);
          remember();
        } else {
          const delta = previous.index - destination.index;
          if (delta) { restoring.current = true; window.history.go(delta); }
          else { window.history.replaceState(previous.state, '', previous.url); remember(); }
        }
        return;
      }
      if (root && (destination.state?.mkposRootStack !== previous.state?.mkposRootStack || (previous.path === root && destination.path !== root && destination.index < previous.index))) {
        installNavigationRoot(root, owner, routeLocation);
      } else if (root && destination.path === root && destination.state?.mkposRootEntry === 'base') {
        window.history.pushState(rootHistoryState(root, owner), '', routeLocation(root));
      }
      remember();
      update(pathNow());
    }
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  function navigate(path, { replace = false } = {}) {
    const { rootPath: root, identity: owner, onPathChange: update } = config.current;
    if (root && path === root) {
      if (pathNow() !== root) installNavigationRoot(root, owner, routeLocation);
    } else {
      const canReplace = replace && !(root && pathNow() === root);
      window.history[canReplace ? 'replaceState' : 'pushState'](canReplace ? replacementHistoryState() : nextHistoryState(), '', routeLocation(path));
    }
    remember(); update(pathNow());
  }

  function back(fallback) {
    const { rootPath: root } = config.current;
    if (traversing.current || restoring.current || (root && pathNow() === root)) return;
    if (hasInAppBackEntry()) { traversing.current = true; window.history.back(); }
    else if (fallback || root) navigate(fallback || root, { replace: true });
  }

  const actions = useRef({ back });
  actions.current = { back };
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let disposed = false, handle;
    void CapacitorApp.addListener('backButton', () => {
      if (traversing.current || restoring.current || exiting.current || dismissOverlay()) return;
      const { rootPath: root } = config.current;
      if (root && pathNow() === root) {
        exiting.current = true;
        void Promise.resolve(CapacitorApp.exitApp()).finally(() => { exiting.current = false; });
      } else if (root || hasInAppBackEntry() || appBarRoute(pathNow()).backPath) {
        actions.current.back(appBarRoute(pathNow()).backPath || root);
      } else void CapacitorApp.minimizeApp();
    }).then(listener => { if (disposed) void listener.remove(); else handle = listener; });
    return () => { disposed = true; if (handle) void handle.remove(); };
  }, []);

  return { navigate, back };
}
