import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminAuthorizationDialog } from './AdminAuthorizationDialog';
import { withAdminAuthorization } from '../../../shared/network/adminAuthorization';

const challenge = (recovery = false) => Object.assign(new Error('Admin PIN is required for this action.'), { status: 403, code: 'admin_pin_required', payload: { allow_owner_recovery: recovery } });
afterEach(() => vi.restoreAllMocks());

describe('admin authorization confirmation', () => {
  it('retries only the blocked mutation, clears its secret, and preserves the original draft', async () => {
    render(<><input aria-label="Draft name" defaultValue="Unsaved product" /><AdminAuthorizationDialog /></>);
    const options = { method: 'PUT', body: JSON.stringify({ name: 'Unsaved product' }) };
    const perform = vi.fn().mockRejectedValueOnce(challenge()).mockResolvedValue({ ok: true });
    const result = withAdminAuthorization('/products/1', options, perform);
    fireEvent.change(await screen.findByLabelText('Admin PIN'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'Authorize', exact: true }));
    await expect(result).resolves.toEqual({ ok: true });
    expect(perform).toHaveBeenCalledTimes(2);
    expect(JSON.parse(perform.mock.calls[1][1].body)).toEqual({ name: 'Unsaved product', authorization_pin: '2468' });
    expect(JSON.parse(options.body)).toEqual({ name: 'Unsaved product' });
    expect(screen.getByLabelText('Draft name')).toHaveValue('Unsaved product');
    expect(screen.queryByLabelText('Admin PIN')).not.toBeInTheDocument();
  });
  it('cancels without retrying and clears the secret before the next authorization', async () => {
    render(<AdminAuthorizationDialog />);
    const perform = vi.fn().mockRejectedValue(challenge());
    const result = withAdminAuthorization('/products/1', { method: 'DELETE' }, perform);
    const assertion = expect(result).rejects.toMatchObject({ code: 'admin_pin_cancelled' });
    fireEvent.change(await screen.findByLabelText('Admin PIN'), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await assertion;
    expect(perform).toHaveBeenCalledTimes(1);
    const next = withAdminAuthorization('/products/1', { method: 'DELETE' }, perform);
    const nextAssertion = expect(next).rejects.toMatchObject({ code: 'admin_pin_cancelled' });
    expect(await screen.findByLabelText('Admin PIN')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await nextAssertion;
  });
  it('offers owner password recovery only when the server allows it', async () => {
    render(<AdminAuthorizationDialog />);
    const perform = vi.fn().mockRejectedValueOnce(challenge(true)).mockResolvedValue({ ok: true });
    const result = withAdminAuthorization('/settings', { method: 'PUT', body: JSON.stringify({ admin_pin: '8642' }) }, perform);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Use owner password to recover PIN' }));
    fireEvent.change(screen.getByLabelText('Owner password'), { target: { value: 'owner-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Authorize', exact: true }));
    await result;
    expect(JSON.parse(perform.mock.calls[1][1].body)).toEqual({ admin_pin: '8642', owner_password: 'owner-password' });
  });
  it('cancels an abandoned request without saving or leaving an authorization prompt open', async () => {
    render(<AdminAuthorizationDialog />);
    const controller = new AbortController();
    const perform = vi.fn().mockRejectedValue(challenge());
    const result = withAdminAuthorization('/products/1', { method: 'DELETE', signal: controller.signal }, perform);
    const assertion = expect(result).rejects.toMatchObject({ code: 'admin_pin_cancelled' });
    await screen.findByLabelText('Admin PIN');
    act(() => controller.abort());
    await assertion;
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Admin authorization' })).not.toBeInTheDocument());
    expect(perform).toHaveBeenCalledTimes(1);
  });
});
