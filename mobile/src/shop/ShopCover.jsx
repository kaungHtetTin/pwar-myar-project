import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton, Input } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileImage, HardDriveDownload, ImagePlus, Info, Maximize, RotateCcw, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { MobileDeleteSheet } from '../components/MobilePrimitives';
import { ShopBusy, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors } from './shopUtils';

export function ShopCoverHeader({ onNavigate }) {
  return <PageAppBar className="shop-cover-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back to My Shop" onClick={() => onNavigate('/shop')}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>Shop cover</h1><AppBarMenu /></PageAppBar>;
}

export function ShopCover({ onNavigate }) {
  const resource = useShopResource('/shop-admin/settings');
  const [file, setFile] = useState(null), [preview, setPreview] = useState(''), [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef(null), working = useRef(false), errorRef = useRef(null);
  const current = resource.data?.cover_data_url || '';
  const image = preview || (!removed ? current : '');
  const dirty = Boolean(file || (removed && current));
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (error && errorRef.current?.getClientRects().length) errorRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, [error]);
  function choose(event) {
    const next = event.target.files?.[0]; event.target.value = '';
    if (!next) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type) || next.size > 2 * 1024 * 1024) { setError('Choose a PNG, JPG or WebP up to 2 MB.'); return; }
    setError(''); setFile(next); setRemoved(false);
  }
  async function save(event) {
    event.preventDefault(); if (working.current || !dirty) return;
    working.current = true; setBusy(true); setError('');
    try {
      const body = new FormData(); if (file) body.append('cover', file);
      const saved = await apiRequest('/shop-admin/cover', { method: file ? 'POST' : 'DELETE', ...(file ? { body } : {}), timeoutMs: 30000 });
      resource.setData(previous => ({ ...previous, cover_data_url: saved.cover_data_url || '' }));
      setFile(null); setRemoved(false);
      onNavigate('/shop', { replace: true });
    } catch (e) { setError(fieldErrors(e).cover || e.message); }
    finally { working.current = false; setBusy(false); }
  }
  return <><ShopCoverHeader onNavigate={onNavigate} /><ShopLoadState resource={resource}><form className="shop-cover-form" onSubmit={save}>
    {error && <p ref={errorRef} className="shop-cover-error" role="alert">{error}</p>}
    <section className="shop-cover-preview-card" aria-label="Cover image">
      {image ? <img className="shop-cover-preview" src={image} alt={file ? 'Selected shop cover preview' : 'Current shop cover'} /> : <div className="shop-cover-empty"><ImagePlus size={38} aria-hidden="true" /><strong>{removed ? 'Cover will be removed' : 'No cover image yet'}</strong><p>{removed ? 'Save changes to remove the current cover.' : 'Choose a cover image for your customer shop.'}</p></div>}
      {file && <p className="shop-cover-file-name">{file.name}</p>}
      <Input ref={input} className="sr-only" type="file" aria-label="Shop cover file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={choose} />
      <div className="shop-cover-image-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={18} aria-hidden="true" />{image ? 'Replace' : 'Choose image'}</Button>{removed ? <Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => { setRemoved(false); setFile(null); setError(''); }}><RotateCcw size={18} aria-hidden="true" />Undo removal</Button> : <Button variant="danger" type="button" className="mobile-danger" disabled={busy || !image} onClick={() => setConfirming(true)}><Trash2 size={18} aria-hidden="true" />Remove</Button>}</div>
    </section>
    <section className="shop-cover-requirements"><h2>Image requirements</h2><ul><li><FileImage size={20} aria-hidden="true" /><span>PNG, JPG or WebP format</span></li><li><HardDriveDownload size={20} aria-hidden="true" /><span>Maximum file size: 2 MB</span></li><li><Maximize size={20} aria-hidden="true" /><span>Maximum dimensions: 4,800 × 4,800 pixels</span></li></ul></section>
    <div className="shop-cover-note"><Info size={20} aria-hidden="true" /><p>Changes to your shop cover will not be visible until you save them.</p></div>
    <div className="shop-cover-save-bar"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => onNavigate('/shop')}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || !dirty}>{busy ? <ShopBusy label="Saving…" /> : 'Save changes'}</Button></div>
  </form><MobileDeleteSheet open={confirming} title="Remove cover?" itemTitle="Shop cover" description="This removes the cover when you save changes." confirmLabel="Remove cover" onClose={() => setConfirming(false)} onConfirm={() => { setFile(null); setRemoved(Boolean(current)); setError(''); setConfirming(false); }} /></ShopLoadState></>;
}
