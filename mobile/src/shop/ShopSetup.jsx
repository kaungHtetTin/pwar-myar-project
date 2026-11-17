import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Camera, Check, CheckCircle2, ImagePlus, Plus, Store, X } from 'lucide-react';
import { apiRequest } from '../api/client';
import { Button, Checkbox, Field, IconButton, Input, Switch, Textarea } from '../components/Controls';
import { PageAppBar } from '../navigation/PageAppBar';
import { RetainedViews } from '../navigation/RetainedViews';
import { historyIndex } from '../navigation/historyNavigation';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { LanguageToggle } from '../localization/LanguageToggle';
import { useLocale } from '../localization/LocaleContext';
import { SHOP_MESSAGES } from './shopLocale';
import { SHOP_ADDITIONAL_MESSAGES } from './shopAdditionalLocale';
import { SHOP_SETUP_MESSAGES } from './shopSetupLocale';
import { ShopSetupProducts } from './ShopSetupProducts';
import { ShopLoading } from './ShopPrimitives';
import { SHOP_SETUP_PATHS as paths, SHOP_SETUP_STEPS as steps, SHOP_SETUP_DESCRIPTIONS as descriptions, shopSetupPayload, stepFields, mobileShopSetupStep, nextShopSetupProgress } from './shopSetupModel';

const messages = { ...SHOP_MESSAGES, ...SHOP_ADDITIONAL_MESSAGES, ...SHOP_SETUP_MESSAGES };

