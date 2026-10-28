import React, { useRef, useState } from 'react';
import { Image, Pencil, LoaderCircle } from 'lucide-react';
import { request } from '../api';
import { emitDataChange } from '../dataEvents';

export function ShopCoverSettings({ cover, onChange }) {
  const input = useRef(null), saving = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function save(file) {
    if (saving.current) return;
    if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) {
      setError('Choose a PNG, JPG, or WebP image up to 2 MB.');
      setMessage('');
      return;
    }
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      if (file) body.append('cover', file);
      const saved = await request('/shop-admin/cover', { method: file ? 'POST' : 'DELETE', ...(file ? { body } : {}), timeoutMs: 30000 });
      onChange(saved.cover_data_url);
      setMessage(file ? 'Shop cover photo updated.' : 'Shop cover photo removed.');
      emitDataChange(['ecommerce'], 'shop');
    } catch (failure) { setError(failure.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="shop-cover-row">
    <div className="shop-cover-preview">{cover ? <img src={cover} alt="Current shop cover photo" /> : <Image size={32} aria-hidden="true" />}<button type="button" className="shop-image-edit" aria-label="Edit shop cover photo" title="Edit shop cover photo" disabled={busy} onClick={() => input.current?.click()}>{busy ? <LoaderCircle size={16} className="shop-image-spinner" aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}</button></div>
    <div className="shop-logo-actions"><input ref={input} className="shop-logo-input" type="file" aria-label="Shop cover photo file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) save(file); }} /></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
