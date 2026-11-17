import React, { useEffect, useId, useRef, useState } from 'react';
import { Package, Plus, Minus, Check, Clock3, AlertCircle } from 'lucide-react';
import { useText } from './i18n';
import { LoadingSkeleton } from './LoadingSkeleton';

export function IconButton({ label, icon: Icon, className = '', ...props }) {
  const text = useText();
  return <button type="button" className={`shop-icon-button ${className}`} title={text(label)} aria-label={text(label)} {...props}><Icon size={17} aria-hidden="true" /></button>;
}

export function ProductMedia({ src, name = '', lazy = true, className = 'product-image', fallback, children }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const [loadedSrc, setLoadedSrc] = useState(null);
  const imageRef = useRef(null);
  const imageLoading = Boolean(src && failedSrc !== src && loadedSrc !== src);
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);
  return <div className={`${className}${imageLoading ? ' shop-media-loading' : ''}`}>
    {imageLoading && <span className="shop-image-skeleton" aria-hidden="true" />}
    {src && failedSrc !== src ? <img ref={imageRef} src={src} alt={name} loading={lazy ? 'lazy' : 'eager'} onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)} /> : fallback || <Package className="product-placeholder" size={48} strokeWidth={1.25} aria-hidden="true" />}
    {children}
  </div>;
}

export function PriceTag({ amount, currency, original, unit, className = '' }) {
  const text = useText();
  return <span className={`price-tag ${className}`}>
    <strong className="price-current">{Number(amount).toLocaleString()} <small>{currency}</small></strong>
    {original != null && <del className="original-price">{Number(original).toLocaleString()} {currency}</del>}
    {unit && <span className="price-unit">{text('Per {unit}', { unit })}</span>}
  </span>;
}

// Buttons change the existing quantity value; the number input retains native
// validation and supports the same three-decimal quantities as checkout.
export function QuantityControl({ value, onChange, max, label, name, hiddenLabel = false, required = false }) {
  const text = useText();
  const id = useId(), min = .001, number = Number(value), ceiling = Number(max);
  const usable = Number.isFinite(number) && number >= min;
  const move = direction => {
    const next = Math.min(ceiling, Math.max(min, Math.round((number + direction) * 1000) / 1000));
    if (Number.isFinite(next) && next >= min) onChange(String(next));
  };
  return <div className="quantity-control">
    <label className={hiddenLabel ? 'sr-only' : ''} htmlFor={id}>{label}</label>
    <div className="quantity-stepper">
      <button type="button" aria-label={`${text('Decrease quantity')}: ${name}`} onClick={() => move(-1)} disabled={!usable || number <= min || ceiling < min}><Minus size={16} aria-hidden="true" /></button>
      <input id={id} type="number" min="0.001" max={max} step="0.001" required={required} value={value} onChange={event => onChange(event.target.value)} />
      <button type="button" aria-label={`${text('Increase quantity')}: ${name}`} onClick={() => move(1)} disabled={!usable || number >= ceiling || ceiling < min}><Plus size={16} aria-hidden="true" /></button>
    </div>
  </div>;
}

export function StatusBadge({ value, payment = false }) {
  const text = useText();
  const good = ['completed', 'paid', 'approved', 'refunded'].includes(value);
  const stopped = ['cancelled', 'expired', 'rejected', 'failed'].includes(value);
  const processing = ['accepted', 'packing', 'ready_for_pickup', 'dispatched'].includes(value);
  const Icon = good ? Check : stopped ? AlertCircle : processing ? Package : Clock3;
  return <span className={`status-badge ${good ? 'is-good' : stopped ? 'is-stopped' : processing ? 'is-processing' : 'is-pending'}`}><Icon size={13} aria-hidden="true" />{payment && <span className="status-prefix">{text('Payment')}: </span>}{text(String(value || '')).replaceAll('_', ' ')}</span>;
}

export function SectionTitle({ icon: Icon, title, number, children }) {
  return <div className="component-section-title"><span className="section-symbol" aria-hidden="true">{Icon ? <Icon size={18} /> : number}</span><div><h2>{title}</h2>{children}</div></div>;
}

export function LoadingPanel({ message = 'Loading…', variant = 'section', ...props }) {
  return <LoadingSkeleton variant={variant} message={message} {...props} />;
}
