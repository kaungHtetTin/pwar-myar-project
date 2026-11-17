import { ProductUnitSetup, ProductStockCostFields } from './ProductUnitFields';
import { MarketplaceCategorySelect } from './MarketplaceCategorySelect';
import { InputGroup, Button, FieldShell, IconButton, Input, Select, Textarea } from '../components/Controls';
import React, { useEffect, useId, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Info, RefreshCw, ScanLine } from 'lucide-react';
import { ProductPhotoField } from './ProductPhotoField';
import { ProductBarcodeScanner } from './ProductBarcodeScanner';
import { ProductReferenceProfile, ProductUnitInput } from './ProductReferenceParts';
import { automaticSellingPrice, baseUnitName } from './productUtils';

function FormField({ label, error, children }) {
  return <FieldShell as="label" className="mobile-field"><span>{label}</span>{children}{error && <small className="mobile-field-error" role="alert">{error}</small>}</FieldShell>;
}

export function ProductReferenceForm({ form, setForm, priceRules, categories, errors, saving, editing, onSubmit, onCancel, currency }) {
  const [step, setStep] = useState(1), [scannerOpen, setScannerOpen] = useState(false);
  const id = useId();
  const unit = baseUnitName(form);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  useEffect(() => {
    const fields = Object.keys(errors || {});
    if (fields.some(field => ['name', 'sku', 'barcode', 'category', 'marketplace_category_id', 'photo', 'online_description'].includes(field))) setStep(1);
    else if (fields.some(field => ['base_unit', 'purchase_unit', 'purchase_conversion_factor', 'cost', 'stock', 'low_stock_threshold'].includes(field))) setStep(2);
    else if (fields.some(field => field === 'price' || field.startsWith('prices'))) setStep(3);
  }, [errors]);
  const profile = <ProductReferenceProfile product={form} currency={currency} variant={editing ? 'inventory' : step === 3 ? 'new-price' : 'new'} onPhoto={editing && step === 3 ? () => setStep(1) : undefined} />;
  const photo = <ProductPhotoField referenceLayout={editing ? 'edit' : 'new'} photoUrl={form.photo_url} photoFile={form.photo_file} removed={form.remove_photo} error={errors.photo} onChange={file => setForm(current => ({ ...current, photo_file: file, remove_photo: false }))} onRemove={() => setForm(current => ({ ...current, photo_file: null, remove_photo: true }))} />;
  return <><form className={`mobile-product-form product-reference-form ${editing ? 'is-editing' : 'is-creating'} product-reference-step-${step}`} onSubmit={onSubmit} noValidate><fieldset className="product-reference-fields" disabled={saving}>
    {editing && step === 3 && profile}
    <nav className="product-wizard-progress" aria-label="Product form progress"><ol>{['Basic', 'Inventory', 'Prices'].map((label, index) => <li key={label} className={`${step === index + 1 ? 'is-current' : ''}${step > index + 1 ? ' is-complete' : ''}`}><Button variant="plain" type="button" aria-label={index === 0 ? 'Basic information' : index === 2 ? 'Selling price' : label} aria-current={step === index + 1 ? 'step' : undefined} disabled={index + 1 > step || saving} onClick={() => setStep(index + 1)}><span>{step > index + 1 && !(editing && step === 3) ? <Check size={15} /> : index + 1}</span><small>{!editing && step === 1 && index === 0 ? 'Basic information' : label}</small></Button></li>)}</ol></nav>
    {errors.general && <div className="mobile-notice mobile-notice--error" role="alert">{errors.general}</div>}
    <datalist id={`${id}-units`}>{['Unit', 'bag', 'bottle', 'box', 'carton', 'Piece', 'kg', 'litre'].map(value => <option key={value} value={value} />)}</datalist>
    {step === 1 && <div className="product-basic-layout">
      <section className="product-photo-panel">{photo}</section>
      <section className="product-basic-fields">
        <FormField label={<>Product name <em>*</em></>} error={errors.name}><Input aria-label="Product name" required maxLength={255} value={form.name} onChange={event => change('name', event.target.value)} placeholder="e.g. Premium Jasmine Rice" /></FormField>
        <FormField label="Category" error={errors.category}><Input list={`${id}-categories`} value={form.category} onChange={event => change('category', event.target.value)} placeholder="Choose or type category" /><datalist id={`${id}-categories`}>{categories.map(category => <option key={category} value={category} />)}</datalist></FormField>
        <MarketplaceCategorySelect form={form} error={errors.marketplace_category_id} onChange={value=>change('marketplace_category_id',value)} />
        <div className="product-code-fields"><FormField label="SKU" error={errors.sku}><Input value={form.sku} onChange={event => change('sku', event.target.value)} placeholder="Optional" /></FormField>
          <FieldShell className="mobile-field"><label htmlFor={`${id}-barcode`}>Barcode</label><InputGroup className="product-form-barcode-control"><Input id={`${id}-barcode`} inputMode="numeric" value={form.barcode} onChange={event => change('barcode', event.target.value)} placeholder="Scan or type" aria-invalid={Boolean(errors.barcode)} /><IconButton variant="ghost" type="button" aria-label="Scan barcode for product" aria-expanded={scannerOpen} onClick={() => setScannerOpen(true)}><ScanLine size={21} /></IconButton></InputGroup>{errors.barcode && <small className="mobile-field-error" role="alert">{errors.barcode}</small>}</FieldShell></div>
        {editing && <FormField label="Description (optional)" error={errors.online_description}><Textarea aria-label="Description (optional)" rows={3} maxLength={4000} value={form.online_description || ''} onChange={event => change('online_description', event.target.value)} placeholder="Describe this product" /></FormField>}
      </section>
    </div>}
    {step === 2 && <><h2 className="visually-hidden">Inventory</h2>{profile}
      <section className="product-reference-panel">
        <ProductUnitSetup form={form} setForm={setForm} editing={editing} errors={errors} />
      </section>
      <section className="product-reference-panel">
        <ProductStockCostFields form={form} setForm={setForm} editing={editing} errors={errors} currency={currency} />
      </section>
      <section className="product-reference-panel"><ProductUnitInput label={`Low-stock threshold (${unit})`} type="number" inputMode="decimal" step="0.001" min="0" value={form.low_stock_threshold} onChange={event => change('low_stock_threshold', event.target.value)} unit={unit} error={errors.low_stock_threshold} /></section>
    </>}
    {step === 3 && <><h2 className="visually-hidden">Selling price</h2>{!editing && profile}<p>Selling prices are per {unit}.</p><div className="product-reference-prices">{(form.prices || []).map((price, index) => {
      const rule = priceRules[String(price.name || '').toLowerCase()], automatic = price.is_manual === false;
      const setPrice = patch => setForm(current => ({ ...current, prices: current.prices.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }));
      return <section className={`product-reference-panel product-price-panel ${automatic ? 'is-automatic' : 'is-manual'}`} key={price.name}><header><h3>{`${price.name} ${editing ? 'price' : 'Price'}`}</h3><Select className="product-pricing-mode" aria-label={`${price.name} pricing mode`} value={automatic ? 'automatic' : 'manual'} disabled={saving} onChange={event => setPrice({ is_manual: event.target.value !== 'automatic' })}><option value="manual">Manual</option>{rule?.pricing_mode === 'automatic' && <option value="automatic">Automatic</option>}</Select></header><p>{automatic ? (editing ? 'Automatically calculated from cost with markup.' : 'Automatically calculated from cost with markup and rounding.') : editing ? 'Set the price customers pay in your shop.' : 'Set the selling price customers will see in your store.'}</p>
        {automatic ? <><div className="product-automatic-rules"><ProductUnitInput label="Markup on cost" value={rule?.markup_percent || 0} readOnly title="Configured in Settings - Prices" unit="%" /><ProductUnitInput label="Rounding" value={rule?.rounding || 1} readOnly title="Configured in Settings - Prices" unit={currency} /><small className="product-automatic-explanation">Automatically calculated using your configured pricing rules.</small></div><ProductUnitInput label={`Computed price (${currency})`} aria-label={`${price.name} price`} formatted value={automaticSellingPrice(form.cost, rule)} readOnly unit={`${currency}/${unit}`} /><div className="product-price-info"><Info size={17} /><span>{`${price.name} price is automatically calculated from your cost price using the markup and rounding above.`}</span></div></> : <><ProductUnitInput label={editing ? `Price (${currency})` : `${price.name} price`} aria-label={`${price.name} price`} formatted inputMode="numeric" value={price.price} onChange={event => setPrice({ price: event.target.value })} unit={`${currency}/${unit}`} error={errors[`prices.${index}.price`] || (index === 0 ? errors.price : '')} />{editing && <div className="product-price-info"><Info size={17} /><span>Manual price gives you full control to set what your customers see at the counter.</span></div>}</>}
      </section>;
    })}</div></>}
    <footer className="product-reference-actions">{step === 1 ? <Button variant="secondary" type="button" className="mobile-secondary" disabled={saving} onClick={onCancel}>{editing ? <><ChevronLeft size={18} />Previous</> : 'Cancel'}</Button> : <Button variant="secondary" type="button" className="mobile-secondary" disabled={saving} onClick={() => setStep(current => current - 1)}>{step === 3 && <ChevronLeft size={18} />}Previous</Button>}{step < 3 ? <Button variant="primary" key={`next-${step}`} type="button" className="mobile-primary" disabled={saving} onClick={() => setStep(current => current + 1)}>Continue<ChevronRight size={18} /></Button> : <Button variant="primary" key="save" type="submit" className="mobile-primary" disabled={saving}>{saving && <RefreshCw size={17} className="spin" />}{saving ? 'Saving…' : 'Save product'}</Button>}</footer>
  </fieldset></form><ProductBarcodeScanner open={scannerOpen} title="Scan barcode" description="Point the rear camera at the barcode. The scanned value will fill the Barcode field." onClose={() => setScannerOpen(false)} onDetected={barcode => { change('barcode', barcode); setScannerOpen(false); }} /></>;
}
