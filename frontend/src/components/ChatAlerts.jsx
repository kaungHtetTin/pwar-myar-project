import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, MessageCircle, X } from 'lucide-react';
import { useChatNotice } from '../useChatNotice';

export function ChatAlerts({ apiRequest, basePath, scope, onOpen, onUnread, suppressed = false }) {
  const { notice, dismiss, pause, resume } = useChatNotice({ apiRequest, basePath, scope, onActivity: data => onUnread?.(data.unread_count || 0), suppressed });
  if (!notice) return null;
  const grouped = notice.conversationCount > 1;
  return createPortal(<aside className="chat-app-alert" role="status" aria-live="polite" aria-atomic="true" onMouseEnter={pause} onMouseLeave={resume} onFocusCapture={pause} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) resume(); }}>
    <span className="chat-app-alert-icon" aria-hidden="true"><MessageCircle size={18} /></span>
    <div className="chat-app-alert-content"><strong>{grouped ? `${notice.messageCount} new messages · ${notice.conversationCount} conversations` : notice.name ? `New message from ${notice.name}` : 'New message'}</strong>{!grouped && notice.messageCount > 1 && <p>{notice.messageCount} new messages</p>}{!grouped && notice.preview && <p>{notice.preview}</p>}
      {onOpen && (grouped || notice.uuid || basePath !== '/chat') && <button type="button" className="primary chat-app-alert-open" onClick={() => { onOpen(notice); dismiss(); }}>{grouped ? 'Open chat inbox' : 'Open chat'}<ArrowUpRight size={14} aria-hidden="true" /></button>}</div>
    <button type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label="Dismiss chat notification" title="Dismiss notification" onClick={dismiss}><X size={18} /></button>
  </aside>, document.body);
}
