import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { InputGroup, Button, FieldShell, IconButton, Input, Select } from '../components/Controls';
import React from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Printer, Edit3, Store, Package, Milk, Info } from 'lucide-react';
import { backSourcePath } from '../navigation/historyNavigation';

import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { ProductUnitInput } from '../products/ProductReferenceParts';
import { baseUnitName, formatQuantity, money } from '../products/productUtils';
import { itemCostWarnings, purchaseUnitOptions } from './purchaseUtils';

function displayUnit(unit, quantity) {
  if (Number(quantity) === 1) return unit;
  return { bag: 'bags', bottle: 'bottles', carton: 'cartons', box: 'boxes' }[String(unit).toLowerCase()] || unit;
}

export function PurchaseDateInput({ value, onChange, ...props }) {
  const label = value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date';
  return <InputGroup className="purchase-date-input"><span aria-hidden="true">{label}</span><CalendarDays size={17} aria-hidden="true" /><Input {...props} type="date" value={value || ''} onChange={onChange} onClick={event => { event.stopPropagation(); try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard entry remains available. */ } }} /></InputGroup>;
}

export function PurchaseReferenceHeader({ actions, title, onBack, onPrint }) {

  return <PageAppBar className="retail-sale-header purchase-reference-header">{onBack && <IconButton variant="ghost" type="button" aria-label={`Back to ${backSourcePath('/purchases').slice(1).split('/')[0]}`} onClick={onBack}><ChevronLeft size={26} /></IconButton>}<h1>{title}</h1>{onPrint && <IconButton variant="ghost" type="button" aria-label="Print purchase" onClick={onPrint}><Printer size={20} /></IconButton>}{actions}<AppBarMenu /></PageAppBar>;
}

export function PurchaseReferenceProgress({ step, onStep, editing, saving, warning }) {
  const labels = ['Basic information', 'Select products', 'Quantities and costs', 'Review and submit'];
  return <nav className={`purchase-wizard-progress purchase-reference-progress${step === 4 && !warning ? ' is-review' : ''}${warning ? ' is-warning' : ''}`} aria-label="Purchase form progress">{labels.map((label, index) => <Button variant="plain" type="button" key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'completed' : ''} aria-label={label} aria-current={step === index + 1 ? 'step' : undefined} disabled={index + 1 > step || saving} onClick={() => onStep(index + 1)}><span>{step > index + 1 && (step !== 4 || warning) ? <Check size={15} /> : index + 1}</span><strong>{warning ? ['Basic information', 'Select products', 'Quantities and costs', 'Review and submit'][index] : !editing && step === 1 ? ['Basic information', 'Select products', 'Quantities and costs', 'Review and submit'][index] : !editing && step === 3 ? ['Supplier', 'Products', 'Costs', 'Payment'][index] : !editing && step === 4 ? ['Supplier & reference', 'Products', 'Quantity & cost', 'Review'][index] : ['Basic', 'Products', 'Costs', 'Review'][index]}</strong></Button>)}</nav>;
}

