import { describe, expect, it } from 'vitest';
import { sellOptionLabel, sellText } from './sellLocale';

describe('mobile sell locale', () => {
  it('keeps English fallbacks unchanged', () => {
    expect(sellText('sellTitle', 'en', {}, 'Sell')).toBe('Sell');
    expect(sellOptionLabel('Cash', 'en')).toBe('Cash');
  });

  it('translates Myanmar sale copy and interpolates operational values', () => {
    expect(sellText('sellTitle', 'my', {}, 'Sell')).toBe('အရောင်း');
    expect(sellText('selectedSummary', 'my', { lines: 2, units: 3 }, 'fallback')).toBe('2 မျိုး · 3 ခု');
    expect(sellOptionLabel('Retail', 'my')).toBe('လက်လီ');
    expect(sellOptionLabel('KPay', 'my')).toBe('KPay');
  });
});
