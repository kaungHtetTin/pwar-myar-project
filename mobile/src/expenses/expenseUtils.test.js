import { describe, expect, it } from 'vitest';
import {
  blankExpenseFilters,
  cleanExpensePaymentMethods,
  expenseDateError,
  expenseListPath,
  expensePageFromPath,
  expensePayload,
  expensePresetRange,
} from './expenseUtils';

describe('expense utilities', () => {
  it('builds local date presets', () => {
    const now = new Date(2026, 7, 8, 10);
    expect(expensePresetRange('today', now)).toEqual({ date_from: '2026-08-08', date_to: '2026-08-08' });
    expect(expensePresetRange('month', now)).toEqual({ date_from: '2026-08-01', date_to: '2026-08-08' });
    expect(expensePresetRange('all', now)).toEqual({ date_from: '', date_to: '' });
  });

  it('recognizes list and full-page expense forms', () => {
    expect(expensePageFromPath('/expenses')).toEqual({ kind: 'list', expenseId: null });
    expect(expensePageFromPath('/expenses/new')).toEqual({ kind: 'new', expenseId: null });
    expect(expensePageFromPath('/expenses/12/edit')).toEqual({ kind: 'edit', expenseId: 12 });
  });

  it('normalizes payloads and rejects reversed ranges', () => {
    expect(expensePayload({ expense_date: '2026-08-08', title: ' Rent ', category: ' Shop ', amount: '1000.4', payment_method: ' Cash ', note: ' Aug ' })).toEqual({ expense_date: '2026-08-08', title: 'Rent', category: 'Shop', amount: 1000, payment_method: 'Cash', note: 'Aug' });
    expect(expenseDateError({ date_from: '2026-08-09', date_to: '2026-08-08' })).toBeTruthy();
  });

  it('builds bounded filtered list paths and removes credit payment methods', () => {
    const path = expenseListPath({ ...blankExpenseFilters(new Date(2026, 7, 8)), q: 'rent', category: 'Shop' }, 20, 40);
    expect(path).toContain('with_total=true');
    expect(path).toContain('offset=40');
    expect(path).toContain('q=rent');
    expect(cleanExpensePaymentMethods({ payment_methods: 'Cash, Credit, KPay' })).toEqual(['Cash', 'KPay']);
  });
});
