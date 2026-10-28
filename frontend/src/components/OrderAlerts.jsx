import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, X } from 'lucide-react';
import { monitorOrders } from '../orderActivity';

export function OrderAlerts({ apiRequest, onOpen, onActivity }) {
  const [orders, setOrders] = useState([]);
  const activity = useRef(onActivity);
  useEffect(() => { activity.current = onActivity; }, [onActivity]);
  useEffect(() => monitorOrders(apiRequest, incoming => {
    setOrders(current => incoming.length ? [...current, ...incoming.filter(item => !current.some(order => order.id === item.id))] : []);
  }, count => activity.current?.(count)), [apiRequest]);
  const notice = orders[0];
  if (!notice) return null;
  const dismiss = () => setOrders(current => current.slice(1));
  return createPortal(<aside className="chat-app-alert order-app-alert" role="status" aria-live="polite" aria-atomic="true">
    <span className="chat-app-alert-icon" aria-hidden="true"><ShoppingBag size={20} /></span>
    <div className="chat-app-alert-content"><strong>New customer order</strong><p>{notice.reference} · {notice.customer_name}</p><p>{Number(notice.total).toLocaleString()} {notice.currency}{orders.length > 1 ? ` · ${orders.length} new orders` : ''}</p>
      <button type="button" className="primary chat-app-alert-open" onClick={() => { onOpen(notice); dismiss(); }}>Open order</button></div>
    <button type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label="Dismiss order notification" onClick={dismiss}><X size={18} /></button>
  </aside>, document.body);
}
