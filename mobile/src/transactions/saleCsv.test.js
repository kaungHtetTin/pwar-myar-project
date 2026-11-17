import { describe, expect, it, vi } from 'vitest';
import { expandSaleLineItems, SALE_LINE_COLUMNS } from './saleCsv';

describe('mobile sale CSV rows', () => {
  it('expands each filtered sale into line-item rows', async () => {
    const fetchSale = vi.fn(async (id) => ({
      id,
      receipt_no: `R-${id}`,
      items: id === 1
        ? [{ product_name: 'Apple', quantity: 2, foc_quantity: 1 }, { product_name: 'Orange', quantity: 1, foc_quantity: 0 }]
        : [{ product_name: 'Grape', quantity: 4, foc_quantity: 2 }],
    }));

    const rows = await expandSaleLineItems([{ id: 1 }, { id: 2 }], fetchSale, 2);

    expect(rows).toHaveLength(3);
    expect(rows.map(({ item }) => item.product_name)).toEqual(['Apple', 'Orange', 'Grape']);
    expect(SALE_LINE_COLUMNS.find(({ label }) => label === 'FOC Quantity').value(rows[0])).toBe(1);
    expect(SALE_LINE_COLUMNS.find(({ label }) => label === 'Issued Quantity').value(rows[0])).toBe(3);
    expect(SALE_LINE_COLUMNS.find(({ label }) => label === 'Receipt').value(rows[2])).toBe('R-2');
  });
});
