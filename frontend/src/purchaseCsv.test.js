import { describe, expect, it, vi } from 'vitest';
import { expandPurchaseLineItems, PURCHASE_LINE_COLUMNS } from './purchaseCsv';

describe('purchase CSV rows', () => {
  it('expands each filtered purchase into line-item rows', async () => {
    const fetchPurchase = vi.fn(async (id) => ({
      id,
      created_at: '2026-09-17 08:30:00',
      total_cost: 300,
      items: id === 1
        ? [{ product_id: 10, product_name: 'Apple', quantity: 2, foc_quantity: 1, base_quantity: 2, base_foc_quantity: 1, unit_cost: 100, effective_unit_cost: 66.67, line_total: 200 }, { product_id: 11, product_name: 'Orange', quantity: 1, foc_quantity: 0, line_total: 100 }]
        : [{ product_id: 12, product_name: 'Grape', quantity: 4, foc_quantity: 0, line_total: 400 }],
    }));
    const rows = await expandPurchaseLineItems([{ id: 1 }, { id: 2 }], fetchPurchase, 2);
    expect(rows).toHaveLength(3);
    expect(rows.map(({ item }) => item.product_name)).toEqual(['Apple', 'Orange', 'Grape']);
    expect(PURCHASE_LINE_COLUMNS.find(({ label }) => label === 'FOC Quantity').value(rows[0])).toBe(1);
    expect(PURCHASE_LINE_COLUMNS.find(({ label }) => label === 'Received Base Quantity').value(rows[0])).toBe(3);
  });
});
