import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { ChoiceGroup, Button, IconButton, Input, Radio, SearchInput, Select, Textarea } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Ban, ChevronRight, Mail, MapPin, MessageSquare, MoreHorizontal, Phone, Search, ShieldCheck, ShoppingBag, TriangleAlert, UserRound, UserRoundPlus, Users, Wallet } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileFilterToggle, MobileFilterPanel, MobileFilterActions, MobileSheet, MobileNotice } from '../components/MobilePrimitives';
import { CsvExportButton } from '../components/CsvExportButton';
import { AppBarAction } from '../navigation/AppBarAction';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { SHOP_ORDER_COLUMNS, loadShopOrderExport } from './shopOrderCsv';
import { ShopCustomerCredit } from './ShopCustomerCredit';
import { useEndlessList } from '../hooks/useEndlessList';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ShopBusy, ShopField, ShopLoadState, ShopLoading } from './ShopPrimitives';
import { OrderCard } from './OrderCard';
import { useShopResource } from './useShopResource';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { canShop, ORDER_STATES, shopDate, shopLabel, shopMoney } from './shopUtils';

function CustomerHistory({ customerKey, customerName, session, onNavigate, exportTarget }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [open, setOpen] = useState(false), [notice, setNotice] = useState(null);
  const empty = { status: '', date_from: '', date_to: '' };
  const [filters, setFilters] = useState(empty), [draft, setDraft] = useState(empty), [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const queryKey = new URLSearchParams({ q: query, ...filters }).toString();
  const list = useEndlessList({ queryKey, loadPage: ({ limit, offset, signal }) => apiRequest(`/shop-admin/customers/${encodeURIComponent(customerKey)}/history?${queryKey}&limit=${limit}&offset=${offset}`, { signal }) });
  usePageRefresh(list.reload);
  return <section className="shop-customer-history"><header className="shop-customer-section-heading"><ShoppingBag size={18} aria-hidden="true" /><h2>Order history</h2></header><div className="shop-customer-history-controls"><SearchInput className="shop-mobile-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search customer order history</span><Input type="search" aria-label="Search customer order history" placeholder="Search orders" value={search} onChange={event => setSearch(event.target.value)} /></SearchInput><MobileFilterToggle open={open} onToggle={() => { setDraft({ ...filters }); setError(''); setOpen(true); }} controls="shop-customer-history-filters" count={Object.values(filters).filter(Boolean).length} /><AppBarAction target={exportTarget}><CsvExportButton compact label="Export order history" onNotice={setNotice} onExport={() => exportFilteredCsv({ loadRows: () => loadShopOrderExport(`/shop-admin/customers/${encodeURIComponent(customerKey)}/history?${queryKey}`), filename: csvFilename('buyer-orders'), columns: SHOP_ORDER_COLUMNS })} /></AppBarAction></div><MobileNotice notice={notice} onClose={() => setNotice(null)} /><p className="buyer-result-count">{list.total ?? list.items.length} orders</p><MobileFilterPanel onClose={() => setOpen(false)} open={open} id="shop-customer-history-filters" className="shop-mobile-filters" onSubmit={event => { event.preventDefault(); if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) { setError('End date must be on or after start date.'); return; } setError(''); setFilters({ ...draft }); setOpen(false); }}><ShopField id={`buyer-history-${encodeURIComponent(customerKey)}-status`} name="history-status" label="Order status"><Select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="">All orders</option>{ORDER_STATES.map(status => <option key={status} value={status}>{shopLabel(status)}</option>)}</Select></ShopField>{['date_from', 'date_to'].map(name => <ShopField id={`buyer-history-${encodeURIComponent(customerKey)}-${name}`} name={name} key={name} label={name === 'date_from' ? 'From date' : 'To date'}><Input type="date" value={draft[name]} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /></ShopField>)}{error && <p role="alert">{error}</p>}<MobileFilterActions onClear={() => { setDraft({ ...empty }); setFilters({ ...empty }); setError(''); }} /></MobileFilterPanel><div className="shop-mobile-list">{list.initialLoading && <ShopLoading label="Loading order history…" variant="list" />}{list.error && !list.items.length && <p role="alert">{list.error} <Button variant="plain" type="button" onClick={list.retry}>Retry history</Button></p>}{!list.initialLoading && !list.error && !list.items.length && <p>No matching orders.</p>}{list.items.map(order => <OrderCard key={order.id} order={{ ...order, customer_name: order.customer_name || customerName }} timezone={session?.business?.timezone} onNavigate={onNavigate} />)}<EndlessListFooter list={list} count={list.items.length} noun="orders" /></div></section>;
}

function BuyerBadge({ customer }) {
  return <span className={`buyer-badge${customer.blocked ? ' is-blocked' : ''}`}>{customer.blocked ? 'Blocked' : customer.account_type === 'account' ? 'Registered' : 'Guest'}</span>;
}

function ShopCustomerCard({ customer, onNavigate }) {
  const name = customer.customer_name?.trim() || 'Guest customer';
  return <article className="customer-mobile-card"><Button variant="plain" type="button" className="customer-mobile-card-main shop-customer-list-card" aria-label={`View customer ${name}`} onClick={() => onNavigate(`/shop/customers/${encodeURIComponent(customer.customer_key)}`)}>
    <span className="customer-mobile-card-copy"><span className="buyer-name-line"><strong>{name}</strong><BuyerBadge customer={customer} /></span><small><Phone size={12} />{customer.phone || 'No phone number'}</small>{customer.email && <small><Mail size={12} />{customer.email}</small>}</span>
    <span className="buyer-list-totals"><small><ShoppingBag size={13} />{Number(customer.purchase_count || 0).toLocaleString()} orders</small>{customer.spending?.map(row => <strong key={row.currency}>{shopMoney(row.completed_spend, row.currency)}</strong>)}</span><ChevronRight size={16} aria-hidden="true" />
  </Button></article>;
}

export function ShopCustomers({ session, onNavigate }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [open, setOpen] = useState(false), [notice, setNotice] = useState(null);
  const blank = { account: 'all', block_status: 'all', sort: 'recent' };
  const [filters, setFilters] = useState(blank), [draft, setDraft] = useState(blank);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const queryKey = new URLSearchParams({ q: query, ...filters }).toString();
  const list = useEndlessList({ queryKey, loadPage: ({ limit, offset, signal }) => apiRequest(`/shop-admin/customers?${queryKey}&limit=${limit}&offset=${offset}`, { signal }) });
  usePageRefresh(list.reload);
  const exportCustomers = () => exportFilteredCsv({ path: `/shop-admin/customers?${queryKey}`, filename: csvFilename('shop-customers'), columns: [
    { label: 'Name', value: row => row.customer_name }, { label: 'Type', value: row => row.account_type }, { label: 'Phone', value: row => row.phone }, { label: 'Email', value: row => row.email }, { label: 'Blocked', value: row => row.blocked ? 'Yes' : 'No' }, { label: 'Orders', value: row => row.purchase_count }, { label: 'Completed spending by currency', value: row => row.spending?.map(total => shopMoney(total.completed_spend, total.currency)).join('; ') || '' },
  ] });
  const activeFilterCount = Number(filters.account !== 'all') + Number(filters.block_status !== 'all') + Number(filters.sort !== 'recent');
  return <section className="shop-customers-screen">
    <ShopBuyerHeader title="Shop customers" onBack={() => onNavigate('/shop')} actions={<CsvExportButton compact label="Export customers" onNotice={setNotice} onExport={exportCustomers} />} />
    <MobileNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="shop-customers-controls">
      <SearchInput className="mobile-search product-search" type="search" aria-label="Search shop customers" placeholder="Search customers" value={search} onChange={event => setSearch(event.target.value)} onClear={() => { setSearch(''); setQuery(''); }} clearLabel="Clear customer search" />
      <MobileFilterToggle open={open} onToggle={() => { setDraft({ ...filters }); setOpen(true); }} controls="shop-customer-filters" count={activeFilterCount} />
    </div>
    <MobileFilterPanel onClose={() => setOpen(false)} open={open} id="shop-customer-filters" className="shop-mobile-filters buyer-filter" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); setOpen(false); }}>
      {[['account', 'Type', [['all', 'All'], ['account', 'Registered'], ['guest', 'Guest']]], ['block_status', 'Blocked state', [['all', 'All'], ['not_blocked', 'Not blocked'], ['blocked', 'Blocked']]]].map(([key, title, options]) => <ChoiceGroup className="buyer-filter-group" key={key}><legend>{title}</legend>{options.map(([value, label]) => <label key={value}><Radio type="radio" name={key} value={value} checked={draft[key] === value} onChange={() => setDraft({ ...draft, [key]: value })} />{label}</label>)}</ChoiceGroup>)}
      <ShopField name="sort" label="Sort"><Select value={draft.sort} onChange={event => setDraft({ ...draft, sort: event.target.value })}><option value="recent">Recent purchase</option><option value="name">Name: A to Z</option><option value="purchases">Most purchases</option></Select></ShopField><MobileFilterActions onClear={() => { setDraft({ ...blank }); setFilters({ ...blank }); }} />
    </MobileFilterPanel>
    <p className="buyer-result-count">{list.total ?? list.items.length} customers</p>
    <div className="shop-mobile-list">
      {list.initialLoading && <ShopLoading label="Loading customers…" variant="contacts" />}
      {list.error && !list.items.length && <div className="shop-customers-empty" role="alert"><p>{list.error}</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={list.retry}>Retry customers</Button></div>}
      {!list.initialLoading && !list.error && !list.items.length && <div className="shop-customers-empty"><Users size={28} aria-hidden="true" /><h2>No customers found</h2><p>No customers match these filters.</p></div>}
      {list.items.map(customer => <ShopCustomerCard key={customer.id} customer={customer} timezone={session?.business?.timezone} onNavigate={onNavigate} />)}
      <EndlessListFooter list={list} count={list.items.length} noun="customers" />
    </div>
  </section>;
}

