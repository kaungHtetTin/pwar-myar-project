import { createPollPolicy } from './backgroundPolicy';
import { shopDate } from './dateTime';
import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './chat-inbox.css';
import { ArrowLeft, MessageCircle, Store, EllipsisVertical, Search, ArrowRight } from 'lucide-react';
import { request, API } from './api';
import { useCustomer } from './CustomerAccount';
import { useText } from './i18n';
import { useEndless } from './useEndless';
import { useShopPageActive } from './RetainedViews';
import { goBack } from './shopNavigation';
import { ShopChatConversation } from './ShopChatConversation';
import { ChatLastSeen } from './ChatLastSeen';
import { connectShopChat } from './chatRealtime';

const accountRequest = (path, options = {}) => request(path, { ...options, customerAuth: true });

export function CustomerChats({ uuid, slug, filter = 'all' }) {
  const { customer, loading } = useCustomer();
  const text = useText();
  if (loading) return <LoadingSkeleton variant={uuid || slug ? "conversation" : "chats"} message="Loading account…" page />;
  if (!customer) return <section className="narrow feature-panel"><h1>{text('Chats')}</h1><p>{text('Sign in to chat with shop')}</p><a className="button primary" href={`#/account/login?next=${encodeURIComponent(uuid ? `/chats/${uuid}` : slug ? `/chats?shop=${encodeURIComponent(slug)}` : '/chats')}`}>{text('Sign in')}</a></section>;
  return uuid ? <CustomerConversation uuid={uuid} /> : slug ? <OpenShopConversation slug={slug} /> : <ConversationList filter={filter} />;
}

function OpenShopConversation({ slug }) {
  const text = useText();
  const pageActive = useShopPageActive();
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!pageActive) return;
    let active = true;
    setError('');
    accountRequest(`/stores/${encodeURIComponent(slug)}/chat`, { method: 'POST', body: '{}' })
      .then(result => {
        if (!active) return;
        // Replace the lookup entry so Back returns straight to its source.
        window.history.replaceState(window.history.state, '', `#/chats/${encodeURIComponent(result.thread.uuid)}`);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [slug, retry, pageActive]);
  return <section className="narrow customer-chat-page"><header className="customer-chat-page-header"><button type="button" className="shop-icon-button" aria-label={text('Back to chats')} onClick={() => goBack('/chats')}><ArrowLeft size={24} /></button><h1>{text('Chats')}</h1></header>{error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>{text('Retry')}</button></p> : <LoadingSkeleton variant="conversation" message="Opening conversation…" />}</section>;
}

