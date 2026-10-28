import { CartLineFrame } from './CartLineFrame';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { InputGroup, ChoiceGroup, Button, Field, IconButton, Input, Radio, SearchInput, Select, Textarea } from '../components/Controls';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronLeft, Clock3, CreditCard, Info, Minus, Package, PackageSearch, Plus, Printer, RefreshCw, ScanBarcode, Search, ShoppingCart, Trash2, UserRound, WifiOff, X } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileField, MobileFilterActions, MobileFilterPanel, MobileFilterToggle, MobileNotice, MobileSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { useLocale } from '../localization/LocaleContext';
import { AppNavigationContext } from '../navigation/AppNavigationContext';
import { RetainedViews } from '../navigation/RetainedViews';
import { PageActivityContext, usePageRefresh } from '../navigation/pageRefresh';
import { blankCustomerForm, customerPayload } from '../customers/customerUtils';
import { cleanPriceTypes, formatQuantity, hasPurchaseUnit, money, priceMargin } from '../products/productUtils';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { ProductBarcodeScanner } from '../products/ProductBarcodeScanner.jsx';
import { printHtmlDocument, receiptOptions } from '../utils/printing';
import { cachedProductPage, createOfflineSale, getOfflineBootstrap, getOfflineData, listOfflineSales, offlinePaymentMethods } from '../offline/offlineStore';
import { offlineReceiptPayload } from '../offline/offlineReceipt';
import { announceOfflineDetected, isConnectionFailure, OFFLINE_STATE_EVENT } from '../offline/offlineSales';
import { cartItemFromProduct, cleanPaymentMethods, EMPTY_SALE_DRAFT, repriceSaleCart, saleDraftFrom, salePageFromPath, salePayload, saleProductPrice, saleTotals } from './saleUtils';
import { sellOptionLabel, sellText } from './sellLocale';
import { OfflineSalesPage } from './OfflineSalesPage';

const PAGE_SIZE = 20;
const DRAFT_KEY = 'mkpos-mobile-sale-draft-v1';

function readDraft(key) {
  try { return saleDraftFrom(JSON.parse(window.sessionStorage.getItem(key))); }
  catch { return { ...EMPTY_SALE_DRAFT }; }
}

function fieldErrorsFrom(error) {
  return Object.fromEntries(Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : String(messages)]));
}

function useSellText() {
  const { language } = useLocale();
  const t = useCallback((key, fallback, variables = {}) => sellText(key, language, variables, fallback), [language]);
  return { language, t };
}

function RetailSaleHeading({ cart, onNavigate, isCart = false, isCheckout = false, title, backPath, onPrintLast, showCart = false }) {
  const { t } = useSellText();
  const { openNavigation } = useContext(AppNavigationContext);
  const [actionsOpen, setActionsOpen] = useState(false);
  const units = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return <><PageAppBar className="retail-sale-header">
    {(isCart || isCheckout || backPath) && <IconButton variant="ghost" type="button" aria-label={isCheckout ? t('previousStep', 'Go to previous sale step') : t('backToProducts', 'Back to products')} onClick={() => onNavigate(backPath || (isCheckout ? '/sell/cart' : '/sell'), { back: true })}><ChevronLeft size={26} aria-hidden="true" /></IconButton>}
    <h1>{title || (isCheckout ? t('checkoutTitle', 'Checkout') : isCart ? t('cartTitle', 'Cart') : t('sellTitle', 'Sell'))}</h1>
    {((!isCart && !isCheckout) || showCart) && <IconButton variant="ghost" type="button" className="retail-header-cart" aria-label={t('openCart', 'Open cart')} onClick={() => onNavigate('/sell/cart')}><ShoppingCart size={20} aria-hidden="true" />{units > 0 && <span>{formatQuantity(units)}</span>}</IconButton>}
    {onPrintLast && <IconButton variant="ghost" type="button" aria-label={t('saleMenu', 'Sale menu')} onClick={() => setActionsOpen(true)}><Printer size={22} aria-hidden="true" /></IconButton>}
  <AppBarMenu /></PageAppBar>
    {onPrintLast && <MobileSheet open={actionsOpen} title={t('saleActions', 'Sale actions')} onClose={() => setActionsOpen(false)}><div className="retail-checkout-menu"><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => { setActionsOpen(false); void onPrintLast(); }}><Printer size={18} />{t('printLast', 'Print last receipt')}</Button><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => { setActionsOpen(false); openNavigation(); }}>{t('openNavigation', 'Open navigation')}</Button></div></MobileSheet>}
  </>;
}

function SaleLoadingCards() {
  const { t } = useSellText();
  return <div className="sale-product-grid" role="status" aria-label={t('loadingProducts', 'Loading products')}>{[1, 2, 3, 4].map((key) => <div className="sale-mobile-product sale-product-skeleton" key={key}><span /><span /><span /></div>)}</div>;
}

export function CustomerPicker({ selected, onSelect, onCreate, confirmSelection = false }) {
  const { t } = useSellText();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pending, setPending] = useState(selected);
  const [creating, setCreating] = useState(false);
  function choose(customer) { if (confirmSelection) { setPending(customer); setCreating(false); } else onSelect(customer); }
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  const loadPage = useCallback(({ limit, offset, signal }) => {
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    if (debounced) params.set('q', debounced);
    return apiRequest(`/customers?${params}`, { signal });
  }, [debounced]);
  const list = useEndlessList({ loadPage, queryKey: debounced, pageSize: PAGE_SIZE });
  const actionOptions = <>{onCreate && <Button variant="plain" type="button" className={`sale-create-customer${creating ? ' is-selected' : ''}`} aria-pressed={confirmSelection ? creating : undefined} onClick={() => confirmSelection ? setCreating(true) : onCreate()}><Plus size={18} />{t('newCustomer', 'New customer')}</Button>}
      {(selected || confirmSelection) && <Button variant="plain" type="button" className="sale-walkin" aria-pressed={confirmSelection ? !pending && !creating : undefined} onClick={() => choose(null)}>{t('useWalkIn', 'Use walk-in customer instead')}</Button>}</>;
  return (
    <section className="sale-customer-picker">
      <SearchInput className="mobile-search" aria-label={t('searchCustomers', 'Search customers')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchCustomerPlaceholder', 'Search name or phone')} type="text" onClear={() => setSearch('')} clearLabel={t('clearCustomerSearch', 'Clear customer search')} />
      {!confirmSelection && actionOptions}
      {list.initialLoading ? <p className="mobile-inline-loading"><RefreshCw className="spin" size={17} />{t('loadingCustomers', 'Loading customers…')}</p> : list.error && !list.items.length ? <div className="endless-first-error"><p>{list.error}</p><Button variant="plain" type="button" onClick={list.retry}>{t('tryAgain', 'Try again')}</Button></div> : list.items.length ? <><div className="sale-customer-list">{list.items.map((customer) => <Button variant="plain" type="button" className={(!creating && (confirmSelection ? pending : selected)?.id === customer.id) ? 'is-selected' : ''} key={customer.id} aria-pressed={confirmSelection ? !creating && pending?.id === customer.id : undefined} onClick={() => choose(customer)}>{confirmSelection && <span className="retail-picker-avatar" aria-hidden="true">{customer.name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('')}</span>}<span><strong>{customer.name}</strong><small>{customer.phone || t('noPhone', 'No phone number')}</small></span>{!creating && (confirmSelection ? pending : selected)?.id === customer.id && <span>{t('selected', 'Selected')}</span>}</Button>)}</div><EndlessListFooter list={list} count={list.items.length} noun={t('customersNoun', 'customers')} labels={{ loadingMore: t('customersLoadingMore', 'Loading more customers…'), retry: t('tryAgain', 'Try again'), loadMore: t('loadMore', 'Load more'), end: t('customersEnd', `You’re all caught up · ${list.items.length} customers`, { count: list.items.length }) }} /></> : <p className="mobile-inline-empty">{t('noCustomers', 'No customers found.')}</p>}
      {confirmSelection && actionOptions}
      {confirmSelection && <footer className="retail-picker-confirm"><Button variant="primary" type="button" className="mobile-primary" onClick={() => creating ? onCreate?.() : onSelect(pending)}><Check size={18} />{t('confirmSelection', 'Confirm selection')}</Button></footer>}
    </section>
  );
}

