import { describe, expect, it } from 'vitest';
import { authorizedOfflineSession } from './offlineStore';

describe('mobile offline trial authorization', () => {
  const session = {
    permissions: ['sell'],
    subscription: { is_valid: true, access_type: 'trial', ends_at: '2028-02-29T10:00:00.000Z' },
  };

  it('allows sales before expiry and stops exactly at the entitlement boundary', () => {
    expect(authorizedOfflineSession(session, Date.parse('2028-02-29T09:59:59.999Z'))).toBe(true);
    expect(authorizedOfflineSession(session, Date.parse('2028-02-29T10:00:00.000Z'))).toBe(false);
    expect(authorizedOfflineSession(session, Date.parse('2028-03-01T00:00:00.000Z'))).toBe(false);
  });

  it('requires Sell permission and a server-valid entitlement', () => {
    expect(authorizedOfflineSession({ ...session, permissions: [] })).toBe(false);
    expect(authorizedOfflineSession({ ...session, subscription: { ...session.subscription, is_valid: false } })).toBe(false);
  });
});
