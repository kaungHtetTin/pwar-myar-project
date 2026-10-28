import { afterEach, describe, expect, it } from 'vitest';
import { businessDay, calendarRange, configureTimezone, storedDate, storedTimestamp } from './timezone';
import { chatTime } from './shopChatPresentation';

afterEach(() => configureTimezone({ business: { timezone: 'Asia/Yangon' }, storage_timezone: 'Asia/Yangon' }));

describe('business dates', () => {
  it('uses Myanmar midnight even when the browser uses another timezone', () => {
    const now = new Date('2026-10-19T18:00:00Z');
    expect(businessDay(now)).toBe('2026-10-20');
    expect(calendarRange('today', now)).toEqual({ start: '2026-10-20', end: '2026-10-20' });
    expect(calendarRange('week', now)).toEqual({ start: '2026-10-19', end: '2026-10-20' });
  });
  it('separates the business timezone from the timestamp storage timezone', () => {
    configureTimezone({ business: { timezone: 'America/New_York' }, storage_timezone: 'Asia/Yangon' });
    expect(storedDate('2026-10-20 00:15:00').toISOString()).toBe('2026-10-19T17:45:00.000Z');
    expect(businessDay(new Date('2026-10-20T00:15:00Z'))).toBe('2026-10-19');
    expect(storedDate('2026-10-20T00:15:00+06:30').toISOString()).toBe('2026-10-19T17:45:00.000Z');
    expect(storedTimestamp('2026-10-20 00:15:00')).toBe('2026-10-19 13:45:00');
  });
  it('groups chat previews by business calendar day', () => {
    expect(chatTime('2026-10-19 17:29:00', new Date('2026-10-19T17:31:00Z'))).toBe('Yesterday');
    expect(chatTime('2026-10-19 17:30:00', new Date('2026-10-19T17:31:00Z'))).not.toBe('Yesterday');
  });
});
