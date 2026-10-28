import { calendarRange } from '../timezone';
export const EMPTY_EXPENSE_SUMMARY = { today_total: 0, month_total: 0, filter_total: 0, matching_count: 0, top_category: null };

export function formatDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function expensePresetRange(preset, now = new Date()) {
  const range = calendarRange(preset, now);
  return { date_from: range.start, date_to: range.end };
}

export function blankExpenseFilters(now = new Date()) {
  return { preset: 'today', q: '', category: '', payment_method: '', ...expensePresetRange('today', now) };
}

export function blankExpenseForm(now = new Date()) {
  return { expense_date: formatDateInput(now), title: '', category: '', amount: '', payment_method: 'Cash', note: '' };
}

export function expensePageFromPath(pathname) {
  if (pathname === '/expenses/new') return { kind: 'new', expenseId: null };
  const edit = pathname.match(/^\/expenses\/(\d+)\/edit$/);
  if (edit) return { kind: 'edit', expenseId: Number(edit[1]) };
  return { kind: 'list', expenseId: null };
}

function appendExpenseFilters(params, filters) {
  params.set('status', 'completed');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category.trim()) params.set('category', filters.category.trim());
  if (filters.payment_method) params.set('payment_method', filters.payment_method);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return params;
}

export function expenseListPath(filters, limit, offset) {
  const params = appendExpenseFilters(new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) }), filters);
  return `/expenses?${params}`;
}

export function expenseSummaryPath(filters) {
  return `/expenses/summary?${appendExpenseFilters(new URLSearchParams(), filters)}`;
}

export function expensePayload(form) {
  return {
    expense_date: form.expense_date || formatDateInput(new Date()),
    title: String(form.title || '').trim(),
    category: String(form.category || '').trim(),
    amount: Math.round(Number(form.amount)),
    payment_method: String(form.payment_method || 'Cash').trim() || 'Cash',
    note: String(form.note || '').trim(),
  };
}

export function cleanExpensePaymentMethods(settings) {
  const fallback = ['Cash', 'Wallet Pay', 'Banking Pay', 'KPay', 'Wave Pay'];
  const methods = String(settings?.payment_methods || '').split(',').map((item) => item.trim()).filter(Boolean);
  return (methods.length ? methods : fallback).filter((method) => method.toLowerCase() !== 'credit');
}

export function expenseDateError(filters) {
  return filters.date_from && filters.date_to && filters.date_from > filters.date_to ? 'From date cannot be later than To date.' : '';
}
