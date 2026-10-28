import React from 'react';
import { CalendarClock, CreditCard, ShieldAlert } from 'lucide-react';

function dateLabel(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function TrialBanner({ session, onBilling }) {
  const entitlement = session?.subscription;
  const notice = entitlement?.lifecycle_notice;
  const isTrialNotice = entitlement?.is_valid && entitlement?.access_type === 'trial';
  const isSubscriptionAlert = entitlement?.reason === 'cancelled' || !entitlement?.is_valid;
  if (!notice || (!isTrialNotice && !isSubscriptionAlert)) return null;
  const days = Number(entitlement.days_remaining ?? notice.days_remaining ?? 0);
  const owner = session?.user?.role === 'owner';
  const datePrefix = entitlement.reason === 'cancelled' ? 'Access until' : entitlement.is_valid ? 'Ends' : 'Expired';

  return (
    <section className={`trial-banner trial-banner--${notice.stage || 'active'}`} role="status" aria-live="polite">
      <span className="trial-banner-icon"><ShieldAlert size={18} /></span>
      <div className="trial-banner-copy">
        <strong>{notice.title || 'Free trial active'}</strong>
        <span><CalendarClock size={14} /> {datePrefix} {dateLabel(entitlement.ends_at)}{entitlement.is_valid && <> &middot; {days} {days === 1 ? 'day' : 'days'} remaining</>}</span>
        <small>{notice.message || 'Backup download and data restore require a paid plan.'}</small>
      </div>
      {owner && <button type="button" onClick={onBilling}><CreditCard size={15} /> Billing</button>}
    </section>
  );
}
