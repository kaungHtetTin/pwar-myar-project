import { describe, expect, it } from 'vitest';
import { blankReportFilters, grossMargin, reportPath, reportPeriodLabel, reportPreset } from './reportUtils';

describe('mobile report helpers', () => {
  const now = new Date(2026, 7, 8);
  it('creates period paths including all-time mode', () => {
    expect(blankReportFilters(now)).toMatchObject({ start: '2026-08-08', end: '2026-08-08' });
    expect(reportPreset('month', now).start).toBe('2026-08-01');
    expect(reportPath('/reports/summary', { preset: 'all', start: '', end: '' })).toBe('/reports/summary?all_time=true');
  });
  it('calculates gross margin safely', () => {
    expect(grossMargin({ sales_total: 10000, profit_estimate: 2500 })).toBe(25);
    expect(grossMargin(null)).toBe(0);
  });
  it('handles previous-month year boundaries and leap years', () => {
    expect(reportPreset('last-month', new Date(2026, 0, 8))).toEqual({ preset: 'last-month', start: '2025-12-01', end: '2025-12-31' });
    expect(reportPreset('last-month', new Date(2024, 2, 8)).end).toBe('2024-02-29');
  });
  it('formats periods without implying previous-period comparisons', () => {
    expect(reportPeriodLabel({ start: '2026-10-01', end: '2026-10-15' })).toBe('1–15 Oct 2026');
    expect(reportPeriodLabel({ preset: 'all' })).toBe('All time');
    expect(reportPeriodLabel({ start: '2026-10-15', end: '2026-10-15' })).toBe('15 Oct 2026');
    expect(reportPeriodLabel({ start: '', end: '' })).toBe('Select dates');
  });
});
