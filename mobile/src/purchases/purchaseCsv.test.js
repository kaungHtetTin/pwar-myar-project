import { describe, expect, it, vi } from 'vitest';
import { expandPurchaseLineItems, PURCHASE_LINE_COLUMNS } from './purchaseCsv';

describe('mobile purchase CSV rows', () => {
  it('expands each filtered purchase into line-item rows', async () => {
    const fetchPurchase = vi.fn(async (id) => ({
      id,
      total_cost: 300,
      items: id === 1
        ? [{ product_name: 'Apple', quantity: 2, foc_quantity: 1, base_quantity: 2, base_foc_quantity: 1 }, { product_name: 'Orange', quantity: 1 }]
        : [{ product_name: 'Grape', quantity: 4 }],
    }));
    const rows = await expandPurchaseLineItems([{ id: 1 }, { id: 2 }], fetchPurchase, 2);
    expect(rows).toHaveLength(3);
    expect(rows.map(({ item }) => item.product_name)).toEqual(['Apple', 'Orange', 'Grape']);
    expect(PURCHASE_LINE_COLUMNS.find(({ label }) => label === 'FOC Quantity').value(rows[0])).toBe(1);
    expect(PURCHASE_LINE_COLUMNS.find(({ label }) => label === 'Received Base Quantity').value(rows[0])).toBe(3);
  });
});
