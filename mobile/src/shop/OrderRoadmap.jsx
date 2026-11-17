import React from 'react';
import { Check, Route } from 'lucide-react';
import { orderRoadmap } from './orderRoadmapSteps';
import { shopDate } from './shopUtils';

export function OrderRoadmap({ order, timezone, compact = false }) {
  const steps = orderRoadmap(order).filter(step => !compact || !['accepted', 'packing', 'ready_for_pickup', 'dispatched', 'completed'].includes(order.status) || step.key !== 'pending');
  return <section className={`shop-order-panel shop-order-roadmap-panel${compact ? ' is-compact' : ''}`} aria-label="Order progress">
    <header className="shop-order-panel-heading"><span><Route size={18} aria-hidden="true" /></span><h2>Order progress</h2></header>
    <ol className="shop-order-roadmap">
      {steps.map((step, index) => <li key={step.key} className={`is-${step.state}${step.tone ? ` is-${step.tone}` : ''}`} aria-current={step.state === 'current' ? 'step' : undefined}>
        <span className="shop-order-step-marker" aria-hidden="true">{step.state === 'done' || step.tone === 'success' ? <Check size={15} /> : index + 1}</span>
        <div className="shop-order-step-copy"><strong>{step.label}</strong>{step.date && <small>{shopDate(step.date, timezone)}</small>}</div>
        <span className="shop-order-step-state">{step.state === 'current' ? 'Current' : step.state === 'done' ? 'Done' : 'Upcoming'}</span>
      </li>)}
    </ol>
  </section>;
}
