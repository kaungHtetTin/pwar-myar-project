import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './settingsUtils';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

it('clears passwords after profile save and retains the saved identity', async () => {
  const session = { user: { role: 'owner', name: 'Owner', email: 'owner@example.test' } };
  apiRequest.mockImplementation(async path => path === '/auth/me' || path === '/auth/profile' ? session
    : path === '/settings' ? DEFAULT_SETTINGS : path === '/price-types' ? { items: ['Retail'], rules: [] } : {});
  const navigate = vi.fn();
  render(<SettingsScreen pathname="/settings/account" onNavigate={navigate} />);
  await screen.findByDisplayValue('Owner');
  for (const name of ['Current password', 'New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(name), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }));
  for (const name of ['Current password', 'New password', 'Confirm password']) expect(screen.getByLabelText(name)).toHaveValue('');
  expect(screen.getByLabelText('Owner name')).toHaveValue('Owner');
});
