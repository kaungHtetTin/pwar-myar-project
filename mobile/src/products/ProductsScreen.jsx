import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { FloatingActionButton, ChoiceGroup, Button, Checkbox, Field, IconButton, Input, Radio, SearchInput, Select } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Edit3,
  FileUp,
  EllipsisVertical,
  Package,
  PackageOpen,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { MobileDeleteSheet, MobileFilterPanel, MobileFilterToggle, MobileSheet } from '../components/MobilePrimitives';
import { renderBarcodeSvg } from './barcodePrinting';
import { BARCODE_LABEL_FORMATS, barcodePrintDocument } from './barcodeSettings';
import { useEndlessList } from '../hooks/useEndlessList';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { useLocale } from '../localization/LocaleContext';
import { translateModuleText } from '../localization/moduleText';
import { usePageRefresh } from '../navigation/pageRefresh';
import {
  DEFAULT_PRICE_TYPES,
  automaticSellingPrice,
  baseUnitName,
  belowCostPrices,
  blankProductForm,
  formatQuantity,
  hasPurchaseUnit,
  money,
  normalizeNumber,
  priceRuleMap,
  productPrice,
  productPriceFormRows,
  productPriceRows,
  stockStatus,
  stockStatusLabel,
  stockWithUnit,
} from './productUtils';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { ProductReferenceForm } from './ProductReferenceForm';
import { ProductReferenceHeader } from './ProductReferenceParts';
import { ProductReferenceStock } from './ProductReferenceStock';
import { ProductPhoto } from './ProductPhoto.jsx';
import { PRODUCT_MESSAGES, PRODUCT_PATTERNS } from './productsLocale';
import { isNativeAndroidPrinting, printDocumentHtml, reserveBrowserPrintWindow } from '../utils/printing';
import { ProductBarcodeScanner } from './ProductBarcodeScanner';
import { ProductImportPage } from './ProductImportPage';

const PAGE_SIZE = 20;
const EMPTY_SUMMARY = { total_products: 0, total_stock_units: 0, low_stock: 0, out_of_stock: 0 };

function productPageFromPath(pathname) {
  if (pathname === '/products/new') return { kind: 'new', productId: null };
  const editMatch = pathname.match(/^\/products\/(\d+)\/edit$/);
  if (editMatch) return { kind: 'edit', productId: Number(editMatch[1]) };
  const stockMatch = pathname.match(/^\/products\/(\d+)\/stock$/);
  if (stockMatch) return { kind: 'stock', productId: Number(stockMatch[1]) };
  return { kind: 'list', productId: null };
}

function fieldErrorsFrom(error) {
  return Object.fromEntries(Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [
    field,
    Array.isArray(messages) ? messages[0] : String(messages),
  ]));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function Sheet({ wide = false, className = '', ...props }) {
  return <MobileSheet {...props} className={`${wide ? 'mobile-sheet--wide ' : ''}${className}`} />;
}

function BarcodePreview({ value }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try { ref.current.innerHTML = renderBarcodeSvg(value); } catch { ref.current.textContent = 'Barcode unavailable'; }
  }, [value]);
  return <span className="product-barcode-preview" ref={ref} role="img" aria-label={`Barcode ${value}`} />;
}

function LoadingCards() {
  return (
    <div className="product-card-list" role="status" aria-label="Loading products">
      <p className="product-reference-loading"><RefreshCw size={17} className="spin" />Loading products...</p>
      {[1, 2, 3].map((key) => <div className="product-card product-card--skeleton" key={key}><span /><span /><span /></div>)}
    </div>
  );
}

function EndlessFooter({ list, itemCount, noun = 'items' }) {
  return (
    <div className="endless-list-footer" ref={list.sentinelRef}>
      {list.loadingMore && <p role="status"><RefreshCw className="spin" size={17} />Loading more {noun}…</p>}
      {list.error && itemCount > 0 && <div className="endless-list-error"><span>{list.error}</span><Button variant="plain" type="button" onClick={list.retry}>Try again</Button></div>}
      {list.hasMore && !list.loadingMore && !list.error && !list.observerSupported && <Button variant="secondary" className="mobile-secondary" type="button" onClick={list.loadMore}>Load more</Button>}
      {!list.hasMore && itemCount > 0 && <p className="endless-list-end">You’re all caught up · {itemCount} {noun}</p>}
    </div>
  );
}

