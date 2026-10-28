import { useCallback, useEffect, useRef, useState } from 'react';
import { monitorChat } from './chatActivity';

function isVisible(node) {
  for (let current = node; current; current = current.parentElement) {
    if (current.hidden || current.inert || current.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

// Keep the badge feed running; transient alerts are only for new, unseen activity.
export function useChatNotice({ apiRequest, basePath, scope, onActivity, suppressed = false, chatSelector = '.shop-chat-workspace' }) {
  const [notice, setNotice] = useState(null);
  const queue = useRef(null), timer = useRef(null), deadline = useRef(0), held = useRef(false);
  const latest = useRef({ onActivity, suppressed, chatSelector });
  latest.current = { onActivity, suppressed, chatSelector };
  const dismiss = useCallback(() => { clearTimeout(timer.current); queue.current = null; held.current = false; setNotice(null); }, []);
  const pause = useCallback(() => { held.current = true; clearTimeout(timer.current); }, []);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    if (queue.current && !held.current) timer.current = setTimeout(dismiss, Math.max(0, deadline.current - Date.now()));
  }, [dismiss]);
  const resume = useCallback(() => { held.current = false; schedule(); }, [schedule]);
  useEffect(() => { if (suppressed) dismiss(); }, [suppressed, dismiss]);
  useEffect(() => {
    dismiss();
    let initial = true, unread = 0;
    const blocked = () => latest.current.suppressed || document.hidden || [...document.querySelectorAll(`${latest.current.chatSelector},[role="dialog"],[aria-modal="true"]`)].some(isVisible);
    const check = () => { if (blocked()) dismiss(); };
    const readEvent = basePath === '/shop-admin/chat' ? 'mkpos:shop-chat-read' : 'mkpos:customer-chat-read';
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style', 'open', 'inert'] });
    document.addEventListener('visibilitychange', check);
    window.addEventListener(readEvent, dismiss);
    const stop = monitorChat(apiRequest, basePath, data => {
      latest.current.onActivity?.(data);
      const count = Math.max(0, Number(data.unread_count) || 0);
      const readElsewhere = count < unread;
      unread = count;
      if (initial || data.initialSnapshot || blocked() || !data.enabled || !count) {
        initial = false; dismiss(); return;
      }
      if (readElsewhere) dismiss();
      if (!data.items?.length) return;
      const messages = [...new Map([...(queue.current?.messages || []), ...data.items].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id);
      const newest = messages.at(-1);
      const conversations = new Set(messages.map(item => item.uuid || item.slug || 'unknown'));
      const now = Date.now(), started = queue.current?.started ?? now;
      const next = { ...newest, count, messages, messageCount: messages.length, conversationCount: conversations.size, started,
        ...(conversations.size > 1 ? { uuid: undefined, slug: undefined } : {}) };
      queue.current = next; setNotice(next);
      deadline.current = Math.min(now + 6000, started + 12000);
      schedule();
    }, scope);
    return () => {
      stop(); observer.disconnect(); clearTimeout(timer.current); queue.current = null;
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener(readEvent, dismiss);
    };
  }, [apiRequest, basePath, scope, dismiss, schedule]);
  return { notice: suppressed ? null : notice, dismiss, pause, resume };
}
