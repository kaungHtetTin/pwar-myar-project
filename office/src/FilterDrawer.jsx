import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useRetainedActivity } from './retainedActivity';

export function FilterDrawer({ open, title, onClose, children, busy = false }) {
  const active = useRetainedActivity();
  const drawerRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();

  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    if (!open || !active) return undefined;
    const previousFocus = document.activeElement;
    const drawer = drawerRef.current;
    const focusableSelector = 'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const frame = window.requestAnimationFrame(() => {
      (drawer?.querySelector('.mkpos-filter-drawer-body')?.querySelector(focusableSelector) || drawer)?.focus();
    });
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = [...drawer.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      if (!previousFocus?.closest?.('[hidden]')) previousFocus?.focus?.();
    };
  }, [active, open]);

  if (!open) return null;
  return <div className="mkpos-filter-drawer-overlay is-open" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <aside ref={drawerRef} className="mkpos-filter-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="mkpos-filter-drawer-header"><div><span>Search &amp; filter</span><h2 id={titleId}>{title}</h2></div><button className="mkpos-dismiss-icon" type="button" onClick={onClose} disabled={busy} aria-label="Close filters"><X size={20} /></button></header>
      <div className="mkpos-filter-drawer-body">{children}</div>
    </aside>
  </div>;
}
