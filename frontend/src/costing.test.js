import { describe, expect, it } from 'vitest';
import { belowCostPrices, priceMargin, purchaseCostWarnings } from './costing';

describe('costing helpers', () => {
  const product = {
    id: 7,
    name: 'Tea',
    cost: 900,
    prices: [
      { name: 'Retail', price: 1200 },
      { name: 'Wholesale', price: 800 },
      { name: 'Unused', price: 0 },
    ],
  };

  it('calculates profit and loss against buying cost', () => {
    expect(priceMargin(1200, 900)).toMatchObject({ amount: 300, belowCost: false });
    expect(priceMargin(800, 900)).toMatchObject({ amount: -100, belowCost: true });
  });

  it('returns only active selling prices below cost', () => {
    expect(belowCostPrices(product)).toEqual([
      expect.objectContaining({ name: 'Wholesale', price: 800, amount: -100 }),
    ]);
  });

  it('compares purchase unit cost with every selling price', () => {
    expect(purchaseCostWarnings([{ product_id: 7, unit_cost: 1300 }], [product])).toHaveLength(2);
  });

  it('does not warn for automatic prices that will be recalculated', () => {
    const automaticProduct = {
      ...product,
      prices: [{ name: 'Retail', price: 1200, is_manual: false }],
    };
    expect(purchaseCostWarnings([{ product_id: 7, unit_cost: 1300 }], [automaticProduct])).toEqual([]);
  });
});
