import { TelegramReceipt } from '../components/TelegramChatStatus';
import { createPortal } from 'react-dom';
import { createPollPolicy } from '../backgroundPolicy';
import { getBusinessTimezone } from '../timezone';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bot, Send, Check, CheckCheck, PackagePlus } from 'lucide-react';
import { ChatProductCard, ChatProductPicker, ChatProductPreview } from './ShopChatProducts';
import { chatDate } from '../shopChatPresentation';
import { ShopChatImage, ChatImagePicker, ChatImagePreview } from './ShopChatImages';
import { connectShopChat } from '../shopChatRealtime';
import { ChatMessageInput } from './ChatMessageInput';

export function ShopChatConversation({ uuid, channel, apiRequest, basePath, authPath, config, selfSender, canSend = true, onRead, onPresence, onLastSeen, headerActionsHost, handoverUpdate, onHandlingChange }) {
  const [messages, setMessages] = useState([]);
  const [telegram, setTelegram] = useState(channel === 'telegram');
  const [retrying, setRetrying] = useState(null);
  const retryWorking = useRef(false);
  const [recipientRead, setRecipientRead] = useState(0);
  const [salesAI, setSalesAI] = useState(null), [handoffBusy, setHandoffBusy] = useState(false);
  const handingOff = useRef(false);
  useEffect(() => {
    if (handoverUpdate?.uuid === uuid && handoverUpdate.sales_ai) setSalesAI(current => !current || handoverUpdate.sales_ai.version >= current.version ? handoverUpdate.sales_ai : current);
  }, [handoverUpdate, uuid]);
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
  const historySentinel = useRef(null), anchor = useRef(null), retryOlder = useRef(false), retryAfter = useRef(0);
  const onReadRef = useRef(onRead); onReadRef.current = onRead;
  const onLastSeenRef = useRef(onLastSeen); onLastSeenRef.current = onLastSeen;
  const onPresenceRef = useRef(onPresence); onPresenceRef.current = onPresence;
  const markRead = useCallback(() => {
    const latest = rows.current.at(-1)?.id;
    if (latest && !document.hidden && pinned.current && !viewport.current?.closest('[hidden]')) onReadRef.current?.(latest);
  }, []);
  const queued = useRef(false), queuedTimer = useRef(null), loadLatest = useRef(null);
  const newerPending = useRef(false), live = useRef(false), poll = useRef(createPollPolicy());
  const path = `${basePath}/${uuid}/messages`;
  const merge = useCallback((items) => {
    const map = new Map(rows.current.map((message) => [message.id, message]));
    items.forEach((message) => {
      const previous = map.get(message.id);
      map.set(message.id, { ...previous, ...message, ...(previous?.telegram_delivery?.status === 'sent' ? { telegram_delivery: previous.telegram_delivery } : {}) });
    });
    rows.current = [...map.values()].sort((a, b) => a.id - b.id);
    setMessages(rows.current);
  }, []);
  const load = useCallback(async (previous = false, manual = false) => {
    if (reading.current) { if (!previous) queued.current = true; return; }
    if ((!manual && !poll.current.ready({ allowHidden: rows.current.length === 0 })) || !active.current || reading.current || viewport.current?.closest('[hidden]') || Date.now() < retryAfter.current) return;
    reading.current = true;
    if (previous) setHistoryBusy(true);
    try {
      const last = rows.current.at(-1)?.id, first = rows.current[0]?.id;
      const query = previous && first ? `?before_id=${first}` : last ? `?after_id=${last}` : '';
      const deliveryIds = rows.current.filter(message => message.telegram_delivery && message.telegram_delivery.status !== 'sent').slice(0,50).map(message => message.id);
      const result = await apiRequest(`${path}${query}${deliveryIds.length ? `${query ? '&' : '?'}delivery_ids=${deliveryIds.join(',')}` : ''}`);
      if (!active.current) return;
      poll.current.success();
      setTelegram(result.thread?.sales_ai_channel === 'telegram' || channel === 'telegram');
      setSalesAI(result.thread?.sales_ai || null);
      if (previous && viewport.current) anchor.current = { height: viewport.current.scrollHeight, top: viewport.current.scrollTop };
      setRecipientRead(Number(result.thread?.[selfSender === 'owner' ? 'customer_read_id' : 'owner_read_id']) || 0);
      onLastSeenRef.current?.(result.thread?.[selfSender === 'owner' ? 'customer_last_seen_at' : 'owner_last_seen_at'] || null);
      onPresenceRef.current?.({ customer_active: result.thread?.customer_active, owner_active: result.thread?.owner_active, telegram_last_message_at: result.thread?.telegram_last_message_at });
      merge([...result.items, ...(result.delivery_updates || [])]);
      if (!previous) newerPending.current = Boolean(last && result.has_more);
      if (previous || !last) setOlder(result.has_more);
      if (!previous) markRead();
      setError('');
      retryOlder.current = false;
    } catch (failure) { poll.current.failure(failure); if (active.current) { if (failure.status === 429) retryAfter.current = Date.now() + (failure.retryAfterMs || 60000); retryOlder.current = previous; setError(failure.message); onPresenceRef.current?.(null); } }
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
  }, [apiRequest, path, merge, markRead, selfSender, channel]);
  loadLatest.current = load;
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
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    if (anchor.current) {
      node.scrollTop = anchor.current.top + node.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (pinned.current) node.scrollTop = node.scrollHeight;
  }, [messages, salesAI?.responding, salesAI?.mode]);
  useEffect(() => {
    if (!older || loading || historyBusy || error || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) load(true); }, { root: viewport.current, rootMargin: '80px 0px 0px 0px' });
    observer.observe(historySentinel.current);
    return () => observer.disconnect();
  }, [load, older, loading, historyBusy, error, messages.length]);
  async function send(event) {
    event.preventDefault();
    stopTyping();
    if (sending.current || (!body.trim() && !attachment && !product)) return;
    sending.current = true; setBusy(true); setError('');
    const text = body.trim();
    if (pending.current?.body !== text || pending.current?.image !== attachment || pending.current?.product_id !== (product?.id || null)) pending.current = { client_id: crypto.randomUUID(), body: text, image: attachment, product_id: product?.id || null };
    try {
      let payload;
      if (attachment) {
        payload = new FormData();
        payload.append('client_id', pending.current.client_id); payload.append('body', text); payload.append('image', attachment);
        if (product) payload.append('product_id', product.id);
      } else payload = JSON.stringify({ client_id: pending.current.client_id, body: text, ...(product ? { product_id: product.id } : {}) });
      const result = await apiRequest(path, { method: 'POST', body: payload, ...(attachment ? { timeoutMs: 60000 } : {}) });
      if (active.current) { setSalesAI(result.thread?.sales_ai || null); onHandlingChange?.(result.thread); }
      if (active.current) { pinned.current = true; merge([result.message]); setBody(''); setAttachment(null); setProduct(null); pending.current = null; }
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { sending.current = false; if (active.current) setBusy(false); }
  }
  async function retryTelegram(id) {
    if (retryWorking.current) return;
    retryWorking.current=true; setRetrying(id); setError('');
    try {
      const result=await apiRequest(`${path}/${id}/retry-telegram`,{method:'POST',body:'{}'});
      if (active.current) merge([result.message]);
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { retryWorking.current=false; if (active.current) setRetrying(null); }
  }
  async function handoff() {
    if (handingOff.current) return;
    handingOff.current = true; setHandoffBusy(true); setError('');
    try {
      const result = await apiRequest(`${basePath}/${uuid}/handoff`, { method: 'POST', body: JSON.stringify(selfSender === 'owner' ? { mode: salesAI.mode === 'ai' ? 'human' : 'ai', version: salesAI.version } : {}) });
      if (active.current) { setSalesAI(result.thread?.sales_ai || null); onHandlingChange?.(result.thread); }
    } catch (failure) { if (active.current) setError(failure.message); }
    finally { handingOff.current = false; if (active.current) setHandoffBusy(false); }
  }
  const handoverToggle = salesAI?.enabled && canSend && selfSender === 'owner' && <button type="button" className="shop-chat-handover-toggle" role="switch" aria-checked={salesAI.mode === 'ai'} aria-label="AI replies" title={salesAI.mode === 'ai' ? 'Take over this conversation' : 'Hand over to AI'} disabled={handoffBusy || busy} onClick={handoff}><span className="shop-chat-toggle-track" aria-hidden="true"><span /></span><span>AI replies</span></button>;
  return <div className="shop-chat-conversation">
    {headerActionsHost ? createPortal(handoverToggle, headerActionsHost) : handoverToggle}
    <span className="shop-chat-connection" role="status">{connection}</span>
    <div className="shop-chat-messages" aria-label="Conversation messages" ref={viewport} onScroll={() => {
      const node = viewport.current;
      pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60; markRead();
      if (node.scrollTop < 80 && older && !error) load(true);
    }}>
      <div ref={historySentinel} className="shop-chat-history-sentinel" aria-hidden="true" />
      {historyBusy && <div className="shop-chat-history-loading" role="status"><span>Loading older messages…</span><div className="shop-chat-history-progress" role="progressbar" aria-label="Loading older messages"><span /></div></div>}
      {loading && <p role="status">Loading messages…</p>}
      {!loading && messages.length === 0 && <p>No messages yet. Start the conversation.</p>}
      {messages.map((message) => <article className={`shop-chat-message${message.sender === selfSender ? ' is-mine' : ''}`} key={message.id}>
        <small>{message.is_ai ? `${message.ai_name || 'Sales assistant'} · AI` : message.sender === selfSender ? 'You' : selfSender === 'owner' ? 'Customer' : 'Shop'}</small>{message.product && <ChatProductCard product={message.product} href={message.product.public_url || `${(import.meta.env.VITE_SHOP_URL || 'http://localhost:5177').replace(/\/$/, '')}/#/store/${encodeURIComponent(message.product.store_slug)}/products/${message.product.id}`} />}{message.image && <ShopChatImage message={message} path={`${basePath}/${uuid}/messages/${message.id}/image`} />}{message.body && <p>{message.body}</p>}<span className="shop-chat-message-meta"><time dateTime={chatDate(message.created_at)?.toISOString()} title={chatDate(message.created_at)?.toLocaleString(undefined, { timeZone: getBusinessTimezone() })}>{chatDate(message.created_at)?.toLocaleTimeString([], { timeZone: getBusinessTimezone(), hour: '2-digit', minute: '2-digit' })}</time>{message.sender === selfSender && (telegram ? <TelegramReceipt message={message} onRetry={canSend ? () => retryTelegram(message.id) : undefined} disabled={retrying !== null || busy} /> : <span className={`shop-chat-receipt${recipientRead >= message.id ? ' is-seen' : ''}`} aria-label={recipientRead >= message.id ? 'Seen' : 'Sent'} title={recipientRead >= message.id ? 'Seen' : 'Sent'}>{recipientRead >= message.id ? <CheckCheck size={14} /> : <Check size={14} />}</span>)}</span>
      </article>)}
    </div>
    {salesAI?.enabled && salesAI.mode === 'ai' && salesAI.responding && <div className="shop-chat-ai-thinking" role="status" aria-label="AI is preparing a reply"><Bot size={18} aria-hidden="true" /><span><strong>{salesAI.name || 'Sales assistant'} · AI</strong><small>Preparing a reply…</small></span><span className="shop-chat-ai-dots" aria-hidden="true"><i /><i /><i /></span></div>}
    {!telegram && peerTyping && <div className="shop-chat-typing" role="status"><span aria-hidden="true"><i /><i /><i /></span>{selfSender === 'customer' ? 'Shop is typing...' : 'Customer is typing...'}</div>}
    {error && <p role="alert">{error} <button type="button" onClick={() => load(retryOlder.current, true)}>Retry</button></p>}
    {canSend && attachment && <ChatImagePreview file={attachment} disabled={busy} onRemove={() => setAttachment(null)} />}
    {canSend && productPicker && <ChatProductPicker apiRequest={apiRequest} path={`${basePath}/${uuid}/products`} disabled={busy} onClose={() => setProductPicker(false)} onSelect={value => { setProduct(value); setProductPicker(false); }} />}
    {canSend && product && <ChatProductPreview product={product} disabled={busy} onRemove={() => setProduct(null)} />}
    {canSend && <form className="shop-chat-composer" onSubmit={send}><button type="button" className="shop-chat-attach" aria-label="Share product" title="Share product" aria-expanded={productPicker} disabled={busy} onClick={() => setProductPicker(value => !value)}><PackagePlus size={20} /></button><ChatImagePicker disabled={busy} onSelect={(file) => { if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { setError('Choose a JPG, PNG or WebP image up to 2 MB.'); return; } setError(''); setAttachment(file); }} /><ChatMessageInput onResize={() => { if (pinned.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }} aria-label="Message" placeholder="Write a message" maxLength={2000} value={body} disabled={busy} onChange={changeBody} /><button type="submit" className="primary" disabled={busy || (!body.trim() && !attachment && !product)}><Send size={16} />{busy ? 'Sending…' : 'Send'}</button></form>}
  </div>;
}
