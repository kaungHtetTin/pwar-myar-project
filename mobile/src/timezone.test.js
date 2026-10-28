import { afterEach, describe, expect, it } from 'vitest';
import { businessDay, calendarRange, configureTimezone, storedDate, storedTimestamp } from './timezone';
import { salesReferenceDate } from './transactions/transactionUtils';

afterEach(() => configureTimezone({ business: { timezone: 'Asia/Yangon' }, storage_timezone: 'Asia/Yangon' }));

describe('POS business dates', () => {
  it('selects Today and this month in the business timezone', () => {
    const now = new Date('2026-10-31T18:00:00Z');
    expect(businessDay(now)).toBe('2026-11-01');
    expect(calendarRange('month', now)).toEqual({ start: '2026-11-01', end: '2026-11-01' });
  });
  it('parses stored timestamps independently of the device timezone', () => {
    expect(storedDate('2026-10-20 00:15:00').toISOString()).toBe('2026-10-19T17:45:00.000Z');
    expect(storedDate('2026-10-19T17:45:00Z').toISOString()).toBe('2026-10-19T17:45:00.000Z');
  });
  it('keeps calendar-only dates unchanged and displays instants in business time', () => {
    configureTimezone({ business: { timezone: 'America/New_York' } });
    expect(salesReferenceDate('2026-10-20')).toContain('20 Oct 2026');
    expect(salesReferenceDate('2026-10-20 00:15:00')).toContain('19 Oct 2026');
    expect(storedTimestamp('2026-10-20 00:15:00')).toBe('2026-10-19 13:45:00');
  });
});
