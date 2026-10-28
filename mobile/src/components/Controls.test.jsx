import React, { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, Checkbox, Field, IconButton, Input, InputGroup, Radio, SearchInput, Select, Switch, Textarea } from './Controls';

describe('reusable controls', () => {
  it('keeps secondary and icon actions from submitting; submits once through the form', () => {
    const submit = vi.fn(event => event.preventDefault()), cancel = vi.fn();
    render(<form onSubmit={submit}><Button onClick={cancel}>Cancel</Button><IconButton aria-label="Open menu">+</IconButton><Button variant="primary" type="submit">Save</Button></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it('disables busy actions and forwards form association and native refs', () => {
    const click = vi.fn(), ref = createRef();
    render(<Button ref={ref} variant="danger" busy onClick={click} form="delete-form">Delete</Button>);
    expect(ref.current).toBe(screen.getByRole('button'));
    expect(ref.current).toHaveAttribute('form', 'delete-form');
    expect(ref.current).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(ref.current);
    expect(click).not.toHaveBeenCalled();
  });

  it('connects label, hint, errors and existing descriptions without assigning IDs to a datalist', () => {
    render(<><p id="context">Shop currency</p><Field label="Amount" error="Enter an amount" hint="Use whole kyats"><Input id="amount" aria-describedby="context" inputMode="numeric" /><datalist data-testid="options" /></Field></>);
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('id', 'amount');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'context amount-hint amount-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount');
    expect(screen.getByTestId('options')).not.toHaveAttribute('id');
  });

  it('preserves controlled native inputs, selects, textareas and choice values', () => {
    const ref = createRef();
    function Form() {
      const [value, setValue] = useState(''), [option, setOption] = useState('all');
      return <><Input ref={ref} aria-label="Name" value={value} onChange={event => setValue(event.target.value)} /><Select aria-label="Category" value={option} onChange={event => setOption(event.target.value)}><option value="all">All</option><option value="food">Food</option></Select><Textarea aria-label="Notes" defaultValue="Draft" /><Checkbox aria-label="Active" defaultChecked /><Radio aria-label="Cash" name="method" value="cash" defaultChecked /></>;
    }
    render(<Form />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'မင်္ဂလာပါ' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'food' } });
    expect(ref.current).toHaveValue('မင်္ဂလာပါ');
    expect(screen.getByLabelText('Category')).toHaveValue('food');
    expect(screen.getByLabelText('Notes')).toHaveValue('Draft');
    expect(screen.getByLabelText('Active')).toBeChecked();
    expect(screen.getByLabelText('Cash')).toBeChecked();
  });

  it('clears search once, preserves input focus and does not submit the surrounding form', () => {
    const clear = vi.fn(), submit = vi.fn();
    function SearchForm() {
      const [value, setValue] = useState('Rice');
      return <form onSubmit={submit}><SearchInput aria-label="Search products" value={value} onChange={event => setValue(event.target.value)} onClear={() => { clear(); setValue(''); }} /></form>;
    }
    render(<SearchForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('keeps a switch label clickable and retains the native checked/disabled behavior', () => {
    const change = vi.fn();
    const { rerender } = render(<label>Accept orders<Switch onChange={change} defaultChecked /></label>);
    expect(screen.getByRole('switch', { name: 'Accept orders' })).toBeChecked();
    fireEvent.click(screen.getByRole('switch'));
    expect(change).toHaveBeenCalledOnce();
    expect(screen.getByRole('switch')).not.toBeChecked();
    rerender(<label>Accept orders<Switch onChange={change} disabled /></label>);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('connects a compound field label and validation to its nested native input', () => {
    render(<Field id="paid" label="Paid now" hint="Shop currency" error="Enter an amount"><InputGroup><Input inputMode="numeric" /><span>MMK</span></InputGroup></Field>);
    const input = screen.getByLabelText('Paid now');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'paid-hint paid-error');
  });
});
