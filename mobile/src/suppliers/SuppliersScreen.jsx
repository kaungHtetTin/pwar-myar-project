import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { ChoiceGroup, Button, IconButton, Input, Radio, SearchInput, Select } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { REMAINING_PAGE_MESSAGES, REMAINING_PAGE_PATTERNS } from '../localization/remainingPagesLocale';
import { Download, FileText, CreditCard, ChevronRight, Edit3, Eye, HandCoins, MapPin, Phone, Trash2, Truck, Users } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileDeleteSheet, MobileField, MobileFilterPanel, MobileFilterToggle, MobileNotice, MobileSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { usePageRefresh } from '../navigation/pageRefresh';
import { money as formatMoney } from '../products/productUtils';
import {
  supplierDate,
  blankSupplierForm,
  blankSupplierHistoryFilters,
  blankSupplierPaymentForm,
  supplierHistoryPath,
  supplierPaymentHistoryPath,
  supplierPaymentPayload,
  supplierPageFromPath,
  supplierPayload,
} from './supplierUtils';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { expandPurchaseLineItems, PURCHASE_LINE_COLUMNS } from '../purchases/purchaseCsv';

import {SupplierReferenceHeader,SupplierAvatar,SupplierBalance,SupplierDirectoryCard,SupplierForm,SupplierPaymentForm,SupplierPurchaseCard,SupplierPaymentCard} from './SupplierReferenceParts';
import {SupplierCurrencyContext} from './SupplierCurrencyContext';
import {SUPPLIER_MESSAGES} from './supplierLocale';
const PAGE_SIZE = 20;


function fieldErrorsFrom(error) {
  return Object.fromEntries(Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [
    field,
    Array.isArray(messages) ? messages[0] : String(messages),
  ]));
}

export function SuppliersScreen(props) { return <ModuleLocalizationBoundary messages={{...REMAINING_PAGE_MESSAGES,...SUPPLIER_MESSAGES}} patterns={REMAINING_PAGE_PATTERNS}><SupplierCurrencyContext.Provider value={props.session?.business?.currency||'Ks'}><SuppliersScreenContent {...props} /></SupplierCurrencyContext.Provider></ModuleLocalizationBoundary>; }

