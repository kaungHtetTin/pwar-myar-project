import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LocaleProvider } from '../localization/LocaleProvider';
import { TrialBanner } from './TrialBanner';

it('renders accessible trial timing and routes the owner to Billing', () => {
  const onBilling = vi.fn();
  render(<LocaleProvider><TrialBanner session={{ user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'trial', ends_at: '2030-05-01T00:00:00Z', days_remaining: 6, lifecycle_notice: { stage: 'warning', message: 'Backup download and data restore require a paid plan.' } } }} onBilling={onBilling} /></LocaleProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('6 days remaining');
  expect(screen.getByRole('status')).toHaveTextContent('1 May 2030');
  expect(screen.getByRole('status')).toHaveTextContent('Backup download and data restore require a paid plan.');
  fireEvent.click(screen.getByRole('button', { name: /Billing/ }));
  expect(onBilling).toHaveBeenCalledOnce();
});

it('renders a suspended paid plan warning', () => {
  const { container } = render(<LocaleProvider><TrialBanner session={{ user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'paid', reason: 'cancelled', ends_at: '2030-05-01T00:00:00Z', days_remaining: 6, lifecycle_notice: { stage: 'suspended', title: 'Subscription suspended', message: 'Access remains available.' } } }} /></LocaleProvider>);
  expect(screen.getByText('Subscription suspended')).toBeInTheDocument();
  expect(container.querySelector('.is-suspended')).toBeInTheDocument();
});
