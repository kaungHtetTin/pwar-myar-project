import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Search, ShoppingBasket, Trash2 } from 'lucide-react';
import { request, requestAllPages } from '../api';
import { actionLabel, money, normalizeNumber } from '../utils';
import { EmptyState, Field, LoadingState, Modal } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useConfirmation } from '../components/confirmations';
import { RemoteCombobox } from '../components/RemoteCombobox';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { belowCostPrices, purchaseCostWarnings } from '../costing';
import { baseUnitName, purchaseUnitFor, purchaseUnitOptions, stockWithUnit } from '../productUnits';

export function blankPurchaseForm() {
  return {
    supplier_id: null,
    supplier_name: '',
    payment_method: 'Cash',
    paid_amount: null,
    note: '',
    items: [],
  };
}

const PURCHASE_WIZARD_STEPS = [
  { id: 1, label: 'Basic information', shortLabel: 'Basic' },
  { id: 2, label: 'Product selection', shortLabel: 'Products' },
  { id: 3, label: 'Quantity form', shortLabel: 'Quantities' },
  { id: 4, label: 'Review and submit', shortLabel: 'Review' },
];
const PURCHASE_PRODUCT_BATCH_SIZE = 20;

function productRows(payload) {
  return Array.isArray(payload) ? payload : payload?.items || [];
}

function purchaseItemFromApi(item, products) {
  const product = products.find((row) => Number(row.id) === Number(item.product_id));
  const unitName = Number(item.conversion_factor || 1) === 1 ? baseUnitName(product) : item.unit_name;
  return {
    id: item.id,
    product_id: item.product_id,
    product_name: item.product_name,
    current_stock: product ? stockWithUnit(product) : '-',
    unit_name: unitName,
    conversion_factor: item.conversion_factor || 1,
    quantity: item.quantity,
    foc_quantity: item.foc_quantity || 0,
    unit_cost: item.unit_cost,
    effective_unit_cost: item.effective_unit_cost ?? item.unit_cost,
    line_total: item.line_total,
    product,
  };
}

function purchaseItemFromProduct(product) {
  const selectedUnit = purchaseUnitOptions(product).at(-1) || { name: baseUnitName(product), factor: 1 };
  const unitCost = Math.round(Number(product.cost || 0) * selectedUnit.factor);
  return {
    product_id: product.id,
    product_name: product.name,
    current_stock: stockWithUnit(product),
    unit_name: selectedUnit.name,
    conversion_factor: selectedUnit.factor,
    quantity: 1,
    foc_quantity: 0,
    unit_cost: unitCost,
    effective_unit_cost: unitCost / selectedUnit.factor,
    line_total: unitCost,
    product,
  };
}

