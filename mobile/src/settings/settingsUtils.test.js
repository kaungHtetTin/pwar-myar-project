import { describe, expect, it } from 'vitest';
import { paymentMethodRows, priceTypeRows, settingsPageFromPath, settingsPayload } from './settingsUtils';

describe('mobile settings helpers', () => {
  it('maps stable full-page settings routes', () => {
    expect(settingsPageFromPath('/settings/data/restore').section).toBe('restore');
    expect(settingsPageFromPath('/settings/data/reset').section).toBe('reset');
    expect(settingsPageFromPath('/settings/prices/Wholesale/edit')).toEqual({ section: 'price-edit', value: 'Wholesale' });
  });
  it('normalizes setting and repeatable rows', () => {
    expect(settingsPayload({ shop_name: '', receipt_show_customer: false }).shop_name).toBe('PwarMyar Shop');
    expect(settingsPayload({ receipt_paper_size: 'a5' }).receipt_paper_size).toBe('a5');
    expect(settingsPayload({ barcode_label_format: 'roll_50x30' }).barcode_label_format).toBe('roll_50x30');
    expect(paymentMethodRows('Cash,Cash,KPay').map((row) => row.name)).toEqual(['Cash', 'KPay']);
    expect(priceTypeRows({ items: ['Retail'], usage: { Retail: 2 }, rules: [{ name: 'Retail', pricing_mode: 'automatic' }] })[0]).toMatchObject({ productCount: 2, pricing_mode: 'automatic' });
  });
});
