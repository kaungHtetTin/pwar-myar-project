import { storedTimestamp } from '../timezone';
import React, { useMemo, useRef, useState } from 'react';
import {
  Edit,
  Eye,
  Filter,
  HandCoins,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { request } from '../api';
import { RowActions } from '../components/RowActions';
import { actionLabel, formatQuantity, money, normalizeNumber } from '../utils';
import { EmptyState, Field, FilterDrawer, Modal, TableLoadingState, TablePagination } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useConfirmation } from '../components/confirmations';
import { RemoteCombobox } from '../components/RemoteCombobox';
import { cleanPriceTypes } from '../priceTypes';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { printReceiptText, receiptLayoutClassNames, printResultMessage } from '../printing';
import { usePrinting } from '../hooks/usePrinting';
import { dateRangeError, presetDateRange } from '../dateRanges';
import { baseUnitName, purchaseUnitFor, purchaseUnitOptions } from '../productUnits';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { loadPurchaseLineItems, PURCHASE_LINE_COLUMNS } from '../purchaseCsv';
import { loadSaleLineItems, SALE_LINE_COLUMNS } from '../saleCsv';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { TABLE_PAGE_SIZE } from '../tablePagination';

function blankFilters() {
  return {
    preset: 'all',
    q: '',
    start: '',
    end: '',
    sale_channel: 'all',
    payment_type: 'all',
    payment_method: '',
    direction: 'all',
  };
}

function blankFilterTabs() {
  return {
    sales: blankFilters(),
    payments: blankFilters(),
    supplierPayments: blankFilters(),
    purchases: blankFilters(),
  };
}

function normalizeTransactionFilters(tab, rawFilters = {}) {
  const filters = { ...blankFilters(), ...rawFilters };
  filters.q = String(filters.q || '');
  filters.sale_channel = tab === 'sales' && ['online', 'pos'].includes(filters.sale_channel) ? filters.sale_channel : 'all';
  filters.payment_type = tab === 'sales' ? filters.payment_type || 'all' : 'all';
  filters.payment_method = ['sales', 'payments', 'supplierPayments'].includes(tab) ? String(filters.payment_method || '') : '';
  filters.direction = ['payments', 'supplierPayments'].includes(tab) ? filters.direction || 'all' : 'all';
  if (!['today', 'week', 'month', 'year', 'all', 'custom'].includes(filters.preset)) {
    filters.preset = 'all';
  }
  return filters;
}

function cleanPaymentMethods(settings) {
  const fallback = ['Cash', 'Wallet Pay', 'Banking Pay', 'KPay', 'Wave Pay', 'Credit'];
  const rows = String(settings.payment_methods || '').split(',').map((item) => item.trim()).filter(Boolean);
  return rows.length ? rows : fallback;
}

function productPrice(product, priceType) {
  const prices = product?.prices || [];
  const selected = prices.find((price) => price.name === priceType);
  if (selected) return Number(selected.price || 0);
  if (priceType !== 'Retail') return 0;
  const retail = prices.find((price) => price.name === 'Retail' && Number(price.price || 0) > 0);
  return Number((retail && retail.price) || product?.price || 0);
}

function buildPath(tab, filters, offset = 0) {
  const cleanFilters = normalizeTransactionFilters(tab, filters);
  const params = new URLSearchParams();
  params.set('status', 'completed');
  params.set('limit', String(TABLE_PAGE_SIZE));
  params.set('offset', String(offset));
  params.set('with_total', 'true');
  if (cleanFilters.q.trim()) params.set('q', cleanFilters.q.trim());
  if (cleanFilters.start) params.set(tab === 'purchases' ? 'date_from' : 'start', cleanFilters.start);
  if (cleanFilters.end) params.set(tab === 'purchases' ? 'date_to' : 'end', cleanFilters.end);
  if (tab === 'sales') {
    if (cleanFilters.sale_channel !== 'all') params.set('sale_channel', cleanFilters.sale_channel);
    if (cleanFilters.payment_type !== 'all') params.set('payment_type', cleanFilters.payment_type);
    if (cleanFilters.payment_method.trim()) params.set('payment_method', cleanFilters.payment_method.trim());
    return `/sales?${params.toString()}`;
  }
  if (tab === 'payments') {
    if (cleanFilters.direction !== 'all') params.set('direction', cleanFilters.direction);
    if (cleanFilters.payment_method.trim()) params.set('payment_method', cleanFilters.payment_method.trim());
    return `/customer-payments?${params.toString()}`;
  }
  if (tab === 'supplierPayments') {
    if (cleanFilters.direction !== 'all') params.set('direction', cleanFilters.direction);
    if (cleanFilters.payment_method.trim()) params.set('payment_method', cleanFilters.payment_method.trim());
    return `/supplier-payments?${params.toString()}`;
  }
  return `/purchases?${params.toString()}`;
}

function rowDate(row) {
  return storedTimestamp(row?.created_at).slice(0, 10);
}

function textIncludes(value, query) {
  return String(value ?? '').toLowerCase().includes(query);
}

function clientFilterRows(tab, rows, filters) {
  const cleanFilters = normalizeTransactionFilters(tab, filters);
  const query = cleanFilters.q.trim().toLowerCase();
  return rows.filter((row) => {
    const date = rowDate(row);
    if (cleanFilters.start && date && date < cleanFilters.start) return false;
    if (cleanFilters.end && date && date > cleanFilters.end) return false;

    if (tab === 'sales') {
      if (cleanFilters.sale_channel === 'online' && row.source !== 'ecommerce') return false;
      if (cleanFilters.sale_channel === 'pos' && row.source === 'ecommerce') return false;
      if (cleanFilters.payment_type !== 'all' && row.payment_type !== cleanFilters.payment_type) return false;
      if (cleanFilters.payment_method.trim() && row.payment_method !== cleanFilters.payment_method.trim()) return false;
      if (!query) return true;
      return [
        row.receipt_no,
        row.customer_name,
        row.payment_type,
        row.payment_method,
        row.id,
      ].some((value) => textIncludes(value, query));
    }

    if (['payments', 'supplierPayments'].includes(tab)) {
      if (cleanFilters.direction !== 'all' && row.direction !== cleanFilters.direction) return false;
      if (cleanFilters.payment_method.trim() && row.payment_method !== cleanFilters.payment_method.trim()) return false;
      if (!query) return true;
      return [
        tab === 'payments' ? row.customer_name : row.supplier_name,
        row.direction,
        row.payment_method,
        row.note,
        row.id,
      ].some((value) => textIncludes(value, query));
    }

    if (!query) return true;
    return [
      row.supplier_name,
      row.note,
      row.status,
      row.id,
    ].some((value) => textIncludes(value, query));
  });
}

function saleToForm(sale) {
  return {
    id: sale.id,
    discount: sale.discount || 0,
    payment_type: sale.payment_type || 'cash',
    payment_method: sale.payment_method || 'Cash',
    paid_amount: sale.paid_amount || 0,
    customer_id: sale.customer_id || '',
    customer_option: sale.customer_id ? { id: sale.customer_id, name: sale.customer_name || `Customer ${sale.customer_id}` } : null,
    admin_pin: '',
    adding_item: false,
    items: (sale.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      unit_name: item.unit_name || 'Unit',
      price_type: item.price_type || 'Retail',
      quantity: item.quantity,
      foc_quantity: item.foc_quantity || 0,
      unit_price: item.unit_price,
    })),
  };
}

