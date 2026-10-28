import { describe, expect, it } from 'vitest';
import { shopOrderPrintDocument } from './shopOrderPrint';

describe('shop order print record', () => {
  it('escapes order and item content while retaining the actual total and payment state', () => {
    const html = shopOrderPrintDocument({ reference: '<script>bad()</script>', customer_name: 'A & B', status: 'pending', payment_status: 'unpaid', total: 49000, currency: 'Ks', fulfillment: 'pickup', items: [{ name: '<img src=x onerror=bad()>', quantity: 2, unit_name: 'bag', line_total: 49000 }] }, 'Asia/Rangoon');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('49,000');
    expect(html).toContain('unpaid');
    expect(html).toContain('Print order');
    expect(html).not.toContain('Receipt');
  });
});
