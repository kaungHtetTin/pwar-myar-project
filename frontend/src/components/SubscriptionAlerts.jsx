import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, X } from 'lucide-react';
import { monitorSubscription } from '../subscriptionActivity';

export function SubscriptionAlerts({ apiRequest, scope, onOpen }) {
  const [approvals, setApprovals] = useState([]);
  useEffect(() => monitorSubscription(apiRequest, scope, (incoming, subscription) => {
    setApprovals(current => incoming.length ? [...current, ...incoming.filter(item => !current.some(event => event.id === item.id))] : []);
    if (subscription) window.dispatchEvent(new CustomEvent('mkpos:subscription-entitlement', { detail: subscription }));
  }), [apiRequest, scope]);
  const notice = approvals[0];
  if (!notice) return null;
  const dismiss = () => setApprovals(current => current.slice(1));
  return createPortal(<aside className="chat-app-alert subscription-app-alert" role="status" aria-live="polite" aria-atomic="true">
    <span className="chat-app-alert-icon" aria-hidden="true"><BadgeCheck size={20} /></span>
    <div className="chat-app-alert-content"><strong>Subscription approved</strong><p>Office approved your {notice.plan_name} plan.</p>
      <button type="button" className="primary chat-app-alert-open" onClick={() => { onOpen(); dismiss(); }}>View billing</button></div>
    <button type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label="Dismiss subscription notification" onClick={dismiss}><X size={18} /></button>
  </aside>, document.body);
}