export function NewPurchaseScreen({ purchaseId = null, purchaseDraftId = null, requestKey = 0, onExit, modal = false, open = true }) {
  const [products, setProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(blankPurchaseForm());
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [selectingAllProducts, setSelectingAllProducts] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const productListSentinelRef = React.useRef(null);
  const selectAllProductsRef = React.useRef(null);
  const productFilterTimerRef = React.useRef(null);
  const productLoadSequence = React.useRef(0);
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();
  const selectedPurchaseItems = form.items;

  const selectedProductIds = useMemo(
    () => new Set(selectedPurchaseItems.map((item) => Number(item.product_id))),
    [selectedPurchaseItems],
  );
  const visibleProducts = useMemo(() => {
    if (modal) return products;
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter && product.category !== categoryFilter) return false;
      if (!query) return true;
      return [product.name, product.sku, product.barcode, product.category]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [modal, products, productSearch, categoryFilter]);
  const allMatchingProductsLoaded = !modal || products.length >= productTotal;
  const allMatchingProductsSelected = visibleProducts.length > 0
    && allMatchingProductsLoaded
    && visibleProducts.every((product) => selectedProductIds.has(Number(product.id)));
  const someLoadedProductsSelected = visibleProducts.some((product) => selectedProductIds.has(Number(product.id)));
  const paidQuantity = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.conversion_factor || 1), 0);
  const focQuantity = form.items.reduce((sum, item) => sum + Number(item.foc_quantity || 0) * Number(item.conversion_factor || 1), 0);
  const totalQuantity = paidQuantity + focQuantity;
  const totalCost = form.items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const purchasePaidAmount = form.paid_amount === null
    ? totalCost
    : form.paid_amount === '' ? 0 : normalizeNumber(form.paid_amount, 0);
  const purchaseCreditAmount = Math.max(0, totalCost - purchasePaidAmount);

  React.useEffect(() => {
    if (selectAllProductsRef.current) {
      selectAllProductsRef.current.indeterminate = someLoadedProductsSelected && !allMatchingProductsSelected;
    }
  }, [allMatchingProductsSelected, someLoadedProductsSelected]);

  useLatestEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setMessage('');
    setWizardStep(1);
    setForm(blankPurchaseForm());
    setSelectedSupplier(null);
    setEditingId(null);
    setProductSearch('');
    setCategoryFilter('');
    setCatalogReady(false);
    setProductTotal(0);
    setSelectingAllProducts(false);

    async function initialize() {
      try {
        const [categoryPayload, productPayload, purchase, invoiceDraft] = await Promise.all([
          request('/categories'),
          modal ? Promise.resolve({ items: [], total: 0 }) : request('/products?limit=80&offset=0'),
          purchaseId ? request(`/purchases/${purchaseId}`) : Promise.resolve(null),
          purchaseDraftId ? request(`/ai-assistant/purchase-drafts/${purchaseDraftId}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const nextProducts = productRows(productPayload);
        if (purchase && modal) {
          const purchaseProductIds = [...new Set((purchase.items || []).map((item) => Number(item.product_id)).filter(Boolean))];
          if (purchaseProductIds.length) {
            const productParams = new URLSearchParams({ ids: purchaseProductIds.join(','), include_inactive: 'true' });
            nextProducts.push(...await requestAllPages(`/products?${productParams.toString()}`));
          }
        }
        if (cancelled) return;
        setCategories(categoryPayload || []);
        setProducts(nextProducts);
        setProductTotal(purchase && modal ? nextProducts.length : Number(productPayload?.total ?? nextProducts.length));
        if (purchase) {
          setEditingId(purchase.id);
          setForm({
            supplier_id: purchase.supplier_id || null,
            supplier_name: purchase.supplier_name || '',
            payment_method: purchase.payment_method || 'Cash',
            paid_amount: purchase.paid_amount ?? purchase.total_cost ?? null,
            note: purchase.note || '',
            items: (purchase.items || []).map((item) => purchaseItemFromApi(item, nextProducts)),
          });
          setSelectedSupplier(purchase.supplier_name
            ? { id: purchase.supplier_id || `existing-${purchase.id}`, name: purchase.supplier_name }
            : null);
        }
        if (invoiceDraft) {
          const invoiceProducts=invoiceDraft.form.items.map(item=>item.product);
          setForm({...blankPurchaseForm(),...invoiceDraft.form,items:invoiceDraft.form.items.map(item=>purchaseItemFromApi(item,invoiceProducts))});
          setSelectedSupplier({id:invoiceDraft.form.supplier_id || 'invoice-supplier',name:invoiceDraft.form.supplier_name});
          setMessage('Invoice draft loaded. Verify all lines and payment details before saving. Nothing has been posted.');
        }
        setCatalogReady(true);
      } catch (err) {
        if (!cancelled) setError(`Cannot prepare purchase form. ${err.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();
    return () => { cancelled = true; };
  }, [modal, requestKey, purchaseId, purchaseDraftId]);

  const loadPurchaseProducts = React.useCallback(async ({ append = false } = {}) => {
    if (append && (productLoading || loadingMoreProducts || products.length >= productTotal)) return;
    const sequence = ++productLoadSequence.current;
    const params = new URLSearchParams({
      limit: String(modal ? PURCHASE_PRODUCT_BATCH_SIZE : 80),
      offset: String(append ? products.length : 0),
    });
    if (modal) {
      params.set('with_total', 'true');
      if (productSearch.trim()) params.set('q', productSearch.trim());
      if (categoryFilter) params.set('category', categoryFilter);
    }
    if (append) setLoadingMoreProducts(true);
    else setProductLoading(true);
    try {
      const payload = await request(`/products?${params.toString()}`);
      if (sequence === productLoadSequence.current) {
        const nextRows = productRows(payload);
        setProducts((current) => {
          if (!append) return nextRows;
          const existingIds = new Set(current.map((product) => Number(product.id)));
          return [...current, ...nextRows.filter((product) => !existingIds.has(Number(product.id)))];
        });
        setProductTotal(Number(payload?.total ?? nextRows.length));
      }
    } catch (err) {
      if (sequence === productLoadSequence.current) setError(err.message);
    } finally {
      if (sequence === productLoadSequence.current) {
        setProductLoading(false);
        setLoadingMoreProducts(false);
      }
    }
  }, [categoryFilter, loadingMoreProducts, modal, productLoading, productSearch, productTotal, products.length, setError]);

  useLatestEffect(() => {
    if (!modal || !catalogReady) return undefined;
    productFilterTimerRef.current = window.setTimeout(() => {
      productFilterTimerRef.current = null;
      loadPurchaseProducts({ append: false });
    }, 220);
    return () => {
      window.clearTimeout(productFilterTimerRef.current);
      productFilterTimerRef.current = null;
    };
  }, [catalogReady, modal, productSearch, categoryFilter]);

  React.useEffect(() => {
    if (!modal) return undefined;
    const sentinel = productListSentinelRef.current;
    if (!sentinel || productLoading || loadingMoreProducts || selectingAllProducts || products.length >= productTotal) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadPurchaseProducts({ append: true });
    }, { root: sentinel.closest('.purchase-product-picker'), rootMargin: '0px 0px 160px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPurchaseProducts, loadingMoreProducts, modal, productLoading, productTotal, products.length, selectingAllProducts]);

  function handleProductPickerScroll(event) {
    if (!modal || productLoading || loadingMoreProducts || selectingAllProducts || products.length >= productTotal) return;
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 180) loadPurchaseProducts({ append: true });
  }

  useDataRefresh(['products', 'suppliers', 'settings', 'priceTypes'], 'new-purchase', () => loadPurchaseProducts({ append: false }));

  const loadSupplierOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/suppliers?${params.toString()}`);
    return data.items || [];
  }, []);

  async function closeWizard() {
    const hasDraft = Boolean(form.supplier_name.trim() || form.note.trim() || form.items.length || editingId);
    if (hasDraft) {
      const { confirmed } = await confirmAction({
        title: 'Discard purchase draft',
        message: 'Leave this purchase form? Unsaved information will be lost.',
        confirmLabel: 'Discard Draft',
      });
      if (!confirmed) return;
    }
    onExit?.();
  }

  function addProduct(product) {
    setMessage('');
    setError('');
    if (form.items.some((item) => Number(item.product_id) === Number(product.id))) return;
    setForm((current) => ({
      ...current,
      items: [...current.items, purchaseItemFromProduct(product)],
    }));
    setMessage(`${product.name} selected.`);
  }

  function updateItemUnit(itemKey, product, unitName) {
    const unit = purchaseUnitFor(product, unitName);
    const unitCost = Math.round(Number(product?.cost || 0) * unit.factor);
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (`${item.product_id}:${item.unit_name}` !== itemKey) return item;
        const quantity = normalizeNumber(item.quantity, 0);
        const foc = normalizeNumber(item.foc_quantity, 0);
        return {
          ...item,
          unit_name: unit.name,
          conversion_factor: unit.factor,
          unit_cost: unitCost,
          line_total: quantity * unitCost,
          effective_unit_cost: quantity + foc > 0 ? (quantity * unitCost) / ((quantity + foc) * unit.factor) : 0,
        };
      }),
    }));
  }

  function updateItem(itemKey, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (`${item.product_id}:${item.unit_name}` !== itemKey) return item;
        const next = { ...item, ...patch };
        const quantity = normalizeNumber(next.quantity, 0);
        const foc = normalizeNumber(next.foc_quantity, 0);
        const unitCost = normalizeNumber(next.unit_cost, 0);
        return {
          ...next,
          line_total: quantity * unitCost,
          effective_unit_cost: quantity + foc > 0
            ? (quantity * unitCost) / ((quantity + foc) * Number(next.conversion_factor || 1))
            : 0,
        };
      }),
    }));
  }

  function removeItem(itemKey) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => `${item.product_id}:${item.unit_name}` !== itemKey),
    }));
  }

  function toggleProduct(product, selected) {
    if (selected) {
      addProduct(product);
      return;
    }
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => Number(item.product_id) !== Number(product.id)),
    }));
    setMessage(`${product.name} removed.`);
  }

  async function toggleMatchingProducts(selected) {
    const params = new URLSearchParams();
    if (productSearch.trim()) params.set('q', productSearch.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    const path = `/products${params.size ? `?${params.toString()}` : ''}`;

    window.clearTimeout(productFilterTimerRef.current);
    productFilterTimerRef.current = null;
    setSelectingAllProducts(true);
    setMessage('');
    setError('');
    try {
      const matchingProducts = await requestAllPages(path);
      setProducts(matchingProducts);
      setProductTotal(matchingProducts.length);
      const matchingIds = new Set(matchingProducts.map((product) => Number(product.id)));
      if (selected) {
        setForm((current) => {
          const existingIds = new Set(current.items.map((item) => Number(item.product_id)));
          return {
            ...current,
            items: [
              ...current.items,
              ...matchingProducts
                .filter((product) => !existingIds.has(Number(product.id)))
                .map(purchaseItemFromProduct),
            ],
          };
        });
        setMessage(`${matchingProducts.length.toLocaleString()} matching product${matchingProducts.length === 1 ? '' : 's'} selected.`);
      } else {
        setForm((current) => ({
          ...current,
          items: current.items.filter((item) => !matchingIds.has(Number(item.product_id))),
        }));
        setMessage(`${matchingProducts.length.toLocaleString()} matching product${matchingProducts.length === 1 ? '' : 's'} cleared.`);
      }
    } catch (err) {
      setError(`Cannot update all matching products. ${err.message}`);
    } finally {
      setSelectingAllProducts(false);
    }
  }

  function quantityError() {
    const invalidItem = form.items.find(
      (item) => !Number.isFinite(normalizeNumber(item.quantity, NaN))
        || normalizeNumber(item.quantity, 0) <= 0
        || !Number.isFinite(normalizeNumber(item.foc_quantity, NaN))
        || normalizeNumber(item.foc_quantity, 0) < 0
        || !Number.isFinite(normalizeNumber(item.unit_cost, NaN))
        || normalizeNumber(item.unit_cost, 0) < 0,
    );
    return invalidItem ? 'Each item needs quantity greater than zero and unit cost zero or greater.' : '';
  }

  function nextStep() {
    setError('');
    if (wizardStep === 2 && !selectedPurchaseItems.length) {
      setError('Select at least one product to continue.');
      return;
    }
    if (wizardStep === 3) {
      const error = quantityError();
      if (error) {
        setError(error);
        return;
      }
    }
    if (wizardStep === 3 && purchaseCreditAmount > 0 && !form.supplier_id) {
      setError('Choose a saved supplier before recording a credit purchase.');
      return;
    }
    setWizardStep((current) => Math.min(4, current + 1));
  }

  async function savePurchase() {
    setMessage('');
    setError('');
    if (!form.items.length) {
      setError('Add at least one product item.');
      return;
    }
    const invalidItemMessage = quantityError();
    if (invalidItemMessage) {
      setError(invalidItemMessage);
      return;
    }
    if (!Number.isFinite(purchasePaidAmount) || purchasePaidAmount < 0 || purchasePaidAmount > totalCost) {
      setError('Paid amount must be between zero and the purchase total.');
      return;
    }
    if (purchaseCreditAmount > 0 && !form.supplier_id) {
      setError('Choose a saved supplier before recording a credit purchase.');
      return;
    }

    const payload = {
      supplier_id: form.supplier_id || null,
      supplier_name: String(form.supplier_name || '').trim(),
      payment_method: form.payment_method || 'Cash',
      paid_amount: Math.round(purchasePaidAmount),
      note: String(form.note || '').trim(),
      items: form.items.map((item) => ({
        id: item.id || undefined,
        product_id: item.product_id,
        unit_name: item.unit_name,
        quantity: normalizeNumber(item.quantity, 0),
        foc_quantity: normalizeNumber(item.foc_quantity, 0),
        unit_cost: normalizeNumber(item.unit_cost, 0),
      })),
    };

    const warnings = purchaseCostWarnings(
      form.items.map((item) => ({ ...item, unit_cost: item.effective_unit_cost })),
      products,
    );
    if (warnings.length) {
      const warningLines = warnings.map((warning) => `${warning.productName}: ${warning.name} ${money(warning.price)} is below new cost ${money(warning.cost)}`);
      const { confirmed } = await confirmAction({
        title: 'Selling price below cost',
        message: `The new buying cost is higher than these selling prices:\n${warningLines.join('\n')}\n\nSave this purchase anyway?`,
        confirmLabel: 'Save Anyway',
        danger: false,
      });
      if (!confirmed) return;
    }

    try {
      setSaving(true);
      const saved = await request(editingId ? `/purchases/${editingId}` : '/purchases', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const priceChangeCount = saved.price_changes?.length || 0;
      const baseMessage = editingId ? 'Purchase updated.' : 'Purchase saved.';
      setMessage(priceChangeCount ? `${baseMessage} ${priceChangeCount} automatic price(s) updated.` : baseMessage);
      if (!editingId) { setForm(blankPurchaseForm()); setSelectedSupplier(null); setWizardStep(1); setProductSearch(''); setCategoryFilter(''); }
      emitDataChange(['purchases', 'products', 'suppliers', 'reports'], 'new-purchase');
      onExit?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderWizardTabs(extraClass = '') {
    return (
      <nav className={`purchase-wizard-steps${extraClass ? ` ${extraClass}` : ''}`} aria-label="Purchase form progress">
        {PURCHASE_WIZARD_STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            className={step.id === wizardStep ? 'active' : step.id < wizardStep ? 'completed' : ''}
            disabled={step.id > wizardStep}
            onClick={() => { if (step.id < wizardStep) { setError(''); setWizardStep(step.id); } }}
            aria-current={step.id === wizardStep ? 'step' : undefined}
            aria-label={step.label}
          >
            <span>{step.id < wizardStep ? <Check size={15} /> : step.id}</span><strong>{step.shortLabel}</strong>
          </button>
        ))}
      </nav>
    );
  }

  function renderWizardActions({ showCancel = true } = {}) {
    return (
      <>
        {showCancel && <button type="button" onClick={closeWizard}>Cancel</button>}<span>Step {wizardStep} of 4</span>
        <div>
          {wizardStep > 1 && <button type="button" onClick={() => { setError(''); setWizardStep((current) => current - 1); }}><ChevronLeft size={16} /> Previous</button>}
          {wizardStep < 4
            ? <button type="button" className="primary" onClick={nextStep}>Continue <ChevronRight size={16} /></button>
            : <button type="button" className="primary" disabled={saving} onClick={savePurchase}><ShoppingBasket size={17} /> {actionLabel(saving, 'Saving...', editingId ? 'Update Purchase' : 'Submit Purchase')}</button>}
        </div>
      </>
    );
  }

  const wizard = (
    <section className={`screen purchases-layout mkpos-sheet${modal ? ' purchase-modal-layout' : ''}`}>
      <div className="panel purchase-main-panel purchase-wizard-mode">
        <div className="purchase-wizard-page">
          {!modal && renderWizardTabs()}

          <div className="purchase-wizard-body">
            {wizardStep === 1 && (
              <section className="purchase-wizard-section purchase-basic-step" aria-label="Basic information">
                <div className="purchase-basic-form">
                  <Field label="Supplier">
                    <RemoteCombobox
                      value={form.supplier_id || ''}
                      selectedOption={selectedSupplier}
                      loadOptions={loadSupplierOptions}
                      placeholder="Search or type supplier"
                      onQueryChange={(name) => setForm((current) => ({ ...current, supplier_id: null, supplier_name: name }))}
                      onSelect={(supplier) => {
                        setSelectedSupplier(supplier);
                        setForm((current) => ({ ...current, supplier_id: supplier?.id || null, supplier_name: supplier?.name || current.supplier_name }));
                      }}
                    />
                  </Field>
                  <Field label="Reference note"><textarea rows="4" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Invoice number or optional note" /></Field>
                </div>
              </section>
            )}

            {wizardStep === 2 && (
              <section className="purchase-wizard-section purchase-product-step" aria-label="Product selection">
                <div className="purchase-product-filters">
                  <label className="purchase-product-search"><Search size={17} /><input value={productSearch} disabled={selectingAllProducts} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search name, SKU, barcode, or category" /></label>
                  <select value={categoryFilter} disabled={selectingAllProducts} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                </div>
                <div className="purchase-product-table-frame" aria-busy={selectingAllProducts}>
                  <div className="purchase-product-select-header">
                    <span className="purchase-product-check-cell"><input ref={selectAllProductsRef} type="checkbox" aria-label="Select all matching products" title={`Select all ${productTotal.toLocaleString()} matching products`} checked={allMatchingProductsSelected} disabled={productLoading || loadingMoreProducts || selectingAllProducts || productTotal === 0} onChange={(event) => toggleMatchingProducts(event.target.checked)} /></span>
                    <span>Product</span><span>Category</span><span>Stock</span><span>Cost</span><span>Buying units</span>
                  </div>
                  <div className="purchase-product-picker" onScroll={handleProductPickerScroll}>
                    {visibleProducts.length > 0 && (
                    <div className="purchase-product-select-list" role="listbox" aria-label="Purchase products" aria-multiselectable="true">
                      {visibleProducts.map((product) => {
                        const selected = selectedProductIds.has(Number(product.id));
                        return (
                          <div
                            key={product.id}
                            className={`purchase-product-select-row${selected ? ' selected' : ''}`}
                            role="option"
                            aria-label={product.name}
                            aria-selected={selected}
                            tabIndex="0"
                            onClick={() => toggleProduct(product, !selected)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                              event.preventDefault();
                              toggleProduct(product, !selected);
                            }}
                          >
                            <span className="purchase-product-check-cell"><input type="checkbox" aria-label={`Select ${product.name}`} checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => toggleProduct(product, event.target.checked)} /></span>
                            <span><strong>{product.name}</strong></span>
                            <span>{product.category || 'Uncategorized'}</span>
                            <span>{stockWithUnit(product)}</span>
                            <span><strong>{money(product.cost)}</strong> / {baseUnitName(product)}</span>
                            <span>{purchaseUnitOptions(product).map((unit) => unit.name).join(' · ')}</span>
                          </div>
                        );
                      })}
                    </div>
                    )}
                    {productLoading && (
                      <div className={`purchase-product-picker-loading${modal ? ' purchase-product-picker-loading--modal' : ''}`} role="status" aria-live="polite">
                        {modal ? (
                          <div className="purchase-product-table-skeleton" aria-hidden="true">
                            {Array.from({ length: 6 }, (_, rowIndex) => (
                              <div key={rowIndex}>{Array.from({ length: 6 }, (_, cellIndex) => <i key={cellIndex} />)}</div>
                            ))}
                          </div>
                        ) : <LoadingState>Loading products...</LoadingState>}
                        {modal && <span className="visually-hidden">Loading products...</span>}
                      </div>
                    )}
                    {modal && !selectingAllProducts && productTotal > products.length && <div ref={productListSentinelRef} className="purchase-product-sentinel" aria-hidden="true" />}
                    {modal && loadingMoreProducts && <div className="purchase-product-load-more" role="status">Loading more products...</div>}
                    {selectingAllProducts && <div className="purchase-product-load-more" role="status">Updating all matching products...</div>}
                    {!visibleProducts.length && !productLoading && <EmptyState>No products match this search.</EmptyState>}
                  </div>
                </div>
              </section>
            )}

            {wizardStep === 3 && (
              <section className="purchase-wizard-section purchase-quantity-step" aria-label="Quantity form">
                <div className="purchase-wizard-table-wrap">
                  <table className="purchase-wizard-quantity-table">
                    <colgroup><col span="7" /><col className="table-action-column" /></colgroup>
                    <thead><tr><th>Product</th><th>Buying Unit</th><th>Paid Qty</th><th>FOC Qty</th><th>Unit Cost</th><th>Effective Cost</th><th>Line Total</th><th aria-label="Actions"></th></tr></thead>
                    <tbody>
                      {selectedPurchaseItems.map((item) => {
                        const product = products.find((row) => Number(row.id) === Number(item.product_id)) || item.product || { base_unit: item.unit_name };
                        const costWarnings = belowCostPrices(product, item.effective_unit_cost);
                        const itemKey = `${item.product_id}:${item.unit_name}`;
                        return (
                          <tr key={itemKey} className={costWarnings.length ? 'purchase-below-cost-row' : ''}>
                            <td><strong>{item.product_name}</strong><small>{item.current_stock}</small></td>
                            <td><select value={item.unit_name} onChange={(event) => updateItemUnit(itemKey, product, event.target.value)}>{purchaseUnitOptions(product).map((unit) => <option key={unit.name} value={unit.name}>{unit.name}{unit.factor > 1 ? ` (×${unit.factor})` : ''}</option>)}</select></td>
                            <td><input aria-label={`${item.product_name} paid quantity`} type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(itemKey, { quantity: event.target.value })} /></td>
                            <td><input aria-label={`${item.product_name} FOC quantity`} type="number" min="0" step="0.001" value={item.foc_quantity ?? ''} onChange={(event) => updateItem(itemKey, { foc_quantity: event.target.value })} /></td>
                            <td><input aria-label={`${item.product_name} unit cost`} type="number" min="0" value={item.unit_cost} onChange={(event) => updateItem(itemKey, { unit_cost: event.target.value })} />{costWarnings.length > 0 && <small className="purchase-cost-warning">Below cost: {costWarnings.map((warning) => warning.name).join(', ')}</small>}</td>
                            <td>{money(item.effective_unit_cost)}</td><td><strong>{money(item.line_total)}</strong></td>
                            <td><button type="button" className="icon-btn danger purchase-remove-item" aria-label={`Remove ${item.product_name}`} onClick={() => removeItem(itemKey)}><Trash2 size={14} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="purchase-wizard-totals" aria-label="Purchase quantity summary"><span>Paid <strong>{paidQuantity}</strong></span><span>FOC <strong>{focQuantity}</strong></span><span>Received <strong>{totalQuantity}</strong></span><span className="total">Total <strong>{money(totalCost)}</strong></span></div>
              </section>
            )}

            {wizardStep === 4 && (
              <section className="purchase-wizard-section purchase-review-step" aria-label="Review and submit">
                <div className="purchase-review-scroll">
                  <div className="purchase-review-overview">
                    <section className="purchase-review-card purchase-review-basic" aria-labelledby="purchase-review-basic-title">
                      <header className="purchase-review-card-heading">
                        <div><span>Purchase details</span><h3 id="purchase-review-basic-title">Basic information</h3></div>
                        <button type="button" className="purchase-review-edit" onClick={() => setWizardStep(1)}><Pencil size={14} /> Edit</button>
                      </header>
                      <dl className="purchase-review-meta">
                        <div><dt>Supplier</dt><dd>{form.supplier_name || 'Not specified'}</dd></div>
                        <div><dt>Note</dt><dd>{form.note || 'No note'}</dd></div>
                      </dl>
                    </section>
                    <section className="purchase-review-card purchase-payment-panel" aria-labelledby="purchase-review-payment-title">
                      <header className="purchase-review-card-heading">
                        <div><span>Settlement</span><h3 id="purchase-review-payment-title">Payment</h3></div>
                      </header>
                      <div className="purchase-payment-fields">
                        <Field label="Payment Method">
                          <select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>
                            {['Cash', 'Banking Pay', 'Wallet Pay', 'KPay', 'Wave Pay'].map((method) => <option key={method} value={method}>{method}</option>)}
                          </select>
                        </Field>
                        <Field label="Paid Now">
                          <input type="number" min="0" max={totalCost} value={form.paid_amount === null ? totalCost : form.paid_amount} onChange={(event) => setForm({ ...form, paid_amount: event.target.value })} />
                        </Field>
                        <div className={`purchase-payment-balance${purchaseCreditAmount > 0 ? ' has-credit' : ''}`}><span>Supplier credit</span><strong>{money(purchaseCreditAmount)}</strong><small>{purchaseCreditAmount > 0 ? 'Added to the supplier account' : 'Purchase is fully paid'}</small></div>
                      </div>
                    </section>
                  </div>
                  <div className="purchase-review-table-wrap">
                    <table className="purchase-review-table">
                      <thead><tr><th>Product</th><th>Unit</th><th>Paid</th><th>FOC</th><th>Unit Cost</th><th>Received</th><th>Total</th></tr></thead>
                      <tbody>{form.items.map((item) => <tr key={`${item.product_id}:${item.unit_name}`}><td><strong>{item.product_name}</strong></td><td>{item.unit_name}</td><td>{item.quantity}</td><td>{item.foc_quantity || 0}</td><td>{money(item.unit_cost)}</td><td>{(Number(item.quantity || 0) + Number(item.foc_quantity || 0)) * Number(item.conversion_factor || 1)}</td><td><strong>{money(item.line_total)}</strong></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
                <div className="purchase-wizard-totals purchase-review-total" aria-label="Purchase review summary"><span>Products <strong>{form.items.length}</strong></span><span>Received <strong>{totalQuantity}</strong></span><span>Paid now <strong>{money(purchasePaidAmount)}</strong></span><span>Credit <strong>{money(purchaseCreditAmount)}</strong></span><span className="total">Purchase total <strong>{money(totalCost)}</strong></span></div>
              </section>
            )}
          </div>

          {!modal && <footer className="purchase-wizard-footer">{renderWizardActions()}</footer>}

          {loading && (
            <div className={`purchase-workspace-loading${modal ? ' purchase-workspace-loading--modal' : ''}`} role="status" aria-live="polite">
              {modal ? (
                <div className="purchase-modal-form-skeleton" aria-hidden="true">
                  <i className="purchase-modal-skeleton-label" />
                  <i className="purchase-modal-skeleton-control" />
                  <i className="purchase-modal-skeleton-label purchase-modal-skeleton-label--note" />
                  <i className="purchase-modal-skeleton-note" />
                </div>
              ) : <LoadingState>Loading purchase workspace...</LoadingState>}
              {modal && <span className="visually-hidden">Loading purchase workspace...</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  if (!modal) return wizard;
  return (
    <Modal
      open={open}
      title={purchaseId ? 'Edit Purchase' : 'New Purchase'}
      subtitle={purchaseId ? 'Update buying units, quantities, costs, and supplier payment details.' : 'Receive inventory with buying units, FOC quantities, and supplier payment details.'}
      headerContent={renderWizardTabs('purchase-wizard-header-tabs')}
      onClose={closeWizard}
      busy={saving}
      focusFirstField={false}
      className="purchase-create-modal"
      footer={<div className="purchase-wizard-footer purchase-wizard-footer--modal">{renderWizardActions({ showCancel: false })}</div>}
    >
      {wizard}
    </Modal>
  );
}
