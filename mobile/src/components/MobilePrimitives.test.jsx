import React, { useState } from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileDeleteSheet, MobileFilterResetButton, MobileFilterActions, MobileFilterPanel, MobileFilterToggle, MobileSheet } from './MobilePrimitives';
import { PageActivityContext } from '../navigation/pageRefresh';

describe('shared mobile filters', () => {
  it.each(['shared actions', 'custom actions'])('resets and closes %s, restores trigger focus and does not submit', async kind => {
    const submit = vi.fn(), reset = vi.fn();
    function Filters() {
      const [open, setOpen] = useState(false), [applied, setApplied] = useState('Food');
      const clear = () => { reset(); setApplied('All'); };
      return <><output>{applied}</output><MobileFilterToggle open={open} controls="reset-filters" onToggle={() => setOpen(true)} /><MobileFilterPanel open={open} id="reset-filters" onClose={() => setOpen(false)} onSubmit={submit}>
        {kind === 'shared actions' ? <MobileFilterActions onClear={clear} /> : <div className="product-filter-actions"><MobileFilterResetButton onClick={clear}>Reset</MobileFilterResetButton><button type="submit">Apply</button></div>}
      </MobileFilterPanel></>;
    }
    render(<Filters />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    trigger.focus(); fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(reset).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('keeps the drawer open when an asynchronous reset cannot safely apply', async () => {
    const close = vi.fn();
    render(<MobileFilterPanel open id="failed-reset" onClose={close}><MobileFilterActions onClear={async () => false} /></MobileFilterPanel>);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(close).not.toHaveBeenCalled();
  });

  it('restores the declared opener after a Safari-style tap that did not focus it', async () => {
    function Filters() {
      const [open, setOpen] = useState(false);
      return <><MobileFilterToggle open={open} controls="touch-filters" onToggle={() => setOpen(true)} /><MobileFilterPanel id="touch-filters" open={open} onClose={() => setOpen(false)}><MobileFilterActions onClear={() => {}} /></MobileFilterPanel></>;
    }
    render(<Filters />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(trigger).not.toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
  it('shares the drawer header and pinned footer with import and barcode flows', () => {
    render(<MobileFilterPanel open as="div" id="import-review" title="Import review" description="products.csv" onClose={vi.fn()} footer={<div><button type="button">Cancel import</button></div>}><p>Review rows</p></MobileFilterPanel>);
    const dialog = screen.getByRole('dialog', { name: 'Import review' });
    expect(within(dialog).getByText('products.csv')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Import review' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Cancel import' }).closest('footer')).toHaveClass('mobile-filter-drawer-footer');
  });
  it('connects the consistent toggle to its expanded panel and actions', () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    render(<><MobileFilterToggle open onToggle={onToggle} controls="test-filters" /><MobileFilterPanel open id="test-filters" onSubmit={(event) => event.preventDefault()}><label>Category<input /></label><MobileFilterActions onClear={onClear} /></MobileFilterPanel></>);
    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'test-filters');
    expect(screen.getByRole('dialog', { name: 'Filters' })).toContainElement(document.querySelector('#test-filters'));
    expect(document.querySelector('#test-filters')).toHaveClass('mobile-filter-drawer');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('traps focus, dismisses without applying and resumes the same draft and source content', async () => {
    const apply = vi.fn(), reset = vi.fn();
    function Filters() {
      const [open, setOpen] = useState(false), [draft, setDraft] = useState('');
      return <><p>Retained list</p><MobileFilterToggle open={open} onToggle={() => setOpen(true)} controls="draft-filters" /><MobileFilterPanel open={open} onClose={() => setOpen(false)} id="draft-filters" onSubmit={event => { event.preventDefault(); apply(draft); setOpen(false); }}><label>Category<input value={draft} onChange={event => setDraft(event.target.value)} /></label><MobileFilterActions onClear={() => { reset(); setDraft(''); }} /></MobileFilterPanel></>;
    }
    render(<Filters />);
    const source = screen.getByText('Retained list');
    const trigger = screen.getByRole('button', { name: 'Filters' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    const close = within(dialog).getByRole('button', { name: 'Close filters' });
    const heading = within(dialog).getByRole('heading', { name: 'Filters' });
    expect(heading).toHaveFocus();
    expect(close).not.toHaveFocus();
    fireEvent.keyDown(heading, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveFocus();
    heading.focus();
    fireEvent.keyDown(heading, { key: 'Tab' });
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Drinks' } });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(trigger).toHaveFocus();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.getByLabelText('Category')).toHaveValue('Drinks');
    expect(screen.getByText('Retained list')).toBe(source);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(reset).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByLabelText('Category')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(apply).toHaveBeenCalledExactlyOnceWith('Food');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each(['Close filters', 'Dismiss filters', 'hardware Back', 'browser Back', 'native cancel'])('closes using %s without submitting', method => {
    const close = vi.fn(), submit = vi.fn();
    render(<MobileFilterPanel open onClose={close} id="dismiss-filters" onSubmit={submit}><input aria-label="Draft" /><MobileFilterActions onClear={vi.fn()} /></MobileFilterPanel>);
    if (method === 'hardware Back') {
      const event = new CustomEvent('mkpos:hardware-back', { cancelable: true });
      fireEvent(window, event);
      expect(event.defaultPrevented).toBe(true);
    } else if (method === 'browser Back') fireEvent.popState(window);
    else if (method === 'native cancel') fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    else fireEvent.click(screen.getByRole('button', { name: method }));
    expect(close).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it('releases an inactive retained drawer without losing its draft or consuming Back', async () => {
    const onClose = vi.fn();
    const panel = <MobileFilterPanel open id="retained-filters" onClose={onClose}><label>Draft<input defaultValue="Drinks" /></label></MobileFilterPanel>;
    const { rerender } = render(<PageActivityContext.Provider value={true}>{panel}</PageActivityContext.Provider>);
    const draft = screen.getByLabelText('Draft');
    rerender(<PageActivityContext.Provider value={false}>{panel}</PageActivityContext.Provider>);
    expect(document.body.style.overflow).not.toBe('hidden');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const back = new CustomEvent('mkpos:hardware-back', { cancelable: true });
    fireEvent(window, back);
    expect(back.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    rerender(<PageActivityContext.Provider value={true}>{panel}</PageActivityContext.Provider>);
    expect(screen.getByLabelText('Draft')).toBe(draft);
    expect(draft).toHaveValue('Drinks');
  });

  it('separates the filter label from the active-filter badge', () => {
    render(<MobileFilterToggle open={false} count={2} onToggle={vi.fn()} controls="test-filters" />);

    const toggle = screen.getByRole('button', { name: 'Filters, 2 active filters' });
    expect(toggle).toHaveClass('has-filters');
    expect(toggle.querySelector('span')).toHaveTextContent('Filters');
    expect(screen.getByLabelText('2 active filters')).toHaveTextContent('2');
  });
});

describe('MobileSheet Android back handling', () => {
  it('releases scroll and Back handling while retained on an inactive page, then resumes the same draft', () => {
    const onClose = vi.fn();
    const sheet = <MobileSheet open title="Payment" onClose={onClose}><label>Draft note<input defaultValue="" /></label></MobileSheet>;
    const { rerender } = render(<PageActivityContext.Provider value={true}>{sheet}</PageActivityContext.Provider>);
    const draft = screen.getByLabelText('Draft note');
    fireEvent.change(draft, { target: { value: 'Retained payment draft' } });
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<PageActivityContext.Provider value={false}>{sheet}</PageActivityContext.Provider>);
    expect(document.body.style.overflow).not.toBe('hidden');
    const backgroundBack = new CustomEvent('mkpos:hardware-back', { cancelable: true });
    fireEvent(window, backgroundBack);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backgroundBack.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    rerender(<PageActivityContext.Provider value={true}>{sheet}</PageActivityContext.Provider>);
    expect(screen.getByLabelText('Draft note')).toBe(draft);
    expect(draft).toHaveValue('Retained payment draft');
    expect(document.body.style.overflow).toBe('hidden');
    const foregroundBack = new CustomEvent('mkpos:hardware-back', { cancelable: true });
    fireEvent(window, foregroundBack);
    expect(foregroundBack.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('consumes hardware Back and closes the active sheet', () => {
    const onClose = vi.fn();
    render(<MobileSheet open title="Actions" onClose={onClose}><p>Sheet content</p></MobileSheet>);
    const dialog = screen.getByRole('dialog', { name: 'Actions' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('.mobile-sheet-close')).toHaveAttribute('aria-label', 'Close Actions');

    const event = new CustomEvent('mkpos:hardware-back', { cancelable: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('MobileDeleteSheet', () => {
  it('uses the shared action-menu shell and submits only from the destructive action', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<MobileDeleteSheet open title="Delete product?" description="History is preserved." itemTitle="Apple" itemDescription="SKU-1" onClose={onClose} onConfirm={onConfirm} confirmLabel="Delete product" />);

    const dialog = screen.getByRole('dialog', { name: 'Delete product?' });
    expect(dialog).toHaveClass('mobile-sheet--action-menu', 'mobile-sheet--delete-confirmation');
    expect(screen.getByText('Apple')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete product' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});
