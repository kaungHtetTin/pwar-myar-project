import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { Button, Checkbox, FieldShell, IconButton, Input, SearchInput, Select, Textarea } from '../components/Controls';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModuleLocalizationBoundary } from "../localization/ModuleLocalizationBoundary";
import { SALES_MESSAGES, SALES_PATTERNS } from './salesLocale';
import { ArrowLeft, Check, ChevronDown, ChevronRight, CircleDollarSign, CreditCard, Edit3, EllipsisVertical, Eye, HandCoins, Package, Printer, ReceiptText, RefreshCw, ShoppingCart, Trash2, WalletCards } from 'lucide-react';
import { apiRequest } from "../api/client";
import {
  EndlessListFooter,
  MobileDeleteSheet,
  MobileFilterPanel,
  MobileFilterToggle,
  MobileNotice,
  MobileSheet,
} from "../components/MobilePrimitives";
import { expensePresetRange } from "../expenses/expenseUtils";
import { useEndlessList } from "../hooks/useEndlessList";
import { usePageRefresh } from "../navigation/pageRefresh";
import {
  cleanPriceTypes,
  money,
  productPrice,
} from "../products/productUtils";
import {
  cleanPaymentMethods,
  salePayload,
  saleTotals,
  saleProductPrices,
} from "../sell/saleUtils";
import { CustomerPicker } from "../sell/SaleScreen";
import { printHtmlDocument, receiptOptions } from "../utils/printing";
import {
  blankTransactionFilters,
  transactionPageFromPath,
  transactionPath,
  transactionSummary,
} from "./transactionUtils";
import { SalesReferenceFilters } from './SalesReferenceFilters';
import { SalesPrintFailure } from './SalesPrintFailure';
import { SalesReferenceHeader, SalesReferenceEditor, SalesReferenceDetail, SalesReferenceHistoryRow } from './SalesReferenceParts';
import { CsvExportButton } from "../components/CsvExportButton";
import { csvFilename, exportFilteredCsv } from "../utils/csvExport";
import { loadSaleLineItems, SALE_LINE_COLUMNS } from "./saleCsv";

import {PaymentTransactions} from './PaymentTransactions';
import {PAYMENT_MESSAGES,PAYMENT_PATTERNS} from './paymentLocale';
const PAGE_SIZE = 20;
const TABS = [
  { id: "payments", label: "Customer", icon: HandCoins },
  { id: "supplierPayments", label: "Suppliers", icon: HandCoins },
];
const SALE_UPDATE_DEBUG = "[PwarMyar sale update]";

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

function logSaleUpdate(stage, details = {}) {
  console.log(`${SALE_UPDATE_DEBUG} ${stage}`, details);
}

function saleUpdateErrorDetails(error) {
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    payload: error?.payload,
    stack: error?.stack,
  };
}

function fieldErrorsFrom(error) {
  return Object.fromEntries(
    Object.entries(error?.payload?.errors || {}).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  );
}

function TransactionActionCard({ row, onOpen, onActions }) {
  return (
    <article className="transaction-card transaction-menu-card">
      <div className="transaction-menu-row">
        <Button variant="plain"
          className="transaction-menu-main"
          type="button"
          onClick={onOpen}
        >
          <span>
            <small>{String(row.created_at || "").slice(0, 16)}</small>
            <strong>{row.supplier_name || "Unknown supplier"}</strong>
            <em>{`${row.direction === "supplier_to_shop" ? "Supplier refunds shop" : "Shop pays supplier"} · ${row.payment_method || "Cash"}`}</em>
          </span>
          <b>{money(row.amount)}</b>
        </Button>
        <IconButton variant="ghost"
          className="transaction-menu-button"
          type="button"
          aria-label={`Actions for supplier payment ${row.id}`}
          onClick={onActions}
        >
          <EllipsisVertical size={20} />
        </IconButton>
      </div>
    </article>
  );
}

function transactionFormErrors(error) {
  const fields = fieldErrorsFrom(error);
  const itemError = Object.entries(fields).find(
    ([field]) => field === "items" || field.startsWith("items."),
  )?.[1];
  return {
    ...fields,
    ...(itemError ? { items: itemError } : {}),
    general: error?.message || "Unable to update this transaction.",
  };
}

function saleEditForm(sale) {
  return {
    ...sale,
    discount: Number(sale?.discount || 0),
    paid_amount: Number(sale?.paid_amount || 0),
    customer_id: sale?.customer_id || "",
    payment_method: sale?.payment_method || "Cash",
    admin_pin: "",
    items: (sale?.items || []).map((item) => ({
      ...item,
      product_id: Number(item.product_id),
      price_type: item.price_type || "Retail",
      quantity: Number(item.quantity),
      foc_quantity: Number(item.foc_quantity || 0),
      unit_price: Number(item.unit_price || 0),
    })),
  };
}

export function TransactionsScreen(props) {
  return (
    <ModuleLocalizationBoundary
      messages={{...SALES_MESSAGES,...PAYMENT_MESSAGES}}
      patterns={[...PAYMENT_PATTERNS,...SALES_PATTERNS]}
    >
      {props.view==='sales'?<TransactionsScreenContent {...props}/>:<PaymentTransactions {...props}/>}
    </ModuleLocalizationBoundary>
  );
}

