import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrinterInput } from './PrinterInput';

const printers = ['Microsoft Print to PDF', 'Adobe PDF', 'XP-58C', 'escpos://127.0.0.1:9100'];
function Fixture({ onRefresh }) {
  const [value, setValue] = useState(printers[0]);
  return <PrinterInput label="Printer Name" value={value} onChange={setValue} printers={printers} onRefresh={onRefresh} />;
}

describe('PrinterInput', () => {
  it('shows all printers on focus regardless of the saved name and selects without clearing first', () => {
    const refresh = vi.fn();
    render(<Fixture onRefresh={refresh} />);
    const input = screen.getByRole('combobox', { name: 'Printer Name' });
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(refresh).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('option', { name: printers[3] }));
    expect(input).toHaveValue(printers[3]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('filters only while typing, supports keyboard selection and keeps custom addresses', () => {
    render(<Fixture />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'XP' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('XP-58C');
    fireEvent.change(input, { target: { value: 'escpos://localhost:9200' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('escpos://localhost:9200');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(4);
    fireEvent.blur(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
