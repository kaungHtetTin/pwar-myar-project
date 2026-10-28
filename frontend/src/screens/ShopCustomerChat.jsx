import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Minus, X } from 'lucide-react';
import { request } from '../api';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { chatInitials } from '../shopChatPresentation';
import { ChatLastSeen } from '../components/ChatLastSeen';
import { ShopChatConversation } from './ShopChatConversation';
import { AppBarActions } from '../components/WorkspaceHeader';

export function ShopCustomerChat({ customer, customerKey }) {
  const [mode, setMode] = useState('closed');
  const [headerActionsHost, setHeaderActionsHost] = useState(null);
  const [started, setStarted] = useState(false);
  const [state, setState] = useState({ loading: true, config: null, uuid: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [presence, setPresence] = useState(null);
  const [lastSeen, setLastSeen] = useState(null);
  const read = useRef({ id: 0, busy: false });
  useEffect(() => {
    if (!started) return;
    let active = true;
    setState({ loading: true, config: null, uuid: null, error: '' });
    async function load() {
      try {
        const config = await request('/shop-admin/chat/config');
        if (!active) return;
        if (!config.enabled) { setState({ loading: false, config, uuid: null, error: '' }); return; }
        const { thread } = await request(`/shop-admin/customers/${encodeURIComponent(customerKey)}/chat`, { method: 'POST', body: '{}' });
        if (active) setState({ loading: false, config, uuid: thread.uuid, error: '' });
      } catch (error) { if (active) setState({ loading: false, config: null, uuid: null, error: error.message }); }
    }
    load();
    return () => { active = false; };
  }, [customerKey, retry, started]);
  const markRead = useCallback(async (messageId) => {
    if (!state.uuid || read.current.busy || read.current.id >= messageId) return;
    read.current.busy = true;
    try {
      await request(`/shop-admin/chat/${state.uuid}/read`, { method: 'POST', body: JSON.stringify({ message_id: messageId }) });
      read.current.id = messageId;
      window.dispatchEvent(new Event('mkpos:shop-chat-read'));
    } catch { /* The conversation retries when messages are refreshed. */ }
    finally { read.current.busy = false; }
  }, [state.uuid]);
  if (state.config && !state.config.enabled) return null;
  return <>
    <AppBarActions className="shop-customer-chat-actions"><button type="button" className="primary" aria-label={`Open chat with ${customer.customer_name}`} title={`Chat with ${customer.customer_name}`} aria-expanded={mode === 'open'} onClick={() => { setStarted(true); setMode('open'); }}><MessageCircle size={16} /> Customer chat</button></AppBarActions>
    <aside className={`shop-customer-chat${mode === 'open' ? ' is-open' : ''}`} hidden={mode === 'closed'} aria-label={`Chat with ${customer.customer_name}`}>
    <div className="shop-customer-chat-window" hidden={mode === 'closed'}>
      <header className="shop-customer-chat-heading">
        <button type="button" className="shop-customer-chat-title" aria-label={`${mode === 'minimized' ? 'Expand' : 'Minimize'} chat with ${customer.customer_name}`} aria-expanded={mode === 'open'} onClick={() => setMode(mode === 'open' ? 'minimized' : 'open')}>
          <span className="shop-chat-avatar" aria-hidden="true"><ProfileAvatar url={customer.avatar_url}>{chatInitials(customer.customer_name)}</ProfileAvatar></span>
          <span><strong>{customer.customer_name}</strong><small><ChatLastSeen active={presence?.customer_active} known={Boolean(presence)} value={lastSeen} /></small></span>
        </button>
        <div className="shop-chat-header-actions" ref={setHeaderActionsHost} hidden={mode !== 'open'} />
        {mode === 'open' && <button type="button" className="shop-customer-chat-icon" aria-label="Minimize chat" onClick={() => setMode('minimized')}><Minus size={18} /></button>}
        <button type="button" className="shop-customer-chat-icon mkpos-dismiss-icon" aria-label="Close chat" onClick={() => setMode('closed')}><X size={18} /></button>
      </header>
      <div className="shop-customer-chat-body" hidden={mode !== 'open'}>
        {state.loading && <p role="status">Loading customer chat…</p>}
        {state.error && <p role="alert">{state.error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry chat</button></p>}
        {state.uuid && <ShopChatConversation headerActionsHost={headerActionsHost} uuid={state.uuid} config={state.config} apiRequest={request} basePath="/shop-admin/chat" authPath="/shop-admin/chat/auth" selfSender="owner" onRead={markRead} onPresence={setPresence} onLastSeen={setLastSeen} />}
      </div>
    </div>
  </aside></>;
}
