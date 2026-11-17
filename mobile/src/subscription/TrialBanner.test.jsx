import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LocaleProvider } from '../localization/LocaleProvider';
import { TrialBanner } from './TrialBanner';

it.each([[7, 'reminder'], [3, 'warning']])('shows the paid renewal notice at %i days and opens Billing once', (days, stage) => {
  const onBilling = vi.fn();
  const session = { user: { role: 'owner' }, subscription: {
    is_valid: true, access_type: 'paid', days_remaining: days, ends_at: '2030-05-01T00:00:00Z',
    lifecycle_notice: { code: 'subscription_ending', stage, title: 'Your plan is ending soon.', message: 'Renew your plan before it expires.' },
  } };
  render(<LocaleProvider><TrialBanner session={session} onBilling={onBilling} /></LocaleProvider>);
  expect(screen.getByRole('status')).toHaveTextContent(`${days} days remaining`);
  expect(screen.getByRole('status')).toHaveClass('is-' + stage);
  expect(screen.getByRole('status')).toHaveTextContent('Renew your plan before it expires.');
  fireEvent.click(screen.getByRole('button', { name: /Billing/ }));
  expect(onBilling).toHaveBeenCalledOnce();
});

it('shows the renewal notice to staff without an owner Billing action', () => {
  const session = { user: { role: 'staff' }, subscription: {
    is_valid: true, access_type: 'paid', days_remaining: 3,
    lifecycle_notice: { code: 'subscription_ending', stage: 'warning', title: 'Your plan expires very soon.' },
  } };
  render(<LocaleProvider><TrialBanner session={session} /></LocaleProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('Your plan expires very soon.');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('renders accessible trial timing and routes the owner to Billing', () => {
  const onBilling = vi.fn();
  render(<LocaleProvider><TrialBanner session={{ user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'trial', ends_at: '2030-05-01T00:00:00Z', days_remaining: 6, lifecycle_notice: { stage: 'warning', message: 'Backup download and data restore require a paid plan.' } } }} onBilling={onBilling} /></LocaleProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('6 days remaining');
  expect(screen.getByRole('status')).toHaveTextContent('1 May 2030');
  expect(screen.getByRole('status')).toHaveTextContent('Backup download and data restore require a paid plan.');
  fireEvent.click(screen.getByRole('button', { name: /Billing/ }));
  expect(onBilling).toHaveBeenCalledOnce();
});

it('hides healthy paid plans without a renewal notice', () => {
  const { container } = render(<LocaleProvider><TrialBanner session={{ subscription: { is_valid: true, access_type: 'paid', days_remaining: 8, lifecycle_notice: null } }} /></LocaleProvider>);
  expect(container).toBeEmptyDOMElement();
});

it('localizes the urgent paid renewal notice in Myanmar', () => {
  window.localStorage.setItem('mkpos.language', 'my');
  try {
    render(<LocaleProvider><TrialBanner session={{ user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'paid', days_remaining: 3, ends_at: '2030-05-01T00:00:00Z', lifecycle_notice: { code: 'subscription_ending', stage: 'warning', title: 'Your plan expires very soon.' } } }} /></LocaleProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('သင့်အစီအစဉ် မကြာမီ သက်တမ်းကုန်ဆုံးတော့မည်။');
    expect(screen.getByRole('status')).toHaveTextContent('3 ရက်ကျန်');
    expect(screen.getByRole('button', { name: /ငွေတောင်းခံမှု/ })).toBeInTheDocument();
  } finally {
    window.localStorage.removeItem('mkpos.language');
  }
});

it('renders a suspended paid plan warning', () => {
  const { container } = render(<LocaleProvider><TrialBanner session={{ user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'paid', reason: 'cancelled', ends_at: '2030-05-01T00:00:00Z', days_remaining: 6, lifecycle_notice: { stage: 'suspended', title: 'Subscription suspended', message: 'Access remains available.' } } }} /></LocaleProvider>);
  expect(screen.getByText('Subscription suspended')).toBeInTheDocument();
  expect(container.querySelector('.is-suspended')).toBeInTheDocument();
});
