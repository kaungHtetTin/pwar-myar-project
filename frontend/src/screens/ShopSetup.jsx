import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, CreditCard, Package, Plus, Store, X } from 'lucide-react';
import { request } from '../api';
import { nextSetupProgress } from '../shopSetupProgress';
import { emitDataChange } from '../dataEvents';
import { AuthLocaleToggle } from '../components/AuthLocaleToggle';
import { RetainedViews } from '../components/RetainedViews';
import { useRetainedActivity } from '../components/retainedActivity';
import { ShopLogoSettings } from './ShopLogoSettings';
import { ShopCoverSettings } from './ShopCoverSettings';
import '../styles/shop-setup.css';

const steps = ['Shop details', 'Payments', 'Products', 'Sales AI', 'Review'];
const icons = [Store, CreditCard, Package, Bot, CheckCircle2];
const descriptions = [
  'Give your online shop a name, a look and a customer link.',
  'Customers pay you directly. Verify payments before approving orders.',
  'Publish products with valid prices. Changes save immediately.',
  'Let your sales representative help customers in shop chat.',
  'Review your setup and choose when to open your shop.',
];
const settingsKeys = ['slug', 'display_name', 'phone', 'address', 'currency', 'description', 'price_type', 'pickup_instructions', 'pickup_address', 'pickup_hours', 'opening_hours', 'announcement', 'closed_until', 'delivery_zones', 'payment_methods', 'storefront_enabled', 'accepting_orders', 'marketplace_enabled'];
const fieldsByStep = key => key.startsWith('payment_methods') ? 2 : key.startsWith('delivery_zones') || key.startsWith('pickup_') ? null : 1;
function SetupField({ label, error, hint, children }) {
  const id = React.useId();
  return <div className="shop-setup-field"><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? `${id}-help` : undefined })}{(error || hint) && <small id={`${id}-help`} role={error ? 'alert' : undefined}>{error || hint}</small>}</div>;
}

