import { parseOfficeDate } from './dateTime';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BillingHistoryTable } from './BillingHistoryTable';
import { api, apiBlob } from './api';

vi.mock('./api', () => ({ api: vi.fn(), apiBlob: vi.fn() }));
const item = { id: 7, plan_name: 'Professional', starts_at: '2026-10-01T03:30:00.000Z', ends_at: '2026-10-31T03:30:00.000Z', created_at: '2026-10-01T03:30:00.000Z', price_paid: 1000, currency: 'Ks', duration_days: 30, access_type: 'paid', status: 'active' };
beforeEach(() => { api.mockReset(); apiBlob.mockReset(); URL.createObjectURL = vi.fn(() => 'blob:proof'); URL.revokeObjectURL = vi.fn(); });
it('opens subscription billing details and proof from the menu without adding a column or replacing the table', async () => {
  apiBlob.mockResolvedValue(new Blob(['proof'], { type: 'image/png' }));
  mount({ payment_proofs: [{ id: 31, url: '/office/subscription-requests/31/payment-screenshot' }] });
  const table = screen.getByRole('table');
  expect(screen.queryByRole('columnheader', { name: 'Proof' })).not.toBeInTheDocument();
  expect(apiBlob).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Actions for subscription 7' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View details' }));
  expect(screen.getByRole('dialog', { name: 'Billing details' })).toBeInTheDocument();
  await screen.findByAltText('Payment screenshot for Professional');
  expect(apiBlob).toHaveBeenCalledExactlyOnceWith('/office/subscription-requests/31/payment-screenshot');
  fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
  expect(screen.getByRole('table')).toBe(table);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

it('shows top-up details and retries a failed proof inside the modal', async () => {
  const topup = { id: 9, status: 'approved', amount: '1000', currency: 'MMK', transaction_reference: 'TX9', payment_account: { bank: 'KBZPay', account_no: '091234', account_name: 'Platform' }, reviewed_by_name: 'Reviewer', review_note: 'Verified', created_at: item.created_at };
  apiBlob.mockRejectedValueOnce(new Error('Proof temporarily unavailable')).mockResolvedValueOnce(new Blob(['proof'], { type: 'image/png' }));
  render(<BillingHistoryTable businessId={11} history={[]} topups={[topup]} currency="Ks" onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for top-up 9' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View details' }));
  await screen.findByText('Proof temporarily unavailable');
  expect(screen.getByText('091234')).toBeInTheDocument();
  expect(screen.getByText('Verified')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry proof' }));
  await screen.findByAltText('Payment screenshot for Sales AI top-up #9');
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api).not.toHaveBeenCalled();
});
it('combines subscription and top-up billing in one table and reconciles a review without replacing it', async () => {
  const topup = { id: 7, amount: '1000', currency: 'MMK', status: 'pending', version: 1, transaction_reference: 'TX123', payment_account: { bank: 'KBZPay' }, created_at: '2026-10-25T10:00:00Z' };
  const saved = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:proof'); URL.revokeObjectURL = vi.fn();
  apiBlob.mockResolvedValue(new Blob(['proof'], { type: 'image/png' }));
  const result = { request: { ...topup, status: 'approved', reviewed_by_name: 'Reviewer', version: 2 }, wallet: { available: '1500', reserved: '0' } };
  api.mockResolvedValue(result);
  render(<BillingHistoryTable businessId={11} history={[item]} topups={[topup]} currency="Ks" onSaved={vi.fn()} onTopupSaved={saved} />);
  const table = screen.getByRole('table');
  expect(screen.getAllByRole('table')).toHaveLength(1);
  expect(screen.getByText('Professional')).toBeInTheDocument();
  expect(screen.getByText('Sales AI top-up')).toBeInTheDocument();
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Sales AI top-up');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for top-up 7' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Review top-up' }));
  await screen.findByAltText('Top-up payment proof');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm review' }));
  await screen.findByText('Top-up review saved.');
  expect(saved).toHaveBeenCalledWith(result);
  expect(screen.getByRole('table')).toBe(table);
  expect(api).toHaveBeenCalledTimes(1);
});
function mount(overrides = {}) {
  const onSaved = vi.fn();
  render(<BillingHistoryTable businessId={11} history={[{ ...item, ...overrides }]} currency="Ks" onSaved={onSaved} />);
  return onSaved;
}
const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Actions for subscription 7' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit billing period' }));
};

it('opens the action menu modal, cancels without a request and retains the table', async () => {
  mount(); const table = screen.getByRole('table'); open();
  expect(parseOfficeDate(screen.getByLabelText('Period start').value).toISOString()).toBe(item.starts_at);
  expect(screen.getByRole('dialog', { name: 'Edit billing period' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveClass('office-action-column');
  fireEvent.change(screen.getByLabelText('Period end'), { target: { value: '2026-12-01T12:34:56' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('Period start')).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled(); expect(screen.getByRole('table')).toBe(table);
  open(); fireEvent.keyDown(screen.getByLabelText('Period start'), { key: 'Escape' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actions for subscription 7' })).toHaveFocus());
});

it('preserves failed edits for retry, then returns refreshed business details to the page', async () => {
  const saved = mount(); open();
  const end = '2026-12-01T12:34:56';
  fireEvent.change(screen.getByLabelText('Period end'), { target: { value: end } });
  api.mockRejectedValueOnce(new Error('This billing period changed.')).mockResolvedValueOnce({ billing_history: [], billing: { is_valid: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
  await screen.findByRole('alert'); expect(parseOfficeDate(screen.getByLabelText('Period end').value).getTime()).toBe(parseOfficeDate(end).getTime());
  fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
  await screen.findByText('Billing period updated.');
  expect(saved).toHaveBeenCalledWith({ billing_history: [], billing: { is_valid: true } });
  const [path, options] = api.mock.calls[1];
  expect(path).toBe('/office/businesses/11/subscriptions/7/period'); expect(options.method).toBe('PATCH');
  expect(JSON.parse(options.body)).toEqual({ starts_at: item.starts_at, ends_at: parseOfficeDate(end).toISOString(), original_starts_at: item.starts_at, original_ends_at: item.ends_at });
});

it('blocks duplicate submissions and cancellation while saving', async () => {
  let finish; api.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount(); open(); const save = screen.getByRole('button', { name: 'Save period' });
  fireEvent.click(save); fireEvent.click(save);
  expect(api).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent.keyDown(screen.getByLabelText('Period start'), { key: 'Escape' });
  expect(screen.getByLabelText('Period start')).toBeInTheDocument();
  await act(async () => finish({ billing_history: [] })); await screen.findByText('Billing period updated.');
});

it('rejects invalid ranges and permits no expiry only for paid subscriptions', async () => {
  mount(); open();
  fireEvent.change(screen.getByLabelText('Period end'), { target: { value: screen.getByLabelText('Period start').value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
  await screen.findByText('The end must be after the start.'); expect(api).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Period end'), { target: { value: '' } });
  api.mockResolvedValueOnce({ billing_history: [] }); fireEvent.click(screen.getByRole('button', { name: 'Save period' }));
  await screen.findByText('Billing period updated.'); expect(JSON.parse(api.mock.calls[0][1].body).ends_at).toBeNull();
});

it('closes through the modal close control and backdrop without saving', () => {
  mount(); open();
  fireEvent.click(screen.getByRole('button', { name: 'Close billing period editor' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  open(); fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});
