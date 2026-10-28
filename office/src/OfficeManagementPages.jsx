import { ThemeSettings } from './ThemeSettings';
import { Upload, RotateCcw } from 'lucide-react';
import { useRetainedActivity } from './retainedActivity';
import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';
import { OfficePageToolbar, OfficeStatusFilterDrawer } from './OfficePageToolbar';
import {OfficeTableLoadingStatus, OfficeTableLoading, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import { RowActions } from './RowActions';
import { officeDateTime } from './dateTime';
import { applyBranding } from './platformBranding';
import './office-management.css';

function useRecords(path, query, refreshToken) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const params = new URLSearchParams(query).toString();
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      api(`${path}?${params}`).then(value => { if (current) setData(previous => previous?.theme_version && value?.theme_version && value.theme_version < previous.theme_version ? previous : value); }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [path, params, refreshToken, revision]);
  return { data, error, loading, replace: setData, reload: () => setRevision(v => v + 1) };
}

function Feedback({ records, columns }) {
  return <>{records.error && <div className="feedback error" role="alert">{records.error}<button type="button" onClick={records.reload}>Retry</button></div>}{records.loading && records.data && columns && <OfficeTableLoadingStatus />}{records.loading && !records.data && <>{columns ? <OfficeTableLoading columns={columns} /> : <p role="status">Loading...</p>}</>}</>;
}

function Pagination({ data, query, setQuery, loading, label }) {
  return data && <OfficeTablePagination label={label} total={data.total} page={data.page} perPage={data.per_page} lastPage={data.last_page} disabled={loading} onPageChange={page => setQuery({ ...query, page })} onPerPageChange={per_page => setQuery({ ...query, per_page, page: 1 })} />;
}

function SaveModal({ title, children, onClose, onSave, action = 'Save changes' }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await onSave(); } catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={title} busy={busy} onClose={onClose}><form className="office-management-form" onSubmit={submit}><fieldset disabled={busy}>{children}{error && <p className="feedback error" role="alert">{error}</p>}<div className="office-management-actions"><button type="button" onClick={onClose}>Cancel</button><button className="office-button-primary" type="submit">{busy ? 'Saving…' : action}</button></div></fieldset></form></OfficeModal>;
}

function AdminForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ name: item?.name || '', email: item?.email || '', role: item?.role || 'admin', is_active: item?.is_active ?? true, password: '', password_confirmation: '' });
  const field = (key, value) => setForm(v => ({ ...v, [key]: value }));
  return <SaveModal title={item ? 'Edit administrator' : 'New administrator'} onClose={onClose} onSave={async () => { await api(`/office/admins${item ? `/${item.id}` : ''}`, { method: item ? 'PUT' : 'POST', body: JSON.stringify(form) }); onSaved(); }}>
    <label>Name<input required maxLength={255} value={form.name} onChange={e => field('name', e.target.value)} /></label>
    <label>Email<input required type="email" autoComplete="off" value={form.email} onChange={e => field('email', e.target.value)} /></label>
    <label>Access level<select value={form.role} onChange={e => field('role', e.target.value)}><option value="admin">Administrator</option><option value="super_admin">Super administrator</option></select></label>
    <small>Administrators manage daily operations, payments and subscriptions. Super administrators also manage admin accounts and system branding.</small>
    <label>Status<select value={String(form.is_active)} onChange={e => field('is_active', e.target.value === 'true')}><option value="true">Active</option><option value="false">Inactive</option></select></label>
    <label>{item ? 'New password (optional)' : 'Password'}<input type="password" autoComplete="new-password" required={!item} minLength={8} value={form.password} onChange={e => field('password', e.target.value)} /></label>
    <label>Confirm password<input type="password" autoComplete="new-password" required={Boolean(form.password)} minLength={8} value={form.password_confirmation} onChange={e => field('password_confirmation', e.target.value)} /></label>
    <small>Changing a password or deactivating an account revokes its access. Historical actions keep the administrator’s identity.</small>
  </SaveModal>;
}

