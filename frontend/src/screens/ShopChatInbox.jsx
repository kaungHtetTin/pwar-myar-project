import { getBusinessTimezone } from '../timezone';
import { ProfileAvatar } from '../components/ProfileAvatar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../api';
import { TelegramReceipt } from '../components/TelegramChatStatus';
import { Check, CheckCheck } from 'lucide-react';
import { chatDate, chatInitials, chatTime, lastSeenLabel } from '../shopChatPresentation';

export function ShopChatInbox({ query, refresh, selected, onSelect, readThread, activeCustomers = null, presenceKnown = true, handlingUpdate = null, aiHandoverRevision = 0 }) {
  const [state, setState] = useState({ items: [], loading: true, error: '', more: false });
  const [filter, setFilter] = useState('all');
  const scope = JSON.stringify([query, filter]);
  const isActive = (thread) => thread.sales_ai_channel !== 'telegram' && ((activeCustomers || state.activeCustomers)?.includes(thread.uuid) ?? thread.customer_active);
  const retryAfter = useRef(0);
  const pendingRefresh = useRef(false), refreshList = useRef(null);
  const viewport = useRef(null), sentinel = useRef(null), items = useRef([]), cursor = useRef(null), busy = useRef(false), generation = useRef(0), currentQuery = useRef(null), paged = useRef(false);
  const load = useCallback(async (next = false) => {
    if (busy.current) { if (!next) pendingRefresh.current = true; return; }
    if ((next && !cursor.current) || viewport.current?.closest('[hidden]') || Date.now() < retryAfter.current) return;
    const version = generation.current;
    busy.current = true;
    setState((value) => ({ ...value, loading: true, error: '' }));
    try {
      const suffix = next ? `&cursor=${encodeURIComponent(cursor.current)}` : '';
      const endpoint = `/shop-admin/chat?q=${encodeURIComponent(query)}&limit=25${filter === 'unread' ? '&filter=unread' : ''}`;
      const result = await request(`${endpoint}${suffix}`);
      let page = result, offset = result.items.length;
      // Refresh every loaded row, including read receipts on older threads.
      while (!next && offset < items.current.length && page.next_cursor && page.items.length === 25) {
        page = await request(`${endpoint}&offset=${offset}`);
        if (version !== generation.current) return;
        offset += page.items.length;
        result.items.push(...page.items);
      }
      if (version !== generation.current) return;
      const previousByUuid = new Map(items.current.map(item => [item.uuid, item]));
      result.items = result.items.map(item => {
        const previous = previousByUuid.get(item.uuid);
        return previous?.sales_ai?.version > item.sales_ai?.version ? { ...item, sales_ai: previous.sales_ai } : item;
      });
      const incoming = new Set(result.items.map((item) => item.uuid));
      const base = next ? items.current : [...result.items, ...items.current.filter((item) => !incoming.has(item.uuid))];
      const merged = new Map(base.map((item) => [item.uuid, item]));
      result.items.forEach((item) => merged.set(item.uuid, item));
      if (filter === 'unread') {
        const unread = result.unread_threads ? new Set(result.unread_threads) : null;
        for (const [uuid, thread] of merged) if (unread ? !unread.has(uuid) : !thread.unread) merged.delete(uuid);
      }
      items.current = [...merged.values()].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      if (next || !paged.current || offset > 25) cursor.current = page.next_cursor || null;
      if (next) paged.current = true;
      setState({ items: items.current, loading: false, error: '', more: Boolean(cursor.current), activeCustomers: result.active_customers });
    } catch (error) {
      if (error.status === 429) retryAfter.current = Date.now() + (error.retryAfterMs || 60000);
      if (version === generation.current) setState((value) => ({ ...value, loading: false, error: error.message }));
    } finally {
      if (version === generation.current) {
        busy.current = false;
        if (pendingRefresh.current) { pendingRefresh.current = false; void refreshList.current(); }
      }
    }
  }, [query, filter]);
  refreshList.current = () => load();
  useEffect(() => {
    if (currentQuery.current !== scope) {
      generation.current++; currentQuery.current = scope; pendingRefresh.current = false;
      items.current = []; cursor.current = null; paged.current = false; busy.current = false;
      setState({ items: [], loading: true, error: '', more: false });
      if (viewport.current) viewport.current.scrollTop = 0;
    }
    load();
  }, [scope, refresh, load]);
  useEffect(() => () => { generation.current++; busy.current = false; }, []);
  useEffect(() => {
    if (!state.more || state.loading || state.error || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) load(true); }, { root: viewport.current, rootMargin: '0px 0px 120px 0px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [load, state.more, state.loading, state.error, state.items.length]);
  useEffect(() => {
    if (!readThread) return;
    items.current = items.current.map((item) => item.uuid === readThread.uuid ? { ...item, unread: 0 } : item);
    if (filter === 'unread') items.current = items.current.filter(item => item.unread > 0);
    setState((value) => ({ ...value, items: items.current }));
  }, [readThread, filter]);
  useEffect(() => {
    if (!handlingUpdate?.sales_ai) return;
    items.current = items.current.map(thread => thread.uuid === handlingUpdate.uuid ? { ...thread, sales_ai: handlingUpdate.sales_ai } : thread);
    setState(current => ({ ...current, items: items.current }));
  }, [handlingUpdate]);
  useEffect(() => {
    if (!aiHandoverRevision) return;
    items.current = items.current.map(thread => ['waiting_owner', 'human'].includes(thread.sales_ai?.mode) ? { ...thread, sales_ai: { ...thread.sales_ai, mode: 'ai', version: thread.sales_ai.version + 1 } } : thread);
    setState(current => ({ ...current, items: items.current }));
  }, [aiHandoverRevision]);
  return <section className="panel shop-chat-inbox" aria-label="Customer chats">
    <header className="shop-chat-inbox-heading"><h2>Conversations</h2><div className="shop-chat-filter" role="group" aria-label="Conversation filter">
      {['all', 'unread'].map(value => <button type="button" className="shop-chat-filter-button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : 'Unread'}</button>)}
    </div></header>
    <div className="shop-chat-thread-list" ref={viewport} onScroll={() => {
      const node = viewport.current;
      if (!state.error && node.scrollHeight - node.scrollTop - node.clientHeight < 120) load(true);
    }}>
      {state.items.map((thread) => <button type="button" className={`shop-chat-thread${thread.unread > 0 ? ' is-unread' : ''}`} key={thread.uuid} aria-label={thread.customer_name} aria-describedby={thread.sales_ai?.mode === 'waiting_owner' ? `needs-human-${thread.uuid}` : undefined} aria-pressed={selected?.uuid === thread.uuid} onClick={() => onSelect(thread)}>
        <span className={`shop-chat-avatar${isActive(thread) ? ' is-active' : ''}`}><ProfileAvatar url={thread.avatar_url}>{chatInitials(thread.customer_name)}</ProfileAvatar>{thread.sales_ai_channel !== 'telegram' && <span className={`shop-chat-presence-dot ${isActive(thread) ? 'is-online' : presenceKnown ? 'is-offline' : 'is-unknown'}`} role="img" aria-label={isActive(thread) ? 'Active now' : presenceKnown ? 'Offline' : 'Presence unavailable'} title={isActive(thread) ? 'Active now' : lastSeenLabel(thread.customer_last_seen_at) || (presenceKnown ? 'Offline' : 'Presence unavailable')} />}</span>
        <span className="shop-chat-thread-content">
          <span className="shop-chat-thread-heading"><strong>{thread.customer_name}</strong><time title={chatDate(thread.last_message?.created_at)?.toLocaleString(undefined, { timeZone: getBusinessTimezone() })}>{chatTime(thread.last_message?.created_at)}</time></span>
          <span className="shop-chat-thread-summary"><span className="shop-chat-preview">
            {thread.last_message?.sender === 'owner' && (thread.sales_ai_channel === 'telegram' ? <TelegramReceipt message={thread.last_message} compact /> : <span className={`shop-chat-receipt${thread.customer_read_id >= thread.last_message.id ? ' is-seen' : ''}`} aria-label={thread.customer_read_id >= thread.last_message.id ? 'Seen' : 'Sent'}>{thread.customer_read_id >= thread.last_message.id ? <CheckCheck size={14} /> : <Check size={14} />}</span>)}
            <span>{thread.last_message ? `${thread.last_message.sender === 'owner' ? 'You: ' : ''}${thread.last_message.product ? `Product: ${thread.last_message.product.name}${thread.last_message.body ? ' · ' : ''}` : ''}${thread.last_message.image ? (thread.last_message.image.status === 'expired' ? 'Image expired' : 'Image') + (thread.last_message.body ? ' ? ' : '') : ''}${thread.last_message.body}` : 'No messages yet'}</span>
          </span>{thread.unread > 0 && <span className="shop-chat-unread-count" aria-label={`${thread.unread} unread messages`}>{thread.unread > 99 ? '99+' : thread.unread}</span>}</span>
          {thread.sales_ai?.mode === 'waiting_owner' && <span id={`needs-human-${thread.uuid}`} className="shop-chat-needs-human">Needs human</span>}
        </span>
      </button>)}
      <div ref={sentinel} className="shop-chat-list-end">
        {state.error ? <p role="alert">{state.error} <button type="button" onClick={() => load(paged.current || Boolean(cursor.current))}>Retry</button></p>
          : state.loading ? <p role="status">Loading conversations…</p>
            : !state.items.length ? <p>{filter === 'unread' ? 'No unread conversations.' : 'No conversations found.'}</p>
              : !state.more && <small>All conversations loaded.</small>}
      </div>
    </div>
  </section>;
}