function BuyerProfile({ customer, actions }) {
  const name = customer.customer_name?.trim() || 'Guest customer';
  const initials = name.split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase();
  return <section className="shop-customer-hero"><div className="shop-customer-identity"><span className="shop-customer-avatar" aria-hidden="true"><ProfileAvatar url={customer.avatar_url}>{initials || <UserRound size={24} />}</ProfileAvatar></span><div><strong>{name}</strong><BuyerBadge customer={customer} /></div></div><dl className="shop-customer-contacts">{[[Phone, 'Phone', customer.phone], [Mail, 'Email', customer.email], [MapPin, 'Address', customer.address]].filter(([, , value]) => value).map(([Icon, label, value]) => <div key={label}><Icon size={14} aria-hidden="true" /><div><dt className="sr-only">{label}</dt><dd>{value}</dd></div></div>)}</dl>{actions && <div className="buyer-profile-actions">{actions}</div>}</section>;
}

function BuyerStatistics({ report, timezone }) {
  return <section className="shop-customer-panel buyer-statistics"><header className="shop-customer-section-heading"><Wallet size={17} /><h2>Purchase statistics</h2></header><div className="buyer-purchase-grid">{report?.currencies?.length ? report.currencies.map(row => <div key={row.currency}><ShoppingBag size={22} aria-hidden="true" /><span><strong>{shopMoney(row.completed_spend, row.currency)}</strong><small>{row.purchase_count ?? report.completed_orders ?? 0} orders</small></span></div>) : <p className="shop-customer-note">No completed spending yet.</p>}</div>
    <div className="buyer-purchase-details"><h3>Purchase details</h3><dl className="buyer-more-statistics">
      {[
        ['Total orders', report?.total_orders], ['Completed', report?.completed_orders], ['Active', report?.active_orders],
        ['Cancelled', report?.cancelled_orders], ['Expired', report?.expired_orders],
        ['First purchase', report?.first_purchase_at, true], ['Last purchase', report?.last_purchase_at, true],
      ].map(([label, value, date]) => <div key={label}><dt>{label}</dt><dd>{date && value ? shopDate(value, timezone) : value ?? '—'}</dd></div>)}
      {report?.currencies?.map(row => <React.Fragment key={row.currency}>{[['Average purchase', row.average_purchase], ['Refunded', row.refunded], ['Refund pending', row.refund_pending]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{shopMoney(value, row.currency)}</dd></div>)}</React.Fragment>)}
    </dl></div>
  </section>;
}

