import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { InputGroup, Button, FieldShell, IconButton, Input } from '../components/Controls';
import React from 'react';
import { ChevronLeft, Package } from 'lucide-react';

import { ProductPhoto } from './ProductPhoto.jsx';
import { baseUnitName, formatQuantity, money, stockStatus, stockStatusLabel } from './productUtils';

export function ProductReferenceHeader({ actions, title, onBack }) {

  return <PageAppBar className="retail-sale-header product-reference-header">{onBack && <IconButton variant="ghost" type="button" aria-label={'Back to products'} onClick={onBack}><ChevronLeft size={26} /></IconButton>}<h1>{title}</h1>{actions}<AppBarMenu /></PageAppBar>;
}

export function ProductReferenceProfile({ product, currency, variant = 'inventory', onPhoto }) {
  const status = stockStatus(product);
  return <section className={`product-reference-profile profile-${variant}`}>
    <span className="product-reference-media">{product.photo_file ? <LocalPhoto file={product.photo_file} /> : product.photo_url && !product.remove_photo ? <ProductPhoto path={product.photo_url} loading="eager" /> : <Package size={30} />}</span>
    <div><h2 data-no-localize>{product.name || 'New product'}</h2>{variant.startsWith('new') && <p><span>Category: </span><span data-no-localize>{product.category || 'Uncategorized'}</span></p>}<p data-no-localize>{product.sku || 'No SKU'}{variant === 'new' && product.barcode ? ` · Barcode: ${product.barcode}` : ''}</p>
      {variant === 'new-price' ? <><p><span>Barcode: </span><span data-no-localize>{product.barcode || 'Not set'}</span></p><p><span>Base unit: </span><span data-no-localize>{baseUnitName(product)}</span></p></> : variant === 'new' ? <p className="product-reference-unit-tags"><span>Base unit: {baseUnitName(product)}</span>{product.purchase_unit && <span>Buying unit: {product.purchase_unit}</span>}</p> : <span className={`product-reference-stock stock-pill--${status}`}><Package size={15} />{formatQuantity(product.stock)} {baseUnitName(product)} {status === 'in_stock' ? 'in stock' : stockStatusLabel(status)}</span>}
      {variant === 'stock' && <><strong className="product-reference-price">{money(product.price, currency)}</strong><small>per {baseUnitName(product)}</small></>}
    </div>{onPhoto && <Button variant="secondary" type="button" className="mobile-secondary" onClick={onPhoto}>Change photo</Button>}
  </section>;
}

function LocalPhoto({ file }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return <img src={url} alt="" />;
}

export function ProductUnitInput({ label, value, onChange, unit, prefix, hint, error, formatted = false, ...props }) {
  const displayValue = formatted && value !== '' ? Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) : value;
  return <FieldShell as="label" className="mobile-field product-unit-field"><span>{label}</span><InputGroup className="product-unit-input">{prefix && <span className="product-unit-prefix" data-no-localize>{prefix}</span>}<Input aria-label={typeof label === 'string' ? label : undefined} value={displayValue} onChange={formatted && onChange ? event => onChange({ target: { value: event.target.value.replace(/[^\d]/g, '') } }) : onChange} {...props} />{unit && <span>{unit}</span>}</InputGroup>{hint && <small>{hint}</small>}{error && <small className="mobile-field-error" role="alert">{error}</small>}</FieldShell>;
}