export function AdminsPage({ refreshToken, filterOpen, onFilterOpen, onFilterClose, currentAdminId }) {
  const active = useRetainedActivity();
  const [query, setQuery] = useState({ q: '', status: 'all', page: 1, per_page: 25 }), [search, setSearch] = useState(''), [modal, setModal] = useState(null);
  const records = useRecords('/office/admins', query, refreshToken), { data, loading } = records;
  const saved = () => { setModal(null); records.reload(); };
  return <div className="office-page-stack"><OfficePageToolbar searchLabel="Search administrators" search={search} onSearchChange={setSearch} onSearch={() => setQuery({ ...query, q: search.trim(), page: 1 })} onClearSearch={() => { setSearch(''); setQuery({ ...query, q: '', page: 1 }); }} actionLabel="New administrator" onCreate={() => setModal({ type: 'edit', item: null })} busy={loading} filterOpen={filterOpen} onFilterOpen={onFilterOpen} filterCount={query.status === 'all' ? 0 : 1} />
    <Feedback records={records} columns={["Name", "Email", "Access level", "Status"]} />
    {data && <section className="office-panel office-table-panel"><div className="office-table-scroll"><table className="office-data-table" aria-label="Administrators"><thead><tr><th>Name</th><th>Email</th><th>Access level</th><th>Status</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td>{item.name}{item.id === currentAdminId ? ' (you)' : ''}</td><td>{item.email}</td><td>{item.role === 'super_admin' ? 'Super administrator' : 'Administrator'}</td><td>{item.is_active ? 'Active' : 'Inactive'}</td><OfficeActionCell><RowActions label={`administrator ${item.name}`} disabled={loading}><button type="button" onClick={() => setModal({ type: 'edit', item })}>Edit administrator</button>{item.is_active && item.id !== currentAdminId && <button type="button" className="danger-button" onClick={() => setModal({ type: 'disable', item })}>Deactivate administrator</button>}</RowActions></OfficeActionCell></tr>)}{!data.items.length && <tr><td colSpan={5}>No administrators match.</td></tr>}</tbody></table></div><Pagination label="Administrators" data={data} query={query} setQuery={setQuery} loading={loading} /></section>}
    <OfficeStatusFilterDrawer open={active && filterOpen} title="Administrator filters" status={query.status} options={[[ 'all', 'All statuses' ], ['active', 'Active'], ['inactive', 'Inactive']]} onClose={onFilterClose} onApply={status => { setQuery({ ...query, status, page: 1 }); onFilterClose(); }} onClear={() => { setQuery({ ...query, status: 'all', page: 1 }); onFilterClose(); }} />
    {active && modal?.type === 'edit' && <AdminForm item={modal.item} onClose={() => setModal(null)} onSaved={saved} />}
    {active && modal?.type === 'disable' && <SaveModal title="Deactivate administrator" action="Deactivate administrator" onClose={() => setModal(null)} onSave={async () => { await api(`/office/admins/${modal.item.id}`, { method: 'DELETE' }); saved(); }}><p>Deactivate {modal.item.name}? Their sign-in access will stop. Their activity history remains available.</p></SaveModal>}
  </div>;
}

export function ActivityLogPage({ refreshToken, filterOpen, onFilterOpen, onFilterClose }) {
  const active = useRetainedActivity();
  const [query, setQuery] = useState({ q: '', admin_id: '', page: 1, per_page: 25 }), [search, setSearch] = useState(''), [detail, setDetail] = useState(null);
  const records = useRecords('/office/activity-log', query, refreshToken), { data, loading } = records;
  return <div className="office-page-stack"><OfficePageToolbar searchLabel="Search activity log" search={search} onSearchChange={setSearch} onSearch={() => setQuery({ ...query, q: search.trim(), page: 1 })} onClearSearch={() => { setSearch(''); setQuery({ ...query, q: '', page: 1 }); }} onFilterOpen={onFilterOpen} filterOpen={filterOpen} filterCount={query.admin_id ? 1 : 0} busy={loading} /><Feedback records={records} columns={["Time", "Administrator", "Action", "Target"]} />
    <p>Successful Office changes are recorded with the acting administrator. Payment approvals and subscription access changes appear here from this update onward.</p>
    {data && <section className="office-panel office-table-panel"><div className="office-table-scroll"><table className="office-data-table" aria-label="Admin activity log"><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Target</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td>{officeDateTime(item.created_at)}</td><td><strong>{item.admin_name}</strong><small className="office-management-subtext">{item.admin_email}</small></td><td>{item.action.split('@').pop()}</td><td>{item.method} /{item.path}</td><OfficeActionCell><RowActions label={`activity ${item.id}`}><button type="button" onClick={() => setDetail(item)}>View action details</button></RowActions></OfficeActionCell></tr>)}{!data.items.length && <tr><td colSpan={5}>No recorded actions match.</td></tr>}</tbody></table></div><Pagination label="Activity log" data={data} query={query} setQuery={setQuery} loading={loading} /></section>}
    <OfficeStatusFilterDrawer open={active && filterOpen} title="Activity filters" status={String(query.admin_id)} options={[[ '', 'All administrators' ], ...(data?.admins || []).map(item => [String(item.id), item.name])]} onClose={onFilterClose} onApply={admin_id => { setQuery({ ...query, admin_id, page: 1 }); onFilterClose(); }} onClear={() => { setQuery({ ...query, admin_id: '', page: 1 }); onFilterClose(); }} />
    {active && detail && <OfficeModal title="Action details" description={`${detail.admin_name} · ${officeDateTime(detail.created_at)}`} onClose={() => setDetail(null)} footer={<button type="button" onClick={() => setDetail(null)}>Close</button>}><p>{detail.method} /{detail.path}</p><pre className="office-audit-details">{JSON.stringify(detail.details, null, 2)}</pre></OfficeModal>}
  </div>;
}

