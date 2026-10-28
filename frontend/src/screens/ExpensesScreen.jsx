import { useAiPageLink, returnFromAiPage } from '../ai/useAiPageLink';
import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Edit,
  Filter,
  Plus,
  Search,
  Tag,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { request } from '../api';
import { RowActions } from '../components/RowActions';
import { actionLabel, formatDateInput, money, normalizeNumber } from '../utils';
import { EmptyState, Field, FilterDrawer, Modal, TableLoadingState, TablePagination } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useConfirmation } from '../components/confirmations';
import { emitDataChange, useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { dateRangeError, presetDateFromTo } from '../dateRanges';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { TABLE_PAGE_SIZE } from '../tablePagination';

function blankFilters() {
  return {
    preset: 'today',
    q: '',
    category: '',
    payment_method: '',
    date_from: formatDateInput(new Date()),
    date_to: formatDateInput(new Date()),
  };
}

function blankForm() {
  return {
    expense_date: formatDateInput(new Date()),
    title: '',
    category: '',
    amount: '',
    payment_method: 'Cash',
    note: '',
  };
}

function expensePath(filters, offset = 0) {
  const params = new URLSearchParams();
  params.set('status', 'completed');
  params.set('limit', String(TABLE_PAGE_SIZE));
  params.set('offset', String(offset));
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.payment_method) params.set('payment_method', filters.payment_method);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return `/expenses?${params.toString()}`;
}

function expenseSummaryPath(filters) {
  const params = new URLSearchParams();
  params.set('status', 'completed');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.payment_method) params.set('payment_method', filters.payment_method);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return `/expenses/summary?${params.toString()}`;
}

function cleanPaymentMethods(settings) {
  const fallback = ['Cash', 'Wallet Pay', 'Banking Pay', 'KPay', 'Wave Pay'];
  const rows = String(settings.payment_methods || '').split(',').map((item) => item.trim()).filter(Boolean);
  return (rows.length ? rows : fallback).filter((method) => method !== 'Credit');
}

