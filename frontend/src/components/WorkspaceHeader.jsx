import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Languages, PanelLeftClose, PanelLeftOpen, RotateCcw, Store } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { runManualRefresh } from '../manualRefresh';

const PAGE_DESCRIPTIONS = {
  sell: 'Create a sale and manage your customer’s checkout.',
  products: 'Manage your products, pricing, and stock levels.',
  purchases: 'Track purchases, supplier invoices, and payments.',
  sales: 'Review sales receipts, payment status, and customer history.',
  suppliers: 'Manage supplier contacts and account balances.',
  customers: 'Manage customer profiles, sales, and account activity.',
  expenses: 'Track operating expenses and business spending.',
  transactions: 'Review customer and supplier payment records.',
  reports: 'Understand sales, expenses, inventory, and account balances.',
  billing: 'Manage your subscription and billing history.',
  settings: 'Configure your business and workspace preferences.',
  access: 'Manage staff, roles, and page permissions.',
  shop: 'Publish your storefront and manage online orders and payments.',
};

export function WorkspacePageHeading({ module, title, description, children }) {
  return <div className="workspace-page-heading"><div><h1>{title ?? module.label}</h1><p>{description ?? PAGE_DESCRIPTIONS[module.id]}</p></div>{children}</div>;
}

export function WorkspaceHeader({ collapsed, onToggleSidebar, onRefresh, onRefreshError, refreshKey = '', backAction = null, chatAction = null, shopAction = null }) {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'my' ? 'en' : 'my';
  const localeLabel = nextLanguage === 'my' ? 'Change language to Myanmar' : 'Change language to English';
  const [refreshState, setRefreshState] = useState(null);
  const inFlight = useRef(null), mounted = useRef(true);
  const refreshing = refreshState?.key === refreshKey && refreshState.busy;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function refreshPage() {
    if (inFlight.current?.key === refreshKey) return;
    const operation = { key: refreshKey, busy: true };
    inFlight.current = operation;
    setRefreshState(operation);
    try { await runManualRefresh(onRefresh); }
    catch (error) { if (mounted.current) onRefreshError?.(error); }
    finally {
      if (inFlight.current === operation) inFlight.current = null;
      if (mounted.current) setRefreshState(current => current === operation ? { ...current, busy: false } : current);
    }
  }

  return (
    <div className="workspace-header">
      {backAction && (
        <button
          className="workspace-icon-button workspace-back-button"
          type="button"
          aria-label={backAction.label}
          title={backAction.label}
          onClick={backAction.onClick}
          disabled={backAction.disabled}
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <button className="workspace-icon-button workspace-menu-button" type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggleSidebar}>
        <span key={collapsed ? 'expand' : 'collapse'} className="workspace-menu-icon" aria-hidden="true">
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </span>
      </button>
      <div className="workspace-app-bar-search" id="workspace-app-bar-search" aria-label="Page search" />
      <div className="workspace-app-bar-actions" id="workspace-app-bar-actions" aria-label="Page actions" />
      {shopAction && <button className="workspace-icon-button workspace-shop-button" type="button" onClick={shopAction.onClick} aria-label={shopAction.count ? `Shop, ${shopAction.count} orders need action` : 'Shop'} title={shopAction.count ? `Shop, ${shopAction.count} orders need action` : 'Shop'}><Store size={16} aria-hidden="true" />{shopAction.count > 0 && <span className="workspace-chat-badge" aria-hidden="true">{shopAction.count > 99 ? '99+' : shopAction.count}</span>}</button>}
      {chatAction}
      <button className="workspace-icon-button workspace-locale-button" type="button" aria-label={localeLabel} title={localeLabel} onClick={() => setLanguage(nextLanguage)}><Languages size={16} /></button>
      <button className="workspace-icon-button workspace-refresh-button" type="button" aria-label={refreshing ? 'Refreshing page' : 'Refresh'} title={refreshing ? 'Refreshing page…' : 'Refresh'} aria-busy={Boolean(refreshing)} disabled={Boolean(refreshing)} onClick={refreshPage}><RotateCcw className={refreshing ? 'workspace-refresh-spin' : undefined} size={16} aria-hidden="true" />{refreshing && <span className="workspace-refresh-label" aria-hidden="true">Refreshing…</span>}</button>
      <span className="visually-hidden" role="status" aria-live="polite">{refreshing ? 'Refreshing page…' : ''}</span>
    </div>
  );
}

function AppBarSlot({ children, className = '', hostId }) {
  const [host, setHost] = React.useState(null);
  const [active, setActive] = React.useState(false);
  const [desktop, setDesktop] = React.useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 981px)').matches);
  const markerRef = React.useRef(null);
  React.useEffect(() => {
    setHost(document.getElementById(hostId));
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 981px)') : null;
    const updateDesktop = () => setDesktop(media.matches);
    media?.addEventListener('change', updateDesktop);
    const moduleView = markerRef.current?.closest('.module-view') || markerRef.current?.closest('[data-retained-view]');
    if (!moduleView) {
      setActive(true);
      return () => media?.removeEventListener('change', updateDesktop);
    }
    const update = () => setActive(!markerRef.current?.closest('[hidden]'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(moduleView, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', updateDesktop);
    };
  }, [hostId]);
  const content = <div className={className}>{children}</div>;
  return <><span ref={markerRef} className="visually-hidden" aria-hidden="true" />{desktop ? (host && active ? createPortal(content, host) : null) : content}</>;
}

export function AppBarActions({ children, className = '' }) {
  return <AppBarSlot hostId="workspace-app-bar-actions" className={`workspace-app-bar-action-group ${className}`.trim()}>{children}</AppBarSlot>;
}

export function AppBarSearch({ children, className = '' }) {
  return <AppBarSlot hostId="workspace-app-bar-search" className={`workspace-app-bar-search-group ${className}`.trim()}>{children}</AppBarSlot>;
}