function TransactionSkeletons() {
  return (
    <div
      className="transaction-card-list"
      role="status"
      aria-label="Loading transactions"
    >
      {[1, 2, 3].map((key) => (
        <div className="transaction-card transaction-skeleton" key={key}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function ProductPicker({ priceTypes, onSelect, onClose, currency = 'Ks' }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState([]);
  const defaultPriceType = priceTypes[0] || "Retail";
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/categories", { signal: controller.signal })
      .then((response) => setCategories(Array.isArray(response) ? response : []))
      .catch((error) => {
        if (error?.name !== "AbortError") setCategories([]);
      });
    return () => controller.abort();
  }, []);
  const loadPage = useCallback(
    ({ limit, offset, signal }) => {
      const params = new URLSearchParams({
        with_total: "true",
        limit: String(limit),
        offset: String(offset),
      });
      if (debounced) params.set("q", debounced);
      if (category) params.set("category", category);
      return apiRequest(`/products?${params}`, { signal });
    },
    [category, debounced],
  );
  const list = useEndlessList({
    loadPage,
    queryKey: JSON.stringify([debounced, category]),
    pageSize: PAGE_SIZE,
  });
  return (
    <MobileFilterPanel open as="div" id="sale-product-picker" title="Add product" description="Choose products to add to this sale." icon={Package} onClose={onClose} className="promotion-product-picker" footer={<div className="promotion-picker-footer"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button variant="primary" type="button" disabled={!selected.length} onClick={() => onSelect(selected, defaultPriceType)}>{`Add ${selected.length} ${selected.length === 1 ? 'product' : 'products'}`}</Button></div>}>
      <div className="promotion-picker-controls">
        <SearchInput className="mobile-search" aria-label="Search products" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products by name or SKU" type="search" />
        <FieldShell as="label" className="mobile-field"><span>Product category</span><Select aria-label="Product category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(name => <option key={name}>{name}</option>)}</Select></FieldShell>
        <div className="promotion-picker-count"><span>{selected.length} selected</span><Button variant="plain" type="button" onClick={() => setSelected([])} disabled={!selected.length}>Clear all</Button></div>
      </div>
      <div className="promotion-picker-products">
      {list.initialLoading ? (
        <p className="mobile-inline-loading">
          <RefreshCw className="spin" size={17} />
          Loading products…
        </p>
      ) : list.error && !list.items.length ? (
        <div className="endless-first-error">
          <p>{list.error}</p>
          <Button variant="plain" type="button" onClick={list.retry}>
            Try again
          </Button>
        </div>
      ) : list.items.length ? (
        <>
          <div>{list.items.map(product => {
            const checked = selected.some(row => row.id === product.id);
            return <label className={`promotion-picker-product${checked ? ' is-selected' : ''}`} key={product.id}>
              <Checkbox aria-label={`Select ${product.name}`} checked={checked} onChange={() => setSelected(rows => checked ? rows.filter(row => row.id !== product.id) : [...rows, product])} />
              <span className="promotion-product-photo" aria-hidden="true">{product.photo_url ? <ProductPhoto path={product.photo_url} /> : <Package size={23} />}</span>
              <span><strong data-no-localize>{product.name}</strong><small data-no-localize>{product.sku || product.category || 'No code'}</small><small data-no-localize>{product.base_unit || 'Unit'}</small></span>
              <span><strong>{money(productPrice(product, defaultPriceType), currency)}</strong></span>
            </label>;
          })}</div>
          <EndlessListFooter
            list={list}
            count={list.items.length}
            noun="products"
          />
        </>
      ) : (
        <p className="mobile-inline-empty">No products found.</p>
      )}
      </div>
    </MobileFilterPanel>
  );
}

function SaleEditPage({ id, settings, onNavigate, onSaved, currency = 'Ks' }) {
  const [form, setForm] = useState(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const priceRequest = useRef(null);
  const [notice, setNotice] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const priceTypes = useMemo(
    () => cleanPriceTypes(settings.price_types),
    [settings.price_types],
  );
  const methods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const adminPinRequired = String(settings.admin_pin_set) === "1";

  useEffect(() => {
    const controller = new AbortController();
    logSaleUpdate("edit page opened", { saleId: id, path: `/sales/${id}` });
    apiRequest(`/sales/${id}`, { signal: controller.signal })
      .then((sale) => {
        logSaleUpdate("sale loaded", {
          saleId: sale?.id,
          receiptNo: sale?.receipt_no,
          status: sale?.status,
          itemCount: sale?.items?.length || 0,
          customerId: sale?.customer_id || null,
          total: sale?.total,
          paidAmount: sale?.paid_amount,
        });
        setForm(saleEditForm(sale));
        setSelectedCustomer(sale.customer_id ? { id: sale.customer_id, name: sale.customer_name || `Customer #${sale.customer_id}`, phone: sale.customer_phone || "" } : null);
        setWizardStep(1);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          logSaleUpdate("sale load failed", saleUpdateErrorDetails(error));
          setNotice({ type: "error", text: error.message });
        }
      });
    return () => { controller.abort(); priceRequest.current?.abort(); };
  }, [id]);
  const totals = saleTotals(
    form?.items || [],
    form?.discount || 0,
    form?.paid_amount || 0,
  );
  function patchItem(index, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function changeItemPriceType(index, type) {
    if (priceRequest.current || saving) return;
    const item = form.items[index], controller = new AbortController();
    priceRequest.current = controller;
    setPriceBusy(true);
    setErrors(current => ({ ...current, items: '' }));
    try {
      const product = await apiRequest(`/products/${item.product_id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const price = saleProductPrices(product).find(row => String(row.name).toLowerCase() === type.toLowerCase());
      if (!price || !Number.isFinite(price.price) || price.price < 0) throw new Error(`${type} price is not set for ${item.product_name}.`);
      patchItem(index, { price_type: type, unit_price: price.price });
    } catch (error) {
      if (!controller.signal.aborted) setErrors(current => ({ ...current, items: error.message }));
    } finally {
      if (priceRequest.current === controller) { priceRequest.current = null; setPriceBusy(false); }
    }
  }

  function updateQuantity(index, field, value) {
    if (value !== "" && !/^\d*\.?\d{0,3}$/.test(value)) return;
    patchItem(index, { [field]: value });
  }

  function normalizeQuantity(index, field, fallback = 0) {
    const value = Number(form.items[index]?.[field]);
    patchItem(index, { [field]: Number.isFinite(value) && value >= 0 ? value : fallback });
  }

  function continueToCheckout() {
    setErrors({});
    if (!form.items.length) {
      setErrors({ items: "Sale must contain at least one product." });
      return;
    }
    if (form.items.some((item) => Number(item.quantity) < 0 || Number(item.foc_quantity) < 0 || Number(item.quantity) + Number(item.foc_quantity) <= 0 || Number(item.unit_price) < 0)) {
      setErrors({ items: "Check item quantities and prices." });
      return;
    }
    setWizardStep(2);
    document.documentElement.scrollTop = 0;
  }

  async function saveSale() {
    if (wizardStep !== 2 || saving) {
      return;
    }
    setErrors({});
    setNotice(null);
    logSaleUpdate("submit clicked", {
      saleId: id,
      receiptNo: form?.receipt_no,
      itemCount: form?.items?.length || 0,
      discount: form?.discount,
      paidAmount: form?.paid_amount,
      paymentMethod: form?.payment_method,
      customerId: form?.customer_id || null,
      totals,
      adminPinRequired,
      hasAdminPin: Boolean(String(form?.admin_pin || "").trim()),
    });
    if (!form.items.length) {
      logSaleUpdate("validation blocked", {
        field: "items",
        reason: "Sale has no products.",
      });
      return setErrors({ items: "Sale must contain at least one product." });
    }
    if (
      form.items.some(
        (item) =>
          Number(item.quantity) < 0 ||
          Number(item.foc_quantity) < 0 ||
          Number(item.quantity) + Number(item.foc_quantity) <= 0 ||
          Number(item.unit_price) < 0,
      )
    ) {
      logSaleUpdate("validation blocked", {
        field: "items",
        reason: "An item has an invalid quantity, FOC, or unit price.",
        items: form.items,
      });
      return setErrors({ items: "Check item quantities and prices." });
    }
    if (totals.unpaid > 0 && !form.customer_id) {
      logSaleUpdate("validation blocked", {
        field: "customer_id",
        reason: "Unpaid credit requires a customer.",
        unpaid: totals.unpaid,
      });
      return setErrors({
        customer_id: "A customer is required for unpaid credit.",
      });
    }
    if (adminPinRequired && !String(form.admin_pin || "").trim()) {
      logSaleUpdate("validation blocked", {
        field: "admin_pin",
        reason: "Admin PIN is required but empty.",
      });
      return setErrors({
        admin_pin: "Enter the admin PIN to update this sale.",
      });
    }
    const payload = salePayload({
      cart: form.items,
      discount: form.discount,
      paidAmount: form.paid_amount,
      paymentMethod: form.payment_method || methods[0] || "Cash",
      customerId: form.customer_id,
    });
    const requestPayload = {
      ...payload,
      ...(adminPinRequired
        ? { admin_pin: String(form.admin_pin || "").trim() }
        : {}),
    };
    logSaleUpdate("PUT request", {
      path: `/sales/${id}`,
      method: "PUT",
      payload: {
        ...requestPayload,
        ...(adminPinRequired ? { admin_pin: "[REDACTED]" } : {}),
      },
    });
    try {
      setSaving(true);
      const updatedSale = await apiRequest(`/sales/${id}`, {
        method: "PUT",
        body: JSON.stringify(requestPayload),
      });
      setForm(current => ({ ...current, admin_pin: "" }));
      logSaleUpdate("update succeeded", updatedSale);
      onSaved(updatedSale);
      onNavigate("/sales", { replace: true });
    } catch (error) {
      logSaleUpdate("update failed", saleUpdateErrorDetails(error));
      setErrors(transactionFormErrors(error));
    } finally {
      setSaving(false);
    }
  }

  if (!form)
    return (
      <main className="sale-retail-page sales-reference-page"><SalesReferenceHeader title="Sale" onBack={() => onNavigate("/sales", { back: true })} />
        <MobileNotice
          notice={notice || { type: "info", text: "Loading sale…" }}
          onClose={() => setNotice(null)}
        />
      </main>
    );
  return (
    <main className={`sale-retail-page sales-reference-page sales-reference-edit sales-edit-step-${wizardStep}${wizardStep === 1 ? ' sale-retail-cart' : ''}`}>
      <SalesReferenceEditor form={form} totals={totals} currency={currency} step={wizardStep} setStep={setWizardStep} priceTypes={priceTypes} methods={methods} saving={saving} priceBusy={priceBusy} onPriceTypeChange={changeItemPriceType} errors={errors} adminPinRequired={adminPinRequired} selectedCustomer={selectedCustomer} setForm={setForm} patchItem={patchItem} updateQuantity={updateQuantity} normalizeQuantity={normalizeQuantity} onBack={() => onNavigate('/sales', { back: true })} onContinue={continueToCheckout} onSave={saveSale} onAddProduct={() => setPickerOpen(true)} onCustomer={() => setCustomerPickerOpen(true)} />
      <MobileNotice notice={notice} onClose={() => setNotice(null)} />
      {pickerOpen && <ProductPicker currency={currency} priceTypes={priceTypes} onClose={() => setPickerOpen(false)} onSelect={(products, type) => {
        setForm(current => ({ ...current, items: [...current.items, ...products.map(product => ({
          product_id: product.id, product_name: product.name, photo_url: product.photo_url, sku: product.sku,
          unit_name: product.base_unit || 'Unit', price_type: type, quantity: 1, foc_quantity: 0, unit_price: productPrice(product, type),
        }))] }));
        setPickerOpen(false);
      }} />}
      <MobileSheet open={customerPickerOpen} title="Choose customer" description="Required only when an unpaid balance remains." onClose={() => setCustomerPickerOpen(false)}><CustomerPicker selected={selectedCustomer} onSelect={(customer) => { setSelectedCustomer(customer); setForm((current) => ({ ...current, customer_id: customer?.id || "", customer_name: customer?.name || "" })); setErrors((current) => ({ ...current, customer_id: "" })); setCustomerPickerOpen(false); }} /></MobileSheet>
    </main>
  );
}

function PaymentEditPage({
  id,
  settings,
  onNavigate,
  onSaved,
  supplier = false,
}) {
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const methods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(
      `/${supplier ? "supplier-payments" : "customer-payments"}/${id}`,
      { signal: controller.signal },
    )
      .then(setForm)
      .catch(
        (error) =>
          !controller.signal.aborted &&
          setNotice({ type: "error", text: error.message }),
      );
    return () => controller.abort();
  }, [id, supplier]);
  async function submit(event) {
    event.preventDefault();
    setErrors({});
    const amount = Number(form.amount);
    const accountId = supplier ? form.supplier_id : form.customer_id;
    if (!accountId || !Number.isFinite(amount) || amount <= 0)
      return setErrors({
        amount: `Choose a ${supplier ? "supplier" : "customer"} and enter an amount greater than zero.`,
      });
    try {
      setSaving(true);
      await apiRequest(
        `/${supplier ? "supplier-payments" : "customer-payments"}/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            [supplier ? "supplier_id" : "customer_id"]: Number(accountId),
            direction: form.direction,
            payment_method: form.payment_method,
            amount: Math.round(amount),
            note: String(form.note || "").trim(),
          }),
        },
      );
      await onSaved();
      onNavigate("/transactions", { replace: true });
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      setErrors(
        Object.keys(fields).length ? fields : { general: error.message },
      );
    } finally {
      setSaving(false);
    }
  }
  if (!form)
    return (
      <main className="transaction-page">
        <MobileNotice
          notice={notice || { type: "info", text: "Loading payment…" }}
          onClose={() => setNotice(null)}
        />
      </main>
    );
  return (
    <main className="transaction-page transaction-form-page">
      <section className="mobile-form-title">
        <IconButton variant="ghost"
          type="button"
          className="icon-button"
          aria-label="Back to transactions"
          onClick={() => onNavigate("/transactions")}
        >
          <ArrowLeft size={21} />
        </IconButton>
        <div>
          <span className="page-kicker">
            {supplier ? "Supplier account" : "Customer account"}
          </span>
          <h1>Edit payment</h1>
          <p>
            The {supplier ? "supplier" : "customer"} balance will be
            recalculated.
          </p>
        </div>
      </section>
      <form className="transaction-edit-form" onSubmit={submit} noValidate>
        <section className="mobile-form-section">
          <div className="mobile-section-heading">
            <span>01</span>
            <div>
              <h3>Payment details</h3>
              <p>Direction, method and amount</p>
            </div>
          </div>
          <FieldShell as="label" className="mobile-field">
            <span>{supplier ? "Supplier" : "Customer"} ID</span>
            <Input
              type="number"
              required
              value={(supplier ? form.supplier_id : form.customer_id) || ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  [supplier ? "supplier_id" : "customer_id"]:
                    event.target.value,
                })
              }
            />
          </FieldShell>
          <FieldShell as="label" className="mobile-field">
            <span>Direction</span>
            <Select
              value={form.direction}
              onChange={(event) =>
                setForm({ ...form, direction: event.target.value })
              }
            >
              {supplier ? (
                <>
                  <option value="shop_to_supplier">Shop pays supplier</option>
                  <option value="supplier_to_shop">
                    Supplier refunds shop
                  </option>
                </>
              ) : (
                <>
                  <option value="customer_to_shop">Customer pays shop</option>
                  <option value="shop_to_customer">Shop pays customer</option>
                </>
              )}
            </Select>
          </FieldShell>
          <div className="mobile-two-fields">
            <FieldShell as="label" className="mobile-field">
              <span>Method</span>
              <Select
                value={form.payment_method || methods[0]}
                onChange={(event) =>
                  setForm({ ...form, payment_method: event.target.value })
                }
              >
                {methods
                  .filter((method) => method.toLowerCase() !== "credit")
                  .map((method) => (
                    <option key={method}>{method}</option>
                  ))}
              </Select>
            </FieldShell>
            <FieldShell as="label" className="mobile-field">
              <span>Amount</span>
              <Input
                type="number"
                min="1"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
              {errors.amount && (
                <small className="mobile-field-error" role="alert">
                  {errors.amount}
                </small>
              )}
            </FieldShell>
          </div>
          <FieldShell as="label" className="mobile-field">
            <span>Note</span>
            <Textarea
              rows="4"
              value={form.note || ""}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
            />
          </FieldShell>
          {errors.general && (
            <div className="mobile-notice mobile-notice--error" role="alert">
              {errors.general}
            </div>
          )}
        </section>
        <div className="mobile-form-actions">
          <Button variant="secondary"
            className="mobile-secondary"
            type="button"
            onClick={() => onNavigate("/transactions")}
          >
            Cancel
          </Button>
          <Button variant="primary" className="mobile-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save payment"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function SaleDetailPage({ id, settings, onNavigate, currency = 'Ks' }) {
  const [sale, setSale] = useState(null);
  const [printError, setPrintError] = useState("");
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const loadSale = useCallback(
    async (signal) => {
      setError("");
      try {
        const response = await apiRequest(
          `/sales/${id}`,
          signal ? { signal } : undefined,
        );
        setSale(response);
        return response;
      } catch (loadError) {
        if (!signal?.aborted)
          setError(loadError.message || "Cannot load sale.");
        return null;
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    loadSale(controller.signal);
    return () => controller.abort();
  }, [loadSale]);
  usePageRefresh(() => loadSale());

  async function printReceipt() {
    if (printing) return;
    try {
      setPrinting(true);
      const receipt = await apiRequest(`/sales/${id}/receipt`);
      if (
        !(await printHtmlDocument({
          title: receipt.sale?.receipt_no || "Receipt",
          html: receipt.html,
          text: receipt.text,
          ...receiptOptions(receipt, settings),
        }))
      )
        setPrintError("Allow pop-ups to print the receipt.");
      else setPrintError("");
    } catch (printError) {
      setPrintError(printError.message);
    } finally {
      setPrinting(false);
    }
  }

  if (error && !sale)
    return (
      <main className="sale-retail-page sales-reference-page"><SalesReferenceHeader title="Sale" onBack={() => onNavigate("/sales", { back: true })} />
        <div className="endless-first-error">
          <p>{error}</p>
          <Button variant="plain" type="button" onClick={() => loadSale()}>
            Try again
          </Button>
        </div>
      </main>
    );
  if (!sale)
    return (
      <main className="sale-retail-page sales-reference-page"><SalesReferenceHeader title="Sale" onBack={() => onNavigate("/sales", { back: true })} />
        <p className="mobile-inline-loading" role="status">
          <RefreshCw className="spin" size={18} />
          Loading sale…
        </p>
      </main>
    );
  return <main className="sale-retail-page sales-reference-page sales-reference-detail"><SalesReferenceDetail sale={sale} currency={currency} printing={printing} onBack={() => onNavigate('/sales', { back: true })} onPrint={printReceipt} onEdit={() => onNavigate(`/sales/${sale.id}/edit`)} /><MobileNotice notice={error ? { type: 'error', text: error } : null} onClose={() => setError('')} /><SalesPrintFailure open={Boolean(printError)} error={printError} sale={sale} settings={settings} currency={currency} printing={printing} onClose={() => setPrintError("")} onRetry={printReceipt} /></main>;
}

function TransactionsScreenContent({
  pathname = "/transactions",
  onNavigate = () => {},
  view = "payments",
  session,
}) {
  const currency = session?.business?.currency || "Ks";
  const page = transactionPageFromPath(pathname);
  const salesOnly = view === "sales";
  const [activeTab, setActiveTab] = useState(salesOnly ? "sales" : "payments");
  const [draftFilters, setDraftFilters] = useState(() =>
    blankTransactionFilters(),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    blankTransactionFilters(),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [salesFilterError, setSalesFilterError] = useState('');
  const [settings, setSettings] = useState({});
  const [settingsReady, setSettingsReady] = useState(false);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [actionSale, setActionSale] = useState(null);
  const [actionRecord, setActionRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [adminPin, setAdminPin] = useState("");
  const [deletePinRequired, setDeletePinRequired] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setAppliedFilters((current) =>
          current.q === draftFilters.q.trim()
            ? current
            : { ...current, q: draftFilters.q.trim() },
        ),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [draftFilters.q]);
  const loadPage = useCallback(
    ({ limit, offset, signal }) =>
      apiRequest(transactionPath(activeTab, appliedFilters, limit, offset), {
        signal,
      }),
    [activeTab, appliedFilters],
  );
  const list = useEndlessList({
    loadPage,
    queryKey: `${activeTab}|${JSON.stringify(appliedFilters)}`,
    pageSize: PAGE_SIZE,
    enabled: page.kind === "list",
  });
  const loadSettings = useCallback(async (signal) => {
    const response = await apiRequest(
      "/settings",
      signal ? { signal } : undefined,
    );
    setSettings(response);
    setSettingsReady(true);
    return response;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadSettings(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        setSettings({ admin_pin_set: "1" });
        setSettingsReady(true);
        setNotice({ type: "error", text: error.message });
      }
    });
    return () => controller.abort();
  }, [loadSettings]);
  const refreshAll = useCallback(
    () => Promise.all([list.reload(), loadSettings()]),
    [list, loadSettings],
  );
  usePageRefresh(refreshAll);
  const methods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const summary = useMemo(
    () => transactionSummary(activeTab, list.items),
    [activeTab, list.items],
  );
  const visibleFilters = salesOnly ? appliedFilters : draftFilters;
  const activeFilterCount = [
    visibleFilters.preset !== "all" ? visibleFilters.preset : "",
    activeTab === "sales" && visibleFilters.payment_type !== "all"
      ? visibleFilters.payment_type
      : "",
    activeTab === "sales" && visibleFilters.sale_channel !== "all" ? visibleFilters.sale_channel : "",
    visibleFilters.payment_method,
  ].filter(Boolean).length;

  function exportTransactions() {
    const raw = transactionPath(activeTab, appliedFilters, PAGE_SIZE, 0);
    const url = new URL(raw, window.location.origin);
    url.searchParams.delete("limit");
    url.searchParams.delete("offset");
    url.searchParams.delete("with_total");
    const config = {
      sales: {
        name: "sales",
        columns: SALE_LINE_COLUMNS,
        loadRows: (path) => loadSaleLineItems(path),
      },
      payments: {
        name: "customer-payments",
        columns: [
          { label: "Date", value: (row) => row.created_at },
          { label: "Customer", value: (row) => row.customer_name || "" },
          { label: "Direction", value: (row) => row.direction },
          { label: "Method", value: (row) => row.payment_method || "" },
          { label: "Amount", value: (row) => row.amount },
          { label: "Note", value: (row) => row.note || "" },
          { label: "Status", value: (row) => row.status || "" },
        ],
      },
      supplierPayments: {
        name: "supplier-payments",
        columns: [
          { label: "Date", value: (row) => row.created_at },
          { label: "Supplier", value: (row) => row.supplier_name || "" },
          { label: "Direction", value: (row) => row.direction },
          { label: "Method", value: (row) => row.payment_method || "" },
          { label: "Amount", value: (row) => row.amount },
          { label: "Note", value: (row) => row.note || "" },
          { label: "Status", value: (row) => row.status || "" },
        ],
      },
    }[activeTab];
    const path = `${url.pathname}${url.search}`;
    return exportFilteredCsv({
      ...(config.loadRows
        ? { loadRows: () => config.loadRows(path) }
        : { path }),
      filename: csvFilename(config.name),
      columns: config.columns,
    });
  }

  if (page.kind === "edit" && page.tab === "sales" && !settingsReady)
    return (
      <main className="sale-retail-page sales-reference-page"><SalesReferenceHeader title="Sale" onBack={() => onNavigate("/sales", { back: true })} />
        <p className="mobile-inline-loading" role="status">
          <RefreshCw className="spin" size={18} />
          Checking Admin PIN protection…
        </p>
      </main>
    );
  if (page.kind === "edit" && page.tab === "sales")
    return (
      <SaleEditPage
        currency={currency}
        id={page.id}
        settings={settings}
        onNavigate={onNavigate}
        onSaved={(sale) =>
          setNotice({
            type: "success",
            text: `Sale ${sale?.receipt_no || ""} updated.`,
          })
        }
      />
    );
  if (page.kind === "edit" && page.tab === "payments")
    return (
      <PaymentEditPage
        id={page.id}
        settings={settings}
        onNavigate={onNavigate}
        onSaved={list.reload}
      />
    );
  if (page.kind === "edit" && page.tab === "supplier-payments")
    return (
      <PaymentEditPage
        id={page.id}
        settings={settings}
        onNavigate={onNavigate}
        onSaved={list.reload}
        supplier
      />
    );
  if (page.kind === "detail" && page.tab === "sales")
    return (
      <SaleDetailPage
        currency={currency}
        id={page.id}
        settings={settings}
        onNavigate={onNavigate}
      />
    );

  function applyPreset(preset) {
    const range = expensePresetRange(preset);
    const next = {
      ...draftFilters,
      preset,
      start: range.date_from,
      end: range.date_to,
    };
    setDraftFilters(next);
    setAppliedFilters(next);
  }
  function applyFilters(event) {
    event.preventDefault();
    if (salesOnly && draftFilters.start && draftFilters.end && draftFilters.start > draftFilters.end) {
      setSalesFilterError('From date cannot be later than To date.');
      return;
    }
    setSalesFilterError('');
    setAppliedFilters({ ...draftFilters, q: draftFilters.q.trim() });
    setFiltersOpen(false);
  }
  function clearFilters() {
    const next = blankTransactionFilters();
    if (salesOnly) {
      const reset = { ...next, q: draftFilters.q };
      setDraftFilters(reset);
      setAppliedFilters(reset);
      setSalesFilterError('');
      setFiltersOpen(false);
      return;
    }
    setDraftFilters(next);
    setAppliedFilters(next);
    setFiltersOpen(false);
  }
  function openDetail(row) {
    setDetail({ type: activeTab, data: row });
  }
  async function printSale(row) {
    try {
      const receipt = await apiRequest(`/sales/${row.id}/receipt`);
      if (
        !(await printHtmlDocument({
          title: receipt.sale?.receipt_no || "Receipt",
          html: receipt.html,
          text: receipt.text,
          ...receiptOptions(receipt, settings),
        }))
      )
        setNotice({
          type: "error",
          text: "Allow pop-ups to print the receipt.",
        });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  }
  async function openDeleteTarget(row) {
    const paymentTab =
      activeTab === "payments" || activeTab === "supplierPayments";
    if (paymentTab) {
      setDeletePinRequired(false);
      setDeleteTarget(row);
      setAdminPin("");
      return;
    }
    try {
      const currentSettings =
        settingsReady &&
        Object.prototype.hasOwnProperty.call(settings, "admin_pin_set")
          ? settings
          : await loadSettings();
      setDeletePinRequired(String(currentSettings?.admin_pin_set) === "1");
      setDeleteTarget(row);
      setAdminPin("");
    } catch (error) {
      setNotice({
        type: "error",
        text: `Cannot check Admin PIN protection. ${error.message}`,
      });
    }
  }
  async function deleteTransaction(event) {
    event.preventDefault();
    if (!deleteTarget) return;
    if (deletePinRequired && !adminPin.trim()) {
      setNotice({ type: "error", text: "Admin PIN is required." });
      return;
    }
    try {
      setDeleting(true);
      const path =
        activeTab === "payments"
          ? `/customer-payments/${deleteTarget.id}`
          : activeTab === "supplierPayments"
            ? `/supplier-payments/${deleteTarget.id}`
            : `/${activeTab}/${deleteTarget.id}`;
      const options = { method: "DELETE" };
      if (deletePinRequired)
        options.body = JSON.stringify({ admin_pin: adminPin });
      await apiRequest(path, options);
      setNotice({
        type: "success",
        text: "Transaction deleted and balances recalculated.",
      });
      setDeleteTarget(null);
      setAdminPin("");
      await list.reload();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setDeleting(false);
    }
  }
  function editRow(row) {
    const destination =
      activeTab === "supplierPayments"
        ? `/transactions/supplier-payments/${row.id}/edit`
        : activeTab === "sales"
          ? `/sales/${row.id}/edit`
          : `/transactions/${activeTab}/${row.id}/edit`;
    if (activeTab === "sales")
      logSaleUpdate("edit clicked", {
        saleId: row.id,
        receiptNo: row.receipt_no,
        destination,
      });
    onNavigate(destination);
  }

  if (activeTab === "supplierPayments") {
    return (
      <>
        <main className="transaction-page">
          <section className="products-title-row">
            <div>
              <span className="page-kicker">History</span>
              <h1>Transactions</h1>
              <p>Review supplier payments and refunds.</p>
            </div>
          </section>
          <MobileNotice notice={notice} onClose={() => setNotice(null)} />
          <nav className="transaction-tabs" aria-label="Transaction types">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Button variant="plain"
                type="button"
                className={activeTab === id ? "is-active" : ""}
                key={id}
                onClick={() => {
                  const next = blankTransactionFilters();
                  setActiveTab(id);
                  setDraftFilters(next);
                  setAppliedFilters(next);
                  setFiltersOpen(false);
                  setDetail(null);
                }}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Button>
            ))}
          </nav>
          
          <section className="mobile-product-controls transaction-controls transaction-list-controls">
            <SearchInput className="mobile-search product-search" aria-label="Search supplier payments" value={draftFilters.q} onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    q: event.target.value,
                  }))
                } placeholder="Supplier, method or note" type="text" onClear={() => setDraftFilters((current) => ({ ...current, q: "" }))} clearLabel="Clear search" />
            <div className="mobile-control-row transaction-shared-control-row">
              <MobileFilterToggle open={filtersOpen} onToggle={() => setFiltersOpen((open) => !open)} controls="supplier-payment-filters" count={activeFilterCount} className="product-toolbar-toggle" />
              
            </div>
            <MobileFilterPanel onClose={() => setFiltersOpen(false)} open={filtersOpen} id="supplier-payment-filters" className="product-filter-panel transaction-shared-filter-panel" onSubmit={applyFilters}>
              <section
                className="transaction-presets"
                aria-label="Transaction date range"
              >
                {["today", "week", "month", "year", "all"].map((preset) => (
                  <Button variant="choice"
                    type="button"
                    className={appliedFilters.preset === preset ? "is-active" : ""}
                    key={preset}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset === "all"
                      ? "All"
                      : preset[0].toUpperCase() + preset.slice(1)}
                  </Button>
                ))}
              </section>
              <label className="product-filter-field product-filter-date" htmlFor="supplier-transaction-from" onClick={openNativeDatePicker}><span><small>From</small><Input id="supplier-transaction-from" type="date" value={draftFilters.start} onChange={(event) => setDraftFilters((current) => ({ ...current, preset: "custom", start: event.target.value }))} /></span></label>
              <label className="product-filter-field product-filter-date" htmlFor="supplier-transaction-to" onClick={openNativeDatePicker}><span><small>To</small><Input id="supplier-transaction-to" type="date" value={draftFilters.end} onChange={(event) => setDraftFilters((current) => ({ ...current, preset: "custom", end: event.target.value }))} /></span></label>
              <label className="product-filter-field product-filter-select" htmlFor="supplier-transaction-direction"><HandCoins size={21} /><span><small>Direction</small><strong>{draftFilters.direction === "all" ? "All directions" : draftFilters.direction === "shop_to_supplier" ? "Shop pays supplier" : "Supplier refunds shop"}</strong></span><ChevronDown size={20} aria-hidden="true" /><Select id="supplier-transaction-direction" aria-label="Direction" value={draftFilters.direction} onChange={(event) => setDraftFilters((current) => ({ ...current, direction: event.target.value }))}><option value="all">All directions</option><option value="shop_to_supplier">Shop pays supplier</option><option value="supplier_to_shop">Supplier refunds shop</option></Select></label>
              <label className="product-filter-field product-filter-select" htmlFor="supplier-transaction-method"><WalletCards size={21} /><span><small>Payment method</small><strong>{draftFilters.payment_method || "All methods"}</strong></span><ChevronDown size={20} aria-hidden="true" /><Select id="supplier-transaction-method" aria-label="Payment method" value={draftFilters.payment_method} onChange={(event) => setDraftFilters((current) => ({ ...current, payment_method: event.target.value }))}><option value="">All methods</option>{methods.filter((method) => method.toLowerCase() !== "credit").map((method) => <option key={method}>{method}</option>)}</Select></label>
              <div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={clearFilters}>Reset</MobileFilterResetButton><Button variant="primary" className="mobile-primary" type="submit"><Check size={18} />Apply filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</Button></div>
            </MobileFilterPanel>
          </section>
          <section
            className="transaction-summary"
            aria-label="Loaded supplier payment summary"
          >
            <span>
              <span className="transaction-summary-icon"><ReceiptText size={18} /></span>
              <small>Loaded</small>
              <strong>{list.items.length}</strong>
            </span>
            <span>
              <span className="transaction-summary-icon"><WalletCards size={18} /></span>
              <small>Paid out</small>
              <strong>{money(summary.outgoing)}</strong>
            </span>
            <span>
              <span className="transaction-summary-icon"><HandCoins size={18} /></span>
              <small>Refunded</small>
              <strong>{money(summary.incoming)}</strong>
            </span>
          </section>
          <div className="mobile-list-heading">
            <h2>Supplier payments</h2>
            <span>{list.total ?? list.items.length} records</span>
          </div>
          {list.initialLoading ? (
            <TransactionSkeletons />
          ) : list.error && !list.items.length ? (
            <div className="endless-first-error">
              <p>{list.error}</p>
              <Button variant="plain" type="button" onClick={list.retry}>
                Try again
              </Button>
            </div>
          ) : list.items.length ? (
            <>
              <div className="transaction-card-list">
                {list.items.map((row) => (
                  <TransactionActionCard
                    key={row.id}
                    row={row}
                    onOpen={() => openDetail(row)}
                    onActions={() => setActionRecord(row)}
                  />
                ))}
              </div>
              <EndlessListFooter
                list={list}
                count={list.items.length}
                noun="supplier movements"
              />
            </>
          ) : (
            <div className="mobile-empty-state">
              <span>
                <HandCoins size={28} />
              </span>
              <h2>No supplier payments</h2>
              <p>Record payments and refunds from a supplier account.</p>
            </div>
          )}
        </main>
        <MobileSheet
          className="mobile-sheet--action-menu"
          open={Boolean(actionRecord)}
          title="Supplier payment actions"
          onClose={() => setActionRecord(null)}
        >
          <div className="mobile-action-menu">
            <Button variant="plain"
              type="button"
              onClick={() => {
                const row = actionRecord;
                setActionRecord(null);
                editRow(row);
              }}
            >
              <Edit3 size={19} />
              <span>
                <strong>Edit payment</strong>
                <small>Update this supplier payment record</small>
              </span>
              <ChevronRight className="mobile-action-chevron" size={18} />
            </Button>
            <Button variant="danger-ghost"
              className="danger-action"
              type="button"
              onClick={() => {
                const row = actionRecord;
                setActionRecord(null);
                void openDeleteTarget(row);
              }}
            >
              <Trash2 size={19} />
              <span>
                <strong>Delete payment</strong>
                <small>Remove it and recalculate the balance</small>
              </span>
              <ChevronRight className="mobile-action-chevron" size={18} />
            </Button>
          </div>
        </MobileSheet>
        <MobileSheet
          open={Boolean(detail)}
          title="Supplier payment"
          onClose={() => setDetail(null)}
        >
          {detail?.loading ? (
            <p className="mobile-inline-loading">
              <RefreshCw className="spin" size={17} />
              Loading detail…
            </p>
          ) : (
            detail?.data && (
              <div className="transaction-detail">
                <dl>
                  <div>
                    <dt>Date</dt>
                    <dd>{String(detail.data.created_at || "").slice(0, 16)}</dd>
                  </div>
                  <div>
                    <dt>Supplier</dt>
                    <dd>{detail.data.supplier_name || "Unknown supplier"}</dd>
                  </div>
                  <div>
                    <dt>Direction</dt>
                    <dd>
                      {detail.data.direction === "supplier_to_shop"
                        ? "Supplier refunds shop"
                        : "Shop pays supplier"}
                    </dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>{detail.data.payment_method || "Cash"}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>{money(detail.data.amount)}</dd>
                  </div>
                </dl>
                {detail.data.note && <p>{detail.data.note}</p>}
                <Button variant="primary"
                  className="mobile-primary"
                  type="button"
                  onClick={() => {
                    const row = detail.data;
                    setDetail(null);
                    editRow(row);
                  }}
                >
                  Edit movement
                </Button>
              </div>
            )
          )}
        </MobileSheet>
        <MobileDeleteSheet open={Boolean(deleteTarget)} title="Delete supplier movement?" description="The supplier balance and reports will be recalculated." itemTitle={money(deleteTarget?.amount)} itemDescription={deleteTarget?.note || deleteTarget?.payment_method || "Supplier payment record"} confirmLabel="Delete movement" busy={deleting} onClose={() => setDeleteTarget(null)} onConfirm={deleteTransaction} />
      </>
    );
  }

  return (
    <>
      <main className={salesOnly ? "sale-retail-page sales-reference-page sales-reference-history" : "transaction-page"}>
        {salesOnly ? <SalesReferenceHeader title="Sales" extra={<CsvExportButton label="Export sales" compact onExport={exportTransactions} onNotice={setNotice} />} /> : <>        <section className="products-title-row">
          <div>
            <span className="page-kicker">History</span>
            <h1>{salesOnly ? "Sales" : "Transactions"}</h1>
            <p>
              {salesOnly
                ? "Review sales history, receipts and payment status."
                : "Review customer and supplier payments."}
            </p>
          </div>
        </section>
</>}
        <MobileNotice notice={notice} onClose={() => setNotice(null)} />
        {!salesOnly && (
          <nav className="transaction-tabs" aria-label="Transaction types">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Button variant="plain"
                type="button"
                className={activeTab === id ? "is-active" : ""}
                key={id}
                onClick={() => {
                  const next = blankTransactionFilters();
                  setActiveTab(id);
                  setDraftFilters(next);
                  setAppliedFilters(next);
                  setFiltersOpen(false);
                  setDetail(null);
                }}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Button>
            ))}
          </nav>
        )}
        
        <section className={`mobile-product-controls transaction-controls transaction-list-controls${salesOnly ? " sales-history-controls" : ""}`}>
          <SearchInput className="mobile-search product-search" aria-label={salesOnly ? "Search sales" : "Search transactions"} value={draftFilters.q} onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              } placeholder={
                salesOnly
                  ? "Search sales (receipt, customer)"
                  : "Customer, supplier, method or note"
              } type="text" onClear={() =>
                  setDraftFilters((current) => ({ ...current, q: "" }))
                } clearLabel="Clear search" />
          <div className={`mobile-control-row transaction-shared-control-row${salesOnly ? " sales-history-control-row" : ""}`}>
            <MobileFilterToggle open={filtersOpen} onToggle={() => { if (salesOnly && !filtersOpen) { setDraftFilters({ ...appliedFilters, q: draftFilters.q }); setSalesFilterError(''); } setFiltersOpen((open) => !open); }} controls={salesOnly ? "sales-history-filters" : "customer-payment-filters"} count={activeFilterCount} className="product-toolbar-toggle" />
            
          </div>
          {salesOnly ? <SalesReferenceFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} draft={draftFilters} error={salesFilterError} onChange={update => { setDraftFilters(update); setSalesFilterError(''); }} methods={methods} onApply={applyFilters} onReset={clearFilters} /> : <>          <MobileFilterPanel onClose={() => setFiltersOpen(false)} open={filtersOpen} id={salesOnly ? "sales-history-filters" : "customer-payment-filters"} className={`product-filter-panel transaction-shared-filter-panel${salesOnly ? " sales-history-filter-panel" : ""}`} onSubmit={applyFilters}>
            <section
              className="transaction-presets"
              aria-label="Transaction date range"
            >
              {["today", "week", "month", "year", "all"].map((preset) => (
                <Button variant="choice"
                  type="button"
                  className={appliedFilters.preset === preset ? "is-active" : ""}
                  key={preset}
                  onClick={() => applyPreset(preset)}
                >
                  {preset === "all"
                    ? "All"
                    : preset[0].toUpperCase() + preset.slice(1)}
                </Button>
              ))}
            </section>
              <label className="product-filter-field product-filter-date" htmlFor="transaction-filter-from" onClick={openNativeDatePicker}>
                <span><small>From</small><Input id="transaction-filter-from" type="date" value={draftFilters.start} onChange={(event) => setDraftFilters((current) => ({ ...current, preset: "custom", start: event.target.value }))} /></span>
              </label>
              <label className="product-filter-field product-filter-date" htmlFor="transaction-filter-to" onClick={openNativeDatePicker}>
                <span><small>To</small><Input id="transaction-filter-to" type="date" value={draftFilters.end} onChange={(event) => setDraftFilters((current) => ({ ...current, preset: "custom", end: event.target.value }))} /></span>
              </label>
              {salesOnly && <label className="product-filter-field product-filter-select" htmlFor="sales-filter-channel">
                <ShoppingCart size={21} />
                <span><small>Sale channel</small><strong>{draftFilters.sale_channel === "all" ? "All sales" : draftFilters.sale_channel === "online" ? "Online sales" : "POS sales"}</strong></span>
                <ChevronDown size={20} aria-hidden="true" />
                <Select id="sales-filter-channel" aria-label="Sale channel" value={draftFilters.sale_channel} onChange={(event) => setDraftFilters((current) => ({ ...current, sale_channel: event.target.value }))}>
                  <option value="all">All sales</option><option value="online">Online sales</option><option value="pos">POS sales</option>
                </Select>
              </label>}
              {salesOnly && <label className="product-filter-field product-filter-select" htmlFor="sales-filter-payment-type">
                <CircleDollarSign size={21} />
                <span><small>Payment type</small><strong>{draftFilters.payment_type === "all" ? "All payment types" : draftFilters.payment_type === "cash" ? "Paid" : "Credit"}</strong></span>
                <ChevronDown size={20} aria-hidden="true" />
                <Select id="sales-filter-payment-type" aria-label="Payment type" value={draftFilters.payment_type} onChange={(event) => setDraftFilters((current) => ({ ...current, payment_type: event.target.value }))}>
                  <option value="all">All payment types</option><option value="cash">Paid</option><option value="credit">Credit</option>
                </Select>
              </label>}
              {!salesOnly && <label className="product-filter-field product-filter-select" htmlFor="transaction-filter-direction"><HandCoins size={21} /><span><small>Direction</small><strong>{draftFilters.direction === "all" ? "All directions" : draftFilters.direction === "customer_to_shop" ? "Customer pays shop" : "Shop pays customer"}</strong></span><ChevronDown size={20} aria-hidden="true" /><Select id="transaction-filter-direction" aria-label="Direction" value={draftFilters.direction} onChange={(event) => setDraftFilters((current) => ({ ...current, direction: event.target.value }))}><option value="all">All directions</option><option value="customer_to_shop">Customer pays shop</option><option value="shop_to_customer">Shop pays customer</option></Select></label>}
              <label className="product-filter-field product-filter-select" htmlFor="transaction-filter-method">
                <WalletCards size={21} />
                <span><small>Payment method</small><strong>{draftFilters.payment_method || "All methods"}</strong></span>
                <ChevronDown size={20} aria-hidden="true" />
                <Select id="transaction-filter-method" aria-label="Payment method" value={draftFilters.payment_method} onChange={(event) => setDraftFilters((current) => ({ ...current, payment_method: event.target.value }))}>
                  <option value="">All methods</option>{methods.filter((method) => salesOnly || method.toLowerCase() !== "credit").map((method) => <option key={method}>{method}</option>)}
                </Select>
              </label>
              <div className="product-filter-actions">
                <MobileFilterResetButton variant="secondary" type="button" onClick={clearFilters}>Reset</MobileFilterResetButton>
                <Button variant="primary" className="mobile-primary" type="submit"><Check size={18} />Apply filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</Button>
              </div>
          </MobileFilterPanel></>}

        </section>
        {salesOnly ? <><p className="sales-reference-period">{appliedFilters.start || appliedFilters.end ? `${appliedFilters.start || 'Beginning'} - ${appliedFilters.end || 'Today'}` : 'All dates'} / {list.total ?? list.items.length} sales</p><section className="sales-reference-summary" aria-label="Loaded sales summary">{[['Sales', summary.total, list.items.length], ['Paid', summary.paid, list.items.filter(row => Number(row.paid_amount) > 0).length], ['Credit', summary.credit, list.items.filter(row => Number(row.credit_amount) > 0).length]].map(([label, amount, count]) => <span key={label}><small>{list.hasMore ? `Loaded ${label.toLowerCase()}` : label}</small><strong>{money(amount, currency)}</strong><small>{count} transactions</small></span>)}</section></> : <>        <section
          className="transaction-summary"
          aria-label="Loaded transaction summary"
        >
          <span>
            <span className="transaction-summary-icon"><ReceiptText size={18} /></span>
            <small>Loaded</small>
            <strong>{list.items.length}</strong>
          </span>
          <span>
            <span className="transaction-summary-icon"><CircleDollarSign size={18} /></span>
            <small>{activeTab === "payments" ? "Movement" : "Value"}</small>
            <strong>{money(summary.total)}</strong>
          </span>
          {activeTab === "sales" && (
            <>
              <span>
                <span className="transaction-summary-icon"><HandCoins size={18} /></span>
                <small>Paid</small>
                <strong>{money(summary.paid)}</strong>
              </span>
              <span>
                <span className="transaction-summary-icon"><CreditCard size={18} /></span>
                <small>Credit</small>
                <strong>{money(summary.credit)}</strong>
              </span>
            </>
          )}
        </section>
</>}
        <div className="mobile-list-heading">
          <h2>
            {salesOnly
              ? "Sales history"
              : TABS.find((tab) => tab.id === activeTab)?.label}
          </h2>
          <span>{list.total ?? list.items.length} records</span>
        </div>
        {list.initialLoading ? (
          <TransactionSkeletons />
        ) : list.error && !list.items.length ? (
          <div className="endless-first-error">
            <p>{list.error}</p>
            <Button variant="plain" type="button" onClick={list.retry}>
              Try again
            </Button>
          </div>
        ) : list.items.length ? (
          <>
            <div className="transaction-card-list">
              {list.items.map((row) =>
                activeTab === "sales" ? (
                  <SalesReferenceHistoryRow key={row.id} row={row} currency={currency} onOpen={() => onNavigate(`/sales/${row.id}`)} onActions={() => setActionSale(row)} />
                ) : (
                  <article
                    className="transaction-card transaction-menu-card"
                    key={row.id}
                  >
                    <div className="transaction-menu-row">
                    <Button variant="plain"
                      className="transaction-menu-main"
                      type="button"
                      onClick={() => openDetail(row)}
                    >
                      <span>
                        <small>
                          {String(row.created_at || "").slice(0, 16)}
                        </small>
                        <strong>{row.customer_name}</strong>
                        <em>{`${row.direction === "shop_to_customer" ? "Shop pays customer" : "Customer pays shop"} · ${row.payment_method}`}</em>
                      </span>
                      <b>{money(row.amount)}</b>
                    </Button>
                    <IconButton variant="ghost"
                      className="transaction-menu-button"
                      type="button"
                      aria-label={`Actions for customer payment ${row.id}`}
                      onClick={() => setActionRecord(row)}
                    >
                      <EllipsisVertical size={20} />
                    </IconButton>
                    </div>
                  </article>
                ),
              )}
            </div>
            <EndlessListFooter
              list={list}
              count={list.items.length}
              noun={salesOnly ? "sales" : "transactions"}
            />
          </>
        ) : (
          <div className="mobile-empty-state">
            <span>
              <ReceiptText size={28} />
            </span>
            <h2>{salesOnly ? "No sales found" : "No transactions found"}</h2>
            <p>Try changing your dates or filters.</p>
          </div>
        )}
      </main>
      <MobileSheet
        className="mobile-sheet--action-menu"
        open={Boolean(actionSale)}
        title="Sale actions"
        description={actionSale?.receipt_no || ""}
        onClose={() => setActionSale(null)}
      >
        <div className="mobile-action-menu">
          <Button variant="plain"
            type="button"
            aria-label="View sale details"
            onClick={() => {
              const sale = actionSale;
              setActionSale(null);
              onNavigate(`/sales/${sale.id}`);
            }}
          >
            <Eye size={19} />
            <span>
              <strong>View details</strong>
              <small>Open the full sale information</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
          <Button variant="plain"
            type="button"
            aria-label="Print sale receipt"
            onClick={() => {
              const sale = actionSale;
              setActionSale(null);
              printSale(sale);
            }}
          >
            <Printer size={19} />
            <span>
              <strong>Print receipt</strong>
              <small>Prepare this receipt for printing</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
          {actionSale?.source !== "ecommerce" && <Button variant="plain"
            type="button"
            aria-label="Edit sale"
            onClick={() => {
              const sale = actionSale;
              setActionSale(null);
              editRow(sale);
            }}
          >
            <Edit3 size={19} />
            <span>
              <strong>Edit sale</strong>
              <small>Update items and payment details</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>}
          <Button variant="danger-ghost"
            className="danger-action"
            type="button"
            aria-label="Delete sale"
            onClick={() => {
              const sale = actionSale;
              setActionSale(null);
              void openDeleteTarget(sale);
            }}
          >
            <Trash2 size={19} />
            <span>
              <strong>Delete sale</strong>
              <small>Restore stock and remove the sale</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
        </div>
      </MobileSheet>
      <MobileSheet
        className="mobile-sheet--action-menu"
        open={Boolean(actionRecord) && activeTab === "payments"}
        title="Customer payment actions"
        description={actionRecord?.customer_name || ""}
        onClose={() => setActionRecord(null)}
      >
        <div className="mobile-action-menu">
          <Button variant="plain"
            type="button"
            aria-label="Edit customer payment"
            onClick={() => {
              const row = actionRecord;
              setActionRecord(null);
              editRow(row);
            }}
          >
            <Edit3 size={19} />
            <span>
              <strong>Edit payment</strong>
              <small>Update this customer payment record</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
          <Button variant="danger-ghost"
            className="danger-action"
            type="button"
            aria-label="Delete customer payment"
            onClick={() => {
              const row = actionRecord;
              setActionRecord(null);
              void openDeleteTarget(row);
            }}
          >
            <Trash2 size={19} />
            <span>
              <strong>Delete payment</strong>
              <small>Remove it and recalculate the balance</small>
            </span>
            <ChevronRight className="mobile-action-chevron" size={18} />
          </Button>
        </div>
      </MobileSheet>
      <MobileSheet
        open={Boolean(detail) && activeTab !== "sales"}
        title={detail?.loading ? "Loading…" : "Customer payment"}
        onClose={() => setDetail(null)}
      >
        {detail?.loading ? (
          <p className="mobile-inline-loading">
            <RefreshCw className="spin" size={17} />
            Loading detail…
          </p>
        ) : (
          detail?.data && (
            <div className="transaction-detail">
              <dl>
                <div>
                  <dt>Date</dt>
                  <dd>{String(detail.data.created_at || "").slice(0, 16)}</dd>
                </div>
                <div>
                  <dt>Party</dt>
                  <dd>
                    {detail.data.customer_name ||
                      detail.data.supplier_name ||
                      "Walk-in"}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{money(detail.data.amount)}</dd>
                </div>
              </dl>
              {detail.data.items?.length > 0 && (
                <div className="transaction-detail-lines">
                  {detail.data.items.map((item) => (
                    <span
                      key={item.id || `${item.product_id}-${item.product_name}`}
                    >
                      <span>
                        <strong>{item.product_name}</strong>
                        <small>
                          {item.quantity} ×{" "}
                          {money(item.unit_price ?? item.unit_cost)}
                        </small>
                      </span>
                      <b>
                        {money(
                          item.line_total ??
                            Number(item.quantity || 0) *
                              Number(item.unit_cost || 0),
                        )}
                      </b>
                    </span>
                  ))}
                </div>
              )}
              <Button variant="primary"
                className="mobile-primary"
                type="button"
                onClick={() => {
                  const row = detail.data;
                  setDetail(null);
                  editRow(row);
                }}
              >
                Edit transaction
              </Button>
            </div>
          )
        )}
      </MobileSheet>
      <MobileDeleteSheet
        open={Boolean(deleteTarget)}
        title={`Delete ${activeTab === "payments" ? "payment" : activeTab.slice(0, -1)}?`}
        description={
          activeTab === "sales"
            ? "Stock is restored and customer debt is recalculated."
            : "The customer balance is recalculated."
        }
        itemTitle={activeTab === "sales" ? (deleteTarget?.receipt_no || `Sale #${deleteTarget?.id || ""}`) : money(deleteTarget?.amount)}
        itemDescription={activeTab === "sales" ? money(deleteTarget?.total) : (deleteTarget?.note || deleteTarget?.payment_method || "Payment record")}
        confirmLabel="Delete transaction"
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTransaction}
      >
        {deleteTarget && deletePinRequired && <FieldShell as="label" className="mobile-field"><span>Admin PIN</span><Input type="password" inputMode="numeric" required value={adminPin} onChange={(event) => setAdminPin(event.target.value)} /></FieldShell>}
      </MobileDeleteSheet>
    </>
  );
}
