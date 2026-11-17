import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { QuantityControl, ProductMedia, StatusBadge } from '../ShoppingComponents';
import { LocaleContext } from '../i18n';
afterEach(cleanup);

it('clamps quantity buttons to fractional inventory limits and never submits the parent form', () => {
  let submissions = 0;
  function Flow() {
    const [value, setValue] = useState('0.5');
    return <form onSubmit={e => { e.preventDefault(); submissions++; }}><QuantityControl label="Quantity" name="Rice" value={value} max={1.25} onChange={setValue} required /><button>Add</button></form>;
  }
  render(<Flow />);
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity: Rice' }));
  expect(screen.getByLabelText('Quantity')).toHaveValue(1.25);
  expect(screen.getByRole('button', { name: 'Increase quantity: Rice' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity: Rice' }));
  expect(screen.getByLabelText('Quantity')).toHaveValue(.25);
  fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity: Rice' }));
  expect(screen.getByLabelText('Quantity')).toHaveValue(.001);
  expect(screen.getByRole('button', { name: 'Decrease quantity: Rice' })).toBeDisabled();
  expect(submissions).toBe(0);
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0.375' } });
  expect(screen.getByLabelText('Quantity')).toHaveValue(.375);
});

it('disables quantity buttons for sold-out inventory and invalid input', () => {
  const view = render(<QuantityControl label="Quantity" name="Rice" value="1" max={0} onChange={() => {}} />);
  expect(screen.getByRole('button', { name: 'Increase quantity: Rice' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Decrease quantity: Rice' })).toBeDisabled();
  view.rerender(<QuantityControl label="Quantity" name="Rice" value="" max={10} onChange={() => {}} />);
  expect(screen.getByRole('button', { name: 'Increase quantity: Rice' })).toBeDisabled();
});

it('recovers from a broken product image when the source changes', () => {
  const view = render(<ProductMedia src="/broken.png" name="Rice" />);
  fireEvent.error(screen.getByRole('img', { name: 'Rice' }));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  view.rerender(<ProductMedia src="/replacement.png" name="Rice" />);
  expect(screen.getByRole('img', { name: 'Rice' })).toHaveAttribute('src', '/replacement.png');
});

it('keeps underscore status translations available in Myanmar', () => {
  render(<LocaleContext.Provider value="my"><StatusBadge value="proof_submitted" payment /></LocaleContext.Provider>);
  expect(screen.getByText('အထောက်အထားတင်ပြီး')).toBeInTheDocument();
});
