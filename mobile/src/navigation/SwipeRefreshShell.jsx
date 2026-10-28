import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { RefreshRegistrationContext } from './pageRefresh';
import { useLocale } from '../localization/LocaleContext';

const REFRESH_THRESHOLD = 68;
const MAX_PULL_DISTANCE = 92;

export function SwipeRefreshShell({ onRefresh, children }) {
  const rootRef = useRef(null);
  const { language } = useLocale();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startPointRef = useRef(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const pageRefreshHandlers = useRef(new Set());

  const registerPageRefresh = useCallback((handler, { fallback = false } = {}) => {
    const entry = { handler, fallback };
    pageRefreshHandlers.current.add(entry);
    return () => { pageRefreshHandlers.current.delete(entry); };
  }, []);

  const updateDistance = useCallback((distance) => {
    distanceRef.current = distance;
    setPullDistance(distance);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    updateDistance(52);
    const registered = [...pageRefreshHandlers.current];
    const pageHandlers = registered.filter(entry => !entry.fallback);
    const handlers = pageHandlers.length ? pageHandlers : registered;
    const actions = [...new Set([onRefresh, ...handlers.map(entry => entry.handler)].filter(Boolean))].map(action => Promise.resolve().then(action));
    await Promise.allSettled(actions);
    refreshingRef.current = false;
    setRefreshing(false);
    updateDistance(0);
  }, [onRefresh, updateDistance]);

  const cancelPull = useCallback(() => {
    startPointRef.current = null;
    if (!refreshingRef.current) updateDistance(0);
  }, [updateDistance]);

  const onTouchStart = useCallback((event) => {
    startPointRef.current = null;
    if (refreshingRef.current || event.touches.length !== 1 || window.scrollY > 0) return;
    if (event.target.closest?.('[role="dialog"], dialog, [data-disable-swipe-refresh], input, textarea, select, [contenteditable="true"]')) return;
    // An inner list must finish scrolling to its own top before a pull can start.
    for (let node = event.target; node && node !== rootRef.current; node = node.parentElement) {
      if (node.scrollTop > 0) return;
    }
    startPointRef.current = { x: event.touches[0].clientX || 0, y: event.touches[0].clientY };
    updateDistance(0);
  }, [updateDistance]);

  const onTouchMove = useCallback((event) => {
    if (event.touches.length !== 1) { cancelPull(); return; }
    if (startPointRef.current === null) return;
    const delta = event.touches[0].clientY - startPointRef.current.y;
    const horizontalDelta = Math.abs((event.touches[0].clientX || 0) - startPointRef.current.x);
    if (horizontalDelta > delta) {
      cancelPull();
      return;
    }
    if (delta <= 0 || window.scrollY > 0) {
      cancelPull();
      return;
    }
    if (event.cancelable) event.preventDefault();
    updateDistance(Math.min(MAX_PULL_DISTANCE, delta * 0.48));
  }, [cancelPull, updateDistance]);

  const finishPull = useCallback(() => {
    if (startPointRef.current === null) return;
    startPointRef.current = null;
    if (distanceRef.current >= REFRESH_THRESHOLD) {
      void runRefresh();
    } else {
      updateDistance(0);
    }
  }, [runRefresh, updateDistance]);

  useEffect(() => {
    const root = rootRef.current;
    // React's delegated touchmove listener is passive in browsers. The native
    // listener lets the app own the pull instead of also refreshing the document.
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', finishPull);
    root.addEventListener('touchcancel', cancelPull);
    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', finishPull);
      root.removeEventListener('touchcancel', cancelPull);
    };
  }, [cancelPull, finishPull, onTouchMove, onTouchStart]);

  const ready = pullDistance >= REFRESH_THRESHOLD;
  const visible = refreshing || pullDistance > 0;
  const status = language === 'my'
    ? refreshing ? 'ပြန်လည်ရယူနေသည်…' : ready ? 'ပြန်လည်ရယူရန် လွှတ်ပါ' : 'ပြန်လည်ရယူရန် အောက်သို့ဆွဲပါ'
    : refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh';

  return (
    <RefreshRegistrationContext.Provider value={registerPageRefresh}>
      <div
        ref={rootRef}
        className={`swipe-refresh-shell${refreshing ? ' is-refreshing' : ''}`}
        role="region"
        aria-label="Pull to refresh page"
        aria-busy={refreshing}
      >
        <div className={`swipe-refresh-indicator${visible ? ' is-visible' : ''}${ready ? ' is-ready' : ''}`} style={{ '--pull-distance': `${pullDistance}px` }} role="status" aria-live="polite" aria-hidden={!visible}>
          {refreshing ? <RefreshCw className="spin" size={19} /> : <ArrowDown size={19} />}
          <span>{status}</span>
        </div>
        <div
          className={`swipe-refresh-content${visible ? ' is-pulling' : ''}`}
          style={{ '--pull-distance': `${pullDistance}px` }}
        >
          {children}
        </div>
      </div>
    </RefreshRegistrationContext.Provider>
  );
}
