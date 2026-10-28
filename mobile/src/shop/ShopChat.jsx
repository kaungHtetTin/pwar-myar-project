import { TelegramReceipt } from './TelegramChatStatus';
import { telegramPresence } from './telegramPresence';
import { createPollPolicy } from '../backgroundPolicy';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton, Input, SearchInput, Select, Switch, Textarea } from '../components/Controls';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Bot, LoaderCircle, ChevronRight, ImagePlus, ImageOff, MessageCircle, Package, Send, UserRound, X } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { EndlessListFooter, MobileFilterActions, MobileFilterPanel, MobileFilterToggle, MobileSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { PageActivityContext, usePageRefresh } from '../navigation/pageRefresh';
import { ShopBusy, ShopErrorNotice, ShopField, ShopLoadState, ShopLoading, ShopPrivateImage } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { canShop, shopDate, shopMoney } from './shopUtils';
import { connectMobileShopChat } from './shopChatRealtime';
import { customerShopLink } from './shopLinks';

function chatInitials(name) {
  return name?.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase();
}

function SharedProduct({ product }) {
  const url = product.public_url || customerShopLink(product.store_slug, product.id);
  const details = <><ChatProductImage product={product} /><span className="shop-chat-shared-copy"><strong>{product.name}</strong><p>{shopMoney(product.price, product.currency)} / {product.unit_name}</p><small>Price when shared</small>{url && <small>View product</small>}</span></>;
  return url ? <a href={url} target="_blank" rel="noreferrer">{details}</a> : <div>{details}</div>;
}

function imageExpiresAt(value) {
  if (!value) return Infinity;
  const date = value.replace(' ', 'T');
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(date) ? date : `${date}Z`).getTime();
}

