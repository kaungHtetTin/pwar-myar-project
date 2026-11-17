import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductUnitSetup, ProductStockCostFields } from './ProductUnitFields';

function Editor({ editing = false }) {
  const [form, setForm] = useState({ base_unit: 'Piece', purchase_unit: '', purchase_conversion_factor: 1, cost: 0, stock: 0 });
  return <><ProductUnitSetup form={form} setForm={setForm} editing={editing} /><ProductStockCostFields form={form} setForm={setForm} editing={editing} /><output aria-label="Stored values">{form.stock}|{form.cost}</output></>;
}

describe('product unit fields', () => {
  it('shows a pack equation and the actual stored cost and stock', () => {
    render(<Editor />);
    expect(screen.queryByLabelText('Purchase unit')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Buy in a different unit?' }));
    fireEvent.change(screen.getByLabelText('Purchase unit'), { target: { value: 'Carton' } });
    fireEvent.change(screen.getByLabelText('How many Piece in 1 Carton?'), { target: { value: '12' } });
    expect(screen.getByText('1 Carton = 12 Piece')).toHaveTextContent('1 Carton = 12 Piece');
    fireEvent.change(screen.getByLabelText('Stock entry unit'), { target: { value: 'purchase' } });
    fireEvent.change(screen.getByLabelText('Cost entry unit'), { target: { value: 'purchase' } });
    fireEvent.change(screen.getByLabelText('Opening stock (Carton)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Purchase cost per Carton (Ks)'), { target: { value: '12000' } });
    expect(screen.getByLabelText('Stored values')).toHaveTextContent('24|1000');
    fireEvent.change(screen.getByLabelText('Cost entry unit'), { target: { value: 'base' } });
    expect(screen.getByLabelText('Purchase cost per Piece (Ks)')).toHaveValue(1000);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Buy in a different unit?' }));
    expect(screen.getByLabelText('Opening stock (Piece)')).toHaveValue(24);
    expect(screen.getByLabelText('Stored values')).toHaveTextContent('24|1000');
  });
  it('protects the stock unit on existing products', () => {
    render(<Editor editing />);
    expect(screen.getByLabelText('Stock unit')).toHaveAttribute('readonly');
  });
});
