import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { Switch, Button, Checkbox, IconButton, Input, Radio, SearchInput, Select, Textarea } from '../components/Controls';
import { useShopResource } from './useShopResource';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, BadgeCheck, Check, CheckCheck, ChevronDown, ChevronRight, CreditCard, History, MessageSquare, Package, PackageCheck, Printer, RotateCcw, ShieldCheck, Store, Truck, Undo2, UserRound, XCircle } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileFilterToggle, MobileFilterPanel, MobileNotice, MobileSheet } from '../components/MobilePrimitives';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { SHOP_ORDER_COLUMNS, loadShopOrderExport } from './shopOrderCsv';
import { OrderBadge, OrderCard } from './OrderCard';
import { ShopOrdersHeader, OrderUnavailable, OrderItemPhoto, OrderActionSummary, OrderReceivingAccount, OrderContextLink } from './ShopOrderPresentation';
import { printShopOrder } from './shopOrderPrint';
import { OrderRoadmap } from './OrderRoadmap.jsx';
import { useEndlessList } from '../hooks/useEndlessList';
import { PageActivityContext, usePageRefresh } from '../navigation/pageRefresh';
import { ShopBusy, ShopField, ShopLoadState, ShopLoading, ShopPrivateImage } from './ShopPrimitives';
import { ShopDatePresets } from './ShopDatePresets';
import { canShop, ORDER_STATES, PAYMENT_STATES, shopOrderActions, orderActionRequest, shopMoney, shopDate, shopLabel, fieldErrors } from './shopUtils';

const EMPTY_FILTERS = { status: '', payment_status: '', date_from: '', date_to: '', requests: false, sort: 'newest' };
const ORDER_ACTION_ICONS = {
  accepted: BadgeCheck, packing: Package, ready_for_pickup: PackageCheck,
  dispatched: Truck, completed: CheckCheck, cancelled: XCircle,
  return_pending: Undo2, reopen: RotateCcw, confirm: ShieldCheck,
  reject: XCircle, refund: CreditCard,
};

