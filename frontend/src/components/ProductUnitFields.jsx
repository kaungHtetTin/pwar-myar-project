import React, { useId } from 'react';
import { baseUnitName, hasPurchaseUnit } from '../productUnits';
import { updateProductUnitEntry } from '../productUnitEntry';
import { formatQuantity } from '../utils';

function UnitField({ label, hint, error, children }) {
  const id = useId();
  return <div className="product-unit-entry-field field"><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id, 'aria-describedby': `${id}-help`, 'aria-invalid': Boolean(error) })}<small id={`${id}-help`}>{hint}{error && <span role="alert">{error}</span>}</small></div>;
}

export function ProductUnitSetup({ form, setForm, editing, errors = {}, stockOnly = false, compact = false }) {
  const id = useId();
  const unit = baseUnitName(form);
  const change = patch => setForm(current => updateProductUnitEntry(current, patch));
  const buyDifferent = Boolean(form._buy_different || form.purchase_unit);
  return <div className="product-unit-entry">
    <UnitField label="Stock unit" error={errors.base_unit} hint={editing ? 'Stock unit is fixed for existing products to preserve stock, costs and history.' : compact ? undefined : 'The unit used to count inventory and set selling prices.'}>
      <input value={form.base_unit || ''} readOnly={Boolean(editing)} onChange={event => change({ base_unit: event.target.value })} placeholder="e.g. Piece" />
    </UnitField>
    {!stockOnly && <>
      <label className="product-unit-toggle"><input type="checkbox" checked={buyDifferent || Boolean(form.purchase_unit)} onChange={event => { change(event.target.checked ? { _buy_different: true } : { _buy_different: false, purchase_unit: '', purchase_conversion_factor: 1 }); }} />Buy in a different unit?</label>
      {(buyDifferent || Boolean(form.purchase_unit)) && <>
        <UnitField label="Purchase unit" hint={compact ? undefined : "The larger pack you buy from your supplier."} error={errors.purchase_unit}><input value={form.purchase_unit || ''} onChange={event => change({ purchase_unit: event.target.value })} placeholder="e.g. Carton" required /></UnitField>
        <UnitField label={`How many ${unit} in 1 ${form.purchase_unit || 'purchase unit'}?`} hint={compact ? undefined : "Enter the number of stock units in one purchase pack."} error={errors.purchase_conversion_factor}><input type="number" min="1.001" max="1000000" step="0.001" required value={form.purchase_conversion_factor} onChange={event => change({ purchase_conversion_factor: event.target.value })} /></UnitField>
        {hasPurchaseUnit(form) && <p id={`${id}-equation`} role="status">1 {form.purchase_unit} = {formatQuantity(form.purchase_conversion_factor)} {unit}</p>}
      </>}
    </>}
  </div>;
}

export function ProductStockCostFields({ form, setForm, editing, errors = {}, currency = 'Ks', compact = false }) {
  const unit = baseUnitName(form);
  const change = patch => setForm(current => updateProductUnitEntry(current, patch));
  return <div className="product-unit-entry">
    {['stock', 'cost'].map(field => {
      const purchase = Boolean(form[`_${field}_purchase`]) && hasPurchaseUnit(form);
      const entryUnit = purchase ? form.purchase_unit : unit;
      const value = form[`_${field}_entry`] ?? form[field];
      return <div className="product-unit-entry" key={field}>
        {hasPurchaseUnit(form) && <UnitField label={field === 'stock' ? 'Stock entry unit' : 'Cost entry unit'}><select value={purchase ? 'purchase' : 'base'} onChange={event => change({ [`_${field}_purchase`]: event.target.value === 'purchase' })}><option value="base">{unit}</option><option value="purchase">{form.purchase_unit}</option></select></UnitField>}
        <UnitField label={field === 'stock' ? `${editing ? 'Current' : 'Opening'} stock (${entryUnit})` : `Purchase cost per ${entryUnit} (${currency})`} error={errors[field]} hint={compact && !purchase ? undefined : field === 'stock' ? `Stock: ${formatQuantity(form.stock)} ${unit}` : `Stored cost: ${Number(form.cost || 0).toLocaleString()} ${currency} per ${unit}${purchase ? ' (rounded to whole currency units)' : ''}`}>
          <input type="number" inputMode="decimal" min="0" step={field === 'stock' ? 'any' : '1'} value={value ?? ''} onChange={event => change({ [`_${field}_entry`]: event.target.value })} />
        </UnitField>
      </div>;
    })}
  </div>;
}
