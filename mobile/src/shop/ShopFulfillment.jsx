import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { InputGroup, Button, IconButton, Input, Textarea } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock3, Eye, MapPin, Package } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ShopBusy, ShopField, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors } from './shopUtils';

function FulfillmentInput({ icon: Icon, ...props }) {
  return <InputGroup className="fulfillment-icon-field"><Icon size={18} aria-hidden="true" /><Input {...props} /></InputGroup>;
}

export function ShopFulfillment({ onNavigate }) {
  const resource = useShopResource('/shop-admin/settings');
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({});
  const initialized = useRef(false), working = useRef(false);
  useEffect(() => {
    if (!resource.data || initialized.current) return;
    setForm(Object.fromEntries(['pickup_address', 'pickup_hours', 'pickup_instructions'].map(key => [key, resource.data[key] || ''])));
    initialized.current = true;
  }, [resource.data]);
  function change(key, value) { setForm(current => ({ ...current, [key]: value })); }
  async function save(event) {
    event.preventDefault(); if (working.current || !form) return;
    working.current = true; setBusy(true); setError(''); setErrors({});
    try {
      const current = await apiRequest('/shop-admin/settings');
      const keys = ['slug', 'description', 'price_type', 'storefront_enabled', 'accepting_orders', 'marketplace_enabled', 'delivery_zones', 'announcement', 'opening_hours', 'closed_until'];
      const payload = { ...Object.fromEntries(keys.map(key => [key, current[key]])), ...form };
      await apiRequest('/shop-admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
      onNavigate('/shop', { replace: true });
    } catch (e) { setError(e.message); setErrors(fieldErrors(e)); }
    finally { working.current = false; setBusy(false); }
  }
  return <><PageAppBar className="shop-fulfillment-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" disabled={busy} onClick={() => onNavigate('/shop', { back: true })}><ArrowLeft size={21} /></IconButton><h1>Fulfillment</h1><AppBarMenu /></PageAppBar><ShopLoadState resource={resource}>{form && <form className="shop-fulfillment-form" onSubmit={save}>
    {error && <p className="shop-mobile-error" role="alert">{error}</p>}
    <fieldset disabled={busy}>
      <section className="shop-fulfillment-card"><h2>Pickup instructions</h2><p>Tell buyers where and when to collect their orders.</p><ShopField id="fulfillment-pickup-address" name="pickup_address" label="Pickup address" errors={errors}><FulfillmentInput icon={MapPin} maxLength={255} value={form.pickup_address} placeholder={resource.data.address || 'Enter pickup address'} onChange={event => change('pickup_address', event.target.value)} /></ShopField><small className="fulfillment-field-hint">Leave blank to use your shop address.</small><ShopField id="fulfillment-pickup-hours" name="pickup_hours" label="Pickup hours" errors={errors}><FulfillmentInput icon={Clock3} maxLength={255} placeholder="09:00 – 18:00" value={form.pickup_hours} onChange={event => change('pickup_hours', event.target.value)} /></ShopField></section>
      <section className="shop-fulfillment-card"><h2>Fulfillment instructions</h2><p>Let buyers know how you prepare their orders.</p><ShopField id="fulfillment-instructions" name="pickup_instructions" label="Instructions for buyers" errors={errors}><Textarea rows={4} maxLength={2000} value={form.pickup_instructions} onChange={event => change('pickup_instructions', event.target.value)} /></ShopField><small className="fulfillment-character-count">{form.pickup_instructions.length}/2000</small></section>
      <section className="shop-fulfillment-card"><h2>What buyers will see</h2><p>This is how your pickup and fulfillment details appear at checkout and in their order confirmation.</p><div className="fulfillment-buyer-preview"><h3><Eye size={18} aria-hidden="true" />Buyer preview</h3><div className="fulfillment-preview-row"><span className="fulfillment-preview-icon"><MapPin size={21} aria-hidden="true" /></span><div><strong>Order pickup</strong>{(form.pickup_address || resource.data.address) && <p>{form.pickup_address || resource.data.address}</p>}{form.pickup_hours && <p>{form.pickup_hours}</p>}</div></div><div className="fulfillment-preview-row"><span className="fulfillment-preview-icon"><Package size={21} aria-hidden="true" /></span><div><strong>Order preparation</strong><p>{form.pickup_instructions || 'Collect your order at the shop.'}</p></div></div></div></section>
    </fieldset><footer className="shop-fulfillment-actions"><Button variant="primary" type="submit" className="mobile-primary" disabled={busy}>{busy ? <ShopBusy label="Saving..." /> : 'Save changes'}</Button></footer>
  </form>}</ShopLoadState></>;
}