export function ExpensesScreen() {
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({});
  const [summary, setSummary] = useState({ today_total: 0, month_total: 0, filter_total: 0, matching_count: 0, top_category: null });
  const [filters, setFilters] = useState(blankFilters());
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blankForm());
  const [editingExpense, setEditingExpense] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const loadSequence = React.useRef(0);
  const { setMessage, setError } = useScreenNotifications();
  const confirmAction = useConfirmation();

  const paymentMethods = useMemo(() => cleanPaymentMethods(settings), [settings]);
  const categories = useMemo(() => (
    [...new Set(expenses.map((expense) => expense.category).filter(Boolean))].sort()
  ), [expenses]);
  const activeFilterCount = [
    filters.q.trim(),
    filters.category,
    filters.payment_method,
    filters.preset !== 'today' ? filters.preset : '',
  ].filter(Boolean).length;

  function exportExpenses() {
    const url = new URL(expensePath(filters), window.location.origin);
    url.searchParams.delete('limit');
    url.searchParams.delete('offset');
    return exportFilteredCsv({
      path: `${url.pathname}${url.search}`,
      filename: csvFilename('expenses'),
      emptyMessage: 'No expenses match the current filters.',
      columns: [
        { label: 'Date', value: (row) => row.expense_date }, { label: 'Title', value: (row) => row.title },
        { label: 'Category', value: (row) => row.category || '' }, { label: 'Payment Method', value: (row) => row.payment_method || '' },
        { label: 'Amount', value: (row) => row.amount }, { label: 'Note', value: (row) => row.note || '' },
        { label: 'Status', value: (row) => row.status || 'completed' },
      ],
    });
  }

  async function loadExpenses(nextFilters = filters, options = {}) {
    const rangeError = dateRangeError(nextFilters.date_from, nextFilters.date_to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const sequence = ++loadSequence.current;
    const nextPage = options.page || 1;
    const pageSize = TABLE_PAGE_SIZE;
    const nextOffset = (nextPage - 1) * pageSize;
    setLoading(true);
    setError('');
    try {
      const [expenseRows, summaryRows, settingRows] = await Promise.all([
        request(expensePath(nextFilters, nextOffset)),
        request(expenseSummaryPath(nextFilters)),
        request('/settings'),
      ]);
      if (sequence !== loadSequence.current) return;
      setSettings(settingRows);
      setSummary(summaryRows);
      setExpenses(expenseRows);
      setPage(nextPage);
    } catch (err) {
      if (sequence === loadSequence.current) setError(`Cannot load expenses. ${err.message}`);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  useLatestEffect(() => {
    loadExpenses();
  }, []);

  useDataRefresh(['expenses', 'settings'], 'expenses', () => loadExpenses(filters, { page }));

  function setPreset(preset) {
    const next = { ...filters, preset, ...presetDateFromTo(preset) };
    setFilters(next);
    loadExpenses(next);
  }

  function resetForm() {
    setForm(blankForm());
    setEditingExpense(null);
    setFormOpen(false);
    returnFromAiPage('expenses_new');
  }

  useAiPageLink('expenses', target => { if (target.action === 'new' && !formOpen) addExpense(); }, !loading);

  function addExpense() {
    setEditingExpense(null);
    setForm({ ...blankForm(), payment_method: paymentMethods[0] || 'Cash' });
    setFormOpen(true);
  }

  function editExpense(expense) {
    setEditingExpense(expense);
    setForm({
      expense_date: expense.expense_date || formatDateInput(new Date()),
      title: expense.title || '',
      category: expense.category || '',
      amount: expense.amount || '',
      payment_method: expense.payment_method || paymentMethods[0] || 'Cash',
      note: expense.note || '',
    });
    setFormOpen(true);
  }

  async function saveExpense(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    const amount = Math.round(normalizeNumber(form.amount, NaN));
    const payload = {
      expense_date: form.expense_date || formatDateInput(new Date()),
      title: String(form.title || '').trim(),
      category: String(form.category || '').trim(),
      amount,
      payment_method: form.payment_method || paymentMethods[0] || 'Cash',
      note: String(form.note || '').trim(),
    };
    if (!payload.title) {
      setError('Expense title is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Expense amount must be greater than zero.');
      return;
    }
    try {
      setSaving(true);
      await request(editingExpense ? `/expenses/${editingExpense.id}` : '/expenses', {
        method: editingExpense ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(editingExpense ? 'Expense updated.' : 'Expense added.');
      resetForm();
      await loadExpenses(filters, { page });
      emitDataChange(['expenses', 'reports'], 'expenses');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expense) {
    const { confirmed, pin: adminPin } = await confirmAction({
      title: 'Delete expense',
      message: `Delete expense "${expense.title}"? It will be removed from reports and history.`,
      confirmLabel: 'Delete Expense',
      requirePin: true,
    });
    if (!confirmed) return;
    setDeletingId(expense.id);
    setError('');
    try {
      await request(`/expenses/${expense.id}`, {
        method: 'DELETE',
        ...(adminPin ? { body: JSON.stringify({ admin_pin: adminPin }) } : {}),
      });
      setMessage('Expense deleted.');
      await loadExpenses(filters, { page });
      emitDataChange(['expenses', 'reports'], 'expenses');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    loadExpenses(filters);
    setFilterOpen(false);
  }

  function clearFilters() {
    const next = blankFilters();
    setFilters(next);
    loadExpenses(next);
    setFilterOpen(false);
  }

  return (
    <section className="screen expenses-layout mkpos-sheet">

      <div className="expense-main-panel">
        <div className="expense-overview">
          <div className="expense-overview-heading">
            <div>
              <strong>Expense overview</strong>
              <span>{summary.matching_count || 0} records in the current view</span>
            </div>
            <AppBarActions className="expense-overview-actions">
              <button type="button" className="primary" onClick={addExpense}><Plus size={17} /> Add Expense</button>
              <button type="button" className="filter-drawer-trigger" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}>
                <Filter size={16} /> Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
              <CsvExportButton onExport={exportExpenses} onError={setError} onSuccess={setMessage} />
            </AppBarActions>
            <AppBarSearch><form onSubmit={applyFilters}><label><Search size={16} /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search expense title, category, or note" aria-label="Search expenses" /></label></form></AppBarSearch>
          </div>

          <div className="expense-summary-row">
            <div className="expense-summary-card expense-summary-today">
              <span className="expense-summary-icon"><CalendarDays size={19} /></span>
              <span>Today</span>
              <strong>{money(summary.today_total)}</strong>
            </div>
            <div className="expense-summary-card expense-summary-month">
              <span className="expense-summary-icon"><CalendarRange size={19} /></span>
              <span>This Month</span>
              <strong>{money(summary.month_total)}</strong>
            </div>
            <div className="expense-summary-card expense-summary-filtered">
              <span className="expense-summary-icon"><WalletCards size={19} /></span>
              <span>Filtered Total</span>
              <strong>{money(summary.filter_total)}</strong>
            </div>
            <div className="expense-summary-card expense-summary-category">
              <span className="expense-summary-icon"><Tag size={19} /></span>
              <span>Top Category</span>
              <strong>{summary.top_category?.category || 'No category'}</strong>
            </div>
          </div>
        </div>

        <div className="expense-table-card">
          <div className="expense-table-wrap">
            {loading && <TableLoadingState>Loading expenses…</TableLoadingState>}
              <table className="expense-table">
                <colgroup><col span="6" /><col className="table-action-column" /></colgroup>
              <thead>
                <tr><th>Date</th><th>Title</th><th>Category</th><th>Payment</th><th>Amount</th><th>Note</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.expense_date}</td>
                    <td><strong>{expense.title}</strong></td>
                    <td><span className="expense-category-label">{expense.category || 'Uncategorized'}</span></td>
                    <td><span className="expense-payment-label">{expense.payment_method || '-'}</span></td>
                    <td className="expense-amount-cell">{money(expense.amount)}</td>
                    <td>{expense.note || '-'}</td>
                    <td>
                      <RowActions label={expense.title}>
                        <button type="button" aria-label={`Edit ${expense.title}`} title="Edit expense" onClick={() => editExpense(expense)}><Edit size={15} /> Edit expense</button>
                        <button type="button" className="danger-button" aria-label={`Delete ${expense.title}`} title="Delete expense" disabled={deletingId === expense.id} onClick={() => deleteExpense(expense)}><Trash2 size={15} /> Delete expense</button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!expenses.length && !loading && (
              <EmptyState>
                <span className="expense-empty-icon"><WalletCards size={24} /></span>
                <strong>No expenses found</strong>
                <span>Change the filters or add the first expense for this period.</span>
                <button type="button" className="primary" onClick={addExpense}><Plus size={15} /> Add Expense</button>
              </EmptyState>
            )}
          </div>
          <TablePagination className="expense-table-footer" page={page} pageSize={TABLE_PAGE_SIZE} total={summary.matching_count || 0} loading={loading} onPageChange={(nextPage) => loadExpenses(filters, { page: nextPage })} />
        </div>
      </div>

      <FilterDrawer open={filterOpen} title="Expense filters" onClose={() => setFilterOpen(false)} busy={loading}>
        <form className="drawer-filter-form expense-filter-card" onSubmit={applyFilters}>
          <div className="purchase-quick-ranges">
            {[
              ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year'], ['all', 'All Time'],
            ].map(([preset, label]) => (
              <button key={preset} type="button" className={filters.preset === preset ? 'selected' : ''} onClick={() => setPreset(preset)}>{label}</button>
            ))}
          </div>
          <Field label="Category">
            <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
              <option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Payment">
            <select value={filters.payment_method} onChange={(event) => setFilters({ ...filters, payment_method: event.target.value })}>
              <option value="">All methods</option>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, preset: 'custom', date_from: event.target.value })} /></Field>
          <Field label="To"><input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, preset: 'custom', date_to: event.target.value })} /></Field>
          <div className="drawer-filter-actions">
            <button type="button" onClick={clearFilters} disabled={loading}>Clear</button>
            <button type="submit" className="primary" disabled={loading}>Apply Filter</button>
          </div>
        </form>
      </FilterDrawer>

        <Modal open={formOpen} title={editingExpense ? 'Edit Expense' : 'Add Expense'} onClose={resetForm} busy={saving} size="medium" footer={<><button type="button" onClick={resetForm}>Cancel</button><button type="submit" form="expense-editor-form" className="primary" disabled={saving}>{actionLabel(saving, 'Saving...', editingExpense ? 'Update Expense' : 'Add Expense')}</button></>}>
        <form id="expense-editor-form" className="expense-modal-form" onSubmit={saveExpense}>
          <Field label="Date">
            <input type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} />
          </Field>
          <Field label="Title">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="Category">
            <input list="expense-categories-modal" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          </Field>
          <Field label="Amount">
            <input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </Field>
          <Field label="Payment">
            <select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>
              {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </Field>
          <Field label="Note">
            <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
          <datalist id="expense-categories-modal">
            {categories.map((category) => <option key={category} value={category} />)}
          </datalist>
        </form>
      </Modal>
    </section>
  );
}