function ChatPresence({ thread, timezone = 'Asia/Rangoon' }) {
  if (thread?.sales_ai_channel === 'telegram') return <small title={telegramPresence(thread)}>{telegramPresence(thread)}</small>;
  if (thread?.customer_active) return <small className="is-online">Active now</small>;
  const seen = thread?.customer_last_seen_at;
  const date = new Date(imageExpiresAt(seen));
  if (!seen || !Number.isFinite(date.getTime())) return <small>Offline</small>;
  const label = date.toLocaleString('en-GB', { timeZone: timezone, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(', ', ' ');
  return <small className="shop-chat-last-seen"><time dateTime={date.toISOString()} title={`Last seen ${shopDate(seen, timezone)}`} aria-label={`Last seen ${label}`} data-no-localize>{label}</time></small>;
}

export function ShopChatInbox({ onNavigate, session }) {
  const config = useShopResource('/shop-admin/chat/config');
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false), [draftFilter, setDraftFilter] = useState('all');
  const [handlingUpdates, setHandlingUpdates] = useState({});
  const [bulkBusy, setBulkBusy] = useState(false), [bulkNotice, setBulkNotice] = useState(''), [bulkError, setBulkError] = useState('');
  const bulkWorking = useRef(false), currentThreads = useRef([]);
  useEffect(() => {
    const update = event => {
      const thread = event.detail;
      if (thread?.uuid && thread.sales_ai) setHandlingUpdates(current => ({ ...current, [thread.uuid]: thread.sales_ai }));
    };
    window.addEventListener('mkpos:shop-chat-handling', update);
    return () => window.removeEventListener('mkpos:shop-chat-handling', update);
  }, []);
  const active = useContext(PageActivityContext), visible = useRef(active); visible.current = active;
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const queryKey = new URLSearchParams({ q: query, filter }).toString();
  const list = useEndlessList({ enabled: !!config.data?.enabled, queryKey, loadPage: ({ offset, limit, signal }) => apiRequest(`/shop-admin/chat?${queryKey}&offset=${offset}&limit=${limit}`, { signal }) });
  currentThreads.current = list.items;
  const reload = useRef(list.reload); reload.current = list.reload;
  const listReady = useRef(false), refreshPending = useRef(null); listReady.current = !list.initialLoading;
  usePageRefresh(list.reload);
  useEffect(() => {
    if (!config.data?.enabled) return;
    let running = false, pending = false, disposed = false, live = false;
    const poll = createPollPolicy();
    const refresh = async () => {
      pending = true;
      if (!poll.ready() || running || !visible.current || document.hidden || disposed || !listReady.current) return;
      running = true;
      try {
        do {
          pending = false;
          if (await reload.current() === false) { poll.failure(new Error('Chat refresh failed.')); break; }
          poll.success();
        }
        while (pending && !disposed && visible.current && !document.hidden);
      } finally { running = false; }
    };
    // Record changes while a retained inbox is hidden; reconcile on activation.
    const connection = connectMobileShopChat(config.data, config.data.channel, { visible: () => visible.current, change: refresh, status: value => { live = value === 'Live'; }, listenWhileHidden: true });
    const timer = setInterval(() => { if (poll.due(live) && (pending || visible.current)) void refresh(); }, 15000);
    const resume = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('mkpos:shop-chat-read', refresh);
    document.addEventListener('visibilitychange', resume);
    refreshPending.current = () => { if (pending) void refresh(); };
    return () => { disposed = true; refreshPending.current = null; connection.close(); clearInterval(timer); window.removeEventListener('mkpos:shop-chat-read', refresh); document.removeEventListener('visibilitychange', resume); };
  }, [config.data]);
  useEffect(() => { if (active && !list.initialLoading) refreshPending.current?.(); }, [active, list.initialLoading]);
  async function handoverAll() {
    if (bulkWorking.current || !canShop(session, 'ecommerce_process') || !config.data?.sales_ai_enabled) return;
    bulkWorking.current = true; setBulkBusy(true); setBulkNotice(''); setBulkError('');
    try {
      const result = await apiRequest('/shop-admin/chat/handoff-all', { method: 'POST', body: '{}', timeoutMs: 60000 });
      setHandlingUpdates(current => {
        const next = { ...current };
        for (const thread of currentThreads.current) {
          const previous = current[thread.uuid];
          const handling = previous && (!thread.sales_ai || previous.version >= thread.sales_ai.version) ? previous : thread.sales_ai;
          if (['human', 'waiting_owner'].includes(handling?.mode)) next[thread.uuid] = { ...handling, mode: 'ai', version: handling.version + 1 };
        }
        return next;
      });
      setBulkNotice(result.updated_count ? `${result.updated_count} conversation${result.updated_count === 1 ? '' : 's'} handed over to AI.` : 'All conversations already use AI.');
    } catch (error) { setBulkError(error.message); }
    finally { bulkWorking.current = false; setBulkBusy(false); }
  }
  return <><ChatInboxHeader onNavigate={onNavigate} onHandoverAll={canShop(session, 'ecommerce_process') && config.data?.sales_ai_enabled ? handoverAll : undefined} busy={bulkBusy} /><ShopLoadState resource={config}>{config.data?.enabled ? <section className="shop-chat-inbox">
    
    {bulkNotice && <p className="shop-chat-feedback" role="status">{bulkNotice}</p>}{bulkError && <ShopErrorNotice title="Action failed" message={bulkError} />}
    <div className="shop-chat-inbox-controls"><SearchInput className="mobile-search product-search" type="search" aria-label="Search chats" value={search} placeholder="Customer name or phone" onChange={event => setSearch(event.target.value)} onClear={() => { setSearch(''); setQuery(''); }} clearLabel="Clear chat search" /><MobileFilterToggle open={filtersOpen} onToggle={() => { setDraftFilter(filter); setFiltersOpen(true); }} controls="shop-chat-filters" count={Number(filter !== 'all')} /></div>
    <MobileFilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} id="shop-chat-filters" className="shop-mobile-filters" onSubmit={event => { event.preventDefault(); setFilter(draftFilter); setFiltersOpen(false); }}><ShopField name="conversation-filter" label="Conversation filter"><Select value={draftFilter} onChange={event => setDraftFilter(event.target.value)}><option value="all">All</option><option value="unread">Unread</option></Select></ShopField><MobileFilterActions onClear={() => { setDraftFilter('all'); setFilter('all'); }} /></MobileFilterPanel>
    <div className="shop-chat-list-heading"><h2>Conversations</h2>{list.total !== null && <span>{list.total.toLocaleString()}</span>}</div>
    <div className="shop-mobile-list">{list.initialLoading && <ShopLoading label="Loading conversations…" variant="contacts" />}{list.error && !list.items.length && <ShopErrorNotice title="Unable to load conversations" message={list.error} retryLabel="Retry chats" onRetry={list.retry} />}{!list.initialLoading && !list.error && !list.items.length && <div className="shop-chat-empty"><MessageCircle size={30} aria-hidden="true" /><p>No conversations found.</p></div>}
      {list.items.map(item => {
        const updated = handlingUpdates[item.uuid];
        const thread = updated && (!item.sales_ai || updated.version >= item.sales_ai.version) ? { ...item, sales_ai: updated } : item;
        return <Button variant="plain" aria-describedby={thread.sales_ai?.mode === 'waiting_owner' ? `needs-human-${thread.uuid}` : undefined} className={`shop-chat-thread${thread.unread > 0 ? ' has-unread' : ''}`} type="button" key={thread.uuid} onClick={() => onNavigate(`/shop/chat/${thread.uuid}`)}>
        <span className="shop-chat-avatar" aria-hidden="true"><ProfileAvatar url={thread.avatar_url}>{chatInitials(thread.customer_name) || <UserRound size={22} />}</ProfileAvatar>{thread.sales_ai_channel !== 'telegram' && thread.customer_active && <i />}</span>
        <span className="shop-chat-thread-copy"><strong>{thread.customer_name || 'Customer conversation'}</strong><ChatPresence thread={thread} timezone={session?.business?.timezone} /><span>{thread.last_message?.body || (thread.last_message?.image ? 'Image' : thread.last_message?.product ? `Product: ${thread.last_message.product.name}` : 'No messages yet')}</span>{thread.sales_ai?.mode === 'waiting_owner' && <small id={`needs-human-${thread.uuid}`} className="shop-chat-needs-human">Needs human</small>}</span>
        <span className="shop-chat-thread-end">{thread.sales_ai_channel === 'telegram' && thread.last_message?.sender === 'owner' && <TelegramReceipt message={thread.last_message} compact />}{thread.last_message?.created_at && <time dateTime={chatIso(thread.last_message.created_at)} title={shopDate(thread.last_message.created_at, session?.business?.timezone)}>{chatTime(thread.last_message.created_at, session?.business?.timezone)}</time>}{thread.unread > 0 && <span className="shop-chat-unread">{thread.unread} unread</span>}<ChevronRight size={17} aria-hidden="true" /></span>
      </Button>; })}<EndlessListFooter list={list} count={list.items.length} noun="conversations" />
    </div>
  </section> : <p>Chat is currently unavailable.</p>}</ShopLoadState></>;
}

