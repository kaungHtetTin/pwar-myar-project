import { createPortal } from 'react-dom';
import { createPollPolicy } from './backgroundPolicy';
import { shopDate, chatTimestamp } from './dateTime';
import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useContext } from 'react';
import { usePageReady } from './pageLoading';
import { LocaleContext, useText } from './i18n';
import { Send, Check, CheckCheck, PackagePlus, Store, Headset, EllipsisVertical } from 'lucide-react';
import { ChatProductCard, ChatProductPicker, ChatProductPreview } from './ShopChatProducts';
import { ShopChatImage, ChatImagePicker, ChatImagePreview } from './ShopChatImages';
import { connectShopChat } from './chatRealtime';
import { ChatMessageInput } from './ChatMessageInput';
import { SalesActionCard } from './SalesActionCard';
import { SalesReadout } from './SalesReadout';

export function ShopChatConversation({ uuid, apiRequest, basePath, authPath, config, selfSender, canSend = true, onRead, onPresence, onLastSeen, onViewProduct, shopAvatar, headerStatusHost, headerActionsHost }) {
  const text = useText();
  const language = useContext(LocaleContext) === 'my' ? 'my' : 'en';
  const [messages, setMessages] = useState([]);
  const [recipientRead, setRecipientRead] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Yangon');
  const [salesAI, setSalesAI] = useState(null), [handoffBusy, setHandoffBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [telegramLink, setTelegramLink] = useState(null), [linkBusy, setLinkBusy] = useState(false), [linkError, setLinkError] = useState('');
  const linking = useRef(false);
  const actionCache = useRef({ uuid, entries: new Map() });
  if (actionCache.current.uuid !== uuid) actionCache.current = { uuid, entries: new Map() };
  const handingOff = useRef(false);
  const [body, setBody] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const typingConnection = useRef(null), typingIdle = useRef(null);
  const stopTyping = () => { clearTimeout(typingIdle.current); typingConnection.current?.typing?.(false); };
  const changeBody = event => {
    setBody(event.target.value); clearTimeout(typingIdle.current);
    typingConnection.current?.typing?.(Boolean(event.target.value.trim()));
    typingIdle.current = setTimeout(() => typingConnection.current?.typing?.(false), 3000);
  };
  const [attachment, setAttachment] = useState(null);
  const [product, setProduct] = useState(null), [productPicker, setProductPicker] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [older, setOlder] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [connection, setConnection] = useState('Connecting…');
  const rows = useRef([]), active = useRef(false), reading = useRef(false), sending = useRef(false), pending = useRef(null), viewport = useRef(null), pinned = useRef(true);
  const onReadRef = useRef(onRead); onReadRef.current = onRead;
  const retryAfter = useRef(0);
  const onLastSeenRef = useRef(onLastSeen); onLastSeenRef.current = onLastSeen;
  const onPresenceRef = useRef(onPresence); onPresenceRef.current = onPresence;
  const markRead = useCallback(() => {
    const latest = rows.current.at(-1)?.id;
    if (latest && !document.hidden && pinned.current && !viewport.current?.closest('[hidden]')) onReadRef.current?.(latest);
  }, []);
  const queued = useRef(false), queuedTimer = useRef(null), loadLatest = useRef(null);
  const newerPending = useRef(false), live = useRef(false), poll = useRef(createPollPolicy());
  const path = `${basePath}/${uuid}/messages`;
  const merge = useCallback((items, animate = true) => {
    const map = new Map(rows.current.map((message) => [message.id, message]));
    items.forEach((message) => map.set(message.id, { ...message, animateEntry: map.get(message.id)?.animateEntry ?? animate }));
    rows.current = [...map.values()].sort((a, b) => a.id - b.id);
    setMessages(rows.current);
  }, []);
  const load = useCallback(async (previous = false, manual = false) => {
    if (reading.current) { if (!previous) queued.current = true; return; }
    if ((!manual && !poll.current.ready({ allowHidden: rows.current.length === 0 })) || !active.current || reading.current || viewport.current?.closest('[data-retained-view][hidden]') || Date.now() < retryAfter.current) return;
    reading.current = true;
    if (previous) setHistoryBusy(true);
    try {
      const last = rows.current.at(-1)?.id, first = rows.current[0]?.id;
      const query = previous && first ? `?before_id=${first}` : last ? `?after_id=${last}` : '';
      const result = await apiRequest(`${path}${query}`);
      if (!active.current) return;
      poll.current.success();
      setTimezone(result.thread?.timezone || 'Asia/Yangon');
      setSalesAI(result.thread?.sales_ai || null);
      setRecipientRead(Number(result.thread?.[selfSender === 'owner' ? 'customer_read_id' : 'owner_read_id']) || 0);
      onLastSeenRef.current?.(result.thread?.[selfSender === 'owner' ? 'customer_last_seen_at' : 'owner_last_seen_at'] || null);
      onPresenceRef.current?.({ customer_active: result.thread?.customer_active, owner_active: result.thread?.owner_active });
      merge(result.items, !previous && Boolean(last));
      if (!previous) newerPending.current = Boolean(last && result.has_more);
      if (previous || !last) setOlder(result.has_more);
      if (!previous) markRead();
      setError('');
    } catch (failure) { poll.current.failure(failure); if (active.current) { if (failure.status === 429) retryAfter.current = Date.now() + (failure.retryAfterMs || 60000); setError(failure.message); onPresenceRef.current?.(null); } }
    finally {
      reading.current = false;
      if (active.current) {
        setLoading(false); setHistoryBusy(false);
        if (queued.current) {
          queued.current = false; newerPending.current = true;
          clearTimeout(queuedTimer.current);
          queuedTimer.current = setTimeout(() => loadLatest.current?.(), 1000);
        }
      }
    }
  }, [apiRequest, path, merge, markRead, selfSender]);
  loadLatest.current = load;
  const actionResult = useCallback(() => { newerPending.current = true; void loadLatest.current?.(false, true); }, []);
  useEffect(() => {
    active.current = true; rows.current = []; setMessages([]); setLoading(true);
    load();
    const timer = setInterval(() => { if (newerPending.current || poll.current.due(live.current)) load(); }, 15000);
    document.addEventListener('visibilitychange', markRead);
    return () => { active.current = false; clearTimeout(queuedTimer.current); clearInterval(timer); document.removeEventListener('visibilitychange', markRead); };
  }, [load, markRead]);
  useEffect(() => {
    const stop = connectShopChat(config, `private-shop.chat.thread.${uuid}`,
    (data) => apiRequest(authPath, { method: 'POST', body: JSON.stringify(data) }), () => { newerPending.current = true; return load(); }, status => { live.current = status === 'Live'; setConnection(status); }, (status) => { if (status === null) onPresenceRef.current?.(null); else load(); }, () => Boolean(viewport.current && !viewport.current.closest('[hidden]')), () => {}, data => { if (!data) setPeerTyping(false); else if (data.sender !== selfSender) setPeerTyping(data.typing); });
    typingConnection.current = stop;
    return () => { clearTimeout(typingIdle.current); stop(); typingConnection.current = null; };
  }, [config, uuid, apiRequest, authPath, load, selfSender]);
  const latestId = messages.at(-1)?.id;
  const pageReady = usePageReady();
  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    // Keep the latest message visible as the keyboard/composer changes height,
    // without moving a reader who has scrolled into older history.
    const observer = new ResizeObserver(() => {
      if (pinned.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (pageReady && pinned.current && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
      markRead();
    }
  }, [latestId, pageReady, markRead, salesAI?.responding]);
  async function send(event) {
    event.preventDefault();
    stopTyping();
    if (sending.current || actionBusy || (!body.trim() && !attachment && !product)) return;
    sending.current = true; setBusy(true); setError('');
    const text = body.trim();
    if (pending.current?.body !== text || pending.current?.image !== attachment || pending.current?.product_id !== (product?.id || null)) pending.current = { client_id: crypto.randomUUID(), body: text, image: attachment, product_id: product?.id || null };
    try {
      let payload;
      if (attachment) {
        payload = new FormData();
        payload.append('client_id', pending.current.client_id); payload.append('body', text); payload.append('image', attachment); payload.append('language', language);
        if (product) payload.append('product_id', product.id);
      } else payload = JSON.stringify({ client_id: pending.current.client_id, body: text, language, ...(product ? { product_id: product.id } : {}) });
      const result = await apiRequest(path, { method: 'POST', body: payload, ...(attachment ? { timeoutMs: 60000 } : {}) });
      if (active.current) {
        setTimezone(previous => result.thread?.timezone || previous);
        setSalesAI(result.thread?.sales_ai || null);
      }
      if (active.current) { merge([result.message]); setBody(''); setAttachment(null); setProduct(null); pending.current = null; }
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { sending.current = false; if (active.current) setBusy(false); }
  }
  async function handoff() {
    if (handingOff.current) return;
    handingOff.current = true; setHandoffBusy(true); setError('');
    try {
      const result = await apiRequest(`${basePath}/${uuid}/handoff`, { method: 'POST', body: JSON.stringify(selfSender === 'owner' ? { mode: salesAI.mode === 'ai' ? 'human' : 'ai', version: salesAI.version } : {}) });
      if (active.current) {
        setTimezone(previous => result.thread?.timezone || previous);
        setSalesAI(result.thread?.sales_ai || null);
      }
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { handingOff.current = false; if (active.current) setHandoffBusy(false); }
  }
  async function linkTelegram() {
    if (linking.current) return;
    linking.current = true; setLinkBusy(true); setLinkError(''); setTelegramLink(null);
    try {
      const result = await apiRequest(`${basePath}/${uuid}/telegram-link`, { method: 'POST', body: '{}' });
      if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=link_[A-Za-z0-9]{40}$/.test(result.url)) throw new Error(text('Telegram link is unavailable. Please try again.'));
      setTelegramLink({ url: result.url, expiresAt: Date.now() + 600000 });
    } catch (failure) { setLinkError(failure.message); }
    finally { linking.current = false; setLinkBusy(false); }
  }
  const handoffButton = salesAI?.enabled && canSend && (selfSender === 'owner' || salesAI.mode === 'ai') && <button type="button" className={headerActionsHost ? 'conversation-menu-item' : undefined} disabled={handoffBusy || busy || actionBusy} onClick={async event => { const menu = event.currentTarget.closest('details'); await handoff(); if (menu) menu.open = false; }}>{headerActionsHost && <Headset size={18} aria-hidden="true" />}<span>{text(selfSender === 'owner' ? salesAI.mode === 'ai' ? 'Take over' : 'Return to AI' : 'Talk to a person')}</span></button>;
  const aiStatus = salesAI?.enabled && <div className="shop-chat-ai-status"><span role="status">{salesAI.mode === 'ai' ? `${salesAI.name} · AI${salesAI.responding ? ` ${text('· Preparing a reply…')}` : ''}` : text(salesAI.mode === 'waiting_owner' ? 'Waiting for a person' : 'Handled by a person')}</span>{handoffButton}</div>;
  const telegramActions = selfSender === 'customer' && salesAI?.telegram_bot && <>
    {!telegramLink && <button type="button" className="conversation-menu-item" disabled={linkBusy} aria-busy={linkBusy} onClick={linkTelegram}><Send size={18} aria-hidden="true" /><span>{text(linkBusy ? 'Preparing Telegram link…' : 'Link my Telegram account')}</span></button>}
    {telegramLink && <a className="conversation-menu-item" href={telegramLink.url} target="_blank" rel="noopener noreferrer" onClick={event => {
      if (Date.now() >= telegramLink.expiresAt) { event.preventDefault(); setTelegramLink(null); setLinkError(text('Telegram link expired. Request a new link.')); }
      else { const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; }
    }}><Send size={18} aria-hidden="true" /><span>{text('Open Telegram to link · expires in 10 minutes')}</span></a>}
    {linkError && <p className="conversation-menu-error" role="alert">{linkError}</p>}
  </>;
  return <div className="shop-chat-conversation">
    {headerStatusHost ? createPortal(salesAI?.enabled && salesAI.mode === 'ai' ? <span className="conversation-ai-badge">{'\u00b7'} AI</span> : null, headerStatusHost) : aiStatus}
    {headerActionsHost && createPortal(<>{handoffButton}{telegramActions}</>, headerActionsHost)}
    {!headerActionsHost && telegramActions && <details className="conversation-menu conversation-menu-standalone"><summary aria-label={text('Conversation actions')}><EllipsisVertical size={24} aria-hidden="true" /></summary><div className="conversation-menu-popover">{telegramActions}</div></details>}
    <span className="shop-chat-connection" role="status">{text(connection)}</span>
    <div className="shop-chat-messages" aria-label={text("Conversation messages")} ref={viewport} onScroll={() => { const node = viewport.current; pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60; markRead(); }}>
      {historyBusy ? <div className="shop-chat-history-loading" role="status"><span>{text("Loading older messages…")}</span><div className="shop-chat-history-progress" role="progressbar" aria-label={text("Loading older messages…")}><span /></div></div> : older && <button type="button" onClick={() => load(true)}>{text("Load older messages")}</button>}
      {loading && <LoadingSkeleton variant="conversation" message="Loading messages…" />}
      {!loading && messages.length === 0 && <p>{text("No messages yet. Start the conversation.")}</p>}
      {messages.map((message) => <article className={`shop-chat-message${message.sender === selfSender ? ' is-mine' : ''}${message.is_ai ? ' is-ai' : ''}${message.animateEntry ? ' is-entering' : ''}`} key={message.id}>
        <span className="conversation-message-avatar" aria-hidden="true">{shopAvatar ? <img src={shopAvatar} alt="" /> : <Store size={20} />}</span><div className="conversation-bubble"><small>{message.is_ai ? `${message.ai_name || text('Sales assistant')} · AI` : text(message.action_event ? 'Form activity' : message.sender === selfSender ? 'You' : 'Shop')}</small>{message.product && <ChatProductCard product={message.product} href={`#/store/${encodeURIComponent(message.product.store_slug)}/products/${message.product.id}`} onOpen={onViewProduct} />}{message.image && <ShopChatImage message={message} path={`${basePath}/${uuid}/messages/${message.id}/image`} />}{message.body && <p>{message.body}</p>}<SalesReadout content={message.sales_content} onViewProduct={onViewProduct} />{message.sales_actions?.map(action => <SalesActionCard key={action.id} action={action} uuid={uuid} basePath={basePath} apiRequest={apiRequest} selfSender={selfSender} cache={actionCache.current.entries} onBusyChange={setActionBusy} onActionResult={actionResult} />)}</div><span className="shop-chat-message-meta"><time dateTime={shopDate(message.created_at)?.toISOString()} title={chatTimestamp(message.created_at, timezone, true)}>{chatTimestamp(message.created_at, timezone)}</time>{message.sender === selfSender && <span className="shop-chat-receipt" aria-label={text(recipientRead >= message.id ? 'Seen' : 'Sent')} title={text(recipientRead >= message.id ? 'Seen' : 'Sent')}>{recipientRead >= message.id ? <CheckCheck size={14} /> : <Check size={14} />}</span>}</span>
      </article>)}
      {salesAI?.enabled && salesAI.mode === 'ai' && salesAI.responding && <article className="shop-chat-message shop-chat-ai-typing is-entering" aria-label={text('AI is preparing a reply')} role="status"><span className="conversation-message-avatar" aria-hidden="true">{shopAvatar ? <img src={shopAvatar} alt="" /> : <Store size={20} />}</span><div className="conversation-bubble"><small>{salesAI.name || 'Sales assistant'} {'\u00b7'} AI</small><span className="chat-reply-dots" aria-hidden="true"><i /><i /><i /></span></div></article>}
    </div>
    {peerTyping && <div className="shop-chat-typing" role="status"><span aria-hidden="true"><i /><i /><i /></span>{selfSender === 'customer' ? 'Shop is typing...' : 'Customer is typing...'}</div>}
    {error && <p role="alert">{error} <button type="button" onClick={() => load(false, true)}>{text("Retry")}</button></p>}
    {canSend && attachment && <ChatImagePreview file={attachment} disabled={busy} onRemove={() => setAttachment(null)} />}
    {canSend && productPicker && <ChatProductPicker apiRequest={apiRequest} path={`${basePath}/${uuid}/products`} disabled={busy} onClose={() => setProductPicker(false)} onSelect={value => { setProduct(value); setProductPicker(false); }} />}
    {canSend && product && <ChatProductPreview product={product} disabled={busy} onRemove={() => setProduct(null)} />}
    {canSend && <form className="shop-chat-composer" onSubmit={send}><button type="button" className="shop-chat-attach" aria-label={text("Share product")} title={text("Share product")} aria-expanded={productPicker} disabled={busy} onClick={() => setProductPicker(value => !value)}><PackagePlus size={20} /></button><ChatImagePicker disabled={busy} onSelect={(file) => { if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { setError(text('Choose a JPG, PNG or WebP image up to 2 MB.')); return; } setError(''); setAttachment(file); }} /><ChatMessageInput onResize={() => { if (pinned.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }} aria-label={text("Message")} placeholder={text("Type a message...")} maxLength={2000} value={body} disabled={busy || actionBusy} onChange={changeBody} /><button type="submit" className="primary" aria-label={text(busy ? "Sending..." : "Send")} disabled={busy || actionBusy || (!body.trim() && !attachment && !product)}><Send size={16} /><span>{text(busy ? 'Sending…' : 'Send')}</span></button></form>}
  </div>;
}
