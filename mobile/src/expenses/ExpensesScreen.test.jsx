import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ExpensesScreen } from './ExpensesScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

const expense = { id: 5, expense_date: '2026-08-08', title: 'Shop rent', category: 'Rent', amount: 50000, payment_method: 'Cash', note: 'August rent', status: 'completed' };
const summary = { today_total: 50000, month_total: 75000, filter_total: 50000, matching_count: 1, top_category: { category: 'Rent', count: 1, total: 50000 } };
let adminPinSet = '1';

function expenseApi(path, options = {}) {
  if (path.startsWith('/expenses?')) return Promise.resolve({ items: [expense], total: 1, limit: 20, offset: 0 });
  if (path.startsWith('/expenses/summary?')) return Promise.resolve(summary);
  if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash, Credit, KPay', admin_pin_set: adminPinSet });
  if (path === '/expenses/5' && !options.method) return Promise.resolve(expense);
  if (path === '/expenses' && options.method === 'POST') return Promise.resolve(expense);
  if (path === '/expenses/5' && options.method === 'PUT') return Promise.resolve(expense);
  if (path === '/expenses/5' && options.method === 'DELETE') return Promise.resolve({ id: 5, deleted: true });
  return Promise.resolve({});
}

beforeEach(() => {
  adminPinSet = '1';
  apiRequest.mockReset();
  apiRequest.mockImplementation(expenseApi);
});

it('clears a confirmed expense even if the summary refresh fails afterward', async () => {
  let saved = false;
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === '/expenses' && options.method === 'POST') { saved = true; return Promise.resolve(expense); }
    if (saved && path.startsWith('/expenses/summary?')) return Promise.reject(new Error('Summary unavailable'));
    return expenseApi(path, options);
  });
  const navigate = vi.fn();
  render(<ExpensesScreen pathname="/expenses/new" onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'First expense' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/expenses', { back: true }));
  expect(screen.getByLabelText('Title')).toHaveValue('');
  expect(screen.getByLabelText('Amount')).toHaveValue(null);
  expect(screen.queryByText('Summary unavailable')).not.toBeInTheDocument();
});

describe('mobile expenses workspace', () => {
  it('renders summary metrics and an endless expense history', async () => {
    render(<ExpensesScreen />);
    expect(await screen.findByText('Shop rent')).toBeInTheDocument();
    expect(screen.getAllByText('50,000 Ks').length).toBeGreaterThan(0);
    expect(screen.getByText('75,000 Ks')).toBeInTheDocument();
    expect(screen.getByText('1 records')).toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/expenses?') && path.includes('with_total=true') && path.includes('offset=0'))).toBe(true);
  });

  it('creates expenses on a dedicated full page with validation', async () => {
    render(<ExpensesScreen />);
    await screen.findByText('Shop rent');
    fireEvent.click(screen.getByRole('button', { name: 'New expense' }));
    expect(screen.getByRole('heading', { name: 'New expense' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(screen.getByText('Expense title is required.')).toBeInTheDocument();
    expect(screen.getByText('Expense amount must be a whole number greater than zero.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Shop rent ' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/expenses', expect.objectContaining({ method: 'POST', body: expect.stringContaining('Shop rent') })));
    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument();
  });

  it('loads direct edit links from the single-expense endpoint', async () => {
    render(<ExpensesScreen pathname="/expenses/5/edit" onNavigate={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Edit expense' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Shop rent');
    expect(screen.getByLabelText('Amount')).toHaveValue(50000);
    expect(apiRequest).toHaveBeenCalledWith('/expenses/5', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('applies date, category, and payment filters from offset zero', async () => {
    const { container } = render(<ExpensesScreen />);
    await screen.findByText('Shop rent');
    const filterToggle = screen.getByRole('button', { name: 'Filters' });
    const controlRow = container.querySelector('.expense-control-row');
    expect(controlRow).toContainElement(filterToggle);
    expect(screen.getByRole('button', { name: 'Export CSV' }).closest('header')).toBeInTheDocument();
    fireEvent.click(filterToggle);
    const panel = container.querySelector('.expense-filter-panel');
    expect(panel).toHaveClass('product-filter-panel');
    expect(panel.querySelectorAll('.product-filter-field')).toHaveLength(2);
    const fromField = screen.getByLabelText('From').closest('.product-filter-date');
    const toField = screen.getByLabelText('To').closest('.product-filter-date');
    expect(fromField).toBeInTheDocument();
    expect(toField).toBeInTheDocument();
    expect(fromField.querySelector('svg')).not.toBeInTheDocument();
    expect(toField.querySelector('svg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Rent', exact: true }));
    fireEvent.click(screen.getByRole('radio', { name: 'KPay', exact: true }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-08' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply filters/ }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('/expenses?') && path.includes('category=Rent') && path.includes('payment_method=KPay') && path.includes('offset=0'))).toBe(true));
  });

  it('requires an admin PIN before deleting an expense', async () => {
    render(<ExpensesScreen />);
    await screen.findByText('Shop rent');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop rent' }));
    expect(screen.getByRole('dialog', { name: 'Expense actions' })).toHaveClass('mobile-sheet--action-menu');
    expect(document.querySelector('.mobile-action-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Shop rent' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('permanently removed from history and reports');
    fireEvent.change(screen.getByLabelText('Admin PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/expenses/5', { method: 'DELETE', body: JSON.stringify({ admin_pin: '1234' }) }));
  });

  it('skips the admin PIN field when protection is not configured', async () => {
    adminPinSet = '0';
    render(<ExpensesScreen />);
    await screen.findByText('Shop rent');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop rent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Shop rent' }));

    await screen.findByRole('button', { name: 'Delete expense' });
    expect(screen.queryByLabelText('Admin PIN')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete expense' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/expenses/5', { method: 'DELETE' }));
  });
});
