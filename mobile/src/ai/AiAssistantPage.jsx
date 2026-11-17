import { REMAINING_PAGE_MESSAGES } from '../localization/remainingPagesLocale';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { NEW_FEATURE_MESSAGES } from '../../../shared/localization/newFeatures.js';
import { AssistantSubscriptionNotice } from './AssistantSubscriptionNotice';
import { AssistantQuotaAvatar, AssistantQuotaReset } from './AssistantQuotaAvatar';
import { AssistantIntroduction } from './AssistantIntroduction';
import { BillingRequests } from './BillingRequests';
import { ErrorReportContactPrompt } from './ErrorReportContact';
import { assistantName } from './identity';
import { AttachmentPreview } from './AttachmentPreview';
import { attachmentAccept, attachmentError } from './attachments';
import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, RefreshCw, RotateCw, Check, CheckCheck, ChevronRight, LoaderCircle, History, MessageSquare, Paperclip, Plus, Send } from 'lucide-react';
import { apiRequest } from '../api/client';
import { DATA_CHANGED_EVENT } from '../navigation/dataChanges';
import { BusinessActions } from './BusinessActions';
import { AssistantReply } from './AssistantReply';
import { Button, IconButton, Input, Textarea } from '../components/Controls';
import { MobileFilterPanel } from '../components/MobilePrimitives';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { PageActivityContext, usePageRefresh } from '../navigation/pageRefresh';
import { useLocale } from '../localization/LocaleContext';
import { useAssistantChat } from './useAssistantChat';


