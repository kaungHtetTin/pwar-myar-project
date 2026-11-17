import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineSalesPage } from './OfflineSalesPage';
import { getOfflineBootstrap, getOfflineData, listOfflineSales, retryOfflineSale } from '../offline/offlineStore';
import { syncMobileOfflineSales } from '../offline/offlineSales';
import { printHtmlDocument } from '../utils/printing';

vi.mock('../offline/offlineStore', () => ({ getOfflineBootstrap: vi.fn(), getOfflineData: vi.fn(), listOfflineSales: vi.fn(), retryOfflineSale: vi.fn() }));
vi.mock('../offline/offlineSales', () => ({ OFFLINE_STATE_EVENT: 'mkpos:mobile-offline-state', syncMobileOfflineSales: vi.fn() }));
vi.mock('../utils/printing', async original => ({ ...await original(), printHtmlDocument: vi.fn() }));
const pending = { id: 24, business_id: 1, status: 'pending', local_total: 49000, created_at: '2026-10-15T10:24:00', payload: { items: [{ product_name: 'Rice', quantity: 2, unit_price: 18500 }, { product_name: 'Oil', quantity: 1, unit_price: 8500 }, { product_name: 'Tea', quantity: 1, unit_price: 3500 }], payment_method: 'Cash' } };
const failed = { ...pending, id: 23, status: 'failed', error_message: 'Stock changed' };
const session = { business: { id: 1, name: 'Fixture shop', currency: 'MMK' } };
beforeEach(() => {
  vi.clearAllMocks();
  listOfflineSales.mockResolvedValue({ items: [pending, failed], total: 2 });
  getOfflineBootstrap.mockResolvedValue({ pending_count: 1, failed_count: 1, sale_counts: { pending: 1, syncing: 0, failed: 1, synced: 0 } });
  getOfflineData.mockResolvedValue({ settings: { currency: 'MMK' }, session });
  syncMobileOfflineSales.mockResolvedValue({ synced: 1, failed: 0 });
  retryOfflineSale.mockResolvedValue({ ...failed, status: 'pending' });
  printHtmlDocument.mockResolvedValue(true);
});
describe('offline sales reference flow', () => {
  it('disables sync while offline and preserves canonical receipt identities', async () => {
    render(<OfflineSalesPage offlineMode session={session} onNavigate={vi.fn()} />);
    await screen.findByText('OFF-000024');
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sync waiting sales from OFF-000024' })).toBeDisabled();
    const row = screen.getByText('OFF-000024').closest('article');
    expect(within(row).getByText('49,000 MMK')).toBeInTheDocument();
    expect(syncMobileOfflineSales).not.toHaveBeenCalled();
  });
  it('previews a local receipt without sending a sale or printing automatically', async () => {
    render(<OfflineSalesPage offlineMode session={session} onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'View local receipt OFF-000024' }));
    const preview = await screen.findByRole('dialog', { name: 'Local receipt' });
    expect(within(preview).getByTitle('Local receipt')).toHaveAttribute('sandbox', '');
    expect(within(preview).getByTitle('Local receipt').getAttribute('srcdoc')).toContain('receipt-shell');
    expect(within(preview).getByTitle('Local receipt').getAttribute('srcdoc')).not.toContain('window.print');
    expect(printHtmlDocument).not.toHaveBeenCalled();
    fireEvent.click(within(preview).getByRole('button', { name: 'Print receipt' }));
    await waitFor(() => expect(printHtmlDocument).toHaveBeenCalledTimes(1));
    expect(syncMobileOfflineSales).not.toHaveBeenCalled();
  });
  it('handles business mismatch without pretending that records synced', async () => {
    syncMobileOfflineSales.mockResolvedValue({ blocked: true });
    render(<OfflineSalesPage offlineMode={false} session={session} onNavigate={vi.fn()} />);
    await screen.findByText('OFF-000024');
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(await screen.findByText(/belong to another workspace/)).toBeInTheDocument();
    expect(syncMobileOfflineSales).toHaveBeenCalledWith({ businessId: 1, interactive: true });
  });
  it('queues a failed record for retry offline without trying to contact the server', async () => {
    render(<OfflineSalesPage offlineMode session={session} onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry OFF-000023' }));
    await waitFor(() => expect(retryOfflineSale).toHaveBeenCalledWith(23));
    expect(syncMobileOfflineSales).not.toHaveBeenCalled();
  });
  it('catches retry storage errors and retains the list', async () => {
    retryOfflineSale.mockRejectedValue(new Error('Device storage unavailable'));
    render(<OfflineSalesPage offlineMode session={session} onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry OFF-000023' }));
    expect(await screen.findByText('Device storage unavailable')).toBeInTheDocument();
    expect(screen.getByText('OFF-000024')).toBeInTheDocument();
  });
  it('sorts through the existing storage query and uses source-aware Back', async () => {
    const navigate = vi.fn();
    render(<OfflineSalesPage offlineMode session={session} onNavigate={navigate} />);
    await screen.findByText('OFF-000024');
    fireEvent.change(screen.getByRole('combobox', { name: 'Local sales order' }), { target: { value: 'oldest' } });
    await waitFor(() => expect(listOfflineSales).toHaveBeenLastCalledWith(expect.objectContaining({ ascending: true })));
    fireEvent.click(screen.getByRole('button', { name: 'Back to sell' }));
    expect(navigate).toHaveBeenCalledWith('/sell', { back: true });
  });
});