export function ShopCustomerDetail({ customerKey, session, onNavigate }) {
  const exportTarget = useRef(null);
  const resource = useShopResource(`/shop-admin/customers/${encodeURIComponent(customerKey)}`), customer = resource.data?.customer, report = resource.data?.report;
  const [error, setError] = useState(''), [chatBusy, setChatBusy] = useState(false), [more, setMore] = useState(false), working = useRef(false);
  async function chat() {
    if (working.current) return; working.current = true; setChatBusy(true); setError('');
    try { const result = await apiRequest(`/shop-admin/customers/${encodeURIComponent(customerKey)}/chat`, { method: 'POST', body: '{}' }); onNavigate(`/shop/chat/${result.thread.uuid}`); }
    catch (e) { setError(e.message); } finally { working.current = false; setChatBusy(false); }
  }
  const name = customer?.customer_name?.trim() || 'Guest customer';
  const canChat = customer?.account_type === 'account' && canShop(session, 'ecommerce_process');
  const chatButton = <Button variant="plain" type="button" aria-label="Chat" disabled={!canChat || chatBusy} onClick={chat}><MessageSquare size={18} aria-hidden="true" /><span>{chatBusy ? <ShopBusy label="Opening chat..." /> : 'Chat'}</span></Button>;
  const moreButton = <Button variant="plain" type="button" aria-label="More" onClick={() => setMore(true)}><MoreHorizontal size={19} aria-hidden="true" /><span>More</span></Button>;
  return <><ShopBuyerHeader title={customer ? name : 'Customer details'} onBack={() => onNavigate('/shop/customers', { back: true })} actions={<>{chatButton}<span className="app-bar-actions" ref={exportTarget}/></>} /><ShopLoadState resource={resource}>{customer && <div className="shop-mobile-detail shop-customer-detail"><BuyerProfile customer={customer} actions={<>{chatButton}{moreButton}</>} />{error && <p className="shop-mobile-error" role="alert">{error}</p>}<BuyerStatistics report={report} timezone={session?.business?.timezone} /><CustomerHistory exportTarget={exportTarget} customerKey={customerKey} customerName={name} session={session} onNavigate={onNavigate} />
    <MobileSheet open={more} title="Customer options" description={name} onClose={() => setMore(false)} className="mobile-sheet--action-menu buyer-options">
      <div className={`buyer-options-status${customer.blocked ? ' is-blocked' : ''}`}>{customer.blocked ? <Ban size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}<div><span>Account status</span><strong>{customer.blocked ? 'Blocked' : 'Not blocked'}</strong></div></div>
      {customer.block_reason && <p className="buyer-options-reason">{customer.block_reason}</p>}
      <div className="mobile-action-menu">
        {canShop(session, 'customers') && <Button variant="plain" type="button" disabled={!!customer.credit_customer_id} onClick={() => { setMore(false); onNavigate(`/shop/customers/${encodeURIComponent(customerKey)}/action/credit`); }}><UserRoundPlus size={18} aria-hidden="true" /><span><strong>{customer.credit_customer_id ? 'Credit contact linked' : 'Link credit contact'}</strong></span><ChevronRight className="mobile-action-chevron" size={16} aria-hidden="true" /></Button>}
        {canShop(session, 'ecommerce_process') && <Button variant={customer.blocked ? 'plain' : 'danger-ghost'} type="button" className={customer.blocked ? '' : 'danger-action'} onClick={() => { setMore(false); onNavigate(`/shop/customers/${encodeURIComponent(customerKey)}/action/block`); }}>{customer.blocked ? <ShieldCheck size={18} aria-hidden="true" /> : <Ban size={18} aria-hidden="true" />}<span><strong>{customer.blocked ? 'Unblock customer' : 'Block customer'}</strong></span><ChevronRight className="mobile-action-chevron" size={16} aria-hidden="true" /></Button>}
      </div>
    </MobileSheet>
  </div>}</ShopLoadState></>;
}

