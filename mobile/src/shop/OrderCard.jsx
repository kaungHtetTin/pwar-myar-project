import { Badge, Button } from '../components/Controls';
import React from 'react';
import { ChevronRight, CircleCheck, Clock3, MessageSquare, Package, Store, Truck } from 'lucide-react';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { shopDate, shopLabel, shopMoney } from './shopUtils';

export function OrderBadge({ value, fulfillment = false, statusIcon = false }) {
  const tone = ['completed', 'paid'].includes(value) ? 'success'
    : ['pending', 'unpaid', 'refund_pending'].includes(value) ? 'warning'
      : ['return_pending', 'refunded', 'cancelled'].includes(value) ? 'danger'
        : ['partial', 'partially_paid'].includes(value) ? 'violet'
          : value === 'expired' ? 'muted' : 'info';
  const Icon = fulfillment ? value === 'delivery' ? Truck : Store : value === 'completed' ? CircleCheck : value === 'packing' ? Package : value === 'dispatched' ? Truck : Clock3;
  return <Badge tone={fulfillment ? 'muted' : tone} dot={!fulfillment && !statusIcon} className={`shop-order-badge${fulfillment ? '' : ` is-${tone}`}`}>
    {(fulfillment || statusIcon) && <Icon size={14} aria-hidden="true" />}{shopLabel(value)}
  </Badge>;
}

export function OrderCard({ order, timezone, onNavigate }) {
  const reference = order.reference || `#${order.id}`;
  const name = order.customer_name || 'Guest customer';
  const initials = name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase();
  const items = order.item_previews || order.items || [];
  const itemCount = order.item_count ?? (order.items ? order.items.length : null);
  const FulfillmentIcon = order.fulfillment === 'delivery' ? Truck : Store;
  return (
    <Button variant="plain"
      type="button"
      className={`shop-order-card shop-order-reference-card${order.request_count > 0 ? ' has-requests' : ''}`}
      aria-label={`View order ${reference}`}
      onClick={() => onNavigate(`/shop/orders/${order.id}`)}
    >
      <span className="order-reference-top"><strong>{reference}</strong><OrderBadge value={order.status} statusIcon /></span>
      <span className="order-reference-date">{shopDate(order.created_at, timezone)}</span>
      <span className="order-reference-main"><span className="order-reference-buyer"><span className="order-reference-avatar" aria-hidden="true">{initials}</span><span><strong>{name}</strong>{itemCount !== null && <small>{itemCount} {itemCount === 1 ? 'item' : 'items'}</small>}</span></span><span className="order-reference-amount"><strong>{shopMoney(order.total, order.currency)}</strong><OrderBadge value={order.payment_status} /></span></span>
      <span className="order-reference-bottom"><span className="order-reference-thumbnails">{items.slice(0, 4).map((item, index) => <span className="order-reference-thumbnail" key={item.id || `${item.product_id}-${index}`} title={item.name}><Package size={21} aria-hidden="true" /><ProductPhoto path={item.photo_url} alt={item.name || ''} />{index === 3 && itemCount > 4 && <small>+{itemCount - 3}</small>}</span>)}</span><span className="order-reference-fulfillment"><FulfillmentIcon size={21} aria-hidden="true" /><span>{shopLabel(order.fulfillment)}</span><ChevronRight size={18} aria-hidden="true" /></span></span>
      {order.request_count > 0 && <span className="shop-order-requests"><MessageSquare size={16} aria-hidden="true" /><span>{order.request_count} customer request(s) to review</span></span>}
    </Button>
  );
}