function conversationDate(value, language) {
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(language === 'my' ? 'my-MM' : 'en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function AiAssistantPageContent({session,onBack,screens=[],onNavigate,onOpenReport}) {
  const {language,setLanguage}=useLocale();const active=useContext(PageActivityContext);
  const chat=useAssistantChat({api:apiRequest,scope:`${session.user.id}:${session.business?.id}`,app:'business_mobile',language,active});
  const name=assistantName(language,chat.config);
  const preparingReply=language==='my'?`${name} ပြန်လည်ဖြေကြားနေပါတယ်...`:`${name} is preparing a reply...`;
  const askPlaceholder=language==='my'?`${name}ကို မေးပါ`:`Ask ${name}`;
  const [history,setHistory]=useState(false);const viewport=useRef(null),sentinel=useRef(null),historySentinel=useRef(null),anchor=useRef(null),pinned=useRef(true),editor=useRef(null);
  usePageRefresh(chat.refresh);
  useLayoutEffect(()=>{const node=viewport.current;if(!node||!active)return;if(!chat.items.length&&!chat.outgoing){node.scrollTop=0;}else if(anchor.current){node.scrollTop=anchor.current.top+node.scrollHeight-anchor.current.height;anchor.current=null;}else if(pinned.current)node.scrollTop=node.scrollHeight;},[chat.items,chat.outgoing,chat.busy,active]);
  useLayoutEffect(()=>{if(editor.current){editor.current.style.height='auto';editor.current.style.height=`${Math.min(128,Math.max(44,editor.current.scrollHeight))}px`;}},[chat.draft]);
  const older=()=>{const node=viewport.current;if(node)anchor.current={top:node.scrollTop,height:node.scrollHeight};void chat.loadOlder();};
  useEffect(()=>{
    const canLoad=history?chat.moreThreads&&!chat.historyBusy&&!chat.historyError:chat.older&&!chat.olderBusy&&!chat.error;
    const target=history?historySentinel.current:sentinel.current;
    if(!active||!canLoad||typeof IntersectionObserver==='undefined'||!target)return;
    const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;if(history)void chat.history(false);else{const node=viewport.current;if(node)anchor.current={top:node.scrollTop,height:node.scrollHeight};void chat.loadOlder();}},{root:history?target.closest('.mobile-filter-drawer-body'):viewport.current});
    observer.observe(target);return()=>observer.disconnect();
  },[active,history,chat.moreThreads,chat.historyBusy,chat.historyError,chat.older,chat.olderBusy,chat.error,chat.history,chat.loadOlder,chat]);
  const messages=chat.outgoing?[...chat.items.filter(item=>item.client_id!==chat.outgoing.client_id&&item.id!==chat.outgoing.original_id),chat.outgoing]:chat.items;
  const savedReplyError=chat.failedReply?.error===chat.error&&chat.items.some(message=>message.client_id===chat.failedReply?.client_id&&message.status==='failed');
  const subscriptionAllowed=chat.config?.subscription_access?.allowed!==false;
  const ready=chat.config?.enabled&&chat.config?.configured&&chat.config?.storage_ready&&subscriptionAllowed;
  return <main className="shop-mobile-page shop-conversation-page ai-mobile-page"><section className="shop-mobile-conversation" data-disable-swipe-refresh>
    <PageAppBar className="shop-chat-conversation-header"><IconButton variant="ghost" type="button" aria-label="Back" onClick={onBack}><ArrowLeft size={22}/></IconButton><span className="shop-chat-header-profile"><AssistantQuotaAvatar language={language} usage={chat.config?.weekly_usage}/><span className="shop-chat-header-copy"><span className="shop-chat-header-name" role="heading" aria-level={1}>Assistant AI</span><AssistantQuotaReset language={language} usage={chat.config?.weekly_usage} fallback={language==='my'?'PwarMyar အကူအညီ':'PwarMyar assistant'}/></span></span><IconButton variant="ghost" type="button" className="ai-mobile-history-trigger" aria-label="History" title="History" aria-expanded={history} aria-controls="ai-conversation-drawer" aria-haspopup="dialog" disabled={chat.busy} onClick={()=>{setHistory(true);void chat.history();}}><History size={20}/></IconButton><AppBarMenu/></PageAppBar>
    <div className="shop-mobile-messages" aria-label="AI conversation messages" ref={viewport} onScroll={()=>{const node=viewport.current;pinned.current=node.scrollHeight-node.scrollTop-node.clientHeight<60;}}>
      <div ref={sentinel}/>{chat.older&&<Button variant="secondary" type="button" disabled={chat.olderBusy} onClick={older}>Load older messages</Button>}{chat.loading&&<p role="status">Loading messages...</p>}{!chat.loading&&!messages.length&&<AssistantIntroduction name={name} language={language} role={session.user.role}/>}{messages.map(message=><article key={message.client_id || message.id} className={`shop-mobile-message${message.role==='user'?' is-mine':''}${message.status==='failed'?' has-reply-error':''}`}><small className="shop-chat-sender">{message.role==='user'?'You':name}</small>{message.attachment&&<AttachmentPreview attachment={message.attachment} />}{message.body&&(message.role==='assistant'?<AssistantReply body={message.body} role={session.user.role} screens={screens} onNavigate={onNavigate} disabled={chat.busy}/>:<p data-no-localize>{message.body}</p>)}<small className="shop-chat-message-meta">{new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{message.role==='user'&&<span className="ai-mobile-delivery" aria-label={message.status==='failed'?'Reply unavailable':message.delivery==='sending'?'Sending':message.delivery==='seen'||message.status==='completed'?'Seen':message.delivery==='sent'?'Sent':'Processing'} title={message.delivery==='seen'||message.status==='completed'?'Seen means accepted by the AI service for processing.':undefined}>{message.status==='failed'?<><CircleAlert size={13} aria-hidden="true"/>Reply unavailable</>:message.delivery==='sending'?<><LoaderCircle size={12} className="ai-mobile-sending"/>Sending...</>:message.delivery==='seen'||message.status==='completed'?<><CheckCheck size={13} aria-hidden="true"/></>:message.delivery==='sent'?<><Check size={13} aria-hidden="true"/></>:<>Processing...</>}</span>}{message.role==='user'&&message.status==='failed'&&<IconButton variant="ghost" type="button" className="ai-mobile-retry" aria-label="Retry message" title="Retry message" disabled={chat.busy||!ready} onClick={()=>chat.send(message)}><RotateCw size={18}/></IconButton>}</small>{message.role==='user'&&message.status==='failed'&&<span className="ai-mobile-failure-note">Your message is saved.</span>}</article>)}
      {chat.items.filter(message=>message.error_report_request).map(message=><ErrorReportContactPrompt key={message.error_report_request.id} request={message.error_report_request} language={language} onOpen={onOpenReport}/>)}<BillingRequests key={`billing:${chat.conversation}`} requests={chat.billingRequests} role={session?.user?.role} api={apiRequest} conversation={chat.conversation} onChange={chat.updateBillingRequest} onBusy={chat.setActionBusy} onSaved={()=>window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT,{detail:{modules:['billing','subscription']}}))} screens={screens} onNavigate={onNavigate} disabled={chat.busy||!subscriptionAllowed}/><BusinessActions onOpenPurchaseDraft={id=>{if(!chat.busy)onNavigate?.('purchases_new',{purchaseDraftId:id});}} key={chat.conversation} api={apiRequest} conversation={chat.conversation} actions={chat.actions} onChange={chat.updateAction} onAppend={chat.appendActions} onBusy={chat.setActionBusy} onSaved={result=>{if(result.sales_ai_telegram)window.dispatchEvent(new CustomEvent('mkpos:sales-ai-telegram-updated',{detail:result.sales_ai_telegram}));if(result.sales_ai)window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated',{detail:result.sales_ai}));if(result.sales_ai_topup)window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated',{detail:{request:result.sales_ai_topup}}));if(result.settings?.language) setLanguage(result.settings.language); window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT,{detail:{modules:result.modules || []}})); if(result.settings) apiRequest('/auth/me').then(session=>window.dispatchEvent(new CustomEvent('mkpos:session-updated',{detail:session}))).catch(()=>{});}} disabled={chat.busy||!subscriptionAllowed}/>
    </div>
    {chat.replyBusy&&<p className="shop-chat-feedback" role="status">{preparingReply}</p>}
    {chat.error&&!savedReplyError&&<div className="shop-chat-feedback is-error ai-mobile-error-notice" role="alert"><CircleAlert size={17} aria-hidden="true"/><span>{chat.error}</span><IconButton variant="ghost" type="button" aria-label="Refresh chat" title="Refresh chat" disabled={chat.busy} onClick={()=>chat.refresh()}><RefreshCw size={18}/></IconButton></div>}
    <AssistantSubscriptionNotice access={chat.config?.subscription_access} role={session.user.role} language={language} screens={screens} onNavigate={onNavigate}/>{chat.config&&!ready&&subscriptionAllowed&&<p className="shop-chat-feedback" role="status">AI assistant is not available yet. Please contact platform support.</p>}
    <form className="shop-mobile-form shop-mobile-composer" onSubmit={event=>{event.preventDefault();pinned.current=true;void chat.send();}}>
      {chat.file&&<div className="ai-mobile-file"><AttachmentPreview file={chat.file} disabled={chat.busy} onRemove={()=>chat.setFile(null)} /></div>}
      <div className="shop-chat-compose-row"><label className="shop-chat-attach" title="Attach image or product CSV"><Paperclip size={20}/><span className="sr-only">Attach image or product CSV</span><Input type="file" aria-label="Attach image or product CSV" accept={attachmentAccept} disabled={chat.busy||!ready} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const error=attachmentError(file);if(error){chat.setError(error);return;}chat.setFile(file);chat.setError('');}}/></label><Textarea ref={editor} className="shop-chat-message-input" rows={1} aria-label="AI message" maxLength={4000} disabled={chat.busy||!ready} placeholder={askPlaceholder} value={chat.draft} onChange={event=>chat.setDraft(event.target.value)}/><IconButton variant="primary" type="submit" className="shop-chat-send" aria-label="Send AI message" disabled={chat.busy||chat.loading||!ready||(!chat.draft.trim()&&!chat.file)}><Send size={19}/></IconButton></div>
    </form>
  </section><MobileFilterPanel open={history} id="ai-conversation-drawer" title="Conversations" icon={History} as="aside" className="ai-mobile-history-drawer" onClose={()=>setHistory(false)}><Button variant="secondary" type="button" className="ai-mobile-new-chat" disabled={chat.busy} onClick={()=>{chat.startNew();setHistory(false);pinned.current=true;}}><Plus size={18}/>New chat</Button><ul className="ai-mobile-conversations" aria-label="Saved AI conversations">{chat.threads.map(thread=><li key={thread.id}><Button variant="plain" type="button" className="ai-mobile-thread" aria-labelledby={`ai-thread-title-${thread.id}`} aria-current={chat.conversation===thread.id?'true':undefined} disabled={chat.busy||chat.loading} onClick={()=>{void chat.choose(thread.id);setHistory(false);pinned.current=true;}}><span className="ai-mobile-thread-icon" aria-hidden="true"><MessageSquare size={19}/></span><span className="ai-mobile-thread-copy"><strong id={`ai-thread-title-${thread.id}`} data-no-localize={Boolean(thread.title) || undefined}>{thread.title || 'Untitled conversation'}</strong>{thread.updated_at&&<time>{conversationDate(thread.updated_at,language)}</time>}{chat.conversation===thread.id&&<small>Current chat</small>}</span><ChevronRight size={17} aria-hidden="true"/></Button></li>)}</ul>{chat.historyBusy&&<p role="status">Loading history...</p>}{!chat.historyBusy&&!chat.historyError&&!chat.threads.length&&<div className="ai-mobile-history-empty"><MessageSquare size={28} aria-hidden="true"/><p>No conversations yet.</p></div>}{chat.historyError&&<p role="alert">{chat.historyError}</p>}{(chat.moreThreads||chat.historyError)&&<Button variant="secondary" type="button" disabled={chat.historyBusy} onClick={()=>chat.history(false)}>Load more conversations</Button>}<div ref={historySentinel}/></MobileFilterPanel></main>;
}

const assistantMessages = { ...REMAINING_PAGE_MESSAGES, ...NEW_FEATURE_MESSAGES };

export function AiAssistantPage(props) {
  return <ModuleLocalizationBoundary messages={assistantMessages}><AiAssistantPageContent {...props} /></ModuleLocalizationBoundary>;
}
