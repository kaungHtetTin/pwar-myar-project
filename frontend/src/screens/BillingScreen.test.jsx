import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { NotificationProvider } from '../components/notifications';
import { BillingContacts, BillingScreen } from './BillingScreen';

vi.mock('../api', () => ({ request: vi.fn() }));

describe('BillingScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the payment modal and entered note when pre-validation rejects the proof', async () => {
    let rejectCheck;
    request.mockImplementation(path => {
      if (path === '/subscription/requests') return new Promise((resolve, reject) => { rejectCheck = reject; });
      if (path === '/subscription') return Promise.resolve({ is_valid: true, pending_request: null });
      if (path === '/subscription/plans') return Promise.resolve({ items: [{ id: 1, name: 'Standard', price: 30000, currency: 'MMK', duration_days: 30 }] });
      if (path === '/subscription/payment-methods') return Promise.resolve({ items: [{ id: 2, bank: 'KBZPay', account_name: 'PwarMyar', account_no: '12345' }] });
      return Promise.resolve({ items: [] });
    });
    render(<NotificationProvider><BillingScreen /></NotificationProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Request package' }));
    await userEvent.upload(screen.getByLabelText(/Payment screenshot/), new File(['proof'], 'receipt.png', { type: 'image/png' }));
    await userEvent.type(screen.getByRole('textbox'), 'Keep this note');
    await userEvent.click(screen.getByRole('button', { name: 'Submit payment request' }));
    expect(screen.getByRole('button', { name: 'Checking payment proof...' })).toBeDisabled();
    await act(async () => rejectCheck(new Error('Please check the transfer amount.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please check the transfer amount.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Keep this note');
    expect(screen.getByText('receipt.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit payment request' })).toBeEnabled();
  });

  it('shows clickable phone, Telegram, and Viber billing contacts', () => {
    render(<BillingContacts />);
    expect(screen.getByRole('region', { name: 'Billing support contacts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '09688683805' })).toHaveAttribute('href', 'tel:09688683805');
    expect(screen.getByRole('link', { name: '@moekaungdev' })).toHaveAttribute('href', 'https://t.me/moekaungdev');
    expect(screen.getByRole('link', { name: 'Viber 09792104209' })).toHaveAttribute('href', 'viber://chat?number=%2B959792104209');
  });

  it('does not render a standalone current-plan container for trial access', async () => {
    request.mockImplementation(async (path) => {
      if (path === '/subscription') return { is_valid: true, access_type: 'trial', days_remaining: 18, ends_at: '2030-12-31T00:00:00Z', subscription: { plan_name: 'System Trial', ends_at: '2030-12-31T00:00:00Z' } };
      if (path === '/subscription/plans' || path === '/subscription/payment-methods') return { items: [] };
      if (path === '/subscription/billing-history') return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<NotificationProvider><BillingScreen /></NotificationProvider>);
    expect(await screen.findByText('No packages are available right now.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Current plan status')).not.toBeInTheDocument();
  });

  it('shows subscription packages and billing history, then sends a plan request', async () => {
    const entitlementUpdated = vi.fn();
    window.addEventListener('mkpos:subscription-entitlement', entitlementUpdated, { once: true });
    const currentPlan = { id: 7, name: 'Monthly', price: 45000, currency: 'Ks', duration_days: 30, description: 'Core access', features: ['POS'] };
    const upgradePlan = { id: 8, name: 'Quarterly', price: 120000, currency: 'Ks', duration_days: 90, description: 'Extended access', features: ['POS', 'Reports'] };
    request.mockImplementation(async (path, options = {}) => {
      if (path === '/subscription') return {
        is_valid: true,
        subscription: { subscription_plan_id: 7, plan_name: 'Monthly', ends_at: '2030-12-31T00:00:00Z' },
        pending_request: null,
      };
      if (path === '/subscription/plans') return { items: [currentPlan, upgradePlan] };
      if (path === '/subscription/billing-history') return {
        items: [{ id: 12, plan_name: 'Monthly', type: 'assignment', duration_days: 30, amount: 45000, currency: 'Ks', paid_at: '2030-01-01T00:00:00Z' }],
      };
      if (path === '/subscription/payment-methods') return { items: [{ id: 3, bank: 'KBZ Bank', account_name: 'PwarMyar', account_no: '123456789' }] };
      if (path === '/subscription/requests' && options.method === 'POST') return {
        subscription: {
          is_valid: true,
          subscription: { subscription_plan_id: 7, plan_name: 'Monthly', ends_at: '2030-12-31T00:00:00Z' },
          pending_request: { subscription_plan_id: 8, plan_name: 'Quarterly' },
        },
      };
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<NotificationProvider><BillingScreen /></NotificationProvider>);

    expect((await screen.findAllByText('Monthly')).length).toBeGreaterThan(0);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
    expect(screen.getByText('BILL-00012')).toBeInTheDocument();
    expect(screen.getByText('New assignment')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Request package' }));
    await userEvent.upload(screen.getByLabelText(/Payment screenshot/), new File(['proof'], 'payment.png', { type: 'image/png' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit payment request' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/subscription/requests', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    })));
    const submitted = request.mock.calls.find(([path]) => path === '/subscription/requests')[1].body;
    expect(submitted.get('subscription_plan_id')).toBe('8');
    expect(submitted.get('payment_method_id')).toBe('3');
    expect(await screen.findByText('Quarterly request is awaiting approval')).toBeInTheDocument();
    expect(entitlementUpdated).toHaveBeenCalledOnce();
    expect(entitlementUpdated.mock.calls[0][0].detail.pending_request.plan_name).toBe('Quarterly');
  });
});
