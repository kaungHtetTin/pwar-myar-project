import React, { useCallback, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Tag, Trash2 } from 'lucide-react';
import { Field, Modal } from '../components/common';
import { FlashSaleProductPicker } from './FlashSaleProductPicker';

const steps = ['Event & schedule', 'Products', 'Discount & limits', 'Review'];
const unitName = product => product.unit === 'purchase' ? product.purchase_unit || 'Purchase unit' : product.base_unit || 'Base unit';
const saleItem = (product, defaults) => ({ ...product, discount_type: defaults.discount_type || 'percentage', discount_value: defaults.discount_value ?? '', quantity_limit: defaults.quantity_limit ?? '' });
function scheduleDefaults(initial, timezone) {
  if (initial.id) return initial;
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  return { ...initial, starts_at: initial.starts_at || `${date}T00:00`, ends_at: initial.ends_at || `${date}T23:59` };
}

export function FlashSaleWizard({ initial, timezone, currency, loadProducts, loadCategories, working, error, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...scheduleDefaults(initial, timezone), products: initial.product_id ? [saleItem({ id: initial.product_id, name: initial.product_name, unit: initial.unit }, initial)] : [] }));
  const [step, setStep] = useState(1), [validation, setValidation] = useState(''), [pickerBusy, setPickerBusy] = useState(false), [checking, setChecking] = useState(false);
  const formRef = useRef(null);
  const busy = working || pickerBusy || checking, used = Number(form.used_count) > 0;
  const scheduleKey = JSON.stringify([form.starts_at, form.ends_at, form.enabled, form.id]);
  const loadPickerProducts = useCallback((q, options) => loadProducts(q, { ...options, flash_sale_picker: 1, flash_sale_enabled: form.enabled ? 1 : 0, flash_sale_starts_at: form.starts_at || '', flash_sale_ends_at: form.ends_at || '', flash_sale_exclude_id: form.id }), [loadProducts, form.enabled, form.starts_at, form.ends_at, form.id]);
  const field = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const updateProduct = (id, changes) => setForm(current => ({ ...current, products: current.products.map(product => product.id === id ? { ...product, ...changes } : product) }));
  function toggleProducts(products, selected) {
    if (busy || used) return;
    const ids = new Set(products.map(product => Number(product.id)));
    const kept = form.products.filter(product => !ids.has(Number(product.id)));
    const existing = new Map(form.products.map(product => [Number(product.id), product]));
    const next = selected ? [...kept, ...products.map(product => existing.get(Number(product.id)) || saleItem(product, initial))] : kept;
    if (next.length > 100) { setValidation('Select up to 100 products. Narrow your filters or deselect some products.'); return; }
    setValidation('');
    setForm(current => ({ ...current, products: current.id && selected ? [next.at(-1)] : next }));
  }
  async function next(event) {
    event.preventDefault();
    if (busy || !formRef.current.reportValidity()) return;
    if (step === 1 && !form.name.trim()) { setValidation('Enter a promotion name.'); return; }
    if (step === 1 && form.starts_at && form.ends_at && form.ends_at <= form.starts_at) { setValidation('End time must be later than start time.'); return; }
    if (step >= 2 && !form.products.length) { setValidation('Choose at least one product.'); if (step > 2) setStep(2); return; }
    if (step === 2) {
      setChecking(true);
      try {
        const result = await loadPickerProducts('', { limit: 100, flash_sale_product_ids: form.products.map(product => product.id) });
        const conflicts = (result.items || result).filter(product => product.flash_sale_conflict);
        if (conflicts.length) { setValidation(`Already in an overlapping flash sale: ${conflicts.map(product => product.name).join(', ')}. Remove these products or change the schedule.`); return; }
      } catch (error) { setValidation(error.message); return; }
      finally { setChecking(false); }
    }
    setValidation('');
    if (step < 4) setStep(current => current + 1);
    else {
      const first = form.products[0];
      const items = form.products.map(product => ({ product_id: product.id, discount_type: product.discount_type, discount_value: Number(product.discount_value), quantity_limit: product.quantity_limit === '' ? null : Number(product.quantity_limit) }));
      onSave(event, { ...form, product_id: first.id, discount_type: first.discount_type, discount_value: first.discount_value, quantity_limit: first.quantity_limit, items: form.id ? undefined : items });
    }
  }
  const goBack = target => { if (!busy) { setValidation(''); setStep(target); } };
  function tableKey(event) {
    if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key) || !event.target.matches('input')) return;
    const cell = event.target.closest('td'), row = cell?.parentElement;
    const targetRow = event.key === 'ArrowUp' ? row?.previousElementSibling : row?.nextElementSibling;
    const target = targetRow?.children[cell.cellIndex]?.querySelector('input,select');
    event.preventDefault();
    if (target) { target.focus(); target.select?.(); }
  }
  const remove = product => <button type="button" className="icon-btn danger purchase-remove-item" disabled={used || busy} aria-label={`Remove ${product.name}`} onClick={() => toggleProducts([product], false)}><Trash2 size={14} /></button>;
  return <Modal open title={`${form.id ? 'Edit' : 'Add'} flash sale`} busy={busy} onClose={onClose}
    className="purchase-create-modal shop-flash-sale-wizard"
    headerContent={<nav className="purchase-wizard-steps purchase-wizard-header-tabs" aria-label="Flash sale form progress">{steps.map((label, index) => <button key={label} type="button" disabled={busy || index + 1 > step} className={index + 1 === step ? 'active' : index + 1 < step ? 'completed' : ''} aria-current={index + 1 === step ? 'step' : undefined} onClick={() => goBack(index + 1)}><span>{index + 1 < step ? <Check size={15} /> : index + 1}</span><strong>{label}</strong></button>)}</nav>}
    footer={<div className="purchase-wizard-footer purchase-wizard-footer--modal"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><span>Step {step} of 4</span><div>{step > 1 && <button type="button" disabled={busy} onClick={() => goBack(step - 1)}><ChevronLeft size={16} /> Previous</button>}<button type="submit" form="flash-sale-form" className="primary" disabled={busy}>{step === 4 ? <><Tag size={16} />{working ? 'Saving...' : 'Save promotion'}</> : <>Continue <ChevronRight size={16} /></>}</button></div></div>}>
    <form ref={formRef} id="flash-sale-form" className="shop-promotion-form shop-flash-form" onSubmit={next}><fieldset disabled={busy}>
      {(validation || error) && <p role="alert" className="shop-flash-error">{validation || error}</p>}
      {step === 1 && <section className="purchase-wizard-section shop-flash-event-step" aria-label="Event and schedule">
        <Field label="Promotion name"><input required maxLength={255} value={form.name} onChange={event => field('name', event.target.value)} /></Field>
        <div className="shop-promotion-grid"><Field label="Start time (optional)"><input type="datetime-local" value={form.starts_at} onChange={event => field('starts_at', event.target.value)} /></Field><Field label="End time (optional)"><input type="datetime-local" value={form.ends_at} onChange={event => field('ends_at', event.target.value)} /></Field></div>
        <p className="shop-cell-meta">Shop time: {timezone}. Blank dates have no boundary. A product cannot belong to overlapping enabled flash sales.</p>
        <label className="shop-checkbox"><input type="checkbox" checked={form.enabled} onChange={event => field('enabled', event.target.checked)} />Enabled</label>
      </section>}
      <FlashSaleProductPicker active={step === 2} contextKey={scheduleKey} selected={form.products} locked={used} single={Boolean(form.id)} working={working || checking} loadProducts={loadPickerProducts} loadCategories={loadCategories} onToggle={(product, selected) => toggleProducts([product], selected)} onBulk={toggleProducts} onBusy={setPickerBusy} />
      {step === 3 && <section className="purchase-wizard-section purchase-quantity-step shop-flash-discount-step" aria-label="Discount and quantity form">
        <div className="purchase-wizard-table-wrap"><table className="purchase-wizard-quantity-table shop-flash-discount-table" aria-label="Flash sale discounts" onKeyDown={tableKey}>
          <colgroup><col style={{ width: '29%' }} /><col style={{ width: '15%' }} /><col style={{ width: '19%' }} /><col style={{ width: '15%' }} /><col style={{ width: '17%' }} /><col className="table-action-column" /></colgroup>
          <thead><tr><th>Product</th><th>Online unit</th><th>Discount type</th><th>Discount</th><th>Quantity limit</th><th>Actions</th></tr></thead>
          <tbody>{form.products.map(product => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{unitName(product)}</td><td><select aria-label={`${product.name} discount type`} value={product.discount_type} onChange={event => updateProduct(product.id, { discount_type: event.target.value })}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount ({currency})</option></select></td><td><input aria-label={`${product.name} discount ${product.discount_type === 'percentage' ? '(%)' : `(${currency})`}`} required type="number" min="1" step="1" max={product.discount_type === 'percentage' ? 99 : 1000000000} value={product.discount_value} onChange={event => updateProduct(product.id, { discount_value: event.target.value })} /></td><td><input aria-label={`${product.name} quantity limit`} type="number" min={Math.max(0.001, Number(form.used_quantity) || 0)} max="1000000" step="0.001" placeholder="Unlimited" value={product.quantity_limit} onChange={event => updateProduct(product.id, { quantity_limit: event.target.value })} /></td><td>{remove(product)}</td></tr>)}</tbody>
        </table></div>
        <div className="purchase-wizard-totals"><span>Products <strong>{form.products.length}</strong></span><span>Each row uses its online unit. Blank limits are unlimited.</span><span>A discount keeps at least 1 {currency} payable.</span></div>
      </section>}
      {step === 4 && <section className="purchase-wizard-section shop-flash-review" aria-label="Review flash sale">
        <div className="shop-flash-review-details"><h3>{form.name}</h3><dl><dt>Schedule ({timezone})</dt><dd>{form.starts_at?.replace('T', ' ') || 'Starts immediately'} to {form.ends_at?.replace('T', ' ') || 'No end time'}</dd><dt>Status</dt><dd>{form.enabled ? 'Enabled' : 'Paused'}</dd></dl><h4>{form.products.length} selected product{form.products.length === 1 ? '' : 's'}</h4></div>
        <div className="purchase-wizard-table-wrap"><table className="purchase-review-table shop-flash-review-table" aria-label="Review product discounts"><thead><tr><th>Product</th><th>Online unit</th><th>Discount</th><th>Quantity limit</th></tr></thead><tbody>{form.products.map(product => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{unitName(product)}</td><td>{product.discount_value}{product.discount_type === 'percentage' ? '%' : ` ${currency}`} off</td><td>{product.quantity_limit || 'Unlimited'}</td></tr>)}</tbody></table></div>
        <p className="shop-cell-meta">Saving checks every product for overlapping enabled flash sales. If any product conflicts, nothing is saved.</p>
      </section>}
    </fieldset></form>
  </Modal>;
}
