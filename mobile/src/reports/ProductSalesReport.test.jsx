import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ProductSalesReport } from './ProductSalesReport';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const row = id => ({ id, product_name: `Valve ${id}`, sku: `SKU-${id}`, category: 'Belts', sale_count: 2, quantity: 3.5, foc_quantity: .5, total: 340 });
const page = items => ({ items, total: 21, categories: ['Belts'], start: '2026-10-01', end: '2026-10-31', summary: { product_count: 21, quantity: 70, foc_quantity: 10, total: 7000 } });
beforeEach(() => {
  apiRequest.mockReset();
  window.history.replaceState({}, '', '/reports/product-sales?preset=custom&start=2026-10-01&end=2026-10-31');
  vi.stubGlobal('IntersectionObserver', undefined);
});

it('inherits the report period and appends unique cards without numbered pagination', async () => {
  apiRequest.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, i) => row(i + 1))));
  render(<ProductSalesReport session={{ business: { currency: 'Ks' } }} onBack={vi.fn()} />);
  await screen.findByText('Valve 20');
  expect(apiRequest.mock.calls[0][0]).toContain('start=2026-10-01');
  apiRequest.mockResolvedValueOnce(page([row(20), row(21)]));
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Valve 21');
  expect(screen.getAllByText('Valve 20')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  expect(apiRequest.mock.calls[1][0]).toContain('offset=20');
});

it('retains cards on an incremental error and retries the same offset', async () => {
  apiRequest.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, i) => row(i + 1))));
  render(<ProductSalesReport onBack={vi.fn()} />);
  await screen.findByText('Valve 20');
  apiRequest.mockRejectedValueOnce(new Error('Connection lost'));
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Connection lost');
  expect(screen.getByText('Valve 1')).toBeVisible();
  apiRequest.mockResolvedValueOnce(page([row(21)]));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Valve 21');
  expect(apiRequest.mock.calls[2][0]).toContain('offset=20');
});

it('recovers an initial failure into a complete empty state without load-more controls', async () => {
  apiRequest.mockRejectedValueOnce(new Error('Service unavailable'));
  render(<ProductSalesReport onBack={vi.fn()} />);
  await screen.findByText('Service unavailable');
  apiRequest.mockResolvedValueOnce({ ...page([]), total: 0, summary: { product_count: 0, quantity: 0, foc_quantity: 0, total: 0 } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry report' }));
  await screen.findByText('No product sales match these filters.');
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  expect(screen.queryByText('Service unavailable')).toBeNull();
});

it('applies draft filters at offset zero and keeps invalid date ranges local', async () => {
  apiRequest.mockResolvedValue(page([row(1)]));
  render(<ProductSalesReport onBack={vi.fn()} />);
  await screen.findByText('Valve 1');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'SKU-1' } });
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('alert')).toHaveTextContent('From date cannot be later');
  expect(apiRequest).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
  expect(apiRequest.mock.calls[1][0]).toContain('q=SKU-1');
  expect(apiRequest.mock.calls[1][0]).toContain('offset=0');
});
