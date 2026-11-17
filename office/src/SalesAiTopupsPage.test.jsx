import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api, apiBlob } from './api';
import { SalesAiTopupsPage } from './SalesAiTopupsPage';
vi.mock('./api', () => ({ api: vi.fn(), apiBlob: vi.fn() }));
const row = { id: 3, business_id: 10, business_name: 'Demo shop', amount: '1000', status: 'pending', transaction_reference: '', payment_account: { bank: 'KBZPay', account_no: '09123' }, version: 1, created_at: '2026-10-25T10:00:00Z' };
it('opens the exact notification request outside the current filters without resetting the source list', async () => {
  const target = { ...row, id: 99, business_name: 'Alert shop', status: 'rejected' };
  api.mockImplementation(async path => path.endsWith('/99') ? { request: target } : { items: [row], total: 1, page: 1, per_page: 25, last_page: 1 });
  render(<SalesAiTopupsPage alertTarget={{ id: 99, key: 'notice-99' }} />);
  const dialog = await screen.findByRole('dialog', { name: 'Sales AI top-up #99' });
  await within(dialog).findByAltText('Top-up payment proof');
  expect(within(dialog).getByText(/Alert shop/)).toBeInTheDocument();
  expect(screen.getByText('Demo shop')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search Sales AI top-ups'), { target: { value: 'Unsaved search' } });
  const reads = api.mock.calls.length;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.getByLabelText('Search Sales AI top-ups')).toHaveValue('Unsaved search');
  expect(api).toHaveBeenCalledTimes(reads);
});

it('refreshes new requests from socket activity without clearing search or remounting the table', async () => {
  render(<SalesAiTopupsPage />);
  await screen.findByText('Demo shop');
  fireEvent.change(screen.getByLabelText('Search Sales AI top-ups'), { target: { value: 'Unsaved search' } });
  const table = screen.getByRole('table');
  api.mockResolvedValue({ items: [row, { ...row, id: 4, business_name: 'New shop' }], total: 2, page: 1, per_page: 25, last_page: 1 });
  act(() => window.dispatchEvent(new CustomEvent('mkpos:office-activity', { detail: [{ target: 'sales-ai-topup', entity_id: 4 }] })));
  await screen.findByText('New shop');
  expect(screen.getByRole('table')).toBe(table);
  expect(screen.getByLabelText('Search Sales AI top-ups')).toHaveValue('Unsaved search');
});
beforeEach(() => {
  vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:proof'); URL.revokeObjectURL = vi.fn();
  apiBlob.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  api.mockResolvedValue({ items: [row], total: 1, page: 1, per_page: 25, last_page: 1 });
});
async function review() {
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for top-up 3' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Review top-up' }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByAltText('Top-up payment proof'); return dialog;
}
it('keeps a failed review draft, then credits once and removes the row from pending results', async () => {
  let fail = true;
  api.mockImplementation(async (_path, options) => {
    if (options?.method) { if (fail) { fail = false; throw new Error('Connection interrupted'); } return { request: { ...row, status: 'approved', version: 2 }, wallet: { available: '1500', reserved: '0' } }; }
    return { items: [row], total: 1, page: 1, per_page: 25, last_page: 1 };
  });
  render(<SalesAiTopupsPage />);
  const table = await screen.findByRole('table'); const dialog = await review();
  fireEvent.change(within(dialog).getByLabelText('Transaction reference'), { target: { value: 'TX123' } });
  fireEvent.submit(dialog.querySelector('form'));
  await within(dialog).findByText('Connection interrupted');
  expect(within(dialog).getByLabelText('Transaction reference')).toHaveValue('TX123');
  fireEvent.submit(dialog.querySelector('form'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('table')).toBe(table);
  expect(screen.queryByText('Demo shop')).not.toBeInTheDocument();
  expect(api.mock.calls.filter(([, options]) => options?.method)).toHaveLength(2);
  expect(api.mock.calls.filter(([, options]) => !options?.method)).toHaveLength(1);
});
it('opens the business once and cancels review without changing source search or fetching the list again', async () => {
  const openBusiness = vi.fn(); render(<SalesAiTopupsPage onOpenBusiness={openBusiness} />);
  await screen.findByText('Demo shop');
  fireEvent.change(screen.getByLabelText('Search Sales AI top-ups'), { target: { value: 'TX draft' } });
  const dialog = await review();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close', exact: true }));
  expect(screen.getByLabelText('Search Sales AI top-ups')).toHaveValue('TX draft');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for top-up 3' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View business' }));
  expect(openBusiness).toHaveBeenCalledExactlyOnceWith(10);
  expect(api).toHaveBeenCalledTimes(1);
});

it('applies search and status filters, discards a dismissed draft and preserves search when clearing filters', async () => {
  render(<SalesAiTopupsPage />); await screen.findByText('Demo shop');
  fireEvent.change(screen.getByLabelText('Search Sales AI top-ups'), { target: { value: 'TX123' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('q=TX123'));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  const drawer = await screen.findByRole('dialog');
  fireEvent.change(within(drawer).getByLabelText('Status'), { target: { value: 'approved' } });
  fireEvent.click(within(drawer).getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('status=approved'));
  const reads = api.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  const again = await screen.findByRole('dialog');
  fireEvent.change(within(again).getByLabelText('Status'), { target: { value: 'rejected' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(api).toHaveBeenCalledTimes(reads);
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  const clear = await screen.findByRole('dialog');
  fireEvent.click(within(clear).getByRole('button', { name: 'Clear', exact: true }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toMatch(/q=TX123&status=$/));
});

it('shows the saved System Agent checks and extracted reference before manual approval', async () => {
  api.mockResolvedValue({ items: [{ ...row, transaction_reference: '000123', prevalidation: { verdict: 'looks_consistent', checks: [{ field: 'recipient_name', status: 'match' }, { field: 'amount', status: 'match' }] } }], total: 1, page: 1, per_page: 25, last_page: 1 });
  render(<SalesAiTopupsPage />);
  const dialog = await review();
  expect(within(dialog).getByText('System Agent: Receipt checks passed')).toBeInTheDocument();
  expect(within(dialog).getByText('Manual approval required.')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Transaction reference')).toHaveValue('000123');
  expect(api.mock.calls.filter(([, options]) => options?.method)).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
