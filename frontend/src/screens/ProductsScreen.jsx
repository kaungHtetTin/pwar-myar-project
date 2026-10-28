import { useAiPageLink, returnFromAiPage } from '../ai/useAiPageLink';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Boxes, CircleX, Edit, Filter, History, Package, Plus, Printer, RotateCcw, Search, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { RowActions } from '../components/RowActions';
import { request, requestAllPages } from '../api';
import { actionLabel, formatQuantity, money, normalizeNumber } from '../utils';
import { EmptyState, Field, FilterDrawer, Modal, TableLoadingState, TablePagination } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { useConfirmation } from '../components/confirmations';
import {
  automaticSellingPrice,
  DEFAULT_PRICE_TYPES,
  priceRuleMap,
  productPriceFormRows,
} from '../priceTypes';
import { belowCostPrices, priceMargin } from '../costing';
import { baseUnitName, hasPurchaseUnit, stockWithUnit } from '../productUnits';
import { printDocumentHtml, reservePrintWindow, printResultMessage } from '../printing';
import { usePrinting } from '../hooks/usePrinting';
import { ProductPhotoField } from '../components/ProductPhotoField';
import { ProductPhoto } from '../components/ProductPhoto';
import { ProductImportModal } from '../components/ProductImportModal';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { TABLE_PAGE_SIZE } from '../tablePagination';
import { renderBarcodeSvg } from '../barcodePrinting';
import { BARCODE_LABEL_FORMATS, barcodePrintDocument } from '../barcodeSettings';

export function ProductRowActions({ product, deleting = false, onAdjust, onHistory, onPrint, onEdit, onDelete }) {
  return (
    <RowActions label={product.name} disabled={Boolean(product.is_pending)}>
      <button type="button" onClick={() => onAdjust(product)}><RotateCcw size={15} /> Adjust stock</button>
      <button type="button" onClick={() => onHistory(product)}><History size={15} /> Movement history</button>
      <button type="button" disabled={!product.barcode || deleting} onClick={() => onPrint(product)}><Printer size={15} /> Print barcode</button>
      <button type="button" onClick={() => onEdit(product)}><Edit size={15} /> Edit product</button>
      <button type="button" className="danger-button" disabled={deleting} onClick={() => onDelete(product)}><Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete product'}</button>
    </RowActions>
  );
}

export function blankProductForm(priceTypes = DEFAULT_PRICE_TYPES, priceRules = {}) {
  return {
    name: '',
    online_description: '',
    sku: '',
    barcode: '',
    category: '',
    base_unit: 'Unit',
    purchase_unit: '',
    purchase_conversion_factor: 1,
    cost: 0,
    stock: 0,
    low_stock_threshold: 0,
    photo_url: '',
    photo_file: null,
    remove_photo: false,
    prices: productPriceFormRows(priceTypes, null, priceRules),
  };
}



function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

function productPrice(product, priceType) {
  const prices = product.prices || [];
  const found = prices.find((price) => price.name === priceType);
  if (found) return Number(found.price || 0);
  const retail = prices.find((price) => price.name === 'Retail');
  return Number((retail && retail.price) || product.price || 0);
}

