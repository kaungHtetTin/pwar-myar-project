import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readStyle = (name) => readFileSync(`src/styles/${name}.css`, 'utf8');

const styles = {
  access: readStyle('access'),
  customers: readStyle('customers'),
  expenses: readStyle('expenses'),
  navigation: readStyle('navigation'),
  products: readStyle('products'),
  purchases: readStyle('purchases'),
  sell: readStyle('sell'),
  settings: readStyle('settings'),
  suppliers: readStyle('suppliers'),
  transactions: readStyle('transactions'),
};

const escaped = (selector) => selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const usesRadius = (css, selector, token) => {
  expect(css).toMatch(new RegExp(`${escaped(selector)}[^}]*border-radius:\\s*var\\(--radius-${token}\\)`, 's'));
};

describe('mobile radius system', () => {
  it('uses the Products search radius for shared search and scan fields', () => {
    usesRadius(styles.products, '.mobile-search, .mobile-scan-field', 'surface');
    usesRadius(styles.products, '.product-search', 'surface');
  });

  it('uses the Products list-card radius across feature lists', () => {
    [
      [styles.products, '.product-card'],
      [styles.purchases, '.purchase-history-list > article'],
      [styles.suppliers, '.supplier-card'],
      [styles.customers, '.customer-mobile-card'],
      [styles.expenses, '.expense-card'],
      [styles.transactions, '.transaction-card'],
      [styles.access, '.access-card'],
      [styles.settings, '.settings-section-grid > button'],
      [styles.sell, '.sale-mobile-product'],
    ].forEach(([css, selector]) => usesRadius(css, selector, 'card'));
  });

  it('uses the compact control radius for icon actions and fields', () => {
    [
      [styles.products, '.product-card-menu-button'],
      [styles.purchases, '.purchase-history-menu'],
      [styles.suppliers, '.supplier-card-menu'],
      [styles.customers, '.customer-mobile-card-menu'],
      [styles.expenses, '.expense-card-menu'],
      [styles.access, '.access-card-menu'],
      [styles.navigation, '.icon-button'],
    ].forEach(([css, selector]) => usesRadius(css, selector, 'control'));

    usesRadius(styles.products, '.mobile-filter-panel select, .mobile-filter-panel > input, .mobile-product-form input, .mobile-product-form select, .stock-adjust-form input', 'control');
  });

  it('uses the Product toolbar radius for every transaction duration preset', () => {
    const presetRules = styles.transactions.match(/\.transaction-presets button\s*\{[^}]*\}/g) || [];
    const radiusRules = presetRules.filter((rule) => rule.includes('border-radius'));

    expect(radiusRules).toHaveLength(2);
    radiusRules.forEach((rule) => expect(rule).toContain('border-radius: var(--radius-card)'));
  });
});
