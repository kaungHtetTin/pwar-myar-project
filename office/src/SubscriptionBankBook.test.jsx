import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PaymentApprovalModal } from './SubscriptionBankBook';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
beforeEach(() => api.mockResolvedValue({ items: [], subscription_account_id: null }));
const payment = { id: 31, business_name: 'Shop', plan_name: 'Monthly', status: 'pending', transaction_id: 'TXN-123456',
  prevalidation: { status: 'completed', report: { verdict: 'looks_consistent', checks: [{ field: 'amount', status: 'match' }],
    observed: { transaction_reference: 'TXN-123456', amount: '30000', currency: 'MMK' }, expected: { amount: '30000', currency: 'Ks', price_basis: 'Submission-time price' } } } };

it('prepopulates an editable transaction ID and waits for the manual approval button', async () => {
  const action = vi.fn().mockResolvedValue(true), close = vi.fn();
  render(<PaymentApprovalModal request={payment} onAction={action} onClose={close} />);
  expect(screen.getByRole('region', { name: 'AI receipt check' })).toHaveTextContent('Receipt checks passed');
  expect(screen.getByRole('region', { name: 'AI receipt check' })).toHaveTextContent('amount');
  expect(screen.getByRole('region', { name: 'AI receipt check' })).toHaveTextContent('match');
  expect(screen.getByLabelText('Transaction ID')).toHaveValue('TXN-123456');
  expect(action).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Transaction ID'), { target: { value: 'BANK-9876' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve payment', exact: true }));
  expect(JSON.parse(action.mock.calls[0][2].body)).toMatchObject({ transaction_id: 'BANK-9876' });
  await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
});
