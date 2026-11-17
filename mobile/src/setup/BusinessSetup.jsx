import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Boxes, Check, CheckCircle2, Landmark, Smartphone, Upload, X } from 'lucide-react';
import { apiRequest as defaultRequest } from '../api/client';
import { Button, Field, IconButton, Input, Select, Textarea } from '../components/Controls';
import { PageAppBar } from '../navigation/PageAppBar';
import { usePageRefresh } from '../navigation/pageRefresh';
import { historyIndex } from '../navigation/historyNavigation';
import { publishResourceChanges } from '../navigation/dataChanges';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { LanguageToggle } from '../localization/LanguageToggle';
import { useLocale } from '../localization/LocaleContext';
import { BrandImage } from '../platformBranding';
import { BRAND_LOGO } from '../assets';
import { ProductUnitSetup, ProductStockCostFields } from '../products/ProductUnitFields';
import { baseUnitName } from '../products/productUtils';
import { SETUP_MESSAGES, SETUP_PATTERNS } from './setupLocale';

const paths = ['/setup/business', '/setup/payments', '/setup/product', '/setup/complete'];
const titles = ['Business basics', 'Payments', 'Add a product'];
const methods = [['Cash', Banknote], ['KPay', Smartphone], ['Wave Pay', Smartphone], ['Bank transfer', Landmark]];
const blankBasics = { name: '', phone: '', address: '', currency: 'Ks', timezone: 'Asia/Yangon' };
const newProduct = () => ({ name: '', base_unit: 'Piece', purchase_unit: '', purchase_conversion_factor: 1, price: '', cost: '', stock: 0 });

