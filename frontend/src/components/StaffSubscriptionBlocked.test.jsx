import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StaffSubscriptionBlocked } from './StaffSubscriptionBlocked';

vi.mock('../api', () => ({ request: vi.fn() }));

it('shows the staff-specific blocked experience after trial expiry', () => {
  render(<StaffSubscriptionBlocked session={{ business: { name: 'Expired Trial Shop' }, user: { role: 'staff' }, subscription: { is_valid: false, access_type: 'trial', reason: 'expired' } }} onLoggedOut={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Business subscription required');
  expect(screen.getByRole('alert')).toHaveTextContent('contact the business owner');
  expect(screen.queryByText('Choose or renew your plan')).not.toBeInTheDocument();
});