export function ShopCustomerAction({ customerKey, action, session, onNavigate }) {
  const resource = useShopResource(`/shop-admin/customers/${encodeURIComponent(customerKey)}`), customer = resource.data?.customer;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState(''), working = useRef(false);
  const close = () => { if (!working.current && !busy) onNavigate(`/shop/customers/${encodeURIComponent(customerKey)}`, { back: true }); };
  async function block(event) {
    event.preventDefault(); if (working.current) return; working.current = true; setBusy(true); setError('');
    try { await apiRequest(`/shop-admin/customers/${encodeURIComponent(customerKey)}/block`, { method: 'PUT', body: JSON.stringify({ blocked: !customer.blocked, reason: reason.trim() || null }) }); onNavigate(`/shop/customers/${encodeURIComponent(customerKey)}`, { replace: true }); }
    catch (e) { setError(e.message); } finally { working.current = false; setBusy(false); }
  }
  const allowed = action === 'block' ? canShop(session, 'ecommerce_process') : action === 'credit' && canShop(session, 'customers') && !customer?.credit_customer_id;
  if (action === 'credit') return <><ShopBuyerHeader title="Link credit contact" onBack={close} /><ShopLoadState resource={resource}>{customer && (allowed ? <ShopCustomerCredit customer={customer} customerKey={customerKey} onNavigate={onNavigate} onCancel={close} onBusyChange={setBusy} /> : <p role="alert">This action is unavailable for your account.</p>)}</ShopLoadState></>;
  const title = customer?.blocked ? 'Unblock this customer?' : 'Block this customer?';
  return <><div aria-hidden="true" inert=""><ShopBuyerHeader title={customer?.customer_name || 'Customer details'} /><div className="shop-mobile-detail shop-customer-detail">{customer && <><BuyerProfile customer={customer} /><BuyerStatistics report={resource.data?.report} timezone={session?.business?.timezone} /><section className="shop-customer-panel"><h2>Account status</h2><p>{customer.blocked ? 'Blocked' : 'Not blocked'}</p></section></>}</div></div><ShopLoadState resource={resource}>{customer && (allowed ? <MobileSheet open title={title} onClose={close} className="buyer-block-modal"><form onSubmit={block}><span className="buyer-block-icon">{customer.blocked ? <ShieldCheck size={25} /> : <TriangleAlert size={25} />}</span><p>{customer.blocked ? 'Allow this customer to place new orders at your shop.' : 'This customer will no longer be able to place new orders at your shop. Existing orders and history will remain available.'}</p>{!customer.blocked && <label className="buyer-reason">Reason (optional)<Textarea maxLength={200} value={reason} onChange={event => setReason(event.target.value)} placeholder="Enter a reason for blocking this customer" /><small>{reason.length}/200</small></label>}{error && <p role="alert">{error}</p>}<div className="buyer-modal-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={close}>Cancel</Button><Button variant={customer.blocked ? 'primary' : 'danger'} type="submit" className={customer.blocked ? 'mobile-primary' : 'mobile-danger'} disabled={busy}>{busy ? <ShopBusy label="Saving..." /> : customer.blocked ? 'Unblock customer' : 'Block customer'}</Button></div></form></MobileSheet> : <p role="alert">This action is unavailable for your account.</p>)}</ShopLoadState></>;
}

function ShopBuyerHeader({ title, onBack, actions }) {
  return <PageAppBar className="shop-buyer-header"><IconButton variant="ghost" className="icon-button" type="button" aria-label="Back to shop" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{actions && <div className="buyer-header-actions">{actions}</div>}<AppBarMenu /></PageAppBar>;
}
