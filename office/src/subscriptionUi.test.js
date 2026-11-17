import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { subscriptionAccessCounts, subscriptionAccessState, subscriptionDetailPresentation, subscriptionHistoryPresentation } from './subscriptionUi';

const officeCss = readFileSync('src/styles.css', 'utf8');

describe('Office subscription presentation', () => {
  it.each([
    [{ is_valid: true, access_type: 'trial' }, 'trial', 'Trial'],
    [{ is_valid: true, access_type: 'paid' }, 'paid', 'Paid'],
    [{ is_valid: true, access_type: 'paid', reason: 'cancelled', lifecycle_notice: { stage: 'suspended' } }, 'suspended', 'Suspended'],
    [{ is_valid: false, reason: 'expired' }, 'expired', 'Expired'],
    [{ is_valid: false, reason: 'cancelled' }, 'suspended', 'Suspended'],
    [{ is_valid: false, reason: 'no_subscription' }, 'none', 'No subscription'],
  ])('maps entitlement %# to a distinct state', (access, key, label) => {
    expect(subscriptionAccessState(access)).toEqual({ key, label });
  });

  it('counts trials separately from paid access', () => {
    expect(subscriptionAccessCounts([
      { subscription: { is_valid: true, access_type: 'trial' } },
      { subscription: { is_valid: true, access_type: 'paid' } },
      { subscription: { is_valid: false, reason: 'expired' } },
    ])).toEqual({ trial: 1, paid: 1, expired: 1 });
  });

  it('presents trial timing and conversion without exposing renewal', () => {
    expect(subscriptionDetailPresentation({
      access_type: 'trial', is_valid: true, starts_at: '2028-01-31T10:00:00Z', ends_at: '2028-02-29T10:00:00Z', days_remaining: 12,
      subscription: { plan_name: 'Internal System Trial' },
    })).toEqual({
      planLabel: 'Free trial', startsAt: '2028-01-31T10:00:00Z', endsAt: '2028-02-29T10:00:00Z', daysRemaining: 12,
      canExtendTrial: true,
      trialExtensionMessage: 'Added days begin after the current trial end date.',
      canRenew: false,
      conversionMessage: 'Paid access starts immediately. Any unused trial time is preserved and added before the selected paid period ends.',
    });
  });

  it('explains that extending an expired trial reactivates it from server time', () => {
    expect(subscriptionDetailPresentation({
      access_type: 'trial', is_valid: false, reason: 'expired', ends_at: '2028-01-01T00:00:00Z', subscription: { id: 4 },
    })).toMatchObject({
      canExtendTrial: true,
      trialExtensionMessage: 'This expired trial will restart from the current server time.',
    });
  });

  it('labels active trial history distinctly from paid billing history', () => {
    expect(subscriptionHistoryPresentation({ access_type: 'trial', plan_name: 'System Trial', billing_status: 'active' }))
      .toEqual({ planLabel: 'Free trial', statusKey: 'trial', statusLabel: 'Trial' });
    expect(subscriptionHistoryPresentation({ access_type: 'paid', plan_name: 'Monthly', billing_status: 'active' }))
      .toEqual({ planLabel: 'Monthly', statusKey: 'active', statusLabel: 'active' });
    expect(subscriptionHistoryPresentation({ access_type: 'paid', plan_name: 'Monthly', billing_status: 'cancelled' }))
      .toEqual({ planLabel: 'Monthly', statusKey: 'suspended', statusLabel: 'Suspended' });
  });

  it('keeps trial details responsive and subscription controls keyboard-visible', () => {
    expect(officeCss).toMatch(/\.office-subscription-controls button:focus-visible/);
    expect(officeCss).toMatch(/@media \(max-width:\s*850px\)[\s\S]*?\.office-detail-grid\s*\{\s*grid-template-columns:\s*1fr/);
    expect(officeCss).toMatch(/@media \(max-width:\s*700px\)/);
  });
});
