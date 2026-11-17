import { describe, expect, it } from 'vitest';
import {
  buildPurchaseLine,
  dateRangeError,
  itemCostWarnings,
  presetDateFromTo,
  purchaseHistoryPath,
  purchasePageFromPath,
  purchasePaymentAmounts,
  purchasePayload,
  purchaseTotals,
  recalculatePurchaseLine,
} from './purchaseUtils';

const product = {
  id: 4, name: 'Water', stock: 5, base_unit: 'Bottle', purchase_unit: 'Carton', purchase_conversion_factor: 24,
  prices: [{ name: 'Retail', price: 1000, is_manual: true }],
};

describe('purchase utilities', () => {
  it('resolves list, create, detail, and edit routes', () => {
    expect(purchasePageFromPath('/purchases').kind).toBe('list');
    expect(purchasePageFromPath('/purchases/new').kind).toBe('new');
    expect(purchasePageFromPath('/purchases/8')).toEqual({ kind: 'detail', purchaseId: 8 });
    expect(purchasePageFromPath('/purchases/8/edit')).toEqual({ kind: 'edit', purchaseId: 8 });
  });

  it('builds paginated history paths with filters', () => {
    const path = purchaseHistoryPath({ q: 'rice', supplier: 'MM', date_from: '2026-01-01', date_to: '2026-01-31' }, 20, 40);
    expect(path).toContain('limit=20');
    expect(path).toContain('offset=40');
    expect(path).toContain('q=rice');
  });

  it('calculates purchase units, FOC effective cost, and totals', () => {
    const line = buildPurchaseLine(product, 'Carton', 2, 1, 24000);
    expect(line.line_total).toBe(48000);
    expect(line.effective_unit_cost).toBeCloseTo(666.667, 2);
    expect(purchaseTotals([line])).toEqual({ paid: 48, foc: 24, total: 48000 });
    expect(recalculatePurchaseLine(line, { quantity: 1 }).line_total).toBe(24000);
    expect(recalculatePurchaseLine({ ...line, base_quantity: 999, base_foc_quantity: 999 }, { quantity: 1, foc_quantity: .5 })).toMatchObject({ base_quantity: 24, base_foc_quantity: 12 });
  });

  it('includes editable reference dates and payment-status filtering in API contracts', () => {
    expect(purchasePayload({ reference_no: ' SUP0218 ', purchase_date: '2026-10-15', expected_delivery: '2026-10-20', items: [] })).toMatchObject({ reference_no: 'SUP0218', purchase_date: '2026-10-15', expected_delivery: '2026-10-20' });
    expect(purchaseHistoryPath({ q: '', supplier: '', payment_status: 'partial' }, 20, 0)).toContain('payment_status=partial');
  });

  it('detects manual prices below the effective buying cost and builds payloads', () => {
    const line = buildPurchaseLine(product, 'Bottle', 1, 0, 1200);
    expect(itemCostWarnings(line)[0].name).toBe('Retail');
    expect(purchasePayload({ supplier_id: '', supplier_name: ' Cash ', note: '', items: [line] }).items[0]).toMatchObject({ product_id: 4, quantity: 1, unit_cost: 1200 });
  });

  it('calculates partial supplier credit and includes payment fields in the payload', () => {
    const line = buildPurchaseLine(product, 'Bottle', 1, 0, 1200);
    const form = { supplier_id: 8, supplier_name: 'Acme', payment_method: 'KPay', paid_amount: 500, note: '', items: [line] };
    expect(purchasePaymentAmounts(form)).toEqual({ total: 1200, paid: 500, credit: 700 });
    expect(purchasePayload(form)).toMatchObject({ supplier_id: 8, payment_method: 'KPay', paid_amount: 500 });
  });

  it('treats an empty paid amount as zero', () => {
    const line = buildPurchaseLine(product, 'Bottle', 1, 0, 1200);
    const form = { supplier_id: 8, paid_amount: '', items: [line] };
    expect(purchasePaymentAmounts(form)).toEqual({ total: 1200, paid: 0, credit: 1200 });
    expect(purchasePayload(form).paid_amount).toBe(0);
  });

  it('creates date presets and validates reversed ranges', () => {
    expect(presetDateFromTo('month', new Date(2026, 7, 7))).toEqual({ date_from: '2026-08-01', date_to: '2026-08-07' });
    expect(dateRangeError('2026-08-08', '2026-08-07')).toMatch(/cannot/);
  });
});
