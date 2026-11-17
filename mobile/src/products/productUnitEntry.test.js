import { describe, expect, it } from 'vitest';
import { updateProductUnitEntry } from './productUnitEntry';

const product = { base_unit: 'Piece', purchase_unit: 'Carton', purchase_conversion_factor: 12, cost: 1000, stock: 24 };

describe('product unit entry', () => {
  it('converts purchase entries to canonical stock units', () => {
    let form = updateProductUnitEntry(product, { _stock_purchase: true, _cost_purchase: true });
    expect(form._stock_entry).toBe(2);
    expect(form._cost_entry).toBe(12000);
    form = updateProductUnitEntry(form, { _stock_entry: '3', _cost_entry: '24000' });
    expect(form.stock).toBe(36);
    expect(form.cost).toBe(2000);
  });
  it('preserves canonical values through repeated display-unit switches', () => {
    let form = { ...product, stock: 1, cost: 7 };
    for (let i = 0; i < 10; i++) {
      form = updateProductUnitEntry(form, { _stock_purchase: true, _cost_purchase: true });
      form = updateProductUnitEntry(form, { _stock_purchase: false, _cost_purchase: false });
    }
    expect(form.stock).toBe(1);
    expect(form.cost).toBe(7);
  });
  it('recalculates purchase entries when the pack size changes', () => {
    let form = updateProductUnitEntry(product, { _stock_purchase: true, _cost_purchase: true });
    form = updateProductUnitEntry(form, { purchase_conversion_factor: 24 });
    expect(form.stock).toBe(48);
    expect(form.cost).toBe(500);
  });
  it('keeps canonical values when purchase-unit entry is removed', () => {
    const form = updateProductUnitEntry(updateProductUnitEntry(product, { _stock_purchase: true, _cost_purchase: true }), { purchase_unit: '', purchase_conversion_factor: 1 });
    expect(form.stock).toBe(24);
    expect(form.cost).toBe(1000);
    expect(form._stock_entry).toBe(24);
    expect(form._cost_entry).toBe(1000);
    expect(form._cost_purchase).toBe(false);
  });
  it('supports single-unit input and empty input without stale canonical values', () => {
    let form = updateProductUnitEntry({ cost: 0, stock: 0 }, { _stock_entry: '2.5', _cost_entry: '100' });
    expect(Number(form.stock)).toBe(2.5);
    expect(Number(form.cost)).toBe(100);
    form = updateProductUnitEntry(form, { _stock_entry: '', _cost_entry: '' });
    expect(form.stock).toBe('');
    expect(form.cost).toBe('');
  });
  it('rounds fractional stock and whole-currency cost consistently with the API', () => {
    let form = updateProductUnitEntry(product, { _stock_purchase: true, _cost_purchase: true });
    form = updateProductUnitEntry(form, { _stock_entry: '0.3333', _cost_entry: '1000' });
    expect(form.stock).toBe(4);
    expect(form.cost).toBe(83);
  });
});