function StockStatusContent({ status, onAdjust }) {
  const loadPage = useCallback(({ limit, offset, signal }) => {
    const params = new URLSearchParams({ stock_status: status, with_total: 'true', limit: String(limit), offset: String(offset) });
    return apiRequest(`/products?${params}`, { signal });
  }, [status]);
  const list = useEndlessList({ loadPage, queryKey: status, pageSize: PAGE_SIZE, enabled: Boolean(status) });

  if (list.initialLoading) return <p className="mobile-inline-loading"><RefreshCw className="spin" size={17} />Loading products…</p>;
  if (list.error && !list.items.length) return <div className="endless-first-error"><p>{list.error}</p><Button variant="plain" type="button" onClick={list.retry}>Try again</Button></div>;
  if (!list.items.length) return <p className="mobile-inline-empty">No products in this stock status.</p>;
  return (
    <>
      <div className="compact-product-list">
        {list.items.map((product) => (
          <article key={product.id}>
            <div><strong data-no-localize>{product.name}</strong><small data-no-localize={product.sku || product.barcode || product.category ? true : undefined}>{product.sku || product.barcode || product.category || 'No product code'}</small></div>
            <span className={`product-stock--${stockStatus(product)}`}>{stockWithUnit(product)}</span>
            <Button variant="plain" type="button" onClick={() => onAdjust(product)}>Adjust</Button>
          </article>
        ))}
      </div>
      <EndlessFooter list={list} itemCount={list.items.length} noun="products" />
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, onClick }) {
  const content = <><span className="summary-icon"><Icon size={19} /></span><span><small>{label}</small><strong>{value}</strong></span></>;
  return onClick
    ? <Button variant="plain" type="button" className={`mobile-summary-card ${tone || ''}`} onClick={onClick}>{content}</Button>
    : <div className={`mobile-summary-card ${tone || ''}`}>{content}</div>;
}