export function ShopSetup({ step = 1, onStep, onClose, onSaved, onManage, onBusyChange, persistProgress = false, onCompleted, renderProducts }) {
  const [form, setForm] = useState(null), [saved, setSaved] = useState(null), [ai, setAi] = useState(null), [aiDraft, setAiDraft] = useState(null);
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [done, setDone] = useState(false);
  const [aiError, setAiError] = useState(''), [aiRetry, setAiRetry] = useState(0);
  const [productSearch, setProductSearch] = useState(''), [productQuery, setProductQuery] = useState('');
  const [productsRevision, setProductsRevision] = useState(0);
  const lock = useRef(false), alive = useRef(false), currentStep = useRef(step), heading = useRef(null);
  const active = useRetainedActivity(), activeRef = useRef(active); activeRef.current = active;
  currentStep.current = step;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const updated = event => {
      if (event.detail?.wallet) setAi(current => current && ({ ...current, wallet: event.detail.wallet }));
    };
    window.addEventListener('mkpos:sales-ai-updated', updated);
    return () => window.removeEventListener('mkpos:sales-ai-updated', updated);
  }, []);
  useEffect(() => {
    let active = true;
    request('/shop-admin/settings').then(value => { if (active) { setForm({ ...value, price_type: 'Retail', storefront_enabled: true, accepting_orders: true, marketplace_enabled: true }); setSaved(value); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    request('/shop-admin/sales-ai').then(value => { if (active) { setAi(value); setAiDraft(value.settings); setAiError(''); } }).catch(e => { if (active) setAiError(e.message); });
    return () => { active = false; };
  }, [aiRetry]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step, done]);
  useEffect(() => { const timer = setTimeout(() => setProductQuery(productSearch.trim()), 300); return () => clearTimeout(timer); }, [productSearch]);

  const change = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };
  const changeAi = (key, value) => setAiDraft(current => ({ ...current, [key]: value }));
  const fieldError = key => Array.isArray(errors[key]) ? errors[key][0] : errors[key];
  const go = next => { if (!lock.current) { setError(''); setErrors({}); onStep(next); } };
  const Icon = icons[step - 1];
  async function save(event) {
    event.preventDefault();
    if (lock.current || !form) return;
    if (step === 4 && !aiDraft) return;
    const submittedStep = step;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError(''); setErrors({});
    try {
      if (step === 3) {
        // Publication controls save their own changes before this step advances.
      } else if (step === 4) {
        const result = await request('/shop-admin/sales-ai', { method: 'PUT', body: JSON.stringify(aiDraft) });
        if (!alive.current) return;
        setAi(result); setAiDraft(result.settings);
        window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: result }));
      } else {
        // Each save owns only its step. Revisit drafts cannot publish the storefront early.
        const keys = step === 1 ? ['display_name', 'slug', 'phone', 'address', 'price_type'] : step === 2 ? ['payment_methods'] : ['storefront_enabled', 'accepting_orders', 'marketplace_enabled'];
        const merged = { ...saved, ...Object.fromEntries(keys.map(key => [key, form[key]])) };
        if (step === 1) merged.price_type = 'Retail';
        if (step === 2) merged.payment_methods = (merged.payment_methods || []).map(method => method.type !== 'cash' && !saved.payment_methods?.some(row => row.id === method.id) ? { ...method, name: method.bank?.trim() || 'Bank transfer' } : method);
        const payload = Object.fromEntries(settingsKeys.filter(key => merged[key] !== undefined).map(key => [key, merged[key]]));
        const result = await request('/shop-admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
        if (!alive.current) return;
        setSaved(result);
        if (result.price_type !== saved.price_type || result.currency !== saved.currency) setProductsRevision(value => value + 1);
        // Preserve drafts belonging to other steps, and accept normalized fields for this save.
        setForm(current => ({ ...current, ...Object.fromEntries(keys.map(key => [key, result[key]])), price_types: result.price_types, slug_locked: result.slug_locked }));
        emitDataChange(['settings', 'ecommerce'], 'shop');
        onSaved();
      }
      if (persistProgress) await request('/shop-admin/setup', { method: 'PUT', body: JSON.stringify(nextSetupProgress(step)) });
      if (alive.current && step === 5) onCompleted?.();
      if (alive.current && activeRef.current && currentStep.current === submittedStep) {
        if (step === 5) setDone(true);
        else onStep(step + 1);
      }
    } catch (e) {
      if (!alive.current) return;
      setError(e.message); const nextErrors = e.payload?.errors || e.errors || {}; setErrors(nextErrors);
      if (submittedStep !== 4 && Object.keys(nextErrors).length) {
        const invalidStep = fieldsByStep(Object.keys(nextErrors)[0]);
        if (invalidStep && invalidStep !== submittedStep && activeRef.current) onStep(invalidStep);
      }
      if (submittedStep === 4 && e.status === 409) setAiError('Sales AI changed elsewhere. Reload its latest settings before saving again.');
    } finally { lock.current = false; onBusyChange?.(false); if (alive.current) setBusy(false); }
  }
  const methods = form?.payment_methods || [];
  const patchRow = (key, id, field, value) => change(key, form[key].map(row => row.id === id ? { ...row, [field]: value } : row));
  const title = done ? 'Your shop setup is saved' : steps[step - 1];
  return <section className="shop-setup-page" aria-label="Shop setup">
    <div className="shop-setup-layout">
      <aside className="shop-setup-sidebar"><small>YOUR ONLINE SHOP</small><h2>From your counter.<br />To your customers.</h2><p>Everything you need to start selling online.</p><ol aria-label="Shop setup steps">{steps.map((label, index) => <li key={label} className={done || index + 1 < step ? "is-complete" : undefined} aria-current={!done && step === index + 1 ? 'step' : undefined}><button type="button" disabled={busy || !form || done} onClick={() => go(index + 1)}><span className="shop-setup-step-number">{done || index + 1 < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span><span className="shop-setup-step-label">{label}</span>{!done && step === index + 1 && <ArrowRight className="shop-setup-step-arrow" size={14} aria-hidden="true" />}</button></li>)}</ol><small>Save each step. Return whenever you need.</small></aside>
      <div className="shop-setup-content">
        <header className="shop-setup-heading"><span className="shop-setup-icon">{done ? <CheckCircle2 size={20} /> : <Icon size={20} />}</span><div className="shop-setup-heading-actions"><small>{done ? 'Setup complete' : `${step} / ${steps.length}`}</small><AuthLocaleToggle /><button type="button" disabled={busy} onClick={onClose}><X size={16} />Close setup</button></div><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{done ? 'You can update these settings at any time from Shop.' : descriptions[step - 1]}</p></header>
        {error && <p className="shop-setup-error" role="alert">{error}</p>}
        {!form ? <>{!error ? <p role="status">Loading shop setup…</p> : <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>}</> : done ? <div className="shop-setup-complete"><dl><div><dt>Storefront</dt><dd>{saved.storefront_enabled ? 'Enabled' : 'Disabled'}</dd></div><div><dt>Accept new orders</dt><dd>{saved.accepting_orders ? 'Enabled' : 'Disabled'}</dd></div><div><dt>Sales AI</dt><dd>{ai?.settings.enabled ? 'Enabled' : 'Disabled'}</dd></div></dl>{ai?.settings.enabled && Number(ai.wallet?.available || 0) <= 0 && <p role="status">Sales AI needs available credit to reply to customers.</p>}<div className="shop-setup-actions"><button type="button" className="primary" onClick={() => onManage('orders')}>Complete</button></div></div> : <>
          <form id="shop-setup-form" onSubmit={save} className="shop-setup-form">
            <fieldset disabled={busy}>
              <div className="shop-setup-slide" key={step}>
              {step === 1 && <div className="shop-setup-details-layout"><div className="shop-setup-branding"><ShopCoverSettings variant="setup" cover={form.cover_data_url} onChange={value => change('cover_data_url', value)} /><ShopLogoSettings variant="setup" logo={form.receipt_logo_data_url} owner onChange={value => change('receipt_logo_data_url', value)} /><small>Logo and cover uploads are saved immediately.</small></div><div className="shop-setup-detail-fields">
                <SetupField label="Public shop name" error={fieldError('display_name')}><input required maxLength={255} value={form.display_name || ''} onChange={e => change('display_name', e.target.value)} /></SetupField>
                <SetupField label="Shop slug" error={fieldError('slug')} hint={form.slug_locked ? 'Your shop link is locked after receiving orders.' : 'Use lowercase letters, numbers and hyphens.'}><input required disabled={form.slug_locked} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug || ''} onChange={e => change('slug', e.target.value)} /></SetupField>
                <SetupField label="Phone" error={fieldError('phone')}><input type="tel" maxLength={50} value={form.phone || ''} onChange={e => change('phone', e.target.value)} /></SetupField>

                <SetupField label="Address" error={fieldError('address')}><textarea rows={3} maxLength={1000} value={form.address || ''} onChange={e => change('address', e.target.value)} /></SetupField>

              </div></div>}
              {step === 2 && <>{fieldError('payment_methods') && <p role="alert">{fieldError('payment_methods')}</p>}{methods.map((method, index) => method.type !== 'cash' && <section className="shop-setup-method" key={method.id}><div className="shop-setup-section-heading"><h3>{method.bank || method.name || 'Payment method'}</h3>{!saved.payment_methods?.some(row => row.id === method.id) && <button type="button" aria-label="Remove new payment method" onClick={() => change('payment_methods', methods.filter(row => row.id !== method.id))}><X size={14} /></button>}</div><div className="shop-setup-grid">{method.type === 'transfer' && [['bank', 'Bank / wallet', 100], ['account_name', 'Account holder', 255], ['account_no', 'Account number / phone', 100]].map(([key, label, max]) => <SetupField key={key} label={label} error={fieldError(`payment_methods.${index}.${key}`)}><input maxLength={max} value={method[key] || ''} onChange={e => patchRow('payment_methods', method.id, key, e.target.value)} /></SetupField>)}</div><label className="shop-setup-check"><input type="checkbox" checked={method.is_active !== false} onChange={e => patchRow('payment_methods', method.id, 'is_active', e.target.checked)} />Available at checkout</label></section>)}<button type="button" disabled={methods.length >= 20} onClick={() => change('payment_methods', [...methods, { id: crypto.randomUUID(), name: '', type: 'transfer', provider: 'manual', is_active: true, instructions: '', bank: '', account_name: '', account_no: '' }])}><Plus size={14} />Add payment method</button></>}

              {step === 4 && <>{aiError && <p role="alert">{aiError}<button type="button" onClick={() => setAiRetry(value => value + 1)}>Reload Sales AI</button></p>}{!aiDraft ? !aiError && <p role="status">Loading Sales AI?</p> : <><div className="shop-setup-check shop-setup-feature"><Bot size={24} /><span><strong>Enable Sales AI</strong></span><button type="button" className="shop-chat-handover-toggle" role="switch" aria-label="Enable Sales AI" aria-checked={!!aiDraft.enabled} disabled={busy} onClick={() => changeAi('enabled', !aiDraft.enabled)}><span className="shop-chat-toggle-track" aria-hidden="true"><span /></span><span aria-hidden="true">{aiDraft.enabled ? 'Enabled' : 'Disabled'}</span></button></div><SetupField label="Representative name" error={fieldError('name')}><input required maxLength={80} value={aiDraft.name || ''} onChange={e => changeAi('name', e.target.value)} /></SetupField></>}</>}
              {step === 5 && <><dl className="shop-setup-review"><div><dt>Public shop name</dt><dd data-no-localize>{saved.display_name}</dd></div><div><dt>Online price type</dt><dd data-no-localize>{saved.price_type}</dd></div><div><dt>Payment methods</dt><dd>{saved.payment_methods?.filter(method => method.is_active !== false).length || 0}</dd></div><div><dt>Sales AI</dt><dd>{ai?.settings.enabled ? 'Enabled' : 'Disabled'}</dd></div><div><dt>Shop location</dt><dd>{saved.location ? 'Submitted' : 'Required'}</dd></div></dl><div className="shop-setup-launch-options">{[['storefront_enabled', 'Enable storefront'], ['accepting_orders', 'Accept new orders'], ['marketplace_enabled', 'List in marketplace']].map(([key, label]) => <label className="shop-setup-check" key={key}><input type="checkbox" checked={!!form[key]} onChange={e => change(key, e.target.checked)} /><span>{label}</span></label>)}</div>{!!saved.marketplace_suspended && <p role="alert">Marketplace listing suspended: {saved.marketplace_suspension_reason}</p>}{ai?.settings.enabled && Number(ai.wallet?.available || 0) <= 0 && <p className="shop-setup-notice">Sales AI needs available credit to reply to customers.</p>}</>}
              </div>
            </fieldset>
          </form>
          <RetainedViews activeKey={step === 3 ? 'products' : 'other'}>{step === 3 ? <>{renderProducts({ busy, search: productQuery, revision: productsRevision, searchField: <SetupField label="Search products"><input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search name, SKU, barcode or category" /></SetupField> })}</> : null}</RetainedViews>
          <footer className="shop-setup-actions"><button type="button" disabled={busy} onClick={() => step === 1 ? onClose() : go(step - 1)}><ArrowLeft size={15} />{step === 1 ? 'Back to Shop' : 'Back'}</button><button type="submit" form="shop-setup-form" className="primary" disabled={busy || (step === 4 && !aiDraft)}>{busy ? 'Saving…' : step === 5 ? 'Save shop setup' : step === 3 ? 'Continue' : 'Save & continue'}<ArrowRight size={15} /></button></footer>
        </>}
      </div>
    </div>
  </section>;
}
