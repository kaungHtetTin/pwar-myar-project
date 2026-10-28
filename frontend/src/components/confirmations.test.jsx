import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ConfirmationProvider, useConfirmation } from './confirmations';

vi.mock('../api', () => ({ request: vi.fn() }));

function ProtectedAction() {
  const confirm = useConfirmation();
  return <button type="button" onClick={() => confirm({ title: 'Delete sale', requirePin: true })}>Delete</button>;
}

beforeEach(() => request.mockReset());

describe('protected action confirmation', () => {
  it('does not render a PIN input when no admin PIN is configured', async () => {
    request.mockResolvedValue({ admin_pin_set: '0' });
    render(<ConfirmationProvider><ProtectedAction /></ConfirmationProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('dialog', { name: 'Delete sale' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Admin PIN')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    expect(request).toHaveBeenCalledWith('/settings');
  });

  it('renders the PIN input only when protection is configured', async () => {
    request.mockResolvedValue({ admin_pin_set: '1' });
    render(<ConfirmationProvider><ProtectedAction /></ConfirmationProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByLabelText('Admin PIN')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Admin PIN'), { target: { value: '2468' } });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });
});
