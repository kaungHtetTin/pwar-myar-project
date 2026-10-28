import { describe, expect, it } from 'vitest';
import { localizeNavigationModule, localizeRole, navigationText, normalizeLanguage } from './navigationLocale';

describe('mobile navigation locale', () => {
  it('keeps English navigation unchanged', () => {
    const module = { id: 'products', label: 'Products', description: 'Inventory and pricing' };
    expect(localizeNavigationModule(module, 'en')).toBe(module);
    expect(normalizeLanguage('unsupported')).toBe('en');
  });

  it('translates module labels, descriptions, actions, and roles to Myanmar', () => {
    expect(localizeNavigationModule({ id: 'products', label: 'Products', description: 'Inventory and pricing' }, 'my'))
      .toMatchObject({ label: 'ကုန်ပစ္စည်းများ', description: 'ကုန်ပစ္စည်းလက်ကျန်နှင့် ဈေးနှုန်းများ' });
    expect(localizeNavigationModule({ id: 'billing', label: 'Billing', description: 'Plan and payments' }, 'my').label)
      .toBe('ငွေပေးသွင်းမှု');
    expect(navigationText('signOut', 'my', 'Sign out')).toBe('ထွက်မည်');
    expect(localizeRole('Owner', 'my')).toBe('ပိုင်ရှင်');
  });
});
