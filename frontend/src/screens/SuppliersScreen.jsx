import { useAiPageLink, returnFromAiPage } from '../ai/useAiPageLink';
import { RetainedViews } from '../components/RetainedViews';
import { usePageNavigation } from '../usePageNavigation';
import React, { useEffect, useState } from 'react';
import { CreditCard, Edit, Eye, Filter, HandCoins, Plus, ReceiptText, RotateCcw, Search, ShoppingCart, Trash2, Users, WalletCards } from 'lucide-react';
import { RowActions } from '../components/RowActions';
import { request } from '../api';
import { actionLabel, money, normalizeNumber } from '../utils';
import { EmptyState, Field, FilterDrawer, LoadingState, Modal, TableLoadingState, TablePagination } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useConfirmation } from '../components/confirmations';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { expandPurchaseLineItems, PURCHASE_LINE_COLUMNS } from '../purchaseCsv';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { TABLE_PAGE_SIZE } from '../tablePagination';
import { PurchaseHistoryTable } from '../components/PurchaseHistoryTable';
import { PurchaseDetailModal } from '../components/PurchaseDetailModal';
import { SupplierProfileCard } from '../components/SupplierProfileCard';
import { NewPurchaseScreen } from './NewPurchaseScreen';
import { SupplierPaymentsPage } from './SupplierPaymentsPage';

export function blankSupplierForm() {
  return {
    name: '',
    phone: '',
    address: '',
    contact_person: '',
    note: '',
  };
}
function blankSupplierHistoryFilters() {
  return {
    q: '',
    date_from: '',
    date_to: '',
  };
}

function blankSupplierListFilters() {
  return { account_status: 'all', purchase_activity: 'all' };
}

function blankSupplierPaymentForm() {
  return { direction: 'shop_to_supplier', amount: '', payment_method: 'Cash', note: '' };
}

function SupplierRowActions({ supplier, deleting, onView, onEdit, onRecordPayment, onPayment, onDelete }) {
  return <RowActions label={supplier.name}>
    <button type="button" onClick={() => onView(supplier)}><Eye size={15} /> View supplier</button>
    <button type="button" onClick={() => onEdit(supplier)}><Edit size={15} /> Edit supplier</button>
    <button type="button" onClick={() => onRecordPayment(supplier)}><Plus size={15} /> Record payment</button>
    <button type="button" onClick={() => onPayment(supplier)}><HandCoins size={15} /> Payments</button>
    <button type="button" className="danger-button" disabled={deleting} onClick={() => onDelete(supplier)}><Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete supplier'}</button>
  </RowActions>;
}