function NewCheckoutCustomer({ draft, settings, setDraft, onNavigate }) {
  const { t } = useSellText();
  const [form, setForm] = useState(blankCustomerForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const createBusy = useRef(false), formRef = useRef(null), revealError = useRef(false);
  useEffect(() => { if (!revealError.current) return; revealError.current = false; const invalid = formRef.current?.querySelector('[aria-invalid="true"]'); invalid?.scrollIntoView?.({block:'center',behavior:'instant'}); invalid?.focus?.({preventScroll:true}); }, [errors]);
  const back = () => onNavigate('/sell/checkout', { replace: true, back: true });

  async function create(event) {
    event.preventDefault();
    if (createBusy.current) return;
    const payload = customerPayload(form);
    const invalid = {};
    if (!payload.name) invalid.name = t('customerNameRequired', 'Customer name is required.');
    if (!payload.phone) invalid.phone = t('customerPhoneRequired', 'Phone is required.');
    if (Object.keys(invalid).length) { revealError.current = true; return setErrors(invalid); }
    setErrors({});
    createBusy.current = true;
    setSaving(true);
    try {
      const created = await apiRequest('/customers', { method: 'POST', body: JSON.stringify(payload) });
      setDraft((current) => ({ ...current, customer: created }));
      back();
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      revealError.current = true;
      setErrors(Object.keys(fields).length ? fields : { general: error.message });
    } finally { createBusy.current = false; setSaving(false); }
  }

  const cart = draft.cart;
  const soldUnits = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total = money(saleTotals(cart, draft.discount, draft.paidAmount).total, settings.currency || 'Ks');
  const fields = [
    { name: 'name', label: t('customerNameLabel', 'Customer name'), required: true, autoComplete: 'name' },
    { name: 'phone', label: t('customerPhoneLabel', 'Phone'), required: true, type: 'tel', autoComplete: 'tel' },
    { name: 'email', label: t('customerEmailLabel', 'Email (optional)'), type: 'email', autoComplete: 'email' },
    { name: 'address', label: t('customerAddressLabel', 'Address (optional)'), multiline: true, autoComplete: 'street-address' },
    { name: 'note', label: t('customerNoteLabel', 'Note (optional)'), multiline: true, placeholder: t('customerNotePlaceholder', 'Add a note about this customer...') },
  ];
  return <main className="sale-page sale-retail-page sale-new-customer-page">
    <RetailSaleHeading title={t('newCustomer', 'New customer')} cart={cart} onNavigate={onNavigate} isCheckout backPath="/sell/checkout" showCart />
    <section className="retail-customer-return"><span aria-hidden="true"><ShoppingCart size={24} /></span><div><h2>{t('returningToCheckout', 'Returning to checkout')}</h2><p>{t('retainedCartSummary', `Cart retained (${formatQuantity(soldUnits)} units \u00b7 ${cart.length} items \u00b7 ${total})`, { units: formatQuantity(soldUnits), items: cart.length, total })}</p></div></section>
    <form ref={formRef} className="retail-new-customer-form" onSubmit={create} noValidate>
      <section className="retail-customer-fields">
        {fields.map(field => {
          const id = `checkout-customer-${field.name}`;
          const controlProps = { id, 'aria-label': field.label, 'aria-invalid': Boolean(errors[field.name]), 'aria-describedby': errors[field.name] ? `${id}-error` : undefined, value: form[field.name], disabled: saving, required: field.required, autoComplete: field.autoComplete, placeholder: field.placeholder, onChange: event => { setForm(current => ({ ...current, [field.name]: event.target.value })); setErrors(current => ({ ...current, [field.name]: '' })); } };
          return <MobileField key={field.name} id={id} label={<>{field.label}{field.required && <span className="retail-required" aria-hidden="true"> *</span>}</>} error={errors[field.name]}>{field.multiline ? <Textarea {...controlProps} rows={3} /> : <Input {...controlProps} type={field.type || 'text'} inputMode={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : 'text'} autoCapitalize={field.type === 'email' ? 'none' : undefined} maxLength={255} autoFocus={field.name === 'name'} />}</MobileField>;
        })}
        {errors.general && <div className="mobile-notice mobile-notice--error" role="alert">{errors.general}</div>}
      </section>
      <div className="retail-new-customer-actions"><Button variant="secondary" className="mobile-secondary" type="button" disabled={saving} onClick={back}>{t('cancelCustomer', 'Cancel')}</Button><Button variant="primary" className="mobile-primary" type="submit" disabled={saving}>{saving ? <><RefreshCw size={17} className="spin" aria-hidden="true" />{t('saving', 'Saving\u2026')}</> : t('createCustomer', 'Create customer')}</Button></div>
    </form>
  </main>;
}

function SalePriceAlert({ cart = [], priceType }) {
  const { language, t } = useSellText();
  const types = [...new Set([priceType, ...cart.map(item => item.price_type)].filter(type => type && String(type).toLowerCase() !== 'retail'))];
  if (!types.length) return null;
  const names = types.map(type => sellOptionLabel(type, language)).join(', ');
  return <div className="retail-price-alert" role="alert"><AlertTriangle size={18} aria-hidden="true" /><span><strong>{t('nonRetailPricing', 'Non-Retail pricing')}</strong>{t('nonRetailPricingMessage', `Using ${names} prices. Check prices before completing this sale.`, { names })}</span></div>;
}

function ProductStep({ cart, setCart, priceType, setDraft, categories, settings, productList, onNavigate, onSearchChange, onCategoryChange, sort, onSortChange, externalNotice, clearExternalNotice, offlineMode, offlineState }) {
  const { language, t } = useSellText();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [filterDraft, setFilterDraft] = useState({ category: '', priceType: 'Retail', sort });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const scanRef = useRef(null);
  const changingPrice = useRef(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const priceTypes = useMemo(() => cleanPriceTypes(settings.price_types), [settings.price_types]);

  useEffect(() => { const timer = window.setTimeout(() => onSearchChange(search.trim()), 250); return () => window.clearTimeout(timer); }, [onSearchChange, search]);

  function selectedQuantity(product) {
    return cart.find((item) => item.product_id === product.id && item.price_type === priceType)?.quantity || 0;
  }

  const selectedTotal = saleTotals(cart, 0, 0).subtotal;

  async function changePriceType(next) {
    if (changingPrice.current) return false;
    if (next === priceType) return true;
    changingPrice.current = true; setPriceBusy(true); setNotice(null);
    try {
      const products = new Map(productList.items.map(product => [Number(product.id), product]));
      const unresolved = cart.filter(item => !products.has(Number(item.product_id)) && !Array.isArray(item.prices));
      if (unresolved.length && offlineMode) {
        const cached = await getOfflineData();
        cached.products?.forEach(product => products.set(Number(product.id), product));
      } else if (unresolved.length) {
        await Promise.all([...new Set(unresolved.map(item => item.product_id))].map(async id => {
          const product = await apiRequest(`/products/${encodeURIComponent(id)}`);
          products.set(Number(id), product.product || product);
        }));
      }
      const result = repriceSaleCart(cart, next, products);
      if (result.missing) {
        setNotice({ type: 'error', text: t('cartPriceUnavailable', `Cannot use ${next}: no price is set for ${result.missing.join(', ')}. Current cart prices are unchanged.`, { priceType: sellOptionLabel(next, language), names: result.missing.join(', ') }) });
        return false;
      }
      setDraft(current => {
        const updated = repriceSaleCart(current.cart, next, products);
        return updated.missing ? current : { ...current, priceType: next, cart: updated.cart };
      });
      return true;
    } catch {
      setNotice({ type: 'error', text: t('priceChangeFailed', 'Could not load the selected prices. Current cart prices are unchanged. Try again.') });
      return false;
    } finally { changingPrice.current = false; setPriceBusy(false); }
  }

  function addProduct(product) {
    if (changingPrice.current) return;
    const price = saleProductPrice(product, priceType);
    if (price <= 0) return setNotice({ type: 'error', text: t('noUsablePrice', `${product.name} has no usable ${priceType} price.`, { name: product.name, priceType: sellOptionLabel(priceType, language) }) });
    setCart((current) => {
      const index = current.findIndex((item) => item.product_id === product.id && item.price_type === priceType);
      if (index < 0) return [...current, cartItemFromProduct(product, priceType)];
      return current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item);
    });
  }

  async function addBarcode(codeValue) {
    const code = String(codeValue || '').trim();
    if (!code) return;
    try {
      const product = offlineMode
        ? (await cachedProductPage({ barcode: code, limit: 1 })).items[0]
        : await apiRequest(`/products/barcode/${encodeURIComponent(code)}`);
      if (!product) throw new Error('Product not found');
      addProduct(product); setSearch(''); scanRef.current?.focus();
    }
    catch (error) {
      if (!offlineMode && isConnectionFailure(error)) {
        announceOfflineDetected(error);
        const cached = (await cachedProductPage({ barcode: code, limit: 1 }).catch(() => ({ items: [] }))).items[0];
        if (cached) { addProduct(cached); setSearch(''); scanRef.current?.focus(); return; }
      }
      setNotice({ type: 'error', text: t('barcodeNotFound', `Barcode not found: ${code}`, { code }) });
    }
  }

  async function scanProduct(event) {
    event.preventDefault();
    await addBarcode(search);
  }

  return (
    <main className="sale-page sale-products-page sale-retail-page">
      <RetailSaleHeading cart={cart} onNavigate={onNavigate} />
      {(offlineMode || offlineState.pending_count > 0 || offlineState.failed_count > 0) && <section className={`sale-offline-strip${offlineMode ? ' is-offline' : ''}`}><span>{offlineMode ? <WifiOff size={17} /> : <Clock3 size={17} />}</span><div><strong>{offlineMode ? t('offlineMode', 'Offline mode') : t('offlineInvoicesWaiting', 'Offline invoices waiting')}</strong><small>{t('offlineQueueSummary', `${offlineState.pending_count || 0} waiting · ${offlineState.failed_count || 0} need attention`, { pending: offlineState.pending_count || 0, failed: offlineState.failed_count || 0 })}</small></div><Button variant="plain" type="button" onClick={() => onNavigate('/sell/offline-sales')}>{t('viewInvoices', 'View invoices')}</Button></section>}
      <MobileNotice notice={externalNotice} onClose={clearExternalNotice} dismissLabel={t('dismissMessage', 'Dismiss message')} />
      <MobileNotice notice={notice} onClose={() => setNotice(null)} dismissLabel={t('dismissMessage', 'Dismiss message')} />
      <div className="retail-search-toolbar"><form className="sale-quick-find" onSubmit={scanProduct}><SearchInput><Search size={23} aria-hidden="true" /><Input ref={scanRef} aria-label={t('searchProducts', 'Search sale products')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('retailSearchPlaceholder', 'Search products')} />{search && <IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label={t('clearSearch', 'Clear search')} onClick={() => setSearch('')}><X size={17} /></IconButton>}<IconButton variant="ghost" className="sale-scan-button" type="button" aria-label={t('barcodeScan', 'Scan product barcode')} aria-expanded={barcodeScannerOpen} onClick={() => setBarcodeScannerOpen(true)}><ScanBarcode size={24} /></IconButton></SearchInput></form>
      <MobileFilterToggle className="retail-filter-toggle" open={filtersOpen} onToggle={() => { if (!filtersOpen) setFilterDraft({ category, priceType, sort }); setFiltersOpen(open => !open); }} controls="sale-product-filters" count={Number(Boolean(category)) + Number(priceType !== (priceTypes[0] || 'Retail')) + Number(sort !== 'name_asc')} /></div>
      <p className={`retail-connection-status${offlineMode ? ' is-offline' : ''}`}><span aria-hidden="true" />{offlineMode ? t('offlineMode', 'Offline mode') : t('onlineStatus', 'Online')}{' \u00b7 '}{offlineState.cache_ready ? t('cacheReady', 'Offline cache ready') : t('cacheNotReady', 'Offline cache not ready')}</p>
      <div className="retail-results-toolbar"><span>{productList.total ?? productList.items.length} {t('productsNoun', 'products')}</span><Select fullWidth={false} aria-label={t('priceType', 'Price type')} value={priceType} disabled={priceBusy} onChange={event => void changePriceType(event.target.value)}>{!priceTypes.includes(priceType) && <option value={priceType} disabled>{sellOptionLabel(priceType, language)}</option>}{priceTypes.map(type => <option key={type} value={type}>{sellOptionLabel(type, language)}</option>)}</Select></div>
      <SalePriceAlert cart={cart} priceType={priceType} /><MobileFilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} id="sale-product-filters" className="retail-sell-filters" onSubmit={async event => { event.preventDefault(); if (!await changePriceType(filterDraft.priceType)) return; setCategory(filterDraft.category); onCategoryChange(filterDraft.category); onSortChange(filterDraft.sort); setFiltersOpen(false); }}>
        <ChoiceGroup className="retail-filter-group"><legend><Package size={18} />{t('productCategory', 'Product category')}</legend>{['', ...categories].map(item => <label key={item} className={filterDraft.category === item ? 'is-selected' : ''}><Radio type="radio" name="sell-category" value={item} checked={filterDraft.category === item} onChange={()=>setFilterDraft(current=>({...current,category:item}))} /><span>{item || t('allCategories', 'All categories')}</span></label>)}</ChoiceGroup>
        <ChoiceGroup className="retail-filter-group"><legend><CreditCard size={18} />{t('priceType', 'Price type')}</legend>{priceTypes.map(type=><label key={type} className={filterDraft.priceType === type ? 'is-selected' : ''}><Radio type="radio" name="sell-price-type" value={type} checked={filterDraft.priceType === type} onChange={()=>setFilterDraft(current=>({...current,priceType:type}))} /><span>{sellOptionLabel(type,language)}</span></label>)}</ChoiceGroup>
        <ChoiceGroup className="retail-filter-group"><legend>Sort by</legend>{[["name_asc", "Name A-Z"], ["name_desc", "Name Z-A"]].map(([value, label]) => <label key={value} className={filterDraft.sort === value ? "is-selected" : ""}><Radio type="radio" name="sell-sort" checked={filterDraft.sort === value} onChange={() => setFilterDraft(current => ({ ...current, sort: value }))} /><span>{label}</span></label>)}</ChoiceGroup>
        {notice?.type === 'error' && <p role="alert">{notice.text}</p>}<MobileFilterActions onClear={async () => {
          const priceType = priceTypes[0] || 'Retail';
          if (!await changePriceType(priceType)) return false;
          setFilterDraft({ category: '', priceType, sort: 'name_asc' }); setCategory(''); onCategoryChange(''); onSortChange('name_asc');
          return true;
        }} />
      </MobileFilterPanel>
      {productList.initialLoading ? <SaleLoadingCards /> : productList.error && !productList.items.length ? <div className="endless-first-error"><p>{t('cannotLoadProducts', `Cannot load products. ${productList.error}`, { error: productList.error })}</p><Button variant="plain" type="button" onClick={productList.retry}>{t('tryAgain', 'Try again')}</Button></div> : productList.items.length ? <><div className="sale-product-grid">{productList.items.map(product => {
        const price = saleProductPrice(product, priceType), out = Number(product.stock || 0) <= 0, selected = selectedQuantity(product), belowCost = priceMargin(price, product.cost).belowCost;
        return <Button variant="plain" type="button" className={`sale-mobile-product${out ? ' is-out' : ''}${selected ? ' is-selected' : ''}${belowCost ? ' is-below-cost' : ''}`} key={product.id} disabled={priceBusy} onClick={() => addProduct(product)}>
          <span className="sale-mobile-product-media" aria-hidden="true"><span className="sale-mobile-product-placeholder"><Package size={32} /></span>{!offlineMode && product.photo_url && <ProductPhoto path={product.photo_url} alt="" className="sale-mobile-product-photo" />}</span>
          <span className="sale-mobile-product-copy"><strong>{product.name}</strong><small>{product.base_unit || t('unit', 'Unit')}{product.sku ? ` \u00b7 SKU ${product.sku}` : ''}</small><b>{price > 0 ? money(price, settings.currency || 'Ks') : t('priceUnavailable', 'No price')}</b><span className={`retail-stock-badge${out ? ' is-out' : ''}`}><Package size={17} aria-hidden="true" />{t('inStock', `${formatQuantity(product.stock)} in stock`, { stock: formatQuantity(product.stock) })}</span></span>
          <span className="retail-product-add" aria-hidden="true"><Plus size={25} /></span>
          {belowCost && <AlertTriangle className="sale-cost-icon" size={14} aria-label={t('belowCost', 'Below cost')} />}
        </Button>;
      })}</div><EndlessListFooter list={productList} count={productList.items.length} noun={t('productsNoun', 'products')} labels={{ loadingMore: t('productsLoadingMore', 'Loading more products\u2026'), retry: t('tryAgain', 'Try again'), loadMore: t('loadMore', 'Load more'), end: t('productsEnd', `You\u2019re all caught up \u00b7 ${productList.items.length} products`, { count: productList.items.length }) }} /></> : <div className="mobile-empty-state"><span><PackageSearch size={28} /></span><h2>{t('noProducts', 'No products found')}</h2><p>{t('trySearchOrCategory', 'Try another search or category.')}</p></div>}
      {cart.length > 0 && <div className="retail-sale-summary"><div><small>{t('retailSelectedSummary', `${formatQuantity(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0))} units \u00b7 ${cart.length} lines`, { units: formatQuantity(cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)), lines: cart.length })}</small><strong>{money(selectedTotal, settings.currency || 'Ks')}</strong></div><Button variant="primary" type="button" className="mobile-primary" onClick={() => onNavigate('/sell/cart')}>{t('viewCart', 'View cart')}<ArrowRight size={23} aria-hidden="true" /></Button></div>}
      <ProductBarcodeScanner open={barcodeScannerOpen} title={t('scanBarcode', 'Scan barcode')} description="Point the rear camera at the product barcode. The matched product will be added to this sale." onClose={() => setBarcodeScannerOpen(false)} onDetected={(barcode) => { setBarcodeScannerOpen(false); void addBarcode(barcode); }} onManualBarcode={barcode=>{setBarcodeScannerOpen(false);void addBarcode(barcode);}} manualLabel={t('manualBarcode', 'Enter barcode manually')} manualSubmitLabel={t('searchBarcodeProduct', 'Search product')} />
    </main>
  );
}

