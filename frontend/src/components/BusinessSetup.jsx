import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Banknote, Smartphone, Landmark, Boxes, Coins, Upload, X, Store, ShieldCheck, Sparkles } from 'lucide-react';
import { request } from '../api';
import { emitDataChange } from '../dataEvents';
import { ProductUnitSetup, ProductStockCostFields } from './ProductUnitFields';
import { baseUnitName } from '../productUnits';
import { AuthLocaleToggle } from './AuthLocaleToggle';
import '../styles/business-setup.css';

const stages = ['Business basics', 'Payments', 'Add a product'];
const stageDetails = ['Name, currency and time zone', 'How customers pay you', 'Retail pricing'];
const stageDescriptions = [
  'A familiar name. The right currency. Local business dates.',
  'Cash is ready. Add the payment methods your customers use.',
  'One product is enough to begin. Your inventory can grow later.',
];
const paymentOptions = ['Cash', 'KPay', 'Wave Pay', 'Bank transfer'];
const paymentIcons = { Cash: Banknote, KPay: Smartphone, 'Wave Pay': Smartphone, 'Bank transfer': Landmark };
const historyKey = 'businessSetupNavigation';
const newProduct = () => ({ name: '', base_unit: 'Piece', purchase_unit: '', purchase_conversion_factor: 1, price: '', cost: '', stock: 0 });

function SetupField({ label, error, hint, children }) {
  const id = React.useId();
  return <div className="setup-field"><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? `${id}-hint` : undefined })}{(error || hint) && <small id={`${id}-hint`} className={error ? 'setup-field-error' : ''} role={error ? 'alert' : undefined}>{error || hint}</small>}</div>;
}