export function ShopSetup({ session, pathname, onNavigate, onBack, enabled = true, offlineMode = false }) {
  const { language, setLanguage } = useLocale();
  const eligible = enabled && !offlineMode && session?.user?.role === 'owner' && session?.subscription?.is_valid !== false;
  const visible = /^\/shop\/setup(?:\/|$)/.test(pathname);
  const step = paths.indexOf(pathname) + 1;
  const [location, setLocation] = useState(null), [form, setForm] = useState(null), [saved, setSaved] = useState(null);
  const [ai, setAi] = useState(null), [aiError, setAiError] = useState(''), [aiDraft, setAiDraft] = useState(null);
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [productBusy, setProductBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const alive = useRef(true), checked = useRef(false), initialized = useRef(false), working = useRef(false), origin = useRef(null), completed = useRef(false);
  const locationRevision = useRef(0);
  const latest = useRef({ pathname, onNavigate, onBack }); latest.current = { pathname, onNavigate, onBack };
  const heading = useRef(null);
  const disabled = busy || productBusy;
  const ready = form !== null;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const acceptLocation = useCallback(data => {
    if (!alive.current) return;
    setLocation(data);
    const current = latest.current;
    if (!/^\/shop(?:\/|$)/.test(current.pathname)) { checked.current = false; return; }
    if (data.submitted && data.setup?.status === 'pending') {
      if (/^\/shop\/setup(?:\/|$)/.test(current.pathname) && !paths.slice(0, -1).includes(current.pathname)) current.onNavigate(paths[mobileShopSetupStep(data.setup.step) - 1], { replace: true });
      if (!/^\/shop\/setup(?:\/|$)/.test(current.pathname)) {
        origin.current = { path: current.pathname, index: historyIndex() };
        current.onNavigate(paths[mobileShopSetupStep(data.setup.step) - 1]);
      }
    } else if (/^\/shop\/setup(?:\/|$)/.test(current.pathname) && !completed.current) current.onNavigate(data.submitted ? '/shop' : '/shop/location', { replace: true });
  }, []);

  const checkLocation = useCallback(async () => {
    const revision = ++locationRevision.current;
    try { const data = await apiRequest('/shop-admin/owner-location'); if (revision === locationRevision.current) { acceptLocation(data); if (alive.current) setError(''); } }
    catch (e) { if (alive.current && revision === locationRevision.current) { checked.current = false; setError(e.message); } }
  }, [acceptLocation]);
  useEffect(() => {
    if (!eligible) { if (visible) onNavigate('/shop', { replace: true }); return; }
    if (pathname === '/shop/setup/pickup' || pathname === '/shop/setup/delivery') { onNavigate('/shop/setup/payments', { replace: true }); return; }
    if (pathname.startsWith('/shop') && !checked.current) { checked.current = true; void checkLocation(); }
  }, [eligible, pathname, visible, onNavigate, checkLocation]);
  useEffect(() => {
    if (!eligible) return undefined;
    const submitted = event => {
      if (String(event.detail?.businessId) !== String(session?.business?.id)) return;
      ++locationRevision.current;
      checked.current = true; acceptLocation(event.detail);
    };
    window.addEventListener('mkpos:shop-location-updated', submitted);
    return () => window.removeEventListener('mkpos:shop-location-updated', submitted);
  }, [eligible, session?.business?.id, acceptLocation]);

  const loadAi = useCallback(async () => {
    try { const data = await apiRequest('/shop-admin/sales-ai'); if (alive.current) { setAi(data); setAiDraft(current => current || data.settings); setAiError(''); } }
    catch (e) { if (alive.current) setAiError(e.message); }
  }, []);
  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/shop-admin/settings');
      if (!alive.current) return;
      setSaved(data);
      if (!initialized.current) { initialized.current = true; setForm({ ...data, price_type: 'Retail', storefront_enabled: true, accepting_orders: true, marketplace_enabled: true }); }
      setError('');
    } catch (e) { if (alive.current) setError(e.message); }
  }, []);
  useEffect(() => { if (eligible && visible && location?.submitted && location.setup?.status === 'pending' && !initialized.current) { void load(); void loadAi(); } }, [eligible, visible, location, load, loadAi]);
  usePageRefresh(useCallback(async () => { if (!working.current) { await load(); if (step === 4) await loadAi(); } }, [load, loadAi, step]), { dataPath: '/shop/setup/new' });
  useEffect(() => {
    if (!visible) return;
    heading.current?.focus({ preventScroll: true });
  }, [step, visible, ready]);

  function close() {
    if (disabled || working.current) return;
    const distance = origin.current ? historyIndex() - origin.current.index : 0;
    if (distance > 0) window.history.go(-distance);
    else onNavigate('/shop', { replace: true });
  }
  function go(next) { if (!disabled && !working.current) { setError(''); setErrors({}); onNavigate(paths[next - 1]); } }
  const change = (key, value) => { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); };
  const patchRow = (key, id, field, value) => change(key, form[key].map(row => row.id === id ? { ...row, [field]: value } : row));
  const fieldError = key => Array.isArray(errors[key]) ? errors[key][0] : errors[key];
  function field(key, label, options = {}) {
    const { multiline, ...inputProps } = options;
    const Control = multiline ? Textarea : Input;
    return <Field key={key} label={label} error={fieldError(key)}><Control {...inputProps} value={form[key] || ''} onChange={e => change(key, e.target.value)} /></Field>;
  }
  async function save(event) {
    event.preventDefault();
    if (working.current || disabled || !form || (step === 4 && !aiDraft)) return;
    const source = pathname;
    working.current = true; setBusy(true); setError(''); setErrors({});
    try {
      if (step === 4) {
        const result = await apiRequest('/shop-admin/sales-ai', { method: 'PUT', body: JSON.stringify(aiDraft) });
        if (!alive.current) return;
        setAi(result); setAiDraft(result.settings);
      } else if (step !== 3) {
        const result = await apiRequest('/shop-admin/settings', { method: 'PUT', body: JSON.stringify(shopSetupPayload(saved, form, step)) });
        if (!alive.current) return;
        if (result.currency !== saved.currency || result.price_type !== saved.price_type) setRevision(n => n + 1);
        setSaved(result);
        setForm(current => ({ ...current, ...Object.fromEntries(stepFields(step).map(key => [key, result[key]])), slug_locked: result.slug_locked, price_types: result.price_types }));
      }
      await apiRequest('/shop-admin/setup', { method: 'PUT', body: JSON.stringify(nextShopSetupProgress(step)) });
      if (!alive.current) return;
      if (step === 5) completed.current = true;
      if (latest.current.pathname === source) onNavigate(paths[step]);
    } catch (e) {
      if (alive.current) {
        setError(e.message); const next = e.payload?.errors || e.errors || {}; setErrors(next);
        if (step === 4 && e.status === 409) setAiError('Sales AI changed elsewhere. Reload its latest settings before saving again.');
        const key = Object.keys(next)[0];
        const invalidStep = key?.startsWith('payment_methods') ? 2 : key?.startsWith('delivery_zones') || key?.startsWith('pickup_') ? step : 1;
        if (key && step !== 4 && latest.current.pathname === source && invalidStep !== step) onNavigate(paths[invalidStep - 1]);
      }
    } finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function upload(event, cover) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || working.current || disabled) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > (cover ? 2 * 1024 * 1024 : 512 * 1024)) { setError(cover ? 'Use a JPEG, PNG or WebP image up to 2 MB.' : 'Use a JPEG, PNG or WebP image up to 512 KB.'); return; }
    working.current = true; setBusy(true); setError('');
    try {
      const body = new FormData(); body.append(cover ? 'cover' : 'logo', file);
      const result = await apiRequest(cover ? '/shop-admin/cover' : '/settings/logo', { method: 'POST', body });
      if (alive.current) change(cover ? 'cover_data_url' : 'receipt_logo_data_url', result[cover ? 'cover_data_url' : 'receipt_logo_data_url']);
    } catch (e) { if (alive.current) setError(e.message); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  if (!eligible || (!visible && !initialized.current)) return null;
  const done = step === 6 && completed.current;
  const methods = form?.payment_methods || [];
  return <ModuleLocalizationBoundary messages={messages}>
    <main className="mobile-shop-setup" aria-label="Shop setup" lang={language} hidden={!visible}>
      <PageAppBar className="mobile-shop-setup-appbar"><IconButton variant="ghost" aria-label="Back" disabled={disabled} onClick={() => onBack ? onBack(step > 1 ? paths[step - 2] : '/shop') : step > 1 ? go(step - 1) : close()}><ArrowLeft size={20} /></IconButton><strong>Shop setup</strong><LanguageToggle language={language} onChange={setLanguage} /><IconButton variant="ghost" aria-label="Close setup" title="Close setup" disabled={disabled} onClick={close}><X size={20} /></IconButton></PageAppBar>
      {!done && <nav className="mobile-shop-setup-progress" aria-label="Shop setup steps"><ol>{steps.map((label, index) => <li key={label} className={step === index + 1 ? 'is-current' : index + 1 < step ? 'is-complete' : ''} aria-current={step === index + 1 ? 'step' : undefined}><Button variant="plain" disabled={disabled || !form} aria-label={label} title={label} onClick={() => go(index + 1)}><span>{index + 1 < step ? <Check size={16} /> : index + 1}</span></Button></li>)}</ol></nav>}
      <section className="mobile-shop-setup-card">
        <header><h1 tabIndex={-1} ref={heading}>{done ? 'Your shop setup is saved' : steps[Math.max(0, step - 1)] || 'Shop setup'}</h1><small className="mobile-shop-setup-count">{done ? 'Setup complete' : `${Math.min(steps.length, step || 1)} / ${steps.length}`}</small><p>{done ? 'You can update these settings at any time from Shop.' : descriptions[Math.max(0, step - 1)]}</p></header>
        {error && <div role="alert"><p>{error}</p>{!form && <Button onClick={() => location ? load() : checkLocation()}>Retry</Button>}</div>}
        {!form ? !error && <ShopLoading /> : done ? <><div className="mobile-shop-setup-success"><CheckCircle2 size={44} aria-hidden="true" /><p>Setup complete</p></div>{ai?.settings.enabled && Number(ai.wallet?.available || 0) <= 0 && <p role="status">Sales AI needs available credit to reply to customers.</p>}<div className="mobile-shop-setup-complete"><Button variant="primary" onClick={() => onNavigate('/shop', { replace: true, reset: true })}>Complete</Button></div></> : <>
          <form id="mobile-shop-setup-form" onSubmit={save}><fieldset disabled={disabled} className="mobile-shop-setup-slide" key={step}>
            {step === 1 && <>
              <div className="mobile-shop-setup-branding">{[true, false].map(cover => <Branding key={String(cover)} cover={cover} image={form[cover ? 'cover_data_url' : 'receipt_logo_data_url']} onUpload={event => upload(event, cover)} disabled={disabled} />)}</div>
              <small>Optional images. Uploads save immediately.</small>
              <div className="mobile-shop-setup-grid">{field('display_name', 'Public shop name', { required: true, maxLength: 255 })}{field('slug', 'Shop slug', { required: true, disabled: form.slug_locked, pattern: '[a-z0-9]+(-[a-z0-9]+)*', maxLength: 100 })}{field('phone', 'Phone', { type: 'tel', maxLength: 50 })}{field('address', 'Address', { multiline: true, rows: 3, maxLength: 1000 })}</div>
              <small>{form.slug_locked ? 'Your shop link is locked after receiving orders.' : 'Use lowercase letters, numbers and hyphens.'}</small>
            </>}
            {step === 2 && <>{fieldError('payment_methods') && <p role="alert">{fieldError('payment_methods')}</p>}{methods.map((method, index) => method.type !== 'cash' && <section className="mobile-shop-setup-row" key={method.id}><h2>{method.bank || method.name || 'Payment method'}</h2>{[['bank', 'Bank / wallet', 100], ['account_name', 'Account holder', 255], ['account_no', 'Account number / phone', 100]].map(([key, label, max]) => <Field key={key} label={label} error={fieldError(`payment_methods.${index}.${key}`)}><Input maxLength={max} value={method[key] || ''} onChange={e => patchRow('payment_methods', method.id, key, e.target.value)} /></Field>)}<div className="mobile-shop-setup-method-actions"><label className="mobile-shop-setup-check"><Checkbox checked={method.is_active !== false} onChange={e => patchRow('payment_methods', method.id, 'is_active', e.target.checked)} />Available at checkout</label>{!saved.payment_methods?.some(row => row.id === method.id) && <Button variant="ghost" aria-label="Remove new payment method" onClick={() => change('payment_methods', methods.filter(row => row.id !== method.id))}><X size={16} />Remove</Button>}</div></section>)}<Button disabled={methods.length >= 20} onClick={() => change('payment_methods', [...methods, { id: crypto.randomUUID(), name: '', type: 'transfer', provider: 'manual', is_active: true, instructions: '', bank: '', account_name: '', account_no: '' }])}><Plus size={16} />Add payment method</Button></>}
            {step === 4 && <>{aiError && <div role="alert"><p>{aiError}</p><Button onClick={async () => { setAiDraft(null); await loadAi(); }}>Reload Sales AI</Button></div>}{aiDraft ? <><label className="mobile-shop-setup-feature"><Bot size={24} /><strong>Enable Sales AI</strong><Switch checked={!!aiDraft.enabled} onChange={e => setAiDraft(current => ({ ...current, enabled: e.target.checked }))} aria-label="Enable Sales AI" /></label><Field label="Representative name" error={fieldError('name')}><Input required maxLength={80} value={aiDraft.name || ''} onChange={e => setAiDraft(current => ({ ...current, name: e.target.value }))} /></Field></> : !aiError && <ShopLoading />}</>}
            {step === 5 && <><dl className="mobile-shop-setup-review">{[['Public shop name', saved.display_name], ['Online price type', saved.price_type], ['Payment methods', saved.payment_methods?.filter(method => method.is_active !== false).length || 0], ['Sales AI', ai?.settings.enabled ? 'Enabled' : 'Disabled']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-no-localize={label === 'Public shop name' || label === 'Online price type' ? '' : undefined}>{value}</dd></div>)}</dl>{[['storefront_enabled', 'Enable storefront', 'Make the shop available at its customer link.'], ['accepting_orders', 'Accept new orders', 'Allow customers to place orders.'], ['marketplace_enabled', 'List in marketplace', 'Help customers discover your shop.']].map(([key, label, hint]) => <label className="mobile-shop-setup-feature" key={key}><span><strong>{label}</strong><small>{hint}</small></span><Checkbox checked={!!form[key]} onChange={e => change(key, e.target.checked)} /></label>)}{!!saved.marketplace_suspended && <p role="alert" data-no-localize>{saved.marketplace_suspension_reason}</p>}{ai?.settings.enabled && Number(ai.wallet?.available || 0) <= 0 && <p>Sales AI needs available credit to reply to customers.</p>}</>}
          </fieldset></form>
          <RetainedViews activeKey={step === 3 ? 'products' : 'other'}>{step === 3 ? <ShopSetupProducts disabled={busy} onBusyChange={setProductBusy} revision={revision} /> : null}</RetainedViews>
          <footer className="mobile-shop-setup-actions"><Button disabled={disabled} onClick={close}>Cancel</Button><Button variant="primary" type="submit" form="mobile-shop-setup-form" disabled={disabled || (step === 4 && (!aiDraft || !!aiError))}>{busy ? 'Saving…' : step === 5 ? 'Save shop setup' : step === 3 ? 'Continue' : 'Save & continue'}<ArrowRight size={16} /></Button></footer>
        </>}
      </section>
    </main>
  </ModuleLocalizationBoundary>;
}

