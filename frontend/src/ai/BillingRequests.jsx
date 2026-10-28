import React, { useEffect, useRef, useState } from 'react';
import { AttachmentPreview } from './AttachmentPreview';
import { AssistantReply } from './AssistantReply';
import './business-actions.css';
import './billing-requests.css';

const valuesFor = row => ({ subscription_plan_id: String(row.subscription_plan_id || ''), payment_method_id: String(row.payment_method_id || ''), image_message_id: String(row.image_message_id || ''), message: row.message || '' });
const checkNames = { recipient_name: 'Recipient name', recipient_account: 'Account last 4 digits', amount: 'Amount', currency: 'Currency', provider: 'Provider', payment_status: 'Payment status', payment_date: 'Payment date', transaction_reference: 'Transaction ID', duplicate_payment: 'Duplicate payment' };
const checkStatuses = { match: 'Match', mismatch: 'Mismatch', unknown: 'Unclear', not_visible: 'Not shown (optional)' };

function BillingForm({ row, api, conversation, onChange, onBusy, onSaved, screens, onNavigate, disabled, stateCache }) {
  const cached = stateCache?.current?.conversation === conversation ? stateCache.current.forms?.[row.id] : null;
  const [values, setValues] = useState(cached?.values || valuesFor(row));
  const [consentHash, setConsentHash] = useState(cached?.consentHash || null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), running = useRef(false), serverVersion = useRef(cached?.serverVersion ?? `${row.revision}:${row.status}`);
  const version = `${row.revision}:${row.status}`;
  useEffect(() => { if (serverVersion.current !== version) { serverVersion.current = version; setValues(valuesFor(row)); setConsentHash(null); } }, [version, row]);
  useEffect(() => {
    if (!stateCache) return;
    if (stateCache.current?.conversation !== conversation) stateCache.current = { conversation, forms: {} };
    stateCache.current.forms[row.id] = { values, consentHash, serverVersion: version };
  }, [stateCache, conversation, row.id, values, consentHash, version]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusy(false); }; }, [onBusy]);
  const saved = valuesFor(row);
  const dirty = Object.keys(values).some(key => values[key] !== saved[key]);
  const valid = row.status === 'validated' && !dirty && row.preview_hash && Date.parse(row.expires_at) > Date.now();
  const terminal = ['submitted', 'cancelled'].includes(row.status);
  const base = `/ai-assistant/conversations/${conversation}/billing-requests/${row.id}`;
  const update = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setConsentHash(null); setError(''); };
  const accept = next => {
    if (!alive.current) return;
    onChange(next); setValues(valuesFor(next)); setConsentHash(null); setError('');
    if (next.status === 'submitted' && row.status !== 'submitted') onSaved?.(next);
  };
  const run = async task => {
    if (running.current) return;
    running.current = true; setBusy(true); onBusy(true); setError('');
    try { await task(); }
    catch (e) {
      if (alive.current) {
        setError(e.message);
        try { const latest = await api(base); if (alive.current) onChange(latest); } catch { /* Preserve the original error and edits. */ }
      }
    } finally { running.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  };
  const validate = event => { event.preventDefault(); void run(async () => accept(await api(`${base}/validate`, { method: 'POST', timeoutMs: 190000, body: JSON.stringify({ ...values, revision: row.revision }) }))); };
  const submit = () => {
    if (!valid || consentHash !== row.preview_hash) return;
    void run(async () => accept(await api(`${base}/submit`, { method: 'POST', timeoutMs: 190000, body: JSON.stringify({ revision: row.revision, preview_hash: row.preview_hash }) })));
  };
  const cancel = () => void run(async () => accept(await api(`${base}/cancel`, { method: 'POST', body: '{}' })));
  const image = row.options.images.find(item => String(item.id) === values.image_message_id);
  const title = dirty ? 'Needs validation' : ({ draft: 'Needs validation', checking: 'Checking payment', validated: 'Ready for owner review', expired: 'Validation expired', submitted: 'Submitted', cancelled: 'Cancelled' }[row.status] || row.status);

  return <article className="ai-business-actions ai-billing-card" aria-label="Billing request form" aria-busy={busy}>
    <div className="ai-action-heading"><h3>PwarMyar billing request</h3><span className="ai-billing-status">{title}</span></div>
    <p>Check your payment receipt, review the details, then submit for Office approval.</p>
    {!terminal && <form className="ai-settings-form" onSubmit={validate}>
      <label className="ai-settings-field"><span>Subscription plan</span><select aria-label="Subscription plan" required value={values.subscription_plan_id} disabled={busy || disabled} onChange={e => update('subscription_plan_id', e.target.value)}>
        <option value="">Choose a plan</option>{row.options.plans.map(plan => <option key={plan.id} value={String(plan.id)}>{plan.name} — {Number(plan.price).toLocaleString()} {plan.currency}{plan.duration_days ? ` / ${plan.duration_days} days` : ''}</option>)}
      </select></label>
      <label className="ai-settings-field"><span>PwarMyar receiving account</span><select aria-label="PwarMyar receiving account" required value={values.payment_method_id} disabled={busy || disabled} onChange={e => update('payment_method_id', e.target.value)}>
        <option value="">Choose a receiving account</option>{row.options.payment_methods.map(method => <option key={method.id} value={String(method.id)}>{method.provider} — {method.account_name} (…{method.account_last_four || 'unknown'})</option>)}
      </select></label>
      <label className="ai-settings-field is-wide"><span>Payment screenshot</span><select aria-label="Payment screenshot" required value={values.image_message_id} disabled={busy || disabled} onChange={e => update('image_message_id', e.target.value)}>
        <option value="">Choose an uploaded image</option>{row.options.images.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
      </select><small>Send a replacement image in this chat to use a different screenshot.</small></label>
      {image && <div className="ai-billing-image"><AttachmentPreview attachment={image}/></div>}
      <label className="ai-settings-field is-wide"><span>Note (optional)</span><textarea aria-label="Billing request note" maxLength={1000} value={values.message} disabled={busy || disabled} onChange={e => update('message', e.target.value)}/></label>
      <div className="ai-settings-form-actions"><button type="submit" disabled={busy || disabled || !values.subscription_plan_id || !values.payment_method_id || !values.image_message_id}>{busy ? 'Processing…' : 'Validate payment'}</button></div>
      {dirty && <p role="status">Selections changed. Validate again before submitting.</p>}
    </form>}
    {(error || row.error) && <p role="alert">{error || row.error}</p>}
    {row.review && <section className="ai-billing-review" aria-label="Payment validation result">
      <h4>{dirty ? 'Previous validation' : 'Payment validation'}</h4>
      <dl><dt>Plan</dt><dd data-no-localize>{row.review.plan.name} · {Number(row.review.plan.price).toLocaleString()} {row.review.plan.currency}</dd>
        <dt>Recipient</dt><dd data-no-localize>{row.review.payment_method.account_name} (…{row.review.payment_method.account_last_four})</dd>
        <dt>Transaction ID</dt><dd>{row.review.observed.transaction_reference || 'Not readable'}</dd>
        <dt>Receipt amount</dt><dd>{row.review.observed.amount || 'Not readable'} {row.review.observed.currency}</dd>
      </dl>
      <div className="ai-billing-checks" role="region" aria-label="Receipt checks" tabIndex={0}><table><thead><tr><th>Check</th><th>Result</th></tr></thead><tbody>{row.review.checks.map((check, index) => <tr key={`${check.field}:${index}`}><td>{checkNames[check.field] || check.field}</td><td data-validation-status={check.status}>{checkStatuses[check.status] || check.status}</td></tr>)}</tbody></table></div>
      {row.review.pending_request_ids?.length > 0 && !terminal && <p>Submitting will replace {row.review.pending_request_ids.length} earlier pending billing request(s).</p>}
    </section>}
    {valid && <p>Checked until {new Date(row.expires_at).toLocaleString()}. Screenshot checks do not confirm bank funds.</p>}
    {!terminal && <>
      <label className="ai-action-consent"><input type="checkbox" aria-label="Approve billing submission" checked={!!valid && consentHash === row.preview_hash} disabled={busy || disabled || !valid} onChange={e => setConsentHash(e.target.checked ? row.preview_hash : null)}/>I reviewed the plan, account and screenshot and want to submit this billing request.</label>
      <div className="ai-action-buttons"><button type="button" disabled={busy || disabled} onClick={cancel}>Cancel billing form</button><button type="button" className="primary" disabled={busy || disabled || !valid || consentHash !== row.preview_hash} onClick={submit}>Submit billing request</button></div>
      <button type="button" className="ai-billing-refresh" disabled={busy || disabled} onClick={() => void run(async () => { const next = await api(base); if (alive.current) onChange(next); })}>Check billing status</button>
    </>}
    {row.status === 'submitted' && <p role="status">Request #{row.request_id}: {row.request_status === 'pending' ? 'Pending Office approval' : row.request_status || 'Submitted'}. Subscription approval is handled by Office.</p>}
    {row.status === 'cancelled' && <p role="status">Billing form cancelled. Nothing was submitted from this form.</p>}
    {row.status === 'submitted' && <AssistantReply role="owner" screens={screens} onNavigate={onNavigate} body="[Open Billing](#mkpos-screen=billing)"/>}
  </article>;
}

export function BillingRequests({ requests = [], role, ...props }) {
  if (role !== 'owner' || !requests.length) return null;
  return <section className="ai-billing-requests" aria-label="Chat billing requests">{requests.map(row => <BillingForm key={row.id} row={row} {...props}/>)}</section>;
}
