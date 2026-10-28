import { describe, expect, it } from 'vitest';
import { hasPurchaseUnit, purchaseUnitFor, purchaseUnitOptions, stockWithUnit } from './productUnits';

describe('product units', () => {
  const product = { base_unit: 'Piece', purchase_unit: 'Carton', purchase_conversion_factor: 24, stock: 48 };

  it('keeps a base unit and one optional purchase conversion', () => {
    expect(purchaseUnitOptions(product)).toEqual([
      { name: 'Piece', factor: 1 },
      { name: 'Carton', factor: 24 },
    ]);
    expect(purchaseUnitFor(product, 'carton')).toEqual({ name: 'Carton', factor: 24 });
    expect(stockWithUnit(product)).toBe('48 Piece');
  });

  it('ignores incomplete purchase conversions', () => {
    expect(hasPurchaseUnit({ purchase_unit: 'Box', purchase_conversion_factor: 1 })).toBe(false);
  });
});
