import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Plus, Printer, ShoppingCart, Trash2 } from 'lucide-react';
import { request } from '../api';
import { actionLabel, money, normalizeNumber } from '../utils';
import { EmptyState, Field, LoadingState, Modal } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { RemoteCombobox } from '../components/RemoteCombobox';
import { cleanPriceTypes } from '../priceTypes';
import { priceMargin } from '../costing';
import { printReceiptText, printResultMessage } from '../printing';
import { usePrinting } from '../hooks/usePrinting';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { baseUnitName, hasPurchaseUnit, purchaseUnitFactor, stockWithUnit } from '../productUnits';
import { ProductPhoto } from '../components/ProductPhoto';

function productPrice(product, priceType) {
  const prices = product.prices || [];
  const selected = prices.find((price) => price.name === priceType);
  if (selected) return Number(selected.price || 0);
  if (priceType !== 'Retail') return 0;
  const retail = prices.find((price) => price.name === 'Retail' && Number(price.price || 0) > 0);
  return Number((retail && retail.price) || product.price || 0);
}
function cleanPaymentMethods(settings) {
  const fallback = ['Cash', 'Banking Pay', 'KPay', 'Wave Pay'];
  const raw = String(settings.payment_methods || '').split(',').map((item) => item.trim()).filter(Boolean);
  return raw.length ? raw : fallback;
}

const SALE_PRODUCT_BATCH_SIZE = 40;

