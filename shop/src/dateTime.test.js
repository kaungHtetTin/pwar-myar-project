import { describe, expect, it } from 'vitest';
import { shopDate, chatTimestamp } from './dateTime';

describe('shop timestamp contract', () => {
  it('parses legacy UTC and explicit offsets as the same instant', () => {
    expect(shopDate('2026-10-19 17:45:00').toISOString()).toBe('2026-10-19T17:45:00.000Z');
    expect(shopDate('2026-10-20T00:15:00+06:30').toISOString()).toBe('2026-10-19T17:45:00.000Z');
    expect(shopDate('2026-10-19T17:45:00Z').toISOString()).toBe('2026-10-19T17:45:00.000Z');
  });
});

it('formats message times in the shop timezone instead of the device timezone', () => {
  const instant = '2026-10-28 17:45:00';
  expect(chatTimestamp(instant, 'Asia/Yangon')).toBe(new Date('2026-10-28T17:45:00Z').toLocaleString([], {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Yangon'}));
  expect(chatTimestamp('2026-10-29T00:15:00+06:30', 'Asia/Yangon')).toBe(chatTimestamp(instant, 'Asia/Yangon'));
  expect(shopDate('bad-time')).toBeNull();
  expect(chatTimestamp(null)).toBe('');
});
