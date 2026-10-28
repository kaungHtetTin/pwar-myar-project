import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Package, ArrowRight } from 'lucide-react';
import { request, post } from './api';
import { useCustomer, CustomerAuth } from './CustomerAccount';
import { useEndless } from './useEndless';
import { useText } from './i18n';
import { FeatureBack, FeatureEmpty, FeatureError } from './CustomerFeatures';
import { SectionTitle, LoadingPanel } from './ShoppingComponents';
import './notifications.css';
import { useShopPageActive } from './RetainedViews';

export const noticeTitle = event => ({ expired: 'Order expired', reopened: 'Order reopened', submitted: 'Order placed', accepted: 'Order accepted', packing: 'Your order is being packed', ready_for_pickup: 'Ready for pickup', dispatched: 'Order dispatched', completed: 'Order completed', cancelled: 'Order cancelled', return_pending: 'Return in progress', proof_submitted: 'Payment proof received', payment_confirm: 'Payment confirmed', payment_reject: 'Payment proof rejected', payment_refund: 'Refund recorded', sale_voided: 'Sale voided; refund pending', cancellation_requested: 'Cancellation requested', cancellation_approved: 'Cancellation approved', cancellation_rejected: 'Cancellation declined', return_requested: 'Return/refund requested', return_approved: 'Return/refund approved', return_rejected: 'Return/refund declined', return_resolved: 'Return/refund resolved', change_requested: 'Order change requested', change_resolved: 'Order change resolved', change_rejected: 'Order change declined', back_in_stock: 'Back in stock' })[event] || 'Order updated';