function purchaseToForm(purchase) {
  return {
    id: purchase.id,
    supplier_id: purchase.supplier_id || null,
    supplier_name: purchase.supplier_name || '',
    supplier_option: purchase.supplier_name
      ? { id: purchase.supplier_id || `purchase-supplier-${purchase.id}`, name: purchase.supplier_name }
      : null,
    payment_method: purchase.payment_method || 'Cash',
    paid_amount: purchase.paid_amount ?? purchase.total_cost ?? 0,
    note: purchase.note || '',
    add_product_id: '',
    add_unit_name: '',
    add_quantity: 1,
    add_foc_quantity: 0,
    add_unit_cost: 0,
    items: (purchase.items || []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      unit_name: item.unit_name || 'Unit',
      conversion_factor: item.conversion_factor || 1,
      quantity: item.quantity,
      foc_quantity: item.foc_quantity || 0,
      unit_cost: item.unit_cost,
    })),
  };
}

export function TransactionsScreen({ view = 'payments' }) {
  const salesOnly = view === 'sales';
  const initialTab = salesOnly ? 'sales' : 'payments';
  const refreshSource = salesOnly ? 'sales' : 'transactions';
  const printing = usePrinting();
  const printRequest = useRef(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const filterFormRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [filtersByTab, setFiltersByTab] = useState(blankFilterTabs());
  const [filterOpen, setFilterOpen] = useState(false);
  const [rows, setRows] = useState({ sales: [], payments: [], supplierPayments: [], purchases: [] });
  const [pages, setPages] = useState({ sales: 1, payments: 1, supplierPayments: 1, purchases: 1 });
  const [totals, setTotals] = useState({ sales: 0, payments: 0, supplierPayments: 0, purchases: 0 });
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const loadSequence = React.useRef(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saleForm, setSaleForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState(null);
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();

  const filters = filtersByTab[activeTab] || blankFilters();

  function exportActiveTransactions() {
    const url = new URL(buildPath(activeTab, filters), window.location.origin);
    url.searchParams.delete('limit');
    url.searchParams.delete('offset');
    url.searchParams.delete('with_total');
    const config = {
      sales: {
        name: 'sales',
        columns: SALE_LINE_COLUMNS,
        loadRows: (path) => loadSaleLineItems(path),
      },
      payments: {
        name: 'customer-payments',
        columns: [
          { label: 'Date', value: (row) => storedTimestamp(row.created_at) }, { label: 'Customer', value: (row) => row.customer_name || '' },
          { label: 'Direction', value: (row) => row.direction }, { label: 'Method', value: (row) => row.payment_method || '' },
          { label: 'Amount', value: (row) => row.amount }, { label: 'Note', value: (row) => row.note || '' },
          { label: 'Status', value: (row) => row.status || '' },
        ],
      },
      supplierPayments: {
        name: 'supplier-payments',
        columns: [
          { label: 'Date', value: (row) => storedTimestamp(row.created_at) }, { label: 'Supplier', value: (row) => row.supplier_name || '' },
          { label: 'Direction', value: (row) => row.direction }, { label: 'Method', value: (row) => row.payment_method || '' },
          { label: 'Amount', value: (row) => row.amount }, { label: 'Note', value: (row) => row.note || '' },
          { label: 'Status', value: (row) => row.status || '' },
        ],
      },
      purchases: {
        name: 'transaction-purchases',
        columns: PURCHASE_LINE_COLUMNS,
        loadRows: (path) => loadPurchaseLineItems(path),
      },
    }[activeTab];
    const path = `${url.pathname}${url.search}`;
    return exportFilteredCsv({
      ...(config.loadRows ? { loadRows: () => config.loadRows(path) } : { path }),
      filename: csvFilename(config.name),
      columns: config.columns,
    });
  }
  const activeFilterCount = [
    filters.q.trim(),
    filters.start,
    filters.end,
    activeTab === 'sales' && filters.sale_channel !== 'all' ? filters.sale_channel : '',
    activeTab === 'sales' && filters.payment_type !== 'all' ? filters.payment_type : '',
    ['sales', 'payments', 'supplierPayments'].includes(activeTab) ? filters.payment_method : '',
    ['payments', 'supplierPayments'].includes(activeTab) && filters.direction !== 'all' ? filters.direction : '',
  ].filter(Boolean).length;
  const displayedRows = useMemo(() => clientFilterRows(activeTab, rows[activeTab] || [], filters), [activeTab, rows, filters]);
  const paymentMethods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const priceTypes = useMemo(() => cleanPriceTypes(settings.price_types), [settings.price_types]);
  const adminPinRequired = String(settings.admin_pin_set) === '1';
  const saleEditSubtotal = saleForm?.items.reduce((sum, item) => sum + Math.round(normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0)), 0) || 0;
  const saleEditTotal = Math.max(0, saleEditSubtotal - Math.round(normalizeNumber(saleForm?.discount, 0)));
  const saleEditPaidInput = saleForm ? Math.max(0, Math.round(normalizeNumber(saleForm.paid_amount, 0))) : 0;
  const saleEditPaidForSale = Math.min(saleEditPaidInput, saleEditTotal);
  const saleEditUnpaid = Math.max(saleEditTotal - saleEditPaidForSale, 0);
  const saleEditChange = Math.max(saleEditPaidInput - saleEditTotal, 0);

  async function loadReferences() {
    const settingRows = await request('/settings');
    setSettings(settingRows);
  }

  const loadCustomerOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/customers?${params.toString()}`);
    return data.items || [];
  }, []);

  const loadProductOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/products?${params.toString()}`);
    return data.items || [];
  }, []);

  const loadSupplierOptions = React.useCallback(async (query) => {
    const params = new URLSearchParams({ with_total: 'true', limit: '20', offset: '0' });
    if (query) params.set('q', query);
    const data = await request(`/suppliers?${params.toString()}`);
    return data.items || [];
  }, []);

  function setTabFilters(tab, nextFilters) {
    const cleanFilters = normalizeTransactionFilters(tab, nextFilters);
    setFiltersByTab((current) => ({ ...current, [tab]: cleanFilters }));
    return cleanFilters;
  }

  function patchActiveFilters(patch) {
    setFiltersByTab((current) => {
      const baseFilters = current[activeTab] || blankFilters();
      return {
        ...current,
        [activeTab]: normalizeTransactionFilters(activeTab, { ...baseFilters, ...patch }),
      };
    });
  }

  function filtersFromForm(tab) {
    const form = filterFormRef.current;
    if (!form) return normalizeTransactionFilters(tab, filtersByTab[tab] || blankFilters());
    const data = new FormData(form);
    const current = filtersByTab[tab] || blankFilters();
    const start = String(data.get('start') || '');
    const end = String(data.get('end') || '');
    const presetRangeValues = presetDateRange(current.preset);
    const preset = current.preset !== 'custom' && (start !== presetRangeValues.start || end !== presetRangeValues.end)
      ? 'custom'
      : current.preset;
    return normalizeTransactionFilters(tab, {
      ...current,
      preset,
      q: current.q,
      start,
      end,
      sale_channel: tab === 'sales' ? String(data.get('sale_channel') || 'all') : 'all',
      payment_type: tab === 'sales' ? String(data.get('payment_type') || 'all') : 'all',
      payment_method: ['sales', 'payments', 'supplierPayments'].includes(tab) ? String(data.get('payment_method') || '') : '',
      direction: ['payments', 'supplierPayments'].includes(tab) ? String(data.get('direction') || 'all') : 'all',
    });
  }

  async function loadTab(tab = activeTab, nextFilters = filtersByTab[tab] || blankFilters(), options = {}) {
    const cleanFilters = normalizeTransactionFilters(tab, nextFilters);
    const nextPage = options.page || 1;
    const pageSize = TABLE_PAGE_SIZE;
    const offset = (nextPage - 1) * pageSize;
    const rangeError = dateRangeError(cleanFilters.start, cleanFilters.end);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    try {
      const data = await request(buildPath(tab, cleanFilters, offset));
      if (sequence !== loadSequence.current) return;
      const pageRows = data.items || [];
      setRows((current) => ({ ...current, [tab]: pageRows }));
      setPages((current) => ({ ...current, [tab]: nextPage }));
      setTotals((current) => ({ ...current, [tab]: data.total || 0 }));
    } catch (err) {
      if (sequence === loadSequence.current) setError(`Cannot load transactions. ${err.message}`);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  useLatestEffect(() => {
    Promise.all([loadReferences(), loadTab(initialTab, blankFilters())]).catch((err) => {
      setError(`Cannot load transactions. ${err.message}`);
      setLoading(false);
    });
  }, []);

  useDataRefresh(salesOnly ? ['sales', 'settings', 'priceTypes'] : ['customerPayments', 'supplierPayments', 'settings'], refreshSource, () => {
    loadReferences();
    loadTab(activeTab, filtersByTab[activeTab] || blankFilters(), { page: pages[activeTab] || 1 });
  });

  async function switchTab(tab) {
    setActiveTab(tab);
    setFilterOpen(false);
    setDetail(null);
    await loadTab(tab, filtersByTab[tab] || blankFilters(), { page: pages[tab] || 1 });
  }

  async function setPreset(preset) {
    const next = setTabFilters(activeTab, { ...filters, preset, ...presetDateRange(preset) });
    await loadTab(activeTab, next);
  }

  async function applyFilters(event) {
    event.preventDefault();
    const next = setTabFilters(activeTab, filtersFromForm(activeTab));
    await loadTab(activeTab, next);
    setFilterOpen(false);
  }

  async function clearFilters() {
    const next = setTabFilters(activeTab, blankFilters());
    setFilterOpen(false);
    await loadTab(activeTab, next);
  }

  async function openSaleDetail(id) {
    setError('');
    try {
      setDetail({ type: 'sale', data: await request(`/sales/${id}`) });
    } catch (err) {
      setError(err.message);
    }
  }

  function openPaymentDetail(payment) {
    setDetail({ type: activeTab === 'supplierPayments' ? 'supplierPayment' : 'payment', data: payment });
  }

  async function printPreparedReceipt(payload) {
    const result = await printReceiptText(
      payload.text,
      payload.paper_size || settings.receipt_paper_size,
      { html: payload.html, layout: payload.layout, printerName: settings.printer_name },
    );
    setMessage(printResultMessage(result));
  }

  async function reprintSale(id, showPreview = true) {
    if (printRequest.current || printing) return;
    printRequest.current = true;
    setPreparingPrint(true);
    setError('');
    try {
      const payload = await request(`/sales/${id}/receipt`);
      if (showPreview) setDetail({ type: 'receipt', data: payload });
      if (window.mkposDesktop?.printReceipt) {
        await printPreparedReceipt(payload);
        return;
      }
      const result = await request(`/sales/${id}/print`, { method: 'POST' });
      if (!result.ok) {
        await printPreparedReceipt({
          ...payload,
          text: result.text || payload.text,
          html: result.html || payload.html,
          paper_size: result.paper_size || payload.paper_size,
          layout: result.layout || payload.layout,
        });
      } else {
        setMessage(result.message || 'Receipt print requested.');
      }
    } catch (err) {
      setError(err.message || 'Receipt could not be printed.');
    } finally {
      printRequest.current = false;
      setPreparingPrint(false);
    }
  }

  async function editSale(id) {
    setError('');
    try {
      setSaleForm({
        ...saleToForm(await request(`/sales/${id}`)),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  function updateSaleItem(index, patch) {
    setSaleForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addSaleItem(product) {
    if (!product) return;
    const priceType = priceTypes[0] || 'Retail';
    setSaleForm((current) => ({
      ...current,
      adding_item: false,
      items: [{
        product_id: product.id,
        product_name: product.name,
        unit_name: product.base_unit || 'Unit',
        price_type: priceType,
        quantity: 1,
        foc_quantity: 0,
        unit_price: productPrice(product, priceType),
      }, ...current.items],
    }));
    setError('');
  }

  async function saveSaleEdit(event) {
    event.preventDefault();
    if (!saleForm.items.length) {
      setError('Sale must contain at least one item.');
      return;
    }
    const invalid = saleForm.items.find(
      (item) => normalizeNumber(item.quantity, 0) < 0
        || normalizeNumber(item.foc_quantity, 0) < 0
        || normalizeNumber(item.quantity, 0) + normalizeNumber(item.foc_quantity, 0) <= 0
        || normalizeNumber(item.unit_price, -1) < 0,
    );
    if (invalid) {
      setError('Each sale item needs a paid quantity or FOC quantity greater than zero and price zero or greater.');
      return;
    }
    if (saleEditUnpaid > 0 && !saleForm.customer_id) {
      setError('Unpaid amount requires a customer.');
      return;
    }
    if (adminPinRequired && !String(saleForm.admin_pin || '').trim()) {
      setError('Admin PIN is required to update this sale.');
      return;
    }
    const payload = {
      items: saleForm.items.map((item) => ({
        product_id: item.product_id,
        price_type: item.price_type,
        quantity: normalizeNumber(item.quantity, 0),
        foc_quantity: normalizeNumber(item.foc_quantity, 0),
        unit_price: Math.round(normalizeNumber(item.unit_price, 0)),
      })),
      discount: Math.round(normalizeNumber(saleForm.discount, 0)),
      payment_type: saleEditUnpaid > 0 ? 'credit' : 'cash',
      payment_method: saleEditUnpaid > 0 && saleEditPaidForSale === 0 ? 'Credit' : saleForm.payment_method,
      paid_amount: saleEditPaidForSale,
      customer_id: saleForm.customer_id ? Number(saleForm.customer_id) : null,
      ...(adminPinRequired ? { admin_pin: saleForm.admin_pin || '' } : {}),
    };
    setSaving(true);
    setError('');
    try {
      await request(`/sales/${saleForm.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setSaleForm(null);
      setMessage('Sale updated.');
      await loadReferences();
      await loadTab('sales', filters, { page: pages.sales });
      emitDataChange(['sales', 'products', 'customers', 'reports'], 'transactions');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSale(sale) {
    const { confirmed, pin: adminPin } = await confirmAction({
      title: 'Delete sale',
      message: `Delete sale ${sale.receipt_no}? Stock will be restored, amounts and customer debt will be recalculated, and the sale will be removed from history.`,
      confirmLabel: 'Delete Sale',
      requirePin: true,
    });
    if (!confirmed) return;
    setDeletingId(sale.id);
    setError('');
    try {
      await request(`/sales/${sale.id}`, {
        method: 'DELETE',
        ...(adminPin ? { body: JSON.stringify({ admin_pin: adminPin }) } : {}),
      });
      setMessage('Sale deleted.');
      await loadReferences();
      await loadTab('sales', filters, { page: pages.sales });
      emitDataChange(['sales', 'products', 'customers', 'reports'], 'transactions');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function editPayment(payment) {
    const supplierPayment = activeTab === 'supplierPayments' || Boolean(payment.supplier_id);
    setPaymentForm({
      id: payment.id,
      kind: supplierPayment ? 'supplier' : 'customer',
      person_name: supplierPayment ? (payment.supplier_name || `Supplier ${payment.supplier_id}`) : (payment.customer_name || `Customer ${payment.customer_id}`),
      customer_id: payment.customer_id,
      customer_option: payment.customer_id ? { id: payment.customer_id, name: payment.customer_name || `Customer ${payment.customer_id}` } : null,
      supplier_id: payment.supplier_id,
      supplier_option: payment.supplier_id ? { id: payment.supplier_id, name: payment.supplier_name || `Supplier ${payment.supplier_id}` } : null,
      direction: payment.direction || 'customer_to_shop',
      payment_method: payment.payment_method || 'Cash',
      amount: payment.amount,
      note: payment.note || '',
    });
  }

  async function savePaymentEdit(event) {
    event.preventDefault();
    const amount = normalizeNumber(paymentForm.amount, NaN);
    const accountId = paymentForm.kind === 'supplier' ? paymentForm.supplier_id : paymentForm.customer_id;
    if (!accountId || !Number.isFinite(amount) || amount <= 0) {
      setError('The payment account is missing or the amount is not greater than zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await request(`/${paymentForm.kind === 'supplier' ? 'supplier-payments' : 'customer-payments'}/${paymentForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...(paymentForm.kind === 'supplier' ? { supplier_id: Number(paymentForm.supplier_id) } : { customer_id: Number(paymentForm.customer_id) }),
          direction: paymentForm.direction,
          payment_method: paymentForm.payment_method || 'Cash',
          amount: Math.round(amount),
          note: String(paymentForm.note || '').trim(),
        }),
      });
      setPaymentForm(null);
      setMessage('Payment updated.');
      const tab = paymentForm.kind === 'supplier' ? 'supplierPayments' : 'payments';
      await loadTab(tab, filtersByTab[tab], { page: pages[tab] });
      emitDataChange(paymentForm.kind === 'supplier' ? ['supplierPayments', 'suppliers', 'reports'] : ['customerPayments', 'customers', 'reports'], 'transactions');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(payment) {
    const supplierPayment = activeTab === 'supplierPayments' || Boolean(payment.supplier_id);
    const { confirmed } = await confirmAction({
      title: `Delete ${supplierPayment ? 'supplier' : 'customer'} payment`,
      message: `Delete payment ${money(payment.amount)} for ${supplierPayment ? payment.supplier_name : payment.customer_name}? The account balance will be recalculated.`,
      confirmLabel: 'Delete Payment',
    });
    if (!confirmed) return;
    setDeletingId(payment.id);
    setError('');
    try {
      await request(`/${supplierPayment ? 'supplier-payments' : 'customer-payments'}/${payment.id}`, { method: 'DELETE' });
      setMessage('Payment deleted.');
      const tab = supplierPayment ? 'supplierPayments' : 'payments';
      await loadTab(tab, filtersByTab[tab], { page: pages[tab] });
      emitDataChange(supplierPayment ? ['supplierPayments', 'suppliers', 'reports'] : ['customerPayments', 'customers', 'reports'], 'transactions');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function editPurchase(id) {
    setError('');
    try {
      setPurchaseForm(purchaseToForm(await request(`/purchases/${id}`)));
    } catch (err) {
      setError(err.message);
    }
  }

  function updatePurchaseItem(index, patch) {
    setPurchaseForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addPurchaseItem() {
    const product = products.find((item) => String(item.id) === String(purchaseForm.add_product_id));
    const quantity = normalizeNumber(purchaseForm.add_quantity, NaN);
    const focQuantity = normalizeNumber(purchaseForm.add_foc_quantity, NaN);
    const unitCost = normalizeNumber(purchaseForm.add_unit_cost, NaN);
    const unit = purchaseUnitFor(product, purchaseForm.add_unit_name);
    if (!product || !Number.isFinite(quantity) || quantity <= 0
      || !Number.isFinite(focQuantity) || focQuantity < 0
      || !Number.isFinite(unitCost) || unitCost < 0) {
      setError('Choose product, quantity greater than zero, and valid unit cost.');
      return;
    }
    setPurchaseForm((current) => ({
      ...current,
      add_product_id: '',
      add_unit_name: '',
      add_quantity: 1,
      add_foc_quantity: 0,
      add_unit_cost: 0,
      items: [...current.items, {
        product_id: product.id,
        product_name: product.name,
        unit_name: unit.name,
        conversion_factor: unit.factor,
        quantity,
        foc_quantity: focQuantity,
        unit_cost: unitCost,
      }],
    }));
  }

  async function savePurchaseEdit(event) {
    event.preventDefault();
    if (!purchaseForm.items.length) {
      setError('Purchase must contain at least one item.');
      return;
    }
    const invalid = purchaseForm.items.find(
      (item) => normalizeNumber(item.quantity, 0) <= 0
        || normalizeNumber(item.foc_quantity, 0) < 0
        || normalizeNumber(item.unit_cost, -1) < 0,
    );
    if (invalid) {
      setError('Each purchase item needs quantity greater than zero and unit cost zero or greater.');
      return;
    }
    const editedPurchaseTotal = purchaseForm.items.reduce((sum, item) => sum + normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_cost, 0), 0);
    const editedPaidAmount = Math.round(normalizeNumber(purchaseForm.paid_amount, -1));
    if (editedPaidAmount < 0 || editedPaidAmount > editedPurchaseTotal) {
      setError('Paid amount must be between zero and the purchase total.');
      return;
    }
    if (editedPaidAmount < editedPurchaseTotal && !purchaseForm.supplier_id) {
      setError('Choose a saved supplier before recording purchase credit.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await request(`/purchases/${purchaseForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          supplier_id: purchaseForm.supplier_id || null,
          supplier_name: String(purchaseForm.supplier_name || '').trim(),
          payment_method: purchaseForm.payment_method || 'Cash',
          paid_amount: editedPaidAmount,
          note: String(purchaseForm.note || '').trim(),
          items: purchaseForm.items.map((item) => ({
            id: item.id || undefined,
            product_id: item.product_id,
            unit_name: item.unit_name,
            quantity: normalizeNumber(item.quantity, 0),
            foc_quantity: normalizeNumber(item.foc_quantity, 0),
            unit_cost: Math.round(normalizeNumber(item.unit_cost, 0)),
          })),
        }),
      });
      setPurchaseForm(null);
      setMessage('Purchase updated.');
      await loadReferences();
      await loadTab('purchases', filters, { page: pages.purchases });
      emitDataChange(['purchases', 'products', 'suppliers', 'reports'], 'transactions');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePurchase(purchase) {
    const { confirmed, pin: adminPin } = await confirmAction({
      title: 'Delete purchase',
      message: `Delete purchase from "${purchase.supplier_name || 'Unknown supplier'}"? Stock will be reversed and the transaction will be removed from history.`,
      confirmLabel: 'Delete Purchase',
      requirePin: true,
    });
    if (!confirmed) return;
    setDeletingId(purchase.id);
    setError('');
    try {
      await request(`/purchases/${purchase.id}`, {
        method: 'DELETE',
        ...(adminPin ? { body: JSON.stringify({ admin_pin: adminPin }) } : {}),
      });
      setMessage('Purchase deleted.');
      await loadReferences();
      await loadTab('purchases', filters, { page: pages.purchases });
      emitDataChange(['purchases', 'products', 'suppliers', 'reports'], 'transactions');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function renderDetailModal() {
    return (
      <Modal
        open={Boolean(detail)}
        title={detail?.type === 'receipt' ? 'Receipt Preview' : 'Transaction Detail'}
        onClose={() => setDetail(null)}
        footer={detail?.type === 'sale'
          ? <><button type="button" onClick={() => reprintSale(detail.data.id)}><Printer size={16} /> Reprint</button>{detail.data.source !== 'ecommerce' && <button type="button" className="primary" onClick={() => editSale(detail.data.id)}><Edit size={16} /> Edit Sale</button>}</>
          : detail?.type === 'receipt'
            ? (
              <button
                type="button"
                disabled={printing || preparingPrint}
                onClick={async () => {
                  setMessage('');
                  setError('');
                  try { await printPreparedReceipt(detail.data); }
                  catch (err) { setError(err.message || 'Receipt could not be printed.'); }
                }}
              >
                <Printer size={16} /> {window.mkposDesktop?.printReceipt ? 'Print Receipt' : 'Browser Print'}
              </button>
            )
            : <button type="button" onClick={() => setDetail(null)}>Close</button>}
      >
        {detail?.type === 'sale' && (
          <div className="transaction-detail">
            <div className="transaction-detail-meta">
              <span>Receipt <strong>{detail.data.receipt_no}</strong></span>
              <span>Date <strong>{storedTimestamp(detail.data.created_at)}</strong></span>
              <span>Customer <strong>{detail.data.customer_name || '-'}</strong></span>
              <span>Payment Type <strong>{detail.data.payment_type}</strong></span>
              <span>Payment Method <strong>{detail.data.payment_method}</strong></span>
              <span>Status <strong>{detail.data.status}</strong></span>
              <span>Subtotal <strong>{money(detail.data.subtotal)}</strong></span>
              <span>Discount <strong>{money(detail.data.discount)}</strong></span>
              <span>Total <strong>{money(detail.data.total)}</strong></span>
              <span>Paid <strong>{money(detail.data.paid_amount)}</strong></span>
              <span>Credit <strong>{money(detail.data.credit_amount)}</strong></span>
              <span>Sale ID <strong>{detail.data.id}</strong></span>
            </div>
            <div className="table-wrap sheet-table">
              <table>
                <thead><tr><th>Item</th><th>Item ID</th><th>Type</th><th>Paid Qty</th><th>FOC Qty</th><th>Issued</th><th>Unit Price</th><th>Unit Cost</th><th>Total</th></tr></thead>
                <tbody>
                  {(detail.data.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.product_id || '-'}</td>
                      <td>{item.price_type}</td>
                      <td>{formatQuantity(item.quantity)}</td>
                      <td>{formatQuantity(item.foc_quantity || 0)}</td>
                      <td>{formatQuantity(Number(item.quantity || 0) + Number(item.foc_quantity || 0))}</td>
                      <td>{money(item.unit_price)}</td>
                      <td>{money(item.unit_cost)}</td>
                      <td>{money(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {detail?.type === 'receipt' && (
          <div className="sale-receipt-preview">
            {detail.data.html
              ? (
                <div
                  className={receiptLayoutClassNames(detail.data.layout, detail.data.paper_size)}
                  dangerouslySetInnerHTML={{ __html: detail.data.html }}
                />
              )
              : <pre>{detail.data.text}</pre>}
          </div>
        )}
        {detail?.type === 'purchase' && (
          <div className="purchase-detail">
            <div className="transaction-detail-meta">
              <span>Purchase ID <strong>{detail.data.id}</strong></span>
              <span>Supplier <strong>{detail.data.supplier_name || '-'}</strong></span>
              <span>Date <strong>{storedTimestamp(detail.data.created_at)}</strong></span>
              <span>Status <strong>{detail.data.status}</strong></span>
              <span>Updated <strong>{detail.data.updated_at || '-'}</strong></span>
              <span>Total <strong>{money(detail.data.total_cost)}</strong></span>
              <span>Paid <strong>{money(detail.data.paid_amount)}</strong></span>
              <span>Supplier Credit <strong>{money(detail.data.credit_amount)}</strong></span>
              <span>Payment Method <strong>{detail.data.payment_method || 'Cash'}</strong></span>
            </div>
            {detail.data.note && <div className="info-box">{detail.data.note}</div>}
            <div className="table-wrap sheet-table">
              <table>
                <thead><tr><th>Product</th><th>Product ID</th><th>Paid Qty</th><th>FOC Qty</th><th>Received</th><th>Unit Cost</th><th>Effective Cost</th><th>Total</th></tr></thead>
                <tbody>
                  {(detail.data.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.product_id}</td>
                      <td>{formatQuantity(item.quantity)} {item.unit_name}</td>
                      <td>{formatQuantity(item.foc_quantity || 0)} {item.unit_name}</td>
                      <td>{formatQuantity(Number(item.base_quantity || 0) + Number(item.base_foc_quantity || 0))}</td>
                      <td>{money(item.unit_cost)}</td>
                      <td>{money(item.effective_unit_cost ?? item.unit_cost)}</td>
                      <td>{money(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sale-receipt-actions">
              <button type="button" className="primary" onClick={() => editPurchase(detail.data.id)}>Edit Purchase</button>
              <button type="button" className="danger-button" onClick={() => deletePurchase(detail.data)}>Delete Purchase</button>
            </div>
          </div>
        )}
        {['payment', 'supplierPayment'].includes(detail?.type) && (
          <div className="transaction-detail">
            <div className="transaction-detail-meta">
              <span>Payment ID <strong>{detail.data.id}</strong></span>
              <span>Date <strong>{storedTimestamp(detail.data.created_at)}</strong></span>
              <span>{detail.type === 'supplierPayment' ? 'Supplier' : 'Customer'} <strong>{detail.type === 'supplierPayment' ? detail.data.supplier_name : detail.data.customer_name}</strong></span>
              <span>Account ID <strong>{detail.type === 'supplierPayment' ? detail.data.supplier_id : detail.data.customer_id}</strong></span>
              <span>Direction <strong>{detail.type === 'supplierPayment' ? (detail.data.direction === 'supplier_to_shop' ? 'Supplier refunds shop' : 'Shop pays supplier') : (detail.data.direction === 'shop_to_customer' ? 'Shop pays customer' : 'Customer pays shop')}</strong></span>
              <span>Payment Method <strong>{detail.data.payment_method || 'Cash'}</strong></span>
              <span>Amount <strong>{money(detail.data.amount)}</strong></span>
              <span>Status <strong>{detail.data.status}</strong></span>
              <span>Updated <strong>{detail.data.updated_at || '-'}</strong></span>
            </div>
            <div className="info-box">{detail.data.note || 'No note'}</div>
            <div className="sale-receipt-actions">
              <button type="button" className="primary" onClick={() => editPayment(detail.data)}>Edit Payment</button>
              <button type="button" className="danger-button" onClick={() => deletePayment(detail.data)}>Delete Payment</button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  function renderSaleEditModal() {
    return (
      <Modal
        open={Boolean(saleForm)}
        title="Edit Sale"
        onClose={() => setSaleForm(null)}
        busy={saving}
        className="transaction-sale-edit-modal"
        focusFirstField={false}
        footer={saleForm && (
          <div className="transaction-sale-edit-footer">
            <div className="transaction-sale-edit-summary" aria-label="Sale totals summary">
              <span>Subtotal <strong>{money(saleEditSubtotal)}</strong></span>
              <span>Paid <strong>{money(saleEditPaidForSale)}</strong></span>
              <span className={saleEditUnpaid > 0 ? 'danger-text' : ''}>Unpaid <strong>{money(saleEditUnpaid)}</strong></span>
              {saleEditChange > 0 && <span className="gain-text">Change <strong>{money(saleEditChange)}</strong></span>}
              <span className="total">Total <strong>{money(saleEditTotal)}</strong></span>
            </div>
            <div className="transaction-sale-edit-actions"><button type="button" onClick={() => setSaleForm(null)}>Cancel</button><button type="submit" form="transaction-sale-edit-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', 'Update Sale')}</button></div>
          </div>
        )}
      >
        {saleForm && (
          <form id="transaction-sale-edit-form" className="transaction-edit-form" onSubmit={saveSaleEdit}>
            <div className="transaction-sale-basic-section">
              <Field label="Customer">
                <RemoteCombobox
                  value={saleForm.customer_id}
                  selectedOption={saleForm.customer_option}
                  loadOptions={loadCustomerOptions}
                  placeholder="No customer or search name/phone"
                  onSelect={(customer) => {
                    setSaleForm((current) => ({ ...current, customer_id: customer ? customer.id : '', customer_option: customer }));
                  }}
                />
              </Field>
              <div className="transaction-sale-payment-grid">
                <Field label="Payment Status">
                  <input value={saleEditUnpaid > 0 ? 'Credit / unpaid balance' : 'Paid'} readOnly />
                </Field>
                <Field label="Payment Method">
                  <select value={saleEditUnpaid > 0 && saleEditPaidForSale === 0 ? 'Credit' : saleForm.payment_method} disabled={saleEditUnpaid > 0 && saleEditPaidForSale === 0} onChange={(event) => setSaleForm({ ...saleForm, payment_method: event.target.value })}>
                    {[...new Set([...paymentMethods, 'Credit', 'FOC'])].map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </Field>
                <Field label="Discount">
                  <input type="number" min="0" value={saleForm.discount} onChange={(event) => setSaleForm({ ...saleForm, discount: event.target.value })} />
                </Field>
                <Field label="Paid Amount">
                  <input type="number" min="0" value={saleForm.paid_amount} onChange={(event) => setSaleForm({ ...saleForm, paid_amount: event.target.value })} placeholder="0" />
                </Field>
              </div>
              {adminPinRequired && (
                <div className="transaction-sale-admin-pin">
                  <Field label="Admin PIN">
                    <input type="password" value={saleForm.admin_pin} onChange={(event) => setSaleForm({ ...saleForm, admin_pin: event.target.value })} autoComplete="off" />
                  </Field>
                </div>
              )}
            </div>
            <div className="table-wrap sheet-table transaction-sale-edit-table-wrap">
              <table className="transaction-sale-edit-table">
                <colgroup><col className="sale-edit-product-column" /><col className="sale-edit-unit-column" /><col className="sale-edit-type-column" /><col className="sale-edit-quantity-column" /><col className="sale-edit-foc-column" /><col className="sale-edit-price-column" /><col className="sale-edit-total-column" /><col className="table-action-column" /></colgroup>
                <thead>
                  <tr className="sale-edit-add-item-heading"><th colSpan="8"><button type="button" disabled={saleForm.adding_item} onClick={() => setSaleForm((current) => ({ ...current, adding_item: true }))}><Plus size={14} /> Add new item</button></th></tr>
                  <tr className="sale-edit-column-heading"><th>Product</th><th>Unit</th><th>Type</th><th>Paid Qty</th><th>FOC Qty</th><th>Unit Price</th><th>Total</th><th></th></tr>
                </thead>
                <tbody>
                  {saleForm.adding_item && (
                    <tr className="sale-edit-new-item-row">
                      <td className="sale-edit-new-product-cell">
                        <RemoteCombobox value="" selectedOption={null} loadOptions={loadProductOptions} placeholder="Search product to add" allowClear={false} autoFocus onSelect={addSaleItem} />
                      </td>
                      <td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td><td aria-hidden="true">—</td>
                      <td><button type="button" className="icon-btn sale-edit-cancel-item mkpos-dismiss-icon" aria-label="Cancel new item" title="Cancel new item" onClick={() => setSaleForm((current) => ({ ...current, adding_item: false }))}><X size={14} /></button></td>
                    </tr>
                  )}
                  {saleForm.items.map((item, index) => (
                    <tr key={`${item.product_id}-${index}`}>
                      <td>{item.product_name}</td>
                      <td>{item.unit_name || 'Unit'}</td>
                      <td>
                        <select value={item.price_type} onChange={(event) => updateSaleItem(index, { price_type: event.target.value })}>
                          {[...new Set([item.price_type, ...priceTypes])].map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </td>
                      <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateSaleItem(index, { quantity: event.target.value })} /></td>
                      <td><input type="number" min="0" step="0.001" value={item.foc_quantity ?? ''} onChange={(event) => updateSaleItem(index, { foc_quantity: event.target.value })} /></td>
                      <td><input type="number" min="0" value={item.unit_price} onChange={(event) => updateSaleItem(index, { unit_price: event.target.value })} /></td>
                      <td>{money(normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_price, 0))}</td>
                      <td><button type="button" className="icon-btn danger sale-edit-remove-item" aria-label={`Remove ${item.product_name}`} title="Remove item" onClick={() => setSaleForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </Modal>
    );
  }

  function renderPaymentEditModal() {
    return (
      <Modal open={Boolean(paymentForm)} title={`Edit ${paymentForm?.kind === 'supplier' ? 'Supplier' : 'Customer'} Payment`} subtitle={paymentForm?.person_name || ''} onClose={() => setPaymentForm(null)} busy={saving} size="small" footer={<><button type="button" onClick={() => setPaymentForm(null)}>Cancel</button><button type="submit" form="transaction-payment-edit-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', 'Update Payment')}</button></>}>
        {paymentForm && (
          <form id="transaction-payment-edit-form" className="supplier-payment-modal-form" onSubmit={savePaymentEdit}>
            <div className="supplier-payment-modal-grid">
              <Field label="Direction"><select value={paymentForm.direction} onChange={(event) => setPaymentForm({ ...paymentForm, direction: event.target.value })}>{paymentForm.kind === 'supplier' ? <><option value="shop_to_supplier">Shop pays supplier</option><option value="supplier_to_shop">Supplier refunds shop</option></> : <><option value="customer_to_shop">Customer pays shop</option><option value="shop_to_customer">Shop pays customer</option></>}</select></Field>
              <Field label="Amount"><input type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required /></Field>
              <Field label="Payment Method"><select value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}>{paymentMethods.filter((method) => method.toLowerCase() !== 'credit').map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
              <Field label="Note"><textarea rows="3" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} /></Field>
            </div>
          </form>
        )}
      </Modal>
    );
  }

  function renderPurchaseEditModal() {
    return (
      <Modal open={Boolean(purchaseForm)} title="Edit Purchase" onClose={() => setPurchaseForm(null)} busy={saving} footer={<><button type="button" onClick={() => setPurchaseForm(null)}>Cancel</button><button type="submit" form="transaction-purchase-edit-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', 'Update Purchase')}</button></>}>
        {purchaseForm && (
          <form id="transaction-purchase-edit-form" className="transaction-edit-form" onSubmit={savePurchaseEdit}>
            <div className="purchase-form-grid">
              <Field label="Supplier">
                <RemoteCombobox
                  value={purchaseForm.supplier_id || ''}
                  selectedOption={purchaseForm.supplier_option}
                  loadOptions={loadSupplierOptions}
                  placeholder="Search supplier or type a name"
                  onQueryChange={(value) => setPurchaseForm((current) => ({
                    ...current,
                    supplier_id: null,
                    supplier_name: value,
                    supplier_option: null,
                  }))}
                  onSelect={(supplier) => setPurchaseForm((current) => ({
                    ...current,
                    supplier_id: supplier?.id || null,
                    supplier_name: supplier?.name || current.supplier_name,
                    supplier_option: supplier,
                  }))}
                />
              </Field>
              <Field label="Note">
                <input value={purchaseForm.note} onChange={(event) => setPurchaseForm({ ...purchaseForm, note: event.target.value })} />
              </Field>
              <Field label="Payment Method"><select value={purchaseForm.payment_method} onChange={(event) => setPurchaseForm({ ...purchaseForm, payment_method: event.target.value })}>{paymentMethods.filter((method) => method.toLowerCase() !== 'credit').map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
              <Field label="Paid Amount"><input type="number" min="0" value={purchaseForm.paid_amount} onChange={(event) => setPurchaseForm({ ...purchaseForm, paid_amount: event.target.value })} /></Field>
            </div>
            <div className="transaction-add-line">
              <RemoteCombobox
                value={purchaseForm.add_product_id}
                selectedOption={products.find((product) => String(product.id) === String(purchaseForm.add_product_id)) || null}
                loadOptions={loadProductOptions}
                placeholder="Search product to add"
                onSelect={(product) => {
                  if (product) setProducts((current) => current.some((item) => item.id === product.id) ? current : [...current, product]);
                  setPurchaseForm((current) => ({
                    ...current,
                    add_product_id: product ? product.id : '',
                    add_unit_name: product ? purchaseUnitOptions(product).at(-1).name : '',
                    add_unit_cost: product ? Math.round(Number(product.cost || 0) * purchaseUnitOptions(product).at(-1).factor) : 0,
                  }));
                }}
              />
              <select
                value={purchaseForm.add_unit_name}
                disabled={!purchaseForm.add_product_id}
                onChange={(event) => {
                  const product = products.find((item) => String(item.id) === String(purchaseForm.add_product_id));
                  const unit = purchaseUnitFor(product, event.target.value);
                  setPurchaseForm({ ...purchaseForm, add_unit_name: unit.name, add_unit_cost: Math.round(Number(product?.cost || 0) * unit.factor) });
                }}
              >
                {!purchaseForm.add_product_id && <option value="">Unit</option>}
                {purchaseForm.add_product_id && purchaseUnitOptions(products.find((item) => String(item.id) === String(purchaseForm.add_product_id))).map((unit) => (
                  <option key={unit.name} value={unit.name}>{unit.name}{unit.factor > 1 ? ` (×${unit.factor} ${baseUnitName(products.find((item) => String(item.id) === String(purchaseForm.add_product_id)))})` : ''}</option>
                ))}
              </select>
              <input type="number" min="0.001" step="0.001" value={purchaseForm.add_quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, add_quantity: event.target.value })} />
              <input type="number" min="0" step="0.001" title="FOC quantity" value={purchaseForm.add_foc_quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, add_foc_quantity: event.target.value })} />
              <input type="number" min="0" value={purchaseForm.add_unit_cost} onChange={(event) => setPurchaseForm({ ...purchaseForm, add_unit_cost: event.target.value })} />
              <button type="button" onClick={addPurchaseItem}>Add Item</button>
            </div>
            <div className="table-wrap sheet-table">
              <table>
                <thead><tr><th>Product</th><th>Unit</th><th>Paid Qty</th><th>FOC Qty</th><th>Unit Cost</th><th>Effective Base Cost</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {purchaseForm.items.map((item, index) => (
                    <tr key={`${item.product_id}-${index}`}>
                      <td>{item.product_name}</td>
                      <td>{item.unit_name}</td>
                      <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updatePurchaseItem(index, { quantity: event.target.value })} /></td>
                      <td><input type="number" min="0" step="0.001" value={item.foc_quantity || 0} onChange={(event) => updatePurchaseItem(index, { foc_quantity: event.target.value })} /></td>
                      <td><input type="number" min="0" value={item.unit_cost} onChange={(event) => updatePurchaseItem(index, { unit_cost: event.target.value })} /></td>
                      <td>{money(
                        normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_cost, 0)
                        / Math.max((normalizeNumber(item.quantity, 0) + normalizeNumber(item.foc_quantity, 0)) * normalizeNumber(item.conversion_factor, 1), 0.001)
                      )}</td>
                      <td>{money(normalizeNumber(item.quantity, 0) * normalizeNumber(item.unit_cost, 0))}</td>
                      <td><button type="button" className="danger-button" aria-label={`Remove ${item.product_name}`} title="Remove item" onClick={() => setPurchaseForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </Modal>
    );
  }

  return (
    <>
      <section className="screen transactions-layout mkpos-sheet">
        <div className="panel transaction-main-panel">
          <div className="transaction-page-toolbar">
            {!salesOnly && <div className="transaction-tabs">
              {[
                ['payments', 'Customer Payments', HandCoins],
                ['supplierPayments', 'Supplier Payments', HandCoins],
              ].map(([tab, label, Icon]) => (
                <button key={tab} type="button" className={activeTab === tab ? 'selected' : ''} onClick={() => switchTab(tab)}>
                  <Icon size={16} />
                  <span>{label}</span>
                  {totals[tab] > 0 && <small>{totals[tab]}</small>}
                </button>
              ))}
            </div>}
            <AppBarActions className="transaction-toolbar-actions">
              <button type="button" className="filter-drawer-trigger" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}>
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
              <CsvExportButton onExport={exportActiveTransactions} onError={setError} onSuccess={setMessage} />
            </AppBarActions>
            <AppBarSearch><form onSubmit={applyFilters}><label><Search size={16} /><input value={filters.q} onChange={(event) => patchActiveFilters({ q: event.target.value })} placeholder={salesOnly ? 'Search receipt, customer, type, or method' : 'Search party, method, or note'} aria-label={salesOnly ? 'Search sales' : 'Search transactions'} /></label></form></AppBarSearch>
          </div>

          <FilterDrawer open={filterOpen} title="Transaction filters" onClose={() => setFilterOpen(false)} busy={loading} className="transaction-filter-drawer">
          <form className="drawer-filter-form transaction-filter" ref={filterFormRef} onSubmit={applyFilters}>
            <div className="purchase-quick-ranges">
              {[
                ['today', 'Today'],
                ['week', 'This Week'],
                ['month', 'This Month'],
                ['year', 'This Year'],
                ['all', 'All Time'],
              ].map(([preset, label]) => (
                <button key={preset} type="button" className={filters.preset === preset ? 'selected' : ''} onClick={() => setPreset(preset)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="transaction-filter-grid">
              <Field label="From">
                <input name="start" type="date" value={filters.start} onChange={(event) => patchActiveFilters({ preset: 'custom', start: event.target.value })} />
              </Field>
              <Field label="To">
                <input name="end" type="date" value={filters.end} onChange={(event) => patchActiveFilters({ preset: 'custom', end: event.target.value })} />
              </Field>
              {salesOnly && activeTab === 'sales' && (
                <>
                  <Field label="Sale channel">
                    <select name="sale_channel" value={filters.sale_channel} onChange={(event) => patchActiveFilters({ sale_channel: event.target.value })}>
                      <option value="all">All sales</option>
                      <option value="online">Online sales</option>
                      <option value="pos">POS sales</option>
                    </select>
                  </Field>
                  <Field label="Type">
                    <select name="payment_type" value={filters.payment_type} onChange={(event) => patchActiveFilters({ payment_type: event.target.value })}>
                      <option value="all">All</option>
                      <option value="cash">Paid</option>
                      <option value="credit">Credit</option>
                    </select>
                  </Field>
                  <Field label="Method">
                    <select name="payment_method" value={filters.payment_method} onChange={(event) => patchActiveFilters({ payment_method: event.target.value })}>
                      <option value="">All methods</option>
                      {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </Field>
                </>
              )}
              {['payments', 'supplierPayments'].includes(activeTab) && (
                <>
                  <Field label="Direction">
                    <select name="direction" value={filters.direction} onChange={(event) => patchActiveFilters({ direction: event.target.value })}>
                      <option value="all">All</option>
                      {activeTab === 'supplierPayments' ? <><option value="shop_to_supplier">Shop pays supplier</option><option value="supplier_to_shop">Supplier refunds shop</option></> : <><option value="customer_to_shop">Customer pays shop</option><option value="shop_to_customer">Shop pays customer</option></>}
                    </select>
                  </Field>
                  <Field label="Method">
                    <select name="payment_method" value={filters.payment_method} onChange={(event) => patchActiveFilters({ payment_method: event.target.value })}>
                      <option value="">All methods</option>
                      {paymentMethods.filter((method) => method.toLowerCase() !== 'credit').map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            <div className="drawer-filter-actions transaction-filter-actions">
              <button type="button" onClick={clearFilters} disabled={loading}>Clear</button>
              <button type="submit" className="primary" disabled={loading}>Apply Filter</button>
            </div>
          </form>
          </FilterDrawer>


          <div className="transaction-table-card">
            <div className="transaction-table-wrap">
              {loading && <TableLoadingState>Loading transactions…</TableLoadingState>}
              {activeTab === 'sales' && (
                <table className="transaction-table transaction-table-sales">
                  <colgroup><col span="8" /><col className="table-action-column" /></colgroup>
                  <thead>
                    <tr>
                      <th>Date</th><th>Receipt</th><th>Customer</th><th>Type</th><th>Method</th><th>Total</th><th>Paid</th><th>Credit</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((sale) => (
                      <tr key={sale.id}>
                        <td>{rowDate(sale)}</td>
                        <td><strong className="transaction-reference">{sale.receipt_no}</strong>{sale.source === 'ecommerce' && <span className="transaction-type-badge transaction-online-badge">Online</span>}</td>
                        <td>{sale.customer_name || '-'}</td>
                        <td><span className={`transaction-type-badge ${sale.payment_type === 'credit' ? 'credit' : 'paid'}`}>{sale.payment_type === 'credit' ? 'Credit' : 'Paid'}</span></td>
                        <td><span className="transaction-method-badge">{sale.payment_method}</span></td>
                        <td className="transaction-money-cell">{money(sale.total)}</td>
                        <td className="transaction-money-cell transaction-paid-cell">{money(sale.paid_amount)}</td>
                        <td className={`transaction-money-cell ${Number(sale.credit_amount || 0) > 0 ? 'transaction-credit-cell' : ''}`}>{money(sale.credit_amount)}</td>
                        <td>
                          <RowActions label={`sale ${sale.receipt_no}`}>
                            <button type="button" onClick={() => openSaleDetail(sale.id)}><Eye size={15} /> View</button>
                            <button type="button" aria-label={`Print receipt ${sale.receipt_no}`} title="Print receipt" onClick={() => reprintSale(sale.id)}><Printer size={15} /> Print receipt</button>
                            {sale.source !== 'ecommerce' && <button type="button" aria-label={`Edit sale ${sale.receipt_no}`} title="Edit sale" onClick={() => editSale(sale.id)}><Edit size={15} /> Edit</button>}
                            <button type="button" className="danger-button" aria-label={`Delete sale ${sale.receipt_no}`} title="Delete sale" disabled={deletingId === sale.id} onClick={() => deleteSale(sale)}><Trash2 size={15} /> Delete</button>
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'payments' && (
                <table className="transaction-table transaction-table-payments">
                  <colgroup><col span="6" /><col className="table-action-column" /></colgroup>
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>Direction</th><th>Method</th><th>Amount</th><th>Note</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((payment) => (
                      <tr key={payment.id}>
                        <td>{rowDate(payment)}</td>
                        <td><strong className="transaction-reference">{payment.customer_name}</strong></td>
                        <td><span className={`transaction-direction-badge ${payment.direction === 'shop_to_customer' ? 'outgoing' : 'incoming'}`}>{payment.direction === 'shop_to_customer' ? 'Shop pays customer' : 'Customer pays shop'}</span></td>
                        <td><span className="transaction-method-badge">{payment.payment_method || 'Cash'}</span></td>
                        <td className="transaction-money-cell">{money(payment.amount)}</td>
                        <td>{payment.note || '-'}</td>
                        <td>
                          <RowActions label={`payment ${payment.id}`}>
                            <button type="button" onClick={() => openPaymentDetail(payment)}><Eye size={15} /> View</button>
                            <button type="button" aria-label={`Edit payment ${payment.id}`} title="Edit payment" onClick={() => editPayment(payment)}><Edit size={15} /> Edit</button>
                            <button type="button" className="danger-button" aria-label={`Delete payment ${payment.id}`} title="Delete payment" disabled={deletingId === payment.id} onClick={() => deletePayment(payment)}><Trash2 size={15} /> Delete</button>
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'supplierPayments' && (
                <table className="transaction-table transaction-table-payments">
                  <colgroup><col span="6" /><col className="table-action-column" /></colgroup>
                  <thead><tr><th>Date</th><th>Supplier</th><th>Direction</th><th>Method</th><th>Amount</th><th>Note</th><th>Actions</th></tr></thead>
                  <tbody>{displayedRows.map((payment) => (
                    <tr key={payment.id}>
                      <td>{rowDate(payment)}</td><td><strong className="transaction-reference">{payment.supplier_name}</strong></td>
                      <td><span className={`transaction-direction-badge ${payment.direction === 'shop_to_supplier' ? 'outgoing' : 'incoming'}`}>{payment.direction === 'supplier_to_shop' ? 'Supplier refunds shop' : 'Shop pays supplier'}</span></td>
                      <td><span className="transaction-method-badge">{payment.payment_method || 'Cash'}</span></td><td className="transaction-money-cell">{money(payment.amount)}</td><td>{payment.note || '-'}</td>
                      <td><RowActions label={`supplier payment ${payment.id}`}><button type="button" onClick={() => openPaymentDetail(payment)}><Eye size={15} /> View</button><button type="button" aria-label={`Edit supplier payment ${payment.id}`} title="Edit payment" onClick={() => editPayment(payment)}><Edit size={15} /> Edit</button><button type="button" className="danger-button" aria-label={`Delete supplier payment ${payment.id}`} title="Delete payment" disabled={deletingId === payment.id} onClick={() => deletePayment(payment)}><Trash2 size={15} /> Delete</button></RowActions></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}

              {!displayedRows.length && !loading && (
                <EmptyState>
                  <span className="transaction-empty-icon"><ReceiptText size={24} /></span>
                  <strong>No transactions found</strong>
                  <span>{salesOnly ? 'Change the sales filters and try again.' : 'Change the filters or select a different payment tab.'}</span>
                </EmptyState>
              )}
            </div>
            <TablePagination className="transaction-table-footer" page={pages[activeTab] || 1} pageSize={TABLE_PAGE_SIZE} total={totals[activeTab] || 0} loading={loading} onPageChange={(nextPage) => loadTab(activeTab, filters, { page: nextPage })} />
          </div>
        </div>
      </section>

      {renderDetailModal()}
      {renderSaleEditModal()}
      {renderPaymentEditModal()}
      {renderPurchaseEditModal()}
    </>
  );
}
