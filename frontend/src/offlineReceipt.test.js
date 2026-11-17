import { describe, expect, it } from 'vitest';
import { offlineReceiptNumber, offlineReceiptPayload } from './offlineReceipt';

describe('offline invoice generation', () => {
  it('prints in the business timezone independently of the device timezone', () => {
    const instant = { id: 1, created_at: '2026-10-19T17:45:00Z', payload: { items: [] } };
    const receipt = offlineReceiptPayload(instant, {}, { timezone: 'UTC' });
    expect(receipt.text).toContain(new Date(instant.created_at).toLocaleString(undefined, { timeZone: 'UTC' }));
  });
  const sale = {
    id: 12,
    status: 'pending',
    local_total: 4500,
    created_at: '2026-08-07T03:30:00.000Z',
    payload: {
      payment_method: 'KPay',
      discount: 500,
      items: [{
        product_id: 10, product_name: 'Cached <Product>', price_type: 'Retail',
        quantity: 2, foc_quantity: 1, unit_price: 2500,
      }],
    },
  };

  it('creates a stable local invoice number before server synchronization', () => {
    expect(offlineReceiptNumber(sale)).toBe('OFF-000012');
    expect(offlineReceiptNumber({ ...sale, receipt_no: 'R260807-0001' })).toBe('OFF-000012');
  });

  it('uses cached shop and paper settings in structured receipt markup', () => {
    const receipt = offlineReceiptPayload(sale, {
      shop_name: 'Offline Shop', shop_address: 'Yangon', currency: 'Ks', receipt_footer: 'Come again',
      receipt_paper_size: '58mm', receipt_header_alignment: 'left', receipt_margin_left: '2',
      receipt_margin_right: '4', receipt_header_font_size: '12', receipt_body_font_size: '8',
      receipt_line_height: '1.4', receipt_show_payment_method: '1', receipt_show_price_type: '1',
      receipt_logo_data_url: 'data:image/png;base64,aGVsbG8=',
    });

    expect(receipt.paper_size).toBe('58mm');
    expect(receipt.layout).toMatchObject({ header_alignment: 'left', margin_left: 2, margin_right: 4 });
    expect(receipt.html).toContain('OFF-000012');
    expect(receipt.html).toContain('Cached &lt;Product&gt;');
    expect(receipt.html).toContain('KPay');
    expect(receipt.html).toContain('4,500 Ks');
    expect(receipt.html).toContain('class="receipt-logo"');
    expect(receipt.html).toContain('class="receipt-document-heading"');
    expect(receipt.html).toContain('class="receipt-items-table"');
    expect(receipt.html).toContain('class="receipt-page-footer"');
    expect(receipt.text).toContain('FOC: 1');
  });
});
