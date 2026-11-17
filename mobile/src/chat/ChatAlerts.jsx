import { Button, IconButton } from '../components/Controls';
import React from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { useChatNotice } from './useChatNotice';
import { useLocale } from '../localization/LocaleContext';

export function ChatAlerts({ apiRequest, basePath, scope, onOpen, onActivity, suppressed = false }) {
  const { notice, dismiss, pause, resume } = useChatNotice({ apiRequest, basePath, scope, onActivity, suppressed, chatSelector: '.shop-chat-inbox,.shop-mobile-conversation' });
  const { language } = useLocale();
  if (!notice) return null;
  const myanmar = language === 'my', grouped = notice.conversationCount > 1;
  const canOpen = onOpen && (grouped || notice.uuid || basePath !== '/chat');
  const heading = grouped ? (myanmar ? `စကားပြောခန်း ${notice.conversationCount} ခုမှ မက်ဆေ့ချ်အသစ် ${notice.messageCount} ခု` : `${notice.messageCount} new messages · ${notice.conversationCount} conversations`) : notice.name || (myanmar ? 'မက်ဆေ့ချ်အသစ်' : 'New message');
  const label = myanmar ? (grouped ? 'စကားပြောခန်းများ ဖွင့်ရန်' : 'စကားပြောခန်း ဖွင့်ရန်') : grouped ? 'Open chat inbox' : 'Open chat';
  const content = <><span className="chat-app-alert-icon" aria-hidden="true"><MessageCircle size={20} /></span><span className="chat-app-alert-content"><span className="chat-app-alert-label">{myanmar ? 'မက်ဆေ့ချ်အသစ်' : 'New message'}{!grouped && notice.messageCount > 1 ? ` · ${notice.messageCount}` : ''}</span><strong>{heading}</strong>{!grouped && notice.preview && <span className="chat-app-alert-preview">{notice.preview}</span>}</span></>;
  return createPortal(<aside className="chat-app-alert" role="status" aria-live="polite" aria-atomic="true" onMouseEnter={pause} onMouseLeave={resume} onFocusCapture={pause} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) resume(); }}>
    {canOpen ? <Button variant="plain" type="button" className="chat-app-alert-open" aria-label={label} onClick={() => { onOpen(notice); dismiss(); }}>{content}</Button> : <div className="chat-app-alert-open">{content}</div>}
    <IconButton variant="ghost" type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label={myanmar ? 'မက်ဆေ့ချ်အသိပေးချက် ပိတ်ရန်' : 'Dismiss chat notification'} title={myanmar ? 'အသိပေးချက် ပိတ်ရန်' : 'Dismiss notification'} onClick={dismiss}><X size={18} /></IconButton>
  </aside>, document.body);
}
