import { AssistantSubscriptionNotice } from './AssistantSubscriptionNotice';
import { AssistantQuotaAvatar, AssistantQuotaReset } from './AssistantQuotaAvatar';
import { AssistantIntroduction } from './AssistantIntroduction';
import { BillingRequests } from './BillingRequests';
import { ErrorReportContact } from './ErrorReportContact';
import { assistantName } from './identity';
import { AttachmentPreview } from './AttachmentPreview';
import { attachmentAccept, attachmentError } from './attachments';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Check, CheckCheck, Clock3, History, Maximize2, Minus, Paperclip, Plus, Send, X } from 'lucide-react';
import { request } from '../api';
import { emitDataChange } from '../dataEvents';
import { ChatMessageInput } from '../screens/ChatMessageInput';
import { useLanguage } from '../components/LanguageProvider';
import { useAssistantChat } from './useAssistantChat';
import { BusinessActions } from './BusinessActions';
import { AssistantReply } from './AssistantReply';
import { AiConversationList } from './AiConversationList';
import '../styles/shop.css';
import './assistant.css';

const openAiAssistant = () => window.dispatchEvent(new Event('mkpos:open-ai-assistant'));
export function AiAssistantButton() { return <button type="button" className="workspace-icon-button" aria-label="PwarMyar AI assistant" title="PwarMyar AI assistant" onClick={openAiAssistant}><Bot size={18} /></button>; }
export function AiAssistant({ scope, page = false, pageHost = null, screens = [], onNavigate, role }) {
  const [dialogMode,setMode]=useState('closed'),[started,setStarted]=useState(page),[history,setHistory]=useState(false);
  const mode = page ? 'open' : dialogMode;
  const showingHistory = history && !page;
  const language=useLanguage()?.language || 'en';
  const chat=useAssistantChat({api:request,scope,app:'business_web',language,active:(started && mode!=='closed') || page});
  const name=assistantName(language,chat.config);
  const preparingReply=language==='my'?`${name} ပြန်လည်ဖြေကြားနေပါတယ်...`:`${name} is preparing a reply...`;
  const askPlaceholder=language==='my'?`${name}ကို မေးပါ`:`Ask ${name}`;
  const actionReviewCache=useRef(null), billingFormCache=useRef(null);
  const reportContactCache=useRef({scope, entries:new Map()});
  if(reportContactCache.current.scope!==scope) reportContactCache.current={scope,entries:new Map()};
  const reportCache=id=>{const entries=reportContactCache.current.entries;if(!entries.has(id))entries.set(id,{});return entries.get(id);};
  const viewport=useRef(null),sentinel=useRef(null),anchor=useRef(null),pinned=useRef(true),trigger=useRef(null);
  const historyAction = useRef(chat.history), historyLoaded = useRef(false);
  historyAction.current = chat.history;
  useEffect(() => {
    if (page && !historyLoaded.current) { historyLoaded.current = true; void historyAction.current(); }
  }, [page]);
  useEffect(()=>{ if(page)return;const open=()=>{trigger.current=document.activeElement;setStarted(true);setMode('open');};window.addEventListener('mkpos:open-ai-assistant',open);return()=>window.removeEventListener('mkpos:open-ai-assistant',open);},[page]);
  useLayoutEffect(()=>{const node=viewport.current;if(!node||mode!=='open'||showingHistory)return;if(!chat.items.length&&!chat.outgoing){node.scrollTop=0;}else if(anchor.current){node.scrollTop=anchor.current.top+node.scrollHeight-anchor.current.height;anchor.current=null;}else if(pinned.current)node.scrollTop=node.scrollHeight;},[chat.items,chat.busy,chat.outgoing,mode,showingHistory,page,pageHost]);
  const older=()=>{const node=viewport.current;if(node)anchor.current={top:node.scrollTop,height:node.scrollHeight};void chat.loadOlder();};
  useEffect(()=>{if(mode!=='open'||showingHistory||!chat.older||chat.olderBusy||chat.error||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){const node=viewport.current;if(node)anchor.current={top:node.scrollTop,height:node.scrollHeight};void chat.loadOlder();}},{root:viewport.current});if(sentinel.current)observer.observe(sentinel.current);return()=>observer.disconnect();},[chat.loadOlder,chat.older,chat.olderBusy,chat.error,mode,showingHistory,chat]);
  const subscriptionAllowed=chat.config?.subscription_access?.allowed!==false;
  const ready=chat.config?.enabled&&chat.config?.configured&&chat.config?.storage_ready&&subscriptionAllowed;
  const { busy: assistantBusy, refresh: refreshAssistant } = chat;
  useEffect(() => {
    if (!page) return;
    const refresh = () => { if (!assistantBusy) { void refreshAssistant(); void historyAction.current(); } };
    window.addEventListener('mkpos:refresh-ai-assistant', refresh);
    return () => window.removeEventListener('mkpos:refresh-ai-assistant', refresh);
  }, [page, assistantBusy, refreshAssistant]);
  const close=()=>{setMode('closed');trigger.current?.focus?.({preventScroll:true});};
  const maximize=()=>{const node=viewport.current;if(node&&!pinned.current)anchor.current={top:node.scrollTop,height:node.scrollHeight};setMode('closed');window.dispatchEvent(new Event('mkpos:maximize-ai-assistant'));};
  const startNew = () => { chat.startNew(); setHistory(false); pinned.current=true; };
  const choose = id => { void chat.choose(id); setHistory(false); pinned.current=true; };
  const Title = page ? 'div' : 'button';
  const heading = <header className="shop-customer-chat-heading"><Title type={page ? undefined : 'button'} className="shop-customer-chat-title" onClick={page ? undefined : ()=>setMode(mode==='open'?'minimized':'open')} aria-label={page ? undefined : mode==='open'?'Minimize AI chat':'Expand AI chat'}><AssistantQuotaAvatar language={language} usage={chat.config?.weekly_usage}/><span><strong>Assistant AI</strong><AssistantQuotaReset language={language} usage={chat.config?.weekly_usage}/></span></Title>{!page && <><button type="button" className="shop-customer-chat-icon" aria-label="Maximize AI chat" title="Maximize" disabled={chat.busy && !chat.replyBusy} onClick={maximize}><Maximize2 size={18}/></button><button type="button" className="shop-customer-chat-icon" aria-label="Minimize chat" onClick={()=>setMode('minimized')}><Minus size={18}/></button><button type="button" className="shop-customer-chat-icon" aria-label="Close AI chat" onClick={close}><X size={18}/></button></>}</header>;
  const content = <div className={`shop-admin ai-assistant-host${page ? ' ai-assistant-page' : ''}`}><aside className={`shop-customer-chat ai-assistant-window${mode==='open'?' is-open':''}`} hidden={mode==='closed'} role={page ? 'region' : 'dialog'} aria-label="PwarMyar AI assistant">
    <div className="shop-customer-chat-window">{!page && heading}
    <div className="shop-customer-chat-body" hidden={mode!=='open'}>{!page && <div className="ai-chat-tools"><button type="button" disabled={chat.busy} onClick={startNew}><Plus size={14}/>New chat</button><button type="button" disabled={chat.busy} aria-pressed={history} onClick={()=>{setHistory(!history);if(!history)void chat.history();}}><History size={14}/>History</button></div>}
    {showingHistory?<div className="ai-chat-history"><h3>Conversations</h3>{chat.threads.map(thread=><button type="button" key={thread.id} data-no-localize disabled={chat.busy||chat.loading} onClick={()=>choose(thread.id)}>{thread.title}</button>)}{!chat.historyBusy&&!chat.threads.length&&<p>No conversations yet.</p>}{chat.historyBusy&&<p role="status">Loading history...</p>}{chat.historyError&&<p role="alert">{chat.historyError}</p>}{(chat.moreThreads||chat.historyError)&&<button type="button" disabled={chat.historyBusy} onClick={()=>chat.history(false)}>Load more conversations</button>}</div>:<div className="shop-chat-conversation">{page && heading}
      <div className="shop-chat-messages" aria-busy={chat.loading} aria-label="AI conversation messages" ref={viewport} onScroll={()=>{const node=viewport.current;pinned.current=node.scrollHeight-node.scrollTop-node.clientHeight<60;}}><div ref={sentinel}/>{chat.older&&<button type="button" disabled={chat.olderBusy} onClick={older}>Load older messages</button>}{chat.loading&&<p role="status">Loading messages...</p>}{!chat.loading&&!chat.items.length&&!chat.outgoing&&<AssistantIntroduction name={name} language={language} role={role}/>}{chat.items.map(message=><article key={message.id} className={`shop-chat-message ai-chat-message${message.role==='user'?' is-mine':''}${chat.arrivals.includes(message.id)?' is-arriving':''}${message.status==='failed'?' is-failed':''}`} onAnimationEnd={()=>chat.settleArrival(message.id)}><small>{message.role==='user'?'You':name}</small>{message.attachment&&<AttachmentPreview attachment={message.attachment} />}{message.body&&(message.role==='assistant'?<AssistantReply body={message.body} role={role} screens={screens} disabled={chat.busy} onNavigate={screen=>{if(!chat.busy && onNavigate){const node=viewport.current;if(node&&!pinned.current)anchor.current={top:node.scrollTop,height:node.scrollHeight};onNavigate(screen);setMode('closed');}}}/>:<p data-no-localize>{message.body}</p>)}{message.role==='user'&&message.status==='failed'&&<button type="button" disabled={chat.busy||!ready} onClick={()=>chat.send(message)}>Retry message</button>}<span className="shop-chat-message-meta">{new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{message.status==='pending'?<Clock3 size={12} aria-label="Awaiting confirmation"/>:message.status==='failed'?' Failed':message.role==='user'?<CheckCheck size={12} aria-label="Seen"/>:''}</span></article>)}{chat.outgoing&&<article className="shop-chat-message ai-chat-message is-mine is-outgoing" aria-label="Outgoing message"><small>You</small>{chat.outgoing.attachment&&<AttachmentPreview attachment={chat.outgoing.attachment} />}{chat.outgoing.body&&<p data-no-localize>{chat.outgoing.body}</p>}<span className="shop-chat-message-meta">{chat.outgoing.delivery==='seen'?<CheckCheck size={12} aria-label="Seen"/>:chat.outgoing.delivery==='sent'?<Check size={12} aria-label="Sent"/>:<Clock3 size={12} aria-label="Awaiting confirmation"/>}</span></article>}{chat.items.filter(message=>message.error_report_request).map(message=><ErrorReportContact key={message.error_report_request.id} request={message.error_report_request} cache={reportCache(message.error_report_request.id)} api={request} language={language}/>)}<BillingRequests key={`billing:${chat.conversation}`} stateCache={billingFormCache} requests={chat.billingRequests} role={role} api={request} conversation={chat.conversation} onChange={chat.updateBillingRequest} onBusy={chat.setActionBusy} onSaved={()=>emitDataChange(['billing','subscription'],'ai-assistant')} screens={screens} onNavigate={screen=>{if(!chat.busy && onNavigate){const node=viewport.current;if(node&&!pinned.current)anchor.current={top:node.scrollTop,height:node.scrollHeight};onNavigate(screen);setMode('closed');}}} disabled={chat.busy||!subscriptionAllowed}/><BusinessActions onOpenPurchaseDraft={id=>{if(!chat.busy&&onNavigate){const node=viewport.current;if(node&&!pinned.current)anchor.current={top:node.scrollTop,height:node.scrollHeight};onNavigate('purchases_new',{purchaseDraftId:id});setMode('closed');}}} stateCache={actionReviewCache} key={chat.conversation} api={request} conversation={chat.conversation} actions={chat.actions} onChange={chat.updateAction} onAppend={chat.appendActions} onBusy={chat.setActionBusy} onSaved={result=>{if(result.sales_ai_telegram)window.dispatchEvent(new CustomEvent('mkpos:sales-ai-telegram-updated',{detail:result.sales_ai_telegram}));if(result.sales_ai)window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated',{detail:result.sales_ai}));if(result.sales_ai_topup)window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated',{detail:{request:result.sales_ai_topup}}));emitDataChange(result.modules || [], 'ai-assistant'); if(result.settings) request('/auth/me').then(session=>window.dispatchEvent(new CustomEvent('mkpos:session-updated',{detail:session}))).catch(()=>{});}} disabled={chat.busy||!subscriptionAllowed}/></div>
      {chat.replyBusy&&<div role="status" className="ai-chat-progress"><span className="ai-chat-typing-dots" aria-hidden="true"><i/><i/><i/></span><span>{chat.phase==='starting'?'Starting chat...':preparingReply}</span></div>}<AssistantSubscriptionNotice access={chat.config?.subscription_access} role={role} language={language} screens={screens} onNavigate={screen=>{const node=viewport.current;if(node&&!pinned.current)anchor.current={top:node.scrollTop,height:node.scrollHeight};onNavigate?.(screen);setMode('closed');}}/>{chat.config&&!ready&&subscriptionAllowed&&<p role="status">AI assistant is not available yet. Please contact platform support.</p>}
      {chat.error&&<p role="alert" className="ai-chat-error">{chat.error}<button type="button" disabled={chat.busy} onClick={()=>chat.refresh()}>Refresh chat</button></p>}
      {chat.file&&<div className="ai-chat-file"><AttachmentPreview file={chat.file} disabled={chat.busy} onRemove={()=>chat.setFile(null)} /></div>}
      <form className="shop-chat-composer" onSubmit={event=>{event.preventDefault();pinned.current=true;void chat.send();}}><label className="shop-chat-attach" title="Attach image or product CSV"><Paperclip size={18}/><input aria-label="Attach image or product CSV" type="file" accept={attachmentAccept} disabled={chat.busy||!ready} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const error=attachmentError(file);if(error){chat.setError(error);return;}chat.setFile(file);chat.setError('');}}/></label><ChatMessageInput aria-label="AI message" placeholder={askPlaceholder} maxLength={4000} value={chat.draft} disabled={chat.busy||!ready} onChange={event=>chat.setDraft(event.target.value)}/><button type="submit" className="primary" disabled={chat.busy||chat.loading||!ready||(!chat.draft.trim()&&!chat.file)}><Send size={16}/><span>Send</span></button></form>
    </div>}{page && <AiConversationList chat={chat} onChoose={choose} onNew={startNew} />}</div></div>
  </aside></div>;
  return page && pageHost ? createPortal(content, pageHost) : content;
}
