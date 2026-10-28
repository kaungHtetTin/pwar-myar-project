import { describe, expect, it } from 'vitest';
import { automaticSellingPrice, priceRuleMap, productPriceFormRows } from './priceTypes';

describe('automatic product pricing helpers', () => {
  it('applies markup, minimum profit, and upward rounding', () => {
    expect(automaticSellingPrice(1250, {
      pricing_mode: 'automatic',
      markup_percent: 10,
      minimum_profit: 0,
      rounding: 50,
    })).toBe(1400);
    expect(automaticSellingPrice(1000, {
      pricing_mode: 'automatic',
      markup_percent: 5,
      minimum_profit: 200,
      rounding: 100,
    })).toBe(1200);
  });

  it('marks new prices automatic while preserving existing manual overrides', () => {
    const rules = priceRuleMap({
      rules: [{ name: 'Retail', pricing_mode: 'automatic', markup_percent: 20, rounding: 100 }],
    });
    expect(productPriceFormRows(['Retail'], null, rules)[0].is_manual).toBe(false);
    expect(productPriceFormRows(
      ['Retail'],
      { id: 1, prices: [{ name: 'Retail', price: 1700, is_manual: true }] },
      rules,
    )[0].is_manual).toBe(true);
  });
});
