import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FinancialBookPage } from './FinancialBookPage';
import { RetainedViews } from './RetainedViews';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const entry = { id: 7, source: 'manual', type: 'expense', entry_date: '2026-10-15', currency: 'Ks', amount: '10.00', description: 'Server hosting', category: 'Hosting', reference: 'HOST-1', created_by_name: 'Office Admin', created_at: '2026-10-15T12:00:00Z', voided_at: null };
const banks = [{ id: 1, name: 'Kaung Htet Tin', balance: '0.00' }, { id: 2, name: 'Min Htet Kyaw', balance: '90.00' }, { id: 3, name: 'VISA', balance: '0.00' }];
const report = { subscription_account_id: 2, bank_books: banks, items: [entry], currency: 'Ks', currencies: ['Ks', 'USD'], total: 1, page: 1, per_page: 25, last_page: 1, settings_version: 1,
  summary: { income: '100.00', expenses: '10.00', profit: '90.00', cash: '90.00', allocated: '40.00', unallocated: '50.00' },
  founders: [{ id: 1, name: 'Kaung Htet Tin', share_bps: 5000, allocated: '20.00', paid: '5.00', balance: '15.00', contributed: '0.00' }, { id: 2, name: 'Min Htet Kyaw', share_bps: 5000, allocated: '20.00', paid: '0.00', balance: '20.00', contributed: '0.00' }] };
beforeEach(() => { api.mockReset(); api.mockImplementation(() => Promise.resolve(report)); });
function Harness() {
  const [filterOpen, setFilterOpen] = useState(false);
  return <FinancialBookPage filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} />;
}
const mount = async () => { render(<Harness />); await screen.findByText('Server hosting'); await waitFor(() => expect(screen.getByRole('button', { name: 'New entry' })).toBeEnabled()); };
it('cancels entry forms without fetching or replacing the source table and restores focus', async () => {
  await mount(); const table = screen.getByRole('table', { name: 'Financial book entries' }), count = api.mock.calls.length;
  screen.getByRole('button', { name: 'New entry' }).focus(); fireEvent.click(screen.getByRole('button', { name: 'New entry' }));
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Draft expense' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByRole('table', { name: 'Financial book entries' })).toBe(table);
  expect(api).toHaveBeenCalledTimes(count); expect(screen.getByRole('button', { name: 'New entry' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'New entry' })); fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('preserves failed expense edits for retry, blocks duplicates, then reconciles the book', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'New entry' }));
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.34' } });
  fireEvent.change(screen.getByLabelText('Bank book'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New hosting' } });
  api.mockRejectedValueOnce(new Error('Connection interrupted'));
  fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted'); expect(screen.getByLabelText('Amount')).toHaveValue(12.34);
  let finish; api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const save = screen.getByRole('button', { name: 'Save entry' }); fireEvent.click(save); fireEvent.submit(screen.getByLabelText('Amount').closest('form'));
  expect(save).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeInTheDocument();
  const mutations = api.mock.calls.filter(([, options]) => options?.method === 'POST'); expect(mutations).toHaveLength(2);
  expect(JSON.parse(mutations[0][1].body).account_id).toBe(2);
  expect(JSON.parse(mutations[0][1].body).request_key).toBe(JSON.parse(mutations[1][1].body).request_key);
  await act(async () => finish({ id: 10 })); await screen.findByText('Financial book updated.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'New entry' })).toBeEnabled());
});
it('applies filters, clears only drawer fields, and preserves search and page size', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('Search financial book'), { target: { value: 'hosting' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=hosting')));
  fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('per_page=50')));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Entry type'), { target: { value: 'expense' } }); fireEvent.change(screen.getByLabelText('Founder'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('type=expense')));
  expect(api.mock.lastCall[0]).toContain('founder_id=1'); expect(api.mock.lastCall[0]).toContain('q=hosting');
  await waitFor(() => expect(screen.getByRole('button', { name: /Filters/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Filters/ })); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('type=all'))); expect(api.mock.lastCall[0]).toContain('q=hosting'); expect(api.mock.lastCall[0]).toContain('per_page=50');
});
it('opens founder settings as a page without creating a modal or reloading the book', async () => {
  const onOpenFounders = vi.fn();
  render(<FinancialBookPage onOpenFounders={onOpenFounders} />);
  await screen.findByText('Server hosting');
  const count = api.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Founder settings' }));
  expect(onOpenFounders).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(count);
});
it('opens allocation details, saves an allocation, and records void reasons through the shared row menu', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Allocate profit' }));
  expect(screen.getByText('Kaung Htet Tin: 50%')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Bank book'), { target: { value: '2' } });
  expect(screen.getByText(/marks all founder shares as paid/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '20.00' } }); fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'October profit' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Allocate profit' })); await screen.findByText('Financial book updated.');
  const call = api.mock.calls.find(([, options]) => options?.method === 'POST'); expect(JSON.parse(call[1].body)).toMatchObject({ type: 'profit_allocation', amount: '20.00', settings_version: 1, account_id: 2 });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actions for book entry manual-7' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Actions for book entry manual-7' })); fireEvent.click(screen.getByRole('menuitem', { name: 'View entry' }));
  expect(screen.getByRole('dialog', { name: 'Book entry details' })).toHaveTextContent('HOST-1'); fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Actions for book entry manual-7' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Void entry' }));
  fireEvent.change(screen.getByLabelText('Reason for voiding'), { target: { value: 'Duplicate receipt' } }); fireEvent.click(screen.getByRole('button', { name: 'Void entry' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/financial-book/entries/7/void', expect.objectContaining({ body: JSON.stringify({ reason: 'Duplicate receipt' }) })));
});
it('retains filters, data and modal drafts when switching sections without a return fetch', async () => {
  function RetainedHarness() {
    const [tab, setTab] = useState('book');
    return <><button onClick={() => setTab('book')}>Book section</button><button onClick={() => setTab('other')}>Other section</button><RetainedViews activeKey={tab}>{tab === 'book' ? <Harness /> : <p>Other content</p>}</RetainedViews></>;
  }
  render(<RetainedHarness />); await screen.findByText('Server hosting'); await waitFor(() => expect(screen.getByRole('button', { name: 'New entry' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Search financial book'), { target: { value: 'Saved search' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'New entry' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'New entry' })); fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Retained draft' } });
  const count = api.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Other section' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Book section' })); expect(screen.getByLabelText('Description')).toHaveValue('Retained draft');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByLabelText('Search financial book')).toHaveValue('Saved search'); expect(api).toHaveBeenCalledTimes(count);
});

