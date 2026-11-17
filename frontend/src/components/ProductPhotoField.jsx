import React, { useEffect, useRef, useState } from 'react';
import { Crop, ImagePlus, RotateCcw, Trash2, X } from 'lucide-react';
import { cropProductPhoto, PRODUCT_PHOTO_ACCEPT } from '../productPhoto';
import { ProductPhoto } from './ProductPhoto';

export function ProductPhotoField({ photoUrl = '', photoFile = null, removed = false, onChange, onRemove, error = '' }) {
  const inputRef = useRef(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!sourceFile) return undefined;
    const url = URL.createObjectURL(sourceFile);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sourceFile]);

  useEffect(() => {
    if (!photoFile) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError('');
    setZoom(1); setSourceFile(file);
  }

  async function applyCrop() {
    try {
      setBusy(true); setLocalError('');
      const file = await cropProductPhoto(sourceFile, { zoom, x: 0, y: 0 });
      onChange(file);
      setSourceFile(null);
    } catch (cropError) { setLocalError(cropError.message); }
    finally { setBusy(false); }
  }

  const activePreview = previewUrl || (!removed ? photoUrl : '');
  return <div className="product-photo-field">
    <div className="product-photo-preview">{previewUrl ? <img src={previewUrl} alt="Product preview" /> : (!removed && photoUrl ? <ProductPhoto path={photoUrl} alt="Product preview" loading="eager" /> : <ImagePlus size={30} aria-hidden="true" />)}</div>
    <div className="product-photo-copy"><strong>Product photo</strong><span>Crop to 1 × 1. Saved as JPG at 50 KB or less.</span><div><button type="button" onClick={() => inputRef.current?.click()}><Crop size={15} />{activePreview ? 'Change photo' : 'Choose photo'}</button>{activePreview && <button type="button" className="danger" onClick={onRemove}><Trash2 size={15} />Remove</button>}</div></div>
    <input ref={inputRef} className="visually-hidden" type="file" accept={PRODUCT_PHOTO_ACCEPT} aria-label="Choose product photo" onChange={choose} />
    {(error || localError) && <p className="product-photo-error" role="alert">{error || localError}</p>}
    {sourceFile && <div className="product-cropper-backdrop" role="presentation"><section className="product-cropper" role="dialog" aria-modal="true" aria-labelledby="product-cropper-title">
      <header><div><h3 id="product-cropper-title">Crop product photo</h3><p>Adjust the square frame before saving.</p></div><button className="mkpos-dismiss-icon" type="button" aria-label="Close cropper" onClick={() => setSourceFile(null)}><X size={18} /></button></header>
      <div className="product-cropper-stage"><img src={sourceUrl} alt="Crop preview" className={`crop-zoom-${Math.round(zoom * 20) * 5}`} /></div>
      <div className="product-cropper-controls"><label>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label></div>
      {localError && <p className="product-photo-error" role="alert">{localError}</p>}
      <footer><button type="button" onClick={() => setZoom(1)}><RotateCcw size={15} />Reset</button><button type="button" className="primary" disabled={busy} onClick={applyCrop}>{busy ? 'Compressing…' : 'Use photo'}</button></footer>
    </section></div>}
  </div>;
}
