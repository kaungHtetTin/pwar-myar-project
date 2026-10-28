import { afterEach, describe, expect, it } from 'vitest';
import { officeDay, officeDateInput, parseOfficeDate, paymentMatchesDates, setOfficeTimezone } from './dateTime';

afterEach(() => setOfficeTimezone('Asia/Yangon'));

describe('Office payment dates', () => {
  it('accepts explicit offsets and legacy application timestamps', () => {
    expect(parseOfficeDate('2026-10-20 00:15:00').toISOString()).toBe('2026-10-19T17:45:00.000Z');
    expect(officeDay('2026-10-19T17:45:00Z')).toBe('2026-10-20');
    expect(officeDateInput('2026-10-19T17:45:00Z')).toBe('2026-10-20T00:15:00');
    expect(parseOfficeDate(officeDateInput('2026-10-19T17:45:00Z')).toISOString()).toBe('2026-10-19T17:45:00.000Z');
  });
  it('includes both ends of a calendar date range', () => {
    const query = { from: '2026-10-20', to: '2026-10-20' };
    expect(paymentMatchesDates({ created_at: '2026-10-19T17:29:59Z' }, query)).toBe(false);
    expect(paymentMatchesDates({ created_at: '2026-10-19T17:30:00Z' }, query)).toBe(true);
    expect(paymentMatchesDates({ created_at: '2026-10-20T17:29:59Z' }, query)).toBe(true);
    expect(paymentMatchesDates({ created_at: '2026-10-20T17:30:00Z' }, query)).toBe(false);
    expect(paymentMatchesDates({ created_at: '2026-10-20T17:30:00Z' }, {})).toBe(true);
  });
});