export function UpdatesLink() {
  const text = useText(); const { customer } = useCustomer(); const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => { if (document.hidden) return; request('/customer/notifications?limit=1').then(data => active && setCount(data.unread_count || 0)).catch(() => {}); };
    load(); const timer = setInterval(load, 60000); window.addEventListener('mkpos:updates-read', load); window.addEventListener('mkpos:customer-order-alerts', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('mkpos:updates-read', load); window.removeEventListener('mkpos:customer-order-alerts', load); };
  }, [customer?.id]);
  return <a className="updates-link" href="#/account/notifications" aria-label={`${text('Updates')} ${count}`}><Bell size={20} />{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</a>;
}
function Inbox() {
  const text = useText(); const { customer } = useCustomer(); const [read, setRead] = useState(new Set()), [readThrough, setReadThrough] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const list = useEndless('/customer/notifications?unread=0');
  async function mark(ids) {
    const data = await post('/customer/notifications/read', ids ? { ids } : {});
    if (ids) setRead(previous => new Set([...previous, ...ids])); else setReadThrough(data.read_through || Math.max(0, ...list.items.map(item => item.id)));
    window.dispatchEvent(new Event('mkpos:updates-read'));
  }
  async function open(item) {
    if (busy) return; setBusy(true); setError('');
    try {
      await mark([item.id]);
      if (item.event === 'back_in_stock') location.hash = `/store/${encodeURIComponent(item.payload.slug)}/products/${item.payload.product_id}`;
      else {
        const order = await request(`/customer/orders/${encodeURIComponent(item.payload.reference)}`);
        sessionStorage.setItem('mkpos.shop.tracking', JSON.stringify({ reference: order.reference }));
        sessionStorage.setItem('mkpos.shop.tracking.customer', String(customer.id));
        location.hash = '/orders/track';
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const rows = list.items;
  const active = useShopPageActive();
  useEffect(() => { const action = async event => { if (!active || busy || !list.items.length || event.detail !== 'mark-all-read') return; setBusy(true); setError(''); try { await mark(); } catch (e) { setError(e.message); } finally { setBusy(false); } }; window.addEventListener('mkpos:account-action', action); return () => window.removeEventListener('mkpos:account-action', action); }, [active, busy, list.items]);
  return <section className="updates-page"><header data-shop-refresh-bar className="notifications-intro"><div><h1>{text('Notifications')}</h1><p>{text('Updates from shops and your orders.')}</p></div><button type="button" className="shop-icon-button" aria-label={text('Mark all read')} title={text('Mark all read')} disabled={busy || !rows.length} onClick={async () => { setBusy(true); setError(''); try { await mark(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><CheckCheck size={21} aria-hidden="true" /></button></header><div className="notifications-content">
    <FeatureError message={error || list.error} retry={list.error ? list.retry : undefined} />
    <div className="feature-list">{rows.map(item => <article className={`feature-panel update-card ${item.id > readThrough && !read.has(item.id) && !item.read_at ? 'is-unread' : ''}`} key={item.id}><span className="section-symbol">{item.event === 'back_in_stock' ? <Bell size={22} /> : <Package size={22} />}</span><div><strong>{text(noticeTitle(item.event))}</strong><small>{item.payload.store_name} · {new Date(`${item.created_at.replace(' ', 'T')}Z`).toLocaleString(undefined, {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small><p>{item.payload.name || item.payload.reference}</p>{item.payload.reason && <p>{item.payload.reason}</p>}<button type="button" className="shop-icon-button" disabled={busy} aria-label={text(item.event === 'back_in_stock' ? 'View product' : 'View order')} title={text(item.event === 'back_in_stock' ? 'View product' : 'View order')} onClick={() => open(item)}><ArrowRight size={17} aria-hidden="true" /></button></div></article>)}</div>
    <div ref={list.sentinel}>{list.busy ? <LoadingPanel variant="notifications" count={list.items.length ? 1 : 3} /> : !rows.length && !list.error ? <FeatureEmpty icon={Bell} message="You are all caught up." /> : list.more && <button type="button" onClick={list.retry}>{text('Load more')}</button>}</div>
  </div></section>;
}
export function UpdatesPage() { const { customer, loading } = useCustomer(); return loading ? <LoadingPanel variant="notifications" page /> : customer ? <Inbox /> : <CustomerAuth next="/account/notifications" />; }

export function StockAlertButton({ product }) {
  const text = useText(); const { customer } = useCustomer(); const [active, setActive] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const path = `/customer/stock-alerts/${encodeURIComponent(product.store_slug)}/${product.id}`;
  useEffect(() => { let current = true; if (customer) request(path).then(data => current && setActive(data.active)).catch(e => current && setError(e.message)); return () => { current = false; }; }, [customer?.id, path]);
  useEffect(() => { const changed = event => { if (event.detail.slug === product.store_slug && event.detail.productId === product.id) setActive(event.detail.active); }; window.addEventListener('mkpos:stock-alert-changed', changed); return () => window.removeEventListener('mkpos:stock-alert-changed', changed); }, [product.store_slug, product.id]);
  async function toggle() {
    if (!customer) { location.hash = `/account/login?next=${encodeURIComponent(location.hash.slice(1))}`; return; }
    if (busy) return; setBusy(true); setError('');
    try { const data = await request(path, { method: active ? 'DELETE' : 'PUT' }); setActive(data.active); window.dispatchEvent(new CustomEvent('mkpos:stock-alert-changed', { detail: { customerId: customer.id, slug: product.store_slug, productId: product.id, active: data.active, product: { ...product, alert_id: data.alert_id } } })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="stock-alert"><button type="button" disabled={busy} aria-pressed={active} onClick={toggle}><Bell size={17} />{text(active ? 'Cancel stock alert' : 'Notify me when available')}</button>{active && <small role="status">{text('We will send an in-app update when stock returns. Stock is not reserved.')}</small>}<FeatureError message={error} /></div>;
}

function StockAlertsList() {
  const text = useText(); const { customer } = useCustomer(); const list = useEndless('/customer/stock-alerts');
  useEffect(() => { const changed = event => { if (event.detail.customerId !== customer.id) return; const { productId, slug, active, product } = event.detail; list.reconcile(items => { const rest = items.filter(item => (item.id || item.product_id) !== productId || (item.store_slug || item.slug) !== slug); return active && product.alert_id ? [product, ...rest] : rest; }); }; window.addEventListener('mkpos:stock-alert-changed', changed); return () => window.removeEventListener('mkpos:stock-alert-changed', changed); }, [customer.id, list.reconcile]);
  const [removed, setRemoved] = useState(new Set()), [busy, setBusy] = useState(0), [error, setError] = useState('');
  const items = list.items.filter(item => !removed.has(item.alert_id));
  return <div className="narrow"><FeatureBack /><SectionTitle icon={Bell} title={text('Stock alerts')} /><p className="feature-subtitle">{text('We will send an in-app update when stock returns. Stock is not reserved.')}</p><FeatureError message={error || list.error} retry={list.error ? list.retry : undefined} /><div className="feature-list">{items.map(item => <article className="feature-panel" key={item.alert_id}><strong>{item.name || text('Currently unavailable')}</strong><small>{item.store_name}</small><div className="feature-actions">{!item.unavailable && <a className="button" href={`#/store/${encodeURIComponent(item.store_slug)}/products/${item.id}`}>{text('View product')}</a>}<button type="button" disabled={Boolean(busy)} onClick={async () => { setBusy(item.alert_id); setError(''); try { await request(`/customer/stock-alerts/${item.alert_id}`, { method: 'DELETE' }); setRemoved(prev => new Set([...prev, item.alert_id])); window.dispatchEvent(new CustomEvent('mkpos:stock-alert-changed', { detail: { customerId: customer.id, slug: item.store_slug || item.slug, productId: item.id || item.product_id, active: false } })); } catch (e) { setError(e.message); } finally { setBusy(0); } }}>{text('Cancel stock alert')}</button></div></article>)}</div><div ref={list.sentinel}>{list.busy ? <LoadingPanel variant="alerts" count={list.items.length ? 1 : 3} /> : !items.length && !list.error ? <FeatureEmpty icon={Bell} message="No active stock alerts." /> : list.more && <button type="button" onClick={list.retry}>{text('Load more')}</button>}</div></div>;
}
export function StockAlertsPage() { const { customer, loading } = useCustomer(); return loading ? <LoadingPanel variant="alerts" page /> : customer ? <StockAlertsList /> : <CustomerAuth next="/account/alerts" />; }
