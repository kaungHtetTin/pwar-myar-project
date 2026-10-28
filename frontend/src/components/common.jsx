import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useRetainedActivity } from './retainedActivity';

export function PageSkeleton({ children = 'Loading page...' }) {
  return (
    <div className="page-loading-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{children}</span>
      <div className="page-skeleton-heading" aria-hidden="true"><i /><i /></div>
      <div className="page-skeleton-stats" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="page-skeleton-panel" aria-hidden="true">
        <i className="page-skeleton-toolbar" /><i /><i /><i /><i /><i />
      </div>
    </div>
  );
}

export function LoadingState({ children = 'Loading...' }) {
  return <PageSkeleton>{children}</PageSkeleton>;
}

export function TableLoadingState({ children = 'Loading records…' }) {
  return <PageSkeleton>{children}</PageSkeleton>;
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

export function TablePagination({ className, page, pageSize, total, loading = false, onPageChange }) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safePageSize = Math.max(1, Number(pageSize || 1));
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page || 1)), totalPages);
  const firstRow = safeTotal ? ((safePage - 1) * safePageSize) + 1 : 0;
  const lastRow = safeTotal ? Math.min(safePage * safePageSize, safeTotal) : 0;

  return (
    <div className={`data-table-footer ${className || ''}`}>
      <span>{firstRow}-{lastRow} of {safeTotal}</span>
      <div className="table-pagination" aria-label="Table pagination">
        <button type="button" disabled={loading || safePage <= 1} onClick={() => onPageChange(safePage - 1)}>Prev</button>
        <span>{safePage} / {totalPages}</span>
        <button type="button" disabled={loading || safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({ open, title, subtitle = '', headerContent = null, onClose, children, footer = null, busy = false, className = '', size = 'large', onBodyScroll, focusFirstField = true }) {
  const active = useRetainedActivity();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open || !active) return undefined;
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = 'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      const usefulField = dialog?.querySelector('.mkpos-modal-body')?.querySelector(focusableSelector);
      (focusFirstField ? (usefulField || dialog?.querySelector(focusableSelector) || dialog) : dialog)?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (!previousFocusRef.current?.closest?.('[hidden]')) previousFocusRef.current?.focus?.();
    };
  }, [active, focusFirstField, open]);

  if (!open) return null;

  return (
    <div className="mkpos-modal-overlay">
      <div
        ref={dialogRef}
        className={`mkpos-modal mkpos-modal-wide mkpos-modal--${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="mkpos-modal-header">
          <div className="mkpos-modal-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {headerContent && <div className="mkpos-modal-header-content">{headerContent}</div>}
          <button className="mkpos-dismiss-icon" type="button" onClick={onClose} disabled={busy} aria-label={`Close ${title}`}><X size={20} /></button>
        </div>
        <div className="mkpos-modal-body" onScroll={onBodyScroll}>{children}</div>
        {footer && <footer className="mkpos-modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function FilterDrawer({ open, title, onClose, children, busy = false, className = '', eyebrow = 'Search & filter' }) {
  const visible = useRetainedActivity();
  const [rendered, setRendered] = useState(open);
  const [active, setActive] = useState(false);
  const drawerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    let frame;
    let timer;
    if (open) {
      setRendered(true);
      frame = window.requestAnimationFrame(() => setActive(true));
    } else {
      setActive(false);
      timer = window.setTimeout(() => setRendered(false), 180);
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !visible) return undefined;
    previousFocusRef.current = document.activeElement;
    const drawer = drawerRef.current;
    const focusableSelector = 'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      const usefulField = drawer?.querySelector('.mkpos-filter-drawer-body')?.querySelector(focusableSelector);
      (usefulField || drawer?.querySelector(focusableSelector) || drawer)?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = [...drawer.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (!previousFocusRef.current?.closest?.('[hidden]')) previousFocusRef.current?.focus?.();
    };
  }, [open, visible]);

  if (!rendered) return null;

  return (
    <div
      className={`mkpos-filter-drawer-overlay${active && open ? ' is-open' : ''}`}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (open && event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        className={`mkpos-filter-drawer ${className}`.trim()}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
        aria-labelledby={open ? titleId : undefined}
        tabIndex={-1}
      >
        <header className="mkpos-filter-drawer-header">
          <div>
            <span>{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="mkpos-dismiss-icon" type="button" onClick={onClose} disabled={busy} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="mkpos-filter-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