/** The workspace stays mounted while this separate setup page is open. */
export function BusinessSetup({ session, onNavigate, children }) {
  const owner = session.user.role === 'owner';
  const scope = `${session.business.id}:${session.user.id}`;
  const deferKey = `business-setup-deferred:${scope}`;
  const [model, setModel] = useState(null), [open, setOpen] = useState(false), [step, setStep] = useState(1);
  const [basics, setBasics] = useState({ name: '', address: '', phone: '', currency: 'Ks', timezone: 'Asia/Yangon' });
  const [payments, setPayments] = useState(['Cash']), [otherPayments, setOtherPayments] = useState('');
  const [product, setProduct] = useState(newProduct);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({});
  const [reminderHidden, setReminderHidden] = useState(false);
  const title = useRef(null), content = useRef(null), locked = useRef(false);
  const initial = useRef(true), logoInput = useRef(null);
  const [logoError, setLogoError] = useState('');
  const [transitioning, setTransitioning] = useState(false), [direction, setDirection] = useState('initial');
  const currentStep = useRef(1), transition = useRef({ revision: 0, animation: null, pending: false });

  const transitionTo = useCallback(async next => {
    const motion = transition.current;
    const revision = ++motion.revision;
    motion.animation?.cancel();
    motion.animation = null;
    motion.pending = false;
    if (next === currentStep.current) { setTransitioning(false); return; }
    const backwards = next < currentStep.current;
    const slide = content.current?.querySelector('.setup-slide');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (slide?.animate && !reducedMotion) {
      motion.pending = true;
      setTransitioning(true);
      const animation = slide.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${backwards ? 14 : -14}px)` },
      ], { duration: 110, easing: 'ease-in', fill: 'forwards' });
      motion.animation = animation;
      await animation.finished.catch(() => {});
      if (revision !== motion.revision) return;
    }
    currentStep.current = next;
    setDirection(slide ? backwards ? 'backward' : 'forward' : 'initial');
    setStep(next);
    setTransitioning(false);
    motion.pending = false;
    // The outgoing keyed form is removed at commit; never keep a duplicate form.
    motion.animation = null;
  }, []);

  useEffect(() => {
    if (open) return undefined;
    const motion = transition.current;
    ++motion.revision;
    motion.animation?.cancel();
    motion.animation = null;
    motion.pending = false;
    setTransitioning(false);
    return undefined;
  }, [open]);

  useEffect(() => () => {
    ++transition.current.revision;
    transition.current.animation?.cancel();
  }, []);

  const locate = useCallback((next, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('setup', '1'); url.searchParams.set('setupStep', String(next));
    const previous = window.history.state?.[historyKey];
    const index = replace && previous?.scope === scope ? previous.index : previous?.scope === scope ? previous.index + 1 : 0;
    window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, [historyKey]: { scope, index, step: next } }, '', url.href);
    void transitionTo(next); setOpen(true); setError(''); setErrors({});
  }, [scope, transitionTo]);

  useEffect(() => {
    if (!owner) return undefined;
    let cancelled = false;
    request('/business-setup').then(data => {
      if (cancelled || !initial.current) return;
      setModel(data); setBasics({ address: '', phone: '', ...data.basics });
      const methods = data.payment_methods || ['Cash'];
      setPayments([...new Set(['Cash', ...methods.filter(value => paymentOptions.includes(value))])]);
      setOtherPayments(methods.filter(value => !paymentOptions.includes(value)).join(', '));
      const direct = new URLSearchParams(window.location.search).has('setup');
      let deferred = false;
      try { deferred = window.sessionStorage.getItem(deferKey) === '1'; } catch { /* Storage is optional. */ }
      if (data.progress?.status === 'pending' && (direct || (!deferred && initial.current))) {
        const requested = Number(new URLSearchParams(window.location.search).get('setupStep'));
        const saved = data.progress?.step || 1;
        locate(direct && requested >= 1 && requested <= saved ? requested : saved, direct);
      }
      initial.current = false;
    }).catch(() => { /* Existing workspaces remain usable if setup is unavailable. */ });
    return () => { cancelled = true; };
  }, [owner, deferKey, locate]);

  useEffect(() => {
    if (!owner) return undefined;
    const restore = () => {
      const url = new URL(window.location.href), active = url.searchParams.has('setup');
      setOpen(active);
      if (active) void transitionTo(Math.min(4, Math.max(1, Number(url.searchParams.get('setupStep')) || 1)));
      setError(''); setErrors({});
    };
    const start = async () => {
      if (locked.current) return;
      locked.current = true;
      initial.current = false;
      setBusy(true); setError('');
      try {
        const data = await request('/business-setup');
        setModel(data); setBasics({ address: '', phone: '', ...data.basics });
        if (data.progress?.status !== 'pending') return;
        setPayments([...new Set(['Cash', ...data.payment_methods.filter(value => paymentOptions.includes(value))])]);
        setOtherPayments(data.payment_methods.filter(value => !paymentOptions.includes(value)).join(', '));
        try { window.sessionStorage.removeItem(deferKey); } catch { /* Optional. */ }
        locate(data.progress.step); setReminderHidden(false);
      } catch (e) { setOpen(true); setError(e.message); }
      finally { locked.current = false; setBusy(false); }
    };
    window.addEventListener('popstate', restore);
    window.addEventListener('mkpos:business-setup', start);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('mkpos:business-setup', start); };
  }, [owner, deferKey, locate, transitionTo]);

  useEffect(() => {
    if (!open) return;
    title.current?.focus({ preventScroll: true });
    if (content.current) content.current.closest('main').scrollTop = 0;
  }, [open, step]);

  function leave(destination) {
    if (locked.current) return;
    try { window.sessionStorage.setItem(deferKey, '1'); } catch { /* Optional. */ }
    setOpen(false);
    const state = window.history.state?.[historyKey];
    if (state?.scope === scope && window.history.length > state.index + 1) {
      if (destination) window.addEventListener('popstate', () => onNavigate(destination), { once: true });
      window.history.go(-(state.index + 1));
    } else {
      const url = new URL(window.location.href); url.searchParams.delete('setup'); url.searchParams.delete('setupStep');
      const next = { ...window.history.state }; delete next[historyKey];
      window.history.replaceState(next, '', url.href);
      if (destination) onNavigate(destination);
    }
  }

  async function updateLogo(selected) {
    if (locked.current) return;
    setLogoError('');
    if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 512 * 1024)) {
      setLogoError('Choose a JPG, PNG or WebP image up to 512 KB.');
      return;
    }
    locked.current = true; setBusy(true);
    try {
      const body = selected ? new FormData() : undefined;
      if (selected) body.append('logo', selected);
      const saved = await request('/settings/logo', { method: selected ? 'POST' : 'DELETE', ...(body ? { body } : {}), timeoutMs: 30000 });
      setModel(current => ({ ...current, receipt_logo_data_url: saved.receipt_logo_data_url || '' }));
      emitDataChange(['settings'], 'business-setup');
    } catch (e) {
      setLogoError(e.payload?.errors?.logo?.[0] || e.message || 'Unable to update logo. Try again.');
    } finally { locked.current = false; setBusy(false); }
  }

  async function save(action) {
    if (locked.current || transition.current.pending) return;
    locked.current = true; setBusy(true); setError(''); setErrors({});
    try {
      let data;
      if (action === 'product') {
        data = await request('/business-setup/product', { method: 'POST', body: JSON.stringify({
          name: product.name, base_unit: baseUnitName(product), purchase_unit: product.purchase_unit || null,
          purchase_conversion_factor: Number(product.purchase_conversion_factor || 1), price: Number(product.price),
          cost: Number(product.cost || 0), stock: Number(product.stock || 0),
          prices: [{ name: 'Retail', price: Number(product.price), is_manual: true }],
        }) });
        setModel(data); emitDataChange(['products', 'categories', 'reports'], 'business-setup');
        // Product creation and completion are independently retryable. The API keeps its product ID.
        data = await request('/business-setup', { method: 'PUT', body: JSON.stringify({ action: 'finish', product_choice: 'add' }) });
      } else {
        data = await request('/business-setup', { method: 'PUT', body: JSON.stringify({ action,
          ...(action === 'basics' ? basics : {}),
          ...(action === 'payments' ? { payment_methods: [...new Set([...payments, ...otherPayments.split(',').map(value => value.trim()).filter(Boolean)])] } : {}),
          ...(action === 'finish' ? { product_choice: allowedProducts ? 'add' : 'later' } : {}),
        }) });
      }
      setModel(data);
      if (action === 'basics') {
        window.dispatchEvent(new CustomEvent('mkpos:session-updated', { detail: { ...session, business: { ...session.business, ...data.business } } }));
        emitDataChange(['settings'], 'business-setup');
      }
      if (action === 'payments') emitDataChange(['settings'], 'business-setup');
      locate(action === 'basics' ? 2 : action === 'payments' ? 3 : 4);
    } catch (e) {
      setError(e.message || 'Unable to save setup. Try again.');
      setErrors(Object.fromEntries(Object.entries(e.payload?.errors || {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
    } finally { locked.current = false; setBusy(false); }
  }

  if (!owner) return children;
  const pending = model?.progress?.status === 'pending';
  const allowedProducts = model?.can_products;
  const finishAction = step === 1 ? 'basics' : step === 2 ? 'payments' : allowedProducts && !model?.progress?.product_id ? 'product' : 'finish';
  return <>
    <div hidden={open} inert={open ? '' : undefined}>{children}</div>
    {!open && pending && !reminderHidden && <aside className="setup-reminder" aria-label="Business setup checklist"><button type="button" className="setup-dismiss" aria-label="Hide setup reminder" onClick={() => setReminderHidden(true)}><X size={16} /></button><strong>Finish business setup</strong><small>{model.progress.step === 1 ? 'Confirm your business details.' : model.progress.step === 2 ? 'Choose how customers pay you.' : 'Add a product'}</small><button type="button" onClick={() => locate(model.progress.step)}>Resume setup <ArrowRight size={14} /></button></aside>}
    {open && <main className="business-setup-page" aria-label="Business setup">
      <div className="setup-frame">
      <div className="setup-frame-header"><div className="setup-brand"><span><Store size={20} aria-hidden="true" /></span><strong data-no-localize>PwarMyar</strong><span className="setup-brand-divider" /><small>Business setup</small></div><div className="setup-header-actions"><AuthLocaleToggle /><button className="setup-exit" type="button" disabled={busy || transitioning} onClick={() => leave()}>{step === 4 ? 'Back to workspace' : 'Finish later'}<X size={16} /></button></div></div>
      <div className="setup-layout">
        <nav className="setup-navigation" aria-label="Setup progress">
          <div className="setup-welcome"><span className="setup-eyebrow">YOUR BUSINESS, READY TO GO</span><h1><span>A few essentials.</span><span>Then your first sale.</span></h1><p>Set up the basics now. You can fine-tune everything else as you go.</p></div>
          <ol className="setup-steps">{stages.map((stage, index) => <li key={stage} className={step > index + 1 ? 'is-complete' : step === index + 1 ? 'is-current' : ''}><button type="button" disabled={busy || transitioning || index + 1 > Math.min(model?.progress?.step || 1, 3)} aria-current={step === index + 1 ? 'step' : undefined} onClick={() => locate(index + 1)}><span className="setup-step-number">{step > index + 1 ? <Check size={15} /> : index + 1}</span><span className="setup-step-copy"><strong>{stage}</strong><small>{stageDetails[index]}</small></span></button></li>)}</ol>
          <div className="setup-progress-note"><ShieldCheck size={17} aria-hidden="true" /><span>Your completed slides are saved.</span></div>
        </nav>
        <section className="setup-content" ref={content} data-transitioning={transitioning || undefined}>
          {error && <div className="setup-error" role="alert">{error}</div>}
          {!model?.progress ? <div className="setup-slide"><h2 ref={title} tabIndex={-1}>Business setup</h2><p>We could not load your saved setup.</p><button type="button" disabled={busy || transitioning} onClick={() => window.dispatchEvent(new Event('mkpos:business-setup'))}>Try again</button></div> : <form key={step} className="setup-slide" data-direction={direction} onSubmit={event => { event.preventDefault(); if (step < 4) void save(finishAction); }}>
            {step < 4 && <header className="setup-slide-heading"><div className="setup-stage-caption"><span className="setup-heading-icon">{step === 1 ? <Store size={20} /> : step === 2 ? <Banknote size={20} /> : <Boxes size={20} />}</span><span className="setup-stage-dots" aria-hidden="true">{stages.map((stage, index) => <i key={stage} className={step >= index + 1 ? 'is-filled' : ''} />)}</span></div><h2 ref={title} tabIndex={-1}>{stages[step - 1]}</h2><p>{stageDescriptions[step - 1]}</p></header>}
            <fieldset disabled={busy || transitioning} className="setup-fields">
              {step === 1 && <div className="setup-identity">
                <div className="setup-identity-fields"><SetupField label="Business name" error={errors.name}><input required maxLength={255} value={basics.name} onChange={event => setBasics({ ...basics, name: event.target.value })} /></SetupField><SetupField label="Business phone (optional)" error={errors.phone}><input type="tel" autoComplete="tel" maxLength={50} value={basics.phone} onChange={event => setBasics({ ...basics, phone: event.target.value })} /></SetupField><SetupField label="Business address (optional)" error={errors.address}><textarea rows={2} autoComplete="street-address" maxLength={1000} value={basics.address} onChange={event => setBasics({ ...basics, address: event.target.value })} /></SetupField><div className="setup-two-columns setup-preferences"><SetupField label="Currency" error={errors.currency} hint={model.currency_locked ? 'Currency is fixed because transactions already exist.' : undefined}><input required maxLength={20} list="setup-currencies" readOnly={model.currency_locked} value={basics.currency} onChange={event => setBasics({ ...basics, currency: event.target.value })} /></SetupField><datalist id="setup-currencies">{['Ks', 'MMK', 'USD', 'THB', 'SGD'].map(value => <option key={value} value={value} />)}</datalist><SetupField label="Time zone" error={errors.timezone}><select value={basics.timezone} onChange={event => setBasics({ ...basics, timezone: event.target.value })}>{(model.timezones || [basics.timezone]).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></SetupField></div></div>
                <div className="setup-logo">
                  <input ref={logoInput} hidden type="file" aria-label="Business logo file" accept="image/png,image/jpeg,image/webp" onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (selected) void updateLogo(selected); }} />
                  <button className="setup-logo-upload" type="button" disabled={busy || transitioning} aria-label={model.receipt_logo_data_url ? 'Replace logo' : 'Upload logo'} title="JPG, PNG or WebP. Up to 512 KB and 2400 px." onClick={() => logoInput.current?.click()}>
                    {model.receipt_logo_data_url ? <img src={model.receipt_logo_data_url} alt="Current business logo" /> : <Upload size={22} aria-hidden="true" />}
                    <span>{busy ? 'Saving...' : model.receipt_logo_data_url ? 'Replace logo' : 'Upload logo'}</span>
                  </button>
                  <small>Business logo (optional)</small>
                  {model.receipt_logo_data_url && <button className="setup-logo-remove" type="button" disabled={busy || transitioning} aria-label="Remove logo" title="Remove logo" onClick={() => void updateLogo(null)}><X size={13} /></button>}
                  {logoError && <small className="setup-logo-error" role="alert">{logoError}</small>}
                </div>
              </div>}
              {step === 2 && <><div className="setup-payment-options">{paymentOptions.map(name => { const PaymentIcon = paymentIcons[name]; return <label key={name} className={payments.includes(name) ? 'is-selected' : ''}><input type="checkbox" checked={payments.includes(name)} disabled={name === 'Cash'} onChange={event => setPayments(current => event.target.checked ? [...current, name] : current.filter(value => value !== name))} /><PaymentIcon size={16} aria-hidden="true" /><strong>{name}</strong></label>; })}</div><SetupField label="Other payment methods (optional)" error={errors.payment_methods} hint="Separate names with commas."><input value={otherPayments} onChange={event => setOtherPayments(event.target.value)} maxLength={300} /></SetupField></>}
              {step === 3 && <>
                {!allowedProducts && <p>Product management is not enabled for this business. You can finish setup now.</p>}
                {allowedProducts && (model.progress?.product_id ? <p className="setup-help setup-product-saved" role="status"><CheckCircle2 size={17} />Your first product is saved</p> : <><div className="setup-two-columns"><SetupField label="Product name" error={errors.name}><input required maxLength={255} value={product.name} onChange={event => setProduct({ ...product, name: event.target.value })} placeholder="e.g. Drinking water" /></SetupField><SetupField label={`Selling price per ${baseUnitName(product)} (${basics.currency})`} error={errors.price}><input required type="number" min="0" step="1" value={product.price} onChange={event => setProduct({ ...product, price: event.target.value })} /></SetupField></div><div className="setup-product-fields"><section className="setup-product-group"><h3><Boxes size={16} aria-hidden="true" />Units</h3><ProductUnitSetup compact form={product} setForm={setProduct} errors={errors} /></section><section className="setup-product-group"><h3><Coins size={16} aria-hidden="true" />Stock &amp; cost</h3><ProductStockCostFields compact form={product} setForm={setProduct} errors={errors} currency={basics.currency} /></section></div><p className="setup-help">Cost is optional; it is used for profit reports.</p></>)}
              </>}
              {step === 4 && <div className="setup-complete"><div className="setup-complete-icon"><Check size={34} /></div><span className="setup-complete-caption"><Sparkles size={14} aria-hidden="true" />Business setup</span><h2 ref={title} tabIndex={-1}>Your business is ready</h2><dl><div><dt>Business</dt><dd data-no-localize>{model.business.name}</dd></div><div><dt>Currency</dt><dd data-no-localize>{model.business.currency}</dd></div><div><dt>Payments</dt><dd data-no-localize>{model.payment_methods.join(', ')}</dd></div><div><dt>Products</dt><dd>{model.product_count}</dd></div></dl><button className="primary" type="button" onClick={() => leave(model.product_count > 0 && model.can_sell ? 'sell' : allowedProducts ? 'products' : undefined)}>{model.product_count > 0 && model.can_sell ? 'Start selling' : allowedProducts ? 'Add products' : 'Open workspace'}<ArrowRight size={17} /></button>{model.product_count > 0 && allowedProducts && <button type="button" onClick={() => leave('products')}>Add more products</button>}</div>}
            </fieldset>
            {step < 4 && <footer className="setup-actions">{step > 1 && <button type="button" disabled={busy || transitioning} onClick={() => locate(step - 1)}><ArrowLeft size={16} />Back</button>}<button type="submit" className="primary" disabled={busy || transitioning}>{busy ? 'Saving…' : step === 3 ? allowedProducts && !model.progress?.product_id ? 'Save product & finish' : 'Finish setup' : 'Save & continue'}{!busy && <ArrowRight size={16} />}</button></footer>}
          </form>}
        </section>
      </div>
      </div>
    </main>}
  </>;
}