it('records a transfer with source and destination books, retains a failed draft and keeps the same request key', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'Transfer' }));
  expect(screen.getByLabelText('From bank book')).toHaveValue('2');
  fireEvent.change(screen.getByLabelText('To bank book'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '20.00' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Fund VISA' } });
  api.mockRejectedValueOnce(new Error('Source balance changed'));
  fireEvent.click(screen.getByRole('button', { name: 'Record transfer' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Source balance changed');
  expect(screen.getByLabelText('To bank book')).toHaveValue('3'); expect(screen.getByLabelText('Amount')).toHaveValue(20);
  api.mockResolvedValueOnce({ id: 10 }); fireEvent.click(screen.getByRole('button', { name: 'Record transfer' }));
  await screen.findByText('Financial book updated.');
  const calls = api.mock.calls.filter(([, options]) => options?.method === 'POST');
  const payload = JSON.parse(calls[0][1].body);
  expect(payload).toMatchObject({ type: 'transfer', account_id: 2, to_account_id: 3, amount: '20.00', currency: 'Ks', founder_id: null });
  expect(JSON.parse(calls[1][1].body).request_key).toBe(payload.request_key);
});
it('filters bank books and assigns an unassigned historical entry from its action menu', async () => {
  await mount();
  const balances = screen.getByRole('region', { name: 'Bank book balances' }); expect(within(balances).getByRole('heading', { name: 'VISA' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Bank book'), { target: { value: '3' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('account_id=3')));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actions for book entry manual-7' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Actions for book entry manual-7' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Assign bank book' }));
  fireEvent.change(screen.getByLabelText('Bank book'), { target: { value: '3' } }); fireEvent.click(screen.getByRole('button', { name: 'Assign bank book' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/financial-book/entries/7/bank-book', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ account_id: 3 }) })));
});

it('previews an opening adjustment on top of the selected bank balance and saves it once', async () => {
  await mount();
  const bank = within(screen.getByRole('region', { name: 'Bank book balances' })).getByRole('heading', { name: 'Min Htet Kyaw' }).closest('article');
  fireEvent.click(within(bank).getByRole('button', { name: 'Opening adjustment' }));
  expect(screen.getByRole('dialog', { name: 'Opening balance adjustment' })).toBeInTheDocument();
  expect(screen.getByLabelText('Bank book')).toHaveValue('2');
  fireEvent.change(screen.getByLabelText('Adjustment amount'), { target: { value: '25.50' } });
  expect(document.querySelector('.office-book-opening-preview')).toHaveTextContent('115.5 Ks');
  fireEvent.change(screen.getByLabelText('Reason / opening balance note'), { target: { value: 'Existing bank funds before tracking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save opening adjustment' }));
  await screen.findByText('Financial book updated.');
  const call = api.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(call[1].body)).toMatchObject({ type: 'opening_balance', account_id: 2, amount: '25.50', expected_bank_balance: '90.00', currency: 'Ks', description: 'Existing bank funds before tracking' });
});
it('supports negative opening adjustments, cancellation and stale-balance errors without losing the draft', async () => {
  await mount();
  fireEvent.click(screen.getAllByRole('button', { name: 'Opening adjustment' })[2]);
  fireEvent.change(screen.getByLabelText('Adjustment amount'), { target: { value: '-0.50' } });
  fireEvent.change(screen.getByLabelText('Reason / opening balance note'), { target: { value: 'VISA balance correction' } });
  expect(document.querySelector('.office-book-opening-preview')).toHaveTextContent('-0.5 Ks');
  api.mockRejectedValueOnce(new Error('Bank balance changed. Refresh before recording an opening adjustment.'));
  fireEvent.click(screen.getByRole('button', { name: 'Save opening adjustment' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('Adjustment amount')).toHaveValue(-0.5);
  const count = api.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(api).toHaveBeenCalledTimes(count);
});