function ProductCard({ product, currency, deleting, onEdit, onAdjust, onPrint, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = stockStatus(product);
  const prices = productPriceRows(product);
  const belowCost = belowCostPrices(product).length > 0;
  const runAction = (action) => {
    setMenuOpen(false);
    action(product);
  };
  return (
    <>
      <article className={`product-card product-card--${status}${product.is_pending ? ' is-pending' : ''}`}>
        <span className="product-reference-card-media">{product.photo_url ? <ProductPhoto path={product.photo_url} /> : <Package size={32} />}</span>
        <div className="product-reference-card-copy"><h3 data-no-localize>{product.name}</h3><p data-no-localize>{product.sku || 'No SKU'}</p><span className={`stock-pill stock-pill--${status}`}><Package size={14} />{formatQuantity(product.stock)} {status === 'in_stock' ? 'in stock' : stockStatusLabel(status)}</span><strong className="product-reference-card-price">{prices.length ? money(prices[0].price, currency) : 'Not set'}</strong><small>per {baseUnitName(product)}</small></div>
        <IconButton variant="ghost" type="button" className="product-card-menu-button" aria-label={`Actions for ${product.name}`} aria-expanded={menuOpen} disabled={product.is_pending} onClick={() => setMenuOpen(true)}><EllipsisVertical size={20} /></IconButton>
        {belowCost && <div className="below-cost-alert"><AlertTriangle size={15} /> Selling price below cost</div>}
      </article>
      <Sheet open={menuOpen} title="Product actions" description={product.name} className="mobile-sheet--action-menu" onClose={() => setMenuOpen(false)}>
        <div className="mobile-action-menu">
          <Button variant="plain" type="button" aria-label="Stock" disabled={product.is_pending} onClick={() => runAction(onAdjust)}><RefreshCw size={19} /><span><strong>Stock</strong><small>View history and adjust quantity</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button>
          <Button variant="plain" type="button" aria-label="Edit" disabled={product.is_pending} onClick={() => runAction(onEdit)}><Edit3 size={19} /><span><strong>Edit</strong><small>Update product information</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button>
          <Button variant="plain" type="button" aria-label="Print barcode" disabled={product.is_pending || !product.barcode} onClick={() => runAction(onPrint)}><Printer size={19} /><span><strong>Print barcode</strong><small>{product.barcode ? 'Print a label for this product' : 'No barcode assigned'}</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button>
          <Button variant="danger-ghost" type="button" aria-label="Delete" className="danger-action" disabled={product.is_pending || deleting} onClick={() => runAction(onDelete)}>{deleting ? <RefreshCw className="spin" size={19} /> : <Trash2 size={19} />}<span><strong>Delete</strong><small>Remove this product</small></span><ChevronRight className="mobile-action-chevron" size={18} /></Button>
        </div>
      </Sheet>
    </>
  );
}

function ProductsScreenContent({ pathname, onNavigate, session }) {
  const { language } = useLocale();
  const currency = session?.business?.currency || 'Ks';
  const [localPathname, setLocalPathname] = useState('/products');
  const currentPathname = pathname || localPathname;
  const productPage = useMemo(() => productPageFromPath(currentPathname), [currentPathname]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [categories, setCategories] = useState([]);
  const [priceTypes, setPriceTypes] = useState(DEFAULT_PRICE_TYPES);
  const [priceRules, setPriceRules] = useState({});
  const [metaReady, setMetaReady] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState('');
  const [draftStock, setDraftStock] = useState('all');
  const [sort, setSort] = useState('name_asc');
  const [draftSort, setDraftSort] = useState('name_asc');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [barcodePickerOpen, setBarcodePickerOpen] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [debouncedBarcodeSearch, setDebouncedBarcodeSearch] = useState('');
  const [barcodeCategory, setBarcodeCategory] = useState('');
  const [selectedBarcodeIds, setSelectedBarcodeIds] = useState(() => new Set());
  const [barcodeInitialProductId, setBarcodeInitialProductId] = useState(null);
  const [barcodePrintFormat, setBarcodePrintFormat] = useState('');
  const [barcodePrinting, setBarcodePrinting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(blankProductForm());
  const [formResetVersion, setFormResetVersion] = useState(0);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockListStatus, setStockListStatus] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const initializedRouteRef = useRef('/products');
  const priceTypesRef = useRef(priceTypes);
  const priceRulesRef = useRef(priceRules);
  const mutationRef = useRef(false);
  priceTypesRef.current = priceTypes;
  priceRulesRef.current = priceRules;

  function navigateTo(path, options = {}) {
    if (onNavigate) onNavigate(path, options);
    else setLocalPathname(path);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedBarcodeSearch(barcodeSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [barcodeSearch]);

  const loadProductPage = useCallback(({ limit, offset, signal }) => {
    if (scannedBarcode) {
      if (offset > 0) return Promise.resolve({ items: [], total: 1, limit, offset });
      return apiRequest(`/products/barcode/${encodeURIComponent(scannedBarcode)}`, { signal })
        .then((product) => ({ items: [product], total: 1, limit, offset }));
    }
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (category) params.set('category', category);
    if (stockFilter !== 'all') params.set('stock_status', stockFilter);
    params.set('sort', sort);
    return apiRequest(`/products?${params}`, { signal });
  }, [category, debouncedSearch, scannedBarcode, stockFilter, sort]);

  const productList = useEndlessList({
    loadPage: loadProductPage,
    queryKey: JSON.stringify([debouncedSearch, category, stockFilter, scannedBarcode, sort]),
    pageSize: PAGE_SIZE,
  });
  const products = productList.items;
  const total = productList.total ?? products.length;
  const loadBarcodePage = useCallback(({ limit, offset, signal }) => {
    const params = new URLSearchParams({ with_total: 'true', has_barcode: 'true', limit: String(limit), offset: String(offset) });
    if (debouncedBarcodeSearch) params.set('q', debouncedBarcodeSearch);
    if (barcodeCategory) params.set('category', barcodeCategory);
    return apiRequest(`/products?${params}`, { signal });
  }, [barcodeCategory, debouncedBarcodeSearch]);
  const barcodeList = useEndlessList({
    loadPage: loadBarcodePage,
    queryKey: JSON.stringify([debouncedBarcodeSearch, barcodeCategory]),
    pageSize: PAGE_SIZE,
    enabled: barcodePickerOpen,
  });
  useEffect(() => {
    if (barcodePickerOpen) setSelectedBarcodeIds(barcodeInitialProductId ? new Set([barcodeInitialProductId]) : new Set());
  }, [barcodeCategory, debouncedBarcodeSearch, barcodeInitialProductId, barcodePickerOpen]);
  const barcodeProducts = barcodeList.items;
  const selectedBarcodeProducts = barcodeProducts.filter((product) => selectedBarcodeIds.has(product.id));
  const allLoadedBarcodesSelected = barcodeProducts.length > 0 && barcodeProducts.every((product) => selectedBarcodeIds.has(product.id));
  const stockAdjustment = stockQuantity === '' ? 0 : normalizeNumber(stockQuantity, NaN);
  const currentStock = normalizeNumber(stockProduct?.stock, 0);
  const adjustedStock = Number.isFinite(stockAdjustment) ? currentStock + stockAdjustment : currentStock;
  const stockAdjustmentIsValid = Number.isFinite(stockAdjustment) && stockAdjustment !== 0 && adjustedStock >= 0;
  const stockProductId = stockProduct?.id || null;
  const loadMovementPage = useCallback(({ limit, offset, signal }) => {
    if (!stockProductId) return Promise.resolve({ items: [], total: 0 });
    const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
    return apiRequest(`/products/${stockProductId}/stock-movements?${params}`, { signal });
  }, [stockProductId]);
  const movementList = useEndlessList({
    loadPage: loadMovementPage,
    queryKey: stockProductId || 'closed',
    pageSize: PAGE_SIZE,
    enabled: Boolean(stockProductId),
  });

  const loadMeta = useCallback(async () => {
    try {
      const [categoryRows, productSummary, priceTypePayload] = await Promise.all([
        apiRequest('/categories'), apiRequest('/products/summary'), apiRequest('/price-types'),
      ]);
      setCategories(categoryRows || []);
      setSummary(productSummary || EMPTY_SUMMARY);
      setPriceTypes(priceTypePayload?.items || DEFAULT_PRICE_TYPES);
      setPriceRules(priceRuleMap(priceTypePayload));
    } catch (error) {
      setNotice({ type: 'error', text: `Cannot load inventory summary. ${error.message}` });
    } finally {
      setMetaReady(true);
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  useEffect(() => {
    if (!metaReady) return undefined;
    if (initializedRouteRef.current === currentPathname) return undefined;
    initializedRouteRef.current = currentPathname;
    setRouteError('');

    if (productPage.kind === 'list') {
      setRouteLoading(false);
      return undefined;
    }
    if (productPage.kind === 'new') {
      setEditingId(null);
      setForm(blankProductForm(priceTypesRef.current, priceRulesRef.current));
      setFormErrors({});
      setRouteLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    apiRequest(`/products/${productPage.productId}`, { signal: controller.signal })
      .then((product) => {
        if (controller.signal.aborted) return;
        if (productPage.kind === 'edit') {
          setEditingId(product.id);
          setForm({ ...product, marketplace_category_original_id: product.marketplace_category_id, photo_file: null, remove_photo: false, prices: productPriceFormRows(priceTypesRef.current, product, priceRulesRef.current), low_stock_threshold: product.low_stock_threshold || 0 });
          setFormErrors({});
        } else {
          setStockProduct(product);
          setStockQuantity('');
          setStockReason('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setRouteError(error.message || 'Cannot load this product.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });

    return () => {
      controller.abort();
      if (initializedRouteRef.current === currentPathname) initializedRouteRef.current = null;
    };
  }, [currentPathname, productPage.kind, productPage.productId, metaReady]);

  async function refreshAll(message) {
    await Promise.all([productList.reload(), loadMeta()]);
    if (message) setNotice({ type: 'success', text: message });
  }

  usePageRefresh(() => productPage.kind === 'list' ? refreshAll() : loadMeta());

  function openAdd() {
    setEditingId(null);
    setForm(blankProductForm(priceTypes, priceRules));
    setFormErrors({});
    initializedRouteRef.current = '/products/new';
    navigateTo('/products/new');
  }

  function resetCreatedProductForm() {
    if (editingId) return;
    setForm(blankProductForm(priceTypesRef.current, priceRulesRef.current));
    setFormErrors({});
    // Reset wizard, scanner and photo state inside the retained creation page.
    setFormResetVersion(current => current + 1);
  }

  function updateProductSearch(value) {
    setScannedBarcode('');
    setSearch(value);
  }

  function clearProductSearch() {
    setScannedBarcode('');
    setSearch('');
  }

  function acceptScannedBarcode(barcode) {
    setCategory('');
    setStockFilter('all');
    setFiltersOpen(false);
    setSearch(barcode);
    setDebouncedSearch(barcode);
    setScannedBarcode(barcode);
    setBarcodeScannerOpen(false);
  }

  function openEdit(product) {
    setEditingId(product.id);
    setForm({ ...product, photo_file: null, remove_photo: false, prices: productPriceFormRows(priceTypes, product, priceRules), low_stock_threshold: product.low_stock_threshold || 0 });
    setFormErrors({});
    const path = `/products/${product.id}/edit`;
    initializedRouteRef.current = path;
    navigateTo(path);
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (mutationRef.current) return;
    const name = String(form.name || '').trim();
    if (!name) {
      setFormErrors({ name: 'Product name is required.' });
      return;
    }
    const prices = (form.prices || []).map((price) => ({
      name: String(price.name || '').trim(),
      price: price.is_manual === false ? automaticSellingPrice(form.cost, priceRules[String(price.name || '').toLowerCase()]) : normalizeNumber(price.price, 0),
      is_manual: price.is_manual !== false,
    })).filter((price) => price.name && price.price >= 0);
    const retail = prices.find((price) => price.name === 'Retail') || prices[0];
    const payload = {
      name, sku: String(form.sku || '').trim(), barcode: String(form.barcode || '').trim(), category: String(form.category || '').trim(),
      base_unit: String(form.base_unit || '').trim() || 'Unit', purchase_unit: String(form.purchase_unit || '').trim() || null,
      purchase_conversion_factor: normalizeNumber(form.purchase_conversion_factor, 1), price: normalizeNumber(retail?.price, 0),
      cost: normalizeNumber(form.cost, 0), stock: normalizeNumber(form.stock, 0), low_stock_threshold: normalizeNumber(form.low_stock_threshold, 0),
      is_active: true, prices,
      ...((editingId ? String(form.marketplace_category_id || '') !== String(form.marketplace_category_original_id || '') : Boolean(form.marketplace_category_id)) ? { marketplace_category_id: Number(form.marketplace_category_id) || null, marketplace_category_version: Number(form.marketplace_category_version) || 0 } : {}),
      ...(form.online_description !== undefined ? { online_description: String(form.online_description).trim() } : {}),
    };
    if (!prices.length) return setFormErrors({ general: 'Add at least one valid price type.' });
    if (payload.cost < 0 || payload.stock < 0 || payload.low_stock_threshold < 0) return setFormErrors({ general: 'Cost, stock, and low-stock alert must be zero or positive.' });
    if (payload.purchase_unit && (payload.purchase_conversion_factor <= 1 || payload.purchase_unit.toLowerCase() === payload.base_unit.toLowerCase())) {
      return setFormErrors({ purchase_conversion_factor: 'Purchase unit must be different and contain more than one base unit.' });
    }
    mutationRef.current = true;
    setSaving(true);
    setFormErrors({});
    try {
      const savedProduct = await apiRequest(editingId ? `/products/${editingId}` : '/products', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      try {
        if (form.photo_file) {
          const photoBody = new FormData();
          photoBody.append('photo', form.photo_file, form.photo_file.name || 'product-photo.jpg');
          await apiRequest(`/products/${savedProduct.id}/photo`, { method: 'POST', body: photoBody });
        } else if (form.remove_photo && editingId) {
          await apiRequest(`/products/${savedProduct.id}/photo`, { method: 'DELETE' });
        }
      } catch (photoError) {
        resetCreatedProductForm();
        await refreshAll();
        setNotice({ type: 'error', text: `Product saved, but the photo could not be updated. ${photoError.message}` });
        navigateTo('/products', { back: true });
        return;
      }
      resetCreatedProductForm();
      await refreshAll(editingId ? 'Product updated.' : 'Product created.');
      navigateTo('/products', { back: true });
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFormErrors(Object.keys(errors).length ? errors : { general: error.message });
    } finally {
      mutationRef.current = false;
      setSaving(false);
    }
    return undefined;
  }

  async function deleteProduct() {
    if (!deletingProduct) return;
    setDeletingId(deletingProduct.id);
    try {
      await apiRequest(`/products/${deletingProduct.id}`, { method: 'DELETE' });
      setDeletingProduct(null);
      await refreshAll('Product deleted. Linked history was preserved.');
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setDeletingId(null);
    }
  }

  function openStock(product) {
    setStockProduct(product);
    setStockQuantity('');
    setStockReason('');
    const path = `/products/${product.id}/stock`;
    initializedRouteRef.current = path;
    navigateTo(path);
  }

  async function adjustStock(event) {
    event.preventDefault();
    if (mutationRef.current) return;
    const quantity = normalizeNumber(stockQuantity, NaN);
    if (!Number.isFinite(quantity) || quantity === 0) {
      setNotice({ type: 'error', text: 'Adjustment quantity must be a non-zero number.' });
      return;
    }
    if (normalizeNumber(stockProduct?.stock, 0) + quantity < 0) {
      setNotice({ type: 'error', text: 'Final quantity cannot be below zero.' });
      return;
    }
    mutationRef.current = true;
    setStockLoading(true);
    try {
      const params = new URLSearchParams({ quantity: String(quantity) });
      if (stockReason.trim()) params.set('reason', stockReason.trim());
      const updated = await apiRequest(`/products/${stockProduct.id}/adjust-stock?${params}`, { method: 'POST' });
      setStockProduct(updated);
      setStockQuantity('');
      setStockReason('');
      await Promise.all([movementList.reload(), refreshAll('Stock adjusted.')]);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      mutationRef.current = false;
      setStockLoading(false);
    }
  }

  function openStockList(status) {
    setStockListStatus(status);
  }

  function openBarcodePicker(product = null) {
    const productSearch = product?.barcode || '';
    setBarcodeSearch(productSearch);
    setDebouncedBarcodeSearch(productSearch);
    setBarcodeCategory('');
    setBarcodeInitialProductId(product?.id || null);
    setSelectedBarcodeIds(product?.id ? new Set([product.id]) : new Set());
    setBarcodePrintFormat('');
    setBarcodePickerOpen(true);
  }

  async function exportProducts() {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (category) params.set('category', category);
    if (stockFilter !== 'all') params.set('stock_status', stockFilter);
    params.set('sort', sort);
    const types = priceTypes.length ? priceTypes : DEFAULT_PRICE_TYPES;
    return exportFilteredCsv({
      path: `/products${params.toString() ? `?${params}` : ''}`,
      filename: csvFilename('products'),
      emptyMessage: 'No products match the current filters.',
      columns: [
        { label: 'Name', value: (row) => row.name }, { label: 'SKU', value: (row) => row.sku },
        { label: 'Barcode', value: (row) => row.barcode }, { label: 'Category', value: (row) => row.category },
        { label: 'Base Unit', value: (row) => baseUnitName(row) }, { label: 'Purchase Unit', value: (row) => row.purchase_unit || '' },
        { label: 'Units per Purchase Unit', value: (row) => hasPurchaseUnit(row) ? row.purchase_conversion_factor : 1 },
        { label: 'Cost', value: (row) => normalizeNumber(row.cost) }, { label: 'Stock', value: (row) => normalizeNumber(row.stock) },
        { label: 'Low Stock Alert', value: (row) => normalizeNumber(row.low_stock_threshold) },
        ...types.map((name) => ({ label: name, value: (row) => productPrice(row, name) })),
      ],
    });
  }

  async function printBarcodes(rows, closePicker = false) {
    if (barcodePrinting || !rows.length) return undefined;
    const printWindow = reserveBrowserPrintWindow('barcode_list', 'width=520,height=780');
    if (!isNativeAndroidPrinting() && !printWindow) return setNotice({ type: 'error', text: 'Allow pop-ups to print the barcode list.' });
    setBarcodePrinting(true);
    try {
      const barcodeListTitle = translateModuleText('Barcode List', language, PRODUCT_MESSAGES, PRODUCT_PATTERNS);
      const barcodeSettings = await apiRequest('/settings');
      const document = barcodePrintDocument(rows, { settings: { ...barcodeSettings, ...(barcodePrintFormat ? { barcode_label_format: barcodePrintFormat } : {}) }, title: barcodeListTitle, escapeHtml, renderBarcode: renderBarcodeSvg });
      const documentHtml = document.html.replace('</body>', `<script>window.addEventListener('afterprint',()=>window.close());window.onload=()=>window.print()</script></body>`);
      if (!await printDocumentHtml({ title: barcodeListTitle, documentHtml, popup: printWindow, popupName: 'barcode_list', popupFeatures: 'width=520,height=780' })) setNotice({ type: 'error', text: 'Allow pop-ups to print the barcode list.' });
      else if (closePicker) setBarcodePickerOpen(false);
    } catch (error) {
      printWindow?.close();
      setNotice({ type: 'error', text: error.message });
    } finally {
      setBarcodePrinting(false);
    }
    return undefined;
  }

  function printProductBarcode(product) {
    if (!product.barcode) {
      setNotice({ type: 'error', text: 'This product does not have a barcode.' });
      return;
    }
    openBarcodePicker(product);
  }

  function toggleBarcodeSelection(productId) {
    setSelectedBarcodeIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleAllLoadedBarcodes() {
    setSelectedBarcodeIds((current) => {
      const next = new Set(current);
      if (allLoadedBarcodesSelected) barcodeProducts.forEach((product) => next.delete(product.id));
      else barcodeProducts.forEach((product) => next.add(product.id));
      return next;
    });
  }

  const activeFilterCount = Number(Boolean(category)) + Number(stockFilter !== 'all') + Number(sort !== 'name_asc');

  if (productPage.kind !== 'list' && routeError) {
    return (
      <main className="sale-retail-page product-reference-page">
        <ProductReferenceHeader title={productPage.kind === 'stock' ? 'Stock adjustment' : 'Edit product'} onBack={() => navigateTo('/products', { back: true })} />
        <div className="endless-first-error"><p>{routeError}</p><Button variant="plain" type="button" onClick={() => navigateTo('/products', { back: true })}>Return to products</Button></div>
      </main>
    );
  }

  const waitingForRoute = !metaReady || routeLoading
    || (productPage.kind === 'edit' && editingId !== productPage.productId)
    || (productPage.kind === 'stock' && stockProduct?.id !== productPage.productId);

  if (productPage.kind !== 'list' && waitingForRoute) {
    return <main className="sale-retail-page product-reference-page"><ProductReferenceHeader title={productPage.kind === 'stock' ? 'Stock adjustment' : productPage.kind === 'new' ? 'New product' : 'Edit product'} onBack={() => navigateTo('/products', { back: true })} /><p className="mobile-inline-loading" role="status"><RefreshCw className="spin" size={18} />Loading product…</p></main>;
  }

  if (productPage.kind === 'new' || productPage.kind === 'edit') {
    const editing = productPage.kind === 'edit';
    return (
      <main className="sale-retail-page product-reference-page product-reference-form-page">
        <ProductReferenceHeader title={editing ? 'Edit product' : 'New product'} onBack={() => navigateTo('/products', { back: true })} />
        {notice && <div className={`mobile-notice mobile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={17} /></IconButton></div>}
        <ProductReferenceForm key={formResetVersion} currency={currency} form={form} setForm={setForm} priceRules={priceRules} categories={categories} errors={formErrors} saving={saving} editing={editing} onSubmit={saveProduct} onCancel={() => navigateTo('/products', { back: true })} />
      </main>
    );
  }

  if (productPage.kind === 'stock' && stockProduct) {
    return <ProductReferenceStock product={stockProduct} currency={currency} quantity={stockQuantity} setQuantity={setStockQuantity} reason={stockReason} setReason={setStockReason} saving={stockLoading} valid={stockAdjustmentIsValid} onSubmit={adjustStock} onBack={() => navigateTo('/products', { back: true })} notice={notice} onDismiss={() => setNotice(null)} list={movementList} footer={<EndlessFooter list={movementList} itemCount={movementList.items.length} noun="movements" />} />;
  }

  return (
    <>
      <main className="sale-retail-page products-page product-reference-page has-create-fab">
        <ProductReferenceHeader title="Products" actions={<>
          <IconButton variant="ghost" className="app-bar-action" aria-label="Import CSV" title="Import CSV" onClick={() => navigateTo('/products/import')}><FileUp size={20} aria-hidden="true" /></IconButton>
          <IconButton variant="ghost" className="app-bar-action" aria-label="Select and print barcodes" title="Print barcodes" aria-haspopup="dialog" aria-expanded={barcodePickerOpen} aria-controls="product-barcode-drawer" onClick={() => openBarcodePicker()}><Printer size={20} aria-hidden="true" /></IconButton>
          <CsvExportButton onExport={exportProducts} onNotice={setNotice} />
        </>} />
        {notice && <div className={`mobile-notice mobile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={17} /></IconButton></div>}
        {!productList.initialLoading && !productList.error && (products.length > 0 || search || activeFilterCount > 0) && <section className="mobile-summary-grid product-reference-summary" aria-label="Inventory summary">
          <SummaryCard icon={Package} label="Total products" value={summary.total_products} />
          
          <SummaryCard icon={AlertTriangle} label="Low stock items" value={summary.low_stock} tone="warning" onClick={() => openStockList('low_stock')} />
          
        </section>}
        <section className="mobile-product-controls">
          <SearchInput className="mobile-search product-search" htmlFor="product-search"><Search size={20} /><Input id="product-search" aria-label="Search products" value={search} onChange={(event) => updateProductSearch(event.target.value)} placeholder="Search products" />{search && <IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Clear search" onClick={clearProductSearch}><X size={17} /></IconButton>}<IconButton variant="ghost" type="button" className="product-search-scan" aria-label="Scan product barcode" aria-expanded={barcodeScannerOpen} onClick={() => { setNotice(null); setBarcodeScannerOpen(true); }}><ScanLine size={21} /></IconButton></SearchInput>
          <div className="mobile-control-row">
            <MobileFilterToggle open={filtersOpen} onToggle={() => { setDraftCategory(category); setDraftStock(stockFilter); setDraftSort(sort); setFiltersOpen((open) => !open); }} controls="product-filters" count={activeFilterCount} className="product-toolbar-toggle" />
          </div>
          <MobileFilterPanel as="div" onClose={() => setFiltersOpen(false)} open={filtersOpen} id="product-filters" className="mobile-filter-panel product-filter-panel">
            <ChoiceGroup className="product-reference-filter-choices"><legend>Category</legend>{['', ...categories].map(item => <label key={item} className={draftCategory === item ? 'is-selected' : ''}><Radio type="radio" name="product-category-filter" checked={draftCategory === item} onChange={() => setDraftCategory(item)} /><span data-no-localize={Boolean(item)}>{item || 'All categories'}</span></label>)}</ChoiceGroup>
            <ChoiceGroup className="product-reference-filter-choices"><legend>Stock status</legend>{[['all', 'All'], ['in_stock', 'In stock'], ['low_stock', 'Low stock'], ['out_of_stock', 'Out of stock']].map(([value, label]) => <label key={value} className={draftStock === value ? 'is-selected' : ''}><Radio type="radio" name="product-stock-filter" checked={draftStock === value} onChange={() => setDraftStock(value)} /><span>{label}</span></label>)}</ChoiceGroup>
            <ChoiceGroup className="product-reference-filter-choices"><legend>Sort by</legend>{[["name_asc", "Name A-Z"], ["name_desc", "Name Z-A"]].map(([value, label]) => <label key={value} className={draftSort === value ? "is-selected" : ""}><Radio type="radio" name="product-sort-filter" checked={draftSort === value} onChange={() => setDraftSort(value)} /><span>{label}</span></label>)}</ChoiceGroup>
            <div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={() => { setDraftCategory(''); setDraftStock('all'); setDraftSort('name_asc'); setCategory(''); setStockFilter('all'); setSort('name_asc'); }}>Reset</MobileFilterResetButton><Button variant="primary" className="mobile-primary" type="button" onClick={() => { setCategory(draftCategory); setStockFilter(draftStock); setSort(draftSort); setFiltersOpen(false); }}>Apply</Button></div>
          </MobileFilterPanel>
        </section>
        {!productList.initialLoading && !productList.error && <div className="mobile-list-heading product-reference-list-heading"><span>{total} {total === 1 ? 'product' : 'products'}</span></div>}
        {productList.initialLoading ? <LoadingCards /> : productList.error && !products.length ? (
          <div className="product-reference-state is-error" role="alert"><span><AlertTriangle size={40} /></span><h2>Could not load products</h2><p>Check your connection and try again.</p><small>{productList.error}</small><Button variant="primary" className="mobile-primary" type="button" onClick={productList.retry}><RefreshCw size={18} />Retry</Button><div className="product-state-options"><Button variant="plain" type="button" onClick={() => setBarcodeScannerOpen(true)}><ScanLine size={18} />Scan barcode</Button></div></div>
        ) : products.length ? (
          <>
            <div className="product-card-list">{products.map((product) => <ProductCard key={product.id} product={product} currency={currency} deleting={deletingId === product.id} onEdit={openEdit} onAdjust={openStock} onPrint={printProductBarcode} onDelete={setDeletingProduct} />)}</div>
            <EndlessFooter list={productList} itemCount={products.length} noun="products" />
          </>
        ) : <div className="product-reference-state"><span>{search || activeFilterCount ? <Search size={40} /> : <PackageOpen size={64} />}</span><h2>{search || activeFilterCount ? 'No matching products' : 'No products yet'}</h2><p>{search || activeFilterCount ? 'Try a different search or clear filters.' : 'Add your first product to start selling.'}</p>{search || activeFilterCount ? <div className="product-state-options"><Button variant="plain" type="button" onClick={clearProductSearch}><Search size={18} />Clear search</Button><Button variant="plain" type="button" onClick={() => { setCategory(''); setStockFilter('all'); setSort('name_asc'); }}><X size={18} />Reset filters</Button></div> : null}</div>}

        <FloatingActionButton label="Add product" onClick={openAdd}><Plus size={26} aria-hidden="true" /></FloatingActionButton>
      </main>
      <Sheet open={Boolean(stockListStatus)} title={stockListStatus === 'low_stock' ? 'Low stock products' : 'Out of stock products'} onClose={() => setStockListStatus('')}>
        <StockStatusContent status={stockListStatus} onAdjust={(product) => { setStockListStatus(''); openStock(product); }} />
      </Sheet>

      <ProductBarcodeScanner open={barcodeScannerOpen} onClose={() => setBarcodeScannerOpen(false)} onDetected={acceptScannedBarcode} />

      <MobileFilterPanel as="div" id="product-barcode-drawer" icon={Printer} footer={<div className="barcode-picker-actions"><Button variant="secondary" className="mobile-secondary" type="button" disabled={barcodePrinting} onClick={() => setBarcodePickerOpen(false)}>Cancel</Button><Button variant="primary" className="mobile-primary" type="button" disabled={!selectedBarcodeProducts.length || barcodePrinting} onClick={() => void printBarcodes(selectedBarcodeProducts, true)}>{barcodePrinting ? <RefreshCw className="spin" size={17} /> : <Printer size={17} />}{barcodePrinting ? 'Preparingâ€¦' : `Print selected (${selectedBarcodeProducts.length})`}</Button></div>} open={barcodePickerOpen} title="Print barcodes" description="Select products to include in the barcode label sheet." className="product-barcode-drawer" onClose={() => !barcodePrinting && setBarcodePickerOpen(false)}>
        <div className="barcode-picker">
          <Field id="barcode-print-format" label="Sticker paper format"><Select value={barcodePrintFormat} onChange={(event) => setBarcodePrintFormat(event.target.value)}><option value="">Use saved barcode setting</option>{Object.entries(BARCODE_LABEL_FORMATS).map(([value, format]) => <option value={value} key={value}>{format.label}</option>)}</Select></Field>
          <SearchInput className="mobile-search barcode-picker-search" htmlFor="barcode-product-search"><Search size={19} /><Input id="barcode-product-search" aria-label="Search barcode products" value={barcodeSearch} onChange={(event) => setBarcodeSearch(event.target.value)} placeholder="Search name, SKU or barcode" />{barcodeSearch && <IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Clear barcode search" onClick={() => setBarcodeSearch('')}><X size={17} /></IconButton>}</SearchInput>
          <Field id="barcode-product-category" label="Category"><Select aria-label="Barcode product category" value={barcodeCategory} onChange={(event) => setBarcodeCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
          <div className="barcode-picker-summary">
            <label><Checkbox type="checkbox" aria-label="Select all loaded barcode products" checked={allLoadedBarcodesSelected} disabled={!barcodeProducts.length} onChange={toggleAllLoadedBarcodes} /><span>Select loaded</span></label>
            <strong>{selectedBarcodeIds.size} selected</strong>
          </div>
          <div className="barcode-picker-results">
            {barcodeList.initialLoading ? <p className="mobile-inline-loading" role="status"><RefreshCw className="spin" size={17} />Loading barcode productsâ€¦</p> : barcodeList.error && !barcodeProducts.length ? <div className="endless-first-error"><p>{barcodeList.error}</p><Button variant="plain" type="button" onClick={barcodeList.retry}>Try again</Button></div> : barcodeProducts.length ? <><div className="barcode-product-list">{barcodeProducts.map((product) => <label className="barcode-product-row" key={product.id}><Checkbox type="checkbox" aria-label={`Select ${product.name}`} checked={selectedBarcodeIds.has(product.id)} onChange={() => toggleBarcodeSelection(product.id)} />{product.photo_url ? <span className="barcode-product-photo"><ProductPhoto path={product.photo_url} /></span> : <span className="barcode-product-photo barcode-product-photo--empty"><Package size={18} /></span>}<span className="barcode-product-copy"><strong data-no-localize>{product.name}</strong><small data-no-localize>{product.barcode}</small>{product.sku && <small data-no-localize>{product.sku}</small>}<BarcodePreview value={product.barcode} /></span></label>)}</div><EndlessFooter list={barcodeList} itemCount={barcodeProducts.length} noun="barcode products" /></> : <p className="mobile-inline-empty">No products with barcodes match this search.</p>}
          </div>

        </div>
      </MobileFilterPanel>


      <MobileDeleteSheet open={Boolean(deletingProduct)} title="Delete product?" description="This removes it from the active list while preserving linked history." itemTitle={deletingProduct?.name} itemDescription={deletingProduct?.sku || deletingProduct?.barcode || 'No product code'} confirmLabel="Delete product" busy={Boolean(deletingId)} onClose={() => setDeletingProduct(null)} onConfirm={deleteProduct} />
    </>
  );
}

export function ProductsScreen(props) {
  const [localPath, setLocalPath] = useState('/products');
  const pathname = props.pathname || localPath;
  const navigate = props.onNavigate || setLocalPath;
  const importing = pathname === '/products/import' || pathname.startsWith('/products/import/');
  return <ModuleLocalizationBoundary messages={PRODUCT_MESSAGES} patterns={PRODUCT_PATTERNS}>{importing
    ? <ProductImportPage initialId={pathname.split('/')[3]} onBack={() => navigate('/products', { back: true })} />
    : <ProductsScreenContent {...props} pathname={pathname} onNavigate={navigate} />}</ModuleLocalizationBoundary>;
}
