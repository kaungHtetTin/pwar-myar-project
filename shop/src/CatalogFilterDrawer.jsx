import { canRestoreFocus, focusPanel } from './keyboardFocus';
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useText } from './i18n';
import { useShopPageActive } from './RetainedViews';
import { defaultCatalogFilters } from './catalogFilterState';
import './catalog-filter-drawer.css';

export function CatalogFilters({ value, onChange, open: controlledOpen, onOpenChange, category = null, onCategoryChange, renderCategoryFilter, refreshBar = false }) {
  const text = useText(), active = useShopPageActive(), titleId = useId(), formId = useId();
  const [localOpen, setLocalOpen] = useState(false), [draft, setDraft] = useState(value), [draftCategory, setDraftCategory] = useState(category), [error, setError] = useState('');
  const open = controlledOpen ?? localOpen;
  const panel = useRef(null), trigger = useRef(null), closeRef = useRef(null);
  const setOpen = onOpenChange || setLocalOpen;
  useEffect(() => { closeRef.current = () => setOpen(false); }, [setOpen]);
  useEffect(() => {
    if (!open || !active) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusPanel(panel.current, 'select, input, button');
    const keyboard = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard);
      if (previous !== document.body && previous?.isConnected && canRestoreFocus(previous) && !previous.closest('[hidden], [inert]')) previous.focus({ preventScroll: true });
      else if (!trigger.current?.closest('[hidden], [inert]')) trigger.current?.focus({ preventScroll: true });
    };
  }, [open, active]);
  const count = Object.entries(value).filter(([key, val]) => val !== defaultCatalogFilters[key]).length + Number(Boolean(category));
  function show() { setDraft(value); setDraftCategory(category); setError(''); setOpen(true); }
  function apply(event) {
    event.preventDefault();
    if (draft.min_price !== '' && draft.max_price !== '' && Number(draft.min_price) > Number(draft.max_price)) { setError(text('Minimum price must not exceed maximum price.')); return; }
    onChange(draft); onCategoryChange?.(draftCategory); setOpen(false);
  }
  return <div data-shop-refresh-bar={refreshBar ? '' : undefined} className="catalog-feature-filters catalog-filter-toolbar">
    <button ref={trigger} type="button" className="catalog-drawer-trigger" aria-label={text('Filters')} aria-haspopup="dialog" aria-expanded={open && active} onClick={show}><SlidersHorizontal size={18} aria-hidden="true" /><span>{text('Sort & filter')}</span>{count > 0 && <b className="feature-chip">{count}</b>}</button>
    {open && active && createPortal(<div className="catalog-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside ref={panel} className="catalog-filter-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header><h2 id={titleId}>{text('Sort & filter')}</h2><button type="button" className="icon-action" aria-label={text('Close filters')} onClick={() => setOpen(false)}><X size={20} /></button></header>
        <div className="catalog-drawer-body">
          <form id={formId} onSubmit={apply} className="catalog-drawer-fields">
            <label>{text('Sort by')}<select value={draft.sort} onChange={event => setDraft(current => ({ ...current, sort: event.target.value }))}>{[['default', 'Recommended'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Top rated']].map(([key, title]) => <option key={key} value={key}>{text(title)}</option>)}</select></label>
            <section><h3>{text('Price range')}</h3><div className="feature-form-grid"><label>{text('Minimum price')}<input type="number" min="0" max="1000000000" step="1" value={draft.min_price} onChange={event => setDraft(current => ({ ...current, min_price: event.target.value }))} /></label><label>{text('Maximum price')}<input type="number" min="0" max="1000000000" step="1" value={draft.max_price} onChange={event => setDraft(current => ({ ...current, max_price: event.target.value }))} /></label></div></section>
            <label>{text('Minimum rating')}<select value={draft.min_rating} onChange={event => setDraft(current => ({ ...current, min_rating: event.target.value }))}><option value="">{text('Any rating')}</option>{[4, 3, 2, 1].map(n => <option key={n} value={n}>{n}+ ★</option>)}</select></label>
            <label className="feature-check"><input type="checkbox" checked={draft.in_stock} onChange={event => setDraft(current => ({ ...current, in_stock: event.target.checked }))} />{text('In stock only')}</label>
            <label className="feature-check"><input type="checkbox" checked={draft.on_sale} onChange={event => setDraft(current => ({ ...current, on_sale: event.target.checked }))} />{text('Flash sales only')}</label>
            {error && <p className="error" role="alert">{error}</p>}
          </form>
          {renderCategoryFilter && <section className="catalog-drawer-categories">{renderCategoryFilter({ value: draftCategory, onChange: setDraftCategory })}</section>}
        </div>
        <footer><button type="button" onClick={() => { onChange(defaultCatalogFilters); onCategoryChange?.(null); setOpen(false); }}>{text('Reset')}</button><button type="submit" form={formId} className="primary">{text('Apply filters')}</button></footer>
      </aside>
    </div>, document.body)}
  </div>;
}