function Branding({ cover, image, onUpload, disabled }) {
  const input = useRef(null);
  const label = cover ? 'Cover photo' : 'Shop logo';
  const action = cover ? image ? 'Change cover photo' : 'Upload cover photo' : image ? 'Change logo' : 'Upload logo';
  return <section className={`mobile-shop-setup-image ${cover ? 'is-cover' : 'is-logo'}`}>
    <Button variant="plain" className="mobile-shop-setup-upload" disabled={disabled} aria-label={action} onClick={() => input.current?.click()}>
      <span className="mobile-shop-setup-preview">{image ? <img src={image} alt={label} /> : cover ? <span className="mobile-shop-setup-cover-placeholder"><ImagePlus size={26} aria-hidden="true" /><strong>Cover photo</strong><small>16:9 · up to 2 MB</small></span> : <Store size={30} aria-hidden="true" />}</span>
      {cover && image && <span className="mobile-shop-setup-cover-label">Cover photo</span>}
      <span className="mobile-shop-setup-photo-edit" aria-hidden="true"><Camera size={16} />{cover && <span>{image ? 'Change photo' : 'Add photo'}</span>}</span>
    </Button>
    {!cover && <span className="mobile-shop-setup-image-copy"><strong>Shop logo</strong><small>Square · up to 512 KB</small></span>}
    <Input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={onUpload} aria-label={cover ? 'Cover photo file' : 'Shop logo file'} />
  </section>;
}
