import { createPollPolicy } from '../backgroundPolicy';
import { ProfileAvatar } from '../components/ProfileAvatar';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, MessageCircle, MessagesSquare, Bot } from 'lucide-react';
import { chatInitials } from '../shopChatPresentation';
import { request } from '../api';
import { AppBarSearch, AppBarActions } from '../components/WorkspaceHeader';
import { connectShopChat } from '../shopChatRealtime';
import { ShopChatInbox } from './ShopChatInbox';
import { ShopChatConversation } from './ShopChatConversation';
import { telegramPresence } from '../components/telegramPresence';
import { ChatLastSeen } from '../components/ChatLastSeen';

export function ShopChat({ refresh, canSend, onViewCustomer }) {
  const [headerActionsHost, setHeaderActionsHost] = useState(null);
  const [config, setConfig] = useState(null), [selected, setSelected] = useState(null), [search, setSearch] = useState(''), [q, setQ] = useState(''), [changed, setChanged] = useState(0), [error, setError] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false), [bulkNotice, setBulkNotice] = useState(''), [bulkError, setBulkError] = useState(''), [handoverUpdate, setHandoverUpdate] = useState(null);
  const bulkWorking = useRef(false);
  const [aiHandoverRevision, setAiHandoverRevision] = useState(0);
  const workspace = useRef(null);
  const pendingRefresh = useRef(false);
  const [readThread, setReadThread] = useState(null);
  const [presence, setPresence] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const lastRead = useRef(new Map());
  const selectedActive = presence && presence.uuid === selected?.uuid ? presence.customer_active : selected?.customer_active;
  useEffect(() => { let active = true; request('/shop-admin/chat/config').then((value) => { if (active) setConfig(value); }).catch((failure) => { if (active) setError(failure.message); }); return () => { active = false; }; }, [refresh]);
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  const reload = useCallback(() => {
    if (document.hidden || workspace.current?.closest('[hidden]')) { pendingRefresh.current = true; return; }
    pendingRefresh.current = false;
    setChanged((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!config?.channel) return;
    let live = false;
    const poll = createPollPolicy();
    const stop = connectShopChat(config, config.channel, (data) => request('/shop-admin/chat/auth', { method: 'POST', body: JSON.stringify(data) }), () => { poll.success(); reload(); }, status => { live = status === 'Live'; }, undefined, () => Boolean(workspace.current && !workspace.current.closest('[hidden]')), () => request('/shop-admin/chat/presence', { method: 'POST', body: '{}' }));
    const timer = setInterval(() => { if (poll.ready() && poll.due(live) && !workspace.current?.closest('[hidden]')) { poll.success(); reload(); } }, 15000);
    return () => { stop(); clearInterval(timer); };
  }, [config, reload]);
  useLayoutEffect(() => {
    const node = workspace.current;
    const resize = () => {
      if (!node || node.closest('[hidden]')) return;
      if (pendingRefresh.current && !document.hidden) reload();
      const top = Math.max(0, node.getBoundingClientRect().top);
      node.style.height = `${Math.max(0, window.innerHeight - top - 16)}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', resize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(node.parentElement);
    const heading = node.closest('.module-view')?.parentElement?.querySelector('.workspace-page-heading');
    if (heading) observer?.observe(heading);
    const module = node.closest('.module-view');
    const visibility = module ? new MutationObserver(resize) : null;
    if (module) visibility.observe(module, { attributes: true, attributeFilter: ['hidden'] });
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', resize); observer?.disconnect(); visibility?.disconnect(); };
  }, [reload]);
  async function handoverAll() {
    if (bulkWorking.current) return;
    bulkWorking.current = true; setBulkBusy(true); setBulkError(''); setBulkNotice('');
    try {
      const result = await request('/shop-admin/chat/handoff-all', { method: 'POST', body: JSON.stringify({ selected_uuid: selected?.uuid || null }) });
      if (result.thread) setHandoverUpdate(result.thread);
      setAiHandoverRevision(value => value + 1);
      setBulkNotice(result.updated_count ? `${result.updated_count} conversation${result.updated_count === 1 ? '' : 's'} handed over to AI.` : 'All conversations already use AI.');
    } catch (e) { setBulkError(e.message); }
    finally { bulkWorking.current = false; setBulkBusy(false); }
  }
  return <>
    <AppBarSearch><label><Search size={16} /><input aria-label="Search chats" placeholder="Customer name or phone" value={search} onChange={(event) => setSearch(event.target.value)} /></label></AppBarSearch>
    {canSend && config?.sales_ai_enabled && <AppBarActions><button type="button" className="primary shop-chat-bulk-handover" disabled={bulkBusy} aria-busy={bulkBusy} onClick={handoverAll} title="Hand over every conversation in this shop to AI"><Bot size={16} aria-hidden="true" />{bulkBusy ? 'Handing over...' : 'Hand over all to AI'}</button></AppBarActions>}
    {bulkNotice && <p className="shop-chat-bulk-feedback" role="status">{bulkNotice}</p>}{bulkError && <p className="shop-chat-bulk-feedback is-error" role="alert">{bulkError}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="shop-chat-workspace" ref={workspace}><ShopChatInbox query={q} refresh={`${refresh}:${changed}`} selected={selected} onSelect={setSelected} readThread={readThread} handlingUpdate={handoverUpdate} aiHandoverRevision={aiHandoverRevision} />
    <section className="panel shop-chat-panel">{selected ? <><header className="shop-chat-customer-heading"><span className={`shop-chat-avatar${selected.sales_ai_channel !== 'telegram' && selectedActive ? ' is-active' : ''}`} aria-hidden="true"><ProfileAvatar url={selected.avatar_url}>{chatInitials(selected.customer_name)}</ProfileAvatar>{selected.sales_ai_channel !== 'telegram' && <span className={`shop-chat-presence-dot ${selectedActive ? 'is-online' : typeof selectedActive === 'boolean' ? 'is-offline' : 'is-unknown'}`} />}</span><div><h2>{onViewCustomer && selected.customer_key ? <button type="button" className="shop-chat-customer-link" aria-label={`View customer ${selected.customer_name}`} onClick={() => onViewCustomer(selected.customer_key)}>{selected.customer_name}</button> : selected.customer_name}</h2><small className={selected.sales_ai_channel !== 'telegram' && selectedActive ? 'shop-chat-active-status' : ''}>{selected.sales_ai_channel === 'telegram' ? telegramPresence({ ...selected, telegram_last_message_at: presence?.uuid === selected.uuid ? presence.telegram_last_message_at || selected.telegram_last_message_at : selected.telegram_last_message_at }) : <ChatLastSeen active={selectedActive} known={typeof selectedActive === 'boolean'} value={lastSeen?.uuid === selected.uuid ? lastSeen.value : selected.customer_last_seen_at} />}</small></div><div className="shop-chat-header-actions" ref={setHeaderActionsHost} /></header><ShopChatConversation onHandlingChange={setHandoverUpdate} handoverUpdate={handoverUpdate} headerActionsHost={headerActionsHost} key={selected.uuid} uuid={selected.uuid} channel={selected.sales_ai_channel} config={config} apiRequest={request} basePath="/shop-admin/chat" authPath="/shop-admin/chat/auth" selfSender="owner" canSend={canSend} onPresence={(status) => setPresence({ uuid: selected.uuid, ...status })} onLastSeen={(value) => setLastSeen({ uuid: selected.uuid, value })}
      onRead={(message_id) => {
        if ((lastRead.current.get(selected.uuid) || 0) >= message_id) return;
        lastRead.current.set(selected.uuid, message_id);
        request(`/shop-admin/chat/${selected.uuid}/read`, { method: 'POST', body: JSON.stringify({ message_id }) }).then(() => { setReadThread({ uuid: selected.uuid, message_id }); window.dispatchEvent(new Event('mkpos:shop-chat-read')); reload(); }).catch(() => { lastRead.current.delete(selected.uuid); });
      }} /></> : <div className="shop-chat-placeholder"><div className="shop-chat-placeholder-art" aria-hidden="true"><MessagesSquare size={48} strokeWidth={1.4} /><span><MessageCircle size={20} /></span></div><h2>Your customer conversations</h2><p>Select a conversation to view messages<br />and reply to your customer.</p><small>Keep every shop conversation in one place.</small></div>}</section></div>
  </>;
}
