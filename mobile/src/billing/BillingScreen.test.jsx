import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingContacts, BillingScreen } from './BillingScreen';
import { apiRequest } from '../api/client';
import { BillingAccount } from './BillingReferenceParts';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
beforeEach(() => apiRequest.mockReset());

it('selects one payment account with radios and updates the recipient details', () => {
  const methods = [{ id: 1, bank: 'KBZPay', account_no: '09111111111', account_name: 'First recipient' }, { id: 2, bank: 'AYA Pay', account_no: '09222222222', account_name: 'Second recipient' }];
  function Accounts() {
    const [selected, setSelected] = React.useState('1');
    return <BillingAccount methods={methods} method={methods.find(item => String(item.id) === selected)} onChange={setSelected} />;
  }
  render(<Accounts />);
  expect(screen.getByRole('group', { name: 'Payment account' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'KBZPay 09111111111' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'AYA Pay 09222222222' }));
  expect(screen.getByRole('radio', { name: 'AYA Pay 09222222222' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'KBZPay 09111111111' })).not.toBeChecked();
  expect(screen.getByText('Second recipient')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

describe('mobile billing contacts', () => {
  it('shows tap targets for phone, Telegram, and Viber support', () => {
    render(<BillingContacts />);

    expect(screen.getByRole('region', { name: 'Billing support contacts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '09688683805' })).toHaveAttribute('href', 'tel:09688683805');
    expect(screen.getByRole('link', { name: '@moekaungdev' })).toHaveAttribute('href', 'https://t.me/moekaungdev');
    expect(screen.getByRole('link', { name: 'Viber 09792104209' })).toHaveAttribute('href', 'viber://chat?number=%2B959792104209');
  });
});

describe('pending billing request', () => {
  it('checks proof before submission and preserves the form when the receipt needs correction', async () => {
    let rejectCheck;
    apiRequest.mockImplementation(path => {
      if (path === '/subscription/requests') return new Promise((resolve, reject) => { rejectCheck = reject; });
      if (path === '/subscription') return Promise.resolve({ pending_request: null });
      if (path === '/subscription/plans') return Promise.resolve({ items: [{ id: 1, name: 'Standard', price: 30000, currency: 'MMK', duration_days: 30 }] });
      if (path === '/subscription/payment-methods') return Promise.resolve({ items: [{ id: 2, bank: 'KBZPay', account_name: 'PwarMyar', account_no: '12345' }] });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<BillingScreen pathname="/billing/request/1" />);
    const proof = await screen.findByLabelText('Payment screenshot');
    fireEvent.change(proof, { target: { files: [new File(['proof'], 'receipt.png', { type: 'image/png' })] } });
    fireEvent.change(screen.getByLabelText('Message to office (optional)'), { target: { value: 'Keep this note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(screen.getByRole('button', { name: 'Checking payment proof...' })).toBeDisabled();
    await act(async () => rejectCheck(Object.assign(new Error('Please check the transfer amount.'), { payload: { errors: { payment_screenshot: ['Please check the transfer amount.'] } } })));
    expect(await screen.findByText('Please check the transfer amount.')).toBeInTheDocument();
    expect(proof).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('receipt.png')).toBeInTheDocument();
    expect(screen.getByLabelText('Message to office (optional)')).toHaveValue('Keep this note');
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeEnabled();
    expect(screen.queryByText('Payment request submitted')).not.toBeInTheDocument();
  });

  it('shows saved pending proof without offering unsavable edits or marking it active', async () => {
    apiRequest.mockImplementation(path => {
      if (path === '/subscription') return Promise.resolve({ pending_request: { subscription_plan_id: 1, plan_name: 'Standard', price: 30000, currency: 'MMK', payment_bank: 'Saved bank', payment_account_no: '1234', payment_account_name: 'Saved recipient', payment_screenshot_uploaded: true, message: 'Transfer reference: TXN-1\nSaved note' } });
      if (path === '/subscription/plans') return Promise.resolve({ items: [{ id: 1, name: 'Standard', price: 30000, currency: 'MMK', duration_days: 30 }] });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<BillingScreen pathname="/billing/request/1" />);
    expect(await screen.findByRole('heading', { name: 'Payment request pending' })).toBeInTheDocument();
    expect(screen.getByText('Payment proof received.')).toBeInTheDocument();
    expect(screen.getByText('Saved bank')).toBeInTheDocument();
    expect(screen.getByText('TXN-1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Payment screenshot')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
});
