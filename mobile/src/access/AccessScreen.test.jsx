import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { AccessScreen } from './AccessScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

it('clears submitted staff details and passwords while the create page stays retained', async () => {
  apiRequest.mockImplementation(async path => path.startsWith('/roles?')
    ? { items: [{ id: 4, name: 'Cashier' }], total: 1 }
    : path.startsWith('/staff?') ? { items: [], total: 0 } : { id: 7 });
  const navigate = vi.fn();
  render(<AccessScreen pathname="/access/staff/new" onNavigate={navigate} />);
  await screen.findByRole('option', { name: 'Cashier' });
  fireEvent.change(screen.getByLabelText('Staff name'), { target: { value: 'First staff' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'first@example.test' } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create staff' }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  for (const name of ['Staff name', 'Email', 'Password', 'Confirm password']) expect(screen.getByLabelText(name, { exact: true })).toHaveValue('');
});

it('clears a confirmed password reset without clearing it on failure', async () => {
  let fail = true;
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === '/staff/7/password' && options.method === 'PUT') { if (fail) throw new Error('Password save failed'); return {}; }
    if (path === '/staff/7') return { id: 7, name: 'Staff', is_active: true };
    return { items: [], total: 0 };
  });
  const navigate = vi.fn();
  render(<AccessScreen pathname="/access/staff/7/password" onNavigate={navigate} />);
  await screen.findByText('Staff');
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  await screen.findByText('Password save failed');
  expect(screen.getByLabelText('New password')).toHaveValue('password123');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(screen.getByLabelText('New password')).toHaveValue('');
  expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
});

describe('mobile access role form', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.startsWith('/roles?')) return Promise.resolve({ items: [], modules: [], total: 0 });
      if (path.startsWith('/staff?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/roles' && options.method === 'POST') return Promise.resolve({ id: 4 });
      return Promise.resolve({});
    });
  });

  it('denies staff without requesting owner-only records', () => {
    const navigate = vi.fn();
    render(<AccessScreen pathname="/access" session={{ user: { role: 'staff' } }} onNavigate={navigate} fallbackPath="/sales" />);
    expect(screen.getByRole('heading', { name: 'Permission denied' })).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to authorized workspace' }).at(-1));
    expect(navigate).toHaveBeenCalledWith('/sales', { replace: true });
  });

  it('offers standalone Sales access and saves it independently', async () => {
    const navigate = vi.fn();
    render(<AccessScreen pathname="/access/roles/new" onNavigate={navigate} />);

    const salesPermission = screen.getByRole('checkbox', { name: /Sales/ });
    expect(salesPermission).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Sell/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Transactions/ })).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Sales reviewer' } });
    fireEvent.click(salesPermission);
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sales reviewer', permissions: ['sales'] }),
    }));
    expect(navigate).toHaveBeenCalledWith('/access', { replace: true });
    expect(screen.getByLabelText('Role name')).toHaveValue('');
    expect(salesPermission).not.toBeChecked();
  });
});