function QuantityStep({ cart, setCart, onNavigate, settings, offlineMode }) {
  const { language, t } = useSellText();
  function updateItem(index, field, value) {
    if (value !== '' && !/^\d*\.?\d{0,3}$/.test(value)) return;
    setCart((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function normalizeItem(index, field, fallback) {
    setCart((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const value = Number(item[field]);
      return { ...item, [field]: Number.isFinite(value) && value >= 0 ? value : fallback };
    }));
  }

  const subtotal = saleTotals(cart, 0, 0).subtotal;
  const soldUnits = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const currency = settings.currency || 'Ks';
  return <main className="sale-page sale-form-page sale-retail-page sale-retail-cart">
    <RetailSaleHeading cart={cart} onNavigate={onNavigate} isCart />
    <SalePriceAlert cart={cart} /><p className="retail-cart-count">{t('retailCartSummary', `${cart.length} product lines \u00b7 ${formatQuantity(soldUnits)} sold units`, { lines: cart.length, units: formatQuantity(soldUnits) })}</p>
    {cart.length ? <section className="sale-quantity-section"><div className="sale-cart-list">{cart.map((item, index) => {
      const overStock = Number(item.quantity || 0) + Number(item.foc_quantity || 0) > Number(item.stock || 0);
      return <CartLineFrame key={`${item.product_id}-${item.price_type}`} photo={offlineMode ? null : item.photo_url} identity={<><h2>{item.product_name}</h2><span className="retail-stock-badge"><Package size={17} aria-hidden="true" />{t('inStock', `${formatQuantity(item.stock)} in stock`, { stock: formatQuantity(item.stock) })}</span><small>{sellOptionLabel(item.price_type, language)}{' \u00b7 '}{item.base_unit || t('unit', 'Unit')}</small><strong>{money(item.unit_price, currency)}</strong></>}>
        <div className="retail-cart-quantities">{['quantity', 'foc_quantity'].map(field => {
          const free = field === 'foc_quantity';
          const inputLabel = free ? t('freeQuantity', `${item.product_name} free quantity`, { name: item.product_name }) : t('productQuantity', `${item.product_name} quantity`, { name: item.product_name });
          return <Field key={field} label={free ? t('freeLabel', 'Free (FOC)') : t('soldLabel', 'Sold quantity')}><InputGroup as="span" className="ui-quantity-control"><IconButton variant="ghost" type="button" className="sale-quantity-button" aria-label={free ? t('decreaseFree', `Decrease ${item.product_name} free quantity`, { name: item.product_name }) : t('decreaseProduct', `Decrease ${item.product_name}`, { name: item.product_name })} onClick={() => updateItem(index, field, String(Math.max(0, Number(item[field] || 0) - 1)))}><Minus size={20} aria-hidden="true" /></IconButton><Input aria-label={inputLabel} inputMode="decimal" value={item[field]} onChange={event => updateItem(index, field, event.target.value)} onBlur={() => normalizeItem(index, field, 0)} /><IconButton variant="ghost" type="button" className="sale-quantity-button" aria-label={free ? t('increaseFree', `Increase ${item.product_name} free quantity`, { name: item.product_name }) : t('increaseProduct', `Increase ${item.product_name}`, { name: item.product_name })} onClick={() => updateItem(index, field, String(Number(item[field] || 0) + 1))}><Plus size={20} aria-hidden="true" /></IconButton></InputGroup></Field>;
        })}</div>
        <div className="retail-cart-line-total"><span><small>{t('lineTotalLabel', 'Line total')}</small><strong>{money(Number(item.quantity || 0) * item.unit_price, currency)}</strong></span><Button variant="danger-ghost" type="button" aria-label={t('removeProduct', `Remove ${item.product_name}`, { name: item.product_name })} onClick={() => setCart(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} aria-hidden="true" />{t('removeLabel', 'Remove')}</Button></div>
        {hasPurchaseUnit(item) && <Button variant="plain" className="sale-pack-button" type="button" onClick={() => updateItem(index, 'quantity', String(Number(item.quantity || 0) + Number(item.purchase_conversion_factor || 1)))}>+1 {item.purchase_unit} ({'\u00d7'}{formatQuantity(item.purchase_conversion_factor)})</Button>}
        {overStock && <p className="sale-warning"><AlertTriangle size={15} />{t('quantityExceedsStock', `Quantity exceeds stock (${formatQuantity(item.stock)})`, { stock: formatQuantity(item.stock) })}</p>}
        {priceMargin(item.unit_price, item.unit_cost).belowCost && <p className="sale-warning"><AlertTriangle size={15} />{t('sellingBelowCost', 'Selling below cost')}</p>}
      </CartLineFrame>;
    })}</div><Button variant="plain" type="button" className="retail-add-more" onClick={() => onNavigate('/sell', { back: true })}>{t('addMoreProducts', 'Add more products')}</Button></section> : <div className="mobile-empty-state compact"><span><ShoppingCart size={25} /></span><h2>{t('cartEmpty', 'Cart is empty')}</h2><p>{t('chooseBeforeQuantity', 'Choose at least one product before setting quantities.')}</p><Button variant="primary" className="mobile-primary" type="button" onClick={() => onNavigate('/sell', { back: true })}>{t('chooseProducts', 'Choose products')}</Button></div>}
    {cart.length > 0 && <div className="retail-sale-summary retail-cart-summary"><div><small>{t('subtotal', 'Subtotal')}</small><strong>{money(subtotal, currency)}</strong></div><Button variant="primary" className="mobile-primary" type="button" onClick={() => onNavigate('/sell/checkout')}>{t('continueCheckout', 'Continue to checkout')}<ArrowRight size={21} aria-hidden="true" /></Button></div>}
  </main>;
}

function SellSaleComplete({ receipt, currency, printing, onPrint, onNew }) {
  const { language, t } = useSellText();
  const sale = receipt.sale || {}, local = Boolean(receipt.local_receipt_no);
  const number = receipt.local_receipt_no || sale.receipt_no;
  const name = sale.customer_name || t('walkInCustomer', 'Walk-in customer');
  const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('');
  const date = sale.created_at ? new Date(sale.created_at) : null;
  return <div className="retail-complete-content"><section className="retail-complete-hero"><span><Check size={31} aria-hidden="true" /></span><strong>{t('saleComplete', 'Sale complete')}</strong><p>{t('receipt', 'Receipt')} <b>{number}</b></p>{date && !Number.isNaN(+date) && <small>{date.toLocaleString()}</small>}</section>
    <section className="retail-checkout-panel retail-complete-totals"><div className="retail-summary-row retail-summary-total"><strong>{t('total', 'Total')}</strong><strong>{money(sale.total,currency)}</strong></div><div className="retail-summary-row"><span>{t('paidNow', 'Paid now')}</span><strong>{money(sale.paid_amount,currency)}</strong></div><div className="retail-summary-row"><span>{t('balance', 'Balance')}</span><strong>{money(sale.credit_amount,currency)}</strong></div>{Number(sale.change)>0 && <div className="retail-summary-row"><span>{t('change','Change')}</span><strong>{money(sale.change,currency)}</strong></div>}</section>
    <section className="retail-checkout-panel"><h2 className="retail-checkout-label">{t('customer', 'Customer')}</h2><div className="retail-customer-profile"><span className="retail-customer-initials" aria-hidden="true">{initials}</span><div><strong>{name}</strong>{sale.customer_phone && <small>{sale.customer_phone}</small>}</div></div></section>
    <section className="retail-checkout-panel"><h2>{t('paymentMethod', 'Payment method')}</h2><div className="retail-complete-method"><CreditCard size={21} aria-hidden="true" /><span><strong>{sellOptionLabel(sale.payload?.payment_method || sale.payment_method || 'Cash',language)}</strong><small>{money(sale.paid_amount,currency)}</small></span></div></section>
    <p className="retail-complete-note"><Info size={18} aria-hidden="true" /><span>{local ? t('offlineSaleSaved', 'Saved safely on this device. Stock will be checked when the invoice syncs.') : t('saleRecorded', 'This sale is complete. Stock and account balances have been updated.')}</span></p>
    <div className="retail-complete-actions"><Button variant="primary" type="button" className="mobile-primary" disabled={printing} onClick={onPrint}>{printing ? <RefreshCw className="spin" size={18} /> : <Printer size={18} />}{printing ? t('printing', 'Printing…') : t('printReceipt', 'Print receipt')}</Button><Button variant="secondary" type="button" className="mobile-secondary" disabled={printing} onClick={onNew}><Plus size={18} />{t('startNewSale', 'Start new sale')}</Button></div>
  </div>;
}

function CheckoutStep({ draft, setDraft, settings, receipt, setReceipt, onNavigate, onCompleted, offlineMode, offlineState, session }) {
  const { language, t } = useSellText();
  const { cart, discount, paidAmount, paymentMethod, customer } = draft;
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const saveBusy = useRef(false), printBusy = useRef(false), formRef = useRef(null);
  const active = useContext(PageActivityContext), completionShown = useRef(false);
  const completed = Boolean(receipt && !cart.length);
  useEffect(() => { if (!completed) completionShown.current = false; else if (active && !completionShown.current) { completionShown.current = true; document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } }, [active,completed]);
  useEffect(() => { if (Object.keys(errors).length) formRef.current?.querySelector('[role="alert"]')?.scrollIntoView?.({block:'center',behavior:'instant'}); }, [errors]);
  const paymentMethods = useMemo(() => offlineMode ? offlinePaymentMethods(settings) : cleanPaymentMethods(settings), [offlineMode, settings]);
  const totals = useMemo(() => saleTotals(cart, discount, paidAmount), [cart, discount, paidAmount]);
  const currency = settings.currency || session?.business?.currency || 'Ks';
  const amount = value => money(value, currency);
  const focOnly = cart.length > 0 && cart.every((item) => Number(item.quantity) === 0) && cart.some((item) => Number(item.foc_quantity) > 0);
  const updateDraft = (change) => setDraft((current) => ({ ...current, ...change }));

  useEffect(() => { if (!paymentMethods.includes(paymentMethod)) setDraft((current) => ({ ...current, paymentMethod: paymentMethods[0] || 'Cash' })); }, [paymentMethod, paymentMethods, setDraft]);
  useEffect(() => {
    if (!offlineMode) return;
    setDraft((current) => {
      const total = saleTotals(current.cart, current.discount, current.paidAmount).total;
      if (!current.customer && Number(current.paidAmount) === total) return current;
      return { ...current, customer: null, paidAmount: String(total) };
    });
  }, [offlineMode, setDraft, totals.total]);

  async function checkout(event) {
    event.preventDefault();
    if (saveBusy.current) return;
    setNotice(null);
    setErrors({});
    if (!cart.length) return setNotice({ type: 'error', text: t('addBeforeCheckout', 'Add products before checkout.') });
    if (cart.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0 || !Number.isFinite(Number(item.foc_quantity)) || Number(item.foc_quantity) < 0 || Number(item.quantity) + Number(item.foc_quantity) <= 0)) return setErrors({ items: t('invalidQuantity', 'Every item needs a paid quantity or FOC quantity greater than zero.') });
    if (!offlineMode && totals.unpaid > 0 && !customer) return setErrors({ customer_id: t('customerRequired', 'Select a customer for the unpaid balance.') });
    try {
      saveBusy.current = true;
      setSaving(true);
      let sale;
      let nextReceipt;
      let receiptError = '';
      if (offlineMode) {
        sale = await createOfflineSale({ items: cart, discount, payment_method: paymentMethod });
        const data = await getOfflineData();
        nextReceipt = offlineReceiptPayload(sale, data.settings, session?.business || data.session?.business);
      } else {
        sale = await apiRequest('/sales', { method: 'POST', body: JSON.stringify(salePayload({ cart, discount, paidAmount, paymentMethod, customerId: customer?.id })) });
        try { nextReceipt = await apiRequest(`/sales/${sale.id}/receipt`); }
        catch (error) { receiptError = error.message; nextReceipt = { receipt_pending: true }; }
      }
      const savedSummary = { total: totals.total, subtotal: totals.subtotal, paid_amount: offlineMode ? totals.total : totals.paid, credit_amount: offlineMode ? 0 : totals.unpaid, customer_name: customer?.name || '', customer_phone: customer?.phone || '', payment_method: focOnly ? 'FOC' : totals.unpaid > 0 && totals.paid === 0 ? 'Credit' : paymentMethod, change: totals.change, created_at: new Date().toISOString(), ...sale };
      setReceipt({ ...nextReceipt, sale: { ...savedSummary, ...nextReceipt.sale } });
      setDraft({ ...EMPTY_SALE_DRAFT });
      setNotice(receiptError ? {type:'warning',text:t('savedReceiptUnavailable', 'Sale saved. The receipt is unavailable. Use Print receipt to retry without saving again.')} : null);
      await onCompleted();
    } catch (error) {
      if (!offlineMode && isConnectionFailure(error)) {
        announceOfflineDetected(error);
        setErrors({ general: t('connectionLostRetry', 'Connection lost. Tap Pay again to save this fully paid sale offline.') });
        return;
      }
      const fields = fieldErrorsFrom(error);
      setErrors(Object.keys(fields).length ? fields : { general: error.message });
    } finally { saveBusy.current = false; setSaving(false); }
  }

  async function printActiveReceipt() {
    if (printBusy.current) return;
    printBusy.current = true; setPrinting(true); setNotice(null);
    let active = receipt;
    try {
      if (active?.receipt_pending) { const loaded = await apiRequest(`/sales/${active.sale.id}/receipt`); active = { ...loaded, sale: { ...active.sale, ...loaded.sale } }; }
      if (!active && offlineMode) {
        const latest = (await listOfflineSales({ limit: 1 })).items[0];
        if (!latest) throw new Error(t('noOfflineInvoices', 'No offline invoices'));
        const data = await getOfflineData();
        active = offlineReceiptPayload(latest, data.settings, session?.business || data.session?.business);
      } else if (!active) active = await apiRequest('/sales/last/receipt');
      setReceipt(active);
      if (!await printHtmlDocument({ title: active.local_receipt_no || active.sale?.receipt_no || t('receipt', 'Receipt'), html: active.html, text: active.text, ...receiptOptions(active, settings) })) setNotice({ type: 'error', text: t('allowPopups', 'Allow pop-ups to print the receipt.') });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { printBusy.current = false; setPrinting(false); }
  }

  if (receipt && !cart.length) {
    return <main className="sale-page sale-form-page sale-retail-page sale-checkout-complete"><RetailSaleHeading title={t('saleComplete', 'Sale complete')} cart={[]} onNavigate={onNavigate} isCheckout backPath="/sell" /><MobileNotice notice={notice} onClose={() => setNotice(null)} dismissLabel={t('dismissMessage', 'Dismiss message')} /><SellSaleComplete receipt={receipt} currency={currency} printing={printing} onPrint={printActiveReceipt} onNew={() => { setReceipt(null); onNavigate('/sell', { reset: true, replace: true }); }} /></main>;
  }

  const [paidWhole, ...paidFraction] = String(paidAmount ?? '').split('.');
  const paidDisplay = paidWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (paidFraction.length ? `.${paidFraction.join('')}` : '');
  const initials = (customer?.name || t('walkInCustomer', 'Walk-in customer')).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const soldUnits = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return <main className="sale-page sale-form-page sale-retail-page sale-retail-checkout">
    <RetailSaleHeading cart={cart} onNavigate={onNavigate} isCheckout onPrintLast={printActiveReceipt} />
    <p className={`retail-connection-status${offlineMode ? ' is-offline' : ''}`}><span aria-hidden="true" />{offlineMode ? t('offlineMode', 'Offline mode') : t('onlineStatus', 'Online')}{' \u00b7 '}{offlineState?.cache_ready ? t('cacheReady', 'Offline cache ready') : t('cacheNotReady', 'Offline cache not ready')}</p>
    <MobileNotice notice={notice} onClose={() => setNotice(null)} dismissLabel={t('dismissMessage', 'Dismiss message')} />
    <SalePriceAlert cart={cart} />{cart.length ? <form ref={formRef} className="sale-checkout-form retail-checkout-form" onSubmit={checkout} noValidate>
      {offlineMode && <div className="mobile-notice mobile-notice--warning sale-offline-checkout"><WifiOff size={18} /><span><strong>{t('offlineFullyPaid', 'Offline \u00b7 fully paid sale')}</strong><small>{t('offlineWalkInOnly', 'Walk-in customer only. This invoice will sync automatically.')}</small></span></div>}
      {errors.items && <p className="mobile-field-error" role="alert">{errors.items}</p>}
      <section className="retail-checkout-panel retail-checkout-customer">
        <h2 className="retail-checkout-label">{t('customer', 'Customer')}</h2>
        <div className="retail-customer-profile"><span className="retail-customer-initials" aria-hidden="true">{initials}</span><div><strong>{customer?.name || t('walkInCustomer', 'Walk-in customer')}</strong><small>{customer ? [t('retailCustomer', 'Retail Customer'), customer.code || customer.customer_code || customer.phone].filter(Boolean).join(' \u00b7 ') : t('noAccountBalance', 'No account balance')}</small></div><Button variant="plain" type="button" disabled={offlineMode || saving} className="retail-change-customer" aria-describedby={errors.customer_id ? 'sale-customer-error' : undefined} onClick={() => setCustomerPickerOpen(true)}>{t('changeCustomer', 'Change')}</Button></div>
        {!focOnly && <p className="retail-customer-hint"><UserRound size={19} aria-hidden="true" /><span>{t('customerBalanceHint', 'Customer is required when there is an outstanding balance.')}</span></p>}
        {errors.customer_id && <p id="sale-customer-error" className="mobile-field-error" role="alert">{errors.customer_id}</p>}
      </section>
      <section className="retail-checkout-panel retail-order-summary">
        <div className="retail-panel-heading"><h2>{t('orderSummary', 'Order summary')}</h2><small>{t('retailSelectedSummary', `${formatQuantity(soldUnits)} units \u00b7 ${cart.length} lines`, { units: formatQuantity(soldUnits), lines: cart.length })}</small></div>
        <div className="retail-summary-row"><span>{t('subtotal', 'Subtotal')}</span><span>{amount(totals.subtotal)}</span></div>
        <div className="retail-summary-row"><label htmlFor="sale-discount">{t('discount', 'Discount')}</label><InputGroup as="span" className="retail-inline-discount"><Input aria-label={t('discount', 'Discount')} id="sale-discount" type="number" min="0" inputMode="numeric" value={discount} disabled={saving} onChange={event => updateDraft({ discount: event.target.value })} /><span>{currency}</span></InputGroup></div>
        <div className="retail-summary-row retail-summary-total"><strong>{t('total', 'Total')}</strong><strong>{amount(totals.total)}</strong></div>
      {focOnly ? <div className="mobile-notice mobile-notice--success"><Check size={18} /><span><strong>{t('focSale', 'FOC sale')}</strong><small>{t('focNoPayment', 'No payment or customer is required.')}</small></span></div> : <>
        <div className="retail-checkout-payment-method"><h3>{t('paymentMethod', 'Payment method')}</h3><div className="retail-payment-methods" role="radiogroup" aria-label={t('paymentMethod', 'Payment method')}>{paymentMethods.map(method => <label className={paymentMethod === method ? 'is-selected' : ''} key={method}><Radio type="radio" name="sale-payment-method" value={method} checked={paymentMethod === method} disabled={saving} onChange={() => updateDraft({ paymentMethod: method })} /><span>{sellOptionLabel(method, language)}</span></label>)}</div></div>
        <div className="retail-payment-details"><div className="retail-paid-heading"><label className="retail-paid-label" htmlFor="sale-paid-amount">{t('paidNow', 'Paid now')}</label><Button variant="secondary" className="retail-pay-full" type="button" disabled={offlineMode || saving} onClick={() => updateDraft({ paidAmount: String(totals.total) })}>{t('payFull', 'Pay full')}</Button></div>
          <InputGroup className="retail-paid-field ui-input-group--suffix"><Input id="sale-paid-amount" aria-label={t('paidAmount', 'Paid amount')} type="text" inputMode="decimal" value={paidDisplay} disabled={offlineMode || saving} onChange={event => { const value = event.target.value.replaceAll(',', ''); if (/^\d*\.?\d*$/.test(value)) updateDraft({ paidAmount: value }); }} placeholder="0" />{paidAmount !== '' && <IconButton variant="ghost" type="button" disabled={offlineMode || saving} aria-label={t('clearPaidAmount', 'Clear paid amount')} onClick={() => updateDraft({ paidAmount: '' })}><X size={14} aria-hidden="true" /></IconButton>}<span>{currency}</span></InputGroup>
          <div className="retail-checkout-balance"><span><strong>{t('balance', 'Balance')}</strong><small>{totals.unpaid > 0 ? t('customerOwesShop', 'Customer owes shop') : t('fullyPaid', 'Fully paid')}</small></span><strong>{amount(totals.unpaid)}</strong></div>
          {totals.change > 0 && <div className="retail-checkout-balance"><span>{t('change', 'Change')}</span><strong>{amount(totals.change)}</strong></div>}
        </div>
      </>}
      </section>

      {errors.general && <div className="mobile-notice mobile-notice--error" role="alert">{errors.general}</div>}
      <div className="retail-checkout-actions"><Button variant="primary" className="mobile-primary" type="submit" disabled={saving}>{saving ? <><RefreshCw className="spin" size={18} />{t('saving', 'Saving\u2026')}</> : focOnly ? t('completeFocSale', 'Complete FOC sale') : t('completeSaleAmount', `Complete sale (${amount(totals.total)})`, { amount: amount(totals.total) })}</Button></div>
    </form> : <div className="mobile-empty-state compact"><span><ShoppingCart size={25} /></span><h2>{t('cartEmpty', 'Cart is empty')}</h2><p>{t('chooseBeforeCheckout', 'Choose products before checkout.')}</p><Button variant="primary" className="mobile-primary" type="button" onClick={() => onNavigate('/sell')}>{t('chooseProducts', 'Choose products')}</Button></div>}
    {!offlineMode && <MobileSheet open={customerPickerOpen} title={t('chooseCustomer', 'Choose customer')} description={t('customerPickerDescription', 'Required only when an unpaid balance remains.')} className="retail-customer-sheet" closeLabel={t('closeCustomerPicker', 'Close customer picker')} onClose={() => setCustomerPickerOpen(false)}><CustomerPicker confirmSelection selected={customer} onSelect={next => { updateDraft({ customer: next }); setCustomerPickerOpen(false); setErrors(current => ({ ...current, customer_id: '' })); }} onCreate={() => { setCustomerPickerOpen(false); onNavigate('/sell/customer/new'); }} /></MobileSheet>}
  </main>;
}

export function SaleScreen({ pathname = '/sell', onNavigate = () => {}, offlineMode = false, session = null }) {
  const draftKey = session ? `${DRAFT_KEY}:${session.user?.id || ''}:${session.business?.id || ''}` : DRAFT_KEY;
  const page = salePageFromPath(pathname);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState('name_asc');
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState({});
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const [receipt, setReceipt] = useState(null);
  const [metaNotice, setMetaNotice] = useState(null);
  const [offlineState, setOfflineState] = useState({ pending_count: 0, failed_count: 0, cache_ready: false });

  useEffect(() => { window.sessionStorage.setItem(draftKey, JSON.stringify(draft)); }, [draft, draftKey]);
  const setCart = useCallback((updater) => setDraft((current) => ({ ...current, cart: typeof updater === 'function' ? updater(current.cart) : updater })), []);

  const loadProducts = useCallback(async ({ limit, offset, signal }) => {
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (categoryFilter) params.set('category', categoryFilter);
    params.set('sort', sort);
    if (offlineMode) return cachedProductPage({ q: debouncedSearch, category: categoryFilter, sort, limit, offset });
    try {
      return await apiRequest(`/products?${params}`, { signal });
    } catch (error) {
      if (!signal?.aborted && isConnectionFailure(error)) {
        announceOfflineDetected(error);
        return cachedProductPage({ q: debouncedSearch, category: categoryFilter, sort, limit, offset });
      }
      throw error;
    }
  }, [categoryFilter, debouncedSearch, offlineMode, sort]);
  const productList = useEndlessList({ loadPage: loadProducts, queryKey: `${debouncedSearch}|${categoryFilter}|${offlineMode}|${sort}`, pageSize: PAGE_SIZE });

  const loadMeta = useCallback(async (signal) => {
    try {
      if (offlineMode) {
        const data = await getOfflineData();
        setCategories(data.categories || []);
        setSettings(data.settings || {});
        return;
      }
      const [categoryRows, settingRows] = await Promise.all([apiRequest('/categories', { signal }), apiRequest('/settings', { signal })]);
      setCategories(categoryRows || []);
      setSettings(settingRows || {});
    } catch (error) {
      if (!signal?.aborted && isConnectionFailure(error)) {
        announceOfflineDetected(error);
        const data = await getOfflineData();
        setCategories(data.categories || []);
        setSettings(data.settings || {});
        return;
      }
      throw error;
    }
  }, [offlineMode]);
  useEffect(() => { const controller = new AbortController(); loadMeta(controller.signal).catch((error) => !controller.signal.aborted && setMetaNotice({ type: 'error', text: error.message })); return () => controller.abort(); }, [loadMeta]);
  const refreshAll = useCallback(() => page === 'products' ? Promise.all([productList.reload(), loadMeta()]) : loadMeta(), [loadMeta, page, productList]);
  usePageRefresh(page === 'offline-sales' ? null : refreshAll, { dataPath: '/sell', reconcilePage: () => Promise.all([productList.reload(), loadMeta()]) });

  const refreshOfflineState = useCallback(() => getOfflineBootstrap().then(setOfflineState).catch(() => undefined), []);
  useEffect(() => {
    void refreshOfflineState();
    function update(event) {
      if (event.detail?.bootstrap) setOfflineState(event.detail.bootstrap);
      else void refreshOfflineState();
    }
    window.addEventListener(OFFLINE_STATE_EVENT, update);
    return () => window.removeEventListener(OFFLINE_STATE_EVENT, update);
  }, [refreshOfflineState]);

  const renderPage = () => {
  if (page === 'offline-sales') return <OfflineSalesPage offlineMode={offlineMode} session={session} onNavigate={onNavigate} />;
  if (page === 'cart') return <QuantityStep cart={draft.cart} setCart={setCart} onNavigate={onNavigate} settings={settings} offlineMode={offlineMode} />;
  if (page === 'new-customer') return <NewCheckoutCustomer draft={draft} settings={settings} setDraft={setDraft} onNavigate={onNavigate} />;
  if (page === 'checkout') return <CheckoutStep draft={draft} setDraft={setDraft} settings={settings} receipt={receipt} setReceipt={setReceipt} onNavigate={onNavigate} onCompleted={refreshOfflineState} offlineMode={offlineMode} offlineState={offlineState} session={session} />;
  return <ProductStep cart={draft.cart} setCart={setCart} priceType={draft.priceType} setDraft={setDraft} categories={categories} settings={settings} productList={productList} onNavigate={onNavigate} onSearchChange={setDebouncedSearch} onCategoryChange={setCategoryFilter} sort={sort} onSortChange={setSort} externalNotice={metaNotice} clearExternalNotice={() => setMetaNotice(null)} offlineMode={offlineMode} offlineState={offlineState} />;
  };
  return <RetainedViews activeKey={page}>{renderPage()}</RetainedViews>;
}
