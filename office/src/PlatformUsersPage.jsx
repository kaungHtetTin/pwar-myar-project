import { officeDate } from './dateTime';
import { PlatformUserEmail } from './PlatformUserEmail';
import {OfficeTableLoading, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, Pencil, Save, Trash2, X } from 'lucide-react';
import { api } from './api';
import { RowActions } from './RowActions';
import { OfficePageToolbar } from './OfficePageToolbar';
import { PlatformUserFilters, defaultUserFilters } from './PlatformUserFilters';
import { useRetainedActivity } from './retainedActivity';
import { usePageNavigation } from './usePageNavigation';
import './platform-users.css';

const blank = { name: '', email: '', phone: '', address: '', password: '', password_confirmation: '', is_active: true };

function UserForm({ id, onBack, onSaved }) {
  const modal = id !== 'new';
  const active = useRetainedActivity();
  const dialog = useRef(null), close = useRef(onBack), mounted = useRef(false);
  const [form, setForm] = useState(blank), [ready, setReady] = useState(id === 'new');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const saving = useRef(false);
  useEffect(() => { close.current = onBack; }, [onBack]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!modal || !active) return;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector('button')?.focus({ preventScroll: true });
    function keyboard(event) {
      if (event.key === 'Escape' && !saving.current) { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll(':is(button, input, select, textarea):not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.current.focus({ preventScroll: true }); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [modal, active]);
  useEffect(() => {
    if (id === 'new') return;
    let active = true;
    api(`/office/platform-users/${id}`).then(row => { if (active) { setForm({ ...blank, ...row, phone: row.phone || '', address: row.address || '' }); setReady(true); } }).catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [id, retry]);
  function field(name, value) { setForm(current => ({ ...current, [name]: value })); }
  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const payload = Object.fromEntries(Object.keys(blank).map(key => [key, form[key]]));
      const row = await api(id === 'new' ? '/office/platform-users' : `/office/platform-users/${id}`, { method: id === 'new' ? 'POST' : 'PUT', body: JSON.stringify(payload) });
      setForm(current => id === 'new' ? { ...blank } : { ...current, password: '', password_confirmation: '' });
      onSaved(row);
      if (mounted.current) onBack();
    } catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  const content = <>
    {error && <div className="feedback error" role="alert">{error}{!ready && <button type="button" onClick={() => { setError(''); setRetry(n => n + 1); }}>Retry</button>}</div>}
    {!ready ? !error && <p role="status">Loading customer account…</p> : <form onSubmit={submit}><fieldset disabled={busy}>
      <div className="office-platform-fields">
        <label>Name<input required maxLength={255} autoComplete="name" value={form.name} onChange={e => field('name', e.target.value)} /></label>
        <label>Email address<input required type="email" maxLength={255} autoComplete="email" value={form.email} onChange={e => field('email', e.target.value)} /></label>
        <label>Phone<input type="tel" maxLength={80} autoComplete="tel" value={form.phone} onChange={e => field('phone', e.target.value)} /></label>
        <label>Account status<select value={form.is_active ? 'active' : 'inactive'} onChange={e => field('is_active', e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="office-platform-address">Address<textarea rows={3} maxLength={2000} autoComplete="street-address" value={form.address} onChange={e => field('address', e.target.value)} /></label>
        <label>{id === 'new' ? 'Password' : 'New password'}<input type="password" required={id === 'new'} minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={e => field('password', e.target.value)} /></label>
        <label>Confirm password<input type="password" required={id === 'new' || !!form.password} minLength={8} maxLength={128} autoComplete="new-password" value={form.password_confirmation} onChange={e => field('password_confirmation', e.target.value)} /></label>
      </div>
      <p>{id !== 'new' && 'Leave password fields empty to keep the current password. '}Changing email or password, or deactivating the account, signs the customer out of all shops.</p>
      <footer className={modal ? 'office-modal-footer' : undefined}><button type="button" onClick={onBack}>Cancel</button><button className="office-button-primary" type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save customer'}</button></footer>
    </fieldset></form>}
  </>;
  if (modal) return <div className="office-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving.current) onBack(); }}>
    <section ref={dialog} className="office-modal office-platform-user-modal" role="dialog" aria-modal="true" aria-labelledby="edit-platform-user-title" tabIndex={-1}>
      <div className="office-modal-header"><div><h2 id="edit-platform-user-title">Edit customer account</h2><p>These credentials work across all PwarMyar shops.</p></div><button type="button" className="mkpos-dismiss-icon" aria-label="Close customer details" disabled={busy} onClick={onBack}><X size={18} /></button></div>
      <div className="office-modal-body">{content}</div>
    </section>
  </div>;
  return <section className="office-panel office-platform-form">
    <button type="button" disabled={busy} onClick={onBack}><ArrowLeft size={16} />Back to platform users</button>
    <h2>Create customer account</h2><p>These credentials work across all PwarMyar shops.</p>{content}
  </section>;
}

export function PlatformUsersPage({ scope, refreshToken = 0, filterOpen: controlledFilterOpen, onFilterOpen, onFilterClose }) {
  const [localFilterOpen, setLocalFilterOpen] = useState(false);
  const filterOpen = controlledFilterOpen ?? localFilterOpen;
  const closeFilters = onFilterClose || (() => setLocalFilterOpen(false));
  const active = useRetainedActivity();
  const [query, setQuery] = useState({ q: '', ...defaultUserFilters, page: 1, per_page: 25 }), [search, setSearch] = useState('');
  const [result, setResult] = useState({ key: '', data: null, error: '' }), [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState(''), [deleteError, setDeleteError] = useState(''), [deleting, setDeleting] = useState(null), [busy, setBusy] = useState(false);
  const [emailCustomer, setEmailCustomer] = useState(null);
  const mutation = useRef(false);
  const listRoot = useRef(null);
  const nav = usePageNavigation(`platform-users:${scope}`, { id: null }, () => window.location.href, {
    resumeHistory: false,
    capture: () => ({
      window: [window.scrollX, window.scrollY],
      focus: document.activeElement,
      containers: [listRoot.current?.closest('.office-content'), ...listRoot.current?.querySelectorAll('.office-table-scroll') || []]
        .filter(Boolean).map(element => ({ element, left: element.scrollLeft, top: element.scrollTop })),
    }),
    restore: (_view, snapshot) => {
      if (snapshot) requestAnimationFrame(() => {
        for (const { element, left, top } of snapshot.containers) { element.scrollLeft = left; element.scrollTop = top; }
        window.scrollTo(...snapshot.window);
        if (snapshot.focus?.isConnected && !snapshot.focus.closest('[hidden]')) snapshot.focus.focus({ preventScroll: true });
      });
    },
  });
  const key = `${new URLSearchParams(query)}&refresh=${refreshToken}&revision=${revision}`;
  const loading = key !== result.key;
  useEffect(() => {
    let active = true;
    api(`/office/platform-users?${new URLSearchParams(query)}`).then(data => active && setResult({ key, data, error: '' })).catch(e => active && setResult({ key, data: null, error: e.message }));
    return () => { active = false; };
  }, [key, query]);
  async function remove() {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setDeleteError('');
    try {
      await api(`/office/platform-users/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null); setNotice('Customer account deleted. Existing orders have been retained.'); setRevision(n => n + 1);
    } catch (e) { setDeleteError(e.message); } finally { mutation.current = false; setBusy(false); }
  }
  function open(id) { setNotice(''); nav.go({ id }); }
  function saved(row) {
    setNotice('Customer account saved.');
    if (nav.view.id === 'new') { setRevision(n => n + 1); return; }
    const matches = (query.status === 'all' || row.is_active === (query.status === 'active'))
      && (query.phone === 'all' || Boolean(row.phone?.trim()) === (query.phone === 'present'))
      && (query.address === 'all' || Boolean(row.address?.trim()) === (query.address === 'present'))
      && (!query.q || [row.name, row.email, row.phone].some(value => String(value || '').toLowerCase().includes(query.q.toLowerCase())));
    setResult(current => {
      if (!current.data) return current;
      const present = current.data.items.some(item => item.id === row.id);
      if (!present) return current;
      const total = current.data.total - (matches ? 0 : 1);
      return { ...current, data: { ...current.data, total, last_page: Math.max(1, Math.ceil(total / query.per_page)),
        items: matches ? current.data.items.map(item => item.id === row.id ? row : item) : current.data.items.filter(item => item.id !== row.id) } };
    });
    if (!matches || query.sort === 'name') setRevision(n => n + 1);
  }
  const data = result.data;
  return <>
    <OfficePageToolbar visible={nav.view.id !== 'new'} searchLabel="Search platform users" placeholder="Search name, email or phone"
      search={search} onSearchChange={setSearch} onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))}
      onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }}
      actionLabel="New customer" onCreate={() => open('new')} busy={busy || !!nav.view.id || !!emailCustomer} filterOpen={filterOpen}
      filterCount={Object.entries(defaultUserFilters).filter(([key, value]) => query[key] !== value && !['registered_from', 'registered_to'].includes(key)).length + (query.registered_from || query.registered_to ? 1 : 0)}
      onFilterOpen={onFilterOpen || (() => setLocalFilterOpen(true))} />
    <PlatformUserFilters open={filterOpen && active && !nav.view.id && !emailCustomer} query={query} busy={busy} onClose={closeFilters}
      onApply={filters => { setQuery(current => ({ ...current, ...filters, page: 1 })); closeFilters(); }}
      onClear={() => { setQuery(current => ({ ...current, ...defaultUserFilters, page: 1 })); closeFilters(); }} />
    <div ref={listRoot} hidden={nav.view.id === 'new'} aria-hidden={!!nav.view.id || !!emailCustomer || undefined} className="office-platform-users">
      {notice && <p className="office-success" role="status">{notice}</p>}
      <section className="office-panel office-table-panel">
        {loading ? <OfficeTableLoading columns={["Customer", "Email", "Phone", "Status", "Registered"]} label="Loading platform users..."/> : result.error ? <p className="feedback error" role="alert">{result.error} <button type="button" onClick={() => setRevision(n => n + 1)}>Retry</button></p> : data && <>
          <div className="office-table-scroll"><table className="office-data-table" aria-label="Platform users"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Status</th><th>Registered</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small>#{row.id}</small></td><td>{row.email}</td><td>{row.phone || '—'}</td><td><span className={`office-status office-status-${row.is_active ? 'active' : 'inactive'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td><td>{officeDate(row.created_at)}</td><OfficeActionCell><RowActions label={row.name}><button type="button" onClick={() => open(row.id)}><Pencil size={15} />View / edit</button><button type="button" onClick={() => { setNotice(''); setEmailCustomer(row); }}><Mail size={15} />Send email</button><button type="button" className="danger-button" onClick={() => { setDeleteError(''); setDeleting(row); }}><Trash2 size={15} />Delete</button></RowActions></OfficeActionCell></tr>)}</tbody></table></div>
          {!data.items.length && <p className="office-business-message">No customers match these filters.</p>}
          <OfficeTablePagination label="Customer" total={data.total} page={data.page} perPage={query.per_page} lastPage={data.last_page} onPageChange={page => setQuery({ ...query, page })} onPerPageChange={per_page => setQuery({ ...query, per_page, page: 1 })} />
        </>}
      </section>
    </div>
    {emailCustomer && <PlatformUserEmail key={emailCustomer.id} customer={emailCustomer} onClose={() => setEmailCustomer(null)} onSent={message => { setNotice(message); setEmailCustomer(null); }} />}
    {nav.view.id && <UserForm key={nav.view.id} id={nav.view.id} onBack={() => nav.back({ id: null })} onSaved={saved} />}
    {deleting && <div className="office-modal-backdrop"><section className="office-modal" role="dialog" aria-modal="true" aria-labelledby="delete-customer-title"><div className="office-modal-header"><h2 id="delete-customer-title">Delete customer account?</h2></div><div className="office-platform-delete"><p>Delete <strong>{deleting.name}</strong> ({deleting.email})?</p><p>This permanently removes sign-in access, chats, reviews, reports, favorites, saved addresses and notifications. Existing orders and their saved customer details remain.</p><p>To retain account data, cancel and change the account status to Inactive instead.</p>{deleteError && <p className="feedback error" role="alert">{deleteError}</p>}<footer><button type="button" autoFocus disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="office-button-danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete customer'}</button></footer></div></section></div>}
  </>;
}
