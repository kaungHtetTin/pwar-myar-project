import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ProductSalesReport } from './ProductSalesReport';
import { NotificationProvider } from '../components/notifications';
import { ReportsScreen } from './ReportsScreen';

vi.mock('../api', () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const period = { preset: 'custom', start: '2026-10-01', end: '2026-10-31' };
const payload = { items: [{ id: 1, product_name: 'Test valve', sku: 'AB1', category: 'Belts', sale_count: 2, quantity: 3.5, foc_quantity: 1.5, total: 340 }], total: 30, categories: ['Belts'], start: period.start, end: period.end, summary: { product_count: 30, quantity: 3.5, foc_quantity: 1.5, total: 340 } };
beforeEach(() => { request.mockReset(); window.history.replaceState({}, '', '/'); });

it('loads aligned placeholders, applies filters explicitly and paginates on the server', async () => {
  let release;
  request.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const { container } = render(<ProductSalesReport period={period} onBack={vi.fn()} />);
  expect(container.querySelectorAll('thead th')).toHaveLength(7);
  expect(container.querySelectorAll('.table-skeleton-row')).toHaveLength(6);
  await act(async () => release(payload));
  expect(screen.getByText('Test valve')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'AB1' } });
  expect(request).toHaveBeenCalledTimes(1);
  request.mockResolvedValue(payload);
  fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'sales_desc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(request).toHaveBeenLastCalledWith(expect.stringContaining('q=AB1')));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(request).toHaveBeenLastCalledWith(expect.stringContaining('offset=25')));
});

it('validates dates without a request and retains rows after refresh failure', async () => {
  request.mockResolvedValue(payload);
  render(<ProductSalesReport period={period} onBack={vi.fn()} />);
  await screen.findByText('Test valve');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('alert')).toHaveTextContent('From date cannot be later');
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  request.mockRejectedValueOnce(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('Unavailable');
  expect(screen.getByText('Test valve')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Retry report' })).toBeEnabled();
  request.mockResolvedValueOnce(payload);
  fireEvent.click(screen.getByRole('button', { name: 'Retry report' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByText('Unavailable')).toBeNull());
});

it('opens a direct all-time report link without loading the overview first', async () => {
  window.history.replaceState({}, '', '/?page=reports&report=product-sales&ps_preset=all');
  request.mockResolvedValue({ ...payload, all_time: true });
  render(<NotificationProvider><ReportsScreen /></NotificationProvider>);
  await screen.findByText('Test valve');
  expect(request.mock.calls.filter(([path]) => path.startsWith('/reports/summary'))).toHaveLength(0);
  expect(request.mock.calls[0][0]).toContain('all_time=true');
});

it('returns from See more with the overview retained and no new summary request', async () => {
  const summary = { start: period.start, end: period.end, top_products: [], sales_trends: {}, inventory_valuation: {}, current_accounts: {} };
  request.mockImplementation(path => Promise.resolve(path.startsWith('/reports/products') ? payload : summary));
  const { container } = render(<NotificationProvider><ReportsScreen /></NotificationProvider>);
  const more = await screen.findByRole('button', { name: 'See more' });
  const original = container.querySelector('.report-main-panel');
  fireEvent.click(more);
  await screen.findByText('Test valve');
  expect(window.location.search).toContain('report=product-sales');
  expect(request.mock.calls.find(([path]) => path.startsWith('/reports/products'))[0]).toContain('start=2026-10-01');
  fireEvent.click(screen.getByRole('button', { name: 'Back to Reports' }));
  await waitFor(() => expect(more).toBeVisible());
  expect(container.querySelector('.report-main-panel')).toBe(original);
  expect(request.mock.calls.filter(([path]) => path.startsWith('/reports/summary'))).toHaveLength(1);
});
