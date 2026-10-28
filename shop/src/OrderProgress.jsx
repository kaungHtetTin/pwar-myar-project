import React from 'react';
import { Check, Clock3, Package, Store, Truck, AlertCircle, Undo2 } from 'lucide-react';
import { useText } from './i18n';

export function orderProgressSteps(order) {
  const placed = { status: 'pending', label: 'Order placed', icon: Package };
  if (['cancelled', 'expired'].includes(order.status)) {
    return [placed, { status: order.status, label: order.status === 'cancelled' ? 'Cancelled' : 'Expired', icon: AlertCircle }];
  }
  const pickup = order.fulfillment === 'pickup';
  const steps = [placed, { status: 'accepted', label: 'Shop confirmed', icon: Store },
    { status: 'packing', label: 'Preparing', icon: Package },
    { status: pickup ? 'ready_for_pickup' : 'dispatched', label: pickup ? 'Ready for pickup' : 'Out for delivery', icon: pickup ? Store : Truck },
    { status: 'completed', label: pickup ? 'Collected' : order.fulfillment === 'delivery' ? 'Delivered' : 'Completed', icon: Check }];
  if (order.status === 'return_pending') return [...steps.slice(0, 4), { status: 'return_pending', label: 'Return in progress', icon: Undo2 }];
  if (!steps.some(step => step.status === order.status)) return [{ status: order.status, label: order.status || 'Order updated', icon: Clock3 }];
  return steps;
}

export function OrderProgress({ order }) {
  const text = useText();
  const steps = orderProgressSteps(order);
  const current = steps.findIndex(step => step.status === order.status);
  const stopped = ['cancelled', 'expired'].includes(order.status);
  return <section className="order-detail-panel order-roadmap" aria-label={text('Order progress')}>
    <header><h2>{text('Order progress')}</h2></header>
    <ol className="order-roadmap-list" style={{ '--order-step-count': steps.length }}>
      {steps.map((step, index) => {
        const done = index < current || (step.status === 'completed' && index === current);
        const active = index === current;
        const Icon = done ? Check : active && !stopped ? Clock3 : step.icon;
        return <li key={step.status} className={`${done ? 'is-done' : active ? stopped ? 'is-stopped' : 'is-current' : 'is-upcoming'}`} aria-current={active ? 'step' : undefined}>
          <span className="order-roadmap-marker" aria-hidden="true"><Icon size={18} /></span>
          <span className="order-roadmap-label">{text(step.label)}</span>
          {active && !done && !stopped && <small>{text('In progress')}</small>}
        </li>;
      })}
    </ol>
  </section>;
}
