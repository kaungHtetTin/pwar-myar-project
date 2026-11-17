import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { SubscriptionScreen } from './SubscriptionScreen';

vi.mock('../api', () => ({ request: vi.fn() }));

describe('SubscriptionScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the owner renewal experience after trial expiry', async () => {
    request.mockImplementation((path) => Promise.resolve({ items: path.includes('plans') ? [] : [] }));
    render(<SubscriptionScreen session={{ business: { name: 'Expired Trial Shop' }, user: { role: 'owner' }, subscription: { is_valid: false, access_type: 'trial', reason: 'expired' } }} onSession={vi.fn()} onLoggedOut={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Choose or renew your plan' })).toBeInTheDocument();
    expect(screen.getByText('Your subscription has expired.', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText('No plans are available. Please contact the PwarMyar office.')).toBeInTheDocument();
  });

  it('shows available plans and sends a purchase request', async () => {
    const plan = { id: 7, name: 'Monthly', price: 15000, currency: 'Ks', duration_days: 30, description: 'Full access', features: ['POS'] };
    const paymentMethod = { id: 3, bank: 'KBZ Bank', account_name: 'PwarMyar', account_no: '123456789' };
    request.mockImplementation((path) => {
      if (path === '/subscription/plans') return Promise.resolve({ items: [plan] });
      if (path === '/subscription/payment-methods') return Promise.resolve({ items: [paymentMethod] });
      return Promise.resolve({ subscription: { is_valid: false, pending_request: { subscription_plan_id: 7, plan_name: 'Monthly' } } });
    });
    const onSession = vi.fn();
    render(<SubscriptionScreen session={{ business: { name: 'Shop' }, subscription: { is_valid: false, reason: 'expired' } }} onSession={onSession} onLoggedOut={vi.fn()} />);

    expect(await screen.findByText('Monthly')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Request this plan' }));
    const paymentDialog = screen.getByRole('dialog', { name: 'Pay for Monthly' });
    expect(paymentDialog).toHaveClass('mkpos-modal', 'subscription-payment-modal');
    expect(screen.queryByLabelText('Selected subscription package')).not.toBeInTheDocument();
    expect(within(paymentDialog).getByText(/15,000 Ks/)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText(/Payment screenshot/), new File(['proof'], 'payment.png', { type: 'image/png' }));
    expect(screen.getByText('payment.png')).toBeInTheDocument();
    expect(screen.getByText('Replace file')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit payment request' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/subscription/requests', expect.objectContaining({ method: 'POST', body: expect.any(FormData) })));
    const submitted = request.mock.calls.find(([path]) => path === '/subscription/requests')[1].body;
    expect(submitted.get('subscription_plan_id')).toBe('7');
    expect(submitted.get('payment_method_id')).toBe('3');
    expect(submitted.get('payment_screenshot').name).toBe('payment.png');
    expect(onSession).toHaveBeenCalled();
  });
});
