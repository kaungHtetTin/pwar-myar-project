import { shopDate } from './dateTime';
import React from 'react';
import { CalendarDays, MapPin, Phone, Package, Truck, Store, CreditCard, ReceiptText } from 'lucide-react';
import { useText } from './i18n';
import { StatusBadge } from './ShoppingComponents';
import { OrderReceipt } from './OrderReceipt';
import { OrderProgress } from './OrderProgress';

export function orderAmount(value, currency) {
  return `${['K', 'Ks', 'MMK'].includes(currency) ? 'K' : currency || ''} ${Number(value || 0).toLocaleString()}`.trim();
}

export function OrderDetailContent({ order }) {
  const text = useText();
  const amount = value => orderAmount(value, order.currency);
  const receipt = order.receipt || {};
  const delivery = order.fulfillment === 'delivery';
  return <>
    <section className="order-status order-overview">
      <div className="order-overview-identity"><h2>{order.reference}</h2>{order.store_name && <a className="order-detail-shop" href={`#/store/${encodeURIComponent(order.store_slug)}`}>{order.store_name}</a>}{order.created_at && <span className="order-detail-date"><CalendarDays size={15} aria-hidden="true" /><time dateTime={shopDate(order.created_at)?.toISOString()}>{shopDate(order.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></span>}</div>
      <div className="order-overview-status"><StatusBadge value={order.status} /><div className="order-overview-total"><small>{text('Total')}</small><strong>{amount(order.total)}</strong></div></div>
    </section>
    {!!order.sale_voided && <p className="notice">{text('The completed sale was voided. Contact the shop about your refund.')}</p>}
    <OrderProgress order={order} />
    <div className="order-detail-columns">
      <div className="order-detail-primary">
        {(order.fulfillment || receipt.customer_name || receipt.address || order.fulfillment_instructions) && <section className="order-detail-panel order-delivery"><header><span className="order-panel-icon">{delivery ? <Truck size={21} /> : <Store size={21} />}</span><h2>{text(delivery ? 'Delivery information' : 'Pickup information')}</h2></header><div className="order-delivery-content">{receipt.customer_name && <strong>{receipt.customer_name}</strong>}{receipt.phone && <a href={`tel:${receipt.phone}`}><Phone size={15} aria-hidden="true" />{receipt.phone}</a>}{(delivery ? receipt.address : receipt.shop_address) && <p><MapPin size={16} aria-hidden="true" />{delivery ? receipt.address : receipt.shop_address}</p>}{order.fulfillment_instructions && <p>{order.fulfillment_instructions}</p>}</div></section>}
        <section className="order-detail-panel order-items"><header><h2>{text('Items')} <span>({order.items.length})</span></h2></header><div>{order.items.map((item, index) => <article className="order-detail-item" key={`${item.product_id}:${index}`}><span className="order-item-icon" aria-hidden="true"><Package size={22} /></span><div><strong>{item.name}</strong><small>{item.quantity} {item.unit_name}{item.unit_price != null && <> · {amount(item.unit_price)} {text('each')}</>}</small></div><strong className="order-item-amount">{amount(item.line_total)}</strong></article>)}</div></section>
      </div>
      <div className="order-detail-secondary">
        <section className="order-detail-panel order-detail-summary"><header><span className="order-panel-icon"><ReceiptText size={21} /></span><h2>{text('Order summary')}</h2></header><dl>{[['Subtotal', order.subtotal], [order.delivery_fee_recipient === 'delivery_service' ? 'Delivery fee charged by shop' : 'Delivery fee', order.delivery_fee], ...(Number(order.discount) > 0 ? [['Discount', -Number(order.discount)]] : [])].map(([label, value]) => <div key={label}><dt>{text(label)}</dt><dd>{amount(value)}</dd></div>)}<div className="order-summary-total"><dt>{text(order.delivery_fee_recipient === 'delivery_service' ? 'Total payable to shop' : 'Total')}</dt><dd>{amount(order.total)}</dd></div></dl>{order.delivery_fee_recipient === 'delivery_service' && <p className="order-detail-note">{text('Delivery fee is paid separately to the delivery service and is excluded from the shop total.')}</p>}</section>
        <section className="order-detail-panel order-payment"><header><span className="order-panel-icon"><CreditCard size={21} /></span><h2>{text('Payment information')}</h2></header><div className="order-payment-details"><div><small>{text('Payment method')}</small><strong>{order.payment_method.name || text(order.payment_method.type === 'cash' ? 'Cash' : 'Bank transfer')}</strong></div><StatusBadge value={order.payment_status} payment /></div>{order.payment_method.instructions && <p className="order-detail-note">{order.payment_method.instructions}</p>}{order.payment_method.type === 'transfer' && <p className="order-detail-note">{[order.payment_method.bank, order.payment_method.account_name, order.payment_method.account_no].filter(Boolean).join(' · ')}</p>}{order.payment_reviews.map(proof => <p className={`order-payment-proof ${proof.status === 'pending' ? 'is-pending' : ''}`} key={proof.id}>{text('Payment proof')}: {text(proof.status === 'pending' ? 'Awaiting review' : proof.status)}{proof.reason && <span>{proof.reason}</span>}</p>)}<OrderReceipt order={order} /></section>
      </div>
    </div>
  </>;
}