export function ShopOrders({ onNavigate, session }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_FILTERS), [filters, setFilters] = useState(EMPTY_FILTERS), [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const queryKey = new URLSearchParams({ q: query, ...filters, requests: filters.requests ? '1' : '0' }).toString();
  const list = useEndlessList({ queryKey, loadPage: ({ limit, offset, signal }) => apiRequest(`/shop-admin/orders?${queryKey}&limit=${limit}&offset=${offset}`, { signal }) });
  usePageRefresh(list.reload, { reconcilePage: list.reconcile });
  const reconcileOrders = list.reload;
  useEffect(() => {
    let timer;
    const changed = () => { clearTimeout(timer); timer = setTimeout(() => { void reconcileOrders(); }, 80); };
    window.addEventListener('mkpos:shop-order-changed', changed);
    return () => { clearTimeout(timer); window.removeEventListener('mkpos:shop-order-changed', changed); };
  }, [reconcileOrders]);
  const exportOrders = () => exportFilteredCsv({ loadRows: () => loadShopOrderExport(`/shop-admin/orders?${queryKey}`), filename: csvFilename('online-orders'), columns: SHOP_ORDER_COLUMNS, emptyMessage: 'No orders match the current filters.' });
  function apply(event) {
    event.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) { setError('End date must be on or after the start date.'); return; }
    setError(''); setFilters({ ...draft }); setOpen(false);
  }
  return <section className="shop-orders-screen">
    <ShopOrdersHeader onBack={() => onNavigate('/shop', { back: true })} actions={<CsvExportButton compact label="Export orders" onExport={exportOrders} onNotice={setNotice} />} />
    <MobileNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="shop-order-controls"><SearchInput className="mobile-search product-search" type="search" aria-label="Search orders" placeholder="Search orders" value={search} onChange={event => setSearch(event.target.value)} onClear={() => { setSearch(''); setQuery(''); }} clearLabel="Clear order search" /><MobileFilterToggle open={open} onToggle={() => { setDraft({ ...filters }); setError(''); setOpen(true); }} controls="shop-order-filters" count={Object.entries(filters).filter(([key, value]) => key === 'sort' ? value !== 'newest' : Boolean(value)).length} /></div>
    <MobileFilterPanel onClose={() => setOpen(false)} open={open} id="shop-order-filters" className="shop-order-filters" onSubmit={apply}>
      <ShopField name="order-status" label="Order status"><Select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="">All statuses</option>{ORDER_STATES.map(status => <option value={status} key={status}>{shopLabel(status)}</option>)}</Select></ShopField>
      <ShopField name="order-payment" label="Payment status"><Select value={draft.payment_status} onChange={event => setDraft({ ...draft, payment_status: event.target.value })}><option value="">All payments</option>{PAYMENT_STATES.map(status => <option value={status} key={status}>{shopLabel(status)}</option>)}</Select></ShopField>
      <fieldset className="shop-order-date-range"><legend>Order date</legend><ShopDatePresets timezone={session?.business?.timezone} onChange={dates => setDraft({ ...draft, ...dates })} /><ShopField name="order-from" label="From date"><Input type="date" value={draft.date_from} onChange={event => setDraft({ ...draft, date_from: event.target.value })} /></ShopField><ShopField name="order-to" label="To date"><Input type="date" value={draft.date_to} onChange={event => setDraft({ ...draft, date_to: event.target.value })} /></ShopField></fieldset>
      <ShopField name="order-timezone" label="Timezone"><Input readOnly value={session?.business?.timezone || 'Asia/Rangoon'} /></ShopField>
      <label className="shop-order-request-filter"><span><strong>Pending customer requests only</strong><small>Show orders with customer requests needing review.</small></span><Switch type="checkbox" role="switch" checked={draft.requests} onChange={event => setDraft({ ...draft, requests: event.target.checked })} /></label>
      <ShopField name="order-sort" label="Sort orders"><Select value={draft.sort} onChange={event => setDraft({ ...draft, sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></Select></ShopField>
      {error && <p className="shop-order-filter-error" role="alert">{error}</p>}
      <div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={() => { setDraft({ ...EMPTY_FILTERS }); setFilters({ ...EMPTY_FILTERS }); setError(''); }}>Reset</MobileFilterResetButton><Button variant="primary" className="mobile-primary" type="submit"><Check size={18} aria-hidden="true" />Apply filters</Button></div>
    </MobileFilterPanel>
    <div className="shop-order-result-row"><p>{list.total !== null ? `${list.items.length < list.total ? `${list.items.length} of ` : ''}${list.total} orders` : 'Loading orders...'}</p></div>
    <div className="shop-mobile-list">{list.initialLoading && <ShopLoading label="Loading orders..." variant="list" />}{!list.initialLoading && !list.error && !list.items.length && <p className="shop-mobile-card">No orders match these filters.</p>}{list.error && !list.items.length && <div className="shop-orders-load-error" role="alert"><p>{list.error}</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={list.retry}>Retry orders</Button></div>}{list.items.map(order => <OrderCard key={order.id} order={order} timezone={session?.business?.timezone} onNavigate={onNavigate} />)}<EndlessListFooter list={list} count={list.items.length} noun="orders" labels={{ retry: 'Retry' }} /></div>
  </section>;
}

function OrderPanel({ title, icon: Icon, children, className = '' }) {
  return <section className={`shop-order-panel ${className}`.trim()}>
    <header className="shop-order-panel-heading">{Icon && <span><Icon size={18} aria-hidden="true" /></span>}<h2>{title}</h2></header>
    {children}
  </section>;
}

export function ShopOrderDetail({ id, onNavigate, session, initialAction = null, initialRequestId = null, onModalClose }) {
  const resource = useShopResource(`/shop-admin/orders/${id}`);
  const active = useContext(PageActivityContext);
  const reloadOrder = resource.reload;
  useEffect(() => {
    const update = event => { if (Number(event.detail?.orderId) === Number(id) || event.detail?.orderIds?.includes(Number(id))) void reloadOrder(); };
    window.addEventListener('mkpos:owner-order-activity', update);
    return () => { window.removeEventListener('mkpos:owner-order-activity', update); };
  }, [active, id, reloadOrder]);
  const detailRef = useRef(null);
  const [modal, setModal] = useState(() => initialAction ? { type: 'action', key: initialAction } : initialRequestId ? { type: 'request', key: initialRequestId } : null);
  const [modalBusy, setModalBusy] = useState(false);
  const modalReady = Boolean(modal && resource.data && active);
  useEffect(() => {
    if (!modalReady) return undefined;
    const trigger = document.activeElement;
    const dialog = detailRef.current?.querySelector('.shop-order-action-modal');
    dialog?.querySelector('button')?.focus();
    function trapFocus(event) {
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      if (trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus({ preventScroll: true });
    };
  }, [modalReady]);
  function closeModal() {
    if (modalBusy) return;
    setModal(null);
    onModalClose?.();
  }
  async function actionSaved(updatedOrder) {
    if (String(updatedOrder?.id) === String(id)) resource.setData(updatedOrder);
    else await resource.reload();
    setSelectedProof(null);
    setModal(null);
    onModalClose?.({ saved: true });
  }
  const [history, setHistory] = useState(true), [fulfillmentOpen, setFulfillmentOpen] = useState(false), [proofOpen, setProofOpen] = useState(false), [printing, setPrinting] = useState(false), [printError, setPrintError] = useState(''), [selectedProof, setSelectedProof] = useState(null), [selectedPhoto, setSelectedPhoto] = useState(null);
  const order = resource.data;
  const proofs = order?.payments?.filter(payment => payment.type === 'proof') || [];
  const proof = selectedProof || proofs.at(-1)?.id;
  const timezone = session?.business?.timezone;
  const actions = order ? shopOrderActions(order, session) : [];
  const FulfillmentIcon = order?.fulfillment === 'delivery' ? Truck : Store;
  const customerName = order?.customer_name?.trim() || 'Guest customer';
  const customerInitials = order?.customer_name?.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase();
  const primary = actions.find(action => !['cancelled', 'return_pending', 'confirm', 'reject', 'refund', 'reopen'].includes(action.key));
  async function printOrder() {
    if (printing) return; setPrinting(true); setPrintError('');
    try { if (!await printShopOrder(order, timezone)) setPrintError('Allow pop-ups to print this order.'); }
    catch (e) { setPrintError(e.message); } finally { setPrinting(false); }
  }
  return <><ShopOrdersHeader title={order?.reference || `Order #${id}`} onBack={() => onNavigate('/shop/orders', { back: true })} actions={order && <IconButton variant="ghost" type="button" className="icon-button" aria-label="Print order" aria-busy={printing} disabled={printing} onClick={printOrder}><Printer size={21} aria-hidden="true" /></IconButton>} />{resource.error && !order ? <OrderUnavailable error={resource.error} onBack={() => onNavigate('/shop/orders', { back: true })} onRetry={resource.reload} /> : <ShopLoadState resource={resource}>{order && <div ref={detailRef} className="shop-order-detail">
    <section className="shop-order-detail-hero"><div className="shop-order-hero-top"><div><small>{shopDate(order.created_at, timezone)}</small><strong>{shopMoney(order.total, order.currency)}</strong><span>{(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} units · {order.items?.length || 0} items</span></div><div><OrderBadge value={order.status} statusIcon /><OrderBadge value={order.payment_status} /></div></div><OrderRoadmap order={order} timezone={timezone} compact /></section>
    {actions.length > 0 && <section className="shop-order-primary-actions" style={{ '--order-action-count': Math.min(actions.length, 3) }}>{actions.map(action => <Button key={action.key} variant="plain" type="button" className={action === primary ? 'is-primary' : undefined} disabled={action.disabled} onClick={() => setModal({ type: 'action', key: action.key })}>{React.createElement(ORDER_ACTION_ICONS[action.key] || Package, {size:23,'aria-hidden':true})}<span>{action.label}</span></Button>)}</section>}{printError && <p role="alert" className="shop-mobile-error">{printError}</p>}
    {order.status !== 'completed' && order.payment_status !== 'paid' && <p className="shop-order-detail-notice">Full payment is required before completing this order.</p>}
    <div className="shop-order-context-grid">
    <OrderPanel title="Customer" className="shop-order-customer-panel"><OrderContextLink label="View customer" disabled={!order.customer_key} onClick={() => onNavigate(`/shop/customers/${encodeURIComponent(order.customer_key)}`)}><span className="shop-order-customer-avatar" aria-hidden="true">{customerInitials || <UserRound size={21} />}</span><span><strong>{customerName}</strong>{order.phone && <small>{order.phone}</small>}{order.email && <small>{order.email}</small>}</span></OrderContextLink></OrderPanel>
    <OrderPanel title={shopLabel(order.fulfillment)} className="shop-order-fulfillment-panel"><OrderContextLink label="View fulfillment details" onClick={() => setFulfillmentOpen(true)}><span className="shop-order-customer-avatar"><FulfillmentIcon size={22} aria-hidden="true" /></span><span><strong>{order.address || shopLabel(order.fulfillment)}</strong>{order.fulfillment_instructions && <small>{order.fulfillment_instructions}</small>}</span></OrderContextLink></OrderPanel></div>
    <MobileSheet open={fulfillmentOpen} title="Fulfillment details" onClose={() => setFulfillmentOpen(false)}><p>{shopLabel(order.fulfillment)}</p>{order.address && <p>{order.address}</p>}{order.fulfillment_instructions && <p className="shop-order-preformatted">{order.fulfillment_instructions}</p>}{order.notes && <><h3>Customer note</h3><p>{order.notes}</p></>}</MobileSheet>
    {order.customer_requests?.length > 0 && <OrderPanel title="Customer requests" icon={MessageSquare} className="shop-order-requests-panel">
      {order.customer_requests.map(row => <div className="shop-order-request-item" key={row.id}>
        <div className="shop-order-request-heading"><strong>{row.type === 'change' ? 'Order change request' : row.type === 'return' ? 'Return/refund request' : 'Cancellation request'}</strong><OrderBadge value={row.status} /></div>
        <p>{row.reason}</p>{row.staff_note && <p className="shop-order-detail-note">Shop response: {row.staff_note}</p>}
        <div className="shop-order-action-grid">{row.has_photo && <Button variant="secondary" type="button" className="mobile-secondary" aria-expanded={selectedPhoto === row.id} onClick={() => setSelectedPhoto(selectedPhoto === row.id ? null : row.id)}>{selectedPhoto === row.id ? 'Close return photo' : 'View return photo'}</Button>}{canShop(session, 'ecommerce_process') && (row.status === 'pending' || (row.type === 'return' && row.status === 'approved')) && <Button variant="primary" type="button" className="mobile-primary" onClick={() => onNavigate(`/shop/orders/${id}/requests/${row.id}/review`)}>Review request #{row.id}<ChevronRight size={16} aria-hidden="true" /></Button>}</div>
        {selectedPhoto === row.id && <ShopPrivateImage path={`/shop-admin/orders/${id}/requests/${row.id}/photo`} label="Customer return evidence" />}
      </div>)}
    </OrderPanel>}

    <OrderPanel title={`Items (${order.items?.length || 0})`} icon={Package} className="shop-order-receipt-panel">
      <div className="shop-order-items">{order.items?.map((item, index) => <div className="shop-order-item" key={`${item.product_id}:${index}`}><OrderItemPhoto item={item} /><div><strong>{item.name}</strong><small>{item.quantity} {item.unit_name} × {shopMoney(item.unit_price, order.currency)}</small></div><b>{shopMoney(item.line_total, order.currency)}</b></div>)}</div>
      <dl className="shop-order-totals"><div><dt>Subtotal ({order.items?.length || 0} items)</dt><dd>{shopMoney(order.subtotal ?? (order.items || []).reduce((sum, item) => sum + Number(item.line_total || 0), 0), order.currency)}</dd></div><div><dt>Delivery fee</dt><dd>{shopMoney(order.delivery_fee, order.currency)}</dd></div>{Number(order.discount) > 0 && <div><dt>Coupon discount</dt><dd>{shopMoney(order.discount, order.currency)}</dd></div>}<div className="shop-order-grand-total"><dt>Total</dt><dd>{shopMoney(order.total, order.currency)}</dd></div></dl>
      {order.delivery_fee_recipient === 'delivery_service' && <p className="shop-order-detail-note">Customer pays delivery service directly; excluded from shop total.</p>}
      {order.promotions?.length > 0 && <p className="shop-order-detail-note">Promotions: {order.promotions.map(promotion => promotion.code || promotion.name).join(', ')}</p>}
    </OrderPanel>

    {order.sale_id && <OrderPanel title="Linked POS sale" icon={History} className="shop-order-linked-sale-panel"><p>Sale #{order.sale_id}{order.sale_voided ? ' · Voided' : ''}</p>{canShop(session, 'sales') && <Button variant="plain" type="button" className="shop-order-detail-link" onClick={() => onNavigate(`/sales/${order.sale_id}`)}>View POS sale<ChevronRight size={17} aria-hidden="true" /></Button>}</OrderPanel>}
    {(canShop(session, 'ecommerce_payments') || canShop(session, 'ecommerce_refunds')) && <OrderPanel title="Payment" icon={CreditCard} className="shop-order-payment-panel"><div className="shop-order-payment-summary"><span><small>Order total</small><strong>{shopMoney(order.total, order.currency)}</strong></span><OrderBadge value={order.payment_status} /></div><OrderReceivingAccount order={order} />
      {order.payment_method?.instructions && <p className="shop-order-detail-note">{order.payment_method.instructions}</p>}
      <p className="shop-order-detail-notice"><ShieldCheck size={16} aria-hidden="true" /><span>Check the receiving account or cash receipt for the full amount before approval.</span></p>
      {canShop(session, 'ecommerce_payments') && proofs.length > 0 && <><div className="shop-order-proof-tabs">{proofs.map(payment => <Button variant="plain" type="button" key={payment.id} aria-pressed={proof === payment.id} onClick={() => setSelectedProof(payment.id)}>Proof #{payment.id} / {payment.status}</Button>)}</div>{proof && <><ShopPrivateImage path={`/shop-admin/orders/${id}/proofs/${proof}`} label="Customer payment proof" /><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => setProofOpen(true)}>Open proof<ChevronRight size={17} aria-hidden="true" /></Button></>}</>}
      {order.payments?.filter(payment => payment.type !== 'proof').map(payment => <div className="shop-order-payment-record" key={payment.id}><div><strong>{shopLabel(payment.type)}</strong><b>{shopMoney(payment.amount, order.currency)}</b></div>{payment.reference && <p>{payment.reference}</p>}<small>Staff #{payment.actor_id} / {shopDate(payment.created_at, timezone)}</small>{payment.reason && <p>{payment.reason}</p>}</div>)}
    </OrderPanel>}

    <MobileSheet open={proofOpen} title="Payment proof" onClose={() => setProofOpen(false)}>{proof && <ShopPrivateImage path={`/shop-admin/orders/${id}/proofs/${proof}`} label="Full payment proof" />}</MobileSheet>
    <section className="shop-order-panel shop-order-history-panel"><Button variant="plain" className="shop-order-history-toggle" type="button" aria-expanded={history} aria-controls={`shop-order-history-${id}`} onClick={() => setHistory(!history)}><span><History size={19} aria-hidden="true" />{history ? 'Hide order history' : 'Order history'}</span><ChevronDown size={18} aria-hidden="true" /></Button>{history && <div id={`shop-order-history-${id}`} className="shop-order-timeline"><h2>Order history</h2>{order.events?.length ? order.events.map(event => <div key={event.id}><span className="shop-order-timeline-dot" aria-hidden="true" /><strong>{shopLabel(event.event)}</strong><small>{shopDate(event.created_at, timezone)}</small>{event.reason && <p>{event.reason}</p>}</div>) : <p className="shop-order-detail-note">No order history yet.</p>}</div>}</section>
    <MobileSheet
      open={Boolean(modal)}
      title={modal?.type === 'request' ? 'Review customer request' : ({ cancelled: 'Cancel order?', confirm: 'Confirm payment', refund: 'Refund review', dispatched: 'Mark as dispatched' })[modal?.key] || actions.find(item => item.key === modal?.key)?.label || 'Order action'}
      description={`${order.reference} / ${shopMoney(order.total, order.currency)}`}
      className={`mobile-sheet--action-menu shop-order-action-modal${modal?.type === 'action' && ['cancelled', 'confirm'].includes(modal.key) ? ' is-centered' : ''}`}
      onClose={closeModal}
    >
      {modal?.type === 'action' && <ShopOrderActionForm key={`action-${modal.key}`} id={id} action={modal.key} order={order} session={session} onCancel={closeModal} onSaved={actionSaved} onBusyChange={setModalBusy} />}
      {modal?.type === 'request' && <ShopRequestReviewForm key={`request-${modal.key}`} id={id} requestId={modal.key} order={order} session={session} onCancel={closeModal} onSaved={actionSaved} onBusyChange={setModalBusy} />}
    </MobileSheet>
  </div>}</ShopLoadState>}</>;
}

export function ShopOrderAction({ id, action, onNavigate, session }) {
  return <ShopOrderDetail id={id} session={session} onNavigate={onNavigate} initialAction={action} onModalClose={(result) => result?.saved ? onNavigate(`/shop/orders/${id}`, { replace: true }) : onNavigate(`/shop/orders/${id}`, { back: true })} />;
}

function ShopOrderActionForm({ action, order, session, onCancel, onSaved, onBusyChange }) {
  const [form, setForm] = useState({ reason: '', reference: '', review_note: '', verified: false, return_confirmed: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({});
  const working = useRef(false);
  const available = order && shopOrderActions(order, session).find(item => item.key === action && !item.disabled);
  const reasonRequired = ['cancelled', 'return_pending', 'reject'].includes(action);
  const payment = ['confirm', 'refund'].includes(action);
  const returnedRequired = order?.status === 'return_pending' && action === 'cancelled';
  async function submit(event) {
    event.preventDefault(); if (working.current || !available) return;
    if (reasonRequired && !form.reason.trim()) { setErrors({ reason: 'Enter a reason.' }); return; }
    if (payment && !form.verified) { setError('Confirm that the full amount was verified.'); return; }
    if (returnedRequired && !form.return_confirmed) { setError('Confirm that the goods have physically returned.'); return; }
    working.current = true; setBusy(true); onBusyChange(true); setError(''); setErrors({});
    try { const request = orderActionRequest(order, action, form); const updated = await apiRequest(request.path, { method: 'POST', body: JSON.stringify(request.payload) }); setForm({ reason: '', reference: '', review_note: '', verified: false, return_confirmed: false }); await onSaved(updated); }
    catch (e) { setError(e.message); setErrors(fieldErrors(e)); }
    finally { working.current = false; setBusy(false); onBusyChange(false); }
  }
  const submitLabel = ({ cancelled: 'Confirm cancellation', confirm: 'Confirm paid', refund: 'Confirm refund', dispatched: 'Confirm dispatch' })[action] || available?.label;
  const prefix = `order-${order.id}-${action}`;
  const lastProof = order.payments?.filter(row => row.type === 'proof').at(-1);
  return available ? <form className="shop-mobile-form shop-order-modal-form" onSubmit={submit}><div className="shop-order-modal-content">
    {action === 'cancelled' && <><span className="shop-order-cancel-symbol"><AlertCircle size={29} aria-hidden="true" /></span><p>This order is currently <strong>{shopLabel(order.status)}</strong> with a total of <strong>{shopMoney(order.total, order.currency)}</strong>.</p><aside className="shop-order-modal-notice">Cancellation releases applicable stock reservations and preserves the order history.</aside></>}
    {action !== 'cancelled' && <OrderActionSummary order={order} />}
    {action === 'dispatched' && <p>Confirm that this order has been handed over to the courier for delivery.</p>}
    {action === 'refund' && <><aside className="shop-order-modal-notice"><strong>{order.sale_voided ? 'Linked POS sale reversed' : order.sale_id ? 'Linked POS reversal required' : 'Manual refund'}</strong><p>{order.sale_id && !order.sale_voided ? 'Use the PIN-protected Sales workflow to reverse the linked sale when required. Record the refund only after the full amount is sent.' : 'Record the refund only after the full amount is sent to the customer.'}</p></aside><section className="shop-order-refund-items"><h3>Items to refund ({order.items?.length || 0})</h3>{order.items?.map((item,index) => <div className="shop-order-item" key={`${item.product_id}-${index}`}><OrderItemPhoto item={item} /><span><strong>{item.name}</strong><small>{item.quantity} {item.unit_name}</small></span><b>{shopMoney(item.line_total, order.currency)}</b></div>)}</section></>}
    {action === 'confirm' && <aside className="shop-order-modal-notice"><strong>Confirm full payment received</strong><p>Mark this order as paid after receiving the full amount from the customer.</p></aside>}
    {payment && <><div className="shop-order-modal-amount"><small>{action === 'refund' ? 'Refund amount (full amount)' : 'Order amount (full amount)'}</small><strong>{shopMoney(order.total, order.currency)}</strong></div><OrderReceivingAccount order={order} />{action === 'confirm' && lastProof && <ShopPrivateImage path={`/shop-admin/orders/${order.id}/proofs/${lastProof.id}`} label="Customer payment proof" />}</>}
    {error && <p role="alert" className="shop-mobile-error">{error}</p>}<fieldset disabled={busy}>
    {action === 'reopen' && <p>Available stock will be checked and reserved again. Payment remains pending review.</p>}
    {action === 'cancelled' && order.payment_status === 'paid' && <p>Cancellation will require a manual refund.</p>}
    {action === 'confirm' && ['expired', 'cancelled'].includes(order.status) && <p>The order stays closed and stock stays released. This records a receipt for refund.</p>}
    {reasonRequired && <><ShopField id={`${prefix}-reason`} name="reason" errors={errors} label={action === 'reject' ? 'Customer-visible rejection reason' : action === 'cancelled' ? 'Reason for cancellation' : 'Reason'}><Textarea required maxLength={2000} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></ShopField><small className="shop-order-field-count">{form.reason.length}/2000</small></>}
    {returnedRequired && <label className="shop-mobile-check"><Checkbox type="checkbox" required checked={form.return_confirmed} onChange={event => setForm({ ...form, return_confirmed: event.target.checked })} />Goods have physically returned</label>}
    {payment && <><ShopField id={`${prefix}-reference`} name="reference" errors={errors} label="Payment / refund reference (optional)"><Input maxLength={255} value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} /></ShopField><ShopField id={`${prefix}-review-note`} name="review_note" errors={errors} label="Internal review note"><Textarea maxLength={2000} value={form.review_note} onChange={event => setForm({ ...form, review_note: event.target.value })} /></ShopField><p>Check the receiving account or cash receipt. A screenshot alone does not confirm receipt.</p><label className="shop-mobile-check"><Checkbox type="checkbox" required checked={form.verified} onChange={event => setForm({ ...form, verified: event.target.checked })} />{action === 'refund' ? 'I checked that the full refund was sent to the customer.' : 'I checked that the full payment was received by this shop.'}</label></>}
    </fieldset></div><div className="shop-mobile-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={onCancel}>Cancel</Button><Button variant={reasonRequired ? 'danger' : 'primary'} type="submit" className={reasonRequired ? 'mobile-danger' : 'mobile-primary'} disabled={busy || (payment && !form.verified) || (returnedRequired && !form.return_confirmed)}>{busy ? <ShopBusy label="Saving..." /> : submitLabel}</Button></div>
  </form> : <section><p role="alert">This action is unavailable for this order or your permissions.</p><Button variant="secondary" className="mobile-secondary" type="button" onClick={onCancel}>Back to order</Button></section>;
}

export function ShopRequestReview({ id, requestId, onNavigate, session }) {
  const resource = useShopResource(`/shop-admin/orders/${id}`), order = resource.data;
  const [busy, setBusy] = useState(false);
  const back = () => { if (!busy) onNavigate(`/shop/orders/${id}`, { back: true }); };
  return <><ShopOrdersHeader title={order?.reference || `Order #${id}`} onBack={back} /><ShopLoadState resource={resource}>{order && <div className="shop-order-request-page"><OrderActionSummary order={order} /><ShopRequestReviewForm id={id} requestId={requestId} order={order} session={session} onCancel={back} onBusyChange={setBusy} onSaved={() => onNavigate(`/shop/orders/${id}`, { replace: true })} /></div>}</ShopLoadState></>;
}


function ShopRequestedChanges({ changes, order }) {
  return <div><p>Requested changes only. Arrange the change with the customer; item changes may require a replacement checkout. Resolving does not edit the original order.</p><dl>{Object.entries(changes).filter(([key]) => key !== 'items').map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>{changes.items && <div style={{overflowX:'auto'}}><table aria-label="Requested product quantities"><thead><tr><th>Product</th><th>Quantity</th></tr></thead><tbody>{changes.items.map(item => <tr key={item.product_id}><td>{order.items?.find(p => Number(p.product_id) === Number(item.product_id))?.name || `#${item.product_id}`}</td><td>{item.quantity}</td></tr>)}</tbody></table></div>}</div>;
}

function ShopRequestReviewForm({ id, requestId, order, session, onCancel, onSaved, onBusyChange }) {
  const [note, setNote] = useState(''), [returned, setReturned] = useState(false), [status, setStatus] = useState(() => order?.customer_requests?.find(item => String(item.id) === String(requestId))?.type === 'change' ? 'resolved' : 'approved');
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [busy, setBusy] = useState(false);
  const working = useRef(false);
  const row = order?.customer_requests?.find(item => String(item.id) === String(requestId));
  const allowed = canShop(session, 'ecommerce_process') && row && (row.status === 'pending' || (row.type === 'return' && row.status === 'approved'));
  const resolve = row?.type === 'return' && row?.status === 'approved';
  const ready = !resolve || (order?.sale_voided && order?.payment_status === 'refunded');
  async function submit(event) {
    event.preventDefault(); if (working.current || !allowed || !ready) return;
    if (note.trim().length < 5) { setErrors({ staff_note: 'Enter at least five characters.' }); return; }
    working.current = true; setBusy(true); onBusyChange(true); setError(''); setErrors({});
    try { const updated = await apiRequest(`/shop-admin/orders/${id}/requests/${requestId}`, { method: 'POST', body: JSON.stringify({ status: resolve ? 'resolved' : status, staff_note: note.trim(), return_confirmed: returned }) }); setNote(''); setReturned(false); await onSaved(updated); }
    catch (e) { setError(e.message); setErrors(fieldErrors(e)); }
    finally { working.current = false; setBusy(false); onBusyChange(false); }
  }
  const prefix = `order-${id}-request-${requestId}`;
  return allowed ? <form className="shop-mobile-form shop-order-modal-form shop-request-review-form" onSubmit={submit}>
    <section className="shop-request-details"><header><h2>{row.type === 'change' ? 'Order change request' : row.type === 'return' ? 'Return request' : 'Cancellation request'}</h2><OrderBadge value={row.status} /></header><strong>Request #{row.id}</strong>{row.created_at && <small>{shopDate(row.created_at, session?.business?.timezone)}</small>}<dl><dt>{row.type === 'change' ? 'Reason for change' : row.type === 'return' ? 'Reason for return' : 'Reason for cancellation'}</dt><dd>{row.reason}</dd></dl>{row.requested_changes && <ShopRequestedChanges changes={row.requested_changes} order={order} />}{row.has_photo && <><p>Photo evidence</p><ShopPrivateImage path={`/shop-admin/orders/${id}/requests/${requestId}/photo`} label="Customer return evidence" /></>}</section>
    {error && <p role="alert">{error}</p>}<fieldset disabled={busy}>
    {resolve ? <p>Confirm physical return, void linked sale #{order.sale_id} through the PIN-protected Sales workflow, then record the full refund before resolving this request.</p> : <section className="shop-request-decision"><h2>Review decision</h2><div className="shop-request-radio-options">{[[row.type === 'change' ? 'resolved' : 'approved', row.type === 'change' ? 'Mark resolved' : row.type === 'return' ? 'Accept return' : 'Approve request'], ['rejected', row.type === 'return' ? 'Reject return' : 'Decline request']].map(([value, label]) => <label key={value} className={status === value ? 'is-selected' : ''}><Radio type="radio" name={`${prefix}-decision`} value={value} checked={status === value} onChange={() => setStatus(value)} /><span>{label}</span></label>)}</div><p className="shop-order-modal-notice">{status === 'resolved' ? 'Confirm the change has been arranged with the customer. The original order stays unchanged.' : status === 'approved' ? 'Approve the customer request. Returned goods and any refund must still be processed through the required workflow.' : 'Decline the customer request and explain your decision in the review note.'}</p></section>}
    <ShopField id={`${prefix}-note`} name="staff_note" label="Review note" errors={errors}><Textarea required minLength={5} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></ShopField><small className="shop-order-field-count">{note.length}/2000</small>
    {row.type === 'cancellation' && ['dispatched', 'return_pending'].includes(order.status) && <label className="shop-mobile-check"><Checkbox type="checkbox" checked={returned} onChange={event => setReturned(event.target.checked)} />Goods have physically returned</label>}
    {!ready && <p role="status">Resolve becomes available after the linked sale is voided and payment is refunded.</p>}
    <div className="shop-mobile-actions"><Button variant="secondary" type="button" className="mobile-secondary" onClick={onCancel}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || !ready}>{busy ? <ShopBusy label="Saving..." /> : resolve ? 'Resolve request' : 'Save decision'}</Button></div>
  </fieldset></form> : <p role="alert">This customer request is unavailable for review.</p>;
}
