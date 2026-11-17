import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, X } from 'lucide-react';
import { monitorSubscription } from './subscriptionActivity';
import { Button, IconButton } from '../components/Controls';
import { useLocale } from '../localization/LocaleContext';

export function SubscriptionAlerts({ apiRequest, scope, onOpen }) {
  const { language } = useLocale();
  const myanmar = language === 'my';
  const [approvals, setApprovals] = useState([]);
  useEffect(() => monitorSubscription(apiRequest, scope, (incoming, subscription) => {
    setApprovals(current => incoming.length ? [...current, ...incoming.filter(item => !current.some(event => event.id === item.id))] : []);
    if (subscription) window.dispatchEvent(new CustomEvent('mkpos:subscription-entitlement', { detail: subscription }));
  }), [apiRequest, scope]);
  const notice = approvals[0];
  if (!notice) return null;
  const dismiss = () => setApprovals(current => current.slice(1));
  return createPortal(<aside key={notice.id} className="chat-app-alert subscription-app-alert" role="status" aria-live="polite" aria-atomic="true">
    <Button variant="plain" type="button" className="chat-app-alert-open" aria-label={myanmar ? 'ငွေတောင်းခံမှု ကြည့်ရန်' : 'View billing'} onClick={() => { onOpen(); dismiss(); }}><span className="chat-app-alert-icon" aria-hidden="true"><BadgeCheck size={20} /></span><span className="chat-app-alert-content"><span className="chat-app-alert-label">{myanmar ? 'စာရင်းသွင်းမှု အတည်ပြုပြီး' : 'Subscription approved'}</span><strong>{notice.plan_name}</strong><span className="chat-app-alert-preview">{myanmar ? 'ရုံးမှ သင့်အစီအစဉ်ကို အတည်ပြုပြီးပါပြီ။' : 'Office approved your subscription plan.'}</span></span></Button>
    <IconButton variant="ghost" type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label={myanmar ? 'စာရင်းသွင်းမှု အသိပေးချက် ပိတ်ရန်' : 'Dismiss subscription notification'} onClick={dismiss}><X size={18} /></IconButton>
  </aside>, document.body);
}