export function PurchaseSupplierSummary({ name, supplier, onChange, onOpen, date, reference }) {
  const content = <><span className="purchase-supplier-icon"><Store size={23} /></span><div><strong data-no-localize>{name || 'Not specified'}</strong><small>Supplier</small>{supplier?.phone && <small data-no-localize>{supplier.phone}</small>}{supplier?.address && <small data-no-localize>{supplier.address}</small>}{date && <time><CalendarDays size={14} />{/^\d{4}-\d{2}-\d{2}/.test(date) ? new Date(date.replace(' ', 'T')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : date}</time>}</div></>;
  return <section className="purchase-supplier-summary">{onOpen ? <Button variant="plain" className="purchase-supplier-open" type="button" onClick={onOpen} aria-label={`View supplier ${name}`}>{content}<ChevronRight size={19} /></Button> : content}{onChange && !reference && <Button variant="secondary" className="mobile-secondary" type="button" onClick={onChange}>Change</Button>}{reference && <Button variant="plain" type="button" className="purchase-reference-number" onClick={onChange} aria-label="Edit purchase reference"><span data-no-localize>{reference.replace(/^([A-Za-z]+)(\d+)$/, '$1-$2')}</span><Edit3 size={12} /></Button>}</section>;
}

export function PurchaseReferenceLine({ item, currency, editing, onChange, onUnitChange }) {
  const key = `${item.product_id}:${item.unit_name}`, base = baseUnitName(item.product), factor = Number(item.conversion_factor || 1);
  const received = (Number(item.quantity || 0) + Number(item.foc_quantity || 0)) * factor;
  const plural = (name, count) => Number(count) === 1 ? name : ({ bag: 'bags', bottle: 'bottles', carton: 'cartons', box: 'boxes' }[name.toLowerCase()] || name);
  const effective = Number(item.effective_unit_cost || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const warnings = itemCostWarnings(item);
  return <article className="purchase-reference-line">
    <header><span className="purchase-line-photo">{item.product?.photo_url ? <ProductPhoto path={item.product.photo_url} /> : <Store size={24} />}</span><div><h3 data-no-localize>{item.product_name}</h3><small data-no-localize>{item.product?.sku || item.unit_name}</small></div></header>
    <div className="purchase-line-fields"><FieldShell as="label" className="mobile-field"><span>Buying unit</span><Select aria-label={`Buying unit for ${item.product_name}`} value={item.unit_name} onChange={event => onUnitChange(key, event.target.value)}>{purchaseUnitOptions(item.product || { base_unit: item.unit_name }).map(unit => <option key={unit.name} value={unit.name}>{unit.name.charAt(0).toUpperCase() + unit.name.slice(1)}</option>)}</Select></FieldShell><ProductUnitInput label="Conversion" value={`1 ${item.unit_name} = ${formatQuantity(factor)} ${base}`} readOnly />
      <ProductUnitInput label="Paid quantity" aria-label={`Quantity for ${item.product_name}`} type="number" min="0.001" step="0.001" value={item.quantity} onChange={event => onChange(key, { quantity: event.target.value })} unit={plural(item.unit_name, item.quantity)} />
      <ProductUnitInput label="FOC quantity" aria-label={`FOC for ${item.product_name}`} type="number" min="0" step="0.001" value={item.foc_quantity === '' ? '' : Number(item.foc_quantity || 0) * factor} onChange={event => onChange(key, { foc_quantity: event.target.value === '' ? '' : Number(event.target.value) / factor })} unit={base} />
      <ProductUnitInput label={`Unit cost (per ${item.unit_name})`} aria-label={`Cost for ${item.product_name}`} formatted inputMode="numeric" value={item.unit_cost} onChange={event => onChange(key, { unit_cost: event.target.value })} unit={currency} />
      <ProductUnitInput label="Line total" formatted value={item.line_total} readOnly unit={currency} />
    </div><div className="purchase-line-results"><ProductUnitInput label="Received quantity (total)" value={formatQuantity(received)} readOnly unit={plural(base, received)} /><ProductUnitInput label={`Effective unit cost (per ${base})`} value={effective} readOnly unit={currency} /></div>
    {editing && <p className="purchase-impact"><Info size={16} /><span>Received stock: +{formatQuantity(received)} {base}. Purchase expense: {money(item.line_total, currency)}.</span></p>}
    {warnings.length > 0 && <p className="purchase-cost-warning" role="status">Selling price below cost: {warnings.map(warning => warning.name).join(', ')}</p>}
  </article>;
}

export function PurchaseReferenceItems({ items, currency, detail = false }) {
  return <section className="purchase-reference-panel purchase-reference-review-items"><h2>{detail ? `Items (${items.length})` : `Products (${items.length} items)`}</h2>{items.map((item, index) => {
    const base = baseUnitName(item.product || { base_unit: item.base_unit || 'Unit' });
    const received = item.base_quantity !== undefined ? Number(item.base_quantity || 0) + Number(item.base_foc_quantity || 0) : (Number(item.quantity || 0) + Number(item.foc_quantity || 0)) * Number(item.conversion_factor || 1);
    return <article key={item.id || `${item.product_id}-${index}`}><span className={`purchase-review-photo${detail ? ' purchase-detail-item-icon' : ''}`}>{detail ? (base.toLowerCase().includes('bottle') ? <Milk size={23} /> : <Package size={23} />) : item.product?.photo_url ? <ProductPhoto path={item.product.photo_url} /> : <Store size={22} />}</span><div><h3 data-no-localize>{item.product_name}</h3>{detail && <p data-no-localize>{formatQuantity(item.base_quantity ?? Number(item.quantity) * Number(item.conversion_factor || 1))} paid {base} + {formatQuantity(item.base_foc_quantity ?? Number(item.foc_quantity || 0) * Number(item.conversion_factor || 1))} FOC {base}</p>}{!detail && <><small>Received {formatQuantity(received)} {displayUnit(base, received)}</small><small>{Number(item.effective_unit_cost ?? item.unit_cost).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency} per {base}</small></>}</div><div className="purchase-review-line-total">{detail && <><small>{money(item.unit_cost, currency)}</small><small>× {formatQuantity(item.quantity)} {item.unit_name}</small></>}<strong>{money(item.line_total, currency)}</strong>{!detail && <small>{formatQuantity(received)} {displayUnit(base, received)} <span aria-hidden="true">&times;</span> {Number(item.effective_unit_cost ?? item.unit_cost).toLocaleString('en-US', { maximumFractionDigits: 0 })}</small>}</div></article>;
  })}</section>;
}