function ConversationList({ filter }) {
  const text = useText();
  const active = useShopPageActive();
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const listPath = `/chat?q=${encodeURIComponent(search)}&unread=${filter === 'unread' ? 1 : 0}`;
  const list = useEndless(listPath, accountRequest);
  const visible = useRef(active), pending = useRef(false), refreshList = useRef(null), loadedThreads = useRef(list.items);
  visible.current = active;
  loadedThreads.current = list.items;
  refreshList.current = () => {
    pending.current = true;
    if (!visible.current || document.hidden) return;
    pending.current = false;
    void list.revalidate();
  };
  useEffect(() => {
    const read = event => {
      const removed = filter === 'unread' && loadedThreads.current.some(thread => thread.uuid === event.detail.uuid);
      list.reconcile(items => items
        .map(thread => thread.uuid === event.detail.uuid ? { ...thread, unread_count: 0 } : thread)
        .filter(thread => filter !== 'unread' || thread.unread_count > 0), { cursorDelta: removed ? -1 : 0 });
    };
    window.addEventListener('mkpos:customer-chat-read', read);
    return () => window.removeEventListener('mkpos:customer-chat-read', read);
  }, [list.reconcile, filter]);
  useEffect(() => {
    let disposed = false, stop, live = false;
    const poll = createPollPolicy();
    accountRequest('/chat/inbox-config').then(config => {
      if (disposed || !config.channel) return;
      stop = connectShopChat(config, config.channel,
        data => accountRequest('/chat/auth', { method: 'POST', body: JSON.stringify(data) }),
        () => { poll.success(); refreshList.current(); }, value => { live = value === 'Live'; }, undefined, () => visible.current);
    }).catch(() => { /* Older APIs and socket outages retain polling support. */ });
    const refresh = () => refreshList.current();
    const timer = setInterval(() => { if (poll.ready() && poll.due(live)) { poll.success(); refresh(); } }, 15000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => { disposed = true; stop?.(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, []);
  useEffect(() => { if (active && pending.current) refreshList.current(); }, [active]);
  return <section className="narrow customer-chats">
    <div className="chats-search-band app-bar-search-band"><form className="app-bar-search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); }}><Search size={21} aria-hidden="true" /><input type="search" maxLength={120} aria-label={text('Search conversations')} placeholder={text('Search conversations...')} value={query} onChange={event => setQuery(event.target.value)} /><button type="submit" aria-label={text('Search')}><ArrowRight size={21} aria-hidden="true" /></button></form></div>
    <div className="chats-list-surface">
    <div className="customer-conversation-list">
      {list.items.map(thread => <a className="customer-conversation-row" key={thread.uuid} href={`#/chats/${encodeURIComponent(thread.uuid)}`}>
        <ConversationAvatar slug={thread.slug} />
        <span className="customer-conversation-summary"><strong>{thread.shop_name}</strong>{thread.owner_active && <small className="conversation-online">● {text('Online')}</small>}<span>{thread.preview || text('No messages yet. Start the conversation.')}</span>{thread.product && <span className="inbox-product-preview">{thread.product.photo_url && <img src={thread.product.photo_url} alt="" />}<span><strong>{thread.product.name}</strong><small>{Number(thread.product.price).toLocaleString()} {thread.product.currency}</small></span></span>}</span>
        <span className="customer-conversation-meta"><time>{shopDate(thread.updated_at)?.toLocaleDateString([], { timeZone: thread.timezone || 'Asia/Yangon', month: 'short', day: 'numeric' })}</time>{thread.unread_count > 0 && <b aria-label={`${thread.unread_count} ${text('Unread messages')}`}>{thread.unread_count}</b>}</span>
      </a>)}
    </div>
    {list.busy && <LoadingSkeleton variant="chats" count={list.items.length ? 1 : 5} message="Loading conversations…" />}
    {list.error && <p role="alert">{list.error} <button type="button" onClick={list.retry}>{text('Retry')}</button></p>}
    {!list.busy && !list.error && !list.items.length && <div className="feature-empty"><MessageCircle size={32} /><h2>{text(search || filter === 'unread' ? 'No matching conversations' : 'No conversations yet')}</h2><p>{text('Open a shop and start a chat. Your conversations will appear here.')}</p><a className="button" href="#/marketplace">{text('Browse shops')}</a></div>}
    <div ref={list.sentinel} />
    </div>
  </section>;
}

function ConversationAvatar({ slug }) {
  const [failed, setFailed] = useState(false);
  return <span className="customer-conversation-avatar">{slug && !failed ? <img src={`${API}/ecommerce/stores/${encodeURIComponent(slug)}/logo`} alt="" onError={() => setFailed(true)} /> : <Store size={24} aria-hidden="true" />}</span>;
}

function CustomerConversation({ uuid }) {
  const text = useText();
  const [session, setSession] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [presence, setPresence] = useState(null), [lastSeen, setLastSeen] = useState(null);
  const [shop, setShop] = useState(null);
  const [headerStatusHost, setHeaderStatusHost] = useState(null);
  const [headerActionsHost, setHeaderActionsHost] = useState(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const dismiss = event => {
      const menu = menuRef.current;
      if (!menu?.open) return;
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return;
        menu.open = false;
        menu.querySelector('summary')?.focus();
      } else if (!menu.contains(event.target)) menu.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, []);
  useEffect(() => { if (!session?.thread.slug) return; let active = true; request(`/stores/${encodeURIComponent(session.thread.slug)}`).then(value => { if (active) setShop(value); }).catch(() => {}); return () => { active = false; }; }, [session?.thread.slug]);
  const lastRead = useRef(0);
  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([accountRequest(`/chat/${encodeURIComponent(uuid)}`), accountRequest('/chat/config')])
      .then(([result, config]) => { if (active) setSession({ thread: result.thread, config }); })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [uuid, retry]);
  const markRead = useCallback(id => {
    if (id <= lastRead.current) return;
    lastRead.current = id;
    accountRequest(`/chat/${uuid}/read`, { method: 'POST', body: JSON.stringify({ message_id: id }) })
      .then(() => window.dispatchEvent(new CustomEvent('mkpos:customer-chat-read', { detail: { uuid } })))
      .catch(() => { lastRead.current = 0; });
  }, [uuid]);
  return <section className="narrow customer-chat-page">
    <header className="customer-chat-page-header"><button type="button" className="shop-icon-button" aria-label={text('Back to chats')} onClick={() => goBack('/chats')}><ArrowLeft size={24} /></button><span className="conversation-shop-avatar">{shop?.logo_url ? <img src={shop.logo_url} alt="" /> : <Store size={24} aria-hidden="true" />}</span><div><h1>{session?.thread.shop_name || text('Chats')}</h1>{session && <small><span className={`conversation-presence ${presence?.owner_active ? 'is-online' : ''}`} /><ChatLastSeen active={presence?.owner_active} known={Boolean(presence)} value={lastSeen || session.thread.owner_last_seen_at} /><span className="conversation-header-status" ref={setHeaderStatusHost} /></small>}</div>{session?.thread.slug && <details className="conversation-menu" ref={menuRef}><summary aria-label={text('Conversation actions')}><EllipsisVertical size={24} /></summary><div className="conversation-menu-popover"><a className="conversation-menu-item" href={`#/store/${encodeURIComponent(session.thread.slug)}`} onClick={() => { if (menuRef.current) menuRef.current.open = false; }}><Store size={18} aria-hidden="true" /><span>{text('View shop')}</span></a><div className="conversation-menu-ai-actions" ref={setHeaderActionsHost} /></div></details>}</header>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>{text('Retry')}</button></p> : session ? <ShopChatConversation uuid={uuid} headerStatusHost={headerStatusHost} headerActionsHost={headerActionsHost} shopAvatar={shop?.logo_url} config={session.config} apiRequest={accountRequest} basePath="/chat" authPath="/chat/auth" selfSender="customer" onRead={markRead} onPresence={setPresence} onLastSeen={setLastSeen} /> : <LoadingSkeleton variant="conversation" message="Opening conversation…" />}
  </section>;
}
