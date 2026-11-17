import { useEffect, useRef } from 'react';
import { monitorChat } from './chatActivity';
import { useText } from './i18n';
import { useShopAlerts } from './ShopAlertProvider';

export function ChatAlerts({ apiRequest, basePath, scope, onOpen, onUnread, suppressed = false }) {
  const { publish, clear } = useShopAlerts();
  const text = useText();
  const callbacks = useRef({ onOpen, onUnread, suppressed, text });
  callbacks.current = { onOpen, onUnread, suppressed, text };
  useEffect(() => { if (suppressed) clear('chat'); }, [suppressed, clear]);
  useEffect(() => monitorChat(apiRequest, basePath, data => {
    const current = callbacks.current;
    current.onUnread?.(data.unread_count || 0);
    if (current.suppressed || !data.enabled || !data.unread_count) { clear('chat'); return; }
    const newest = data.items?.at(-1);
    if (newest) publish({ kind: 'chat', items: data.items, catchUp: data.catchUp, recoveryId: data.recoveryId,
      title: 'New message', label: newest.name || current.text('{count} unread chat messages', { count: data.unread_count }),
      preview: newest.preview, openLabel: 'Open chat', open: notice => callbacks.current.onOpen?.(notice) });
  }, scope), [apiRequest, basePath, scope, publish, clear]);
  return null;
}
