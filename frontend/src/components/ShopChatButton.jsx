import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { request } from '../api';
import { ChatAlerts } from './ChatAlerts';

export function ShopChatButton({ onOpen, scope }) {
  const [unread, setUnread] = useState(0);
  const label = unread ? `Chat, ${unread} unread messages` : 'Chat';
  return <><ChatAlerts apiRequest={request} basePath="/shop-admin/chat" scope={scope} onOpen={onOpen} onUnread={setUnread} /><button type="button" className="workspace-icon-button workspace-chat-button" aria-label={label} title={label} onClick={onOpen}>
    <MessageCircle size={16} aria-hidden="true" />
    {unread > 0 && <span className="workspace-chat-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </button></>;
}
