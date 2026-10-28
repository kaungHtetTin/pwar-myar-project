import { Button } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, RotateCcw } from 'lucide-react';
import { useLocale } from '../localization/LocaleContext';
import { apiDownload } from '../api/client';
import { MobileField } from '../components/MobilePrimitives';

export function ShopBusy({ label }) {
  return <span className="shop-busy"><LoaderCircle size={16} aria-hidden="true" /><span>{label}</span></span>;
}

export function ShopLoading({ label = 'Loading…', variant = 'list' }) {
  const count = variant === 'detail' || variant === 'list' || variant === 'contacts' ? 3 : 1;
  return <div className={`shop-loading shop-loading--${variant}`} role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    {variant === 'inline' ? <span aria-hidden="true"><ShopBusy label={label} /></span> : <div className="shop-loading-content" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div className="shop-loading-card" key={index}><div className="shop-loading-heading"><span className="shop-loading-avatar shop-skeleton" /><div><span className="shop-skeleton shop-loading-title" /><span className="shop-skeleton shop-loading-subtitle" /></div></div>{variant !== 'contacts' && <><span className="shop-skeleton shop-loading-line" /><span className="shop-skeleton shop-loading-line is-short" /><div className="shop-loading-footer"><span className="shop-skeleton" /><span className="shop-skeleton" /></div></>}</div>)}</div>}
  </div>;
}

export function ShopErrorNotice({ title = 'Unable to load', message, onRetry, retryLabel = 'Retry', disabled = false, className = '' }) {
  const [busy, setBusy] = useState(false), working = useRef(false);
  const { language } = useLocale();
  const localize = value => language === 'my' ? ({ 'Unable to load': 'ဖွင့်၍ မရသေးပါ', 'Unable to refresh': 'အသစ်ပြန်ယူ၍ မရပါ', 'Unable to load image': 'ပုံကို ဖွင့်၍ မရပါ', 'Unable to load conversations': 'စကားပြောခန်းများ ဖွင့်၍ မရပါ', 'Unable to load messages': 'မက်ဆေ့ချ်များ ဖွင့်၍ မရပါ', 'Message not sent': 'မက်ဆေ့ချ် မပို့ရသေးပါ', 'Action failed': 'လုပ်ဆောင်၍ မရပါ', Retry: 'ပြန်ကြိုးစားရန်', 'Retry image': 'ပုံကို ပြန်ဖွင့်ရန်', 'Retry chats': 'ပြန်ဖွင့်ရန်', 'Retry messages': 'ပြန်ဖွင့်ရန်', 'Retry products': 'ပြန်ယူရန်', 'Retry send': 'ပြန်ပို့ရန်', 'Trying again…': 'ပြန်ကြိုးစားနေသည်…' }[value] || value) : value;
  async function retry(event) {
    if (working.current || disabled) return;
    working.current = true; setBusy(true);
    try { await onRetry(event); } catch { /* The caller owns the error and retains its failed state. */ }
    finally { working.current = false; setBusy(false); }
  }
  return <div className={`shop-error-notice ${className}`} role="alert"><span className="shop-error-icon"><AlertCircle size={18} aria-hidden="true" /></span><div className="shop-error-copy"><strong>{localize(title)}</strong><p>{message}</p>{onRetry && <Button variant="secondary" className="shop-error-retry" type="button" busy={busy} disabled={disabled} onClick={retry}>{busy ? <LoaderCircle className="spin" size={14} aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}{localize(busy ? 'Trying again…' : retryLabel)}</Button>}</div></div>;
}

export function ShopLoadState({ resource, children }) {
  if (!resource.data) return resource.error ? <ShopErrorNotice message={resource.error} onRetry={() => resource.reload()} /> : <ShopLoading variant="detail" />;
  return <>{resource.error && <ShopErrorNotice title="Unable to refresh" message={resource.error} onRetry={resource.reload ? () => resource.reload() : undefined} />}{children}</>;
}
export function ShopField({ name, label, errors = {}, children, id: fieldId }) {
  const id = fieldId || `shop-${name}`;
  return <MobileField id={id} label={label} error={errors[name]}>{React.cloneElement(children, { id, 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `${id}-error` : undefined })}</MobileField>;
}
export function ShopPrivateImage({ path, label }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, objectUrl;
    setUrl(''); setError('');
    apiDownload(path, { accept: 'image/*', timeoutMs: 15000 }).then(response => response.blob()).then(blob => {
      if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, retry]);
  return <div className="shop-mobile-proof">{url ? <><img src={url} alt={label} /><a href={url} target="_blank" rel="noreferrer">Open full image</a></> : error ? <ShopErrorNotice title="Unable to load image" message={error} retryLabel="Retry image" onRetry={() => setRetry(n => n + 1)} /> : <ShopLoading variant="image" label="Loading image…" />}</div>;
}
