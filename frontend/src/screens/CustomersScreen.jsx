import { useAiPageLink, returnFromAiPage } from '../ai/useAiPageLink';
import React, { useEffect, useMemo, useState } from 'react';
import { RetainedViews } from '../components/RetainedViews';
import { usePageNavigation } from '../usePageNavigation';
import { CreditCard, Edit, Eye, Filter, HandCoins, Plus, Printer, ReceiptText, RotateCcw, Search, ShoppingCart, Trash2, UsersRound, WalletCards } from 'lucide-react';
import { request } from '../api';
import { RowActions } from '../components/RowActions';
import { actionLabel, money, normalizeNumber } from '../utils';
import { EmptyState, Field, FilterDrawer, LoadingState, Modal, TableLoadingState, TablePagination } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useConfirmation } from '../components/confirmations';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { getCurrentLanguage, translateText } from '../translations';
import { printDocumentHtml, reservePrintWindow, printResultMessage } from '../printing';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { TABLE_PAGE_SIZE } from '../tablePagination';
import { CustomerProfileCard } from '../components/CustomerProfileCard';
import { SaleHistoryTable } from '../components/SaleHistoryTable';
import { CustomerPaymentsPage } from './CustomerPaymentsPage';
import { SaleCrudController } from '../components/SaleCrudController';

export function blankCustomerForm() { return { name: '', phone: '', email: '', address: '', note: '' }; }
function blankCustomerFilters() { return { account_status: 'all', sale_activity: 'all' }; }
function blankHistoryFilters() { return { q: '', date_from: '', date_to: '', sale_type: 'all' }; }
function blankPaymentForm() { return { direction: 'customer_to_shop', payment_method: 'Cash', amount: '', note: '' }; }

function cleanPaymentMethods(settings) {
  const methods = String(settings?.payment_methods || '').split(',').map((item) => item.trim()).filter((item) => item && item.toLowerCase() !== 'credit');
  return methods.length ? methods : ['Cash'];
}