function productPriceRows(product) {
  const prices = product.prices && product.prices.length
    ? product.prices
    : [{ name: 'Retail', price: product.price || 0 }];
  const preferredOrder = { retail: 0, wholesale: 1, credit: 2 };
  return prices
    .filter((price) => String(price.name || '').trim() && Number(price.price || 0) > 0)
    .sort((a, b) => {
      const aOrder = preferredOrder[String(a.name || '').trim().toLowerCase()] ?? 99;
      const bOrder = preferredOrder[String(b.name || '').trim().toLowerCase()] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .slice(0, 4);
}

function getStockStatus(product) {
  const stock = Number(product.stock || 0);
  const threshold = Number(product.low_stock_threshold || 0);
  if (stock <= 0) return 'out_of_stock';
  if (threshold > 0 && stock <= threshold) return 'low_stock';
  return 'in_stock';
}

function stockStatusLabel(status) {
  if (status === 'out_of_stock') return 'Out of Stock';
  if (status === 'low_stock') return 'Low Stock';
  return 'In Stock';
}

function stockStatusClass(status) {
  if (status === 'out_of_stock') return 'status-badge danger';
  if (status === 'low_stock') return 'status-badge warn';
  return 'status-badge';
}

function stockQtyClass(product) {
  const status = getStockStatus(product);
  if (status === 'out_of_stock') return 'stock-value out';
  if (status === 'low_stock') return 'stock-value low';
  return 'stock-value';
}

const PRODUCT_PAGE_SIZE = TABLE_PAGE_SIZE;
const MOVEMENT_PAGE_SIZE = TABLE_PAGE_SIZE;
const BARCODE_PICKER_PAGE_SIZE = TABLE_PAGE_SIZE;

export function ProductsScreen() {
  const printing = usePrinting();
  const [barcodePrinting, setBarcodePrinting] = useState(false);
  const [barcodePickerOpen, setBarcodePickerOpen] = useState(false);
  const [barcodeProductsLoading, setBarcodeProductsLoading] = useState(false);
  const [barcodeSelectingAll, setBarcodeSelectingAll] = useState(false);
  const [barcodeProducts, setBarcodeProducts] = useState([]);
  const [barcodeProductsTotal, setBarcodeProductsTotal] = useState(0);
  const [barcodeProductSearch, setBarcodeProductSearch] = useState('');
  const [barcodeProductCategory, setBarcodeProductCategory] = useState('');
  const [selectedBarcodeIds, setSelectedBarcodeIds] = useState(() => new Set());
  const [barcodeInitialProductId, setBarcodeInitialProductId] = useState(null);
  const [barcodePrintFormat, setBarcodePrintFormat] = useState('');
  const barcodeProductsLoadSequence = useRef(0);
  const barcodeSelectAllSequence = useRef(0);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceTypes, setPriceTypes] = useState(DEFAULT_PRICE_TYPES);
  const [priceRules, setPriceRules] = useState({});
  const [productSummary, setProductSummary] = useState({ total_products: 0, total_stock_units: 0, low_stock: 0, out_of_stock: 0 });
  const [totalMatching, setTotalMatching] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [sort, setSort] = useState('name_asc');
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();
  const [loading, setLoading] = useState(true);
  const loadSequence = useRef(0);
  const [saving, setSaving] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [form, setForm] = useState(blankProductForm());
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedRows, setSelectedRows] = useState(() => new Map());
  const [bulkDeleteRows, setBulkDeleteRows] = useState(null), [bulkDeleting, setBulkDeleting] = useState(false), [bulkDeleteError, setBulkDeleteError] = useState('');
  const bulkDeleteGuard = useRef(false), selectProductPageRef = useRef(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockReason, setStockReason] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockMovements, setStockMovements] = useState([]);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementLoading, setMovementLoading] = useState(false);
  const movementLoadSequence = useRef(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const importFileInput = useRef(null);
  const importButton = useRef(null);

  const currency = 'Ks';

  const uniqueCategories = useMemo(() => categories, [categories]);

  const totalProducts = productSummary.total_products;
  const totalStockUnits = productSummary.total_stock_units;
  const pageProducts = products;
  const selectedOnPage = products.filter(product => selectedRows.has(product.id)).length;
  const allPageSelected = products.length > 0 && selectedOnPage === products.length;
  const productDeleteBusy = bulkDeleting || deletingId !== null;
  const selectionDisabled = loading || productDeleteBusy;
  useEffect(() => { if (selectProductPageRef.current) selectProductPageRef.current.indeterminate = selectedOnPage > 0 && !allPageSelected; }, [selectedOnPage, allPageSelected]);
  const activeFilterCount = [
    search.trim(),
    categoryFilter,
    stockStatusFilter !== 'all' ? stockStatusFilter : '',
    sort !== 'name_asc' ? sort : '',
  ].filter(Boolean).length;
  const stockAdjustment = stockQuantity === '' ? 0 : normalizeNumber(stockQuantity, NaN);
  const currentStock = normalizeNumber(selectedProduct?.stock, 0);
  const adjustedStock = Number.isFinite(stockAdjustment) ? currentStock + stockAdjustment : currentStock;
  const stockAdjustmentIsValid = Number.isFinite(stockAdjustment) && stockAdjustment !== 0 && adjustedStock >= 0;

  function clearProductFilters() {
    setSearch('');
    setCategoryFilter('');
    setStockStatusFilter('all');
    setSort('name_asc');
    setPage(1);
    setFilterOpen(false);
  }

  function toggleStockStatusFilter(status) {
    setStockStatusFilter((current) => (current === status ? 'all' : status));
    setPage(1);
  }

  const load = (nextPage = page, background = false) => {
    const sequence = ++loadSequence.current;
    const params = new URLSearchParams();
    params.set('with_total', 'true');
    params.set('limit', String(PRODUCT_PAGE_SIZE));
    params.set('offset', String((nextPage - 1) * PRODUCT_PAGE_SIZE));
    if (search.trim()) params.set('q', search.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    if (stockStatusFilter !== 'all') params.set('stock_status', stockStatusFilter);
    params.set('sort', sort);
    if (!background) setLoading(true);
    return request(`/products?${params.toString()}`).then((productData) => {
      if (sequence !== loadSequence.current) return false;
      const nextProducts = productData.items || [];
      const lastPage = Math.max(1, Math.ceil((productData.total || 0) / PRODUCT_PAGE_SIZE));
      if (nextPage > lastPage) { setTotalMatching(productData.total || 0); setPage(lastPage); return false; }
      setProducts(nextProducts);
      setSelectedRows(previous => {
        const next = new Map(previous);
        for (const product of nextProducts) if (next.has(product.id)) next.set(product.id, product);
        return next;
      });
      setSelectedProduct((current) => {
        if (!current) return null;
        return nextProducts.find((product) => Number(product.id) === Number(current.id)) || null;
      });
      setTotalMatching(productData.total || 0);
      setError('');
      return true;
    }).catch((err) => {
      if (sequence === loadSequence.current) {
        if (!background) setProducts([]);
        setError(`Cannot load products. ${err.message}`);
      }
      return false;
    }).finally(() => {
      if (sequence === loadSequence.current) setLoading(false);
    });
  };

  const loadProductMeta = () => Promise.all([
    request('/categories'),
    request('/products/summary'),
    request('/price-types'),
  ]).then(([categoryData, summaryData, priceTypeData]) => {
    setCategories(categoryData);
    setProductSummary(summaryData);
    setPriceTypes(priceTypeData.items || DEFAULT_PRICE_TYPES);
    setPriceRules(priceRuleMap(priceTypeData));
  }).catch((err) => setError(`Cannot load inventory summary. ${err.message}`));

  function rememberCategory(category) {
    const clean = String(category || '').trim();
    if (!clean) return;
    setCategories((current) => (current.includes(clean) ? current : [...current, clean].sort()));
  }

  function upsertProduct(savedProduct) {
    setProducts((current) => {
      const exists = current.some((product) => product.id === savedProduct.id);
      const next = exists
        ? current.map((product) => (product.id === savedProduct.id ? savedProduct : product))
        : [...current, savedProduct];
      return next.sort((a, b) => (sort === 'name_desc' ? -1 : 1) * (String(a.name || '').localeCompare(String(b.name || '')) || Number(a.id) - Number(b.id)));
    });
    rememberCategory(savedProduct.category);
  }

  function replaceProductId(tempId, savedProduct) {
    setProducts((current) => current
      .map((product) => (product.id === tempId || product.id === savedProduct.id ? savedProduct : product))
      .sort((a, b) => (sort === 'name_desc' ? -1 : 1) * (String(a.name || '').localeCompare(String(b.name || '')) || Number(a.id) - Number(b.id))));
    rememberCategory(savedProduct.category);
  }

  useEffect(() => {
    setPage(1);
    setSelectedRows(new Map());
    setLoading(true);
  }, [search, categoryFilter, stockStatusFilter, sort]);

  useLatestEffect(() => {
    const timer = window.setTimeout(() => load(page), 220);
    return () => window.clearTimeout(timer);
  }, [page, search, categoryFilter, stockStatusFilter, sort]);

  useLatestEffect(() => {
    loadProductMeta();
  }, []);

  useDataRefresh(['products', 'categories', 'priceTypes'], 'products', () => Promise.all([load(page, true), loadProductMeta()]));

  useAiPageLink('products', target => { if (target.action === 'new' && !formOpen) openAddProduct(); }, !loading);

  function openAddProduct() {
    setEditingId(null);
    setForm(blankProductForm(priceTypes, priceRules));
    setFormOpen(true);
  }

  function openEditProduct(product) {
    setEditingId(product.id);
    setForm({
      ...product,
      prices: productPriceFormRows(priceTypes, product, priceRules),
      low_stock_threshold: product.low_stock_threshold || 0,
      photo_file: null,
      remove_photo: false,
    });
    setFormOpen(true);
  }

  async function generateInternalBarcode() {
    if (generatingBarcode) return;
    setGeneratingBarcode(true);
    setError('');
    try {
      const payload = await request('/products/internal-barcode', { method: 'POST' });
      setForm((current) => ({ ...current, barcode: payload.barcode || '' }));
    } catch (err) {
      setError(`Cannot generate an internal barcode. ${err.message}`);
    } finally {
      setGeneratingBarcode(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    const name = String(form.name || '').trim();
    if (!name) {
      setError('Product name is required.');
      return;
    }

    const prices = (form.prices || [])
      .map((price) => ({
        name: String(price.name || '').trim(),
        price: price.is_manual
          ? normalizeNumber(price.price, 0)
          : automaticSellingPrice(form.cost, priceRules[String(price.name || '').toLocaleLowerCase()]),
        is_manual: price.is_manual !== false,
      }))
      .filter((price) => price.name && price.price >= 0);

    if (!prices.length) {
      setError('Add at least one valid price type.');
      return;
    }

    const retail = prices.find((price) => price.name === 'Retail') || prices[0];

    const body = {
      name,
      online_description: String(form.online_description || '').trim(),
      sku: String(form.sku || '').trim(),
      barcode: String(form.barcode || '').trim(),
      category: String(form.category || '').trim(),
      base_unit: String(form.base_unit || '').trim() || 'Unit',
      purchase_unit: String(form.purchase_unit || '').trim() || null,
      purchase_conversion_factor: normalizeNumber(form.purchase_conversion_factor, 1),
      price: normalizeNumber(retail.price, 0),
      cost: normalizeNumber(form.cost, 0),
      stock: normalizeNumber(form.stock, 0),
      low_stock_threshold: normalizeNumber(form.low_stock_threshold, 0),
      is_active: true,
      prices,
    };

    if (body.cost < 0 || body.stock < 0 || body.low_stock_threshold < 0) {
      setError('Cost, stock, and low-stock threshold must be valid numbers.');
      return;
    }

    if (body.purchase_unit && (body.purchase_conversion_factor <= 1 || body.purchase_unit.toLocaleLowerCase() === body.base_unit.toLocaleLowerCase())) {
      setError('Purchase unit must be different from the base unit and contain more than one base unit.');
      return;
    }

    if (prices.some((price) => Number.isNaN(Number(price.price)) || Number(price.price) < 0)) {
      setError('Price values must be valid zero or positive numbers.');
      return;
    }

    const previousProducts = products;
    const previousForm = form;
    const previousEditingId = editingId;
    const tempId = editingId || `pending-${Date.now()}`;
    const optimisticProduct = {
      ...body,
      id: tempId,
      is_pending: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    setFormOpen(false);
    upsertProduct(optimisticProduct);

    let productSaved = false;
    try {
      let savedProduct = await request(editingId ? `/products/${editingId}` : '/products', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      productSaved = true;
      replaceProductId(tempId, savedProduct);
      if (form.photo_file) {
        const photoBody = new FormData();
        photoBody.append('photo', form.photo_file, form.photo_file.name || 'product-photo.jpg');
        savedProduct = await request(`/products/${savedProduct.id}/photo`, { method: 'POST', body: photoBody });
      } else if (form.remove_photo && editingId) {
        savedProduct = await request(`/products/${savedProduct.id}/photo`, { method: 'DELETE' });
      }
      replaceProductId(tempId, savedProduct);
      setMessage(editingId ? 'Product updated.' : 'Product added.');
      await loadProductMeta();
      emitDataChange(['products', 'categories', 'reports'], 'products');
    } catch (err) {
      if (productSaved) {
        setFormOpen(false);
        setMessage('Product saved, but the photo could not be updated.');
        setError(err.message);
        await loadProductMeta();
        return;
      }
      setProducts(previousProducts);
      setForm(previousForm);
      setEditingId(previousEditingId);
      setFormOpen(true);
      setMessage('');
      setError(`Could not save product. ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function setPrice(index, patch) {
    setForm((current) => ({
      ...current,
      prices: current.prices.map((price, priceIndex) => (priceIndex === index ? { ...price, ...patch } : price)),
    }));
  }

  async function deleteProduct(product) {
    if (bulkDeleteGuard.current || deletingId !== null) return;
    const { confirmed } = await confirmAction({
      title: 'Delete product',
      message: `Delete "${product.name}"? It will be removed from the active product list while linked history is preserved.`,
      confirmLabel: 'Delete Product',
    });
    if (!confirmed) return;
    try {
      setDeletingId(product.id);
      setError('');
      setMessage('');
      await request(`/products/${product.id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setSelectedRows(previous => { const next = new Map(previous); next.delete(product.id); return next; });
      setMessage('Product deleted.');
      if (selectedProduct?.id === product.id) setSelectedProduct(null);
      setStockMovements([]);
      await load(page);
      await loadProductMeta();
      emitDataChange(['products', 'reports'], 'products');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function selectProductRows(rows, checked) {
    if (selectionDisabled) return;
    const next = new Map(selectedRows);
    for (const product of rows) { if (checked) next.set(product.id, product); else next.delete(product.id); }
    if (next.size > 1000) { setError('Select up to 1,000 products at a time.'); return; }
    setSelectedRows(next);
  }

  async function deleteSelectedProducts() {
    if (bulkDeleteGuard.current || deletingId !== null || !bulkDeleteRows?.length) return;
    bulkDeleteGuard.current = true; setBulkDeleting(true); setBulkDeleteError('');
    setError(''); setMessage('');
    try {
      const ids = bulkDeleteRows.map(product => product.id), deletedIds = new Set(ids);
      await request('/products/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
      setProducts(current => current.filter(product => !deletedIds.has(product.id)));
      setSelectedRows(previous => new Map([...previous].filter(([id]) => !deletedIds.has(id))));
      setSelectedProduct(current => current && deletedIds.has(current.id) ? null : current);
      setSelectedBarcodeIds(previous => new Set([...previous].filter(id => !deletedIds.has(id))));
      setBulkDeleteRows(null);
      await Promise.all([load(page), loadProductMeta()]);
      setMessage(`${ids.length} products deleted.`);
      emitDataChange(['products', 'categories', 'reports'], 'products');
    } catch (err) { setBulkDeleteError(err.message); }
    finally { bulkDeleteGuard.current = false; setBulkDeleting(false); }
  }

  function openStockAdjust(product) {
    movementLoadSequence.current += 1;
    setSelectedProduct(product);
    setMovementModalOpen(false);
    setMovementLoading(false);
    setStockMovements([]);
    setMovementTotal(0);
    setStockModalOpen(true);
    setStockQuantity('');
    setStockReason('');
    setError('');
  }

  function closeMovementHistory() {
    movementLoadSequence.current += 1;
    setMovementModalOpen(false);
    setMovementLoading(false);
    setStockMovements([]);
    setMovementTotal(0);
  }

  const loadMovementPage = React.useCallback(async (product, offset, replace, sequence) => {
    setMovementLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        with_total: 'true',
        limit: String(MOVEMENT_PAGE_SIZE),
        offset: String(offset),
      });
      const response = await request(`/products/${product.id}/stock-movements?${params.toString()}`);
      if (sequence !== movementLoadSequence.current) return;
      const items = Array.isArray(response) ? response : response.items || [];
      setMovementTotal(Array.isArray(response) ? items.length : Number(response.total || 0));
      setStockMovements((current) => {
        if (replace) return items;
        const known = new Set(current.map((movement) => movement.id));
        return [...current, ...items.filter((movement) => !known.has(movement.id))];
      });
    } catch (err) {
      if (sequence === movementLoadSequence.current) {
        if (replace) setStockMovements([]);
        setError(`Cannot load stock movements. ${err.message}`);
      }
    } finally {
      if (sequence === movementLoadSequence.current) setMovementLoading(false);
    }
  }, [setError]);

  function openMovementHistory(product) {
    const sequence = ++movementLoadSequence.current;
    setSelectedProduct(product);
    setStockModalOpen(false);
    setStockMovements([]);
    setMovementTotal(0);
    setMovementModalOpen(true);
    loadMovementPage(product, 0, true, sequence);
  }

  const loadMoreMovements = React.useCallback(() => {
    if (!selectedProduct || movementLoading || stockMovements.length >= movementTotal) return;
    loadMovementPage(selectedProduct, stockMovements.length, false, movementLoadSequence.current);
  }, [loadMovementPage, movementLoading, movementTotal, selectedProduct, stockMovements.length]);

  function handleMovementHistoryScroll(event) {
    const scroller = event.currentTarget;
    const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (remaining <= 100) loadMoreMovements();
  }

  async function saveStockAdjust(event) {
    event.preventDefault();
    const quantity = normalizeNumber(stockQuantity, NaN);
    if (!selectedProduct) return;
    if (!Number.isFinite(quantity) || quantity === 0) {
      setError('Adjustment quantity must be a non-zero number.');
      return;
    }
    try {
      setStockLoading(true);
      setError('');
      setMessage('');
      const params = new URLSearchParams();
      params.set('quantity', String(quantity));
      if (stockReason) params.set('reason', stockReason);
      const updatedProduct = await request(`/products/${selectedProduct.id}/adjust-stock?${params.toString()}`, { method: 'POST' });
      const previousProduct = selectedProduct;
      setSelectedProduct(updatedProduct);
      setStockQuantity('');
      setStockReason('');
      setStockModalOpen(false);
      setMessage('Stock adjusted.');
      upsertProduct(updatedProduct);
      setProductSummary((current) => {
        const previousStatus = getStockStatus(previousProduct);
        const nextStatus = getStockStatus(updatedProduct);
        return {
          ...current,
          total_stock_units: Number(current.total_stock_units || 0)
            + Number(updatedProduct.stock || 0)
            - Number(previousProduct.stock || 0),
          low_stock: Number(current.low_stock || 0)
            - (previousStatus === 'low_stock' ? 1 : 0)
            + (nextStatus === 'low_stock' ? 1 : 0),
          out_of_stock: Number(current.out_of_stock || 0)
            - (previousStatus === 'out_of_stock' ? 1 : 0)
            + (nextStatus === 'out_of_stock' ? 1 : 0),
        };
      });
      emitDataChange(['products', 'reports'], 'products');
    } catch (err) {
      setError(err.message);
    } finally {
      setStockLoading(false);
    }
  }

  const loadBarcodeProductsPage = React.useCallback(async (offset, replace, sequence, query = barcodeProductSearch, category = barcodeProductCategory) => {
    setBarcodeProductsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        with_total: 'true',
        has_barcode: 'true',
        limit: String(BARCODE_PICKER_PAGE_SIZE),
        offset: String(offset),
      });
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      const response = await request(`/products?${params.toString()}`);
      if (sequence !== barcodeProductsLoadSequence.current) return;
      const items = Array.isArray(response) ? response : response.items || [];
      setBarcodeProductsTotal(Array.isArray(response) ? items.length : Number(response.total || 0));
      setBarcodeProducts((current) => {
        if (replace) return items;
        const known = new Set(current.map((product) => product.id));
        return [...current, ...items.filter((product) => !known.has(product.id))];
      });
    } catch (error) {
      if (sequence === barcodeProductsLoadSequence.current) {
        if (replace) setBarcodeProducts([]);
        setError(`Cannot load products for barcode printing. ${error.message}`);
      }
    } finally {
      if (sequence === barcodeProductsLoadSequence.current) setBarcodeProductsLoading(false);
    }
  }, [barcodeProductCategory, barcodeProductSearch, setError]);

  function openBarcodePicker(product = null) {
    if (barcodeProductsLoading || barcodePrinting || printing) return;
    barcodeProductsLoadSequence.current += 1;
    barcodeSelectAllSequence.current += 1;
    setBarcodePickerOpen(true);
    setBarcodeSelectingAll(false);
    setBarcodeProducts([]);
    setBarcodeProductsTotal(0);
    setBarcodeProductSearch(product?.barcode || '');
    setBarcodeProductCategory('');
    setBarcodeInitialProductId(product?.id || null);
    setSelectedBarcodeIds(product?.id ? new Set([product.id]) : new Set());
    setBarcodePrintFormat('');
  }

  function closeBarcodePicker() {
    barcodeProductsLoadSequence.current += 1;
    barcodeSelectAllSequence.current += 1;
    setBarcodePickerOpen(false);
    setBarcodeProductsLoading(false);
    setBarcodeSelectingAll(false);
    setBarcodeProducts([]);
    setBarcodeProductsTotal(0);
    setBarcodeProductSearch('');
    setBarcodeProductCategory('');
    setBarcodeInitialProductId(null);
    setSelectedBarcodeIds(new Set());
  }

  useEffect(() => {
    if (!barcodePickerOpen) return undefined;
    barcodeSelectAllSequence.current += 1;
    setBarcodeSelectingAll(false);
    const timer = window.setTimeout(() => {
      const sequence = ++barcodeProductsLoadSequence.current;
      setBarcodeProducts([]);
      setBarcodeProductsTotal(0);
      setSelectedBarcodeIds(barcodeInitialProductId ? new Set([barcodeInitialProductId]) : new Set());
      const modalBody = document.querySelector('.product-barcode-picker-modal .mkpos-modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      loadBarcodeProductsPage(0, true, sequence);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [barcodeInitialProductId, barcodePickerOpen, barcodeProductCategory, barcodeProductSearch, loadBarcodeProductsPage]);

  const loadMoreBarcodeProducts = React.useCallback(() => {
    if (barcodeProductsLoading || barcodeProducts.length >= barcodeProductsTotal) return;
    loadBarcodeProductsPage(barcodeProducts.length, false, barcodeProductsLoadSequence.current);
  }, [barcodeProducts.length, barcodeProductsLoading, barcodeProductsTotal, loadBarcodeProductsPage]);

  function handleBarcodeProductsScroll(event) {
    const scroller = event.currentTarget;
    const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (remaining <= 100) loadMoreBarcodeProducts();
  }

  function toggleBarcodeProduct(productId) {
    setSelectedBarcodeIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function toggleAllBarcodeProducts(selected) {
    const sequence = ++barcodeSelectAllSequence.current;
    if (!selected) {
      setBarcodeSelectingAll(false);
      setSelectedBarcodeIds(new Set());
      return;
    }

    const params = new URLSearchParams({ has_barcode: 'true' });
    if (barcodeProductSearch.trim()) params.set('q', barcodeProductSearch.trim());
    if (barcodeProductCategory) params.set('category', barcodeProductCategory);

    setBarcodeSelectingAll(true);
    setError('');
    try {
      const matchingProducts = await requestAllPages(`/products?${params.toString()}`, {
        pageSize: 500,
        maxItems: Math.max(50000, barcodeProductsTotal + 500),
      });
      if (sequence !== barcodeSelectAllSequence.current) return;
      setBarcodeProducts(matchingProducts);
      setBarcodeProductsTotal(matchingProducts.length);
      setSelectedBarcodeIds(new Set(matchingProducts.map((product) => product.id)));
    } catch (error) {
      if (sequence === barcodeSelectAllSequence.current) {
        setError(`Cannot select all products for barcode printing. ${error.message}`);
      }
    } finally {
      if (sequence === barcodeSelectAllSequence.current) setBarcodeSelectingAll(false);
    }
  }

  async function printBarcodes(rows, closePickerAfterPrint = false) {
    if (barcodePrinting || printing || !rows.length) return;
    const win = reservePrintWindow();
    if (!window.mkposDesktop?.printReceipt && !win) { setError('Cannot open print window. Please allow pop-ups.'); return; }
    setBarcodePrinting(true);
    try {
    const barcodeSettings = await request('/settings');
    const document = barcodePrintDocument(rows, { settings: { ...barcodeSettings, ...(barcodePrintFormat ? { barcode_label_format: barcodePrintFormat } : {}) }, title: 'Barcode List', escapeHtml, renderBarcode: renderBarcodeSvg });
    setMessage(printResultMessage(await printDocumentHtml(document.html, { paperSize: document.paperSize, popup: win, useSystemPrinter: true, preservePageStyle: true })));
    if (closePickerAfterPrint) closeBarcodePicker();
    } catch (error) {
      win?.close();
      setError(`Cannot print barcode list. ${error.message}`);
    } finally { setBarcodePrinting(false); }
  }

  function printBarcodeList() {
    const rows = barcodeProducts.filter((product) => selectedBarcodeIds.has(product.id));
    if (!rows.length) {
      setError('Select at least one product to print.');
      return;
    }
    printBarcodes(rows, true);
  }

  function printProductBarcode(product) {
    if (!product.barcode) {
      setError('This product does not have a barcode.');
      return;
    }
    openBarcodePicker(product);
  }

  function triggerImport() {
    importFileInput.current?.click();
  }

  async function exportProducts() {
    const exportPriceTypes = priceTypes.length ? priceTypes : DEFAULT_PRICE_TYPES;
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    if (stockStatusFilter !== 'all') params.set('stock_status', stockStatusFilter);
    params.set('sort', sort);
    const query = params.toString();
    return exportFilteredCsv({
      path: `/products${query ? `?${query}` : ''}`,
      filename: csvFilename('products'),
      emptyMessage: 'No products match the current filters.',
      columns: [
        { label: 'Name', value: (product) => product.name },
        { label: 'SKU', value: (product) => product.sku },
        { label: 'Barcode', value: (product) => product.barcode },
        { label: 'Category', value: (product) => product.category },
        { label: 'Base Unit', value: (product) => baseUnitName(product) },
        { label: 'Purchase Unit', value: (product) => product.purchase_unit || '' },
        { label: 'Units per Purchase Unit', value: (product) => hasPurchaseUnit(product) ? product.purchase_conversion_factor : 1 },
        { label: 'Cost', value: (product) => normalizeNumber(product.cost, 0) },
        { label: 'Stock', value: (product) => normalizeNumber(product.stock, 0) },
        { label: 'Low Stock Alert', value: (product) => normalizeNumber(product.low_stock_threshold, 0) },
        ...exportPriceTypes.map((name) => ({ label: name, value: (product) => productPrice(product, name) })),
      ],
    });
  }


  return (
    <>
      <input ref={importFileInput} hidden type="file" accept=".csv,text/csv" aria-label="Product CSV file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setImportFile(file); setImportOpen(true); }} />
      {importOpen && <ProductImportModal file={importFile} onClose={() => { setImportOpen(false); setImportFile(null); requestAnimationFrame(() => importButton.current?.focus({ preventScroll: true })); }} onChanged={() => { load(page); loadProductMeta(); emitDataChange(['products', 'categories', 'reports'], 'products'); }} />}
      <section className="screen products-layout mkpos-sheet">
        <div className="panel product-main-panel">
          <div className="product-stat-row">
            <div className="product-stat-card">
              <span className="product-stat-icon"><Package size={20} /></span>
              <div><span>Total Products</span><strong>{totalProducts}</strong></div>
            </div>
            <div className="product-stat-card">
              <span className="product-stat-icon"><Boxes size={20} /></span>
              <div><span>Total Stock Units</span><strong>{totalStockUnits}</strong></div>
            </div>
            <button type="button" className={`product-stat-card warning clickable-stat${stockStatusFilter === 'low_stock' ? ' is-active' : ''}`} aria-pressed={stockStatusFilter === 'low_stock'} onClick={() => toggleStockStatusFilter('low_stock')}>
              <span className="product-stat-icon"><TriangleAlert size={20} /></span>
              <div><span>Low Stock</span><strong>{productSummary.low_stock}</strong></div>
            </button>
            <button type="button" className={`product-stat-card danger clickable-stat${stockStatusFilter === 'out_of_stock' ? ' is-active' : ''}`} aria-pressed={stockStatusFilter === 'out_of_stock'} onClick={() => toggleStockStatusFilter('out_of_stock')}>
              <span className="product-stat-icon"><CircleX size={20} /></span>
              <div><span>Out of Stock</span><strong>{productSummary.out_of_stock}</strong></div>
            </button>
          </div>

          <AppBarActions className="product-action-row">
              <button type="button" className="primary" onClick={openAddProduct}>
                <Plus size={16} /> Add Product
              </button>
              <button type="button" className="filter-drawer-trigger" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}>
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
              <button ref={importButton} type="button" onClick={triggerImport}>
                <Upload size={16} /> Import
              </button>
              <CsvExportButton onExport={exportProducts} onError={setError} onSuccess={setMessage} />
              <button type="button" disabled={printing || barcodePrinting} onClick={() => openBarcodePicker()}>
                <Printer size={16} /> Print Barcode List
              </button>
          </AppBarActions>
          <AppBarSearch>
            <form onSubmit={(event) => { event.preventDefault(); setPage(1); load(1); }}>
              <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search or scan name, SKU, barcode, or category" aria-label="Search products or scan barcode" /></label>
            </form>
          </AppBarSearch>

          <div className="product-table-card">
            {selectedRows.size > 0 && <div className="product-selection-bar"><span role="status">{selectedRows.size} selected across pages</span><div><button type="button" disabled={productDeleteBusy} onClick={() => setSelectedRows(new Map())}>Clear selection</button><button type="button" className="danger-button" disabled={selectionDisabled} onClick={() => { setBulkDeleteError(''); setBulkDeleteRows([...selectedRows.values()]); }}><Trash2 size={16} /> Delete selected ({selectedRows.size})</button></div></div>}
            <div className="product-grid-wrap">
              <table className="product-data-table">
                <colgroup><col className="product-selection-column" /><col span="3" /><col className="product-prices-column" /><col span="2" /><col className="table-action-column" /></colgroup>
                <thead>
                  <tr>
                    <th className="product-selection-cell"><input ref={selectProductPageRef} type="checkbox" aria-label="Select all products on this page" disabled={selectionDisabled || !products.length} checked={allPageSelected} onChange={event => selectProductRows(products, event.target.checked)} /></th>
                    <th>Product</th>
                    <th>SKU / Barcode</th>
                    <th>Category</th>
                    <th>Prices</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th className="table-actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                {pageProducts.map((product) => {
                  const status = getStockStatus(product);
                  const displayPrices = productPriceRows(product);
                  return (
                      <tr key={product.id}>
                        <td className="product-selection-cell"><input type="checkbox" aria-label={`Select ${product.name} (${product.id})`} disabled={selectionDisabled} checked={selectedRows.has(product.id)} onChange={event => selectProductRows([product], event.target.checked)} /></td>
                        <td className="product-name-cell">
                          <span className="product-table-identity">{product.photo_url ? <span className="product-table-photo"><ProductPhoto path={product.photo_url} /></span> : <span className="product-photo-placeholder"><Package size={18} /></span>}<span><strong>{product.name}</strong>{hasPurchaseUnit(product) && <small className="product-unit-note">1 {product.purchase_unit} = {product.purchase_conversion_factor} {baseUnitName(product)}</small>}</span></span>
                        </td>
                        <td>{product.sku || '-'} / {product.barcode || '-'}</td>
                        <td>{product.category || '-'}</td>
                        <td>
                          <div className="product-price-stack">
                            {displayPrices.length === 0 && <span className="product-no-price">-</span>}
                            {displayPrices.map((price) => {
                              const margin = priceMargin(price.price, product.cost);
                              return (
                              <span key={`${product.id}-${price.name}`} className={`product-price-row ${margin.belowCost ? 'is-below-cost' : ''}`}>
                                <em>
                                  {price.name}
                                  {price.is_manual === false && <small className="product-auto-price-badge">Auto</small>}
                                </em>
                                <span className="product-price-amount">
                                  <strong>{money(price.price, currency)}</strong>
                                  {margin.belowCost && (
                                    <small>Loss {money(Math.abs(margin.amount), currency)} ({Math.abs(margin.percent).toFixed(1)}%)</small>
                                  )}
                                </span>
                              </span>
                              );
                            })}
                            {(product.prices || []).filter((price) => Number(price.price || 0) > 0).length > 4 && (
                              <small>+{(product.prices || []).filter((price) => Number(price.price || 0) > 0).length - 4} more</small>
                            )}
                          </div>
                        </td>
                        <td className={stockQtyClass(product)}>{stockWithUnit(product)}{product.reserved_stock > 0 && <small style={{ display: 'block' }}>Available: {formatQuantity(product.available_stock)} · Reserved: {formatQuantity(product.reserved_stock)}{product.dispatched_stock > 0 ? ` · Dispatched: ${formatQuantity(product.dispatched_stock)}` : ''}</small>}</td>
                        <td>
                          <div className="product-status-stack">
                            <span className={stockStatusClass(status)}>{stockStatusLabel(status)}</span>
                            {belowCostPrices(product).length > 0 && <span className="status-badge below-cost">Below Cost</span>}
                          </div>
                        </td>
                        <td className="product-actions-cell table-actions-cell">
                          <ProductRowActions
                            product={product}
                            deleting={bulkDeleting || deletingId === product.id}
                            onAdjust={openStockAdjust}
                            onHistory={openMovementHistory}
                            onPrint={printProductBarcode}
                            onEdit={openEditProduct}
                            onDelete={deleteProduct}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {loading && <TableLoadingState>Loading products…</TableLoadingState>}
              {!loading && !products.length && (
                <div className="product-empty-state">
                  <Package size={34} />
                  <h3>No products found</h3>
                  <button type="button" className="primary" onClick={openAddProduct}>
                    <Plus size={16} /> Add Product
                  </button>
                </div>
              )}
            </div>

            <TablePagination className="product-table-footer" page={page} pageSize={PRODUCT_PAGE_SIZE} total={totalMatching} loading={loading || productDeleteBusy} onPageChange={nextPage => { setLoading(true); setPage(nextPage); }} />
          </div>
        </div>
      </section>

      {bulkDeleteRows && <Modal open title="Delete selected products" busy={bulkDeleting} onClose={() => setBulkDeleteRows(null)} size="medium" footer={<><button type="button" disabled={bulkDeleting} onClick={() => setBulkDeleteRows(null)}>Cancel</button><button type="button" className="danger-button" disabled={bulkDeleting} onClick={deleteSelectedProducts}>{bulkDeleting ? 'Deleting...' : `Delete ${bulkDeleteRows.length} products`}</button></>}>
        <p>Remove these {bulkDeleteRows.length} products from the active product list. Linked history is preserved. Products reserved by online orders must be resolved before deletion.</p>
        <ul className="product-bulk-delete-list">{bulkDeleteRows.map(product => <li key={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ''}</li>)}</ul>
        {bulkDeleteError && <p role="alert">{bulkDeleteError}</p>}
      </Modal>}
      <FilterDrawer open={filterOpen} title="Product filters" onClose={() => setFilterOpen(false)}>
        <div className="drawer-filter-form product-filter-drawer-form">
          <Field label="Category">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {uniqueCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Stock status">
            <select value={stockStatusFilter} onChange={(event) => setStockStatusFilter(event.target.value)}>
              <option value="all">All stock status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </Field>
          <Field label="Sort by"><select aria-label="Sort by" value={sort} onChange={event => setSort(event.target.value)}><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option></select></Field>
          <div className="drawer-filter-actions">
            <button type="button" onClick={clearProductFilters}>Clear</button>
            <button type="button" className="primary" onClick={() => setFilterOpen(false)}>Apply Filter</button>
          </div>
        </div>
      </FilterDrawer>

      <Modal
        open={formOpen}
        title={editingId ? 'Edit Product' : 'Add Product'}
        onClose={() => { setFormOpen(false); returnFromAiPage('products_new'); }}
        busy={saving}
        footer={<><button type="button" onClick={() => { setFormOpen(false); setEditingId(null); setForm(blankProductForm(priceTypes, priceRules)); returnFromAiPage('products_new'); }}>Cancel</button><button type="submit" form="product-editor-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', editingId ? 'Update Product' : 'Create Product')}</button></>}
      >
        <form id="product-editor-form" className="product-modal-form" onSubmit={saveProduct}>
          <div className="product-form-grid">
            <section className="product-form-section">
              <div className="product-section-heading">
                <h3>Basic Information</h3>
              </div>
              <ProductPhotoField photoUrl={form.photo_url} photoFile={form.photo_file} removed={form.remove_photo} onChange={(file) => setForm({ ...form, photo_file: file, remove_photo: false })} onRemove={() => setForm({ ...form, photo_file: null, remove_photo: true })} />
              <Field label="Name">
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </Field>
              <Field label="Online description">
                <textarea value={form.online_description || ''} onChange={(event) => setForm({ ...form, online_description: event.target.value })} maxLength={4000} rows={3} placeholder="Description shown in your online shop" />
              </Field>
              <div className="product-form-two">
                <Field label="SKU">
                  <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
                </Field>
                <Field label="Barcode (optional)">
                  <div className="product-barcode-control">
                    <input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
                    <button type="button" disabled={generatingBarcode} onClick={generateInternalBarcode}>
                      <Barcode size={15} /> {generatingBarcode ? 'Generating…' : 'Generate'}
                    </button>
                  </div>
                </Field>
              </div>
              <Field label="Category">
                <input
                  list="product-category-options"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Choose or type category"
                />
                <datalist id="product-category-options">
                  {uniqueCategories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </Field>
              <div className="product-form-two">
                <Field label="Base / selling unit">
                  <input value={form.base_unit || ''} onChange={(event) => setForm({ ...form, base_unit: event.target.value })} placeholder="e.g. Piece" />
                </Field>
                <Field label="Purchase unit (optional)">
                  <input value={form.purchase_unit || ''} onChange={(event) => setForm({ ...form, purchase_unit: event.target.value })} placeholder="e.g. Carton" />
                </Field>
              </div>
              {String(form.purchase_unit || '').trim() && (
                <Field label={`How many ${form.base_unit || 'units'} in 1 ${form.purchase_unit}?`}>
                  <input
                    type="number"
                    min="1.001"
                    step="0.001"
                    value={form.purchase_conversion_factor}
                    onChange={(event) => setForm({ ...form, purchase_conversion_factor: event.target.value })}
                  />
                </Field>
              )}
            </section>

            <div className="product-form-secondary">
              <section className="product-form-section">
                <div className="product-section-heading">
                  <h3>Stock</h3>
                </div>
                <div className="product-form-three product-stock-fields">
                  <Field label={`Cost / ${baseUnitName(form)}`}>
                    <input type="number" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} />
                  </Field>
                  <Field label={`Stock (${baseUnitName(form)})`}>
                    <input type="number" step="0.001" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                  </Field>
                  <Field label={`Low stock alert (${baseUnitName(form)})`}>
                    <input type="number" value={form.low_stock_threshold} onChange={(event) => setForm({ ...form, low_stock_threshold: event.target.value })} />
                  </Field>
                </div>
              </section>

              <section className="product-form-section">
                <div className="product-section-heading">
                  <h3>Prices</h3>
                </div>
                <div className="product-price-list">
                  {(form.prices || []).map((price, index) => {
                    const rule = priceRules[String(price.name || '').toLocaleLowerCase()];
                    const automaticAvailable = rule?.pricing_mode === 'automatic';
                    const automaticPrice = automaticSellingPrice(form.cost, rule);
                    return (
                      <div key={price.id || `${index}`} className="product-price-line">
                        <span className="product-price-name">{price.name}</span>
                        <select
                          value={price.is_manual === false ? 'automatic' : 'manual'}
                          onChange={(event) => setPrice(index, { is_manual: event.target.value !== 'automatic' })}
                        >
                          <option value="manual">Manual</option>
                          {automaticAvailable && <option value="automatic">Automatic</option>}
                        </select>
                        <input
                          type="number"
                          value={price.is_manual === false ? automaticPrice : price.price}
                          onChange={(event) => setPrice(index, { price: event.target.value })}
                          placeholder="Amount"
                          readOnly={price.is_manual === false}
                        />
                        {price.is_manual === false && (
                          <small>
                            {rule.markup_percent}% markup, round up {money(rule.rounding)}
                          </small>
                        )}
                      </div>
                    );
                  })}
                </div>
                <small className="product-price-help">Automatic pricing rules are managed in Settings &gt; Prices. Choose Manual to override one product.</small>
              </section>
            </div>
          </div>

          <div className="product-form-message">
          </div>

        </form>
      </Modal>

      <Modal
        open={barcodePickerOpen}
        title="Select Products to Print"
        subtitle="Choose one or more products with barcodes."
        onClose={closeBarcodePicker}
        busy={barcodeProductsLoading || barcodeSelectingAll || barcodePrinting}
        size="medium"
        className="product-barcode-picker-modal"
        footer={<><button type="button" onClick={closeBarcodePicker} disabled={barcodeProductsLoading || barcodeSelectingAll || barcodePrinting}>Cancel</button><button type="button" className="primary" onClick={printBarcodeList} disabled={barcodeProductsLoading || barcodeSelectingAll || barcodePrinting || selectedBarcodeIds.size === 0}><Printer size={16} /> {barcodeSelectingAll ? 'Selecting all…' : barcodePrinting ? 'Printing…' : `Print Selected (${selectedBarcodeIds.size})`}</button></>}
      >
        <div className="product-barcode-picker">
          <label className="product-barcode-format">
            <span>Sticker paper format</span>
            <select aria-label="Sticker paper format" value={barcodePrintFormat} onChange={(event) => setBarcodePrintFormat(event.target.value)}>
              <option value="">Use saved barcode setting</option>
              {Object.entries(BARCODE_LABEL_FORMATS).map(([value, format]) => <option value={value} key={value}>{format.label}</option>)}
            </select>
          </label>
          <div className="product-barcode-picker-filters">
            <label>
              <span className="visually-hidden">Search products</span>
              <Search size={16} aria-hidden="true" />
              <input value={barcodeProductSearch} onChange={(event) => setBarcodeProductSearch(event.target.value)} placeholder="Search name, SKU, or barcode" />
            </label>
            <label>
              <span className="visually-hidden">Filter by category</span>
              <select value={barcodeProductCategory} onChange={(event) => setBarcodeProductCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {(barcodeProductsLoading || barcodeProducts.length > 0) && (
            <div className="table-wrap sheet-table" onScroll={handleBarcodeProductsScroll}>
              <table>
                <thead>
                  <tr>
                    <th className="product-barcode-check-cell">
                      {!barcodeProductsLoading && <input
                        type="checkbox"
                        aria-label="Select all matching products"
                        checked={barcodeProductsTotal > 0 && selectedBarcodeIds.size === barcodeProductsTotal}
                        disabled={barcodeSelectingAll}
                        onChange={(event) => toggleAllBarcodeProducts(event.target.checked)}
                      />}
                    </th>
                    <th>Product</th>
                    <th>Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {barcodeProducts.map((product) => (
                        <tr key={product.id}>
                          <td className="product-barcode-check-cell"><input type="checkbox" aria-label={`Select ${product.name}`} checked={selectedBarcodeIds.has(product.id)} onChange={() => toggleBarcodeProduct(product.id)} /></td>
                          <td><strong>{product.name}</strong></td>
                          <td className="product-barcode-number">{product.barcode}</td>
                        </tr>
                      ))}
                  {barcodeProductsLoading && Array.from({ length: barcodeProducts.length ? 2 : 5 }, (_, index) => (
                    <tr key={`loading-${index}`} className="product-barcode-picker-skeleton" aria-hidden="true"><td /><td><i /></td><td><i /></td></tr>
                  ))}
                </tbody>
              </table>
              {barcodeProductsLoading && <span className="visually-hidden" role="status" aria-live="polite">Loading products…</span>}
              {barcodeSelectingAll && <span className="visually-hidden" role="status" aria-live="polite">Selecting all matching products…</span>}
              {barcodeProducts.length > 0 && (
                <div className="product-movement-endless-footer">
                  <span>{barcodeProducts.length} of {barcodeProductsTotal} products</span>
                  {barcodeProducts.length < barcodeProductsTotal
                    ? <span>{barcodeProductsLoading ? 'Loading more…' : 'Scroll for more'}</span>
                    : <span>All products loaded</span>}
                </div>
              )}
            </div>
          )}
          {!barcodeProductsLoading && barcodeProducts.length === 0 && <EmptyState>No products with barcodes to print.</EmptyState>}
        </div>
      </Modal>

      <Modal
        open={stockModalOpen}
        title={selectedProduct ? `Adjust Stock — ${selectedProduct.name}` : 'Adjust Stock'}
        subtitle={selectedProduct ? `Current stock: ${stockWithUnit(selectedProduct)}` : ''}
        onClose={() => setStockModalOpen(false)}
        busy={stockLoading}
        size="small"
        footer={<><button type="button" onClick={() => setStockModalOpen(false)} disabled={stockLoading}>Cancel</button><button type="submit" form="stock-adjustment-form" className="primary" disabled={stockLoading || !stockAdjustmentIsValid}>{actionLabel(stockLoading, 'Saving...', 'Save Adjustment')}</button></>}
      >
        <div className="product-modal-form product-stock-adjustment-body">
          {selectedProduct ? (
                <form id="stock-adjustment-form" className="product-adjust-modal-form" onSubmit={saveStockAdjust}>
                  <Field label={`Quantity (${baseUnitName(selectedProduct)})`}>
                    <input
                      type="number"
                      step="0.001"
                      value={stockQuantity}
                      onChange={(event) => setStockQuantity(event.target.value)}
                      placeholder="Enter + to add or − to deduct"
                      aria-describedby="stock-adjustment-help"
                      autoFocus
                    />
                    <small id="stock-adjustment-help">Examples: 10 adds stock; -10 deducts stock.</small>
                  </Field>
                  <Field label="Reason">
                    <input value={stockReason} onChange={(event) => setStockReason(event.target.value)} />
                  </Field>
                  <div className={`product-stock-preview${adjustedStock < 0 ? ' invalid' : ''}`} aria-live="polite" role="status">
                    <div><span>Current</span><strong>{formatQuantity(currentStock)} <small>{baseUnitName(selectedProduct)}</small></strong></div>
                    <b aria-hidden="true">{stockAdjustment >= 0 ? '+' : '−'}</b>
                    <div><span>Adjustment</span><strong>{Number.isFinite(stockAdjustment) ? formatQuantity(Math.abs(stockAdjustment)) : '—'} <small>{baseUnitName(selectedProduct)}</small></strong></div>
                    <b aria-hidden="true">=</b>
                    <div className="product-stock-preview-final"><span>Final quantity</span><strong>{formatQuantity(adjustedStock)} <small>{baseUnitName(selectedProduct)}</small></strong></div>
                    {adjustedStock < 0 && <p>Final quantity cannot be below zero.</p>}
                  </div>
                </form>
          ) : (
            <EmptyState>Select a product first.</EmptyState>
          )}
        </div>
      </Modal>

      <Modal open={movementModalOpen} title={selectedProduct ? `Movement History — ${selectedProduct.name}` : 'Movement History'} subtitle={selectedProduct ? `Current stock: ${stockWithUnit(selectedProduct)}` : ''} onClose={closeMovementHistory} busy={movementLoading && stockMovements.length === 0} size="medium" onBodyScroll={handleMovementHistoryScroll} footer={<button type="button" onClick={closeMovementHistory} disabled={movementLoading && stockMovements.length === 0}>Close</button>}>
        <div className="product-modal-form">
          {selectedProduct ? (
              <div className="product-movement-history-body">
                {(movementLoading || stockMovements.length > 0) && (
                  <div className="table-wrap sheet-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockMovements.map((movement) => (
                          <tr key={movement.id}>
                            <td>{movement.created_at}</td>
                            <td>{movement.movement_type}</td>
                            <td className={movement.quantity_change < 0 ? 'danger-text' : 'gain-text'}>{movement.quantity_change}</td>
                            <td>{movement.reference_type || '-'}</td>
                          </tr>
                        ))}
                        {movementLoading && Array.from({ length: stockMovements.length > 0 ? 2 : 6 }, (_, index) => (
                          <tr key={`movement-skeleton-${index}`} className="product-movement-skeleton-row" aria-hidden="true">
                            <td><i /></td>
                            <td><i /></td>
                            <td><i /></td>
                            <td><i /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {movementLoading && <span className="visually-hidden" role="status" aria-live="polite">Loading stock history…</span>}
                    {stockMovements.length > 0 && (
                      <div className="product-movement-endless-footer">
                        <span>{stockMovements.length} of {movementTotal} movements</span>
                        {stockMovements.length < movementTotal
                          ? <span>{movementLoading ? 'Loading more…' : 'Scroll for more'}</span>
                          : <span>All history loaded</span>}
                      </div>
                    )}
                  </div>
                )}
                {!movementLoading && !stockMovements.length && <EmptyState>No stock movements yet.</EmptyState>}
              </div>
          ) : (
            <EmptyState>Select a product first.</EmptyState>
          )}
        </div>
      </Modal>

    </>
  );
}
