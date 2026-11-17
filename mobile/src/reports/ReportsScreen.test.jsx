import { SwipeRefreshShell } from '../navigation/SwipeRefreshShell';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiRequest } from '../api/client';
import { saveCsvFile } from '../utils/csvExport';
import { ReportsScreen } from './ReportsScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
vi.mock('../utils/csvExport', () => ({ saveCsvFile: vi.fn() }));

beforeEach(() => {
  apiRequest.mockReset();
  apiDownload.mockReset();
  saveCsvFile.mockReset();
  apiRequest.mockResolvedValue({
    start: '2026-08-08', end: '2026-08-08', sales_count: 0, sales_total: 0,
    cash_total: 0, credit_total: 0, expense_total: 0, profit_estimate: 0,
    payment_methods: [], top_products: [], expense_categories: [], cash_movement: {},
    current_accounts: { as_of: '2026-08-08', receivable_total: 0, payable_total: 0, customers_owing: 0, open_accounts: 0 },
    inventory_valuation: { as_of: '2026-08-08', product_count: 2, stock_units: 12, investment_value: 8400, potential_sales_value: 15000 },
    sales_trends: {
      month: { label: 'August 2026', items: [{ label: '1', total: 1200 }, { label: '2', total: 0 }] },
      year: { label: '2026', items: [{ label: 'Jan', total: 4200 }, { label: 'Feb', total: 0 }] },
    },
  });
});

describe('mobile reports screen', () => {
  it('renders accessible, styled date controls and loads the selected period', async () => {
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);

    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByLabelText('From')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('To')).toHaveAttribute('type', 'date');
    expect(screen.getByRole('button', { name: 'Export CSV' }).closest('header')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' }).closest('.report-filter-toolbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters' }).closest('.report-filter-controls')).toBeInTheDocument();
    expect(document.querySelector('.report-filter')).not.toBeInTheDocument();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('/reports/summary?start=')));
    expect(screen.getByText('Current inventory value')).toBeInTheDocument();
    expect(screen.getByText('Current stock investment')).toBeInTheDocument();
    expect(screen.getByText('Potential sales value')).toBeInTheDocument();
    expect(screen.getByText('8,400 Ks')).toBeInTheDocument();
    expect(screen.getByText('15,000 Ks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(screen.getByRole('list', { name: 'Sales of Month for August 2026' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: '1: 1,200 Ks' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));
    expect(screen.getByRole('list', { name: 'Sales of Year for 2026' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Jan: 4,200 Ks' })).toBeInTheDocument();
  });

  it('keeps date drafts and presets unapplied until Apply, and discards them on Cancel', async () => {
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    const calls = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Last month' }));
    expect(apiRequest).toHaveBeenCalledTimes(calls);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByLabelText('From')).not.toHaveValue('2026-01-01');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/reports/summary?start=2026-01-01&end=2026-01-31'));
    await waitFor(() => expect(screen.queryByLabelText('From')).not.toBeInTheDocument());
  });

  it('blocks reversed date ranges without requesting or dismissing the drawer', async () => {
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    const calls = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('From date cannot be later than To date.')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledTimes(calls);
    expect(screen.getByLabelText('From')).toHaveValue('2026-12-31');
  });

  it('retains report data on failed refresh and retries without resetting trend selection', async () => {
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }));
    apiRequest.mockRejectedValueOnce(new Error('Network unavailable'));
    pullToRefresh();
    expect(await screen.findByText('Could not refresh.')).toBeInTheDocument();
    expect(screen.getByText('8,400 Ks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yearly' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Could not refresh.')).not.toBeInTheDocument());
  });

  it('preserves the last successful export scope when a filter request fails', async () => {
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    const original = apiRequest.mock.calls[0][0].replace('/summary?', '/summary.csv?');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    apiRequest.mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('Cannot apply filters. Try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    apiDownload.mockResolvedValue({ text: async () => 'Report,Value' });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(apiDownload).toHaveBeenCalledWith(original, { accept: 'text/csv' }));
  });

  it('saves the authenticated report response through the shared platform file flow', async () => {
    apiDownload.mockResolvedValue({ text: vi.fn().mockResolvedValue('\ufeffReport,Value\r\nSales,1000\r\n') });
    saveCsvFile.mockResolvedValue(undefined);
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(apiDownload).toHaveBeenCalledWith(expect.stringContaining('/reports/summary.csv?'), { accept: 'text/csv' }));
    expect(saveCsvFile).toHaveBeenCalledWith(expect.stringMatching(/^mkpos-report-\d{4}-\d{2}-\d{2}\.csv$/), expect.stringContaining('Sales,1000'));
    expect(await screen.findByText('Report CSV is ready to save or share.')).toBeInTheDocument();
  });

  it('shows payment receipts separately from sales totals and keeps account directions distinct', async () => {
    const base = await apiRequest(); apiRequest.mockClear();
    apiRequest.mockResolvedValue({ ...base, cash_total: 600, credit_total: 400, sales_total: 1000,
      payment_methods: [{ payment_method: 'Cash', count: 1, total: 1000, paid_total: 600, credit_total: 400 }],
      current_accounts: { as_of: '2026-08-08', receivable_total: 110, supplier_payable_total: 220, customer_payable_total: 330, supplier_credit_total: 440 },
    });
    render(<ReportsScreen session={{ business: { currency: 'MMK' } }} />);
    expect(await screen.findByRole('img', { name: 'Paid 60%, Credit 40%' })).toBeInTheDocument();
    const row = screen.getByText('Cash', { exact: true }).closest('article');
    expect(row.querySelector('b')).toHaveTextContent('600 MMK');
    expect(row).toHaveTextContent('Sales total 1,000 MMK');
    expect(screen.getByText('Shop owes suppliers').parentElement).toHaveTextContent('220 MMK');
    expect(screen.getByText('Shop owes customers').parentElement).toHaveTextContent('330 MMK');
    expect(screen.getByText('Supplier credit').parentElement).toHaveTextContent('440 MMK');
  });

  it('blocks repeated CSV export while saving, and permits retry after failure', async () => {
    let rejectDownload;
    apiDownload.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectDownload = reject; }));
    render(<SwipeRefreshShell><ReportsScreen /></SwipeRefreshShell>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    const button = screen.getByRole('button', { name: 'Export CSV' });
    fireEvent.click(button); fireEvent.click(button);
    expect(apiDownload).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    rejectDownload(new Error('Download unavailable'));
    expect(await screen.findByText('Download unavailable')).toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
    apiDownload.mockResolvedValue({ text: async () => 'Report,Value' });
    fireEvent.click(button);
    expect(await screen.findByText('Report CSV is ready to save or share.')).toBeInTheDocument();
  });
});

function pullToRefresh() { const shell = screen.getByRole('region', {name:'Pull to refresh page'}); fireEvent.touchStart(shell, {touches:[{clientY:10}]}); fireEvent.touchMove(shell, {touches:[{clientY:180}]}); fireEvent.touchEnd(shell); }
