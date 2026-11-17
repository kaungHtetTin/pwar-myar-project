import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOfflineBootstrap,
  listOfflineSales,
  markOfflineSaleFailed,
  markOfflineSalePending,
  markOfflineSaleSynced,
  markOfflineSaleSyncing,
} from './offlineStore';
import { syncMobileOfflineSales } from './offlineSales';

vi.mock('./offlineStore', () => ({
  getOfflineBootstrap: vi.fn(),
  listOfflineSales: vi.fn(),
  markOfflineSaleFailed: vi.fn(),
  markOfflineSalePending: vi.fn(),
  markOfflineSaleSynced: vi.fn(),
  markOfflineSaleSyncing: vi.fn(),
  offlineStorageAvailable: () => true,
  replaceOfflineCache: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getOfflineBootstrap.mockResolvedValue({ pending_count: 0, failed_count: 0 });
});

describe('offline sale synchronization', () => {
  it('continues after a record rejection and syncs the next invoice FIFO', async () => {
    const sales = [{ id: 1, payload: { offline_sale_uuid: 'a' } }, { id: 2, payload: { offline_sale_uuid: 'b' } }];
    listOfflineSales.mockResolvedValue({ items: sales, total: 2 });
    const rejected = Object.assign(new Error('Stock changed'), { status: 422 });
    const sendSale = vi.fn().mockRejectedValueOnce(rejected).mockResolvedValueOnce({ id: 22, receipt_no: 'S-22' });

    const result = await syncMobileOfflineSales({ sendSale });

    expect(markOfflineSaleSyncing.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(markOfflineSaleFailed).toHaveBeenCalledWith(1, 'Stock changed');
    expect(markOfflineSaleSynced).toHaveBeenCalledWith(2, { id: 22, receipt_no: 'S-22' });
    expect(result).toMatchObject({ processed: 2, synced: 1, failed: 1, interrupted: false });
  });

  it('returns the active invoice to pending and stops on a connection failure', async () => {
    listOfflineSales.mockResolvedValue({ items: [{ id: 1, payload: {} }, { id: 2, payload: {} }], total: 2 });
    const sendSale = vi.fn().mockRejectedValue(new Error('Network unavailable'));

    const result = await syncMobileOfflineSales({ sendSale });

    expect(markOfflineSalePending).toHaveBeenCalledWith(1, 'Network unavailable');
    expect(markOfflineSaleSyncing).toHaveBeenCalledTimes(1);
    expect(result.interrupted).toBe(true);
  });

  it('does not send queued invoices through a different business session', async () => {
    listOfflineSales.mockResolvedValue({ items: [{ id: 1, business_id: 9, payload: {} }], total: 1 });
    const sendSale = vi.fn();

    const result = await syncMobileOfflineSales({ businessId: 12, sendSale });

    expect(result.blocked).toBe(true);
    expect(sendSale).not.toHaveBeenCalled();
    expect(markOfflineSaleSyncing).not.toHaveBeenCalled();
  });
});
