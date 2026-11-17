import { Button, Input } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { MobileDeleteSheet } from '../components/MobilePrimitives';
import { ShopBusy, ShopField, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors } from './shopUtils';

export { ShopStorefront, ShopStorefrontHeader } from './StorefrontSettings';

export function ShopBranding({ kind, session, onNavigate }) {
  const resource = useShopResource('/shop-admin/settings'), logo = kind === 'logo', limit = logo ? 512 * 1024 : 2 * 1024 * 1024;
  const [file, setFile] = useState(null), [preview, setPreview] = useState(''), [error, setError] = useState(''), [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [removing, setRemoving] = useState(false);
  const working = useRef(false);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const endpoint = logo ? '/settings/logo' : '/shop-admin/cover';
  async function save(remove = false) {
    if (working.current || (!remove && !file)) return;
    if (!remove && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > limit)) { setError(`Choose a PNG, JPG or WebP up to ${logo ? '512 KB' : '2 MB'}.`); return; }
    working.current = true; setBusy(true); setError(''); setErrors({});
    try { const body = new FormData(); if (!remove) body.append(kind, file); const saved = await apiRequest(endpoint, { method: remove ? 'DELETE' : 'POST', ...(remove ? {} : { body }), timeoutMs: 30000 }); if (logo) window.dispatchEvent(new CustomEvent('mkpos:shop-logo-updated', { detail: saved.receipt_logo_data_url })); onNavigate('/shop', { replace: true }); }
    catch (e) { setError(e.message); setErrors(fieldErrors(e)); } finally { working.current = false; setBusy(false); }
  }
  const current = resource.data?.[logo ? 'receipt_logo_data_url' : 'cover_data_url'];
  if (logo && session?.user?.role !== 'owner') return <p role="alert">Only the owner can change the business logo.</p>;
  return <ShopLoadState resource={resource}><form className="shop-mobile-card shop-mobile-form" onSubmit={event => { event.preventDefault(); void save(); }}><h1>{logo ? 'Business logo' : 'Shop cover photo'}</h1>{error && <p role="alert">{error}</p>}{(preview || current) && <img className="shop-mobile-brand-preview" src={preview || current} alt={logo ? 'Business logo preview' : 'Shop cover preview'} />}<ShopField name={kind} label={logo ? 'Business logo file' : 'Shop cover file'} errors={errors}><Input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { setError(''); setFile(event.target.files?.[0] || null); }} /></ShopField><p>PNG, JPG or WebP. {logo ? 'Up to 512 KB and 2400 × 2400 pixels.' : 'Up to 2 MB and 4800 × 4800 pixels.'}</p><div className="shop-mobile-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => onNavigate('/shop')}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || !file}>{busy ? <ShopBusy label="Saving…" /> : 'Save image'}</Button>{current && <Button variant="danger" type="button" className="mobile-danger" disabled={busy} onClick={() => setRemoving(true)}>Remove image</Button>}</div></form><MobileDeleteSheet open={removing} title="Remove image" itemTitle={logo ? 'Business logo' : 'Shop cover'} description="The current image will be removed from your shop." busy={busy} onClose={() => !busy && setRemoving(false)} onConfirm={() => save(true)}>{error && <p role="alert">{error}</p>}</MobileDeleteSheet></ShopLoadState>;
}
