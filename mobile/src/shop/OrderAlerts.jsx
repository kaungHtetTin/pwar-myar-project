import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, X } from 'lucide-react';
import { monitorOrders } from './orderActivity';
import { Button, IconButton } from '../components/Controls';
import { useLocale } from '../localization/LocaleContext';

export function OrderAlerts({ apiRequest, onOpen, onActivity }) {
  const { language } = useLocale();
  const myanmar = language === 'my';
  const [orders, setOrders] = useState([]);
  const activity = useRef(onActivity);
  activity.current = onActivity;
  useEffect(() => monitorOrders(apiRequest, incoming => {
    setOrders(current => incoming.length ? [...current, ...incoming.filter(item => !current.some(order => order.id === item.id))] : []);
  }, count => activity.current?.(count)), [apiRequest]);
  const notice = orders[0];
  if (!notice) return null;
  const dismiss = () => setOrders(current => current.slice(1));
  const content = <><span className="chat-app-alert-icon" aria-hidden="true"><ShoppingBag size={20} /></span><span className="chat-app-alert-content"><span className="chat-app-alert-label">{myanmar ? 'အော်ဒါအသစ်' : 'New order'}</span><strong>{notice.customer_name || (myanmar ? 'ဧည့်သည်ဝယ်သူ' : 'Guest customer')}</strong><span className="chat-app-alert-preview">{notice.reference} · {Number(notice.total).toLocaleString()} {notice.currency}{orders.length > 1 ? ` · ${orders.length} ${myanmar ? 'အော်ဒါအသစ်' : 'new orders'}` : ''}</span></span></>;
  return createPortal(<aside key={notice.id} className="chat-app-alert order-app-alert" role="status" aria-live="polite" aria-atomic="true">
    <Button variant="plain" type="button" className="chat-app-alert-open" aria-label={myanmar ? 'အော်ဒါကြည့်ရန်' : 'Open order'} onClick={() => { onOpen(notice); dismiss(); }}>{content}</Button>
    <IconButton variant="ghost" type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label={myanmar ? 'အော်ဒါအသိပေးချက် ပိတ်ရန်' : 'Dismiss order notification'} title={myanmar ? 'အသိပေးချက် ပိတ်ရန်' : 'Dismiss notification'} onClick={dismiss}><X size={18} /></IconButton>
  </aside>, document.body);
}