function ChatProductPicker({ uuid, onSelect, onClose }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [selected, setSelected] = useState(null);
  const scope = useRef(''), cursors = useRef(new Map([[0, 0]]));
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  if (scope.current !== query) { scope.current = query; cursors.current = new Map([[0, 0]]); }
  const list = useEndlessList({ queryKey: query, loadPage: async ({ offset, signal }) => {
    const result = await apiRequest(`/shop-admin/chat/${uuid}/products?q=${encodeURIComponent(query)}&after_id=${cursors.current.get(offset) || 0}`, { signal });
    cursors.current.set(offset + result.items.length, result.next_cursor);
    return { items: result.items, ...(result.next_cursor ? {} : { total: offset + result.items.length }) };
  } });
  const canAttach = selected && search.trim() === query && !list.initialLoading && list.items.some(item => item.id === selected.id);
  return <MobileSheet open title="Choose product" onClose={onClose} className="shop-chat-product-picker" footer={
    <div className="shop-chat-picker-actions">
      <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="button" disabled={!canAttach} onClick={() => onSelect(selected)}>Attach product</Button>
    </div>
  }>
    <div className="shop-chat-picker-search"><SearchInput aria-label="Search chat products" placeholder="Search products" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} onClear={() => { setSearch(''); setQuery(''); }} /></div>
    <div className="shop-mobile-list shop-chat-picker-list">
      {list.items.map(product => <Button variant="plain" type="button" className={`shop-chat-picker-product${selected?.id === product.id ? ' is-selected' : ''}`} aria-pressed={selected?.id === product.id} key={product.id} disabled={search.trim() !== query || list.initialLoading} onClick={() => setSelected(product)}>
        <ChatProductImage product={product} />
        <span className="shop-chat-picker-copy"><strong>{product.name}</strong><small>{shopMoney(product.price, product.currency)} / {product.unit_name}</small></span>
        <span className="shop-chat-picker-selection" aria-hidden="true" />
      </Button>)}
      {list.initialLoading && <ShopLoading label="Loading products…" variant="list" />}
      {list.error && !list.items.length && <ShopErrorNotice message={list.error} retryLabel="Retry products" onRetry={list.retry} />}
      {!list.initialLoading && !list.error && !list.items.length && <div className="shop-chat-picker-state"><Package size={28} aria-hidden="true" /><p>No published products found.</p></div>}
      <EndlessListFooter list={list} count={list.items.length} noun="products" />
    </div>
  </MobileSheet>;
}

