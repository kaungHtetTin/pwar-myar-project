import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { monitorActivity } from './activityRealtime';
import { Button, IconButton } from '../components/Controls';
import { useLocale } from '../localization/LocaleContext';
import { featureText } from '../../../shared/localization/newFeatures.js';

const labels = {
  'Sales AI top-up approved': 'Sales AI ငွေဖြည့်တောင်းဆိုမှု အတည်ပြုပြီး',
  'Sales AI top-up rejected': 'Sales AI ငွေဖြည့်တောင်းဆိုမှု ပယ်ချပြီး',
  'Sales AI top-up cancelled': 'Sales AI ငွေဖြည့်တောင်းဆိုမှု ပယ်ဖျက်ပြီး',
  'Sales AI balance updated': 'Sales AI လက်ကျန် ပြင်ဆင်ပြီး',
  'Payment proof submitted': 'ငွေပေးချေမှုအထောက်အထား တင်ပြီး',
  'Cancellation requested': 'အော်ဒါပယ်ဖျက်ရန် တောင်းဆိုထားသည်',
  'Return/refund requested': 'ပစ္စည်း/ငွေပြန်အမ်းရန် တောင်းဆိုထားသည်',
  'Subscription approved': 'စာရင်းသွင်းမှု အတည်ပြုပြီး',
  'Subscription request rejected': 'စာရင်းသွင်းမှု တောင်းဆိုချက် ပယ်ချပြီး',
  'Subscription suspended': 'စာရင်းသွင်းမှု ယာယီရပ်ဆိုင်းထားသည်',
  'Subscription restored': 'စာရင်းသွင်းမှု ပြန်လည်အသုံးပြုနိုင်ပြီ',
  'Subscription cancelled': 'စာရင်းသွင်းမှု ပယ်ဖျက်ပြီး',
  'Subscription updated': 'စာရင်းသွင်းမှု ပြင်ဆင်ပြီး',
};
export function OwnerActivityAlerts({ apiRequest, scope, onOpen }) {
  const { language } = useLocale();
  const myanmar = language === 'my';
  const [events, setEvents] = useState([]);
  useEffect(() => monitorActivity(apiRequest, scope, (incoming, subscription, salesAi) => {
    setEvents(current => incoming.length ? [...current, ...incoming.filter(item => !current.some(event => event.id === item.id))] : []);
    for (const notice of incoming) if (notice.order_id) window.dispatchEvent(new CustomEvent('mkpos:owner-order-activity', { detail: { orderId: notice.order_id } }));
    if (subscription) window.dispatchEvent(new CustomEvent('mkpos:subscription-entitlement', { detail: subscription }));
    if (salesAi) window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: salesAi }));
  }), [apiRequest, scope]);
  const notice = events[0];
  if (!notice) return null;
  const dismiss = () => setEvents(current => current.slice(1));
  const action = notice.target === 'order' ? (myanmar ? 'အော်ဒါကြည့်ရန်' : 'View order') : notice.target === 'sales-ai-topup' ? (myanmar ? 'ငွေဖြည့်တောင်းဆိုမှုကြည့်ရန်' : 'View top-up') : notice.target === 'sales-ai-wallet' ? (myanmar ? 'AI လက်ကျန်ကြည့်ရန်' : 'View AI balance') : (myanmar ? 'ငွေတောင်းခံမှု ကြည့်ရန်' : 'View billing');
  return createPortal(<aside key={notice.id} className="chat-app-alert subscription-app-alert owner-activity-alert" role="status" aria-live="polite" aria-atomic="true">
    <Button variant="plain" type="button" className="chat-app-alert-open" aria-label={action} onClick={() => { onOpen(notice); dismiss(); }}><span className="chat-app-alert-icon" aria-hidden="true"><Bell size={20} /></span><span className="chat-app-alert-content"><span className="chat-app-alert-label">{myanmar ? 'အသိပေးချက်အသစ်' : 'New update'}</span><strong>{myanmar ? labels[notice.title] || notice.title : notice.title}</strong><span className="chat-app-alert-preview" data-no-localize>{notice.event === 'sales_ai.topup.approved' || notice.target === 'sales-ai-wallet' ? featureText(notice.message, language) : notice.message}</span></span></Button>
    <IconButton variant="ghost" type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label={myanmar ? 'အသိပေးချက် ပိတ်ရန်' : 'Dismiss activity notification'} onClick={dismiss}><X size={18} /></IconButton>
  </aside>, document.body);
}
