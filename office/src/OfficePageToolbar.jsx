import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Filter, Plus, Search, X } from 'lucide-react';
import { FilterDrawer } from './FilterDrawer';
import { useRetainedActivity } from './retainedActivity';
import './office-page-toolbar.css';

export const OfficeAppBarContext = createContext(null);

/** Pages retain their state while rendering their controls in the shared app bar. */
export function OfficePageToolbar({ visible = true, onBack, backLabel = 'Back', backDisabled = false, searchLabel, placeholder, search, onSearchChange, onSearch, onClearSearch, actionLabel, onCreate, actionIcon = Plus, actionDisabled = false, extraActions, onFilterOpen, filterOpen, filterCount = 0, busy = false }) {
  const hosts = useContext(OfficeAppBarContext);
  const active = useRetainedActivity();
  if (!active || !visible) return null;
  const backControl = onBack && <button type="button" className="office-appbar-back" aria-label={backLabel} title={backLabel} disabled={busy || backDisabled} onClick={onBack}><ArrowLeft size={18} /></button>;
  const searchControl = searchLabel && <form className={`office-appbar-search${search ? ' has-value' : ''}`} role="search" onSubmit={event => { event.preventDefault(); onSearch(); }}>
    <label><Search size={16} aria-hidden="true" /><input type="search" aria-label={searchLabel} placeholder={placeholder} maxLength={200} value={search} onChange={event => onSearchChange(event.target.value)} /></label>
    {search && <button type="button" className="office-appbar-search-clear mkpos-dismiss-icon" aria-label={`Clear ${searchLabel.toLowerCase()}`} title="Clear search" onClick={onClearSearch}><X size={14} /></button>}
  </form>;
  const actions = <>
    {onCreate && <button type="button" className="office-button-primary" disabled={busy || actionDisabled} onClick={onCreate}>{React.createElement(actionIcon, { size: 16 })}{actionLabel}</button>}
    {extraActions}
    {onFilterOpen && <button type="button" className="office-filter-trigger" disabled={busy} onClick={onFilterOpen} aria-haspopup="dialog" aria-expanded={filterOpen}><Filter size={16} />Filters{filterCount > 0 && <span className="office-filter-count">{filterCount}</span>}</button>}
  </>;
  if (hosts) return <>{hosts.navigation && createPortal(backControl, hosts.navigation)}{hosts.search && createPortal(searchControl, hosts.search)}{hosts.actions && createPortal(actions, hosts.actions)}</>;
  return <div className="office-topbar office-page-toolbar-preview">{backControl}{searchControl}<div className="office-topbar-actions">{actions}</div></div>;
}

function StatusFilterForm({ status, options, onApply, onClear, busy }) {
  const [draft, setDraft] = useState(status);
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
    <div className="office-drawer-filter-fields"><label>Status<select value={draft} disabled={busy} onChange={event => setDraft(event.target.value)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="office-drawer-filter-actions"><button type="button" disabled={busy} onClick={onClear}>Clear</button><button type="submit" className="office-button-primary" disabled={busy}>Apply filters</button></div>
  </form>;
}

export function OfficeStatusFilterDrawer({ open, title, status, options, onApply, onClear, onClose, busy = false }) {
  return <FilterDrawer open={open} title={title} onClose={onClose} busy={busy}><StatusFilterForm status={status} options={options} onApply={onApply} onClear={onClear} busy={busy} /></FilterDrawer>;
}
