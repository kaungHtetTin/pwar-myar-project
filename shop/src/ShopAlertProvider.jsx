import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { useText } from './i18n';
import { go } from './shopNavigation';

const Alerts = createContext({ publish: () => {}, clear: () => {} });
export const useShopAlerts = () => useContext(Alerts);

// One banner replaces the old per-event dismissal queue. No read-state mutations.
export function ShopAlertProvider({ children, customerId, scope }) {
  const text = useText();
  const [notice, setNotice] = useState(null);
  const [visible, setVisible] = useState(!document.hidden && navigator.onLine !== false);
  const delivered = useRef({ order: -1, chat: -1 });
  const mutedRecoveries = useRef(new Set());
  const currentNotice = useRef(notice);
  currentNotice.current = notice;
  const clear = useCallback(kind => setNotice(current => {
    if (!current?.summary) return current?.kind === kind ? null : current;
    const counts = { ...current.counts, [kind]: 0 };
    return counts.order || counts.chat ? { ...current, counts } : null;
  }), []);
  const dismiss = useCallback(() => {
    for (const key of currentNotice.current?.recoveries || []) mutedRecoveries.current.add(key);
    setNotice(null);
  }, []);
  const publish = useCallback(({ kind, items, catchUp = false, recoveryId, ...details }) => {
    // A cached cross-tab feed snapshot must not replay a banner on remount.
    const storageKey = `mkpos.shop.banner:${scope}:${kind}`;
    let through = delivered.current[kind];
    try { through = Math.max(through, Number(sessionStorage.getItem(storageKey) ?? -1)); } catch { /* Memory fallback. */ }
    const ids = new Set();
    const unseen = items.filter(item => {
      const id = Number(item.id);
      if (!Number.isSafeInteger(id) || id <= through || ids.has(id)) return false;
      ids.add(id); return true;
    });
    if (!unseen.length) return;
    const newest = Math.max(...ids);
    delivered.current[kind] = newest;
    try { sessionStorage.setItem(storageKey, String(Math.max(through, newest))); } catch { /* Memory fallback. */ }
    const away = catchUp || document.hidden || navigator.onLine === false;
    const recoveryKey = `${kind}:${recoveryId}`;
    if (away && recoveryId && mutedRecoveries.current.has(recoveryKey)) return;
    setNotice(current => {
      if (away || current?.summary) {
        const counts = current?.summary ? current.counts : { order: 0, chat: 0 };
        return { summary: true, counts: { ...counts, [kind]: counts[kind] + unseen.length },
          recoveries: [...new Set([...(current?.recoveries || []), ...(away && recoveryId ? [recoveryKey] : [])])],
          latest: unseen.at(-1), ...details };
      }
      return { kind, ...details, latest: unseen.at(-1) };
    });
  }, [scope]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden && navigator.onLine !== false);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!notice || !visible) return;
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [notice, visible, dismiss]);
  const open = () => {
    if (notice.summary) {
      if (customerId) go(notice.counts.order ? '/account/notifications' : '/chats');
      else notice.open?.(notice.latest);
    } else notice.open?.(notice.latest);
    dismiss();
  };
  return <Alerts.Provider value={{ publish, clear }}>{children}{notice && visible && createPortal(
    <aside className="chat-app-alert" role="status" aria-live="polite" aria-atomic="true">
      <button type="button" className="chat-app-alert-open" aria-label={text(notice.summary ? 'View updates' : notice.openLabel)} onClick={open}>
        <span className="chat-app-alert-icon" aria-hidden="true"><Bell size={20} /></span>
        <span className="chat-app-alert-content"><span className="chat-app-alert-label">{text(notice.summary ? 'While you were away' : notice.title)}</span>
          <strong>{notice.summary ? text('{orders} order updates and {messages} new messages', { orders: notice.counts.order, messages: notice.counts.chat }) : notice.label}</strong>
          {!notice.summary && notice.preview && <span className="chat-app-alert-preview">{notice.preview}</span>}
        </span>
      </button>
      <button type="button" className="chat-app-alert-dismiss mkpos-dismiss-icon" aria-label={text('Dismiss notification')} onClick={dismiss}><X size={18} /></button>
    </aside>, document.body)}</Alerts.Provider>;
}