export function ShopConversation({ uuid, onNavigate, session }) {
  const config = useShopResource('/shop-admin/chat/config');
  const [handoffBusy, setHandoffBusy] = useState(false), handingOff = useRef(false);
  const [state, setState] = useState({ items: [], thread: null, loading: true, older: false, historyBusy: false, error: '' });
  const [body, setBody] = useState(''), [file, setFile] = useState(null), [preview, setPreview] = useState(''), [product, setProduct] = useState(null), [picker, setPicker] = useState(false), [busy, setBusy] = useState(false), [sendError, setSendError] = useState(''), [status, setStatus] = useState('Refreshing messages'), [typing, setTyping] = useState(false);
  const active = useContext(PageActivityContext), visible = useRef(active); visible.current = active;
  const rows = useRef([]), viewport = useRef(null), sentinel = useRef(null), pinned = useRef(true), reading = useRef(false), sending = useRef(false), pending = useRef(null), mounted = useRef(false), oldest = useRef(false), lastRead = useRef(0), readBusy = useRef(false), retryAt = useRef(0), anchor = useRef(null), connection = useRef(null), typingTimer = useRef(null), peerTimer = useRef(null), retryOlder = useRef(false);
  const [retrying, setRetrying] = useState(null);
  const retryWorking = useRef(false);
  const path = `/shop-admin/chat/${uuid}`;
  const editor = useRef(null);
  useLayoutEffect(() => {
    const resize = () => {
      const input = editor.current;
      if (!input || !active) return;
      input.style.height = '0px';
      input.style.height = `${Math.min(120, Math.max(44, input.scrollHeight + 2))}px`;
      if (pinned.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [body, active, config.data?.enabled]);
  const markRead = useCallback(async () => {
    const id = rows.current.at(-1)?.id;
    if (!id || !visible.current || document.hidden || !pinned.current || readBusy.current || lastRead.current >= id) return;
    readBusy.current = true;
    try { await apiRequest(`${path}/read`, { method: 'POST', body: JSON.stringify({ message_id: id }) }); lastRead.current = id; window.dispatchEvent(new Event('mkpos:shop-chat-read')); }
    catch { /* Retry during the next message refresh. */ } finally { readBusy.current = false; }
  }, [path]);
  const merge = useCallback(items => {
    const map = new Map(rows.current.map(item => [item.id,item]));
    items.forEach(item=>{
      const previous=map.get(item.id);
      map.set(item.id,{...previous,...item,...(previous?.telegram_delivery?.status==='sent'?{telegram_delivery:previous.telegram_delivery}:{})});
    });
    rows.current = [...map.values()].sort((a,b)=>a.id-b.id);
    setState(current => ({ ...current, items: rows.current }));
  }, []);
  const queued = useRef(false), queuedTimer = useRef(null);
  const newerPending = useRef(false), live = useRef(false), poll = useRef(createPollPolicy());
  const load = useCallback(async (older = false, manual = false) => {
    if (reading.current) { if (!older) queued.current = true; return; }
    if ((!manual && !poll.current.ready()) || reading.current || !mounted.current || !visible.current || document.hidden || Date.now() < retryAt.current) return;
    reading.current = true; retryOlder.current = older;
    if (older) setState(current => ({ ...current, historyBusy: true }));
    try {
      const id = older ? rows.current[0]?.id : rows.current.at(-1)?.id;
      const deliveryIds = rows.current.filter(message=>message.telegram_delivery && message.telegram_delivery.status !== 'sent').slice(0,50).map(message=>message.id);
      const query = id ? `?${older ? 'before_id' : 'after_id'}=${id}` : '';
      const response = await apiRequest(`${path}/messages${query}${deliveryIds.length ? `${query ? '&' : '?'}delivery_ids=${deliveryIds.join(',')}` : ''}`);
      if (!mounted.current) return;
      poll.current.success();
      if (older && viewport.current) anchor.current = { top: viewport.current.scrollTop, height: viewport.current.scrollHeight };
      if (older || !id) oldest.current = response.has_more;
      merge([...response.items,...(response.delivery_updates || [])]);
      if (!older) newerPending.current = Boolean(id && response.has_more);
      setState(current => ({ ...current, thread: response.thread, older: oldest.current, loading: false, error: '', historyBusy: false }));
      if (!older) void markRead();
    } catch (e) { poll.current.failure(e); if (e.status === 429) retryAt.current = Date.now() + (e.retryAfterMs || 60000); if (mounted.current) setState(current => ({ ...current, loading: false, historyBusy: false, error: e.message })); }
    finally {
      reading.current = false;
      if (queued.current && mounted.current) {
        queued.current = false; newerPending.current = true;
        clearTimeout(queuedTimer.current);
        queuedTimer.current = setTimeout(() => loadRef.current(), 1000);
      }
    }
  }, [path, merge, markRead]);
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => {
    if (!config.data?.enabled) return;
    mounted.current = true; void load();
    const timer = setInterval(() => { if (newerPending.current || poll.current.due(live.current)) void loadRef.current(); }, 15000);
    const resume = () => { if (!document.hidden) void loadRef.current(); };
    document.addEventListener('visibilitychange', resume);
    return () => { mounted.current = false; clearTimeout(queuedTimer.current); clearInterval(timer); clearTimeout(typingTimer.current); clearTimeout(peerTimer.current); document.removeEventListener('visibilitychange', resume); };
  }, [load, config.data?.enabled]);
  usePageRefresh(() => load());
  useEffect(() => {
    if (!config.data?.enabled) return;
    const socket = connectMobileShopChat(config.data, `private-shop.chat.thread.${uuid}`, {
      visible: () => visible.current, listenWhileHidden: true, change: () => { newerPending.current = true; return loadRef.current(); }, status: value => { live.current = value === 'Live'; setStatus(value); },
      typing: value => { clearTimeout(peerTimer.current); setTyping(value); if (value) peerTimer.current = setTimeout(() => setTyping(false), 6000); },
    });
    connection.current = socket;
    return () => { socket.close(); connection.current = null; };
  }, [config.data, uuid]);
  useLayoutEffect(() => {
    const node = viewport.current; if (!node || !visible.current) return;
    if (anchor.current) { node.scrollTop = anchor.current.top + node.scrollHeight - anchor.current.height; anchor.current = null; }
    else if (pinned.current) node.scrollTop = node.scrollHeight;
  }, [state.items, config.data?.enabled, state.thread?.sales_ai?.responding, state.thread?.sales_ai?.mode]);
  useEffect(() => {
    if (!state.older || state.loading || state.historyBusy || state.error || typeof IntersectionObserver === 'undefined' || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => { if (visible.current && entries.some(entry => entry.isIntersecting)) void load(true); }, { root: viewport.current, rootMargin: '80px 0px 0px 0px' });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [load, state.older, state.loading, state.historyBusy, state.error, config.data?.enabled]);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function send(event) {
    event.preventDefault(); if (sending.current || (!body.trim() && !file && !product) || !canShop(session, 'ecommerce_process')) return;
    sending.current = true; setBusy(true); setSendError(''); connection.current?.typing(false);
    const text = body.trim();
    if (!pending.current || pending.current.body !== text || pending.current.file !== file || pending.current.productId !== product?.id) pending.current = { client_id: crypto.randomUUID(), body: text, file, productId: product?.id };
    try {
      let payload;
      if (file) { payload = new FormData(); payload.append('client_id', pending.current.client_id); payload.append('body', text); payload.append('image', file); if (product) payload.append('product_id', product.id); }
      else payload = JSON.stringify({ client_id: pending.current.client_id, body: text, ...(product ? { product_id: product.id } : {}) });
      const response = await apiRequest(`${path}/messages`, { method: 'POST', body: payload, timeoutMs: file ? 60000 : 15000 });
      if (response.thread?.sales_ai) window.dispatchEvent(new CustomEvent('mkpos:shop-chat-handling', { detail: { ...response.thread, uuid } }));
      if (mounted.current) { setState(current => ({ ...current, thread: response.thread || current.thread })); pinned.current = true; merge([response.message]); setBody(''); setFile(null); setProduct(null); pending.current = null; }
    } catch (e) { if (mounted.current) setSendError(e.message); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  async function retryTelegram(id) {
    if (retryWorking.current) return;
    retryWorking.current=true; setRetrying(id); setSendError('');
    try {
      const response=await apiRequest(`${path}/messages/${id}/retry-telegram`,{method:'POST',body:'{}'});
      if (mounted.current) merge([response.message]);
    } catch (error) { if (mounted.current) setSendError(error.message); }
    finally { retryWorking.current=false; if (mounted.current) setRetrying(null); }
  }
  const ProfileTag = state.thread?.customer_key ? 'button' : 'div';
  async function handoff() {
    if (handingOff.current || busy || !canShop(session, 'ecommerce_process') || !state.thread?.sales_ai?.enabled) return;
    handingOff.current = true; setHandoffBusy(true); setSendError('');
    try {
      const response = await apiRequest(`${path}/handoff`, { method: 'POST', body: JSON.stringify({ mode: state.thread.sales_ai.mode === 'ai' ? 'human' : 'ai', version: state.thread.sales_ai.version }) });
      if (response.thread?.sales_ai) window.dispatchEvent(new CustomEvent('mkpos:shop-chat-handling', { detail: { ...response.thread, uuid } }));
      if (mounted.current) setState(current => ({ ...current, thread: response.thread }));
    } catch (e) { if (mounted.current) setSendError(e.message); }
    finally { handingOff.current = false; if (mounted.current) setHandoffBusy(false); }
  }
  return <ShopLoadState resource={config}>{config.data?.enabled ? <section className="shop-mobile-conversation" data-disable-swipe-refresh>
    <PageAppBar className="shop-chat-conversation-header"><IconButton variant="ghost" type="button" className="shop-chat-back" aria-label="Back" title="Back" onClick={() => onNavigate('/shop/chat', { back: true })}><ArrowLeft size={22} aria-hidden="true" /></IconButton><ProfileTag type={state.thread?.customer_key ? 'button' : undefined} className="shop-chat-header-profile" aria-label={state.thread?.customer_key ? 'View customer' : undefined} onClick={state.thread?.customer_key ? () => onNavigate(`/shop/customers/${encodeURIComponent(state.thread.customer_key)}`) : undefined}><span className="shop-chat-avatar" aria-hidden="true"><ProfileAvatar url={state.thread?.avatar_url}>{chatInitials(state.thread?.customer_name) || <UserRound size={23} />}</ProfileAvatar>{state.thread?.sales_ai_channel !== 'telegram' && state.thread?.customer_active && <i />}</span><span className="shop-chat-header-copy"><span className="shop-chat-header-name" title={state.thread?.customer_name} role="heading" aria-level={1}>{state.thread?.customer_name || 'Customer conversation'}</span><ChatPresence thread={state.thread} timezone={session?.business?.timezone} /><span className="shop-chat-connection">{status}</span></span></ProfileTag>{state.thread?.sales_ai?.enabled && (canShop(session, 'ecommerce_process') ? <label className="shop-chat-ai-toggle" title={state.thread.sales_ai.mode === 'ai' ? 'Take over' : 'Return to AI'}><span>AI</span><Switch aria-label="AI replies" checked={state.thread.sales_ai.mode === 'ai'} disabled={handoffBusy || busy} aria-busy={handoffBusy} onChange={handoff} /></label> : <small className="shop-chat-ai-mode" role="status">{state.thread.sales_ai.mode === 'ai' ? 'AI replies' : state.thread.sales_ai.mode === 'waiting_owner' ? 'Waiting for a person' : 'Human replies'}</small>)}<AppBarMenu showAssistant={false} showChat={false} /></PageAppBar>
    <div className="shop-mobile-messages" aria-label="Conversation messages" ref={viewport} onScroll={() => { const node = viewport.current; pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60; void markRead(); }}>
      <div ref={sentinel} />{state.older && <Button variant="secondary" type="button" className="mobile-secondary shop-chat-older" disabled={state.historyBusy} onClick={() => load(true)}>{state.historyBusy ? <ShopBusy label="Loading older messages…" /> : 'Load older messages'}</Button>}
      {state.loading && <ShopLoading label="Loading messages…" variant="inline" />}{!state.loading && !state.error && !state.items.length && <div className="shop-chat-empty"><MessageCircle size={28} aria-hidden="true" /><p>No messages yet.</p></div>}
      {state.items.map((message, index) => <React.Fragment key={message.id}>{(index === 0 || chatDay(state.items[index - 1].created_at, session?.business?.timezone) !== chatDay(message.created_at, session?.business?.timezone)) && <div className="shop-chat-day">{chatDay(message.created_at, session?.business?.timezone)}</div>}<article className={`shop-mobile-message${message.sender === 'owner' ? ' is-mine' : ''}`} key={message.id}><small className="shop-chat-sender">{message.is_ai ? `${message.ai_name || 'Sales assistant'} (AI)` : message.sender === 'owner' ? 'You' : 'Customer'}</small>{message.product && <div className="shop-chat-shared-product"><SharedProduct product={message.product} /></div>}{message.image && (message.image.status === 'expired' || imageExpiresAt(message.image.expires_at) <= Date.now() ? <div className="shop-chat-expired-image"><ImageOff size={26} aria-hidden="true" /><p>Image expired. Images are deleted after 14 days.</p></div> : <ShopPrivateImage path={`${path}/messages/${message.id}/image`} label="Chat image" />)}{message.body && <p>{message.body}</p>}<small className="shop-chat-message-meta"><time dateTime={chatIso(message.created_at)} title={shopDate(message.created_at, session?.business?.timezone)}>{chatTime(message.created_at, session?.business?.timezone)}</time>{message.sender === 'owner' && (state.thread?.sales_ai_channel === 'telegram' ? <TelegramReceipt message={message} onRetry={canShop(session, 'ecommerce_process') ? () => retryTelegram(message.id) : undefined} disabled={retrying !== null || busy} /> : ` · ${state.thread?.customer_read_id >= message.id ? 'Seen' : 'Sent'}`)}</small></article></React.Fragment>)}
    </div>
    {state.thread?.sales_ai?.enabled && state.thread.sales_ai.mode === 'ai' && state.thread.sales_ai.responding && <div className="shop-chat-ai-thinking" role="status" aria-label="AI is preparing a reply"><Bot size={18} aria-hidden="true" /><span><strong>{state.thread.sales_ai.name || 'Sales assistant'} · AI</strong><small>Preparing a reply…</small></span><span className="shop-chat-ai-dots" aria-hidden="true"><i /><i /><i /></span></div>}
    {state.error && <ShopErrorNotice title="Unable to load messages" message={state.error} retryLabel="Retry messages" onRetry={() => load(retryOlder.current, true)} />}{state.thread?.sales_ai_channel !== 'telegram' && typing && <p className="shop-chat-feedback" role="status">Customer is typing…</p>}{sendError && <ShopErrorNotice title={pending.current ? 'Message not sent' : 'Action failed'} message={sendError} retryLabel="Retry send" disabled={busy} onRetry={pending.current ? send : undefined} />}
    {canShop(session, 'ecommerce_process') && <form className="shop-mobile-form shop-mobile-composer" onSubmit={send}>

      {preview && <div className="shop-chat-attachment-preview"><img src={preview} alt="Selected chat image" /><Button variant="plain" type="button" disabled={busy} onClick={() => setFile(null)}><X size={15} aria-hidden="true" />Remove image</Button></div>}
      {product && <div className="shop-chat-product-preview"><Package size={19} aria-hidden="true" /><div><strong>{product.name}</strong><small>{shopMoney(product.price, product.currency)} / {product.unit_name}</small></div><IconButton variant="ghost" type="button" disabled={busy} onClick={() => setProduct(null)} aria-label="Remove product"><X size={17} aria-hidden="true" /></IconButton></div>}
      <div className="shop-chat-compose-row"><div className="shop-chat-composer-tools"><IconButton variant="secondary" type="button" aria-label="Share product" title="Share product" disabled={busy} onClick={() => setPicker(true)}><Package size={17} aria-hidden="true" /><span className="sr-only">Share product</span></IconButton><label className="shop-chat-attach" title="Attach image"><ImagePlus size={19} aria-hidden="true" /><span className="sr-only">Attach image</span><Input type="file" aria-label="Attach chat image" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) || selected.size > 2 * 1024 * 1024) { setSendError('Choose a PNG, JPG or WebP image up to 2 MB.'); return; } setSendError(''); setFile(selected); }} /></label></div><label className="sr-only" htmlFor={`message-${uuid}`}>Message</label><Textarea ref={editor} className="shop-chat-message-input" rows={1} id={`message-${uuid}`} maxLength={2000} disabled={busy} placeholder="Write a message" value={body} onChange={event => { setBody(event.target.value); clearTimeout(typingTimer.current); connection.current?.typing(!!event.target.value.trim()); typingTimer.current = setTimeout(() => connection.current?.typing(false), 3000); }} /><IconButton variant="primary" type="submit" className="mobile-primary shop-chat-send" disabled={busy || (!body.trim() && !file && !product)}>{busy ? <ShopBusy label="Sending…" /> : <><Send size={19} aria-hidden="true" /><span className="sr-only">Send</span></>}</IconButton></div>
    </form>}
    {picker && <ChatProductPicker uuid={uuid} onClose={() => setPicker(false)} onSelect={selected => { setProduct(selected); setPicker(false); }} />}
  </section> : <p>Chat is currently unavailable.</p>}</ShopLoadState>;
}

function ChatInboxHeader({ onNavigate, onHandoverAll, busy = false }) {
  return <PageAppBar className="shop-chat-inbox-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back to My Shop" onClick={() => onNavigate('/shop')}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>Chat</h1>{onHandoverAll && <IconButton variant="ghost" type="button" aria-label="Hand over all to AI" title="Hand over all to AI" disabled={busy} aria-busy={busy} onClick={onHandoverAll}>{busy ? <LoaderCircle size={20} className="shop-chat-bulk-spinner" aria-hidden="true" /> : <span className="shop-chat-bulk-icon" aria-hidden="true"><Bot size={20} /><ArrowRightLeft size={12} /></span>}</IconButton>}<AppBarMenu showAssistant={false} showChat={false} /></PageAppBar>;
}

function chatIso(value) {
  const timestamp = imageExpiresAt(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function chatTime(value, timezone = 'Asia/Rangoon') {
  const date = new Date(imageExpiresAt(value));
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
}

function ChatProductImage({ product }) {
 return <span className="shop-chat-product-image"><Package size={24} aria-hidden="true" />{product.photo_url && <img src={product.photo_url} alt={product.name} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}</span>;
}

function chatDay(value, timezone = 'Asia/Rangoon') {
 const date = new Date(imageExpiresAt(value));
 return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { timeZone: timezone, dateStyle: 'medium' });
}
