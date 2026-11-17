import React, { useState } from 'react';
import { FilterDrawer } from './FilterDrawer';

export const defaultUserFilters = { status: 'all', phone: 'all', address: 'all', registered_from: '', registered_to: '', sort: 'newest' };

function UserFilterForm({ query, onApply, onClear, busy }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(Object.keys(defaultUserFilters).map(key => [key, query[key]])));
  const field = (name, value) => setDraft(current => ({ ...current, [name]: value }));
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
    <div className="office-drawer-filter-fields">
      <label>Status<select disabled={busy} value={draft.status} onChange={event => field('status', event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label>Phone number<select disabled={busy} value={draft.phone} onChange={event => field('phone', event.target.value)}><option value="all">All customers</option><option value="present">Has phone number</option><option value="missing">Missing phone number</option></select></label>
      <label>Address<select disabled={busy} value={draft.address} onChange={event => field('address', event.target.value)}><option value="all">All customers</option><option value="present">Has address</option><option value="missing">Missing address</option></select></label>
      <label>Registered from<input disabled={busy} type="date" max={draft.registered_to || undefined} value={draft.registered_from} onChange={event => field('registered_from', event.target.value)} /></label>
      <label>Registered to<input disabled={busy} type="date" min={draft.registered_from || undefined} value={draft.registered_to} onChange={event => field('registered_to', event.target.value)} /></label>
      <label>Sort by<select disabled={busy} value={draft.sort} onChange={event => field('sort', event.target.value)}><option value="newest">Newest registered</option><option value="oldest">Oldest registered</option><option value="name">Name (A–Z)</option></select></label>
    </div>
    <div className="office-drawer-filter-actions"><button type="button" disabled={busy} onClick={onClear}>Clear</button><button type="submit" className="office-button-primary" disabled={busy}>Apply filters</button></div>
  </form>;
}

export function PlatformUserFilters({ open, query, onApply, onClear, onClose, busy }) {
  return <FilterDrawer open={open} title="Platform user filters" onClose={onClose} busy={busy}><UserFilterForm query={query} onApply={onApply} onClear={onClear} busy={busy} /></FilterDrawer>;
}
