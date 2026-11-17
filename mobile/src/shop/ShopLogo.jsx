import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton, Input } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Info, RotateCcw, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { MobileDeleteSheet } from '../components/MobilePrimitives';
import { ShopBusy, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors } from './shopUtils';

export function ShopLogoHeader({ onNavigate, busy = false }) {
  return <PageAppBar className="shop-logo-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back to My Shop" disabled={busy} onClick={() => onNavigate('/shop', { back: true })}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>Business logo</h1><AppBarMenu /></PageAppBar>;
}
export function ShopLogo({ session, onNavigate }) {
  const owner = session?.user?.role === 'owner';
  const resource = useShopResource(owner ? '/shop-admin/settings' : null);
  const [file, setFile] = useState(null), [preview, setPreview] = useState(''), [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef(null), working = useRef(false), errorRef = useRef(null);
  const current = resource.data?.receipt_logo_data_url || '', image = preview || (!removed ? current : ''), dirty = Boolean(file || (removed && current));
  useEffect(() => { if (!file) { setPreview(''); return undefined; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => { if (error && errorRef.current?.getClientRects().length) errorRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, [error]);
  function choose(event) {
    const next = event.target.files?.[0]; event.target.value = ''; if (!next) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type) || next.size > 512 * 1024) { setError('Choose a PNG, JPG or WebP up to 512 KB.'); return; }
    setError(''); setFile(next); setRemoved(false);
  }
  async function save(event) {
    event.preventDefault(); if (working.current || !owner || !dirty) return;
    working.current = true; setBusy(true); setError('');
    try {
      const body = new FormData(); if (file) body.append('logo', file);
      const saved = await apiRequest('/settings/logo', { method: file ? 'POST' : 'DELETE', ...(file ? { body } : {}), timeoutMs: 30000 });
      resource.setData(previous => ({ ...previous, receipt_logo_data_url: saved.receipt_logo_data_url || '' }));
      window.dispatchEvent(new CustomEvent('mkpos:shop-logo-updated', { detail: saved.receipt_logo_data_url || '' }));
      setFile(null); setRemoved(false); onNavigate('/shop', { replace: true });
    } catch (e) { setError(fieldErrors(e).logo || e.message); }
    finally { working.current = false; setBusy(false); }
  }
  return <><ShopLogoHeader onNavigate={onNavigate} busy={busy} />{!owner ? <section className="shop-logo-card"><p role="alert">Only the owner can change the business logo.</p></section> : <ShopLoadState resource={resource}><form className="shop-logo-form" onSubmit={save}>
    {error && <p ref={errorRef} role="alert" className="shop-logo-error">{error}</p>}
    <section className="shop-logo-card"><div className="shop-logo-preview-frame">{image ? <img src={image} alt={file ? 'Selected business logo preview' : 'Current business logo'} /> : <div className="shop-logo-empty"><ImagePlus size={37} aria-hidden="true" /><strong>{removed ? 'Logo will be removed' : 'No business logo yet'}</strong></div>}</div>{file && <p className="shop-logo-file-name">{file.name}</p>}
      <h2>Your business logo</h2><p>This logo is your shared business identity. It will be used on POS receipts and your online storefront.</p>
      <aside className="shop-logo-note"><Info size={21} aria-hidden="true" /><p>Only the shop owner can change the business logo.</p></aside>
      <section className="shop-logo-requirements"><h3>Image requirements</h3><ul><li>File format: PNG, JPG or WebP</li><li>Maximum file size: 512 KB</li><li>Maximum dimensions: 2400 × 2400 px</li><li>Square image recommended for best results</li></ul></section>
      <Input ref={input} className="sr-only" type="file" aria-label="Business logo file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={choose} />
      <div className="shop-logo-image-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={19} aria-hidden="true" />{image ? 'Replace logo' : 'Choose logo'}</Button>{removed ? <Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => { setRemoved(false); setFile(null); setError(''); }}><RotateCcw size={18} aria-hidden="true" />Undo removal</Button> : <Button variant="danger" type="button" className="mobile-danger" disabled={busy || !image} onClick={() => setConfirming(true)}><Trash2 size={18} aria-hidden="true" />Remove logo</Button>}</div>
      {removed && <p className="shop-logo-removal-note">Save changes to remove the current logo.</p>}
    </section><footer className="shop-logo-save-bar"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => onNavigate('/shop', { back: true })}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || !dirty}>{busy ? <ShopBusy label="Saving..." /> : 'Save changes'}</Button></footer>
  </form><MobileDeleteSheet open={confirming} title="Remove business logo?" itemTitle="Business logo" description="This removes the shared logo from receipts and your online storefront when you save changes." confirmLabel="Remove logo" onClose={() => setConfirming(false)} onConfirm={() => { setFile(null); setRemoved(Boolean(current)); setError(''); setConfirming(false); }} /></ShopLoadState>}</>;
}
