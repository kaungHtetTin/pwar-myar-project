import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { FloatingActionButton, ChoiceGroup, Button, FieldShell, IconButton, Input, Radio, SearchInput, Select } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CircleAlert, ChevronRight, ChevronDown, Edit3, EllipsisVertical, Eye, Package, Plus, RefreshCw, Search, Store, Trash2, Truck, X } from 'lucide-react';
import { apiRequest } from '../api/client';
import { MobileDeleteSheet, MobileFilterPanel, MobileFilterToggle, MobileSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { useLocale } from '../localization/LocaleContext';
import { printHtmlDocument } from '../utils/printing';
import { PurchaseReferenceForm } from './PurchaseReferenceForm';
import { PurchaseDateInput, PurchaseReferenceHeader } from './PurchaseReferenceParts';
import { PurchaseReferenceDetail } from './PurchaseReferenceDetail';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { money, stockWithUnit } from '../products/productUtils';
import {
  blankPurchaseFilters,
  blankPurchaseForm,
  buildPurchaseLine,
  dateRangeError,
  itemCostWarnings,
  presetDateFromTo,
  purchaseHistoryPath,
  purchasePageFromPath,
  purchasePaymentAmounts,
  purchasePayload,
  purchaseTotals,
  purchaseUnitFor,
  purchaseUnitOptions,
  recalculatePurchaseLine,
} from './purchaseUtils';
import { PURCHASE_MESSAGES, PURCHASE_PATTERNS } from './purchasesLocale';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { loadPurchaseLineItems, PURCHASE_LINE_COLUMNS } from './purchaseCsv';

const PAGE_SIZE = 20;
const PURCHASE_PAYMENT_METHODS = ['Cash', 'Banking Pay', 'Wallet Pay', 'KPay', 'Wave Pay'];

function openNativeDatePicker(event) {
  const input = event.currentTarget.querySelector('input[type="date"]');
  if (!input) return;
  if (event.target !== input) event.preventDefault();
  input.focus({ preventScroll: true });
  try {
    input.showPicker?.();
  } catch {
    // Focusing preserves native date entry where showPicker is unavailable.
  }
}

function Field({ label, error, hint, children }) {
  return <FieldShell as="label" className="mobile-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}{error && <small className="mobile-field-error" role="alert">{error}</small>}</FieldShell>;
}

function Sheet(props) { return <MobileSheet {...props} />; }

function EndlessFooter({ list, count, noun }) {
  return (
    <div className="endless-list-footer" ref={list.sentinelRef}>
      {list.loadingMore && <p role="status"><RefreshCw className="spin" size={17} />Loading more {noun}…</p>}
      {list.error && count > 0 && <div className="endless-list-error"><span>{list.error}</span><Button variant="plain" type="button" onClick={list.retry}>Try again</Button></div>}
      {list.hasMore && !list.loadingMore && !list.error && !list.observerSupported && <Button variant="secondary" className="mobile-secondary" type="button" onClick={list.loadMore}>Load more</Button>}
      {!list.hasMore && count > 0 && <p className="endless-list-end">You’re all caught up · {count} {noun}</p>}
    </div>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`mobile-notice mobile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Dismiss message" onClick={onClose}><X size={17} /></IconButton></div>;
}

function SupplierPicker({ value, supplierId, supplier, compact, onChange, onSelect, onNew }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(pickerSearch.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [pickerSearch]);
  const loadPage = useCallback(({ limit, offset, signal }) => {
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    if (debounced) params.set('q', debounced);
    return apiRequest(`/suppliers?${params}`, { signal });
  }, [debounced]);
  const list = useEndlessList({ loadPage, queryKey: debounced, pageSize: 12, enabled: open });

  if (supplierId && !open) return <Button variant="plain" className={`purchase-supplier-selection${compact ? ' is-compact' : ''}`} type="button" aria-label="Change supplier" onClick={() => { setSelected(supplier || null); setPickerSearch(''); setOpen(true); }}>{!compact && <Store size={24} />}<span><strong data-no-localize>{value}</strong>{!compact && <><small data-no-localize>{supplier?.address?.split('\n').at(-1)}</small><small data-no-localize>{supplier?.phone}</small></>}</span><ChevronDown size={19} /></Button>;
  return (
    <div className="purchase-supplier-picker">
      <Input aria-label="Supplier" value={value} onFocus={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} placeholder="Search or type supplier" autoComplete="off" />
      {supplierId && <small className="purchase-selected-hint">Linked supplier selected</small>}
      <Sheet open={open} title="Select supplier" onClose={() => setOpen(false)} className="purchase-supplier-sheet">
        <div className="purchase-supplier-sheet-content"><SearchInput className="mobile-search" aria-label="Search suppliers" value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} placeholder="Search suppliers by name or phone" type="text" />
          {list.initialLoading ? <p className="mobile-inline-loading" role="status"><RefreshCw className="spin" size={16} />Loading suppliers...</p> : list.items.map(item => <label className={`purchase-supplier-choice${selected?.id === item.id ? ' is-selected' : ''}`} key={item.id}><Store size={23} /><span><strong data-no-localize>{item.name}</strong>{item.address && <small data-no-localize>{item.address.split('\n').at(-1)}</small>}{item.phone && <small data-no-localize>{item.phone}</small>}</span><Radio type="radio" name="purchase-supplier-choice" checked={selected?.id === item.id} onChange={() => setSelected(item)} /></label>)}
          {list.error && <div className="endless-first-error"><p>{list.error}</p><Button variant="plain" type="button" onClick={list.retry}>Try again</Button></div>}
          {!list.initialLoading && !list.error && !list.items.length && <p className="mobile-inline-empty">No matching supplier. The typed name can still be used.</p>}
          {(list.hasMore || list.loadingMore || list.error) && <EndlessFooter list={list} count={list.items.length} noun="suppliers" />}
          {onNew && <label className="purchase-supplier-choice purchase-supplier-add"><Plus size={18} /><span>Add new supplier</span><Radio type="radio" name="purchase-supplier-choice" checked={Boolean(selected?.newSupplier)} onChange={() => setSelected({ newSupplier: true })} /></label>}
          <div className="purchase-supplier-sheet-actions"><Button variant="secondary" className="mobile-secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" className="mobile-primary" type="button" disabled={!selected} onClick={() => { if (selected.newSupplier) onNew?.(); else onSelect(selected); setOpen(false); }}>Use supplier</Button></div>
        </div>
      </Sheet>
    </div>
  );
}

function PurchasesScreenContent({ pathname, onNavigate, session }) {
  const { language } = useLocale();
  const currency = session?.business?.currency || 'Ks';
  const mutation = useRef(false);
  const [localPathname, setLocalPathname] = useState('/purchases');
  const currentPathname = pathname || localPathname;
  const page = useMemo(() => purchasePageFromPath(currentPathname), [currentPathname]);
  const formRoute = page.kind === 'new' || page.kind === 'edit';
  const [form, setForm] = useState(blankPurchaseForm());
  const [formGeneration, setFormGeneration] = useState(0);
  const [wizardStep, setWizardStep] = useState(1);
  const [draftFilters, setDraftFilters] = useState(blankPurchaseFilters());
  const [appliedFilters, setAppliedFilters] = useState(blankPurchaseFilters());
  const [currentPayable, setCurrentPayable] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSuppliers, setFilterSuppliers] = useState([]);
  const filterSuppliersLoaded = useRef(false);
  const [categories, setCategories] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [warningOpen, setWarningOpen] = useState(false);
  const [actionPurchase, setActionPurchase] = useState(null);
  const [deletePurchase, setDeletePurchase] = useState(null);
  const [adminPin, setAdminPin] = useState('');
  const [deletePinRequired, setDeletePinRequired] = useState(false);
  const [settings, setSettings] = useState({});
  const [deleting, setDeleting] = useState(false);

  function navigateTo(path, options = {}) {
    if (onNavigate) onNavigate(path, options);
    else setLocalPathname(path);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    if (!filtersOpen || filterSuppliersLoaded.current) return undefined;
    const controller = new AbortController();
    async function loadSuppliers() {
      let offset = 0;
      while (!controller.signal.aborted) {
        const response = await apiRequest(`/suppliers?with_total=true&limit=100&offset=${offset}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const rows = response.items || (Array.isArray(response) ? response : []);
        setFilterSuppliers(current => [...new Map([...current, ...rows].map(row => [row.id, row])).values()]);
        offset += rows.length;
        if (!rows.length || (response.total !== undefined ? offset >= response.total : rows.length < 100)) { filterSuppliersLoaded.current = true; return; }
      }
    }
    loadSuppliers().catch(() => undefined);
    return () => controller.abort();
  }, [filtersOpen]);

  const loadHistoryPage = useCallback(async ({ limit, offset, signal }) => {
    if (offset === 0) setCurrentPayable(null);
    const path = purchaseHistoryPath(appliedFilters, limit, offset);
    const response = await apiRequest(`${path}${offset === 0 ? '&with_current_balance=true' : ''}`, { signal });
    if (!signal.aborted && offset === 0) {
      setCurrentPayable(response.current_payable_total ?? null);
    }
    return response;
  }, [appliedFilters]);
  const history = useEndlessList({ loadPage: loadHistoryPage, queryKey: JSON.stringify(appliedFilters), pageSize: PAGE_SIZE, enabled: page.kind === 'list' });

  function exportPurchases() {
    const raw = purchaseHistoryPath(appliedFilters, 20, 0);
    const url = new URL(raw, window.location.origin);
    url.searchParams.delete('limit'); url.searchParams.delete('offset'); url.searchParams.delete('with_total');
    return exportFilteredCsv({
      loadRows: () => loadPurchaseLineItems(`${url.pathname}${url.search}`), filename: csvFilename('purchases'), emptyMessage: 'No purchases match the current filters.',
      columns: PURCHASE_LINE_COLUMNS,
    });
  }

  const loadProductPage = useCallback(({ limit, offset, signal }) => {
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    if (debouncedProductSearch) params.set('q', debouncedProductSearch);
    if (productCategory) params.set('category', productCategory);
    return apiRequest(`/products?${params}`, { signal });
  }, [debouncedProductSearch, productCategory]);
  const products = useEndlessList({ loadPage: loadProductPage, queryKey: JSON.stringify([debouncedProductSearch, productCategory]), pageSize: 15, enabled: formRoute });
  const selectedProductIds = useMemo(() => new Set(form.items.map((item) => Number(item.product_id))), [form.items]);

  const loadCategories = useCallback(async () => {
    if (!formRoute) return;
    try { setCategories(await apiRequest('/categories')); } catch (error) { setNotice({ type: 'error', text: error.message }); }
  }, [formRoute]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const loadSettings = useCallback(async (signal) => {
    const current = await apiRequest('/settings', signal ? { signal } : undefined);
    setSettings(current || {});
    return current || {};
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadSettings(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [loadSettings]);

  const loadPurchaseRoute = useCallback(async (purchaseId, kind, signal) => {
    const purchase = await apiRequest(`/purchases/${purchaseId}`, { signal });
    if (kind === 'detail') {
      const products = await Promise.all((purchase.items || []).map(item => apiRequest(`/products/${item.product_id}`, { signal }).catch(() => null)));
      setDetail({ ...purchase, items: (purchase.items || []).map((item, index) => ({ ...item, product: products[index] })) });
      return;
    }
    const productResults = await Promise.all((purchase.items || []).map((item) => apiRequest(`/products/${item.product_id}`, { signal }).catch(() => null)));
    const productMap = new Map(productResults.filter(Boolean).map((product) => [Number(product.id), product]));
    setEditingId(purchase.id);
    setForm({
      supplier_id: purchase.supplier_id || null,
      supplier_name: purchase.supplier_name || '',
      created_at: purchase.created_at,
      reference_no: purchase.reference_no || `PUR${String(purchase.id).padStart(4, '0')}`,
      purchase_date: purchase.purchase_date || String(purchase.created_at || '').slice(0,10),
      expected_delivery: purchase.expected_delivery || '',
      supplier: purchase.supplier_id ? await apiRequest(`/suppliers/${purchase.supplier_id}`, { signal }).catch(() => null) : null,
      payment_method: purchase.payment_method || 'Cash',
      paid_amount: purchase.paid_amount ?? purchase.total_cost ?? null,
      note: purchase.note || '',
      product_id: '', unit_name: '', quantity: 1, foc_quantity: 0, unit_cost: 0,
      items: (purchase.items || []).map((item) => {
        const product = productMap.get(Number(item.product_id));
        return {
          ...item,
          foc_quantity: item.base_foc_quantity !== undefined ? Number(item.base_foc_quantity) / Number(item.conversion_factor || 1) : item.foc_quantity,
          current_stock: product ? stockWithUnit(product) : '-',
          product,
          effective_unit_cost: Number(item.effective_unit_cost ?? item.unit_cost),
          line_total: Number(item.line_total || 0),
        };
      }),
    });
  }, []);

  useEffect(() => {
    setRouteError('');
    setDetail(null);
    setWizardStep(1);
    if (page.kind === 'list') { setRouteLoading(false); return undefined; }
    if (page.kind === 'new') {
      setEditingId(null);
      setForm(blankPurchaseForm());
      setPaymentErrors({});
      setWizardStep(1);
      const draftId=window.history.state?.aiPurchaseDraftIndex===window.history.state?.mkposHistoryIndex ? window.history.state?.aiPurchaseDraftId : null;
      if(draftId && /^[a-f0-9-]{36}$/i.test(draftId)) {
        const controller=new AbortController();setRouteLoading(true);
        apiRequest(`/ai-assistant/purchase-drafts/${draftId}`,{signal:controller.signal}).then(draft=>{
          if(controller.signal.aborted)return;
          setForm({...blankPurchaseForm(),...draft.form,items:draft.form.items.map(item=>buildPurchaseLine(item.product,item.unit_name,item.quantity,item.foc_quantity,item.unit_cost))});
          setNotice({type:'info',text:'Invoice draft loaded. Verify all lines and payment details before saving. Nothing has been posted.'});
        }).catch(error=>{if(!controller.signal.aborted)setRouteError(error.message);}).finally(()=>{if(!controller.signal.aborted)setRouteLoading(false);});
        return ()=>controller.abort();
      }
      setRouteLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setRouteLoading(true);
    loadPurchaseRoute(page.purchaseId, page.kind, controller.signal)
      .catch((error) => { if (!controller.signal.aborted) setRouteError(error.message || 'Cannot load purchase.'); })
      .finally(() => { if (!controller.signal.aborted) setRouteLoading(false); });
    return () => controller.abort();
  }, [currentPathname, loadPurchaseRoute, page.kind, page.purchaseId]);

  usePageRefresh(() => {
    if (page.kind === 'list') return Promise.all([history.reload(), loadSettings()]);
    if (page.kind === 'detail') return Promise.all([loadPurchaseRoute(page.purchaseId, 'detail'), loadSettings()]);
    return Promise.all([products.reload(), loadCategories(), loadSettings()]);
  });

  function openNew() {
    setEditingId(null);
    setForm(blankPurchaseForm());
    setWizardStep(1);
    navigateTo('/purchases/new');
  }

  function toggleProduct(product) {
    if (selectedProductIds.has(Number(product.id))) {
      setForm((current) => ({ ...current, items: current.items.filter((item) => Number(item.product_id) !== Number(product.id)) }));
      return;
    }
    const unit = purchaseUnitOptions(product).at(-1);
    const cost = Math.round(Number(product.cost || 0) * unit.factor);
    const line = buildPurchaseLine(product, unit.name, 1, 0, cost);
    setForm((current) => ({ ...current, items: [...current.items, line] }));
  }

  function updateItem(key, patch) {
    setForm((current) => ({ ...current, items: current.items.map((item) => `${item.product_id}:${item.unit_name}` === key ? recalculatePurchaseLine(item, patch) : item) }));
  }

  function updateItemUnit(key, unitName) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (`${item.product_id}:${item.unit_name}` !== key) return item;
        const unit = purchaseUnitFor(item.product, unitName);
        const cost = Math.round(Number(item.product?.cost || 0) * unit.factor);
        return recalculatePurchaseLine({ ...item, unit_name: unit.name, conversion_factor: unit.factor }, { unit_cost: cost });
      }),
    }));
  }

  function removeItem(key) {
    setForm((current) => ({ ...current, items: current.items.filter((item) => `${item.product_id}:${item.unit_name}` !== key) }));
  }

  function validatePurchase() {
    if (!form.items.length) return 'Add at least one product item.';
    if (form.items.some((item) => ![item.quantity, item.foc_quantity, item.unit_cost].every(value => Number.isFinite(Number(value))) || Number(item.quantity) <= 0 || Number(item.foc_quantity) < 0 || Number(item.unit_cost) < 0)) return 'Each item needs quantity greater than zero and unit cost zero or greater.';
    return '';
  }

  function continueWizard() {
    if (wizardStep === 1 && editingId) {
      const error = !form.supplier_name.trim() ? 'Supplier is required.' : !form.reference_no.trim() ? 'Reference number is required.' : !form.purchase_date ? 'Purchase date is required.' : '';
      if (error) { setNotice({ type: 'error', text: error }); return; }
    }

    setNotice(null);
    if (wizardStep === 2 && !form.items.length) {
      setNotice({ type: 'error', text: 'Select at least one product to continue.' });
      return;
    }
    if (wizardStep === 3) {
      const validation = validatePurchase();
      if (validation) {
        setNotice({ type: 'error', text: validation });
        return;
      }
      if (form.paid_amount === null) {
        setForm((current) => ({ ...current, paid_amount: String(purchaseTotals(current.items).total) }));
      }
    }
    setWizardStep((current) => Math.min(4, current + 1));
  }

  async function savePurchase(force = false) {
    if (mutation.current) return;
    const validation = validatePurchase();
    if (validation) { setNotice({ type: 'error', text: validation }); return; }
    const payment = purchasePaymentAmounts(form);
    const errors = {};
    if (!Number.isFinite(payment.paid) || payment.paid < 0 || payment.paid > payment.total) errors.paid_amount = 'Paid amount must be between zero and the purchase total.';
    if (payment.credit > 0 && !form.supplier_id) errors.supplier_id = 'Choose a saved supplier for a credit purchase.';
    if (Object.keys(errors).length) { setPaymentErrors(errors); setNotice({ type: 'error', text: 'Check the purchase payment details.' }); return; }
    setPaymentErrors({});
    const warnings = form.items.flatMap(itemCostWarnings);
    if (warnings.length && !force) { setWarningOpen(true); return; }
    mutation.current = true;
    const submittedHistoryState = window.history.state;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await apiRequest(editingId ? `/purchases/${editingId}` : '/purchases', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(purchasePayload(form)) });
      const changed = saved.price_changes?.length || 0;
      setNotice({ type: 'success', text: `${editingId ? 'Purchase updated.' : 'Purchase saved.'}${changed ? ` ${changed} automatic price(s) updated.` : ''}` });
      setWarningOpen(false);
      if (!editingId) {
        setForm(blankPurchaseForm());
        setWizardStep(1);
        setPaymentErrors({});
        setProductSearch('');
        setDebouncedProductSearch('');
        setProductCategory('');
        setFormGeneration(current => current + 1);
        const state = window.history.state;
        if (state?.aiPurchaseDraftId && state.aiPurchaseDraftId === submittedHistoryState?.aiPurchaseDraftId && state.mkposHistoryIndex === submittedHistoryState?.mkposHistoryIndex && state.aiPurchaseDraftIndex === state.mkposHistoryIndex) {
          const next = { ...state };
          delete next.aiPurchaseDraftId;
          delete next.aiPurchaseDraftIndex;
          window.history.replaceState(next, '', window.location.href);
        }
      }
      navigateTo('/purchases', { back: true });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    const error = dateRangeError(draftFilters.date_from, draftFilters.date_to);
    if (error) { setNotice({ type: 'error', text: error }); return; }
    setNotice(null);
    setAppliedFilters({ ...draftFilters, preset: draftFilters.preset === 'all' ? 'all' : 'custom' });
    setFiltersOpen(false);
  }

  function applySearch() {
    setNotice(null);
    setAppliedFilters(current => ({ ...current, q: draftFilters.q.trim() }));
  }

  function setPreset(preset) {
    const next = { ...draftFilters, preset, ...presetDateFromTo(preset) };
    setDraftFilters(next);
  }

  function clearHistoryFilters() {
    const next = blankPurchaseFilters();
    setDraftFilters(next);
    setAppliedFilters(next);
    setFiltersOpen(false);
  }

  async function openDelete(purchase) {
    try {
      const currentSettings = Object.prototype.hasOwnProperty.call(settings, 'admin_pin_set')
        ? settings
        : await loadSettings();
      setDeletePinRequired(String(currentSettings?.admin_pin_set) === '1');
      setDeletePurchase(purchase);
      setAdminPin('');
    } catch (error) {
      setNotice({ type: 'error', text: `Cannot check Admin PIN protection. ${error.message}` });
    }
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (deletePinRequired && !adminPin.trim()) { setNotice({ type: 'error', text: 'Admin PIN is required.' }); return; }
    setDeleting(true);
    try {
      const options = { method: 'DELETE' };
      if (deletePinRequired) options.body = JSON.stringify({ admin_pin: adminPin });
      await apiRequest(`/purchases/${deletePurchase.id}`, options);
      setDeletePurchase(null);
      setNotice({ type: 'success', text: 'Purchase deleted and stock changes reversed.' });
      navigateTo('/purchases', { back: true });
      await history.reload();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setDeleting(false);
    }
  }

  const totals = purchaseTotals(form.items);
  const paymentAmounts = purchasePaymentAmounts(form);
  const waitingForRoute = routeLoading || (page.kind === 'detail' && detail?.id !== page.purchaseId) || (page.kind === 'edit' && editingId !== page.purchaseId);

  if (page.kind !== 'list' && routeError) {
    return <main className="sale-retail-page purchase-reference-page"><PurchaseReferenceHeader title="Purchase" onBack={() => navigateTo('/purchases', { back: true })} /><div className="endless-first-error"><p>{routeError}</p></div></main>;
  }
  if (page.kind !== 'list' && waitingForRoute) {
    return <main className="sale-retail-page purchase-reference-page"><PurchaseReferenceHeader title="Purchase" onBack={() => navigateTo('/purchases', { back: true })} /><p className="mobile-inline-loading" role="status"><RefreshCw className="spin" size={18} />Loading purchase…</p></main>;
  }

  if (formRoute) {
    const supplierPicker = <SupplierPicker onNew={session?.permissions?.includes('suppliers') ? () => navigateTo('/suppliers/new') : undefined} value={form.supplier_name} supplierId={form.supplier_id} supplier={form.supplier} compact={!!editingId} onChange={name => { setForm(current => ({ ...current, supplier_id: null, supplier_name: name, supplier: null })); setPaymentErrors(current => ({ ...current, supplier_id: '' })); }} onSelect={supplier => { setForm(current => ({ ...current, supplier_id: supplier.id, supplier_name: supplier.name, supplier })); setPaymentErrors(current => ({ ...current, supplier_id: '' })); }} />;
    return <PurchaseReferenceForm key={formGeneration} warningOpen={warningOpen} form={form} setForm={setForm} step={wizardStep} setStep={setWizardStep} editing={editingId} saving={saving} currency={currency} supplierPicker={supplierPicker} products={products} categories={categories} search={productSearch} setSearch={setProductSearch} category={productCategory} setCategory={setProductCategory} selectedIds={selectedProductIds} toggleProduct={toggleProduct} updateItem={updateItem} updateItemUnit={updateItemUnit} removeItem={removeItem} totals={totals} payment={paymentAmounts} paymentErrors={paymentErrors} methods={PURCHASE_PAYMENT_METHODS} onContinue={continueWizard} onSave={() => savePurchase()} onBack={() => navigateTo('/purchases', { back: true })} onNewSupplier={session?.permissions?.includes('suppliers') ? () => navigateTo('/suppliers/new') : undefined} productFooter={<EndlessFooter list={products} count={products.items.length} noun="products" />} notice={<Notice notice={notice} onClose={() => setNotice(null)} />} warning={<Sheet open={warningOpen} title="Review selling prices" className="purchase-cost-warning-sheet" onClose={() => !saving && setWarningOpen(false)}><div className="purchase-warning-confirm"><div className="purchase-cost-warning-banner"><CircleAlert size={24} /><span><strong>Selling price is below effective unit cost</strong><small>The current retail selling price is lower than the effective unit cost for the item below. The selling price will not be changed automatically.</small></span></div><div className="purchase-cost-warning-table"><div><span>Item</span><span>Effective unit cost</span><span>{form.items.flatMap(itemCostWarnings).every(warning => warning.name.toLowerCase() === 'retail') ? 'Current retail price' : 'Current selling price'}</span></div>{form.items.flatMap(item => itemCostWarnings(item).map(warning => <div key={`${item.product_id}:${item.unit_name}:${warning.name}`}><span className="purchase-warning-item">{item.product?.photo_url && <ProductPhoto path={item.product.photo_url} />}<span><strong data-no-localize>{item.product_name || item.product?.name}</strong><small data-no-localize>{warning.name}</small></span></span><strong>{money(warning.cost, currency)}</strong><strong className="is-below-cost">{money(warning.price, currency)}</strong></div>))}</div><div className="mobile-form-actions"><Button variant="secondary" className="mobile-secondary" type="button" disabled={saving} onClick={() => { setWarningOpen(false); setWizardStep(3); }}>Go back and edit</Button><Button variant="primary" className="mobile-primary" type="button" disabled={saving} onClick={() => savePurchase(true)}>Save anyway</Button></div></div></Sheet>} />;
  }

  if (page.kind === 'detail' && detail) {
    return <PurchaseReferenceDetail purchase={detail} currency={currency} onBack={() => navigateTo('/purchases', { back: true })} onEdit={() => navigateTo(`/purchases/${detail.id}/edit`)} onDelete={() => void openDelete(detail)} onSupplier={detail.supplier_id && session?.permissions?.includes('suppliers') ? () => navigateTo(`/suppliers/${detail.supplier_id}`) : undefined} onPrint={async () => { try { const text = [`Purchase #${detail.id}`, detail.supplier_name, detail.created_at, ...(detail.items || []).map(item => `${item.product_name}: ${item.quantity} ${item.unit_name} + ${item.foc_quantity || 0} FOC - ${money(item.line_total, currency)}`), `Total: ${money(detail.total_cost, currency)}`, `Paid: ${money(detail.paid_amount, currency)}`, `Balance: ${money(detail.credit_amount, currency)}`, detail.note].filter(Boolean).join('\n'); if (!await printHtmlDocument({ title: `Purchase #${detail.id}`, text })) setNotice({ type: 'error', text: 'Allow pop-ups to print the purchase.' }); } catch (error) { setNotice({ type: 'error', text: error.message }); } }} notice={<Notice notice={notice} onClose={() => setNotice(null)} />} deleteSheet={<MobileDeleteSheet open={Boolean(deletePurchase)} title="Delete purchase?" description="Stock received by this purchase will be reversed." itemTitle={deletePurchase ? `Purchase #${deletePurchase.id}` : ''} itemDescription={deletePurchase?.supplier_name || money(deletePurchase?.total_cost, currency)} confirmLabel="Delete purchase" busy={deleting} onClose={() => setDeletePurchase(null)} onConfirm={confirmDelete}>{deletePinRequired && <Field label="Admin PIN"><Input autoFocus type="password" inputMode="numeric" value={adminPin} onChange={event => setAdminPin(event.target.value)} placeholder="Enter admin PIN" /></Field>}</MobileDeleteSheet>} />;
  }

  const activeFilterCount = [draftFilters.supplier, draftFilters.date_from, draftFilters.date_to, draftFilters.payment_status !== 'all' ? draftFilters.payment_status : ''].filter(Boolean).length;

  const loadedAmount = history.items.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
  const displayDate = value => { const date = new Date(String(value || '').replace(' ', 'T')); return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

  const fromDate = appliedFilters.date_from ? new Date(`${appliedFilters.date_from}T12:00:00`) : null;
  const toDate = appliedFilters.date_to ? new Date(`${appliedFilters.date_to}T12:00:00`) : null;
  const periodLabel = fromDate && toDate && fromDate.getFullYear() === toDate.getFullYear() && fromDate.getMonth() === toDate.getMonth()
    ? `${fromDate.getDate()}\u2013${toDate.getDate()} ${toDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
    : fromDate || toDate ? `${fromDate ? displayDate(appliedFilters.date_from) : 'Any date'} - ${toDate ? displayDate(appliedFilters.date_to) : 'Today'}` : 'All dates';

  return (
    <main className="sale-retail-page purchase-reference-page purchase-index-page has-create-fab">
      <PurchaseReferenceHeader actions={<CsvExportButton compact onExport={exportPurchases} onNotice={setNotice} />} title="Purchases" />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      
      <section className="purchase-reference-panel purchase-period-summary"><header><span className="purchase-period-icon"><Package size={22} /></span><div><strong>{periodLabel}</strong><small>{history.hasMore ? `${history.items.length} loaded / ${history.total ?? '?'}` : `${history.total ?? history.items.length} purchases`}</small></div><Button variant="plain" type="button" onClick={() => setFiltersOpen(true)}><CalendarDays size={15} />Change period</Button></header><div><span><small>{history.hasMore ? 'Loaded purchase amount' : 'Total purchase amount'}</small><strong>{money(loadedAmount, currency)}</strong></span><span><small>Current unpaid balance</small><strong>{currentPayable === null ? '—' : money(currentPayable, currency)}</strong><small>All suppliers / all dates</small></span></div></section>
      <section className="mobile-product-controls purchase-history-controls">
        <SearchInput className="mobile-search product-search"><Search size={20} /><Input aria-label="Search purchase history" value={draftFilters.q} onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applySearch(); } }} placeholder="Search purchases" />{draftFilters.q && <IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Clear purchase search" onClick={() => { setDraftFilters((current) => ({ ...current, q: '' })); setAppliedFilters((current) => ({ ...current, q: '' })); }}><X size={17} /></IconButton>}<IconButton variant="ghost" type="button" className="purchase-search-submit" aria-label="Apply purchase search" onClick={applySearch}><Search size={18} /></IconButton></SearchInput>
        <div className="mobile-control-row purchase-control-row"><MobileFilterToggle open={filtersOpen} onToggle={() => setFiltersOpen((open) => !open)} controls="purchase-history-filters" count={activeFilterCount} className="product-toolbar-toggle" /></div>
        <MobileFilterPanel onClose={() => setFiltersOpen(false)} open={filtersOpen} id="purchase-history-filters" className="product-filter-panel purchase-filter-panel" onSubmit={applyFilters}>
          <fieldset className="purchase-reference-date-presets"><legend>Date range</legend>{[['today', 'Today'], ['month', 'This month'], ['custom', 'Custom']].map(([preset, label]) => <Button variant="choice" type="button" key={preset} className={draftFilters.preset === preset ? 'is-selected' : ''} onClick={() => preset === 'custom' ? setDraftFilters(current => ({ ...current, preset })) : setPreset(preset)}>{label}</Button>)}</fieldset>

          <label className="product-filter-field purchase-filter-field" htmlFor="purchase-filter-from" onClick={openNativeDatePicker}><CalendarDays size={21} /><span><small>From</small><PurchaseDateInput aria-label="From" id="purchase-filter-from" value={draftFilters.date_from} onChange={(event) => setDraftFilters((current) => ({ ...current, preset: 'custom', date_from: event.target.value }))} /></span></label>
          <label className="product-filter-field purchase-filter-field" htmlFor="purchase-filter-to" onClick={openNativeDatePicker}><CalendarDays size={21} /><span><small>To</small><PurchaseDateInput aria-label="To" id="purchase-filter-to" value={draftFilters.date_to} onChange={(event) => setDraftFilters((current) => ({ ...current, preset: 'custom', date_to: event.target.value }))} /></span></label>
          <FieldShell as="label" className="mobile-field purchase-filter-supplier" htmlFor="purchase-filter-supplier"><span>Supplier</span><Select aria-label="Supplier" id="purchase-filter-supplier" value={draftFilters.supplier} onChange={event => setDraftFilters(current => ({ ...current, supplier: event.target.value }))}><option value="">All</option>{[...new Set([...filterSuppliers.map(item => item.name), ...history.items.map(item => item.supplier_name).filter(Boolean), ...(draftFilters.supplier ? [draftFilters.supplier] : [])])].map(name => <option key={name}>{name}</option>)}</Select></FieldShell>
          <ChoiceGroup className="purchase-payment-filter"><legend>Payment status</legend>{[['all', 'All'], ['paid', 'Paid'], ['partial', 'Part paid'], ['unpaid', 'Unpaid']].map(([value, label]) => <label key={value}><Radio type="radio" name="purchase-payment-filter" checked={draftFilters.payment_status === value} onChange={() => setDraftFilters(current => ({ ...current, payment_status: value }))} /><span>{label}</span></label>)}</ChoiceGroup>
          <div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={clearHistoryFilters}>Reset</MobileFilterResetButton><Button variant="primary" className="mobile-primary" type="submit" aria-label={`Apply filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}>Apply</Button></div>
        </MobileFilterPanel>
      </section>
      <div className="mobile-list-heading"><h2>Purchase history</h2><span>{history.total ?? history.items.length} records</span></div>
      {history.initialLoading ? <div className="purchase-history-skeleton" role="status">{[1, 2, 3].map((key) => <span key={key} />)}</div> : history.error && !history.items.length ? <div className="endless-first-error"><p>Cannot load purchases. {history.error}</p><Button variant="plain" type="button" onClick={history.retry}>Try again</Button></div> : history.items.length ? <><div className="purchase-history-list">{history.items.map(purchase => <article key={purchase.id}><Button variant="plain" className="purchase-history-main" type="button" onClick={() => navigateTo(`/purchases/${purchase.id}`)}><span className="purchase-history-icon"><Store size={22} /></span><span className="purchase-history-identity"><strong data-no-localize>{purchase.supplier_name || 'Unknown supplier'}</strong><small>PUR{String(purchase.id).padStart(4, '0')}</small><time>{displayDate(purchase.purchase_date || purchase.created_at)}</time></span><span className={`purchase-payment-badge${Number(purchase.credit_amount) ? Number(purchase.paid_amount) ? ' has-credit' : ' has-credit is-unpaid' : ''}`}>{Number(purchase.credit_amount) ? Number(purchase.paid_amount) ? 'Part paid' : 'Unpaid' : 'Paid'}</span><span className="purchase-history-total"><small>Total amount</small><strong>{money(purchase.total_cost, currency)}</strong></span><span className="purchase-history-payment"><small>Paid {money(purchase.paid_amount, currency)}</small><small>Balance {money(purchase.credit_amount, currency)}</small></span></Button><IconButton variant="ghost" className="purchase-history-menu" type="button" aria-label={`Actions for purchase ${purchase.id}`} onClick={() => setActionPurchase(purchase)}><EllipsisVertical size={19} /></IconButton></article>)}</div><EndlessFooter list={history} count={history.items.length} noun="purchases" /></> : <div className="mobile-empty-state"><span><Truck size={28} /></span><h2>No purchase history</h2><p>Create the first purchase to receive inventory.</p></div>}
      <Sheet open={Boolean(actionPurchase)} title="Purchase actions" description={actionPurchase ? `Purchase #${actionPurchase.id}` : ''} className="mobile-sheet--action-menu" onClose={() => setActionPurchase(null)}><div className="mobile-action-menu"><Button variant="plain" type="button" aria-label="View details" onClick={() => { const purchase = actionPurchase; setActionPurchase(null); navigateTo(`/purchases/${purchase.id}`); }}><Eye size={19} /><span><strong>View details</strong><small>Open purchase information</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button><Button variant="plain" type="button" aria-label="Edit" onClick={() => { const purchase = actionPurchase; setActionPurchase(null); navigateTo(`/purchases/${purchase.id}/edit`); }}><Edit3 size={19} /><span><strong>Edit</strong><small>Update purchase items</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button><Button variant="danger-ghost" className="danger-action" type="button" aria-label="Delete" onClick={() => { const purchase = actionPurchase; setActionPurchase(null); void openDelete(purchase); }}><Trash2 size={19} /><span><strong>Delete</strong><small>Reverse stock and remove purchase</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button></div></Sheet>
      <MobileDeleteSheet open={Boolean(deletePurchase)} title="Delete purchase?" description="Stock changes will be reversed and the purchase removed from history." itemTitle={deletePurchase ? `Purchase #${deletePurchase.id}` : ''} itemDescription={deletePurchase?.supplier_name || money(deletePurchase?.total_cost)} confirmLabel="Delete purchase" busy={deleting} onClose={() => setDeletePurchase(null)} onConfirm={confirmDelete}>{deletePinRequired && <Field label="Admin PIN"><Input autoFocus type="password" inputMode="numeric" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} placeholder="Enter admin PIN" /></Field>}</MobileDeleteSheet>
      <FloatingActionButton label="New purchase" onClick={openNew}><Plus size={26} aria-hidden="true" /></FloatingActionButton>
    </main>
  );
}

export function PurchasesScreen(props) {
  return <ModuleLocalizationBoundary messages={PURCHASE_MESSAGES} patterns={PURCHASE_PATTERNS}><PurchasesScreenContent {...props} /></ModuleLocalizationBoundary>;
}
