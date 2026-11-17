import { describe, expect, it } from 'vitest';
import { settingsSectionsForRole } from './settingsAccess';

const sections = ['account', 'shop', 'receipt', 'printer', 'barcode', 'security', 'data', 'about'].map((id) => [id]);

describe('mobile settings access', () => {
  it('limits staff to common non-sensitive settings', () => {
    expect(settingsSectionsForRole(sections, 'staff').map(([id]) => id)).toEqual([
      'account',
      'receipt',
      'printer',
      'barcode',
      'about',
    ]);
  });

  it('keeps sensitive settings owner-only', () => {
    const ownerSections = settingsSectionsForRole(sections, 'owner').map(([id]) => id);
    expect(ownerSections).toContain('security');
    expect(ownerSections).toContain('data');
  });
});
