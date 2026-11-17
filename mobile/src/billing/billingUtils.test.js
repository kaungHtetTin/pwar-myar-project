import { describe, expect, it } from 'vitest';
import { billingPageFromPath, dateLabel, daysRemaining, billingRequestMessage, billingPendingMessage } from './billingUtils';

describe('mobile billing helpers', () => {
  it('preserves reference and note in the existing message field while accepting legacy notes', () => {
    const saved = billingRequestMessage(' TXN-7 ', ' Bank transfer\nSecond line ');
    expect(billingPendingMessage(saved)).toEqual({ reference: 'TXN-7', note: 'Bank transfer\nSecond line' });
    expect(billingPendingMessage('Legacy payment note')).toEqual({ reference: '', note: 'Legacy payment note' });
  });
  it('recognizes plan request deep links', () => expect(billingPageFromPath('/billing/request/8')).toEqual({ kind: 'request', planId: 8 }));
  it('handles subscription dates', () => {
    expect(daysRemaining('2026-08-10T00:00:00Z', new Date('2026-08-08T00:00:00Z').getTime())).toBe(2);
    expect(dateLabel('not-a-date')).toBe('—');
  });
});
