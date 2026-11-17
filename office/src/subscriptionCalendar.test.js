import { expect, it } from 'vitest';
import { calendarDays, expiryUrgency, shiftMonth } from './subscriptionCalendar';

it('lays out full Monday-first weeks with leap days and year navigation', () => {
  const days = calendarDays('2032-02');
  expect(days).toHaveLength(42);
  expect(new Date(`${days[0].day}T12:00:00Z`).getUTCDay()).toBe(1);
  expect(days.filter(day => day.inMonth)).toHaveLength(29);
  expect(days.some(day => day.day === '2032-02-29' && day.inMonth)).toBe(true);
  expect(shiftMonth('2030-12', 1)).toBe('2031-01');
  expect(shiftMonth('2030-01', -1)).toBe('2029-12');
});

it('uses server calendar days for seven-day and three-day warnings and past expiries', () => {
  expect(expiryUrgency('2030-11-13', '2030-11-10', 1)).toBe('is-danger');
  expect(expiryUrgency('2030-11-17', '2030-11-10', 1)).toBe('is-warning');
  expect(expiryUrgency('2030-11-18', '2030-11-10', 1)).toBe('');
  expect(expiryUrgency('2030-11-09', '2030-11-10', 1)).toBe('is-past');
  expect(expiryUrgency('2030-11-10', '2030-11-10', 0)).toBe('');
});
