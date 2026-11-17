import { describe, expect, it } from 'vitest';
import { resolveActivePage, resolveDashboardModule, resolveEnabledModules } from './moduleRouting';

describe('resolveActivePage', () => {
  it('returns to a permitted module instead of restoring the purchase editor', () => {
    expect(resolveActivePage(['products', 'purchases'], 'new-purchase')).toBe('products');
  });
});

describe('resolveDashboardModule', () => {
  it('returns the previous non-POS module when it is still enabled', () => {
    expect(resolveDashboardModule(['sell', 'products', 'customers'], 'customers')).toBe('customers');
  });

  it('falls back to the first enabled non-POS module', () => {
    expect(resolveDashboardModule(['sell', 'products', 'customers'], 'sell')).toBe('products');
  });
});

describe('resolveEnabledModules', () => {
  it('intersects configured modules with role permissions and keeps owner access management', () => {
    expect(resolveEnabledModules(
      ['sell', 'products', 'billing', 'settings', 'access'],
      ['sell', 'products', 'billing', 'settings'],
      ['sell', 'products', 'access'],
    )).toEqual(['sell', 'products', 'settings', 'access']);
  });

  it('always provides Settings for authenticated staff common preferences', () => {
    expect(resolveEnabledModules(
      ['sell', 'settings'],
      ['sell'],
      ['sell'],
    )).toEqual(['sell', 'settings']);
  });

  it('keeps Access above Settings in the filtered sidebar order', () => {
    expect(resolveEnabledModules(
      ['products', 'access', 'settings'],
      ['products', 'access', 'settings'],
      ['products', 'access', 'settings'],
    )).toEqual(['products', 'access', 'settings']);
  });
});
