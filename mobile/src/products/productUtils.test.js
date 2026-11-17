import { describe, expect, it } from 'vitest';
import {
  automaticSellingPrice,
  belowCostPrices,
  hasPurchaseUnit,
  parseProductCsv,
  productPriceFormRows,
  stockStatus,
} from './productUtils';

describe('mobile product utilities', () => {
  it('uses the same stock status boundaries as desktop', () => {
    expect(stockStatus({ stock: 0, low_stock_threshold: 5 })).toBe('out_of_stock');
    expect(stockStatus({ stock: 3, low_stock_threshold: 5 })).toBe('low_stock');
    expect(stockStatus({ stock: 6, low_stock_threshold: 5 })).toBe('in_stock');
  });

  it('supports purchase-unit conversion and automatic prices', () => {
    expect(hasPurchaseUnit({ purchase_unit: 'Carton', purchase_conversion_factor: 24 })).toBe(true);
    expect(automaticSellingPrice(950, { pricing_mode: 'automatic', markup_percent: 20, minimum_profit: 100, rounding: 50 })).toBe(1150);
  });

  it('keeps configured price types and below-cost warnings', () => {
    const rows = productPriceFormRows(['Retail', 'Wholesale'], { id: 2, price: 1200, prices: [{ name: 'Retail', price: 1200 }] });
    expect(rows.map(({ name }) => name)).toEqual(['Retail', 'Wholesale']);
    expect(belowCostPrices({ cost: 1500, prices: [{ name: 'Retail', price: 1200 }] })).toHaveLength(1);
  });

  it('parses quoted CSV product rows', () => {
    expect(parseProductCsv('Name,Category,Retail\n"Water, Large",Drinks,1200\n')).toEqual([
      { name: 'Water, Large', category: 'Drinks', retail: '1200' },
    ]);
  });
});
