import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BillingRequests } from './BillingRequests';

const draft = { id: 'draft', revision: 1, status: 'draft', image_message_id: 7, message: '', options: { plans: [{ id: 1, name: 'Monthly', price: 30000, currency: 'MMK' }], payment_methods: [{ id: 2, provider: 'KBZPay', account_name: 'PwarMyar', account_last_four: '3805' }], images: [{ id: 7, name: 'receipt.png', type: 'image' }] } };
const validated = { ...draft, revision: 2, status: 'validated', subscription_plan_id: 1, payment_method_id: 2, preview_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z', review: { plan: draft.options.plans[0], payment_method: draft.options.payment_methods[0], observed: { transaction_reference: 'TXN123', amount: '30000', currency: 'MMK' }, checks: [{ field: 'recipient_name', status: 'match' }, { field: 'recipient_account', status: 'match' }], pending_request_ids: [] } };
function mount(api, initial = draft, role = 'owner', cache) {
  const saved = vi.fn();
  function Wrapper() {
    const [row, setRow] = useState(initial);
    return <BillingRequests requests={[row]} role={role} api={api} conversation="chat" onChange={setRow} onBusy={vi.fn()} onSaved={saved} screens={[]} stateCache={cache}/>;
  }
  return { ...render(<Wrapper/>), saved };
}

it('requires selections, validation and explicit owner approval; submits the reviewed form only once', async () => {
  let finish;
  const api = vi.fn().mockResolvedValueOnce(validated).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { saved } = mount(api);
  const submit = screen.getByRole('button', { name: 'Submit billing request' });
  expect(submit).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Validate payment' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Subscription plan'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('PwarMyar receiving account'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Validate payment' }));
  await screen.findByText('Ready for owner review');
  expect(JSON.parse(api.mock.calls[0][1].body)).toMatchObject({ revision: 1, subscription_plan_id: '1', payment_method_id: '2', image_message_id: '7' });
  expect(submit).toBeDisabled();
  expect(screen.getByRole('table')).toHaveTextContent('Account last 4 digits');
  fireEvent.click(screen.getByLabelText('Approve billing submission'));
  fireEvent.click(submit); fireEvent.click(submit);
  expect(api).toHaveBeenCalledTimes(2);
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ revision: 2, preview_hash: validated.preview_hash });
  await act(async () => finish({ ...validated, status: 'submitted', request_id: 19, request_status: 'pending' }));
  expect(screen.getByRole('status')).toHaveTextContent('Pending Office approval');
  expect(saved).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Submit billing request' })).not.toBeInTheDocument();
});

it('clears approval on every edit, including an edit that is reverted', () => {
  mount(vi.fn(), validated);
  fireEvent.click(screen.getByLabelText('Approve billing submission'));
  expect(screen.getByRole('button', { name: 'Submit billing request' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Billing request note'), { target: { value: 'Updated note' } });
  expect(screen.getByRole('button', { name: 'Submit billing request' })).toBeDisabled();
  expect(screen.getByLabelText('Approve billing submission')).not.toBeChecked();
  fireEvent.change(screen.getByLabelText('Billing request note'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: 'Submit billing request' })).toBeDisabled();
});

it('keeps corrections and entered values after a network failure', async () => {
  const api = vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(draft);
  mount(api);
  fireEvent.change(screen.getByLabelText('Billing request note'), { target: { value: 'Keep my note' } });
  fireEvent.change(screen.getByLabelText('Subscription plan'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('PwarMyar receiving account'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Validate payment' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted'));
  expect(screen.getByLabelText('Billing request note')).toHaveValue('Keep my note');
  expect(screen.getByRole('button', { name: 'Submit billing request' })).toBeDisabled();
});

it('cancels without submitting and does not render forms for staff', async () => {
  const api = vi.fn().mockResolvedValue({ ...draft, status: 'cancelled' });
  const view = mount(api);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel billing form' }));
  await screen.findByText('Billing form cancelled. Nothing was submitted from this form.');
  expect(api.mock.calls[0][0]).toMatch(/\/cancel$/);
  expect(api).toHaveBeenCalledTimes(1);
  view.unmount(); mount(vi.fn(), draft, 'staff');
  expect(screen.queryByLabelText('Billing request form')).not.toBeInTheDocument();
});

it('refreshes server status without sending a submit request', async () => {
  const api = vi.fn().mockResolvedValue({ ...validated, status: 'submitted', request_id: 25, request_status: 'pending' });
  mount(api, validated);
  fireEvent.click(screen.getByRole('button', { name: 'Check billing status' }));
  await screen.findByText(/Request #25/);
  expect(api).toHaveBeenCalledWith('/ai-assistant/conversations/chat/billing-requests/draft');
});
