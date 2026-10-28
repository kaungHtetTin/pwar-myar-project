import { Button } from '../components/Controls';
import React from 'react';
import { CalendarClock, CreditCard, ShieldAlert } from 'lucide-react';
import { useLocale } from '../localization/LocaleContext';

function localizedDate(value, language) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function TrialBanner({ session, onBilling }) {
  const { language } = useLocale();
  const entitlement = session?.subscription;
  const notice = entitlement?.lifecycle_notice;
  const isTrialNotice = entitlement?.is_valid && entitlement?.access_type === 'trial';
  const isSubscriptionAlert = entitlement?.reason === 'cancelled' || !entitlement?.is_valid;
  if (!notice || (!isTrialNotice && !isSubscriptionAlert)) return null;
  const days = Number(entitlement.days_remaining ?? notice.days_remaining ?? 0);
  const myanmar = language === 'my';

  return (
    <section className={`mobile-trial-banner is-${notice.stage || 'active'}`} role="status" aria-live="polite">
      <ShieldAlert size={20} aria-hidden="true" />
      <div>
        <strong>{myanmar && isTrialNotice ? 'တစ်လ အခမဲ့စမ်းသုံးကာလ' : (notice.title || 'Subscription notice')}</strong>
        <span><CalendarClock size={14} aria-hidden="true" />{myanmar && isTrialNotice ? `${localizedDate(entitlement.ends_at, language)} တွင် ပြီးဆုံးမည် · ${days} ရက်ကျန်` : `${entitlement.reason === 'cancelled' ? 'Access until' : entitlement.is_valid ? 'Ends' : 'Expired'} ${localizedDate(entitlement.ends_at, language)}${entitlement.is_valid ? ` · ${days} ${days === 1 ? 'day' : 'days'} remaining` : ''}`}</span>
        <small>{myanmar && isTrialNotice ? 'ဒေတာအရန်ကူးယူခြင်းနှင့် ပြန်လည်ထည့်သွင်းခြင်းအတွက် ငွေပေးချေထားသောအစီအစဉ် လိုအပ်သည်။' : notice.message}</small>
      </div>
      {session?.user?.role === 'owner' && <Button variant="plain" type="button" onClick={onBilling}><CreditCard size={17} />{myanmar ? 'ငွေတောင်းခံမှု' : 'Billing'}</Button>}
    </section>
  );
}
