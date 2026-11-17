import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { FloatingActionButton, Button, IconButton, Input, Select } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Globe, Mail, MessageCircle, Pencil, Phone, Plus, Smartphone, Trash2, Truck, Info, X, Video } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileDeleteSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { ShopBusy, ShopField, ShopLoadState, ShopLoading } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors, shopMoney } from './shopUtils';
import { ShopMethodsHeader, ShopMethodsList, ShopMethodFields } from './ShopMethods';

const PLATFORMS = { phone: 'Phone', email: 'Email', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', telegram: 'Telegram', viber: 'Viber', instagram: 'Instagram', whatsapp: 'WhatsApp' };
const CONFIG_SECTIONS = {
  contacts: { endpoint: 'contacts', label: 'Contacts', singular: 'contact', max: 100, blank: { platform: 'phone', label: '', value: '' } },
  delivery: { endpoint: 'delivery-zones', label: 'Delivery zones', singular: 'delivery zone', max: 100, blank: { name: '', fee: 0 } },
  methods: { endpoint: 'payment-methods', label: 'Payment methods', singular: 'payment method', max: 20, blank: { name: '', type: 'transfer', bank: '', account_name: '', account_no: '', instructions: '', is_active: true, provider: 'manual' } },
};

export function ShopConfigurationList({ section, onNavigate, session }) {
  const config = CONFIG_SECTIONS[section];
  const resource = useShopResource(`/shop-admin/${config.endpoint}`);
  const [deleting, setDeleting] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const working = useRef(false);
  const [deliveryNotice, setDeliveryNotice] = useState(true);
  // These configuration endpoints are bounded arrays (20/100 records), not paginated APIs.
  // Reveal them incrementally through the shared endless-list UI.
  const list = useEndlessList({ enabled: !!resource.data, queryKey: config.endpoint, loadPage: ({ offset, limit }) => ({ items: resource.data?.items.slice(offset, offset + limit) || [], total: resource.data?.items.length || 0 }) });
  const reloadList = list.reload;
  useEffect(() => { if (resource.data) void reloadList(); }, [resource.data, reloadList]);
  async function remove() {
    if (working.current || !deleting) return;
    working.current = true; setBusy(true); setError('');
    try { await apiRequest(`/shop-admin/${config.endpoint}/${encodeURIComponent(deleting.id)}`, { method: 'DELETE' }); setDeleting(null); await resource.reload(); }
    catch (e) { setError(e.message); } finally { working.current = false; setBusy(false); }
  }
  if (section === 'methods') return <ShopMethodsList resource={resource} list={list} onNavigate={onNavigate} deleting={deleting} busy={busy} error={error} onDelete={item => { setDeleting(item); setError(''); }} onCloseDelete={() => { if (!busy) setDeleting(null); }} onConfirmDelete={remove} />;
  if (section === 'contacts') return <><ShopContactsHeader title="Shop contacts" onBack={() => onNavigate('/shop')} /><FloatingActionButton label="Add contact" disabled={!resource.data || resource.data.items.length >= config.max} onClick={() => onNavigate('/shop/contacts/new')}><Plus size={24} aria-hidden="true" /></FloatingActionButton><ShopLoadState resource={resource}><div className="shop-contacts-capacity"><strong>{resource.data?.items.length || 0} of {config.max} contacts</strong><small>You can add up to 100 contacts.</small></div><div className="shop-contacts-list">{list.initialLoading && <ShopLoading label="Loading contacts..." variant="contacts" />}{!list.initialLoading && !list.items.length && <div className="shop-contacts-empty"><Phone size={30} aria-hidden="true" /><h2>No contacts yet.</h2><p>Add public contact details for your customer shop.</p></div>}{list.items.map(item => <article className="shop-contact-row" key={item.id}><span className="shop-contact-icon"><ContactPlatformIcon platform={item.platform} /></span><div className="shop-contact-copy"><h2>{PLATFORMS[item.platform] || item.platform}</h2>{item.label && <small>{item.label}</small>}</div><p className="shop-contact-value">{item.value}</p><div className="shop-contact-actions"><IconButton variant="ghost" type="button" aria-label={`Edit ${item.label || PLATFORMS[item.platform]}`} onClick={() => onNavigate(`/shop/contacts/${encodeURIComponent(item.id)}/edit`)}><Pencil size={17} aria-hidden="true" /></IconButton><IconButton variant="danger-ghost" type="button" className="is-danger" aria-label={`Delete ${item.label || PLATFORMS[item.platform]}`} onClick={() => { setDeleting(item); setError(''); }}><Trash2 size={17} aria-hidden="true" /></IconButton></div></article>)}<EndlessListFooter list={list} count={list.items.length} noun="contacts" /></div><MobileDeleteSheet open={!!deleting} title="Delete contact" itemTitle={deleting?.label || PLATFORMS[deleting?.platform]} description="This contact will be removed from your customer shop." busy={busy} onClose={() => { if (!busy) setDeleting(null); }} onConfirm={remove}>{error && <p role="alert">{error}</p>}</MobileDeleteSheet></ShopLoadState></>;
  if (section === 'delivery') return <><ShopDeliveryHeader title="Delivery" onBack={() => onNavigate('/shop')} /><FloatingActionButton label="Add delivery" disabled={!resource.data || resource.data.items.length >= config.max} onClick={() => onNavigate('/shop/delivery/new')}><Plus size={24} aria-hidden="true" /></FloatingActionButton><ShopLoadState resource={resource}>{deliveryNotice && <div className="shop-delivery-notice"><Info size={20} aria-hidden="true" /><p>Set the delivery options your customers can choose at checkout.</p><IconButton variant="ghost" type="button" aria-label="Dismiss delivery information" onClick={() => setDeliveryNotice(false)}><X size={18} aria-hidden="true" /></IconButton></div>}<p className="shop-delivery-count">{resource.data?.items.length || 0} of {config.max} delivery options</p><div className="shop-delivery-list">{list.initialLoading && <ShopLoading label="Loading delivery options..." />}{!list.initialLoading && !list.items.length && <section className="shop-delivery-empty"><Truck size={32} aria-hidden="true" /><h2>No delivery options yet.</h2><p>Add a delivery zone and the fee customers pay at checkout.</p></section>}{list.items.map(item => <article className="shop-delivery-row" key={item.id}><span className="shop-delivery-icon"><Truck size={24} aria-hidden="true" /></span><div className="shop-delivery-copy"><h2>{item.name}</h2><div className="shop-delivery-price"><strong>{shopMoney(item.fee, session?.business?.currency)}</strong>{Number(item.fee) === 0 && <span>Free</span>}</div></div><div className="shop-delivery-row-actions"><Button variant="plain" type="button" aria-label={`Edit ${item.name}`} onClick={() => onNavigate(`/shop/delivery/${encodeURIComponent(item.id)}/edit`)}><Pencil size={17} aria-hidden="true" /><span>Edit</span></Button><Button variant="danger-ghost" type="button" className="is-danger" aria-label={`Delete ${item.name}`} onClick={() => { setDeleting(item); setError(''); }}><Trash2 size={17} aria-hidden="true" /><span>Delete</span></Button></div></article>)}<EndlessListFooter list={list} count={list.items.length} noun="delivery options" /></div><MobileDeleteSheet open={!!deleting} title="Delete delivery zone" itemTitle={deleting?.name} description="Existing order details will be preserved." busy={busy} onClose={() => { if (!busy) setDeleting(null); }} onConfirm={remove}>{error && <p role="alert">{error}</p>}</MobileDeleteSheet></ShopLoadState></>;
  return null;
}

function configPayload(section, form) {
  if (section === 'delivery') return { name: form.name.trim(), fee: Number(form.fee) };
  if (section === 'contacts') return { platform: form.platform, label: form.label.trim(), value: form.value.trim() };
  return { name: form.name.trim(), type: form.type, bank: form.bank || '', account_name: form.account_name || '', account_no: form.account_no || '', instructions: form.instructions || '', is_active: !!form.is_active, provider: 'manual' };
}
export function ShopConfigurationForm({ section, id, onNavigate, session }) {
  const config = CONFIG_SECTIONS[section], resource = useShopResource(`/shop-admin/${config.endpoint}`);
  const [form, setForm] = useState(id ? null : { ...config.blank }), [errors, setErrors] = useState({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const initialized = useRef(!id), working = useRef(false), errorRef = useRef(null);
  useEffect(() => { if (['contacts', 'delivery', 'methods'].includes(section) && error && errorRef.current?.getClientRects().length) errorRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, [error, section]);
  useEffect(() => {
    if (!initialized.current && resource.data) { const item = resource.data.items.find(item => String(item.id) === id); if (item) setForm({ ...config.blank, ...item }); else setError('This record is unavailable.'); initialized.current = true; }
  }, [config.blank, id, resource.data]);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault(); if (working.current || !form || (section === 'methods' && !id && resource.data?.items.length >= config.max)) return;
    working.current = true; setBusy(true); setErrors({}); setError('');
    try { await apiRequest(`/shop-admin/${config.endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(configPayload(section, form)) }); if (!id) setForm({ ...config.blank }); onNavigate(`/shop/${section}`, { replace: true }); }
    catch (e) { setError(e.message); setErrors(fieldErrors(e)); } finally { working.current = false; setBusy(false); }
  }
  const contactType = form?.platform === 'phone' ? 'tel' : form?.platform === 'email' ? 'email' : ['whatsapp', 'viber'].includes(form?.platform) ? 'text' : 'url';
  return <>{section === 'methods' && <ShopMethodsHeader title={id ? 'Edit payment method' : 'Add payment method'} busy={busy} onBack={() => onNavigate('/shop/methods', { back: true })} />}{section === 'delivery' && <ShopDeliveryHeader title={id ? 'Edit delivery' : 'Add delivery'} onBack={() => onNavigate('/shop/delivery')} />}{section === 'contacts' && <ShopContactsHeader title={id ? 'Edit contact' : 'Add contact'} onBack={() => onNavigate('/shop/contacts')} />}<ShopLoadState resource={resource}>{error && <p ref={errorRef} className={section === 'contacts' ? 'shop-contacts-error' : section === 'delivery' ? 'shop-delivery-error' : 'shop-method-error'} role="alert">{error}</p>}{section === 'methods' && !id && resource.data?.items.length >= config.max && <p role="status" className="shop-method-error">You have reached the 20 payment method limit.</p>}{form && <form className={`shop-mobile-form shop-mobile-card${section === 'contacts' ? ' shop-contact-form' : section === 'delivery' ? ' shop-delivery-form' : ' shop-method-form'}`} onSubmit={submit}><fieldset disabled={busy}>
    {section === 'contacts' ? <><p>These contacts are shown publicly in your customer shop.</p><ShopField id={`shop-contact-${encodeURIComponent(id || 'new')}-platform`} name="platform" label="Platform" errors={errors}><Select value={form.platform} onChange={event => setForm({ ...form, platform: event.target.value, value: '' })}>{Object.entries(PLATFORMS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></ShopField><ShopField id={`shop-contact-${encodeURIComponent(id || 'new')}-label`} name="label" label="Label (optional)" errors={errors}><Input maxLength={100} value={form.label} onChange={event => change('label', event.target.value)} /></ShopField><ShopField id={`shop-contact-${encodeURIComponent(id || 'new')}-value`} name="value" label={form.platform === 'phone' ? 'Phone number' : form.platform === 'email' ? 'Email address' : ['viber', 'whatsapp'].includes(form.platform) ? 'Phone number or contact link' : 'Contact link'} errors={errors}><Input required type={contactType} maxLength={500} value={form.value} onChange={event => change('value', event.target.value)} /></ShopField>{contactType === 'text' && <small>Use an international phone number starting with +, or a full HTTP/HTTPS contact link.</small>}</> : section === 'methods' ? null : <ShopField id={section === 'delivery' ? `shop-delivery-${encodeURIComponent(id || 'new')}-name` : undefined} name="name" label={section === 'delivery' ? 'Option name' : 'Method name'} errors={errors}><Input required maxLength={section === 'delivery' ? 255 : 100} value={form.name} onChange={event => change('name', event.target.value)} /></ShopField>}
    {section === 'delivery' && <p className="shop-delivery-field-hint">This name will be shown to your customers at checkout.</p>}
    {section === 'delivery' && <ShopField id={`shop-delivery-${encodeURIComponent(id || 'new')}-fee`} name="fee" label={`Fee (${session?.business?.currency || 'Ks'})`} errors={errors}><Input required type="number" min={0} max={1000000000} step={1} value={form.fee} onChange={event => change('fee', event.target.value)} /></ShopField>}
    {section === 'delivery' && <p className="shop-delivery-field-hint">{id ? 'Existing orders will retain their recorded fee.' : 'Zero means free delivery.'}</p>}
    {section === 'methods' && <ShopMethodFields form={form} change={change} errors={errors} recordKey={id || 'new'} />}
    <div className="shop-mobile-actions"><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => section === 'methods' ? onNavigate('/shop/methods', { back: true }) : onNavigate(`/shop/${section}`)}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || (section === 'methods' && !id && resource.data?.items.length >= config.max)}>{busy ? <ShopBusy label="Saving…" /> : section === 'delivery' ? id ? 'Save changes' : 'Save delivery' : section === 'methods' ? id ? 'Save changes' : 'Save method' : `Save ${config.singular}`}</Button></div>
  </fieldset></form>}</ShopLoadState></>;
}

export function ShopContactsHeader({ title, onBack, action }) {
  return <PageAppBar className="shop-contacts-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{action}<AppBarMenu /></PageAppBar>;
}
function ContactPlatformIcon({ platform }) {
  const Icon = { phone: Phone, email: Mail, instagram: Camera, youtube: Video, tiktok: Video, whatsapp: Smartphone, viber: Smartphone, telegram: MessageCircle }[platform] || Globe;
  return <Icon size={21} aria-hidden="true" />;
}

export function ShopDeliveryHeader({ title, onBack, action }) {
 return <PageAppBar className="shop-delivery-header"><IconButton variant="ghost" className="icon-button" type="button" aria-label="Back" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{action}<AppBarMenu /></PageAppBar>;
}
