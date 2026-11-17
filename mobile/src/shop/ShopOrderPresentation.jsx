import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton } from '../components/Controls';
import React from 'react';
import { ArrowLeft, ChevronRight, FileX, Package } from 'lucide-react';
import { OrderBadge } from './OrderCard';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { shopMoney } from './shopUtils';

export function ShopOrdersHeader({ title = 'Orders', onBack, actions }) {
  return <PageAppBar className="shop-orders-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{actions}<AppBarMenu /></PageAppBar>;
}
export function OrderUnavailable({ error, onBack, onRetry }) {
  return <section className="shop-order-unavailable"><span><FileX size={64} aria-hidden="true" /></span><h2>Order unavailable</h2><p>{/unavailable|not found|access/i.test(error) ? 'It may have been removed or you may no longer have access.' : error}</p><Button variant="primary" type="button" className="mobile-primary" onClick={onBack}>Back to orders</Button>{!/unavailable|not found|access/i.test(error) && <Button variant="secondary" type="button" className="mobile-secondary" onClick={onRetry}>Retry order</Button>}</section>;
}
export function OrderItemPhoto({ item }) {
  return <span className="shop-order-product-photo"><Package size={23} aria-hidden="true" /><ProductPhoto path={item.photo_url} alt={item.name || ''} /></span>;
}
export function OrderActionSummary({ order }) {
  return <div className="shop-order-action-summary"><span className="shop-order-summary-photos">{order.items?.slice(0, 3).map((item, index) => <OrderItemPhoto key={`${item.product_id}-${index}`} item={item} />)}</span><span><strong>{order.reference}</strong><small>{order.customer_name || 'Guest customer'}</small><small>{order.items?.length || 0} items</small></span><span><strong>{shopMoney(order.total, order.currency)}</strong><OrderBadge value={order.payment_status} /></span></div>;
}
export function OrderReceivingAccount({ order }) {
  return <dl className="shop-order-receiving-account">{[['Payment method', order.payment_method?.name], ['Bank / wallet', order.payment_method?.bank], ['Account name', order.payment_method?.account_name], ['Account number', order.payment_method?.account_no]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function OrderContextLink({ label, children, onClick, disabled = false }) {
  return <Button variant="plain" type="button" className="shop-order-context-link" aria-label={label} onClick={onClick} disabled={disabled}>{children}<ChevronRight size={18} aria-hidden="true" /></Button>;
}
