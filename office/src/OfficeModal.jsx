import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useRetainedActivity } from './retainedActivity';

export function OfficeModal({ title, description, closeLabel = 'Close dialog', onClose, busy = false, className = '', children, footer }) {
  const active = useRetainedActivity(), titleId = useId();
  const dialog = useRef(null), close = useRef(onClose), saving = useRef(busy);
  useEffect(() => { close.current = onClose; saving.current = busy; }, [onClose, busy]);
  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector('button')?.focus({ preventScroll: true });
    function keyboard(event) {
      if (event.key === 'Escape' && !saving.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll(':is(button, input, select, textarea, a[href]):not(:disabled)')].filter(element => !element.closest('details:not([open])') && element.tabIndex >= 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.current.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      if (previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus({ preventScroll: true });
    };
  }, [active]);
  return <div className="office-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving.current) onClose(); }}>
    <section ref={dialog} className={`office-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <div className="office-modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="mkpos-dismiss-icon" aria-label={closeLabel} disabled={busy} onClick={onClose}><X size={18} /></button></div>
      <div className="office-modal-body">{children}</div>
      {footer && <div className="office-modal-footer">{footer}</div>}
    </section>
  </div>;
}
