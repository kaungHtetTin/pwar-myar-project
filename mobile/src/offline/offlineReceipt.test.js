import { describe, expect, it } from 'vitest';
import { offlineReceiptNumber, offlineReceiptPayload } from './offlineReceipt';

describe('offline receipt', () => {
  it('prints the cached business timezone independently of the device timezone', () => {
    const sale = { id: 1, created_at: '2026-10-19T17:45:00Z', payload: { items: [] } };
    const receipt = offlineReceiptPayload(sale, {}, { timezone: 'UTC' });
    expect(receipt.text).toContain(new Date(sale.created_at).toLocaleString(undefined, { timeZone: 'UTC' }));
  });
  it('uses a stable local invoice number and cached sale totals', () => {
    const sale = {
      id: 12,
      local_total: 1900,
      created_at: '2026-08-08T08:00:00.000Z',
      payload: {
        payment_method: 'Cash',
        discount: 100,
        items: [{ product_name: 'Water', quantity: 2, foc_quantity: 1, unit_price: 1000 }],
      },
    };
    const receipt = offlineReceiptPayload(sale, {
      shop_name: 'Demo Shop', shop_address: 'Yangon', currency: 'Ks', receipt_footer: 'Come again',
      receipt_paper_size: '58mm', receipt_header_alignment: 'left', receipt_margin_left: '2',
      receipt_margin_right: '4', receipt_body_font_size: '7.5', receipt_line_height: '1.25',
      receipt_show_payment_method: '1', receipt_show_price_type: '1',
    });

    expect(offlineReceiptNumber(sale)).toBe('OFF-000012');
    expect(receipt.local_receipt_no).toBe('OFF-000012');
    expect(receipt.paper_size).toBe('58mm');
    expect(receipt.layout).toMatchObject({ header_alignment: 'left', margin_left: 2, margin_right: 4, body_font_size: 7.5, line_height: 1.25 });
    expect(receipt.text).toContain('Total: 1,900 Ks');
    expect(receipt.html).toContain('FOC: 1');
    expect(receipt.html).toContain('Come again');
  });
});
