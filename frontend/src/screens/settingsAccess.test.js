import { describe, expect, it } from 'vitest';
import { settingsTabsForRole } from '../settingsAccess';

const tabs = ['account', 'shop', 'receipt', 'printer', 'barcode', 'security', 'data', 'about'].map((id) => ({ id }));

describe('desktop settings access', () => {
  it('limits staff to common non-sensitive settings', () => {
    expect(settingsTabsForRole(tabs, 'staff').map(({ id }) => id)).toEqual([
      'account',
      'receipt',
      'printer',
      'barcode',
      'about',
    ]);
  });

  it('keeps the complete settings workspace for owners', () => {
    expect(settingsTabsForRole(tabs, 'owner').map(({ id }) => id)).toContain('security');
    expect(settingsTabsForRole(tabs, 'owner').map(({ id }) => id)).toContain('data');
  });
});