export function SuppliersScreen({ onDetailChange }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [supplierFilters, setSupplierFilters] = useState(blankSupplierListFilters());
  const [supplierFilterDraft, setSupplierFilterDraft] = useState(blankSupplierListFilters());
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);
  const [supplierSummary, setSupplierSummary] = useState({ total_suppliers: 0, payable_total: 0, credit_total: 0, open_accounts: 0 });
  const [supplierPage, setSupplierPage] = useState(1);
  const supplierPageSize = TABLE_PAGE_SIZE;
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [form, setForm] = useState(blankSupplierForm());
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierHistoryFilters, setSupplierHistoryFilters] = useState(blankSupplierHistoryFilters());
  const [detailFilterOpen, setDetailFilterOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [detailPageOpen, setDetailPageOpen] = useState(false);
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPageOpen, setPaymentPageOpen] = useState(false);
  const [paymentPageSupplier, setPaymentPageSupplier] = useState(null);
  const [paymentPageOrigin, setPaymentPageOrigin] = useState('list');
  const [paymentRecordOpen, setPaymentRecordOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(blankSupplierPaymentForm());
  const [loading, setLoading] = useState(true);
  const loadSequence = React.useRef(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [purchaseEditor, setPurchaseEditor] = useState({ open: false, purchaseId: null, requestKey: 0 });
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();

  const supplierTotalPages = Math.max(1, Math.ceil(supplierTotal / supplierPageSize));
  const visibleSuppliers = suppliers;
  const purchaseHistoryTotal = selectedSupplier?.purchase_history?.filtered_count ?? selectedSupplier?.purchase_count ?? 0;
  const purchaseHistoryPageSize = TABLE_PAGE_SIZE;
  const paymentPageSize = TABLE_PAGE_SIZE;
  const paymentTotalPages = Math.max(1, Math.ceil(paymentTotal / paymentPageSize));
  const supplierHistoryFilterCount = [
    supplierHistoryFilters.date_from,
    supplierHistoryFilters.date_to,
  ].filter(Boolean).length;
  const supplierListFilterCount = Object.values(supplierFilters).filter((value) => value && value !== 'all').length;

  function exportSuppliers() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (supplierFilters.account_status !== 'all') params.set('account_status', supplierFilters.account_status);
    if (supplierFilters.purchase_activity !== 'all') params.set('purchase_activity', supplierFilters.purchase_activity);
    const query = params.toString();
    return exportFilteredCsv({
      path: `/suppliers${query ? `?${query}` : ''}`,
      filename: csvFilename('suppliers'),
      columns: [
        { label: 'Name', value: (row) => row.name }, { label: 'Phone', value: (row) => row.phone || '' },
        { label: 'Contact Person', value: (row) => row.contact_person || '' }, { label: 'Address', value: (row) => row.address || '' },
        { label: 'Purchases', value: (row) => row.purchase_count || 0 }, { label: 'Balance', value: (row) => row.balance || 0 },
        { label: 'Last Purchase', value: (row) => row.last_purchase || '' }, { label: 'Note', value: (row) => row.note || '' },
      ],
    });
  }

  async function loadAllSupplierPurchases() {
    const rows = [];
    let offset = 0;
    let total = 0;
    do {
      const params = new URLSearchParams({ limit: '100', offset: String(offset) });
      if (supplierHistoryFilters.q.trim()) params.set('purchase_q', supplierHistoryFilters.q.trim());
      if (supplierHistoryFilters.date_from) params.set('date_from', supplierHistoryFilters.date_from);
      if (supplierHistoryFilters.date_to) params.set('date_to', supplierHistoryFilters.date_to);
      const payload = await request(`/suppliers/${selectedSupplier.id}?${params.toString()}`);
      const pageRows = payload.purchases || [];
      rows.push(...pageRows);
      total = Number(payload.total || 0);
      offset += pageRows.length;
      if (!pageRows.length) break;
    } while (rows.length < total);
    return rows;
  }

  function exportSupplierPurchases() {
    return exportFilteredCsv({
      loadRows: async () => expandPurchaseLineItems(await loadAllSupplierPurchases()),
      filename: csvFilename(`supplier-${selectedSupplier.id}-purchases`),
      columns: PURCHASE_LINE_COLUMNS,
    });
  }

  function exportSupplierPayments() {
    return exportFilteredCsv({
      path: `/supplier-payments?supplier_id=${selectedSupplier.id}&status=completed`,
      filename: csvFilename(`supplier-${selectedSupplier.id}-payments`),
      columns: [
        { label: 'Date', value: (row) => row.created_at },
        { label: 'Direction', value: (row) => row.direction === 'supplier_to_shop' ? 'Supplier refunds shop' : 'Shop pays supplier' },
        { label: 'Method', value: (row) => row.payment_method || 'Cash' }, { label: 'Amount', value: (row) => row.amount },
        { label: 'Note', value: (row) => row.note || '' },
      ],
    });
  }

  useEffect(() => {
    if (supplierPage > supplierTotalPages) setSupplierPage(supplierTotalPages);
  }, [supplierPage, supplierTotalPages]);

  const loadSuppliers = (nextPage = supplierPage, nextSearch = search, nextFilters = supplierFilters) => {
    const sequence = ++loadSequence.current;
    const params = new URLSearchParams();
    params.set('with_total', 'true');
    params.set('limit', String(supplierPageSize));
    params.set('offset', String((nextPage - 1) * supplierPageSize));
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    if (nextFilters.account_status !== 'all') params.set('account_status', nextFilters.account_status);
    if (nextFilters.purchase_activity !== 'all') params.set('purchase_activity', nextFilters.purchase_activity);
    setLoading(true);
    return request(`/suppliers?${params.toString()}`)
      .then((data) => {
        if (sequence !== loadSequence.current) return;
        setSuppliers(data.items || []);
        setSupplierTotal(data.total || 0);
        setSupplierSummary(data.account_summary || { total_suppliers: 0, payable_total: 0, credit_total: 0, open_accounts: 0 });
        setError('');
      })
      .catch((err) => {
        if (sequence === loadSequence.current) setError(`Cannot load suppliers. ${err.message}`);
      })
      .finally(() => {
        if (sequence === loadSequence.current) setLoading(false);
      });
  };

  useLatestEffect(() => {
    const timer = window.setTimeout(() => loadSuppliers(supplierPage, search, supplierFilters), 220);
    return () => window.clearTimeout(timer);
  }, [supplierPage, search, supplierFilters]);

  useEffect(() => {
    setSupplierPage(1);
  }, [search, supplierFilters]);

  useDataRefresh(['suppliers', 'purchases', 'supplierPayments'], 'suppliers', () => {
    const refreshes = [loadSuppliers(supplierPage, search)];
    if ((detailPageOpen || paymentPageOpen) && selectedSupplier?.id) {
      refreshes.push(
        viewSupplier(selectedSupplier.id, supplierHistoryFilters, {
          offset: (purchaseHistoryPage - 1) * TABLE_PAGE_SIZE,
        }),
        loadSupplierPayments(selectedSupplier.id, paymentPage),
      );
    }
    return Promise.all(refreshes);
  });

  function resetSupplierForm() {
    setForm(blankSupplierForm());
    setEditingId(null);
  }

  useAiPageLink('suppliers', target => { if (target.action === 'new' && !supplierFormOpen) openSupplierForm(); }, !loading);

  function openSupplierForm() {
    resetSupplierForm();
    setSupplierFormOpen(true);
  }

  function closeSupplierForm() {
    setSupplierFormOpen(false);
    resetSupplierForm();
    returnFromAiPage('suppliers_new');
  }

  function editSupplier(supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      contact_person: supplier.contact_person || '',
      note: supplier.note || '',
    });
    setSupplierFormOpen(true);
  }

  async function saveSupplier(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    const payload = {
      name: String(form.name || '').trim(),
      phone: String(form.phone || '').trim(),
      address: String(form.address || '').trim(),
      contact_person: String(form.contact_person || '').trim(),
      note: String(form.note || '').trim(),
    };
    if (!payload.name) {
      setError('Supplier name is required.');
      return;
    }

    try {
      setSaving(true);
      const supplier = await request(editingId ? `/suppliers/${editingId}` : '/suppliers', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setSuppliers((current) => {
        const exists = current.some((item) => item.id === supplier.id);
        const next = exists
          ? current.map((item) => (item.id === supplier.id ? supplier : item))
          : [...current, supplier];
        return next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      });
      setMessage(editingId ? 'Supplier updated.' : 'Supplier added.');
      if (selectedSupplier?.id === supplier.id) {
        setSelectedSupplier((current) => ({ ...current, ...supplier }));
      }
      resetSupplierForm();
      setSupplierFormOpen(false);
      await loadSuppliers(supplierPage, search);
      emitDataChange(['suppliers'], 'suppliers');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewSupplier(supplierId, filters = supplierHistoryFilters, options = {}) {
    setError('');
    const offset = options.offset || 0;
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set('purchase_q', filters.q.trim());
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    params.set('limit', String(TABLE_PAGE_SIZE));
    params.set('offset', String(offset));
    const query = params.toString();
    try {
      setDetailLoading(true);
      const payload = await request(`/suppliers/${supplierId}${query ? `?${query}` : ''}`);
      const supplier = {
        ...(payload.supplier || payload),
        ...(payload.summary || {}),
        purchases: payload.purchases || [],
        payments: payload.payments || [],
        purchase_history: {
          filtered_count: payload.filtered_stats?.purchase_count ?? payload.total ?? 0,
          filtered_total: payload.filtered_stats?.total_purchase ?? 0,
          returned_count: (payload.purchases || []).length,
        },
      };
      setSelectedSupplier(supplier);
      setPaymentPageSupplier((current) => current?.id === supplier.id ? { ...current, ...supplier } : current);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadSupplierPayments(supplierId, nextPage = paymentPage) {
    const page = Math.max(1, nextPage);
    const params = new URLSearchParams({
      supplier_id: String(supplierId),
      status: 'completed',
      with_total: 'true',
      limit: String(paymentPageSize),
      offset: String((page - 1) * paymentPageSize),
    });
    setPaymentLoading(true);
    try {
      const payload = await request(`/supplier-payments?${params.toString()}`);
      setPaymentRecords(payload.items || []);
      setPaymentTotal(payload.total || 0);
      setPaymentPage(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  }

  const backFields = [[detailPageOpen, setDetailPageOpen], [paymentPageOpen, setPaymentPageOpen], [selectedSupplier, setSelectedSupplier], [supplierHistoryFilters, setSupplierHistoryFilters], [purchaseHistoryPage, setPurchaseHistoryPage], [paymentPageSupplier, setPaymentPageSupplier], [paymentPageOrigin, setPaymentPageOrigin], [paymentRecords, setPaymentRecords], [paymentPage, setPaymentPage], [paymentTotal, setPaymentTotal]];
  const navigation = usePageNavigation('pos-suppliers', { kind: 'list' }, () => location.href, {
    module: 'suppliers',
    resumeHistory: false,
    capture: () => backFields.map(([value]) => value),
    restore: (next, snapshot) => {
      if (snapshot) {
        const restored = [...snapshot];
        if (restored[2]?.id === selectedSupplier?.id && selectedSupplier) {
          restored[2] = restored[4] === purchaseHistoryPage && JSON.stringify(restored[3]) === JSON.stringify(supplierHistoryFilters)
            ? selectedSupplier : { ...selectedSupplier, purchases: restored[2].purchases, purchase_history: restored[2].purchase_history };
        }
        backFields.forEach(([, setter], index) => setter(restored[index]));
      }
      else { setDetailPageOpen(false); setPaymentPageOpen(false); }
      setPaymentRecordOpen(false); setDetailFilterOpen(false); setViewPurchase(null);
      setPurchaseEditor((current) => ({ ...current, open: false }));
      onDetailChange?.(next.kind === 'payments' ? { label: next.origin === 'detail' ? 'Back to supplier' : 'Back to Suppliers', onClick: () => navigation.back({ kind: 'list' }) } : next.kind === 'detail' ? { label: 'Back to Suppliers', onClick: () => navigation.back({ kind: 'list' }) } : null);
    },
  });

  function openSupplierDetail(supplier) {
    navigation.go({ kind: 'detail', id: supplier.id });
    const filters = blankSupplierHistoryFilters();
    setSelectedSupplier(supplier);
    setSupplierHistoryFilters(filters);
    setPaymentForm(blankSupplierPaymentForm());
    setPurchaseHistoryPage(1);
    setPaymentRecords([]);
    setPaymentPage(1);
    setPaymentTotal(0);
    setPaymentPageOpen(false);
    setPaymentPageSupplier(null);
    setPaymentRecordOpen(false);
    setDetailFilterOpen(false);
    setDetailPageOpen(true);
    onDetailChange?.({ label: 'Back to Suppliers', onClick: closeSupplierDetail });
    viewSupplier(supplier.id, filters);
    loadSupplierPayments(supplier.id, 1);
  }

  function closeSupplierDetail() { navigation.back({ kind: 'list' }); }

  function openSupplierPaymentsPage(supplier, origin = 'list') {
    navigation.go({ kind: 'payments', id: supplier.id, origin });
    setSelectedSupplier(supplier);
    setPaymentPageSupplier(supplier);
    setPaymentPageOrigin(origin);
    setPaymentForm(blankSupplierPaymentForm());
    setPaymentRecords([]);
    setPaymentPage(1);
    setPaymentTotal(0);
    setPaymentRecordOpen(false);
    setEditingPaymentId(null);
    setPaymentPageOpen(true);
    setDetailFilterOpen(false);
    loadSupplierPayments(supplier.id, 1);
    onDetailChange?.({
      label: origin === 'detail' ? `Back to ${supplier.name}` : 'Back to Suppliers',
      onClick: () => closeSupplierPaymentsPage(origin),
    });
  }

  function closeSupplierPaymentsPage() { navigation.back({ kind: 'list' }); }

  function openNewSupplierPayment(supplier = null) {
    if (supplier?.id) {
      setSelectedSupplier(supplier);
      setPaymentPageSupplier(supplier);
    }
    setEditingPaymentId(null);
    setPaymentForm(blankSupplierPaymentForm());
    setPaymentRecordOpen(true);
  }

  function editSupplierPayment(payment) {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      direction: payment.direction || 'shop_to_supplier',
      amount: payment.amount ?? '',
      payment_method: payment.payment_method || 'Cash',
      note: payment.note || '',
    });
    setPaymentRecordOpen(true);
  }

  function closeSupplierPaymentForm() {
    if (saving) return;
    setPaymentRecordOpen(false);
    setEditingPaymentId(null);
    setPaymentForm(blankSupplierPaymentForm());
    if (!paymentPageOpen && !detailPageOpen) {
      setSelectedSupplier(null);
      setPaymentPageSupplier(null);
    }
  }

  async function saveSupplierPayment(event) {
    event.preventDefault();
    const amount = Math.round(normalizeNumber(paymentForm.amount, 0));
    if (!paymentPageSupplier?.id || amount <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const editing = Boolean(editingPaymentId);
      const directFromList = !paymentPageOpen && !detailPageOpen;
      const supplierId = paymentPageSupplier.id;
      await request(editing ? `/supplier-payments/${editingPaymentId}` : `/suppliers/${paymentPageSupplier.id}/payments`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...(editing ? { supplier_id: paymentPageSupplier.id } : {}),
          ...paymentForm,
          amount,
        }),
      });
      const nextPage = editing ? paymentPage : 1;
      setPaymentPage(nextPage);
      setPaymentRecordOpen(false);
      setEditingPaymentId(null);
      setPaymentForm(blankSupplierPaymentForm());
      const refreshes = [loadSuppliers(supplierPage, search)];
      if (!directFromList) {
        refreshes.push(viewSupplier(supplierId, supplierHistoryFilters, {
          offset: (purchaseHistoryPage - 1) * TABLE_PAGE_SIZE,
        }));
      }
      if (paymentPageOpen) refreshes.push(loadSupplierPayments(supplierId, nextPage));
      await Promise.all(refreshes);
      if (directFromList) {
        setSelectedSupplier(null);
        setPaymentPageSupplier(null);
      }
      setMessage(editing ? 'Supplier payment updated.' : (paymentForm.direction === 'supplier_to_shop' ? 'Supplier refund recorded.' : 'Supplier payment recorded.'));
      emitDataChange(['supplierPayments', 'suppliers', 'transactions', 'reports'], 'suppliers');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSupplierPayment(payment) {
    const { confirmed } = await confirmAction({
      title: 'Delete supplier payment',
      message: `Delete ${money(payment.amount)} payment record? The supplier balance will be recalculated.`,
      confirmLabel: 'Delete Payment',
    });
    if (!confirmed || !paymentPageSupplier?.id) return;
    const nextPage = paymentRecords.length === 1 && paymentPage > 1 ? paymentPage - 1 : paymentPage;
    setDeletingPaymentId(payment.id);
    setError('');
    try {
      await request(`/supplier-payments/${payment.id}`, { method: 'DELETE' });
      await Promise.all([
        viewSupplier(paymentPageSupplier.id, supplierHistoryFilters, {
          offset: (purchaseHistoryPage - 1) * TABLE_PAGE_SIZE,
        }),
        loadSupplierPayments(paymentPageSupplier.id, nextPage),
        loadSuppliers(supplierPage, search),
      ]);
      setMessage('Supplier payment deleted.');
      emitDataChange(['supplierPayments', 'suppliers', 'transactions', 'reports'], 'suppliers');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingPaymentId(null);
    }
  }

  function changePurchaseHistoryPage(nextPage) {
    if (!selectedSupplier?.id) return;
    const pageSize = TABLE_PAGE_SIZE;
    const total = selectedSupplier.purchase_history?.filtered_count || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.max(1, Math.min(nextPage, totalPages));
    setPurchaseHistoryPage(page);
    viewSupplier(selectedSupplier.id, supplierHistoryFilters, {
      offset: (page - 1) * pageSize,
    });
  }

  function changePaymentPage(nextPage) {
    if (!selectedSupplier?.id) return;
    const page = Math.max(1, Math.min(nextPage, paymentTotalPages));
    loadSupplierPayments(selectedSupplier.id, page);
  }

  function applySupplierHistoryFilters(event) {
    event.preventDefault();
    setPurchaseHistoryPage(1);
    setDetailFilterOpen(false);
    if (selectedSupplier?.id) viewSupplier(selectedSupplier.id, supplierHistoryFilters, { offset: 0 });
  }

  function clearSupplierHistoryFilters() {
    const next = { ...supplierHistoryFilters, date_from: '', date_to: '' };
    setSupplierHistoryFilters(next);
    setPurchaseHistoryPage(1);
    setDetailFilterOpen(false);
    if (selectedSupplier?.id) viewSupplier(selectedSupplier.id, next, { offset: 0 });
  }

  async function viewPurchaseDetail(purchaseId) {
    setError('');
    try {
      setViewPurchase(await request(`/purchases/${purchaseId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  function openPurchaseEditor(purchaseId) {
    setPurchaseEditor((current) => ({ open: true, purchaseId, requestKey: current.requestKey + 1 }));
  }

  function closePurchaseEditor() {
    setPurchaseEditor((current) => ({ ...current, open: false }));
    if (!selectedSupplier?.id) return;
    viewSupplier(selectedSupplier.id, supplierHistoryFilters, {
      offset: (purchaseHistoryPage - 1) * TABLE_PAGE_SIZE,
    });
    loadSuppliers(supplierPage, search);
  }

  async function deletePurchase(purchase) {
    const { confirmed, pin: adminPin } = await confirmAction({
      title: 'Delete purchase',
      message: `Delete purchase from "${selectedSupplier?.name || purchase.supplier_name || 'Unknown supplier'}"? Its stock changes will be reversed and the purchase will be removed from history.`,
      confirmLabel: 'Delete Purchase',
      requirePin: true,
    });
    if (!confirmed) return;
    setError('');
    setMessage('');
    try {
      setDeletingPurchaseId(purchase.id);
      await request(`/purchases/${purchase.id}`, {
        method: 'DELETE',
        ...(adminPin ? { body: JSON.stringify({ admin_pin: adminPin }) } : {}),
      });
      setMessage('Purchase deleted.');
      await Promise.all([
        viewSupplier(selectedSupplier.id, supplierHistoryFilters, {
          offset: (purchaseHistoryPage - 1) * TABLE_PAGE_SIZE,
        }),
        loadSuppliers(supplierPage, search),
      ]);
      emitDataChange(['purchases', 'products', 'suppliers', 'reports'], 'suppliers');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingPurchaseId(null);
    }
  }

  async function deleteSupplier(supplier) {
    const { confirmed } = await confirmAction({
      title: 'Delete supplier',
      message: `Delete supplier "${supplier.name}"? Existing purchase history will remain linked.`,
      confirmLabel: 'Delete Supplier',
    });
    if (!confirmed) return;
    setError('');
    setMessage('');
    try {
      setDeletingId(supplier.id);
      await request(`/suppliers/${supplier.id}`, { method: 'DELETE' });
      setSuppliers((current) => current.filter((item) => item.id !== supplier.id));
      if (selectedSupplier?.id === supplier.id) closeSupplierDetail();
      setMessage('Supplier deleted.');
      await loadSuppliers(supplierPage, search);
      emitDataChange(['suppliers'], 'suppliers');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function openSupplierFilters() {
    setSupplierFilterDraft(supplierFilters);
    setSupplierFilterOpen(true);
  }

  function applySupplierFilters(event) {
    event.preventDefault();
    setSupplierPage(1);
    setSupplierFilters(supplierFilterDraft);
    setSupplierFilterOpen(false);
  }

  function clearSupplierFilters() {
    const next = blankSupplierListFilters();
    setSupplierFilterDraft(next);
    setSupplierFilters(next);
    setSupplierPage(1);
    setSupplierFilterOpen(false);
  }

  return (
    <RetainedViews activeKey={navigation.view.kind === 'list' ? 'list' : `${navigation.view.kind}:${navigation.view.id}`}>
    <>
      {!detailPageOpen && !paymentPageOpen && <section className="screen suppliers-layout mkpos-sheet">
        <div className="panel supplier-main-panel">
          <div className="product-stat-row supplier-index-stat-row" aria-label="Supplier account statistics">
            <article className="product-stat-card"><span className="product-stat-icon"><Users size={20} /></span><div><span>Total Suppliers</span><strong>{supplierSummary.total_suppliers}</strong></div></article>
            <article className="product-stat-card warning"><span className="product-stat-icon"><WalletCards size={20} /></span><div><span>Supplier Payable</span><strong>{money(supplierSummary.payable_total)}</strong></div></article>
            <article className="product-stat-card"><span className="product-stat-icon"><CreditCard size={20} /></span><div><span>Supplier Credit</span><strong>{money(supplierSummary.credit_total)}</strong></div></article>
            <article className="product-stat-card"><span className="product-stat-icon"><ReceiptText size={20} /></span><div><span>Open Accounts</span><strong>{supplierSummary.open_accounts}</strong></div></article>
          </div>

          <div className="supplier-toolbar">
            <AppBarSearch><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier, phone, or contact" aria-label="Search suppliers" /></label></AppBarSearch>
            <span className="supplier-toolbar-count">{supplierTotal} suppliers</span>
            <AppBarActions className="supplier-toolbar-actions">
              <button type="button" className="primary" onClick={openSupplierForm}><Plus size={16} /> Add Supplier</button>
              <button type="button" className="filter-drawer-trigger" onClick={openSupplierFilters} aria-haspopup="dialog" aria-expanded={supplierFilterOpen}><Filter size={16} /> Filters{supplierListFilterCount > 0 && <span className="filter-count">{supplierListFilterCount}</span>}</button>
              <CsvExportButton onExport={exportSuppliers} onError={setError} onSuccess={setMessage} />
            </AppBarActions>
          </div>

          <div className="supplier-table-card">
            <div className="supplier-table-wrap">
              <table className="supplier-table">
                <colgroup><col span="7" /><col className="table-action-column" /></colgroup>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Phone</th>
                    <th>Contact Person</th>
                    <th>Address</th>
                    <th>Purchases</th>
                    <th>Balance</th>
                    <th>Last Purchase</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td><strong>{supplier.name}</strong></td>
                      <td>{supplier.phone || '-'}</td>
                      <td>{supplier.contact_person || '-'}</td>
                      <td>{supplier.address || '-'}</td>
                      <td>{supplier.purchase_count || 0}</td>
                      <td><strong>{money(supplier.balance || 0)}</strong></td>
                      <td>{supplier.last_purchase || '-'}</td>
                      <td className="supplier-actions-cell"><SupplierRowActions supplier={supplier} deleting={deletingId === supplier.id} onView={openSupplierDetail} onEdit={editSupplier} onRecordPayment={openNewSupplierPayment} onPayment={(item) => openSupplierPaymentsPage(item, 'list')} onDelete={deleteSupplier} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <TableLoadingState>Loading suppliers…</TableLoadingState>}
              {!suppliers.length && !loading && <EmptyState>No suppliers found.</EmptyState>}
            </div>
            <TablePagination className="supplier-table-footer" page={supplierPage} pageSize={supplierPageSize} total={supplierTotal} loading={loading} onPageChange={setSupplierPage} />
          </div>
        </div>
      </section>}

      <FilterDrawer open={!detailPageOpen && !paymentPageOpen && supplierFilterOpen} title="Supplier filters" eyebrow="Filter" onClose={() => setSupplierFilterOpen(false)} busy={loading}>
        <form className="drawer-filter-form" onSubmit={applySupplierFilters}>
          <Field label="Account status">
            <select value={supplierFilterDraft.account_status} onChange={(event) => setSupplierFilterDraft({ ...supplierFilterDraft, account_status: event.target.value })}>
              <option value="all">All account statuses</option>
              <option value="payable">We owe supplier</option>
              <option value="credit">Supplier owes us</option>
              <option value="settled">Settled balance</option>
            </select>
          </Field>
          <Field label="Purchase activity">
            <select value={supplierFilterDraft.purchase_activity} onChange={(event) => setSupplierFilterDraft({ ...supplierFilterDraft, purchase_activity: event.target.value })}>
              <option value="all">All suppliers</option>
              <option value="with_purchases">Has purchases</option>
              <option value="without_purchases">No purchases</option>
            </select>
          </Field>
          <div className="drawer-filter-actions"><button type="button" onClick={clearSupplierFilters} disabled={loading}>Clear</button><button type="submit" className="primary" disabled={loading}>{actionLabel(loading, 'Loading...', 'Apply Filter')}</button></div>
        </form>
      </FilterDrawer>

      <Modal open={supplierFormOpen} title={editingId ? 'Edit Supplier' : 'Add Supplier'} onClose={closeSupplierForm} busy={saving} size="small" footer={<><button type="button" onClick={closeSupplierForm}>Cancel</button><button type="submit" form="supplier-editor-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', editingId ? 'Update Supplier' : 'Add Supplier')}</button></>}>
        <form id="supplier-editor-form" className="supplier-modal-form" onSubmit={saveSupplier}>
          <div className="supplier-modal-grid">
            <Field label="Supplier Name">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="Contact Person">
              <input value={form.contact_person} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} />
            </Field>
            <Field label="Address">
              <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Note">
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>

      {paymentPageOpen && paymentPageSupplier && (
        <>
          <AppBarActions className="supplier-payment-page-actions">
            <button type="button" className="primary" onClick={() => openNewSupplierPayment()}><Plus size={16} /> Record payment</button>
            <button type="button" onClick={() => editSupplier(paymentPageSupplier)}><Edit size={16} /> Edit supplier</button>
            <CsvExportButton label="Export payments" onExport={exportSupplierPayments} onError={setError} onSuccess={setMessage} />
          </AppBarActions>
          <SupplierPaymentsPage
            supplier={selectedSupplier?.id === paymentPageSupplier.id ? selectedSupplier : paymentPageSupplier}
            payments={paymentRecords}
            loading={paymentLoading}
            page={paymentPage}
            pageSize={paymentPageSize}
            total={paymentTotal}
            deletingId={deletingPaymentId}
            onPageChange={changePaymentPage}
            onEdit={editSupplierPayment}
            onDelete={deleteSupplierPayment}
          />
        </>
      )}

      {detailPageOpen && !paymentPageOpen && (
        <section className="screen suppliers-layout supplier-detail-page mkpos-sheet">
          <div className="supplier-detail-appbar-slots">
            <AppBarActions>
              {selectedSupplier && <button type="button" onClick={() => openSupplierPaymentsPage(selectedSupplier, 'detail')}><HandCoins size={16} /> Payment records</button>}
              {selectedSupplier && <button type="button" onClick={() => editSupplier(selectedSupplier)}><Edit size={16} /> Edit supplier</button>}
              {selectedSupplier && <button type="button" className="filter-drawer-trigger" onClick={() => setDetailFilterOpen(true)} aria-haspopup="dialog" aria-expanded={detailFilterOpen}><Filter size={16} /> Filters{supplierHistoryFilterCount > 0 && <span className="filter-count">{supplierHistoryFilterCount}</span>}</button>}
              {selectedSupplier && <CsvExportButton label="Export purchases" onExport={exportSupplierPurchases} onError={setError} onSuccess={setMessage} />}
            </AppBarActions>
            {selectedSupplier && <AppBarSearch><form onSubmit={applySupplierHistoryFilters}><label><Search size={16} /><input value={supplierHistoryFilters.q} onChange={(event) => setSupplierHistoryFilters({ ...supplierHistoryFilters, q: event.target.value })} placeholder="Search purchase ID or note" aria-label="Search supplier purchases" /></label></form></AppBarSearch>}
          </div>
          {!selectedSupplier ? (
            <div className="supplier-detail-page-loading"><LoadingState>Loading supplier account…</LoadingState></div>
          ) : (
          <div className="supplier-detail-page-content">
            <div className="supplier-detail">
              <div className="supplier-detail-tab-panel">
                  <SupplierProfileCard supplier={selectedSupplier} />

                  <div className="supplier-stat-row" aria-label="Supplier account statistics">
                    <article className="product-stat-card supplier-stat-card purchases"><span className="product-stat-icon"><ShoppingCart size={18} /></span><div><span>Total Purchases</span><strong>{money(selectedSupplier.total_purchase || 0)}</strong></div></article>
                    <article className="product-stat-card supplier-stat-card credit"><span className="product-stat-icon"><CreditCard size={18} /></span><div><span>Credit Purchases</span><strong>{money(selectedSupplier.credit_purchase_total || 0)}</strong></div></article>
                    <article className="product-stat-card supplier-stat-card paid"><span className="product-stat-icon"><HandCoins size={18} /></span><div><span>Paid to Supplier</span><strong>{money(selectedSupplier.paid_total || 0)}</strong></div></article>
                    <article className="product-stat-card supplier-stat-card refunds"><span className="product-stat-icon"><RotateCcw size={18} /></span><div><span>Supplier Refunds</span><strong>{money(selectedSupplier.refund_total || 0)}</strong></div></article>
                    <article className="product-stat-card supplier-stat-card balance"><span className="product-stat-icon"><WalletCards size={18} /></span><div><span>Current Balance</span><strong>{money(selectedSupplier.balance || 0)}</strong></div></article>
                    <article className="product-stat-card supplier-stat-card count"><span className="product-stat-icon"><ReceiptText size={18} /></span><div><span>Purchase Count</span><strong>{selectedSupplier.purchase_count || 0}</strong></div></article>
                  </div>
                  <PurchaseHistoryTable
                    purchases={selectedSupplier.purchases || []}
                    loading={detailLoading}
                    emptyMessage="No purchase history for this supplier."
                    supplierName={selectedSupplier.name}
                    page={purchaseHistoryPage}
                    pageSize={purchaseHistoryPageSize}
                    total={purchaseHistoryTotal}
                    deletingId={deletingPurchaseId}
                    onPageChange={changePurchaseHistoryPage}
                    onView={viewPurchaseDetail}
                    onEdit={openPurchaseEditor}
                    onDelete={deletePurchase}
                  />
              </div>
            </div>
          </div>
          )}
        </section>
      )}

      <FilterDrawer open={detailPageOpen && !paymentPageOpen && detailFilterOpen} title="Purchase history filters" eyebrow="Filter" onClose={() => setDetailFilterOpen(false)} busy={detailLoading}>
        <form className="drawer-filter-form" onSubmit={applySupplierHistoryFilters}>
          <Field label="From"><input type="date" value={supplierHistoryFilters.date_from} onChange={(event) => setSupplierHistoryFilters({ ...supplierHistoryFilters, date_from: event.target.value })} /></Field>
          <Field label="To"><input type="date" value={supplierHistoryFilters.date_to} onChange={(event) => setSupplierHistoryFilters({ ...supplierHistoryFilters, date_to: event.target.value })} /></Field>
          <div className="drawer-filter-actions"><button type="button" onClick={clearSupplierHistoryFilters} disabled={detailLoading}>Clear</button><button type="submit" className="primary" disabled={detailLoading}>{actionLabel(detailLoading, 'Loading...', 'Apply Filter')}</button></div>
        </form>
      </FilterDrawer>

      <Modal open={paymentRecordOpen} title={editingPaymentId ? 'Edit Supplier Payment' : 'Record Supplier Payment'} subtitle={selectedSupplier ? `${selectedSupplier.name} · Current balance: ${money(selectedSupplier.balance || 0)}` : ''} onClose={closeSupplierPaymentForm} busy={saving} size="small" footer={<><button type="button" onClick={closeSupplierPaymentForm} disabled={saving}>Cancel</button><button type="submit" form="supplier-payment-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', editingPaymentId ? 'Update payment' : 'Record payment')}</button></>}>
        <form id="supplier-payment-form" className="supplier-payment-modal-form" onSubmit={saveSupplierPayment}>
          <div className="supplier-payment-modal-grid">
            <Field label="Direction"><select value={paymentForm.direction} onChange={(event) => setPaymentForm({ ...paymentForm, direction: event.target.value })}><option value="shop_to_supplier">Shop pays supplier</option><option value="supplier_to_shop">Supplier refunds shop</option></select></Field>
            <Field label="Amount"><input type="number" min="1" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required autoFocus /></Field>
            <Field label="Payment method"><select value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}>{['Cash', 'Banking Pay', 'Wallet Pay', 'KPay', 'Wave Pay'].map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
            <Field label="Note"><textarea rows="3" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} placeholder="Optional reference or reason" /></Field>
          </div>
        </form>
      </Modal>
      <PurchaseDetailModal purchase={viewPurchase} onClose={() => setViewPurchase(null)} />
      {purchaseEditor.open && <NewPurchaseScreen modal open purchaseId={purchaseEditor.purchaseId} requestKey={purchaseEditor.requestKey} onExit={closePurchaseEditor} />}
    </>
    </RetainedViews>
  );
}
