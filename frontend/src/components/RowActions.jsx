import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical } from 'lucide-react';

/** One accessible, unclipped action menu for every directory table. */
export function RowActions({ label, children, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const closeTimer = useRef(null);
  const openedByHover = useRef(false);
  const focusMenu = useRef(false);
  const id = useId();
  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const close = useCallback(() => {
    cancelScheduledClose();
    openedByHover.current = false;
    setOpen(false);
  }, [cancelScheduledClose]);
  const openFromMouseHover = useCallback((event) => {
    if (disabled || event.pointerType !== 'mouse') return;
    cancelScheduledClose();
    openedByHover.current = true;
    focusMenu.current = false;
    setOpen(true);
  }, [cancelScheduledClose, disabled]);
  const scheduleMouseHoverClose = useCallback((event) => {
    if (event.pointerType !== 'mouse' || !openedByHover.current) return;
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(close, 160);
  }, [cancelScheduledClose, close]);
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const margin = 8;
    const gap = 4;
    const triggerRect = trigger.current.getBoundingClientRect();
    const menuRect = menu.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    const openAbove = spaceBelow < menuRect.height + gap && spaceAbove > spaceBelow;
    const preferredTop = openAbove
      ? triggerRect.top - menuRect.height - gap
      : triggerRect.bottom + gap;
    setPosition({
      top: Math.max(margin, Math.min(preferredTop, window.innerHeight - menuRect.height - margin)),
      left: Math.max(margin, Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - margin)),
      placement: openAbove ? 'top' : 'bottom',
    });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    if (focusMenu.current) {
      menu.current?.querySelector('button:not(:disabled)')?.focus();
      focusMenu.current = false;
    }
    const outside = (event) => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    };
    const keyboard = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); trigger.current?.focus(); }
      if (event.key === 'Tab') close();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')];
        const current = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      cancelScheduledClose();
    };
  }, [cancelScheduledClose, close, open]);
  function toggle() {
    cancelScheduledClose();
    if (open) {
      if (openedByHover.current) {
        openedByHover.current = false;
        return;
      }
      close();
      return;
    }
    openedByHover.current = false;
    focusMenu.current = true;
    setOpen(true);
  }
  return <>
    <button ref={trigger} type="button" className={`row-actions-trigger${open ? ' is-open' : ''}`} aria-label={`Actions for ${label}`} aria-haspopup="menu" aria-controls={open ? id : undefined} aria-expanded={open} disabled={disabled} onClick={toggle} onPointerEnter={openFromMouseHover} onPointerLeave={scheduleMouseHoverClose}><EllipsisVertical size={18} /></button>
    {open && createPortal(<div ref={menu} id={id} className="row-actions-menu" role="menu" aria-label={`Actions for ${label}`} data-placement={position?.placement} style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }} onPointerEnter={cancelScheduledClose} onPointerLeave={scheduleMouseHoverClose}>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child, { role: 'menuitem', onClick: (event) => { close(); trigger.current?.focus(); child.props.onClick?.(event); } }) : child)}</div>, document.body)}
  </>;
}
