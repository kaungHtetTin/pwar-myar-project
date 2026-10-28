export function subscriptionAccessState(access) {
  if (access?.reason === 'cancelled' || access?.lifecycle_notice?.stage === 'suspended') return { key: 'suspended', label: 'Suspended' };
  if (access?.is_valid && access.access_type === 'trial') return { key: 'trial', label: 'Trial' };
  if (access?.is_valid) return { key: 'paid', label: 'Paid' };
  if (access?.reason === 'expired') return { key: 'expired', label: 'Expired' };
  if (access?.reason === 'not_started') return { key: 'scheduled', label: 'Not started' };
  if (!access || access.reason === 'no_subscription') return { key: 'none', label: 'No subscription' };
  return { key: 'blocked', label: 'Blocked' };
}

export function subscriptionAccessCounts(businesses) {
  return businesses.reduce((counts, business) => {
    const key = subscriptionAccessState(business.subscription).key;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export function subscriptionDetailPresentation(billing) {
  const trial = billing?.access_type === 'trial';
  return {
    planLabel: trial ? 'Free trial' : (billing?.subscription?.plan_name || 'No plan'),
    startsAt: billing?.starts_at || null,
    endsAt: billing?.ends_at || null,
    daysRemaining: trial ? Number(billing?.days_remaining ?? 0) : null,
    canExtendTrial: trial,
    trialExtensionMessage: trial
      ? (billing?.is_valid
        ? 'Added days begin after the current trial end date.'
        : 'This expired trial will restart from the current server time.')
      : null,
    canRenew: Boolean(billing?.subscription) && !trial,
    conversionMessage: trial
      ? 'Paid access starts immediately. Any unused trial time is preserved and added before the selected paid period ends.'
      : null,
  };
}

export function subscriptionHistoryPresentation(item) {
  const trial = item?.access_type === 'trial';
  const status = item?.billing_status || item?.status || 'inactive';
  return {
    planLabel: trial ? 'Free trial' : (item?.plan_name || 'No plan'),
    statusKey: status === 'cancelled' ? 'suspended' : (trial && status === 'active' ? 'trial' : status),
    statusLabel: status === 'cancelled' ? 'Suspended' : (trial && status === 'active' ? 'Trial' : status),
  };
}