function BankForm({ item, onClose, onSaved }) {
  const [name, setName] = useState(item?.name || ''), [active, setActive] = useState(item?.is_active ?? true);
  return <SaveModal title={item ? 'Edit bank book' : 'New bank book'} onClose={onClose} onSave={async () => { await api(`/office/bank-books${item ? `/${item.id}` : ''}`, { method: item ? 'PUT' : 'POST', body: JSON.stringify({ name, is_active: active }) }); onSaved(); }}><label>Bank book name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label><label>Status<select value={String(Boolean(active))} onChange={e => setActive(e.target.value === 'true')}><option value="true">Active</option><option value="false">Archived</option></select></label><small>Archived books keep their balances and history. New transactions require an active book.</small></SaveModal>;
}

export function BankBooksPage({ refreshToken }) {
  const active = useRetainedActivity();
  const [search, setSearch] = useState(''), [query, setQuery] = useState({ q: '', page: 1, per_page: 25 }), [modal, setModal] = useState(null);
  const records = useRecords('/office/bank-books', query, refreshToken), { data, loading } = records;
  const saved = () => { setModal(null); records.reload(); window.dispatchEvent(new Event('mkpos:office-bank-books-changed')); };
  const rows = data?.items || [];
  return <div className="office-page-stack"><OfficePageToolbar searchLabel="Search bank books" search={search} onSearchChange={setSearch} onSearch={() => setQuery({ ...query, q: search.trim(), page: 1 })} onClearSearch={() => { setSearch(''); setQuery({ ...query, q: '', page: 1 }); }} actionLabel="New bank book" onCreate={() => setModal({ type: 'edit', item: null })} busy={loading} /><Feedback records={records} columns={["Bank book", "Status", "Subscription receipts"]} />
    <p>The default book receives new subscription payments. Each payment keeps its original book when the default changes. Opening balances and transfers are managed in Financial book.</p>
    {data && <section className="office-panel office-table-panel"><div className="office-table-scroll"><table className="office-data-table" aria-label="Bank books"><thead><tr><th>Bank book</th><th>Status</th><th>Subscription receipts</th><OfficeActionHeader /></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.is_active ? 'Active' : 'Archived'}</td><td>{item.id === data.subscription_account_id ? 'Default receiving book' : '—'}</td><OfficeActionCell><RowActions label={`bank book ${item.name}`} disabled={loading}><button type="button" onClick={() => setModal({ type: 'edit', item })}>Edit bank book</button>{Boolean(item.is_active) && item.id !== data.subscription_account_id && <button type="button" onClick={() => setModal({ type: 'default', item })}>Receive subscriptions here</button>}<button type="button" className="danger-button" onClick={() => setModal({ type: 'delete', item })}>Delete unused book</button></RowActions></OfficeActionCell></tr>)}{!rows.length && <tr><td colSpan={4}>No bank books match.</td></tr>}</tbody></table></div><Pagination label="Bank books" data={data} query={query} setQuery={setQuery} loading={loading} /></section>}
    {active && modal?.type === 'edit' && <BankForm item={modal.item} onClose={() => setModal(null)} onSaved={saved} />}
    {active && modal && ['default', 'delete'].includes(modal.type) && <SaveModal title={modal.type === 'default' ? 'Change subscription receiving book' : 'Delete unused bank book'} action={modal.type === 'default' ? 'Use this book' : 'Delete book'} onClose={() => setModal(null)} onSave={async () => { await api(modal.type === 'default' ? '/office/subscription-bank-book' : `/office/bank-books/${modal.item.id}`, { method: modal.type === 'default' ? 'PUT' : 'DELETE', ...(modal.type === 'default' ? { body: JSON.stringify({ subscription_account_id: modal.item.id }) } : {}) }); saved(); }}><p>{modal.type === 'default' ? `Receive future subscription payments in ${modal.item.name}? Existing payment balances stay in their original books.` : `Delete ${modal.item.name}? Books with any financial history must be archived instead.`}</p></SaveModal>}
  </div>;
}

