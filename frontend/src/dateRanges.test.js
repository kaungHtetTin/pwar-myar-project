import { describe, expect, it } from 'vitest';
import {
  dateRangeError,
  presetDateFromTo,
  presetDateRange,
  reportPath,
} from './dateRanges';
import { formatDateInput } from './utils';

describe('local date ranges', () => {
  const localMorning = new Date(2026, 6, 26, 0, 15);

  it('formats the local calendar date without converting to UTC', () => {
    expect(formatDateInput(localMorning)).toBe('2026-07-26');
  });

  it('builds consistent month and year-to-date presets', () => {
    expect(presetDateRange('month', localMorning)).toEqual({
      start: '2026-07-01',
      end: '2026-07-26',
    });
    expect(presetDateRange('year', localMorning)).toEqual({
      start: '2026-01-01',
      end: '2026-07-26',
    });
    expect(presetDateFromTo('week', localMorning)).toEqual({
      date_from: '2026-07-20',
      date_to: '2026-07-26',
    });
  });

  it('uses an explicit report API flag for all-time data', () => {
    expect(presetDateRange('all', localMorning)).toEqual({ start: '', end: '' });
    expect(reportPath('/reports/summary', {
      preset: 'all',
      start: '',
      end: '',
    })).toBe('/reports/summary?all_time=true');
  });

  it('rejects a reversed custom range', () => {
    expect(dateRangeError('2026-07-27', '2026-07-26')).toBe(
      'From date cannot be later than To date.',
    );
    expect(dateRangeError('2026-07-26', '2026-07-26')).toBe('');
  });
});
