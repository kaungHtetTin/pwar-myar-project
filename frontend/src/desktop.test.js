import { describe, expect, it, vi } from 'vitest';
import { cachedProductPrice, offlinePaymentMethods, syncOfflineSales } from './desktop';

function bridgeWithQueue(queue) {
  return {
    listOfflineSales: vi.fn().mockResolvedValue(queue),
    markSaleSyncing: vi.fn().mockResolvedValue(null),
    markSaleSynced: vi.fn().mockResolvedValue(null),
    markSaleFailed: vi.fn().mockResolvedValue(null),
    markSalePending: vi.fn().mockResolvedValue(null),
  };
}

describe('desktop offline synchronization', () => {
  it('continues in order after a rejected record and leaves that record failed', async () => {
    const queue = [
      { id: 1, payload: { offline_sale_uuid: 'first' } },
      { id: 2, payload: { offline_sale_uuid: 'second' } },
      { id: 3, payload: { offline_sale_uuid: 'third' } },
    ];
    const bridge = bridgeWithQueue(queue);
    const sendSale = vi.fn(async (payload) => {
      if (payload.offline_sale_uuid === 'second') {
        const error = new Error('Product was deleted');
        error.status = 422;
        throw error;
      }
      return { id: payload.offline_sale_uuid === 'first' ? 101 : 103, receipt_no: 'RECEIPT' };
    });

    const result = await syncOfflineSales({ bridge, sendSale });

    expect(sendSale.mock.calls.map(([payload]) => payload.offline_sale_uuid)).toEqual(['first', 'second', 'third']);
    expect(bridge.markSaleFailed).toHaveBeenCalledWith(2, 'Product was deleted');
    expect(bridge.markSaleSynced).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ processed: 3, synced: 2, failed: 1, interrupted: false });
  });

  it('keeps a transient connection failure pending and stops the current run', async () => {
    const bridge = bridgeWithQueue([
      { id: 1, payload: { offline_sale_uuid: 'first' } },
      { id: 2, payload: { offline_sale_uuid: 'second' } },
    ]);
    const sendSale = vi.fn().mockRejectedValue(new Error('Network unavailable'));

    const result = await syncOfflineSales({ bridge, sendSale });

    expect(bridge.markSalePending).toHaveBeenCalledWith(1, 'Network unavailable');
    expect(bridge.markSaleFailed).not.toHaveBeenCalled();
    expect(sendSale).toHaveBeenCalledTimes(1);
    expect(result.interrupted).toBe(true);
  });

  it('uses cached prices and excludes customer credit offline', () => {
    const product = { price: 1000, prices: [{ name: 'Wholesale', price: 800 }] };
    expect(cachedProductPrice(product, 'Wholesale')).toBe(800);
    expect(cachedProductPrice(product, 'Retail')).toBe(1000);
    expect(offlinePaymentMethods({ payment_methods: 'Cash, Credit, KPay' })).toEqual(['Cash', 'KPay']);
  });
});
