import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, X } from 'lucide-react';
import { monitorActivity } from '../activityRealtime';
import { useLanguage } from './LanguageProvider';

export function OwnerActivityAlerts({ apiRequest, scope, onOpen }) {
  const { translate } = useLanguage();
  const [approvals, setApprovals] = useState([]);
  useEffect(() => monitorActivity(apiRequest, scope, (incoming, subscription, salesAi) => {
    setApprovals(current => incoming.length ? [...current, ...incoming.filter(item => !current.some(event => event.id === item.id))] : []);
    for (const notice of incoming) if (notice.order_id) window.dispatchEvent(new CustomEvent('mkpos:owner-order-activity', { detail: { orderId: notice.order_id } }));
    if (subscription) window.dispatchEvent(new CustomEvent('mkpos:subscription-entitlement', { detail: subscription }));
    if (salesAi) window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: salesAi }));
  }), [apiRequest, scope]);
  const notice = approvals[0];
  if (!notice) return null;
  const dismiss = () => setApprovals(current => current.slice(1));
  return createPortal(<aside className="chat-app-alert subscription-app-alert owner-activity-alert" role="status" aria-live="polite" aria-atomic="true">
    <span className="chat-app-alert-icon" aria-hidden="true"><BadgeCheck size={20} /></span>
    <div className="chat-app-alert-content"><strong>{translate(notice.title)}</strong><p data-no-localize>{notice.event === 'sales_ai.topup.approved' || notice.target === 'sales-ai-wallet' ? translate(notice.message) : notice.message}</p>
      <button type="button" className="primary chat-app-alert-open" onClick={() => { onOpen(notice); dismiss(); }}>{translate(notice.target === 'order' ? 'View order' : notice.target === 'sales-ai-topup' ? 'View top-up' : notice.target === 'sales-ai-wallet' ? 'View AI balance' : 'View billing')}</button></div>
    <button type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label={translate('Dismiss activity notification')} onClick={dismiss}><X size={18} /></button>
  </aside>, document.body);
}