export function BusinessSetup({ session, pathname, onNavigate, onBack, fallbackPath = '/sell', offlineMode = false, brandName = 'PwarMyar', apiRequest = defaultRequest }) {
  const { language, setLanguage } = useLocale();
  const eligible = session?.user?.role === 'owner' && !offlineMode;
  const scope = `${session?.business?.id}:${session?.user?.id}`;
  const deferKey = `mkpos-mobile-setup-deferred:${scope}`;
  const visible = pathname === '/setup' || pathname.startsWith('/setup/');
  const step = Math.max(1, paths.indexOf(pathname) + 1);
  const [model, setModel] = useState(null), [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState('');
  const [basics, setBasics] = useState(blankBasics), [payments, setPayments] = useState(['Cash']), [otherPayments, setOtherPayments] = useState('');
  const [product, setProduct] = useState(newProduct), [busy, setBusy] = useState(false), [moving, setMoving] = useState(false);
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [logoError, setLogoError] = useState(''), [reminderHidden, setReminderHidden] = useState(false);
  const initialized = useRef(false), autoChecked = useRef(false), locked = useRef(false), alive = useRef(true);
  const completedHere = useRef(false);
  const body = useRef(null), title = useRef(null), logoInput = useRef(null), previousStep = useRef(step);
  const animation = useRef(null), revision = useRef(0), origin = useRef(null);
  const hasProgress = Boolean(model?.progress);
  const latest = useRef({ pathname, onNavigate, onBack });
  latest.current = { pathname, onNavigate, onBack };

  const stopMotion = useCallback(() => { ++revision.current; animation.current?.cancel(); }, []);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stopMotion(); };
  }, [stopMotion]);

  const accept = useCallback(data => {
    setModel(data);
    if (initialized.current) return;
    initialized.current = true;
    setBasics({ ...blankBasics, ...data.basics });
    const saved = data.payment_methods || ['Cash'];
    setPayments([...new Set(['Cash', ...saved.filter(name => methods.some(([value]) => value === name))])]);
    setOtherPayments(saved.filter(name => !methods.some(([value]) => value === name)).join(', '));
  }, []);

  useEffect(() => {
    if (!eligible) return undefined;
    const controller = new AbortController();
    setLoaded(false);
    apiRequest('/business-setup', { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { accept(data); setLoadError(''); setLoaded(true); }
    }).catch(e => { if (!controller.signal.aborted) { setLoadError(e.message); setLoaded(true); } });
    return () => controller.abort();
  }, [eligible, scope, apiRequest, accept]);

  const refresh = useCallback(async () => {
    if (locked.current) return;
    try {
      const data = await apiRequest('/business-setup');
      if (alive.current) { accept(data); setLoaded(true); setLoadError(''); }
    } catch (e) { if (alive.current) { setLoadError(e.message); setLoaded(true); } }
  }, [apiRequest, accept]);
  usePageRefresh(eligible && visible ? refresh : null, { dataPath: '/setup/new' });

  useEffect(() => {
    if (!eligible || !loaded || loadError) return;
    const saved = Math.min(4, Math.max(1, model?.progress?.step || 1));
    if (visible) {
      autoChecked.current = true;
      if (!model?.progress || (model.progress.status === 'complete' && !completedHere.current)) {
        latest.current.onNavigate(fallbackPath, { replace: true });
      } else if (!paths.includes(pathname) || step > saved) latest.current.onNavigate(paths[saved - 1], { replace: true });
    } else if (!autoChecked.current) {
      autoChecked.current = true;
      let deferred = false;
      try { deferred = sessionStorage.getItem(deferKey) === '1'; } catch { /* Storage is optional. */ }
      if (model?.progress?.status === 'pending' && !deferred) {
        origin.current = { path: pathname, index: historyIndex() };
        latest.current.onNavigate(paths[saved - 1]);
      }
    }
  }, [eligible, loaded, loadError, model, visible, step, pathname, fallbackPath, deferKey]);

  useLayoutEffect(() => {
    ++revision.current;
    animation.current?.cancel(); animation.current = null;
    setMoving(false);
    setError(''); setErrors({});
    if (!visible || !loaded || !hasProgress || !body.current) return undefined;
    const backwards = step < previousStep.current;
    previousStep.current = step;
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      animation.current = body.current.animate?.([
        { opacity: 0, transform: `translateX(${backwards ? -18 : 18}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 220, easing: 'ease-out' }) || null;
    }
    title.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0 });
    return undefined;
  }, [visible, step, loaded, hasProgress]);

  async function go(next, backwards = false) {
    const current = ++revision.current;
    animation.current?.cancel();
    if (body.current?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setMoving(true);
      const outgoing = body.current.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${backwards ? 14 : -14}px)` }], { duration: 110, fill: 'forwards', easing: 'ease-in' });
      animation.current = outgoing;
      await outgoing.finished.catch(() => {});
      if (!alive.current || current !== revision.current) return;
    }
    setMoving(false);
    if (backwards) latest.current.onBack(next);
    else latest.current.onNavigate(next);
  }

  function leave(destination) {
    if (locked.current || moving) return;
    try { sessionStorage.setItem(deferKey, '1'); } catch { /* Optional. */ }
    const source = origin.current;
    if (!destination && source && historyIndex() > source.index) window.history.go(source.index - historyIndex());
    else latest.current.onNavigate(destination || source?.path || fallbackPath, { replace: true });
  }

  async function save() {
    if (locked.current || moving) return;
    locked.current = true; setBusy(true); setError(''); setErrors({});
    const sourcePath = pathname;
    try {
      let data;
      if (step === 3 && model.can_products && !model.progress.product_id) {
        data = await apiRequest('/business-setup/product', { method: 'POST', body: JSON.stringify({
          name: product.name, base_unit: baseUnitName(product), purchase_unit: product.purchase_unit || null,
          purchase_conversion_factor: Number(product.purchase_conversion_factor || 1), price: Number(product.price),
          cost: Number(product.cost || 0), stock: Number(product.stock || 0),
          prices: [{ name: 'Retail', price: Number(product.price), is_manual: true }],
        }) });
        if (!alive.current) return;
        setModel(data); publishResourceChanges(['products', 'categories', 'reports']);
        data = await apiRequest('/business-setup', { method: 'PUT', body: JSON.stringify({ action: 'finish', product_choice: 'add' }) });
      } else {
        data = await apiRequest('/business-setup', { method: 'PUT', body: JSON.stringify(step === 1 ? { action: 'basics', ...basics } : step === 2 ? {
          action: 'payments', payment_methods: [...new Set([...payments, ...otherPayments.split(',').map(name => name.trim()).filter(Boolean)])],
        } : { action: 'finish', product_choice: model.can_products ? 'add' : 'later' }) });
      }
      if (!alive.current) return;
      if (data.progress?.status === 'complete') completedHere.current = true;
      setModel(data);
      if (step === 1) window.dispatchEvent(new CustomEvent('mkpos:session-updated', { detail: { ...session, business: { ...session.business, ...data.business } } }));
      if (step < 3) publishResourceChanges(['settings']);
      if (latest.current.pathname === sourcePath) await go(paths[step]);
    } catch (e) {
      if (alive.current) {
        setError(e.message || 'Unable to save setup. Try again.');
        setErrors(Object.fromEntries(Object.entries(e.payload?.errors || {}).map(([key, value]) => [key.startsWith('payment_methods.') ? 'payment_methods' : key, Array.isArray(value) ? value[0] : value])));
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  async function updateLogo(file) {
    if (locked.current) return;
    setLogoError('');
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 512 * 1024)) {
      setLogoError('Choose a JPG, PNG or WebP image up to 512 KB.'); return;
    }
    locked.current = true; setBusy(true);
    try {
      const upload = file ? new FormData() : null;
      if (file) upload.append('logo', file);
      const data = await apiRequest('/settings/logo', { method: file ? 'POST' : 'DELETE', ...(upload ? { body: upload } : {}), timeoutMs: 30000 });
      if (!alive.current) return;
      setModel(current => ({ ...current, receipt_logo_data_url: data.receipt_logo_data_url || '' }));
      window.dispatchEvent(new CustomEvent('mkpos:shop-logo-updated', { detail: data.receipt_logo_data_url || '' }));
      publishResourceChanges(['settings']);
    } catch (e) { if (alive.current) setLogoError(e.payload?.errors?.logo?.[0] || e.message); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  if (!eligible) return null;
  if (!visible) return model?.progress?.status === 'pending' && !reminderHidden ? <ModuleLocalizationBoundary messages={SETUP_MESSAGES} patterns={SETUP_PATTERNS}>
    <aside className="mobile-setup-reminder" aria-label="Business setup checklist"><div><strong>Finish business setup</strong><small>Your completed slides are saved.</small></div><Button onClick={() => {
      origin.current = { path: pathname, index: historyIndex() };
      latest.current.onNavigate(paths[Math.min(3, model.progress.step || 1) - 1]);
    }}>Resume setup<ArrowRight size={16} /></Button><IconButton variant="ghost" aria-label="Hide setup reminder" onClick={() => setReminderHidden(true)}><X size={18} /></IconButton></aside>
  </ModuleLocalizationBoundary> : null;
  const ready = loaded && !loadError && model?.progress && step <= model.progress.step && (model.progress.status !== 'complete' || completedHere.current);
  const disabled = busy || moving;
  return <ModuleLocalizationBoundary messages={SETUP_MESSAGES} patterns={SETUP_PATTERNS}>
    <main className="mobile-business-setup" aria-label="Business setup">
      <PageAppBar className="mobile-setup-appbar">{ready && step > 1 && step < 4 && <IconButton variant="ghost" disabled={disabled} aria-label="Previous setup step" onClick={() => void go(paths[step - 2], true)}><ArrowLeft size={21} /></IconButton>}<span className="brand-logo"><BrandImage asset="icon" src={BRAND_LOGO} alt="" /></span><strong data-no-localize>{brandName}</strong><span className="mobile-setup-language" data-no-localize><LanguageToggle language={language} onChange={setLanguage} /></span></PageAppBar>
      <div className="mobile-setup-topline"><span>Business setup</span><Button variant="ghost" disabled={disabled} onClick={() => leave()}>{step === 4 ? 'Back to workspace' : 'Finish later'}<X size={16} /></Button></div>
      {ready && <nav className="mobile-setup-progress" aria-label="Setup progress"><ol>{titles.map((name, index) => <li key={name} className={step > index + 1 ? 'is-complete' : step === index + 1 ? 'is-current' : ''}><Button variant="plain" disabled={disabled || index + 1 > Math.min(3, model.progress.step)} aria-current={step === index + 1 ? 'step' : undefined} onClick={() => { if (index + 1 !== step) void go(paths[index]); }}><span>{step > index + 1 ? <Check size={16} /> : index + 1}</span><small>{name}</small></Button></li>)}</ol></nav>}
      {!ready ? <section className="mobile-setup-card" role={loadError ? 'alert' : 'status'}><h1>{loaded ? 'We could not load your saved setup.' : 'Loading setup…'}</h1>{loadError && <><p>{loadError}</p><Button onClick={refresh}>Try again</Button></>}</section> : <section key={step} ref={body} className="mobile-setup-body">
        {step < 4 && <header className="mobile-setup-heading"><h1 ref={title} tabIndex={-1}>{titles[step - 1]}</h1><p>{step === 1 ? 'Your business details and contact information.' : step === 2 ? 'Cash is ready. Add the payment methods your customers use.' : 'One product is enough to begin. Your inventory can grow later.'}</p></header>}
        {error && <p className="mobile-error" role="alert">{error}</p>}
        <form onSubmit={event => { event.preventDefault(); if (step < 4) void save(); }}>
          <fieldset disabled={disabled} className="mobile-setup-fields">
            {step === 1 && <>
              <section className="mobile-setup-card"><Field label="Business name" error={errors.name}><Input required maxLength={255} autoComplete="organization" value={basics.name} onChange={e => setBasics({ ...basics, name: e.target.value })} /></Field><Field label="Business phone (optional)" error={errors.phone}><Input type="tel" maxLength={50} autoComplete="tel" value={basics.phone} onChange={e => setBasics({ ...basics, phone: e.target.value })} /></Field><Field label="Business address (optional)" error={errors.address}><Textarea rows={2} maxLength={1000} autoComplete="street-address" value={basics.address} onChange={e => setBasics({ ...basics, address: e.target.value })} /></Field></section>
              <section className="mobile-setup-card"><Field label="Currency" error={errors.currency} hint={model.currency_locked ? 'Currency is fixed because transactions already exist.' : undefined}><Input required maxLength={20} readOnly={model.currency_locked} value={basics.currency} onChange={e => setBasics({ ...basics, currency: e.target.value })} /></Field><Field label="Time zone" error={errors.timezone}><Select value={basics.timezone} onChange={e => setBasics({ ...basics, timezone: e.target.value })}>{(model.timezones || [basics.timezone]).map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}</Select></Field></section>
              <section className="mobile-setup-card mobile-setup-logo"><div>{model.receipt_logo_data_url ? <img src={model.receipt_logo_data_url} alt="Current business logo" /> : <Upload size={24} aria-hidden="true" />}<small>Business logo (optional)</small></div><Input ref={logoInput} type="file" hidden aria-label="Business logo file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void updateLogo(file); }} /><Button title="JPG, PNG or WebP. Up to 512 KB and 2400 px." onClick={() => logoInput.current?.click()}>{model.receipt_logo_data_url ? 'Replace logo' : 'Upload logo'}</Button>{model.receipt_logo_data_url && <IconButton aria-label="Remove logo" onClick={() => void updateLogo(null)}><X size={18} /></IconButton>}{logoError && <p role="alert" className="mobile-error">{logoError}</p>}</section>
            </>}
            {step === 2 && <section className="mobile-setup-card"><div className="mobile-setup-payment-options">{methods.map(([name, Icon]) => <label key={name} className={payments.includes(name) ? 'is-selected' : ''}><Icon size={20} aria-hidden="true" /><strong>{name}</strong><Input type="checkbox" checked={payments.includes(name)} disabled={name === 'Cash'} onChange={e => setPayments(current => e.target.checked ? [...current, name] : current.filter(value => value !== name))} /></label>)}</div><Field label="Other payment methods (optional)" hint="Separate names with commas." error={errors.payment_methods}><Input maxLength={300} value={otherPayments} onChange={e => setOtherPayments(e.target.value)} /></Field></section>}
            {step === 3 && (!model.can_products ? <p>Product management is not enabled for this business. You can finish setup now.</p> : model.progress.product_id ? <p className="mobile-setup-product-saved" role="status"><CheckCircle2 size={22} />Your first product is saved</p> : <>
              <section className="mobile-setup-card"><Field label="Product name" error={errors.name}><Input required maxLength={255} placeholder="e.g. Drinking water" value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} /></Field><Field label={`Selling price per ${baseUnitName(product)} (${basics.currency})`} error={errors.price}><Input required type="number" inputMode="decimal" min="0" step="1" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} /></Field></section>
              <section className="mobile-setup-card"><h2><Boxes size={18} />Units</h2><ProductUnitSetup form={product} setForm={setProduct} errors={errors} /></section><section className="mobile-setup-card"><h2><Banknote size={18} />Stock &amp; cost</h2><ProductStockCostFields form={product} setForm={setProduct} errors={errors} currency={basics.currency} /><p className="mobile-setup-help">Cost is optional; it is used for profit reports.</p></section>
            </>)}
            {step === 4 && <section className="mobile-setup-card mobile-setup-complete"><span className="mobile-setup-complete-icon"><Check size={32} /></span><h1 ref={title} tabIndex={-1}>Your business is ready</h1><dl><div><dt>Business</dt><dd data-no-localize>{model.business.name}</dd></div><div><dt>Currency</dt><dd data-no-localize>{model.business.currency}</dd></div><div><dt>Payments</dt><dd data-no-localize>{model.payment_methods.join(', ')}</dd></div><div><dt>Products</dt><dd>{model.product_count}</dd></div></dl><Button variant="primary" onClick={() => leave(model.product_count > 0 && model.can_sell ? '/sell' : model.can_products ? '/products' : fallbackPath)}>{model.product_count > 0 && model.can_sell ? 'Start selling' : model.can_products ? 'Add products' : 'Open workspace'}<ArrowRight size={18} /></Button>{model.product_count > 0 && model.can_products && <Button onClick={() => leave('/products')}>Add more products</Button>}</section>}
          </fieldset>
          {step < 4 && <footer className="mobile-setup-actions">{step > 1 && <Button disabled={disabled} onClick={() => void go(paths[step - 2], true)}><ArrowLeft size={18} />Back</Button>}<Button variant="primary" type="submit" busy={busy} disabled={moving}>{busy ? 'Saving…' : step < 3 ? 'Save & continue' : model.can_products && !model.progress.product_id ? 'Save product & finish' : 'Finish setup'}<ArrowRight size={18} /></Button></footer>}
        </form>
      </section>}
    </main>
  </ModuleLocalizationBoundary>;
}
