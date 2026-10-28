import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { configureTimezone, getBusinessTimezone } from '../timezone';
import { BusinessTimezoneSettings } from './BusinessTimezoneSettings';
import { SettingsScreen } from './SettingsScreen';
import { NotificationProvider } from '../components/notifications';
import { ConfirmationProvider } from '../components/confirmations';

vi.mock('../api', () => ({ request: vi.fn(), requestDownload: vi.fn() }));

const meta = { timezone: 'Asia/Yangon', options: ['Asia/Yangon', 'Asia/Bangkok', 'America/New_York'] };
const session = { user: { id: 1, role: 'owner', name: 'Owner', email: 'owner@example.test' }, business: { id: 1, timezone: 'Asia/Bangkok' }, storage_timezone: 'Asia/Yangon' };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path, options = {}) => {
    if (path === '/settings/timezone') return options.method === 'PUT' ? { timezone: 'Asia/Bangkok', session } : meta;
    if (path === '/settings') return { shop_name: 'Demo', receipt_paper_size: '80mm', language: 'en', payment_methods: 'Cash' };
    if (path === '/auth/me') return session;
    if (path === '/settings/printers' || path === '/price-types') return { items: [] };
    if (path === '/data/status') return { ok: true, total_records: 0 };
    throw new Error(`Unexpected request: ${path}`);
  });
});
afterEach(() => { configureTimezone({ business: { timezone: 'Asia/Yangon' }, storage_timezone: 'Asia/Yangon' }); });

it('saves through the dedicated endpoint and updates the active business timezone', async () => {
  const onSaved = vi.fn(), updated = vi.fn();
  window.addEventListener('mkpos:session-updated', updated);
  render(<BusinessTimezoneSettings onSaved={onSaved} onCancel={vi.fn()} />);
  const save = await screen.findByRole('button', { name: 'Save time zone' });
  await waitFor(() => expect(save).toBeEnabled());
  expect(screen.getByLabelText('Business time zone')).toHaveValue('Asia/Yangon');
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.click(save);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith('/settings/timezone', { method: 'PUT', body: JSON.stringify({ timezone: 'Asia/Bangkok', expected_timezone: 'Asia/Yangon' }) });
  expect(updated.mock.calls[0][0].detail).toEqual(session);
  expect(getBusinessTimezone()).toBe('Asia/Bangkok');
  expect(request.mock.calls.some(([path, options]) => path === '/settings' && options?.method === 'PUT')).toBe(false);
  window.removeEventListener('mkpos:session-updated', updated);
});

it('guards duplicate submissions and disables cancellation while saving', async () => {
  let resolve;
  request.mockImplementation(async (_path, options = {}) => {
    if (options.method !== 'PUT') return meta;
    return new Promise(done => { resolve = done; });
  });
  render(<BusinessTimezoneSettings onCancel={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Business time zone settings' }));
  fireEvent.submit(screen.getByRole('form', { name: 'Business time zone settings' }));
  expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  resolve({ timezone: 'Asia/Bangkok', session });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
});

it('shows validation and concurrent-edit errors without discarding the selection', async () => {
  const failure = Object.assign(new Error('Invalid time zone'), { payload: { errors: { timezone: ['Choose a valid named time zone.'] } } });
  request.mockImplementation(async (_path, options = {}) => { if (options.method === 'PUT') throw failure; return meta; });
  render(<BusinessTimezoneSettings onCancel={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid named time zone.');
  expect(screen.getByLabelText('Business time zone')).toHaveValue('Asia/Bangkok');
  request.mockImplementation(async (_path, options = {}) => { if (options.method === 'PUT') throw new Error('The business time zone changed on another device. Refresh this page before saving.'); return { ...meta, timezone: 'America/New_York' }; });
  fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
  expect(await screen.findByText(/changed on another device/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reload time zones' }));
  await waitFor(() => expect(screen.getByLabelText('Business time zone')).toHaveValue('America/New_York'));
});

it('handles an old server without enabling a save and allows cancellation', async () => {
  request.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));
  const onCancel = vi.fn();
  render(<BusinessTimezoneSettings onCancel={onCancel} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Update the backend');
  expect(screen.getByRole('button', { name: 'Save time zone' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
});

it('opens from Settings and cancels back to the retained Shop tab without saving', async () => {
  render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
  fireEvent.change(await screen.findByLabelText('Shop Name'), { target: { value: 'Unsaved shop draft' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Time zone' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  const settingsLoads = request.mock.calls.filter(([path]) => path === '/settings').length;
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Shop' })).toHaveClass('selected');
  expect(screen.getByLabelText('Shop Name')).toHaveValue('Unsaved shop draft');
  expect(request.mock.calls.filter(([path]) => path === '/settings')).toHaveLength(settingsLoads);
  expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});
