import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedProductPage, createOfflineSale, getOfflineData } from '../offline/offlineStore';
import { SaleScreen } from './SaleScreen';

const { product } = vi.hoisted(() => ({ product: { id: 7, name: 'Cached Water', sku: 'CW-1', category: 'Drinks', base_unit: 'Bottle', price: 1000, cost: 700, stock: 20, prices: [{ name: 'Retail', price: 1000 }] } }));

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('../offline/offlineSales', () => ({
  OFFLINE_STATE_EVENT: 'mkpos:mobile-offline-state',
  announceOfflineDetected: vi.fn(),
  isConnectionFailure: (error) => !error?.status,
  syncMobileOfflineSales: vi.fn(),
}));
vi.mock('../offline/offlineStore', () => ({
  cachedProductPage: vi.fn().mockResolvedValue({ items: [product], total: 1 }),
  createOfflineSale: vi.fn(),
  getOfflineBootstrap: vi.fn().mockResolvedValue({ cache_ready: true, pending_count: 0, failed_count: 0 }),
  getOfflineData: vi.fn().mockResolvedValue({ settings: { price_types: 'Retail', payment_methods: 'Cash' }, categories: ['Drinks'], session: { business: { name: 'Offline Shop' } } }),
  listOfflineSales: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  offlinePaymentMethods: () => ['Cash'],
  retryOfflineSale: vi.fn(),
}));

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  createOfflineSale.mockResolvedValue({
    id: 4,
    status: 'pending',
    local_total: 2000,
    created_at: '2026-08-08T08:00:00.000Z',
    payload: { payment_method: 'Cash', discount: 0, items: [{ product_name: 'Cached Water', quantity: 2, unit_price: 1000 }] },
  });
});

describe('mobile offline sale flow', () => {
  it('uses cached Wholesale prices through offline checkout', async () => {
    const priced = { ...product, prices: [...product.prices, { name: 'Wholesale', price: 800 }] };
    cachedProductPage.mockResolvedValueOnce({ items: [priced], total: 1 });
    getOfflineData.mockResolvedValueOnce({ settings: { price_types: 'Retail,Wholesale', payment_methods: 'Cash' }, categories: ['Drinks'], products: [priced] });
    const view = render(<SaleScreen pathname="/sell" offlineMode />);
    fireEvent.click((await screen.findByText('Cached Water')).closest('button'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Price type' }), { target: { value: 'Wholesale' } });
    await screen.findByText('Non-Retail pricing');
    view.rerender(<SaleScreen pathname="/sell/checkout" offlineMode />);
    fireEvent.click(await screen.findByRole('button', { name: 'Complete sale (800 Ks)' }));
    await waitFor(() => expect(createOfflineSale).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ price_type: 'Wholesale', unit_price: 800 })] })));
  });
  it('uses cached products and saves a fully-paid walk-in invoice locally', async () => {
    const navigate = vi.fn();
    const view = render(<SaleScreen pathname="/sell" onNavigate={navigate} offlineMode session={{ business: { name: 'Offline Shop' } }} />);
    expect(await screen.findByText('Cached Water')).toBeInTheDocument();
    expect(screen.getByText('Offline mode')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cached Water').closest('button'));

    view.rerender(<SaleScreen pathname="/sell/cart" onNavigate={navigate} offlineMode session={{ business: { name: 'Offline Shop' } }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Increase Cached Water' }));
    view.rerender(<SaleScreen pathname="/sell/checkout" onNavigate={navigate} offlineMode session={{ business: { name: 'Offline Shop' } }} />);

    expect(await screen.findByText('Offline · fully paid sale')).toBeInTheDocument();
    expect(screen.getByText('Walk-in customer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale (2,000 Ks)' }));

    await waitFor(() => expect(createOfflineSale).toHaveBeenCalledWith(expect.objectContaining({ payment_method: 'Cash' })));
    expect(await screen.findByRole('heading', { name: 'Sale complete' })).toBeInTheDocument();
    expect(screen.getByText(/Saved safely on this device/)).toBeInTheDocument();
  });
});


it('passes name sorting to the offline product cache before pagination', async () => {
  render(<SaleScreen pathname="/sell" offlineMode />);
  await screen.findByText('Cached Water');
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  fireEvent.click(screen.getByRole('radio', { name: 'Name Z-A' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(cachedProductPage).toHaveBeenCalledWith(expect.objectContaining({ sort: 'name_desc', offset: 0 })));
});
