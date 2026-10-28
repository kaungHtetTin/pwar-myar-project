import { BrandImage } from '../platformBranding';
import React, { useEffect, useState } from 'react';
import { CalendarClock, Check, CreditCard, LogOut, RefreshCw } from 'lucide-react';
import { request } from '../api';
import { BRAND_LOGO } from '../assets';
import { PaymentRequestModal } from './PaymentRequestModal';
import { PageSkeleton } from './common';

function money(value, currency) {
  return `${Number(value || 0).toLocaleString()} ${currency || 'Ks'}`;
}

export function SubscriptionScreen({ session, onSession, onLoggedOut }) {
  const [plans, setPlans] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const subscription = session.subscription || {};

  useEffect(() => {
    Promise.all([request('/subscription/plans'), request('/subscription/payment-methods')]).then(([planPayload, methodPayload]) => {
      setPlans(planPayload.items || []);
      setPaymentMethods(methodPayload.items || []);
    })
      .catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  async function submitPayment({ paymentMethodId, screenshot, message: note }) {
    const plan = selectedPlan;
    const formData = new FormData();
    formData.append('subscription_plan_id', String(plan.id));
    formData.append('payment_method_id', String(paymentMethodId));
    formData.append('payment_screenshot', screenshot);
    if (note) formData.append('message', note);
    setBusyId(plan.id);
    setError('');
    setMessage('');
    try {
      const payload = await request('/subscription/requests', {
        method: 'POST',
        body: formData,
        timeoutMs: 120000,
      });
      onSession({ ...session, subscription: payload.subscription });
      setSelectedPlan(null);
      setMessage('Your request was sent. The PwarMyar office will activate the plan after payment confirmation.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function checkAccess() {
    setBusyId('refresh');
    setError('');
    try {
      onSession(await request('/auth/me'));
    } catch (refreshError) {
      setError(refreshError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    setBusyId('logout');
    try {
      await request('/auth/logout', { method: 'POST' });
      onLoggedOut();
    } finally {
      setBusyId(null);
    }
  }

  const reason = subscription.reason === 'expired'
    ? 'Your subscription has expired.'
    : subscription.reason === 'cancelled'
      ? 'Your subscription was cancelled.'
      : 'Your business does not have an active subscription yet.';

  return (
    <main className="subscription-page">
      <header className="subscription-header">
        <div className="auth-brand">
          <BrandImage src={BRAND_LOGO} alt="" />
          <div><strong>PwarMyar</strong><span>{session.business.name}</span></div>
        </div>
        <button type="button" onClick={logout} disabled={busyId === 'logout'}><LogOut size={17} /> Sign out</button>
      </header>

      <section className="subscription-hero">
        <span className="subscription-icon"><CalendarClock size={28} /></span>
        <h1>Choose or renew your plan</h1>
        <p>{reason} Select a plan below and send your purchase request.</p>
        {subscription.subscription?.ends_at && <small>Previous access ended: {new Date(subscription.subscription.ends_at).toLocaleDateString()}</small>}
        {subscription.pending_request && (
          <div className="subscription-pending">Request pending for <strong>{subscription.pending_request.plan_name}</strong>. The platform office will confirm it.</div>
        )}
        <button className="subscription-refresh" type="button" onClick={checkAccess} disabled={busyId === 'refresh'}>
          <RefreshCw size={17} /> {busyId === 'refresh' ? 'Checking...' : 'Check activation'}
        </button>
      </section>

      {error && !selectedPlan && <div className="subscription-feedback error" role="alert">{error}</div>}
      {message && <div className="subscription-feedback success">{message}</div>}
      {loading ? <PageSkeleton>Loading plans...</PageSkeleton> : (
        <section className="plan-grid" aria-label="Subscription plans">
          {plans.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <div><h2>{plan.name}</h2><p>{plan.description}</p></div>
              <div className="plan-price"><strong>{money(plan.price, plan.currency)}</strong><span>for {plan.duration_days} days</span></div>
              <ul>{(plan.features || []).map((feature) => <li key={feature}><Check size={16} /> {feature}</li>)}</ul>
              <button type="button" onClick={() => setSelectedPlan(plan)} disabled={busyId !== null || !paymentMethods.length || subscription.pending_request?.subscription_plan_id === plan.id}>
                <CreditCard size={18} /> {subscription.pending_request?.subscription_plan_id === plan.id ? 'Request pending' : busyId === plan.id ? 'Sending...' : 'Request this plan'}
              </button>
            </article>
          ))}
          {!plans.length && <div className="subscription-empty">No plans are available. Please contact the PwarMyar office.</div>}
        </section>
      )}
      {!loading && plans.length > 0 && !paymentMethods.length && <div className="subscription-feedback error">No payment method is available. Please contact the PwarMyar office.</div>}
      {selectedPlan && <PaymentRequestModal error={error} onClearError={() => setError('')} plan={selectedPlan} paymentMethods={paymentMethods} busy={busyId === selectedPlan.id} onClose={() => { setError(''); setSelectedPlan(null); }} onSubmit={submitPayment} />}
    </main>
  );
}