export function BrandingPage({ refreshToken }) {
  const records = useRecords('/branding', {}, refreshToken), { data } = records;
  const themeVersion = useRef(null);
  useEffect(() => { if (data?.theme_version) themeVersion.current = data.theme_version; }, [data]);
  useEffect(() => { const updated = event => { const version = event.detail?.theme_version; if (version && themeVersion.current && version !== themeVersion.current) { themeVersion.current = version; records.replace(event.detail); } }; window.addEventListener('mkpos:platform-branding', updated); return () => window.removeEventListener('mkpos:platform-branding', updated); });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const saving = useRef(false);
  async function save(path, options) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { const value = await api(path, options); themeVersion.current = value.theme_version; records.replace(value); applyBranding(value); setNotice('Branding saved. All apps update automatically within 30 seconds.'); }
    catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  return <div className="office-page-stack"><Feedback records={records} />{error && <p className="feedback error" role="alert">{error}</p>}{notice && <p role="status" className="office-success">{notice}</p>}{data && <section className="office-panel office-branding-panel">
    <section className="office-brand-assets-section" aria-label="Brand assets">
      <div className="office-brand-assets-heading"><h2>Brand assets</h2><p>Update the logo and icons shown across your apps.</p></div>
      <div className="office-branding-assets">{[['logo', 'Logo', 'Wide or square image'], ['icon', 'App icon', 'Square image recommended'], ['favicon', 'Favicon', 'Square image for browser tabs']].map(([key, label, hint]) => <article key={key}>
        <div className={`office-brand-asset-preview office-brand-asset-preview-${key}`}><img src={data[`${key}_url`] || `${import.meta.env.BASE_URL}branding/pwarmyar-mark.png`} alt={`Current ${label.toLowerCase()}`} /><span>{data[`${key}_url`] ? 'Custom' : 'Default'}</span></div>
        <div className="office-brand-asset-title"><h3>{label}</h3><small>{hint}</small></div>
        <label className={`office-brand-asset-upload${busy ? ' is-disabled' : ''}`}><Upload size={14} aria-hidden="true"/><span>{data[`${key}_url`] ? 'Change image' : 'Upload image'}</span><input aria-label={`Upload ${label.toLowerCase()}`} disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Images must be 2 MB or smaller.'); e.target.value = ''; return; } const body = new FormData(); body.append('image', file); save(`/office/branding/${key}`, { method: 'POST', body }); e.target.value = ''; }} /></label>
        <small className="office-brand-asset-format">PNG, JPEG or WebP · Max 2 MB</small>
        {data[`${key}_url`] && <button className="office-brand-asset-reset" type="button" disabled={busy} onClick={() => save(`/office/branding/${key}`, { method: 'DELETE' })}><RotateCcw size={13} aria-hidden="true"/>Restore default {label.toLowerCase()}</button>}
      </article>)}</div>
      <p className="office-brand-assets-note">Installed app icons may require an app update or reinstall.</p>
    </section>
    <ThemeSettings branding={data} onSaved={value => { themeVersion.current = value.theme_version; records.replace(value); applyBranding(value); setNotice('Theme applied to all apps. Open apps update automatically within 30 seconds.'); }} />
  </section>}</div>;
}