function historyPath(customerId, type, filters = blankHistoryFilters(), offset = 0) {
  const params = new URLSearchParams({ with_total: 'true', limit: String(TABLE_PAGE_SIZE), offset: String(offset) });
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (type === 'sales' && filters.sale_type !== 'all') params.set('sale_type', filters.sale_type);
  return `/customers/${customerId}/${type}?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function CustomerRowActions({ customer, deleting, onView, onEdit, onRecordPayment, onPayments, onDelete }) {
  return <RowActions label={customer.name}>
    <button type="button" onClick={() => onView(customer)}><Eye size={15} /> View customer</button>
    <button type="button" onClick={() => onEdit(customer)}><Edit size={15} /> Edit customer</button>
    <button type="button" onClick={() => onRecordPayment(customer)}><Plus size={15} /> Record payment</button>
    <button type="button" onClick={() => onPayments(customer)}><HandCoins size={15} /> Payments</button>
    <button type="button" className="danger-button" disabled={deleting} onClick={() => onDelete(customer)}><Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete customer'}</button>
  </RowActions>;
}

export function CustomersScreen({ onDetailChange }) {
  const [customers, setCustomers] = useState([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [summary, setSummary] = useState({ total_customers: 0, receivable_total: 0, payable_total: 0, open_accounts: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(blankCustomerFilters());
  const [filterDraft, setFilterDraft] = useState(blankCustomerFilters());
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const loadSequence = React.useRef(0);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerForm, setCustomerForm] = useState(blankCustomerForm());
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);
  const [detailPageOpen, setDetailPageOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [historyFilters, setHistoryFilters] = useState(blankHistoryFilters());
  const [historyFilterOpen, setHistoryFilterOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [salesLoading, setSalesLoading] = useState(false);
  const [paymentPageOpen, setPaymentPageOpen] = useState(false);
  const [paymentPageOrigin, setPaymentPageOrigin] = useState('list');
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paymentForm, setPaymentForm] = useState(blankPaymentForm());
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [statementPrinting, setStatementPrinting] = useState(false);
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();
  const paymentMethods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const listFilterCount = Object.values(filters).filter((value) => value !== 'all').length;
  const historyFilterCount = [historyFilters.date_from, historyFilters.date_to, historyFilters.sale_type !== 'all' ? historyFilters.sale_type : ''].filter(Boolean).length;

  function customerParams(nextPage = page, nextSearch = search, nextFilters = filters) {
    const params = new URLSearchParams({ with_total: 'true', limit: String(TABLE_PAGE_SIZE), offset: String((nextPage - 1) * TABLE_PAGE_SIZE) });
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    if (nextFilters.account_status !== 'all') params.set('account_status', nextFilters.account_status);
    if (nextFilters.sale_activity !== 'all') params.set('sale_activity', nextFilters.sale_activity);
    return params;
  }

  async function loadCustomers(nextPage = page, nextSearch = search, nextFilters = filters) {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const data = await request(`/customers?${customerParams(nextPage, nextSearch, nextFilters)}`);
      if (sequence !== loadSequence.current) return;
      setCustomers(data.items || []); setCustomerTotal(data.total || 0); setSummary(data.account_summary || {}); setError('');
    } catch (err) { if (sequence === loadSequence.current) setError(`Cannot load customers. ${err.message}`); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }

  useLatestEffect(() => { const timer = window.setTimeout(() => loadCustomers(page, search, filters), 220); return () => window.clearTimeout(timer); }, [page, search, filters]);
  useLatestEffect(() => { request('/settings').then(setSettings).catch(() => {}); }, []);
  useEffect(() => setPage(1), [search, filters]);

  async function loadCustomerDetail(customerId, nextFilters = historyFilters, nextPage = salesPage) {
    setDetailLoading(true);
    try {
      const [detail, sales] = await Promise.all([request(`/customers/${customerId}/detail?limit=1&offset=0`), request(historyPath(customerId, 'sales', nextFilters, (nextPage - 1) * TABLE_PAGE_SIZE))]);
      setSelectedDetail({ ...detail, sales: sales.items || [], salesTotal: sales.total || 0 }); setSalesPage(nextPage);
    } catch (err) { setError(err.message); } finally { setDetailLoading(false); }
  }

  async function loadPayments(customerId, nextPage = paymentPage, nextFilters = historyFilters) {
    setPaymentsLoading(true);
    try { const data = await request(historyPath(customerId, 'payments', nextFilters, (nextPage - 1) * TABLE_PAGE_SIZE)); setPaymentRecords(data.items || []); setPaymentTotal(data.total || 0); setPaymentPage(nextPage); }
    catch (err) { setError(err.message); } finally { setPaymentsLoading(false); }
  }

  useDataRefresh(['customers', 'sales', 'customerPayments'], 'customers', () => {
    const tasks = [loadCustomers(page, search, filters)]; const customerId = selectedDetail?.customer?.id || paymentTarget?.id;
    if (detailPageOpen && customerId) tasks.push(loadCustomerDetail(customerId, historyFilters, salesPage));
    if (paymentPageOpen && customerId) tasks.push(loadPayments(customerId, paymentPage));
    return Promise.all(tasks);
  });

  useAiPageLink('customers', target => { if (target.action === 'new' && !customerModalOpen) openCustomerModal(); }, !loading);

  function openCustomerModal(customer = null) { setEditingCustomerId(customer?.id || null); setCustomerForm(customer ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '', note: customer.note || '' } : blankCustomerForm()); setCustomerModalOpen(true); setError(''); setMessage(''); }
  function closeCustomerModal() { setCustomerModalOpen(false); setEditingCustomerId(null); setCustomerForm(blankCustomerForm()); returnFromAiPage('customers_new'); }
  async function saveCustomer(event) {
    event.preventDefault(); const payload = Object.fromEntries(Object.entries(customerForm).map(([key, value]) => [key, String(value || '').trim()]));
    if (!payload.name) return setError('Customer name is required.');
    setSavingCustomer(true); setError('');
    try { await request(editingCustomerId ? `/customers/${editingCustomerId}` : '/customers', { method: editingCustomerId ? 'PUT' : 'POST', body: JSON.stringify(payload) }); setMessage(editingCustomerId ? 'Customer updated.' : 'Customer added.'); closeCustomerModal(); await loadCustomers(page, search, filters); if (selectedDetail?.customer?.id === editingCustomerId) await loadCustomerDetail(editingCustomerId); emitDataChange(['customers'], 'customers'); }
    catch (err) { setError(err.message); } finally { setSavingCustomer(false); }
  }
  async function deleteCustomer(customer) {
    const { confirmed } = await confirmAction({ title: 'Delete customer', message: `Delete customer "${customer.name}"? Sales and payment history will remain linked.`, confirmLabel: 'Delete Customer' }); if (!confirmed) return;
    setDeletingCustomerId(customer.id);
    try { await request(`/customers/${customer.id}`, { method: 'DELETE' }); setMessage('Customer deleted.'); await loadCustomers(page, search, filters); emitDataChange(['customers'], 'customers'); } catch (err) { setError(err.message); } finally { setDeletingCustomerId(null); }
  }

  const backFields = [[detailPageOpen, setDetailPageOpen], [paymentPageOpen, setPaymentPageOpen], [selectedDetail, setSelectedDetail], [historyFilters, setHistoryFilters], [salesPage, setSalesPage], [paymentTarget, setPaymentTarget], [paymentPageOrigin, setPaymentPageOrigin], [paymentRecords, setPaymentRecords], [paymentPage, setPaymentPage], [paymentTotal, setPaymentTotal]];
  const navigation = usePageNavigation('pos-customers', { kind: 'list' }, () => location.href, {
    module: 'customers',
    resumeHistory: false,
    capture: () => backFields.map(([value]) => value),
    restore: (next, snapshot) => {
      if (snapshot) {
        const restored = [...snapshot];
        if (restored[2]?.customer?.id === selectedDetail?.customer?.id && selectedDetail) {
          restored[2] = restored[4] === salesPage && JSON.stringify(restored[3]) === JSON.stringify(historyFilters)
            ? selectedDetail : { ...restored[2], customer: selectedDetail.customer, summary: selectedDetail.summary };
        }
        backFields.forEach(([, setter], index) => setter(restored[index]));
      }
      else { setDetailPageOpen(false); setPaymentPageOpen(false); }
      setHistoryFilterOpen(false); setPaymentModalOpen(false);
      onDetailChange?.(next.kind === 'payments' ? { label: next.origin === 'detail' ? 'Back to customer' : 'Back to Customers', onClick: () => navigation.back({ kind: 'list' }) } : next.kind === 'detail' ? { label: 'Back to Customers', onClick: () => navigation.back({ kind: 'list' }) } : null);
    },
  });
  function openCustomerDetail(customer) { navigation.go({ kind: 'detail', id: customer.id }); const next = blankHistoryFilters(); setDetailPageOpen(true); setPaymentPageOpen(false); setSelectedDetail({ customer, summary: { balance: customer.balance || 0 }, sales: [], salesTotal: 0 }); setHistoryFilters(next); setSalesPage(1); onDetailChange?.({ label: 'Back to Customers', onClick: closeCustomerDetail }); loadCustomerDetail(customer.id, next, 1); }
  function closeCustomerDetail() { navigation.back({ kind: 'list' }); }
  function openPaymentsPage(customer, origin = 'list') { navigation.go({ kind: 'payments', id: customer.id, origin }); setPaymentTarget(customer); setPaymentPageOrigin(origin); setPaymentPageOpen(true); setPaymentRecords([]); setPaymentPage(1); setPaymentTotal(0); loadPayments(customer.id, 1); loadCustomerDetail(customer.id, historyFilters, salesPage); onDetailChange?.({ label: origin === 'detail' ? `Back to ${customer.name}` : 'Back to Customers', onClick: () => closePaymentsPage(origin) }); }
  function closePaymentsPage() { navigation.back({ kind: 'list' }); }
  function openPaymentModal(customer = paymentTarget || selectedDetail?.customer) { setPaymentTarget(customer); setEditingPaymentId(null); setPaymentForm(blankPaymentForm()); setPaymentModalOpen(true); }
  function editPayment(payment) { setEditingPaymentId(payment.id); setPaymentForm({ direction: payment.direction || 'customer_to_shop', payment_method: payment.payment_method || 'Cash', amount: payment.amount, note: payment.note || '' }); setPaymentModalOpen(true); }
  function closePaymentModal() { if (!savingPayment) { setPaymentModalOpen(false); setEditingPaymentId(null); setPaymentForm(blankPaymentForm()); } }

  async function savePayment(event) {
    event.preventDefault(); const customer = paymentTarget || selectedDetail?.customer; const amount = Math.round(normalizeNumber(paymentForm.amount, 0));
    if (!customer?.id || amount <= 0) return setError('Payment amount must be greater than zero.');
    setSavingPayment(true); setError('');
    try { await request(editingPaymentId ? `/customer-payments/${editingPaymentId}` : `/customers/${customer.id}/payments`, { method: editingPaymentId ? 'PUT' : 'POST', body: JSON.stringify({ ...(editingPaymentId ? { customer_id: customer.id } : {}), ...paymentForm, amount }) }); setMessage(editingPaymentId ? 'Payment updated.' : 'Payment saved.'); const wasEditing = Boolean(editingPaymentId); setPaymentModalOpen(false); setEditingPaymentId(null); setPaymentForm(blankPaymentForm()); await loadCustomers(page, search, filters); if (detailPageOpen || paymentPageOpen) await loadCustomerDetail(customer.id); if (paymentPageOpen) await loadPayments(customer.id, wasEditing ? paymentPage : 1); emitDataChange(['customerPayments', 'customers', 'reports'], 'customers'); }
    catch (err) { setError(err.message); } finally { setSavingPayment(false); }
  }
  async function deletePayment(payment) { const { confirmed } = await confirmAction({ title: 'Delete customer payment', message: `Delete this payment of ${money(payment.amount)}? The customer balance will be recalculated.`, confirmLabel: 'Delete Payment' }); if (!confirmed) return; setDeletingPaymentId(payment.id); try { await request(`/customer-payments/${payment.id}`, { method: 'DELETE' }); setMessage('Payment deleted.'); await loadPayments(paymentTarget.id, paymentPage); await loadCustomers(page, search, filters); emitDataChange(['customerPayments', 'customers', 'reports'], 'customers'); } catch (err) { setError(err.message); } finally { setDeletingPaymentId(null); } }

  function exportCustomers() { const query = customerParams(1, search, filters); ['limit', 'offset', 'with_total'].forEach((key) => query.delete(key)); return exportFilteredCsv({ path: `/customers${query.toString() ? `?${query}` : ''}`, filename: csvFilename('customers'), columns: [{ label: 'Name', value: (row) => row.name }, { label: 'Phone', value: (row) => row.phone || '' }, { label: 'Email', value: (row) => row.email || '' }, { label: 'Address', value: (row) => row.address || '' }, { label: 'Sales', value: (row) => row.sale_count || 0 }, { label: 'Balance', value: (row) => row.balance || 0 }, { label: 'Last Sale', value: (row) => row.last_sale || '' }, { label: 'Note', value: (row) => row.note || '' }] }); }
  function exportHistory(type) { const customer = paymentTarget || selectedDetail?.customer; const url = new URL(historyPath(customer.id, type, historyFilters), window.location.origin); ['with_total', 'limit', 'offset'].forEach((key) => url.searchParams.delete(key)); return exportFilteredCsv({ path: `${url.pathname}${url.search}`, filename: csvFilename(`customer-${customer.id}-${type}`), columns: type === 'sales' ? [{ label: 'Date', value: (row) => row.created_at }, { label: 'Receipt', value: (row) => row.receipt_no }, { label: 'Customer', value: (row) => row.customer_name || customer.name }, { label: 'Type', value: (row) => row.payment_type || '' }, { label: 'Method', value: (row) => row.payment_method || '' }, { label: 'Total', value: (row) => row.total }, { label: 'Paid', value: (row) => row.paid_amount }, { label: 'Credit', value: (row) => row.credit_amount }] : [{ label: 'Date', value: (row) => row.created_at }, { label: 'Direction', value: (row) => row.direction }, { label: 'Method', value: (row) => row.payment_method }, { label: 'Amount', value: (row) => row.amount }, { label: 'Note', value: (row) => row.note || '' }] }); }

  async function printCustomerStatement() {
    if (!selectedDetail?.customer?.id) return; const popup = reservePrintWindow(); if (!window.mkposDesktop?.printReceipt && !popup) return setError('Cannot open statement preview. Please allow pop-ups.'); setStatementPrinting(true);
    try {
      const params = new URLSearchParams(); if (historyFilters.date_from) params.set('date_from', historyFilters.date_from); if (historyFilters.date_to) params.set('date_to', historyFilters.date_to);
      const [statement, shop] = await Promise.all([request(`/customers/${selectedDetail.customer.id}/statement${params.toString() ? `?${params}` : ''}`), request('/settings')]); const translate = (value) => translateText(value, getCurrentLanguage());
      const saleRows = statement.sales.map((sale) => `<tr><td>${escapeHtml(sale.created_at)}</td><td>${escapeHtml(sale.receipt_no)}</td><td class="amount">${escapeHtml(money(sale.credit_amount))}</td></tr>`).join(''); const paymentRows = statement.payments.map((payment) => `<tr><td>${escapeHtml(payment.created_at)}</td><td>${escapeHtml(translate(payment.direction === 'customer_to_shop' ? 'Customer payment' : 'Shop payout'))}</td><td>${escapeHtml(payment.note || '-')}</td><td class="amount">${escapeHtml(money(payment.amount))}</td></tr>`).join('');
      const html = `<!doctype html><html><head><title>${escapeHtml(translate('Customer Statement'))}</title><style>body{font-family:Inter,Arial,"Noto Sans Myanmar",sans-serif;color:#13231d;margin:24px;font-size:13px;line-height:1.55}h1,h2,p{margin:0}.shop{text-align:center;margin-bottom:20px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #0f4c3a}h2{font-size:14px;margin:16px 0 6px;color:#0f4c3a}table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #dfe7e3;text-align:left}th{background:#edf4f1}.amount{text-align:right}.totals{margin:18px 0 0 auto;width:340px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.balance{font-size:16px;font-weight:700;border-top:2px solid #0f4c3a;margin-top:4px;padding-top:8px!important}</style></head><body><div class="shop"><h1>${escapeHtml(shop.shop_name || 'PwarMyar Shop')}</h1><p>${escapeHtml(shop.shop_address || '')}</p></div><div class="meta"><strong>Customer</strong><span>${escapeHtml(statement.customer.name)}</span><strong>Phone</strong><span>${escapeHtml(statement.customer.phone || '-')}</span><strong>Address</strong><span>${escapeHtml(statement.customer.address || '-')}</span></div><h2>Credit Sales</h2><table><tbody>${saleRows || '<tr><td>No credit sales.</td></tr>'}</tbody></table><h2>Payments and Payouts</h2><table><tbody>${paymentRows || '<tr><td>No payments or payouts.</td></tr>'}</tbody></table><div class="totals"><div><span>Credit sales</span><strong>${escapeHtml(money(statement.summary.credit_total))}</strong></div><div><span>Customer payments</span><strong>${escapeHtml(money(statement.summary.paid_total))}</strong></div><div><span>Shop payouts</span><strong>${escapeHtml(money(statement.summary.payout_total))}</strong></div><div class="balance"><span>Current balance</span><strong>${escapeHtml(money(statement.summary.current_balance))}</strong></div></div></body></html>`;
      setMessage(printResultMessage(await printDocumentHtml(html, { paperSize: 'a4', popup, useSystemPrinter: true })));
    } catch (err) { popup?.close(); setError(`Cannot print statement. ${err.message}`); } finally { setStatementPrinting(false); }
  }

  const editor = <Modal open={customerModalOpen} title={editingCustomerId ? 'Edit Customer' : 'Add Customer'} onClose={closeCustomerModal} busy={savingCustomer} size="small" footer={<><button type="button" onClick={closeCustomerModal}>Cancel</button><button type="submit" form="customer-editor-form" className="primary" disabled={savingCustomer}>{actionLabel(savingCustomer, 'Saving...', editingCustomerId ? 'Update Customer' : 'Add Customer')}</button></>}><form id="customer-editor-form" className="supplier-modal-form" onSubmit={saveCustomer}><div className="supplier-modal-grid"><Field label="Customer Name"><input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required /></Field><Field label="Phone"><input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></Field><Field label="Email (optional)"><input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} /></Field><Field label="Address"><input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} /></Field><Field label="Note"><textarea value={customerForm.note} onChange={(e) => setCustomerForm({ ...customerForm, note: e.target.value })} /></Field></div></form></Modal>;
  const paymentEditor = <Modal open={paymentModalOpen} title={editingPaymentId ? 'Edit Customer Payment' : 'Record Customer Payment'} subtitle={paymentTarget ? `${paymentTarget.name} · Current balance: ${money(selectedDetail?.summary?.balance ?? paymentTarget.balance ?? 0)}` : ''} onClose={closePaymentModal} busy={savingPayment} size="small" footer={<><button type="button" onClick={closePaymentModal}>Cancel</button><button type="submit" form="customer-payment-form" className="primary" disabled={savingPayment}>{actionLabel(savingPayment, 'Saving...', editingPaymentId ? 'Update payment' : 'Record payment')}</button></>}><form id="customer-payment-form" className="supplier-payment-modal-form" onSubmit={savePayment}><div className="supplier-payment-modal-grid"><Field label="Direction"><select value={paymentForm.direction} onChange={(e) => setPaymentForm({ ...paymentForm, direction: e.target.value })}><option value="customer_to_shop">Customer pays shop</option><option value="shop_to_customer">Shop pays customer</option></select></Field><Field label="Amount"><input type="number" min="1" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required autoFocus /></Field><Field label="Payment method"><select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></Field><Field label="Note"><textarea rows="3" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} /></Field></div></form></Modal>;

  const renderContent = () => {
  if (paymentPageOpen && paymentTarget) return <>{editor}<AppBarActions className="supplier-payment-page-actions"><button type="button" className="primary" onClick={() => openPaymentModal(paymentTarget)}><Plus size={16} /> Record payment</button><button type="button" onClick={() => openCustomerModal(paymentTarget)}><Edit size={16} /> Edit customer</button><CsvExportButton label="Export payments" onExport={() => exportHistory('payments')} onError={setError} onSuccess={setMessage} /></AppBarActions><CustomerPaymentsPage customer={{ ...paymentTarget, ...(selectedDetail?.summary || {}) }} payments={paymentRecords} loading={paymentsLoading} page={paymentPage} pageSize={TABLE_PAGE_SIZE} total={paymentTotal} deletingId={deletingPaymentId} onPageChange={(next) => loadPayments(paymentTarget.id, next)} onEdit={editPayment} onDelete={deletePayment} />{paymentEditor}</>;

  if (detailPageOpen && selectedDetail) return <SaleCrudController settings={settings} onChanged={() => Promise.all([loadCustomerDetail(selectedDetail.customer.id, historyFilters, salesPage), loadCustomers(page, search, filters)])}>
    {(saleActions) => <>
    <section className="screen suppliers-layout supplier-detail-page customer-detail-page mkpos-sheet"><div className="supplier-detail-appbar-slots"><AppBarActions><button type="button" onClick={() => openPaymentsPage(selectedDetail.customer, 'detail')}><HandCoins size={16} /> Payment records</button><button type="button" onClick={() => openCustomerModal(selectedDetail.customer)}><Edit size={16} /> Edit customer</button><button type="button" className="filter-drawer-trigger" onClick={() => setHistoryFilterOpen(true)}><Filter size={16} /> Filters{historyFilterCount > 0 && <span className="filter-count">{historyFilterCount}</span>}</button><CsvExportButton label="Export sales" onExport={() => exportHistory('sales')} onError={setError} onSuccess={setMessage} /><button type="button" disabled={statementPrinting} onClick={printCustomerStatement}><Printer size={16} /> {statementPrinting ? 'Preparing…' : 'Print statement'}</button></AppBarActions><AppBarSearch><form onSubmit={(event) => { event.preventDefault(); loadCustomerDetail(selectedDetail.customer.id, historyFilters, 1); }}><label><Search size={16} /><input value={historyFilters.q} onChange={(event) => setHistoryFilters({ ...historyFilters, q: event.target.value })} placeholder="Search receipt or payment method" aria-label="Search customer sales" /></label></form></AppBarSearch></div><div className="supplier-detail-page-content"><div className="supplier-detail"><div className="supplier-detail-tab-panel"><CustomerProfileCard customer={{ ...selectedDetail.customer, ...selectedDetail.summary }} /><div className="supplier-stat-row" aria-label="Customer detail statistics"><Stat icon={ShoppingCart} label="Total Sales" value={money(selectedDetail.summary.total_sales || 0)} /><Stat icon={CreditCard} label="Credit Sales" value={money(selectedDetail.summary.credit_total || 0)} tone="credit" /><Stat icon={HandCoins} label="Customer Paid" value={money(selectedDetail.summary.paid_total || 0)} tone="paid" /><Stat icon={RotateCcw} label="Shop Payouts" value={money(selectedDetail.summary.payout_total || 0)} tone="refunds" /><Stat icon={WalletCards} label="Current Balance" value={money(selectedDetail.summary.balance || 0)} tone="balance" /><Stat icon={ReceiptText} label="Sale Count" value={selectedDetail.summary.sale_count || 0} tone="count" /></div><SaleHistoryTable sales={selectedDetail.sales || []} loading={detailLoading || salesLoading} customerName={selectedDetail.customer.name} page={salesPage} pageSize={TABLE_PAGE_SIZE} total={selectedDetail.salesTotal || 0} onPageChange={(next) => { setSalesLoading(true); loadCustomerDetail(selectedDetail.customer.id, historyFilters, next).finally(() => setSalesLoading(false)); }} {...saleActions} /></div></div></div></section>
    <FilterDrawer open={historyFilterOpen} title="Sale history filters" eyebrow="Filter" onClose={() => setHistoryFilterOpen(false)} busy={detailLoading}><form className="drawer-filter-form" onSubmit={(event) => { event.preventDefault(); setHistoryFilterOpen(false); loadCustomerDetail(selectedDetail.customer.id, historyFilters, 1); }}><Field label="From"><input type="date" value={historyFilters.date_from} onChange={(e) => setHistoryFilters({ ...historyFilters, date_from: e.target.value })} /></Field><Field label="To"><input type="date" value={historyFilters.date_to} onChange={(e) => setHistoryFilters({ ...historyFilters, date_to: e.target.value })} /></Field><Field label="Sale type"><select value={historyFilters.sale_type} onChange={(e) => setHistoryFilters({ ...historyFilters, sale_type: e.target.value })}><option value="all">All sales</option><option value="credit">Credit</option><option value="paid">Paid</option></select></Field><div className="drawer-filter-actions"><button type="button" onClick={() => { const next = blankHistoryFilters(); setHistoryFilters(next); setHistoryFilterOpen(false); loadCustomerDetail(selectedDetail.customer.id, next, 1); }}>Clear</button><button type="submit" className="primary">Apply Filter</button></div></form></FilterDrawer>{editor}{paymentEditor}
    </>}
  </SaleCrudController>;

  if (detailPageOpen) return <section className="screen suppliers-layout supplier-detail-page mkpos-sheet"><div className="supplier-detail-page-loading"><LoadingState>Loading customer account…</LoadingState></div></section>;

  return <><section className="screen customers-layout mkpos-sheet"><div className="panel supplier-main-panel customer-main-panel"><div className="product-stat-row supplier-index-stat-row" aria-label="Customer account statistics"><Stat icon={UsersRound} label="Total Customers" value={summary.total_customers || 0} /><Stat icon={CreditCard} label="Total Receivable" value={money(summary.receivable_total || 0)} /><Stat icon={HandCoins} label="Total Payable" value={money(summary.payable_total || 0)} /><Stat icon={ReceiptText} label="Open Accounts" value={summary.open_accounts || 0} /></div><div className="supplier-toolbar"><AppBarSearch><label><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone, email, address, or note" aria-label="Search customers" /></label></AppBarSearch><AppBarActions className="supplier-toolbar-actions"><button type="button" className="primary" onClick={() => openCustomerModal()}><Plus size={16} /> Add Customer</button><button type="button" className="filter-drawer-trigger" onClick={() => { setFilterDraft(filters); setFilterOpen(true); }}><Filter size={16} /> Filters{listFilterCount > 0 && <span className="filter-count">{listFilterCount}</span>}</button><CsvExportButton onExport={exportCustomers} onError={setError} onSuccess={setMessage} /></AppBarActions></div><div className="supplier-table-card"><div className="supplier-table-wrap"><table className="supplier-table customer-index-table"><colgroup><col span="7" /><col className="table-action-column" /></colgroup><thead><tr><th>Customer</th><th>Phone</th><th>Address</th><th>Note</th><th>Sales</th><th>Balance</th><th>Last Sale</th><th>Actions</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.phone || '-'}{customer.email && <small className="customer-contact-email">{customer.email}</small>}</td><td>{customer.address || '-'}</td><td>{customer.note || '-'}</td><td>{customer.sale_count || 0}</td><td><strong>{money(customer.balance || 0)}</strong></td><td>{customer.last_sale || '-'}</td><td className="supplier-actions-cell"><CustomerRowActions customer={customer} deleting={deletingCustomerId === customer.id} onView={openCustomerDetail} onEdit={openCustomerModal} onRecordPayment={openPaymentModal} onPayments={(item) => openPaymentsPage(item, 'list')} onDelete={deleteCustomer} /></td></tr>)}</tbody></table>{loading && <TableLoadingState>Loading customers…</TableLoadingState>}{!customers.length && !loading && <EmptyState>No customers found.</EmptyState>}</div><TablePagination className="supplier-table-footer" page={page} pageSize={TABLE_PAGE_SIZE} total={customerTotal} loading={loading} onPageChange={setPage} /></div></div></section><FilterDrawer open={filterOpen} title="Customer filters" eyebrow="Filter" onClose={() => setFilterOpen(false)} busy={loading}><form className="drawer-filter-form" onSubmit={(event) => { event.preventDefault(); setFilters(filterDraft); setFilterOpen(false); }}><Field label="Account status"><select value={filterDraft.account_status} onChange={(e) => setFilterDraft({ ...filterDraft, account_status: e.target.value })}><option value="all">All account statuses</option><option value="receivable">Customer owes shop</option><option value="payable">Shop owes customer</option><option value="settled">Settled balance</option></select></Field><Field label="Sale activity"><select value={filterDraft.sale_activity} onChange={(e) => setFilterDraft({ ...filterDraft, sale_activity: e.target.value })}><option value="all">All customers</option><option value="with_sales">Has sales</option><option value="without_sales">No sales</option></select></Field><div className="drawer-filter-actions"><button type="button" onClick={() => { const next = blankCustomerFilters(); setFilterDraft(next); setFilters(next); setFilterOpen(false); }}>Clear</button><button type="submit" className="primary">Apply Filter</button></div></form></FilterDrawer>{editor}{paymentEditor}</>;
  };
  return <RetainedViews activeKey={navigation.view.kind === 'list' ? 'list' : `${navigation.view.kind}:${navigation.view.id}`}>{renderContent()}</RetainedViews>;
}

function Stat({ icon: Icon, label, value, tone = '' }) { return <article className={`product-stat-card supplier-stat-card ${tone}`}><span className="product-stat-icon"><Icon size={19} /></span><div><span>{label}</span><strong>{value}</strong></div></article>; }
