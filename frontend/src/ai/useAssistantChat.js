import { monitorAssistantDelivery } from '../../../shared/network/assistantDelivery.js';
import { isImageFile } from './attachments';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAssistantChat({ api, scope, app, language = 'en', active = true }) {
  const key = `mkpos.ai.conversation:${scope}`;
  const [conversation, setConversation] = useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  const [items, setItems] = useState([]), [config, setConfig] = useState(null), [draft, setDraft] = useState(''), [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [outgoing, setOutgoing] = useState(null), [phase, setPhase] = useState('idle'), [arrivals, setArrivals] = useState([]);
  const pendingClientId = items.find(row => row.role === 'user' && row.status === 'pending')?.client_id;
  const queuedReply = Boolean(pendingClientId);
  const [older, setOlder] = useState(null), [olderBusy, setOlderBusy] = useState(false), [threads, setThreads] = useState([]), [threadOffset, setThreadOffset] = useState(0), [moreThreads, setMoreThreads] = useState(false);
  const [billingRequests, setBillingRequests] = useState([]);
  const [actions, setActions] = useState({ items: [], has_more: false });
  const [actionBusy, setActionBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false), [historyError, setHistoryError] = useState('');
  const initialized = useRef(false), alive = useRef(true), sending = useRef(false), generation = useRef(0), pending = useRef(null), paging = useRef(false), historyPaging = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!arrivals.length) return;
    // Hidden windows and reduced-motion environments may not emit animationend.
    const timer = setTimeout(() => setArrivals([]), 300);
    return () => clearTimeout(timer);
  }, [arrivals]);
  const remember = useCallback(id => { setConversation(id); try { if (id) localStorage.setItem(key,id); else localStorage.removeItem(key); } catch { /* In-memory chat remains usable. */ } },[key]);
  const merge = useCallback(rows => setItems(previous => [...new Map([...previous,...rows].map(row => [row.id,row])).values()].sort((a,b)=>a.id-b.id)),[]);
  const quotaRevision = useRef(0), quotaActivated = useRef(false);
  const applyWeeklyUsage = useCallback(usage => {
    if (!usage) return;
    quotaRevision.current++;
    setConfig(previous => previous ? { ...previous, weekly_usage: usage } : previous);
  }, []);
  const refreshConfig = useCallback(async () => {
    const revision = ++quotaRevision.current;
    const value = await api('/ai-assistant/config');
    if (alive.current && revision === quotaRevision.current) setConfig(value);
  }, [api]);
  useEffect(() => {
    if (!active) return;
    const update = () => { if (document.visibilityState !== 'hidden') void refreshConfig().catch(() => {}); };
    if (quotaActivated.current) update();
    quotaActivated.current = true;
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [active, refreshConfig]);
  const load = useCallback(async (id, before = null) => {
    const current = generation.current;
    if (before) { if (paging.current) return; paging.current=true; setOlderBusy(true); } else setLoading(true);
    setError('');
    try {
      const value=await api(`/ai-assistant/conversations/${id}/messages?limit=30${before?`&before=${before}`:''}`);
      if (!alive.current || current!==generation.current) return;
      applyWeeklyUsage(value.weekly_usage);
      if (before) merge(value.items); else { setItems(value.items); setActions(value.actions || { items: [], has_more: false }); setBillingRequests(value.billing_requests || []); }
      setOlder(value.has_more ? value.next_before : null);
    } catch(e) {
      if (alive.current && current===generation.current) {
        setError(e.message);
        if (e.status===404) { remember(''); setItems([]); setOlder(null); }
      }
    } finally { paging.current=false; if (alive.current && current===generation.current) { setLoading(false); setOlderBusy(false); } }
  },[api,merge,remember,applyWeeklyUsage]);
  const refresh = useCallback(async () => {
    const current = generation.current;
    setLoading(true); setError('');
    try { await refreshConfig(); }
    catch(e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setLoading(false); }
    if (conversation && alive.current && current === generation.current) await load(conversation);
  },[refreshConfig,conversation,load]);
  useEffect(() => { if (!active || initialized.current) return; initialized.current=true; void refresh(); },[active,refresh]);
  const choose = async id => {
    if (sending.current) return;
    generation.current++; remember(id); setItems([]); setActions({ items: [], has_more: false }); setBillingRequests([]); setOlder(null); setDraft(''); setFile(null); setArrivals([]); pending.current=null;
    await load(id);
  };
  const startNew = () => {
    if (sending.current) return;
    generation.current++; remember(''); setItems([]); setActions({ items: [], has_more: false }); setBillingRequests([]); setOlder(null); setDraft(''); setFile(null); setError(''); setArrivals([]); pending.current=null;
  };
  useEffect(() => {
    const changed = () => {
      if (!initialized.current) return;
      api('/ai-assistant/config').then(value => { if (alive.current) setConfig(value); }).catch(() => {});
    };
    window.addEventListener('mkpos:subscription-entitlement', changed);
    return () => window.removeEventListener('mkpos:subscription-entitlement', changed);
  }, [api]);
  const send = async (retryMessage = null) => {
    if (config?.subscription_access?.allowed === false) return false;
    if (sending.current || queuedReply || actionBusy || !config?.enabled || !config?.configured || !config?.storage_ready) return false;
    const body=retryMessage ? retryMessage.body : draft.trim(); const upload=retryMessage ? null : file;
    if (!body && !upload && !retryMessage?.attachment) return false;
    if (!retryMessage && pending.current && (pending.current.body!==body || pending.current.file!==upload)) pending.current=null;
    const request = retryMessage ? { client_id:retryMessage.client_id,body,file:null } : pending.current || { client_id:crypto.randomUUID(),body,file:upload,conversation:conversation || crypto.randomUUID() };
    if (!retryMessage) pending.current=request;
    const id=conversation || request.conversation;
    sending.current=true; setBusy(true); setError('');
    setPhase(!conversation ? 'starting' : 'waiting');
    if (!retryMessage) {
      setOutgoing({ id: request.client_id, body, attachment: request.file ? { name: request.file.name, type: isImageFile(request.file) ? 'image' : 'csv', file: request.file } : null, delivery: 'pending' });
      setDraft(''); setFile(null);
    }
    try {
      if (!conversation) {
        await api('/ai-assistant/conversations',{method:'POST',body:JSON.stringify({id})});
        if (!alive.current) return false;
        remember(id);
      }
      setPhase('waiting');
      let payload;
      if (request.file) { payload=new FormData(); payload.append(isImageFile(request.file) ? 'image' : 'csv',request.file); payload.append('body',request.body); payload.append('client_id',request.client_id); payload.append('language',language); payload.append('app',app); }
      else payload=JSON.stringify({body:request.body,client_id:request.client_id,language,app});
      const value=await api(`/ai-assistant/conversations/${id}/messages`,{method:'POST',body:payload,timeoutMs:30000});
      if (!alive.current) return false;
      merge(value.items);
      applyWeeklyUsage(value.weekly_usage);
      setThreads(previous => [{ id, title: (request.body || request.file?.name || 'New conversation').slice(0, 100), updated_at: new Date().toISOString() }, ...previous.filter(thread => thread.id !== id)]);
      setActions(value.actions || { items: [], has_more: false }); setBillingRequests(value.billing_requests || []);
      setArrivals(value.items.filter(row => row.role === 'assistant' && !items.some(item => item.id === row.id)).map(row => row.id));
      setPhase(value.pending ? 'waiting' : 'received');
      if (!retryMessage || pending.current?.client_id === retryMessage.client_id) { setDraft('');setFile(null);pending.current=null; }
      return true;
    } catch(e) {
      if(alive.current && e.payload?.subscription_access) setConfig(previous=>previous?{...previous,subscription_access:e.payload.subscription_access}:previous);
      if (alive.current) { if(!retryMessage){setDraft(request.body);setFile(request.file);} setPhase('failed'); setError(e.message); await load(id); setError(e.message); }
      return false;
    } finally { sending.current=false; if(alive.current){setBusy(false);setOutgoing(null);} }
  };
  // Reconcile queued work after acceptance, reload or a lost connection; never re-submit it.
  useEffect(() => {
    if (!active || busy || !conversation || !pendingClientId) return;
    const current = generation.current;
    return monitorAssistantDelivery(api, `/ai-assistant/conversations/${conversation}/messages/${pendingClientId}/delivery`, scope, ({ receipt, denied }) => {
      if (!alive.current || current !== generation.current) return;
      if (denied) {
        setError(denied.message); setItems([]); setActions({items:[],has_more:false}); setBillingRequests([]); remember(''); return;
      }
      if (receipt.items?.length) merge(receipt.items);
      if (receipt.actions) setActions(receipt.actions);
      if (receipt.billing_requests) setBillingRequests(receipt.billing_requests);
      applyWeeklyUsage(receipt.weekly_usage);
      if (receipt.status === 'completed' || receipt.status === 'failed') {
        if (pending.current?.client_id === pendingClientId) { pending.current=null; setDraft(''); setFile(null); }
        if (receipt.status === 'failed') setError('Wyne Wyne could not finish this reply. Retry the saved message.');
        setPhase(receipt.status === 'failed' ? 'failed' : 'received');
        setArrivals((receipt.items || []).filter(row => row.role === 'assistant').map(row => row.id));
        return;
      }
    });
  },[api,active,busy,conversation,pendingClientId,merge,applyWeeklyUsage,remember,scope]);
  const history = async (reset = true) => {
    if (historyPaging.current) return;
    historyPaging.current=true;setHistoryBusy(true);setHistoryError('');
    const offset=reset?0:threadOffset;
    try {
      const value=await api(`/ai-assistant/conversations?limit=20&offset=${offset}`);
      if (!alive.current) return;
      setThreads(previous=>reset?value.items:[...new Map([...previous,...value.items].map(row=>[row.id,row])).values()]);
      setThreadOffset(offset+value.items.length);setMoreThreads(value.has_more);
    } catch(e) { if(alive.current)setHistoryError(e.message); }
    finally { historyPaging.current=false;if(alive.current)setHistoryBusy(false); }
  };
  const updateBillingRequest = useCallback(row => setBillingRequests(previous => previous.some(item => item.id === row.id) ? previous.map(item => item.id === row.id ? row : item) : [...previous, row]), []);
  const updateAction = useCallback(action => setActions(previous => ({ ...previous, items: previous.items.map(row => row.id === action.id ? action : row) })), []);
  const appendActions = useCallback(page => setActions(previous => ({ ...page, items: [...new Map([...previous.items, ...page.items].map(row => [row.id, row])).values()] })), []);
  return {config,conversation,items,billingRequests,updateBillingRequest,draft,setDraft,file,setFile,loading,busy:busy||actionBusy||queuedReply,replyBusy:busy||queuedReply,error,actions,updateAction,appendActions,setActionBusy,setError,outgoing,phase,arrivals,settleArrival:id=>setArrivals(previous=>previous.filter(value=>value!==id)),older,olderBusy,loadOlder:()=>older&&conversation&&load(conversation,older),refresh,send,startNew,choose,history,threads,historyBusy,historyError,moreThreads};
}