export function SaleScreen() {
  const printing = usePrinting();
  const lastPrintRequest = useRef(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const scanRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name_asc');
  const [priceType, setPriceType] = useState('Retail');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [customerFormError, setCustomerFormError] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const productListSentinelRef = useRef(null);
  const productLoadSequence = React.useRef(0);
  const [saving, setSaving] = useState(false);
  const { setMessage, setError } = useScreenNotifications();

  const paymentMethods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const priceTypes = useMemo(() => cleanPriceTypes(settings.price_types), [settings.price_types]);
  const filteredProducts = products;
  const subtotal = cart.reduce((sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  const discountAmount = Math.max(0, Math.round(normalizeNumber(discount, 0)));
  const total = Math.max(0, subtotal - discountAmount);
  const cleanPaidAmount = Math.max(0, Math.round(normalizeNumber(paidAmount, 0)));
  const paidForSale = Math.min(cleanPaidAmount, total);
  const changeAmount = Math.max(cleanPaidAmount - total, 0);
  const unpaidAmount = Math.max(total - paidForSale, 0);
  const focOnly = cart.length > 0
    && cart.every((item) => normalizeNumber(item.quantity, 0) === 0)
    && cart.some((item) => normalizeNumber(item.foc_quantity, 0) > 0);
  const stockWarnings = cart.filter(
    (item) => Number(item.quantity || 0) + Number(item.foc_quantity || 0) > Number(item.stock || 0),
  );

  const loadProducts = React.useCallback(({ append = false, reconcile = false } = {}) => {
    if (append && (loadingMoreProducts || products.length >= productTotal)) return Promise.resolve();
    const sequence = ++productLoadSequence.current;
    const offset = append ? products.length : 0;
    const params = new URLSearchParams();
    params.set('with_total', 'true');
    params.set('limit', String(reconcile ? Math.min(500, Math.max(SALE_PRODUCT_BATCH_SIZE, products.length)) : SALE_PRODUCT_BATCH_SIZE));
    params.set('offset', String(offset));
    if (search.trim()) params.set('q', search.trim());
    if (category) params.set('category', category);
    params.set('sort', sort);
    if (append) setLoadingMoreProducts(true);
    else if (!reconcile) setLoading(true);
    setError('');
    const fetchPages = async () => {
      const result = await request(`/products?${params.toString()}`);
      if (!reconcile) return result;
      const rows = [...(result.items || [])];
      while (sequence === productLoadSequence.current && rows.length < products.length && rows.length < result.total) {
        params.set('offset', String(rows.length));
        params.set('limit', String(Math.min(500, products.length - rows.length)));
        const next = await request(`/products?${params.toString()}`);
        if (!next.items?.length) break;
        rows.push(...next.items);
      }
      return { ...result, items: rows };
    };
    return fetchPages().then((productData) => {
      if (sequence !== productLoadSequence.current) return;
      const pageItems = productData.items || [];
      setProducts((current) => {
        if (!append) return pageItems;
        const existingIds = new Set(current.map((product) => product.id));
        return [...current, ...pageItems.filter((product) => !existingIds.has(product.id))];
      });
      setProductTotal(productData.total || 0);
    }).catch((err) => {
      if (sequence === productLoadSequence.current) setError(`Cannot load products. ${err.message}`);
    }).finally(() => {
      if (sequence === productLoadSequence.current) {
        if (append) setLoadingMoreProducts(false);
        else setLoading(false);
      }
    });
  }, [category, loadingMoreProducts, productTotal, products.length, search, sort, setError]);

  function loadSaleMeta() {
    return Promise.all([request('/categories'), request('/settings')]).then(([categoryRows, settingRows]) => {
      setCategories(categoryRows);
      setSettings(settingRows);
      const methods = cleanPaymentMethods(settingRows);
      setPaymentMethod((current) => (
        methods.includes(current) && current !== 'Credit'
          ? current
          : methods.find((method) => method !== 'Credit') || 'Cash'
      ));
    }).catch((err) => {
      setError(`Cannot load sale settings. ${err.message}`);
    });
  }

  useLatestEffect(() => {
    const timer = window.setTimeout(() => loadProducts({ append: false }), 200);
    return () => window.clearTimeout(timer);
  }, [search, category, sort]);

  useLatestEffect(() => {
    loadSaleMeta();
  }, []);

  useDataRefresh(['products'], 'sell', () => loadProducts({ reconcile: true }));
  useDataRefresh(['categories', 'settings', 'priceTypes'], 'sell', loadSaleMeta);

  useEffect(() => {
    const sentinel = productListSentinelRef.current;
    if (!sentinel || loading || loadingMoreProducts || products.length >= productTotal) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadProducts({ append: true });
    }, { root: sentinel.closest('.sale-product-grid'), rootMargin: '0px 0px 180px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadProducts, loading, loadingMoreProducts, productTotal, products.length]);

  useEffect(() => {
    const input = scanRef.current;
    const moduleView = input?.closest('.module-view');
    let frame = 0;
    const focusScanner = () => {
      if (moduleView?.hidden) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => input?.focus());
    };
    focusScanner();
    if (!moduleView) return () => window.cancelAnimationFrame(frame);
    const observer = new MutationObserver(focusScanner);
    observer.observe(moduleView, { attributes: true, attributeFilter: ['hidden'] });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const loadCustomerOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/customers?${params.toString()}`);
    return data.items || [];
  }, []);

  useEffect(() => {
    if (paymentMethod === 'Credit') {
      setPaymentMethod(paymentMethods.filter((method) => method !== 'Credit')[0] || 'Cash');
    }
  }, [paymentMethod, paymentMethods]);

  useEffect(() => {
    if (!priceTypes.includes(priceType)) setPriceType(priceTypes[0]);
  }, [priceType, priceTypes]);

  function addProduct(product, selectedPriceType = priceType) {
    const unitPrice = productPrice(product, selectedPriceType);
    if (unitPrice <= 0) {
      setError(`No usable price for ${product.name}.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id && item.price_type === selectedPriceType);
      if (existing) {
        return current.map((item) => (item === existing ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item));
      }
      return [
        ...current,
        {
          product_id: product.id,
          product_name: product.name,
          price_type: selectedPriceType,
          unit_price: unitPrice,
          unit_cost: Number(product.cost || 0),
          base_unit: baseUnitName(product),
          purchase_unit: product.purchase_unit || '',
          purchase_conversion_factor: purchaseUnitFactor(product),
          quantity: 1,
          foc_quantity: 0,
          stock: product.stock,
        },
      ];
    });
    setMessage(`${product.name} added.`);
    setError('');
  }

  async function scanBarcode(event) {
    event.preventDefault();
    const code = search.trim();
    if (!code) return;
    setError('');
    try {
      const product = await request(`/products/barcode/${encodeURIComponent(code)}`);
      addProduct(product);
      setSearch('');
      scanRef.current?.focus();
    } catch {
      setError(`Barcode not found: ${code}`);
    }
  }

  function updateCartQuantity(index, quantity) {
    if (quantity === '') {
      setCart((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, quantity: '' } : item
      )));
      return;
    }
    if (!/^\d*\.?\d{0,3}$/.test(String(quantity))) return;
    setCart((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return { ...item, quantity };
    }));
  }

  function updateCartFocQuantity(index, quantity) {
    if (quantity === '') {
      setCart((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, foc_quantity: '' } : item
      )));
      return;
    }
    if (!/^\d*\.?\d{0,3}$/.test(String(quantity))) return;
    setCart((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, foc_quantity: quantity } : item
    )));
  }

  function normalizeCartFocQuantity(index) {
    setCart((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const clean = normalizeNumber(item.foc_quantity, 0);
      return { ...item, foc_quantity: Number.isFinite(clean) && clean >= 0 ? clean : 0 };
    }));
  }

  function normalizeCartQuantity(index) {
    setCart((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const clean = normalizeNumber(item.quantity, NaN);
      return { ...item, quantity: Number.isFinite(clean) && clean >= 0 ? clean : 0 };
    }));
  }

  function changeCartQuantity(index, delta) {
    setCart((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return { ...item, quantity: Math.max(0, normalizeNumber(item.quantity, 0) + delta) };
    }));
  }

  function addPackQuantity(index) {
    setCart((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, quantity: normalizeNumber(item.quantity, 0) + Number(item.purchase_conversion_factor || 1) }
        : item
    )));
  }

  function removeCartItem(index) {
    setCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearCart({ keepReceipt = false } = {}) {
    setCart([]);
    setDiscount(0);
    setPaidAmount('');
    setCustomerId('');
    setSelectedCustomer(null);
    setCheckoutOpen(false);
    if (!keepReceipt) setReceipt(null);
  }

  function openCheckout() {
    setMessage('');
    setError('');
    if (!cart.length) {
      setError('Add products to cart first.');
      return;
    }
    setCheckoutOpen(true);
  }

  function openCustomerEditor() {
    setCustomerForm({ name: '', phone: '', address: '', note: '' });
    setCustomerFormError('');
    setCheckoutOpen(false);
    setCustomerEditorOpen(true);
  }

  function closeCustomerEditor() {
    setCustomerEditorOpen(false);
    setCheckoutOpen(true);
  }

  async function createCustomer(event) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(customerForm).map(([key, value]) => [key, value.trim()]));
    if (!payload.name) return setCustomerFormError('Customer name is required.');
    setSavingCustomer(true);
    setCustomerFormError('');
    try {
      const created = await request('/customers', { method: 'POST', body: JSON.stringify(payload) });
      setSelectedCustomer(created);
      setCustomerId(String(created.id));
      setCustomerEditorOpen(false);
      setCheckoutOpen(true);
      emitDataChange(['customers'], 'sell');
    } catch (error) {
      setCustomerFormError(error.message);
    } finally {
      setSavingCustomer(false);
    }
  }

  async function checkout() {
    setMessage('');
    setError('');
    if (!cart.length) {
      setError('Add products to cart first.');
      return;
    }
    const invalidItem = cart.find((item) => {
      const quantity = normalizeNumber(item.quantity, NaN);
      const focQuantity = normalizeNumber(item.foc_quantity, NaN);
      return !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(focQuantity) || focQuantity < 0 || quantity + focQuantity <= 0;
    });
    if (invalidItem) {
      setError('Each cart item needs a paid quantity or FOC quantity greater than zero.');
      return;
    }
    if (unpaidAmount > 0 && !customerId) {
      setError('Unpaid amount requires selecting a customer.');
      return;
    }
    const payload = {
      items: cart.map((item) => ({
        product_id: item.product_id,
        price_type: item.price_type,
        quantity: normalizeNumber(item.quantity, 0),
        foc_quantity: normalizeNumber(item.foc_quantity, 0),
        unit_price: Number(item.unit_price || 0),
      })),
      discount: discountAmount,
      payment_type: unpaidAmount > 0 ? 'credit' : 'cash',
      payment_method: focOnly ? 'FOC' : (unpaidAmount > 0 && paidForSale === 0 ? 'Credit' : paymentMethod),
      paid_amount: paidForSale,
      customer_id: customerId ? Number(customerId) : null,
    };
    try {
      setSaving(true);
      const sale = await request('/sales', { method: 'POST', body: JSON.stringify(payload) });
      const receiptPayload = await request(`/sales/${sale.id}/receipt`);
      setReceipt(receiptPayload);
      setMessage('Sale completed.');
      clearCart({ keepReceipt: true });
      await loadProducts({ append: false });
      emitDataChange(['sales', 'products', 'customers', 'reports'], 'sell');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendReceiptToPrinter(receiptPayload) {
    if (!receiptPayload?.sale?.id) return;
    setMessage('');
    setError('');
    try {
      if (window.mkposDesktop?.printReceipt) {
        const printResult = await printReceiptText(
          receiptPayload.text,
          receiptPayload.paper_size || settings.receipt_paper_size,
          { html: receiptPayload.html, layout: receiptPayload.layout, printerName: settings.printer_name },
        );
        setMessage(printResultMessage(printResult));
        return;
      }
      const result = await request(`/sales/${receiptPayload.sale.id}/print`, { method: 'POST' });
      if (!result.ok) {
        await printReceiptText(
          result.text || receiptPayload.text,
          result.paper_size || receiptPayload.paper_size || settings.receipt_paper_size,
          {
            html: result.html || receiptPayload.html,
            layout: result.layout || receiptPayload.layout,
            printerName: settings.printer_name,
          },
        );
      }
      setMessage(result.ok ? (result.message || 'Receipt print requested.') : 'Receipt opened in the browser print dialog.');
    } catch (err) {
      setError(err.message || 'Receipt could not be printed.');
    }
  }

  function printReceipt() {
    return sendReceiptToPrinter(receipt);
  }

  async function printLastReceipt() {
    if (lastPrintRequest.current || printing) return;
    lastPrintRequest.current = true;
    setPreparingPrint(true);
    setError('');
    try {
      const payload = await request('/sales/last/receipt');
      setReceipt(payload);
      await sendReceiptToPrinter(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      lastPrintRequest.current = false;
      setPreparingPrint(false);
    }
  }

  return (
    <>
      <section className="screen sale-screen mkpos-sheet">
        <div className="sale-main-panel">
          <div className="sale-left-panel">
            <form className="sale-scan-bar" onSubmit={scanBarcode}>
              <Field label="Product Search / Barcode">
                <input ref={scanRef} autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU, or scan barcode" />
              </Field>
              <label className="sale-category-field">
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="sale-category-field"><span>Sort by</span><select aria-label="Sort by" value={sort} onChange={event => setSort(event.target.value)}><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option></select></label>
              <button type="submit" className="primary">Add Barcode</button>
            </form>

            <div className="sale-price-types">
              {priceTypes.map((item) => (
                <button key={item} type="button" className={priceType === item ? 'selected' : ''} onClick={() => setPriceType(item)}>
                  {item}
                </button>
              ))}
            </div>

            <div className="sale-product-list">
              <div className="sale-product-count">
                <span>{filteredProducts.length} of {productTotal} products</span>
              </div>
              <div className="sale-product-grid">
                {filteredProducts.map((product) => {
                  const price = productPrice(product, priceType);
                  const margin = priceMargin(price, product.cost);
                  const stock = Number(product.stock || 0);
                  const threshold = Number(product.low_stock_threshold || 0);
                  const stockState = stock <= 0 ? 'out' : threshold > 0 && stock <= threshold ? 'low' : 'ready';
                  return (
                    <button key={product.id} type="button" className={`sale-product-card stock-${stockState} ${margin.belowCost ? 'below-cost' : ''}`} onClick={() => addProduct(product)}>
                      <span className="sale-product-media" aria-hidden="true">
                        <span className="sale-product-image-placeholder"><Package size={24} /></span>
                        {product.photo_url && <ProductPhoto path={product.photo_url} alt="" className="sale-product-photo" />}
                      </span>
                      <span className="sale-product-copy">
                        <strong>{product.name}</strong>
                        <span className="sale-product-category">{product.category || 'Uncategorized'}</span>
                      </span>
                      <b className="sale-product-price">{money(price)} / {baseUnitName(product)}</b>
                      {margin.belowCost && <small className="sale-cost-warning">Below Cost: Loss {money(Math.abs(margin.amount))}</small>}
                      <small className="sale-product-stock">Stock {stockWithUnit(product)}</small>
                    </button>
                  );
                })}
                {loading && (
                  <div className="sale-product-loading">
                    <LoadingState>Loading products...</LoadingState>
                  </div>
                )}
                {productTotal > filteredProducts.length && (
                  <div ref={productListSentinelRef} className="sale-product-sentinel" aria-hidden="true" />
                )}
                {loadingMoreProducts && (
                  <div className="sale-product-load-more" role="status">Loading more products...</div>
                )}
                {!filteredProducts.length && !loading && <EmptyState>No products found.</EmptyState>}
              </div>
            </div>
          </div>

          <aside className="sale-cart-panel">
            <div className="sale-cart-header">
              <div>
                <strong>Cart</strong>
                <span>{cart.length} items</span>
              </div>
              <button type="button" className="danger-button" onClick={clearCart}>Clear</button>
            </div>

            <div className="sale-cart-items">
              {cart.map((item, index) => (
                <div className="sale-cart-row" key={`${item.product_id}-${item.price_type}`}>
                  <div className="sale-cart-name">
                    <strong>{item.product_name}</strong>
                    <span>{item.price_type} - {money(item.unit_price)} / {item.base_unit || 'Unit'}</span>
                    {Number(item.quantity || 0) + Number(item.foc_quantity || 0) > Number(item.stock || 0) && <small className="danger-text">Below stock</small>}
                    {priceMargin(item.unit_price, item.unit_cost).belowCost && (
                      <small className="sale-cost-warning">Below Cost: Loss {money(Math.abs(priceMargin(item.unit_price, item.unit_cost).amount))} each</small>
                    )}
                  </div>
                  <div className="sale-qty-controls">
                    <button type="button" onClick={() => changeCartQuantity(index, -1)}>-</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) => updateCartQuantity(index, event.target.value)}
                      onBlur={() => normalizeCartQuantity(index)}
                    />
                    <button type="button" onClick={() => changeCartQuantity(index, 1)}>+</button>
                  </div>
                  <label className="sale-foc-control" title="Free of charge quantity">
                    <span>FOC</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.foc_quantity ?? 0}
                      onChange={(event) => updateCartFocQuantity(index, event.target.value)}
                      onBlur={() => normalizeCartFocQuantity(index)}
                    />
                  </label>
                  <strong className="sale-line-total">{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
                  <button type="button" className="icon-btn danger" aria-label={`Remove ${item.product_name} from cart`} title="Remove item" onClick={() => removeCartItem(index)}><Trash2 size={15} /></button>
                  {hasPurchaseUnit(item) && (
                    <button type="button" className="sale-pack-shortcut" onClick={() => addPackQuantity(index)}>
                      +1 {item.purchase_unit} (×{item.purchase_conversion_factor})
                    </button>
                  )}
                </div>
              ))}
              {!cart.length && (
                <div className="sale-empty-cart">
                  <ShoppingCart size={26} />
                  <strong>Cart is empty</strong>
                </div>
              )}
            </div>

            {stockWarnings.length > 0 && <div className="warning-box">{stockWarnings.length} item has quantity above current stock.</div>}

            <div className="sale-cart-total-bar" aria-label="Cart total">
              <span>Subtotal <strong>{money(subtotal)}</strong></span>
              <span>Total <strong>{money(total)}</strong></span>
            </div>

            <div className="sale-checkout-actions">
              <button type="button" disabled={printing || preparingPrint} onClick={receipt ? printReceipt : printLastReceipt}>
                <Printer size={16} /> {receipt ? 'Print Receipt' : 'Print Last Receipt'}
              </button>
              <button type="button" className="primary" disabled={!cart.length} onClick={openCheckout}>
                <ShoppingCart size={17} /> Checkout
              </button>
            </div>
          </aside>
        </div>
      </section>

      <Modal
        open={checkoutOpen}
        title="Checkout"
        onClose={() => setCheckoutOpen(false)}
        busy={saving}
        className="sale-checkout-modal"
        size="medium"
        footer={<><button type="button" disabled={saving} onClick={() => setCheckoutOpen(false)}>Cancel</button><button type="submit" form="sale-checkout-form" className="primary" disabled={saving}><ShoppingCart size={17} /> {actionLabel(saving, 'Saving...', 'Complete Sale')}</button></>}
      >
        <form id="sale-checkout-form" className="sale-checkout-form" onSubmit={(event) => { event.preventDefault(); checkout(); }}>
          <div className="sale-checkout-summary">
            <span>{cart.length} cart {cart.length === 1 ? 'item' : 'items'}</span>
            <strong>{money(total)}</strong>
          </div>

          {focOnly ? (
            <div className="sale-payment-box">
              <strong>FOC sale</strong>
              <span>No payment or customer is required.</span>
            </div>
          ) : <div className="sale-payment-box">
            <div className="field sale-customer-field">
              <div className="sale-customer-field-heading"><span>Customer</span><button type="button" onClick={openCustomerEditor}><Plus size={15} /> New customer</button></div>
              <RemoteCombobox
                value={customerId}
                selectedOption={selectedCustomer}
                loadOptions={loadCustomerOptions}
                placeholder="Walk-in customer or search name/phone"
                onSelect={(customer) => {
                  setSelectedCustomer(customer);
                  setCustomerId(customer ? String(customer.id) : '');
                }}
                getLabel={(customer) => `${customer.name}${customer.phone ? ` (${customer.phone})` : ''}`}
              />
            </div>
            <Field label="Payment Method">
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {paymentMethods.filter((method) => method !== 'Credit').map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </Field>
            <Field label="Discount">
              <input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </Field>
            <div className="field sale-paid-amount-field">
              <div className="sale-paid-amount-heading">
                <label htmlFor="sale-paid-amount">Paid Amount</label>
                <button type="button" className="sale-pay-full-button" onClick={() => setPaidAmount(String(total))}>Pay Full</button>
              </div>
              <input id="sale-paid-amount" type="number" min="0" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} placeholder="0" />
            </div>
            <span className={unpaidAmount > 0 ? 'danger-text sale-unpaid-line' : 'sale-unpaid-line'}>
              Unpaid <strong>{money(unpaidAmount)}</strong>
            </span>
            {changeAmount > 0 && (
              <span className="gain-text sale-unpaid-line">
                Change <strong>{money(changeAmount)}</strong>
              </span>
            )}
          </div>}

          <div className="sale-checkout-totals" aria-label="Sale totals">
            <span>Subtotal <strong>{money(subtotal)}</strong></span>
            <span>Total <strong>{money(total)}</strong></span>
          </div>

        </form>
      </Modal>
      <Modal open={customerEditorOpen} title="New customer" subtitle="Create and use this customer for the current sale." onClose={closeCustomerEditor} busy={savingCustomer} size="small" footer={<><button type="button" disabled={savingCustomer} onClick={closeCustomerEditor}>Back to checkout</button><button type="submit" form="checkout-customer-form" className="primary" disabled={savingCustomer}>{actionLabel(savingCustomer, 'Saving...', 'Create and use')}</button></>}>
        <form id="checkout-customer-form" className="supplier-modal-form" onSubmit={createCustomer} noValidate>
          {customerFormError && <p className="error-text" role="alert">{customerFormError}</p>}
          <div className="supplier-modal-grid">
            <Field label="Customer name"><input autoFocus required value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="Phone"><input type="tel" value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} /></Field>
            <Field label="Address"><input value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} /></Field>
            <Field label="Note"><textarea value={customerForm.note} onChange={(event) => setCustomerForm((current) => ({ ...current, note: event.target.value }))} /></Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
