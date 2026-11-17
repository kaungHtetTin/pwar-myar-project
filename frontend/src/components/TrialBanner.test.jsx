import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrialBanner } from './TrialBanner';
import { shouldShowTrialBanner } from './trialBannerVisibility';

it.each([[7, 'reminder'], [3, 'warning']])('shows the paid renewal notice at %i days and opens Billing once', (days, stage) => {
  const onBilling = vi.fn();
  const session = { user: { role: 'owner' }, subscription: {
    is_valid: true, access_type: 'paid', days_remaining: days, ends_at: '2030-05-01T00:00:00Z',
    lifecycle_notice: { code: 'subscription_ending', stage, title: 'Your plan is ending soon.', message: 'Renew your plan before it expires.' },
  } };
  render(<TrialBanner session={session} onBilling={onBilling} />);
  expect(screen.getByRole('status')).toHaveTextContent(`${days} days remaining`);
  expect(screen.getByRole('status')).toHaveClass('trial-banner--' + stage);
  expect(screen.getByRole('status')).toHaveTextContent('Renew your plan before it expires.');
  fireEvent.click(screen.getByRole('button', { name: /Billing/ }));
  expect(onBilling).toHaveBeenCalledOnce();
});

it('shows the renewal notice to staff without an owner Billing action', () => {
  const session = { user: { role: 'staff' }, subscription: {
    is_valid: true, access_type: 'paid', days_remaining: 3,
    lifecycle_notice: { code: 'subscription_ending', stage: 'warning', title: 'Your plan expires very soon.' },
  } };
  render(<TrialBanner session={session} />);
  expect(screen.getByRole('status')).toHaveTextContent('Your plan expires very soon.');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

const trial = {
  is_valid: true,
  access_type: 'trial',
  ends_at: '2030-02-20T00:00:00Z',
  days_remaining: 9,
  lifecycle_notice: { stage: 'reminder', title: 'Your free trial is ending soon.', message: 'Backup download and data restore require a paid plan.' },
};

describe('TrialBanner', () => {
  it('is suppressed only for the POS sell module', () => {
    expect(shouldShowTrialBanner('sell')).toBe(false);
    expect(shouldShowTrialBanner('products')).toBe(true);
    expect(shouldShowTrialBanner('billing')).toBe(true);
  });

  it('shows server trial timing, restrictions, and the owner Billing action', () => {
    const onBilling = vi.fn();
    render(<TrialBanner session={{ user: { role: 'owner' }, subscription: trial }} onBilling={onBilling} />);
    expect(screen.getByRole('status')).toHaveTextContent('9 days remaining');
    expect(screen.getByRole('status')).toHaveTextContent('February 20, 2030');
    expect(screen.getByRole('status')).toHaveTextContent('Backup download and data restore require a paid plan.');
    fireEvent.click(screen.getByRole('button', { name: /Billing/ }));
    expect(onBilling).toHaveBeenCalledOnce();
  });

  it('does not render for paid access', () => {
    const { container } = render(<TrialBanner session={{ user: { role: 'owner' }, subscription: { ...trial, access_type: 'paid' } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a suspended paid plan as a red billing alert', () => {
    const { container } = render(<TrialBanner session={{ user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'paid', reason: 'cancelled', ends_at: '2030-05-01T00:00:00Z', days_remaining: 6, lifecycle_notice: { stage: 'suspended', title: 'Subscription suspended', message: 'Access remains available.' } } }} />);
    expect(screen.getByText('Subscription suspended')).toBeInTheDocument();
    expect(container.querySelector('.trial-banner--suspended')).toBeInTheDocument();
  });
});
