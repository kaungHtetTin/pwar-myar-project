import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { AccessManagementScreen } from './AccessManagementScreen';

vi.mock('../api', () => ({ request: vi.fn() }));

describe('AccessManagementScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockImplementation(async (path, options = {}) => {
      if (path === '/roles' && !options.method) return {
        modules: [],
        items: [{ id: 4, name: 'Cashier', permissions: ['sell'], staff_count: 1 }],
      };
      if (path === '/staff') return {
        items: [{ id: 8, name: 'Staff One', email: 'staff@example.com', is_active: true, access_role_id: 4, access_role: { id: 4, name: 'Cashier', permissions: ['sell'] } }],
      };
      if (path === '/roles' && options.method === 'POST') return { id: 5, name: 'Inventory' };
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('shows roles and staff and creates a role with selected page access', async () => {
    render(<NotificationProvider><ConfirmationProvider><AccessManagementScreen /></ConfirmationProvider></NotificationProvider>);

    expect(await screen.findByText('Staff One')).toBeInTheDocument();
    expect(screen.getAllByText('Cashier').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'New role' }));
    expect(screen.getByRole('checkbox', { name: /Sales/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Role name'), 'Inventory');
    await userEvent.click(screen.getByRole('checkbox', { name: /Products/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save role' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Inventory', permissions: ['products'] }),
    }));
  });
});
