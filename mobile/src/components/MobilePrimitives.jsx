import { Button, Field, IconButton } from './Controls';
import React, { createContext, useContext, useEffect, useId, useRef } from 'react';
import { ChevronRight, Filter, RefreshCw, Trash2, X } from 'lucide-react';
import { PageActivityContext } from '../navigation/pageRefresh';
import { useLocale } from '../localization/LocaleContext';

const FilterDrawerCloseContext = createContext(null);

export function MobileField({ id, label, error, hint, children }) {
  return <Field id={id} label={label} error={error} hint={hint}>{children}</Field>;
}

export function MobileNotice({ notice, onClose, dismissLabel = 'Dismiss message' }) {
  if (!notice) return null;
  return (
    <div className={`mobile-notice mobile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      <IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label={dismissLabel} onClick={onClose}><X size={17} /></IconButton>
    </div>
  );
}

export function MobileFilterToggle({ open, onToggle, controls, label, count = 0, className = '' }) {
  const { language } = useLocale();
  const filterLabel = label || (language === 'my' ? 'စစ်ထုတ်ရန်' : 'Filters');
  return (
    <Button variant="secondary"
      type="button"
      className={`mobile-filter-toggle${open ? ' is-active' : ''}${count > 0 ? ' has-filters' : ''}${className ? ` ${className}` : ''}`}
      aria-label={count > 0 ? `${filterLabel}, ${count} active filters` : filterLabel}
      aria-expanded={open}
      aria-controls={controls}
      onClick={event => { event.currentTarget.focus({ preventScroll: true }); onToggle?.(event); }}
    >
      <Filter size={17} aria-hidden="true" />
      <span>{filterLabel}</span>
      {count > 0 && <small aria-label={`${count} active filters`}>{count}</small>}
      <ChevronRight className="mobile-filter-chevron" size={15} aria-hidden="true" />
    </Button>
  );
}

export function MobileFilterPanel({ open, id, onClose, onSubmit, className = '', children, as = 'form', title: heading, description, icon: HeadingIcon, footer }) {
  const active = useContext(PageActivityContext);
  const { language } = useLocale();
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !active) return undefined;
    const dialog = dialogRef.current;
    // Safari touch taps do not always focus the opener before the dialog opens.
    const triggerForPanel = () => [...document.querySelectorAll('[aria-controls]')].find(node => node.getAttribute('aria-controls') === id && !node.closest('[hidden], [inert]'));
    const focused = document.activeElement;
    const trigger = focused?.getAttribute('aria-controls') === id ? focused : triggerForPanel() || focused;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keep the dialog in its localization boundary; the native top layer
    // escapes transformed ancestors and makes the page behind it inert.
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    // Announce the drawer without giving its dismiss button a default focus ring.
    // Keyboard users can still Tab to the close button and see its focus indicator.
    dialog.querySelector('.mobile-filter-drawer-header h2')?.focus({ preventScroll: true });
    const dismiss = () => closeRef.current?.();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('*')].filter(element => element.matches('button, input, select, textarea, a[href]') && !element.disabled && element.tabIndex !== -1 && element.type !== 'hidden');
      const first = controls[0], last = controls.at(-1);
      const outsideControls = !controls.includes(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outsideControls)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outsideControls)) { event.preventDefault(); first?.focus(); }
    };
    const hardwareBack = (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('mkpos:hardware-back', hardwareBack);
    window.addEventListener('popstate', dismiss);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('mkpos:hardware-back', hardwareBack);
      window.removeEventListener('popstate', dismiss);
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
      document.body.style.overflow = previousOverflow;
      const target = trigger?.isConnected ? trigger : triggerForPanel();
      if (target && !target.closest('[hidden], [inert]')) target.focus({ preventScroll: true });
    };
  }, [active, open, id]);

  if (!open) return null;
  const Element = as;
  const content = [], actions = [];
  React.Children.toArray(children).forEach(child => {
    const isActions = React.isValidElement(child) && (child.type === MobileFilterActions || /(?:^|\s)(?:product-filter-actions|customer-history-filter-actions|mobile-filter-actions)(?:\s|$)/.test(child.props.className || ''));
    (isActions ? actions : content).push(child);
  });
  const title = heading || (language === 'my' ? 'စစ်ထုတ်ရန်' : 'Filters');
  const closeLabel = heading ? `Close ${heading}` : language === 'my' ? 'စစ်ထုတ်မှု ပိတ်ရန်' : 'Close filters';
  return <FilterDrawerCloseContext.Provider value={onClose}><dialog ref={dialogRef} className="mobile-filter-drawer-layer" aria-labelledby={titleId} aria-modal="true" onCancel={event => { event.preventDefault(); closeRef.current?.(); }}>
    <button type="button" className="mobile-filter-drawer-backdrop" tabIndex={-1} aria-label={heading ? `Dismiss ${heading}` : language === 'my' ? 'စစ်ထုတ်မှု ပိတ်ရန်' : 'Dismiss filters'} onClick={onClose} />
    <Element id={id} className="mobile-filter-drawer" onSubmit={onSubmit}>
      <header className="mobile-filter-drawer-header">{HeadingIcon && <span className="mobile-filter-drawer-icon" aria-hidden="true"><HeadingIcon size={20} /></span>}<div className="mobile-drawer-heading"><h2 id={titleId} tabIndex={-1}>{title}</h2>{description && <p>{description}</p>}</div><IconButton variant="ghost" type="button" className="mobile-filter-drawer-close mkpos-dismiss-icon" aria-label={closeLabel} onClick={onClose}><X size={24} aria-hidden="true" /></IconButton></header>
      <div className={`mobile-filter-drawer-body mobile-collapsible-filter${className ? ` ${className}` : ''}`}>{content}</div>
      {(footer || actions.length > 0) && <footer className="mobile-filter-drawer-footer">{footer || actions}</footer>}
    </Element>
  </dialog></FilterDrawerCloseContext.Provider>;
}

export function MobileFilterResetButton({ onClick, children, ...props }) {
  const close = useContext(FilterDrawerCloseContext);
  return <Button variant="secondary" {...props} type="button" onClick={async event => {
    const result = await onClick?.(event);
    if (result !== false) close?.();
  }}>{children}</Button>;
}

export function MobileFilterActions({ onClear, clearLabel, applyLabel, className = '' }) {
  const { language } = useLocale();
  return (
    <div className={`mobile-filter-actions${className ? ` ${className}` : ''}`}>
      <MobileFilterResetButton className="mobile-secondary" onClick={onClear}>{clearLabel || (language === 'my' ? 'ပြန်လည်သတ်မှတ်မည်' : 'Reset')}</MobileFilterResetButton>
      <Button variant="primary" className="mobile-primary" type="submit">{applyLabel || (language === 'my' ? 'စစ်ထုတ်မှု အသုံးပြုမည်' : 'Apply filters')}</Button>
    </div>
  );
}

export function MobileSheet({ open, title, description, onClose, closeLabel = `Close ${title}`, children, footer, className = '' }) {
  const titleId = useId();
  const active = useContext(PageActivityContext);

  useEffect(() => {
    if (!open || !active) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    const closeOnHardwareBack = (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('mkpos:hardware-back', closeOnHardwareBack);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('mkpos:hardware-back', closeOnHardwareBack);
    };
  }, [active, onClose, open]);

  if (!open) return null;
  return (
    <div className="mobile-sheet-layer">
      <button className="mobile-sheet-backdrop" type="button" aria-label={closeLabel} onClick={onClose} />
      <section className={`mobile-sheet${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="mobile-sheet-handle" aria-hidden="true" />
        <header className="mobile-sheet-header">
          <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
          <IconButton variant="ghost" className="icon-button mobile-sheet-close mkpos-dismiss-icon" type="button" aria-label={closeLabel} onClick={onClose}><X size={20} /></IconButton>
        </header>
        <div className="mobile-sheet-body">{children}</div>
        {footer && <footer className="mobile-sheet-footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function MobileDeleteSheet({
  open,
  title,
  description,
  itemTitle,
  itemDescription,
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  busy = false,
  onClose,
  onConfirm,
  children,
}) {
  function submit(event) {
    event.preventDefault();
    onConfirm?.(event);
  }

  return (
    <MobileSheet
      className="mobile-sheet--action-menu mobile-sheet--delete-confirmation"
      open={open}
      title={title}
      description={description}
      onClose={() => !busy && onClose?.()}
    >
      <form className="mobile-delete-confirmation" onSubmit={submit}>
        <div className="mobile-delete-target">
          <Trash2 size={19} />
          <span>
            <strong>{itemTitle}</strong>
            {itemDescription && <small>{itemDescription}</small>}
          </span>
        </div>
        {children}
        <div className="mobile-delete-actions">
          <Button variant="secondary" className="mobile-secondary" type="button" disabled={busy} onClick={onClose}>{cancelLabel}</Button>
          <Button variant="danger" className="mobile-danger" type="submit" disabled={busy}>{busy ? busyLabel : confirmLabel}</Button>
        </div>
      </form>
    </MobileSheet>
  );
}

export function EndlessListFooter({ list, count, noun, labels = {} }) {
  return (
    <div className="endless-list-footer" ref={list.sentinelRef}>
      {list.loadingMore && <p role="status"><RefreshCw className="spin" size={17} />{labels.loadingMore || `Loading more ${noun}…`}</p>}
      {list.error && count > 0 && <div className="endless-list-error"><span>{list.error}</span><Button variant="plain" type="button" onClick={list.retry}>{labels.retry || 'Try again'}</Button></div>}
      {list.hasMore && !list.loadingMore && !list.error && !list.observerSupported && <Button variant="secondary" className="mobile-secondary" type="button" onClick={list.loadMore}>{labels.loadMore || 'Load more'}</Button>}
      {!list.hasMore && count > 0 && <p className="endless-list-end">{labels.end || `You’re all caught up · ${count} ${noun}`}</p>}
    </div>
  );
}