function SuppliersScreenContent({ pathname, onNavigate, session }) {
  const money=value=>formatMoney(value,session?.business?.currency||'Ks');
  const [localPathname, setLocalPathname] = useState('/suppliers');
  const currentPathname = pathname || localPathname;
  const page = useMemo(() => supplierPageFromPath(currentPathname), [currentPathname]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [form, setForm] = useState(blankSupplierForm());
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [notice, setNotice] = useState(null);
  const [deleteSupplier, setDeleteSupplier] = useState(null);
  const [actionSupplier, setActionSupplier] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError,setDeleteError]=useState('');
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [filteredStats, setFilteredStats] = useState({ purchase_count: 0, total_purchase: 0 });
  const [draftHistoryFilters, setDraftHistoryFilters] = useState(blankSupplierHistoryFilters());
  const [appliedHistoryFilters, setAppliedHistoryFilters] = useState(blankSupplierHistoryFilters());
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(blankSupplierPaymentForm());
  const [paymentErrors, setPaymentErrors] = useState({});
  const [actionPayment, setActionPayment] = useState(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [exportOpen, setExportOpen] = useState(false), [exportBusy, setExportBusy] = useState(false), [exportError, setExportError] = useState('');
  const exporting = useRef(false);
  const [directoryFilters,setDirectoryFilters]=useState({account_status:'all',sort:'name'});
  const [directoryDraft,setDirectoryDraft]=useState({account_status:'all',sort:'name'});
  const [directoryOpen,setDirectoryOpen]=useState(false);
  const working=useRef(false);
  const [historyError,setHistoryError]=useState('');
  const [paymentSearch,setPaymentSearch]=useState('');
  const [paymentQuery,setPaymentQuery]=useState('');
  const [paymentFilters,setPaymentFilters]=useState({direction:'all',payment_method:''});
  const [paymentDraft,setPaymentDraft]=useState({direction:'all',payment_method:''});
  const [paymentFiltersOpen,setPaymentFiltersOpen]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setPaymentQuery(paymentSearch.trim()),250);return()=>clearTimeout(timer);},[paymentSearch]);

  function navigateTo(path, options = {}) {
    if (onNavigate) onNavigate(path, options);
    else setLocalPathname(path);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSupplierPage = useCallback(({ limit, offset, signal }) => {
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if(directoryFilters.account_status!=='all')params.set('account_status',directoryFilters.account_status);
    if(directoryFilters.sort!=='name')params.set('sort',directoryFilters.sort);
    return apiRequest(`/suppliers?${params}`, { signal });
  }, [debouncedSearch,directoryFilters]);
  const supplierList = useEndlessList({
    loadPage: loadSupplierPage,
    queryKey: JSON.stringify([debouncedSearch,directoryFilters]),
    pageSize: PAGE_SIZE,
    enabled: page.kind === 'list',
  });

  const loadHistoryPage = useCallback(async ({ limit, offset, signal }) => {
    if (!page.supplierId) return { items: [], total: 0 };
    const response = await apiRequest(supplierHistoryPath(page.supplierId, appliedHistoryFilters, limit, offset), { signal });
    setDetailSupplier({ ...(response.supplier || {}), ...(response.summary || {}) });
    setFilteredStats(response.filtered_stats || { purchase_count: response.total || 0, total_purchase: 0 });
    return { items: response.purchases || [], total: response.total || 0 };
  }, [appliedHistoryFilters, page.supplierId]);
  const historyList = useEndlessList({
    loadPage: loadHistoryPage,
    queryKey: JSON.stringify([page.supplierId, appliedHistoryFilters]),
    pageSize: PAGE_SIZE,
    enabled: page.kind === 'detail',
  });

  const loadPaymentPage = useCallback(({ limit, offset, signal }) => {
    if (!page.supplierId) return Promise.resolve({ items: [], total: 0 });
    return apiRequest(supplierPaymentHistoryPath(page.supplierId, limit, offset,{...paymentFilters,q:paymentQuery}), { signal });
  }, [page.supplierId,paymentFilters,paymentQuery]);
  const paymentList = useEndlessList({ loadPage: loadPaymentPage, queryKey: JSON.stringify([page.supplierId,paymentFilters,paymentQuery]), pageSize: PAGE_SIZE, enabled: page.kind === 'detail' });

  function exportSuppliers() {
    const params = new URLSearchParams(); if (debouncedSearch) params.set('q', debouncedSearch);
    if(directoryFilters.account_status!=='all')params.set('account_status',directoryFilters.account_status);
    if(directoryFilters.sort!=='name')params.set('sort',directoryFilters.sort);
    return exportFilteredCsv({ path: `/suppliers${params.toString() ? `?${params}` : ''}`, filename: csvFilename('suppliers'), columns: [
      { label: 'Name', value: (row) => row.name }, { label: 'Phone', value: (row) => row.phone || '' }, { label: 'Contact Person', value: (row) => row.contact_person || '' },
      { label: 'Address', value: (row) => row.address || '' }, { label: 'Purchases', value: (row) => row.purchase_count || 0 }, { label: 'Balance', value: (row) => row.balance || 0 },
      { label: 'Last Purchase', value: (row) => row.last_purchase || '' }, { label: 'Note', value: (row) => row.note || '' },
    ] });
  }

  async function allSupplierPurchases() {
    const rows = []; let offset = 0; let total = 0;
    do {
      const response = await apiRequest(supplierHistoryPath(page.supplierId, appliedHistoryFilters, 100, offset));
      const batch = response.purchases || []; rows.push(...batch); total = Number(response.total || 0); offset += batch.length;
      if (!batch.length) break;
    } while (rows.length < total);
    return rows;
  }

  function exportSupplierPurchases() {
    return exportFilteredCsv({ loadRows: async () => expandPurchaseLineItems(await allSupplierPurchases()), filename: csvFilename(`supplier-${page.supplierId}-purchases`), columns: PURCHASE_LINE_COLUMNS });
  }

  function exportSupplierPayments() {
    return exportFilteredCsv({ path: supplierPaymentHistoryPath(page.supplierId,undefined,undefined,{...paymentFilters,q:paymentQuery}), filename: csvFilename(`supplier-${page.supplierId}-payments`), columns: [
      { label: 'Date', value: (row) => row.created_at }, { label: 'Direction', value: (row) => row.direction === 'supplier_to_shop' ? 'Supplier refunds shop' : 'Shop pays supplier' },
      { label: 'Method', value: (row) => row.payment_method || 'Cash' }, { label: 'Amount', value: (row) => row.amount }, { label: 'Note', value: (row) => row.note || '' },
    ] });
  }

  const loadSupplierPaymentRoute = useCallback(async (supplierId, paymentId, signal) => {
    const response = await apiRequest(`/suppliers/${supplierId}?limit=1&offset=0`, signal ? { signal } : undefined);
    setDetailSupplier({ ...(response.supplier || response), ...(response.summary || {}) });
    if (paymentId) {
      const payment = await apiRequest(`/supplier-payments/${paymentId}`, signal ? { signal } : undefined);
      if(Number(payment.supplier_id)!==Number(supplierId))throw new Error('This payment belongs to another supplier.');
      setPaymentForm({ direction: payment.direction || 'shop_to_supplier', payment_method: payment.payment_method || 'Cash', amount: payment.amount || '', note: payment.note || '', created_at:payment.created_at });
    } else setPaymentForm(blankSupplierPaymentForm());
    setPaymentErrors({});
  }, []);

  const loadEditingSupplier = useCallback(async (supplierId, signal) => {
    const response = await apiRequest(`/suppliers/${supplierId}?limit=1&offset=0`, signal ? { signal } : undefined);
    const supplier = response.supplier || response;
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      contact_person: supplier.contact_person || '',
      address: supplier.address || '',
      note: supplier.note || '',
    });
    setFormErrors({});
    return supplier;
  }, []);

  useEffect(() => {
    setRouteError('');
    if (page.kind === 'new') {
      setEditingId(null);
      setForm(blankSupplierForm());
      setFormErrors({});
      setRouteLoading(false);
      return undefined;
    }
    if (page.kind === 'payment-new' || page.kind === 'payment-edit') {
      const controller = new AbortController();
      setRouteLoading(true);
      loadSupplierPaymentRoute(page.supplierId, page.paymentId, controller.signal)
        .catch((error) => { if (!controller.signal.aborted) setRouteError(error.message || 'Cannot load supplier account.'); })
        .finally(() => { if (!controller.signal.aborted) setRouteLoading(false); });
      return () => controller.abort();
    }
    if (page.kind !== 'edit') {
      setRouteLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    loadEditingSupplier(page.supplierId, controller.signal)
      .catch((error) => {
        if (!controller.signal.aborted) setRouteError(error.message || 'Cannot load this supplier.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });
    return () => controller.abort();
  }, [loadEditingSupplier, loadSupplierPaymentRoute, page.kind, page.paymentId, page.supplierId]);

  usePageRefresh(() => {
    if (page.kind === 'list') return supplierList.reload();
    if (page.kind === 'detail') return Promise.all([historyList.reload(), paymentList.reload()]);
    if (page.kind === 'edit') return loadEditingSupplier(page.supplierId);
    if (page.kind === 'payment-new' || page.kind === 'payment-edit') return loadSupplierPaymentRoute(page.supplierId, page.paymentId);
    return Promise.resolve();
  });

  function openNew() {
    setForm(blankSupplierForm());
    setFormErrors({});
    navigateTo('/suppliers/new');
  }

  function openEdit(supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || '', phone: supplier.phone || '', contact_person: supplier.contact_person || '',
      address: supplier.address || '', note: supplier.note || '',
    });
    setFormErrors({});
    navigateTo(`/suppliers/${supplier.id}/edit`);
  }

  async function saveSupplier(event) {
    event.preventDefault();
    if(working.current)return;
    const payload = supplierPayload(form);
    if (!payload.name) {
      setFormErrors({ name: 'Supplier name is required.' });
      return;
    }
    working.current=true; setSaving(true);
    setFormErrors({});
    try {
      const supplier = await apiRequest(editingId ? `/suppliers/${editingId}` : '/suppliers', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if(!editingId)setForm(blankSupplierForm());
      setNotice({ type: 'success', text: editingId ? 'Supplier updated.' : 'Supplier created.' });
      navigateTo(`/suppliers/${supplier.id}`, { replace: true });
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFormErrors(Object.keys(errors).length ? errors : { general: error.message });
    } finally {
      working.current=false; setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteSupplier||deleting) return;
    setDeleteError('');setDeleting(true);
    try {
      await apiRequest(`/suppliers/${deleteSupplier.id}`, { method: 'DELETE' });
      setDeleteSupplier(null);
      setNotice({ type: 'success', text: 'Supplier deleted. Existing purchase history was preserved.' });
      navigateTo('/suppliers', { replace: true });
      await supplierList.reload();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeleting(false);
    }
  }

  async function saveSupplierPayment(event) {
    event.preventDefault();
    if(working.current)return;
    const payload = supplierPaymentPayload(paymentForm, page.supplierId);
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) { setPaymentErrors({ amount: 'Enter an amount greater than zero.' }); return; }
    working.current=true; setSaving(true); setPaymentErrors({});
    try {
      await apiRequest(page.kind === 'payment-edit' ? `/supplier-payments/${page.paymentId}` : `/suppliers/${page.supplierId}/payments`, { method: page.kind === 'payment-edit' ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      if(page.kind==='payment-new')setPaymentForm(blankSupplierPaymentForm());
      setNotice({ type: 'success', text: page.kind === 'payment-edit' ? 'Supplier movement updated.' : 'Supplier movement recorded.' });
      navigateTo(`/suppliers/${page.supplierId}`, { replace: true });
    } catch (error) {
      const errors = fieldErrorsFrom(error); setPaymentErrors(Object.keys(errors).length ? errors : { general: error.message });
    } finally { working.current=false; setSaving(false); }
  }

  async function confirmDeletePayment() {
    if (!deletePaymentTarget||deleting) return;
    setDeleteError('');setDeleting(true);
    try {
      await apiRequest(`/supplier-payments/${deletePaymentTarget.id}`, { method: 'DELETE' });
      setDeletePaymentTarget(null);
      setNotice({ type: 'success', text: 'Supplier movement deleted and balance recalculated.' });
      if(page.kind==='payment-edit')navigateTo(`/suppliers/${page.supplierId}`,{replace:true});
      else await Promise.all([paymentList.reload(), historyList.reload()]);
    } catch (error) { setDeleteError(error.message); }
    finally { setDeleting(false); }
  }

  function applyHistoryFilters(event) {
    event.preventDefault();
    if (draftHistoryFilters.date_from && draftHistoryFilters.date_to && draftHistoryFilters.date_from > draftHistoryFilters.date_to) {
      setHistoryError('The start date must be before the end date.');
      return;
    }
    setHistoryError('');
    setAppliedHistoryFilters({ ...draftHistoryFilters });
    setHistoryFiltersOpen(false);
  }

  const backToSupplier=()=>{if(!working.current)navigateTo(`/suppliers/${page.supplierId}`,{back:true});};
  const backToDirectory=()=>{if(!working.current)navigateTo('/suppliers',{back:true});};
  async function runSupplierExport(kind) {
    if (exporting.current || !detailSupplier) return;
    exporting.current = true; setExportBusy(true); setExportError('');
    const supplier = detailSupplier;
    try {
      const count = await (kind === 'statement' ? exportFilteredCsv({loadRows:async()=>{const statement=await apiRequest(`/suppliers/${supplier.id}/statement`);return [...(statement.purchases||[]).map(p=>({...p,type:'Purchase',amount:p.credit_amount})),...(statement.payments||[]).map(p=>({...p,type:p.direction}))];},filename:csvFilename(`supplier-${supplier.id}-statement`),columns:[{label:'Type',value:r=>r.type},{label:'Date',value:r=>r.created_at},{label:'Amount',value:r=>r.amount},{label:'Note',value:r=>r.note||''}]}) : kind === 'purchases' ? exportSupplierPurchases() : exportSupplierPayments());
      setExportOpen(false); setNotice({type:'success',text:`Exported ${count} matching record${count === 1 ? '' : 's'}.`});
    } catch (error) { setExportError(error.message); }
    finally { exporting.current = false; setExportBusy(false); }
  }
  function supplierActions(){return <><MobileSheet className="mobile-sheet--action-menu" open={Boolean(actionSupplier)} title="Supplier actions" description={actionSupplier?.name||''} onClose={()=>setActionSupplier(null)}><div className="mobile-action-menu"><Button variant="plain" type="button" aria-label="View details" onClick={()=>{const item=actionSupplier;setActionSupplier(null);navigateTo(`/suppliers/${item.id}`);}}><Eye size={19}/><span>View details</span><ChevronRight size={18}/></Button><Button variant="plain" type="button" aria-label="Edit" onClick={()=>{const item=actionSupplier;setActionSupplier(null);openEdit(item);}}><Edit3 size={19}/><span>Edit</span><ChevronRight size={18}/></Button><Button variant="danger-ghost" type="button" className="danger-action" aria-label="Delete" onClick={()=>{setDeleteError('');setDeleteSupplier(actionSupplier);setActionSupplier(null);}}><Trash2 size={19}/><span>Delete</span><ChevronRight size={18}/></Button></div></MobileSheet><MobileDeleteSheet open={Boolean(deleteSupplier)} title="Delete supplier?" description="Existing purchase history will remain linked and available in reports." itemTitle={deleteSupplier?.name} itemDescription="Only the supplier directory entry will be removed." confirmLabel="Delete supplier" busy={deleting} onClose={()=>!deleting&&setDeleteSupplier(null)} onConfirm={confirmDelete}>{deleteError&&<p role="alert">{deleteError}</p>}</MobileDeleteSheet></>;}
  const paymentRoute=page.kind==='payment-new'||page.kind==='payment-edit';
  const editRoute=page.kind==='edit';
  if(paymentRoute||editRoute||page.kind==='new'){
    const title=paymentRoute?(page.kind==='payment-edit'?'Edit payment':'New payment'):(editRoute?'Edit supplier':'New supplier');
    const cancel=paymentRoute||editRoute?backToSupplier:backToDirectory;
    const retry=()=>{setRouteError('');setRouteLoading(true);Promise.resolve(paymentRoute?loadSupplierPaymentRoute(page.supplierId,page.paymentId):loadEditingSupplier(page.supplierId)).catch(e=>setRouteError(e.message)).finally(()=>setRouteLoading(false));};
    return <main className="supplier-page supplier-form-page supplier-reference-page"><SupplierReferenceHeader title={title} onBack={cancel} busy={saving} onDelete={page.kind==='payment-edit'?()=>setDeletePaymentTarget({id:page.paymentId,amount:paymentForm.amount,note:paymentForm.note}):undefined}/><MobileNotice notice={notice} onClose={()=>setNotice(null)}/>{routeLoading||(editRoute&&editingId!==page.supplierId&&!routeError)?<div className="supplier-detail-skeleton" role="status" aria-label="Loading supplier"><span/><span/></div>:routeError?<div className="endless-first-error"><p role="alert">{routeError}</p><Button variant="plain" type="button" onClick={retry}>Try again</Button></div>:paymentRoute?<SupplierPaymentForm supplier={detailSupplier} editing={page.kind==='payment-edit'} form={paymentForm} errors={paymentErrors} saving={saving} onChange={(key,value)=>{setPaymentForm(current=>({...current,[key]:value}));setPaymentErrors(current=>({...current,[key]:''}));}} onCancel={cancel} onSubmit={saveSupplierPayment}/>:<SupplierForm editing={editRoute} form={form} errors={formErrors} saving={saving} onChange={(key,value)=>{setForm(current=>({...current,[key]:value}));setFormErrors(current=>({...current,[key]:''}));}} onCancel={cancel} onSubmit={saveSupplier}/>}<MobileDeleteSheet open={Boolean(deletePaymentTarget)} title="Delete account movement?" description="The supplier balance and reports will be recalculated." itemTitle={money(deletePaymentTarget?.amount||0)} confirmLabel="Delete movement" busy={deleting} onClose={()=>!deleting&&setDeletePaymentTarget(null)} onConfirm={confirmDeletePayment}>{deleteError&&<p role="alert">{deleteError}</p>}</MobileDeleteSheet></main>;
  }
  if(page.kind==='detail'){
    const supplier=detailSupplier;
    return <main className="supplier-page supplier-detail-page supplier-reference-page"><SupplierReferenceHeader actions={supplier && <IconButton variant="ghost" type="button" aria-label="Export CSV" title="Export CSV" onClick={()=>{setExportError('');setExportOpen(true);}}><Download size={20} aria-hidden="true"/></IconButton>} title={supplier?.name||'Supplier'} onBack={backToDirectory}/><MobileSheet className="mobile-sheet--action-menu" open={exportOpen} title="Export supplier data" description={supplier?.name||''} onClose={()=>{if(!exporting.current)setExportOpen(false);}}>{exportBusy&&<p role="status">Exporting...</p>}{exportError&&<p role="alert" className="mobile-notice mobile-notice--error">{exportError}</p>}<div className="mobile-action-menu">{[['statement','Statement',FileText],['purchases','Export supplier purchases',Truck],['payments','Export supplier payments',HandCoins]].map(([kind,label,Icon])=><Button variant="plain" type="button" key={kind} disabled={exportBusy} onClick={()=>runSupplierExport(kind)}><Icon size={19} aria-hidden="true"/><span>{label}</span><Download size={18} aria-hidden="true"/></Button>)}</div><Button variant="secondary" type="button" className="mobile-secondary" disabled={exportBusy} onClick={()=>setExportOpen(false)}>Cancel</Button></MobileSheet><MobileNotice notice={notice} onClose={()=>setNotice(null)}/>{supplier&&<><section className="supplier-profile-card customer-profile-card" aria-label="Supplier profile"><SupplierAvatar name={supplier.name} className="customer-reference-avatar"/><div className="customer-profile-identity"><strong data-no-localize>{supplier.name}</strong>{supplier.contact_person&&<span><Users size={14} aria-hidden="true"/><span data-no-localize>{supplier.contact_person}</span></span>}<span><Phone size={14} aria-hidden="true"/><span data-no-localize>{supplier.phone||'No phone number'}</span></span>{supplier.address&&<span><MapPin size={14} aria-hidden="true"/><span data-no-localize>{supplier.address}</span></span>}{supplier.note&&<span className="customer-profile-note"><span>Note</span><span data-no-localize>{supplier.note}</span></span>}</div></section><section className="supplier-reference-panel supplier-reference-account"><SupplierBalance balance={supplier.balance}/><div className="supplier-detail-primary-actions"><Button variant="primary" type="button" className="mobile-primary" onClick={()=>navigateTo(`/suppliers/${supplier.id}/payments/new`)}><CreditCard size={16}/>Pay</Button><Button variant="secondary" type="button" className="mobile-secondary" aria-label="Edit supplier" onClick={()=>openEdit(supplier)}><Edit3 size={16}/>Edit</Button><Button variant="danger-ghost" type="button" className="supplier-delete-action" aria-label="Delete supplier" onClick={()=>{setDeleteError('');setDeleteSupplier(supplier);}}><Trash2 size={16} aria-hidden="true"/>Delete</Button></div><details className="supplier-account-breakdown"><summary>Account summary</summary><div className="supplier-account-summary"><span><small>Total purchases</small><strong>{money(supplier.total_purchase||0)}</strong></span><span><small>Last purchase</small><strong>{supplier.last_purchase?supplierDate(supplier.last_purchase):'No purchases'}</strong></span><span><small>Credit purchases</small><strong>{money(supplier.credit_purchase_total||0)}</strong></span><span><small>Paid to supplier</small><strong>{money(supplier.paid_total||0)}</strong></span><span><small>Supplier refunds</small><strong>{money(supplier.refund_total||0)}</strong></span></div></details></section></>}
    <nav className="transaction-tabs supplier-detail-tabs" aria-label="Supplier detail sections"><Button variant="plain" type="button" role="tab" aria-selected={detailTab==='overview'} className={detailTab==='overview'?'is-active':''} onClick={()=>setDetailTab('overview')}>Purchases{historyList.total!==null?` (${historyList.total})`:''}</Button><Button variant="plain" type="button" role="tab" aria-selected={detailTab==='payments'} className={detailTab==='payments'?'is-active':''} onClick={()=>setDetailTab('payments')}>Payment records{paymentList.total!==null?` (${paymentList.total})`:''}</Button></nav>
    <div hidden={detailTab!=='overview'}><div className="supplier-reference-history-controls"><SearchInput className="mobile-search" aria-label="Search supplier purchase history" value={draftHistoryFilters.q} onChange={e=>{const q=e.target.value;setDraftHistoryFilters(current=>({...current,q}));setAppliedHistoryFilters(current=>({...current,q}));}} placeholder="Search purchases" type="text" onClear={()=>{setDraftHistoryFilters(current=>({...current,q:''}));setAppliedHistoryFilters(current=>({...current,q:''}));}} clearLabel="Clear purchase history search" /><MobileFilterToggle open={historyFiltersOpen} onToggle={()=>{setHistoryError('');setDraftHistoryFilters({...appliedHistoryFilters});setHistoryFiltersOpen(true);}} controls="supplier-history-filters" count={[appliedHistoryFilters.date_from,appliedHistoryFilters.date_to].filter(Boolean).length}/></div>
    <MobileFilterPanel open={historyFiltersOpen} onClose={()=>setHistoryFiltersOpen(false)} id="supplier-history-filters" className="supplier-history-filters" onSubmit={applyHistoryFilters}>{historyError&&<p role="alert" className="shop-mobile-error">{historyError}</p>}<MobileField id="supplier-history-from" label="From"><Input id="supplier-history-from" type="date" value={draftHistoryFilters.date_from} onChange={e=>setDraftHistoryFilters(current=>({...current,date_from:e.target.value}))}/></MobileField><MobileField id="supplier-history-to" label="To"><Input id="supplier-history-to" type="date" value={draftHistoryFilters.date_to} onChange={e=>setDraftHistoryFilters(current=>({...current,date_to:e.target.value}))}/></MobileField><div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={()=>{const next={...blankSupplierHistoryFilters(),q:appliedHistoryFilters.q};setDraftHistoryFilters(next);setAppliedHistoryFilters(next);setHistoryError('');}}>Reset</MobileFilterResetButton><Button variant="primary" type="submit" className="mobile-primary">Apply filters</Button></div></MobileFilterPanel>
    <div className="supplier-history-total"><span>Matching purchases<strong>{filteredStats.purchase_count??historyList.total??0}</strong></span><span>Purchase value<strong>{money(filteredStats.total_purchase||0)}</strong></span></div>{historyList.initialLoading?<div className="supplier-detail-skeleton" role="status"><span/><span/></div>:historyList.error&&!historyList.items.length?<div className="endless-first-error"><p role="alert">Cannot load supplier. {historyList.error}</p><Button variant="plain" type="button" onClick={historyList.retry}>Try again</Button></div>:historyList.items.length?<><div className="supplier-history-list">{historyList.items.map(p=><SupplierPurchaseCard key={p.id} purchase={p} onOpen={()=>navigateTo(`/purchases/${p.id}`)}/>)}</div><EndlessListFooter list={historyList} count={historyList.items.length} noun="purchases"/></>:<div className="mobile-empty-state"><Truck size={26}/><h2>No purchase history</h2><p>This supplier has no purchases matching the current filters.</p></div>}</div>
    <section hidden={detailTab!=='payments'} className="supplier-payment-tab"><div className="supplier-reference-history-controls"><SearchInput className="mobile-search" aria-label="Search payment records" placeholder="Search payment records" value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)} type="text" onClear={()=>setPaymentSearch('')} clearLabel="Clear payment search" /><MobileFilterToggle open={paymentFiltersOpen} onToggle={()=>{setPaymentDraft({...paymentFilters});setPaymentFiltersOpen(true);}} controls="supplier-payment-filters" count={(paymentFilters.direction!=='all'?1:0)+(paymentFilters.payment_method?1:0)}/></div><MobileFilterPanel open={paymentFiltersOpen} onClose={()=>setPaymentFiltersOpen(false)} id="supplier-payment-filters" onSubmit={e=>{e.preventDefault();setPaymentFilters({...paymentDraft});setPaymentFiltersOpen(false);}}><MobileField id="supplier-payment-filter-direction" label="Payment direction"><Select id="supplier-payment-filter-direction" value={paymentDraft.direction} onChange={e=>setPaymentDraft(current=>({...current,direction:e.target.value}))}><option value="all">All</option><option value="shop_to_supplier">Shop pays supplier</option><option value="supplier_to_shop">Supplier refunds shop</option></Select></MobileField><MobileField id="supplier-payment-filter-method" label="Payment method"><Select id="supplier-payment-filter-method" value={paymentDraft.payment_method} onChange={e=>setPaymentDraft(current=>({...current,payment_method:e.target.value}))}><option value="">All</option>{['Cash','Banking Pay','Wallet Pay','KPay','Wave Pay'].map(method=><option key={method}>{method}</option>)}</Select></MobileField><div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={()=>{const next={direction:'all',payment_method:''};setPaymentDraft(next);setPaymentFilters(next);}}>Reset</MobileFilterResetButton><Button variant="primary" type="submit" className="mobile-primary">Apply filters</Button></div></MobileFilterPanel><div className="mobile-list-heading"><h2>Payment records</h2></div>{paymentList.initialLoading?<p role="status">Loading payment records...</p>:paymentList.error&&!paymentList.items.length?<div className="endless-first-error"><p role="alert">{paymentList.error}</p><Button variant="plain" type="button" onClick={paymentList.retry}>Try again</Button></div>:paymentList.items.length?<><div className="supplier-payment-list">{paymentList.items.map(payment=><SupplierPaymentCard key={payment.id} payment={payment} onActions={()=>setActionPayment(payment)}/>)}</div><EndlessListFooter list={paymentList} count={paymentList.items.length} noun="payment records"/></>:<div className="mobile-empty-state"><HandCoins size={26}/><h2>No payment records</h2><p>Payments and supplier refunds will appear here.</p></div>}</section>
    <MobileSheet className="mobile-sheet--action-menu" open={Boolean(actionPayment)} title="Account movement" description={actionPayment?money(actionPayment.amount):''} onClose={()=>setActionPayment(null)}><div className="mobile-action-menu"><Button variant="plain" type="button" onClick={()=>{const payment=actionPayment;setActionPayment(null);navigateTo(`/suppliers/${supplier.id}/payments/${payment.id}/edit`);}}><Edit3 size={19}/><span>Edit movement</span><ChevronRight size={18}/></Button><Button variant="danger-ghost" type="button" className="danger-action" onClick={()=>{setDeleteError('');setDeletePaymentTarget(actionPayment);setActionPayment(null);}}><Trash2 size={19}/><span>Delete movement</span><ChevronRight size={18}/></Button></div></MobileSheet><MobileDeleteSheet open={Boolean(deletePaymentTarget)} title="Delete account movement?" description="The supplier balance and reports will be recalculated." itemTitle={money(deletePaymentTarget?.amount||0)} itemDescription={deletePaymentTarget?.note||'No note'} confirmLabel="Delete movement" busy={deleting} onClose={()=>!deleting&&setDeletePaymentTarget(null)} onConfirm={confirmDeletePayment}>{deleteError&&<p role="alert">{deleteError}</p>}</MobileDeleteSheet>{supplierActions()}</main>;
  }
  return <main className="supplier-page supplier-index-page supplier-reference-page has-create-fab"><SupplierReferenceHeader actions={<CsvExportButton compact onExport={exportSuppliers} onNotice={setNotice}/>} title="Suppliers" onNew={openNew}/><MobileNotice notice={notice} onClose={()=>setNotice(null)}/><section className="supplier-controls"><SearchInput className="mobile-search" aria-label="Search suppliers" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search suppliers" type="text" onClear={()=>setSearch('')} clearLabel="Clear supplier search" /><MobileFilterToggle open={directoryOpen} onToggle={()=>{setDirectoryDraft({...directoryFilters});setDirectoryOpen(true);}} controls="supplier-directory-filters" count={(directoryFilters.account_status!=='all'?1:0)+(directoryFilters.sort!=='name'?1:0)}/></section><div className="mobile-list-heading"><span>{supplierList.total??supplierList.items.length} suppliers</span></div><MobileFilterPanel open={directoryOpen} onClose={()=>setDirectoryOpen(false)} id="supplier-directory-filters" className="supplier-directory-filters" onSubmit={e=>{e.preventDefault();setDirectoryFilters({...directoryDraft});setDirectoryOpen(false);}}><ChoiceGroup className="supplier-account-choices"><legend>Account state</legend>{[['all','All'],['payable','Shop owes supplier'],['credit','Supplier owes shop'],['settled','Settled']].map(([key,label])=><label key={key} className={directoryDraft.account_status===key?'is-selected':''}><Radio type="radio" name="supplier-account-state" checked={directoryDraft.account_status===key} onChange={()=>setDirectoryDraft(current=>({...current,account_status:key}))}/><span>{label}</span></label>)}</ChoiceGroup><MobileField id="supplier-sort" label="Sort by"><Select id="supplier-sort" value={directoryDraft.sort} onChange={e=>setDirectoryDraft(current=>({...current,sort:e.target.value}))}><option value="name">Name</option><option value="name_desc">Name (Z to A)</option></Select></MobileField><div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={()=>{const next={account_status:'all',sort:'name'};setDirectoryDraft(next);setDirectoryFilters(next);}}>Reset</MobileFilterResetButton><Button variant="primary" type="submit" className="mobile-primary">Apply filters</Button></div></MobileFilterPanel>{supplierList.initialLoading?<div className="supplier-card-list" role="status" aria-label="Loading suppliers">{[1,2,3].map(key=><div className="supplier-card supplier-card--skeleton" key={key}><span/><span/></div>)}</div>:supplierList.error&&!supplierList.items.length?<div className="endless-first-error"><p role="alert">Cannot load suppliers. {supplierList.error}</p><Button variant="plain" type="button" onClick={supplierList.retry}>Try again</Button></div>:supplierList.items.length?<><div className="supplier-card-list">{supplierList.items.map(supplier=><SupplierDirectoryCard key={supplier.id} supplier={supplier} onOpen={()=>navigateTo(`/suppliers/${supplier.id}`)} onMenu={()=>setActionSupplier(supplier)}/>)}</div><EndlessListFooter list={supplierList} count={supplierList.items.length} noun="suppliers"/></>:<div className="mobile-empty-state"><Users size={28}/><h2>No suppliers found</h2><p>{debouncedSearch?'Try another name, phone number or contact.':'Add your first supplier to keep purchasing contacts organized.'}</p>{!debouncedSearch&&<Button variant="primary" type="button" className="mobile-primary" onClick={openNew}>New supplier</Button>}</div>}{supplierActions()}</main>;
}
