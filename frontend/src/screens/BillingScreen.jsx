import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  Landmark,
  Mail,
  MessageCircle,
  Phone,
  Send,
  UsersRound,
} from 'lucide-react';
import { request } from '../api';
import { money } from '../utils';
import { useScreenNotifications } from '../components/notifications';
import { useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { PaymentRequestModal } from '../components/PaymentRequestModal';
import { TableLoadingState } from '../components/common';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { AppBarActions } from '../components/WorkspaceHeader';
import { usePlatformContacts, viberHref } from '../platformContacts';

function dateLabel(value) {
  if (!value) return 'No end date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function paymentType(type) {
  return type === 'renewal' ? 'Renewal' : 'New assignment';
}

export function BillingContacts() {
  const contacts = usePlatformContacts();
  return (
    <section className="billing-contact-card" aria-label="Billing support contacts">
      <div className="billing-contact-heading">
        <span><MessageCircle size={19} /></span>
        <div><strong>Need billing help?</strong><small>Contact the PwarMyar team</small></div>
      </div>
      <div className="billing-contact-groups">
        {contacts.phone_numbers.length > 0 && <div className="billing-contact-group">
          <strong><Phone size={15} /> Phone</strong>
          <span>{contacts.phone_numbers.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^+0-9]/g, '')}`}>{phone}</a>)}</span>
        </div>}
        {contacts.telegram_url && <div className="billing-contact-group">
          <strong><Send size={15} /> Telegram</strong>
          <span><a href={contacts.telegram_url} target="_blank" rel="noreferrer">{contacts.telegram_url.replace(/^https:\/\/(?:www\.)?t\.me\//, '@')}</a></span>
        </div>}
        {contacts.viber_numbers.length > 0 && <div className="billing-contact-group">
          <strong><MessageCircle size={15} /> Viber</strong>
          <span>{contacts.viber_numbers.map(phone => <a key={phone} href={viberHref(phone)} aria-label={`Viber ${phone}`}>{phone}</a>)}</span>
        </div>}
        {contacts.email && <div className="billing-contact-group"><strong><Mail size={15} /> Email</strong><span><a href={`mailto:${contacts.email}`}>{contacts.email}</a></span></div>}
        {contacts.community_url && <div className="billing-contact-group"><strong><UsersRound size={15} /> Community</strong><span><a href={contacts.community_url} target="_blank" rel="noreferrer">{contacts.community_label || 'Join the community'}</a></span></div>}
      </div>
    </section>
  );
}

export function BillingScreen() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [history, setHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const { setError, setMessage } = useScreenNotifications();

  useEffect(() => {
    let active = true;
    const reconcile = event => {
      if (!event.detail) return;
      setSubscription(event.detail);
      request('/subscription/billing-history').then(data => { if (active) setHistory(data.items || []); }).catch(() => {});
    };
    window.addEventListener('mkpos:subscription-entitlement', reconcile);
    return () => { active = false; window.removeEventListener('mkpos:subscription-entitlement', reconcile); };
  }, []);

  async function loadBilling() {
    setLoading(true);
    setError('');
    try {
      const [nextSubscription, planPayload, historyPayload, paymentMethodPayload] = await Promise.all([
        request('/subscription'),
        request('/subscription/plans'),
        request('/subscription/billing-history'),
        request('/subscription/payment-methods'),
      ]);
      setSubscription(nextSubscription);
      setPlans(planPayload.items || []);
      setHistory(historyPayload.items || []);
      setPaymentMethods(paymentMethodPayload.items || []);
    } catch (error) {
      setError(`Cannot load billing information. ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  useLatestEffect(() => {
    loadBilling();
  }, []);

  useDataRefresh(['subscription'], 'billing', loadBilling);

  async function submitPayment({ paymentMethodId, screenshot, message }) {
    const plan = selectedPlan;
    const formData = new FormData();
    formData.append('subscription_plan_id', String(plan.id));
    formData.append('payment_method_id', String(paymentMethodId));
    formData.append('payment_screenshot', screenshot);
    if (message) formData.append('message', message);
    setBusyPlanId(plan.id);
    setPaymentError('');
    setError('');
    try {
      const payload = await request('/subscription/requests', {
        method: 'POST',
        body: formData,
        timeoutMs: 120000,
      });
      setSubscription(payload.subscription);
      window.dispatchEvent(new CustomEvent('mkpos:subscription-entitlement', { detail: payload.subscription }));
      setSelectedPlan(null);
      setMessage(`Request for ${plan.name} was sent to the PwarMyar office.`);
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setBusyPlanId(null);
    }
  }

  const current = subscription?.subscription;
  const pending = subscription?.pending_request;
  const activePlanId = Number(current?.subscription_plan_id || 0);

  function exportBillingHistory() {
    return exportFilteredCsv({
      path: '/subscription/billing-history',
      filename: csvFilename('billing-history'),
      columns: [
        { label: 'Date', value: (row) => row.paid_at }, { label: 'Package', value: (row) => row.plan_name },
        { label: 'Activity', value: (row) => paymentType(row.type) }, { label: 'Term Days', value: (row) => row.duration_days },
        { label: 'Reference', value: (row) => `BILL-${String(row.id).padStart(5, '0')}` }, { label: 'Amount', value: (row) => row.amount },
        { label: 'Currency', value: (row) => row.currency || 'Ks' }, { label: 'Status', value: () => 'Paid' },
      ],
    });
  }

  return (
    <section className="screen billing-screen mkpos-sheet">
      <AppBarActions>
        <CsvExportButton onExport={exportBillingHistory} onError={setError} onSuccess={setMessage} />
      </AppBarActions>

      <BillingContacts />

      {subscription?.lifecycle_notice && (subscription.reason === 'cancelled' || !subscription.is_valid) && (
        <div className="billing-pending billing-lifecycle-alert" role="alert">
          <span><ShieldAlert size={18} /></span>
          <div>
            <strong>{subscription.lifecycle_notice.title}</strong>
            <small>{subscription.lifecycle_notice.message}</small>
          </div>
        </div>
      )}

      <section className="billing-plans-section">
        {!loading && (
          <div className="billing-plan-grid">
            {plans.map((plan) => {
              const isCurrent = activePlanId === Number(plan.id);
              const isPending = Number(pending?.subscription_plan_id) === Number(plan.id);
              return (
                <article className={`billing-plan-card${isCurrent ? ' is-current' : ''}`} key={plan.id}>
                  <div className="billing-plan-head">
                    <div><strong>{plan.name}</strong><span>{plan.duration_days} days access</span></div>
                    {isCurrent && <span className={`billing-current-badge${subscription?.reason === 'cancelled' ? ' is-suspended' : ''}`}><CheckCircle2 size={14} /> {subscription?.reason === 'cancelled' ? 'Suspended' : subscription?.is_valid ? 'Active' : 'Expired'}</span>}
                    {isPending && !isCurrent && <span className="billing-pending-badge"><Clock3 size={14} /> Pending</span>}
                  </div>
                  <div className="billing-plan-price">{money(plan.price, plan.currency)}<span>/ {plan.duration_days} days</span></div>
                  <p>{plan.description || 'PwarMyar business access package.'}</p>
                  <ul>
                    {(plan.features || []).slice(0, 4).map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}
                    {(plan.features || []).length > 4 && <li className="billing-more-features">+{plan.features.length - 4} more features</li>}
                  </ul>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setSelectedPlan(plan)}
                    disabled={busyPlanId !== null || isPending || !paymentMethods.length}
                  >
                    {isPending ? <Clock3 size={16} /> : <Send size={16} />}
                    {isPending ? 'Request pending' : busyPlanId === plan.id ? 'Sending...' : isCurrent ? 'Request renewal' : 'Request package'}
                  </button>
                  {isPending && <small className="billing-plan-request-status">{plan.name} request is awaiting approval</small>}
                </article>
              );
            })}
            {!plans.length && !loading && <div className="billing-empty">No packages are available right now.</div>}
          </div>
        )}
      </section>

      {!loading && plans.length > 0 && !paymentMethods.length && <div className="billing-pending" role="alert"><span><Landmark size={18} /></span><div><strong>No payment method is available</strong><small>Please contact the PwarMyar office before requesting a package.</small></div></div>}
      {selectedPlan && <PaymentRequestModal error={paymentError} onClearError={()=>setPaymentError('')} plan={selectedPlan} paymentMethods={paymentMethods} busy={busyPlanId === selectedPlan.id} onClose={() => { setSelectedPlan(null); setPaymentError(''); }} onSubmit={submitPayment} />}

      <section className="billing-table-card billing-history-panel" aria-label="Billing history">
        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead><tr><th>Date</th><th>Package</th><th>Activity</th><th>Term</th><th>Reference</th><th className="number">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((payment) => (
                <tr key={payment.id}>
                  <td>{dateLabel(payment.paid_at)}</td>
                  <td><strong>{payment.plan_name}</strong></td>
                  <td>{paymentType(payment.type)}</td>
                  <td>{payment.duration_days} days</td>
                  <td className="billing-reference">BILL-{String(payment.id).padStart(5, '0')}</td>
                  <td className="number"><strong>{money(payment.amount, payment.currency)}</strong></td>
                  <td><span className="status-badge completed">Paid</span></td>
                </tr>
              ))}
              {!history.length && !loading && <tr><td colSpan="7"><div className="billing-empty">No billing history yet. Completed plan payments will appear here.</div></td></tr>}
            </tbody>
          </table>
          {loading && <TableLoadingState>Loading billing history…</TableLoadingState>}
        </div>
      </section>
    </section>
  );
}
