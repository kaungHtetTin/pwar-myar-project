import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { configureTimezone, getBusinessTimezone } from '../timezone';
import { BusinessTimezoneSettings } from './BusinessTimezoneSettings';
import { SettingsScreen } from './SettingsScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
const meta = { timezone: 'Asia/Yangon', options: ['Asia/Yangon', 'Asia/Bangkok', 'America/New_York'] };
const session = { user: { id: 1, name: 'Owner', email: 'owner@example.test', role: 'owner' }, business: { id: 1, timezone: 'Asia/Bangkok' }, storage_timezone: 'Asia/Yangon' };
beforeEach(() => {
  window.localStorage.clear();
  apiRequest.mockReset();
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === '/settings/timezone') return options.method === 'PUT' ? { timezone: 'Asia/Bangkok', session } : meta;
    if (path === '/auth/me') return session;
    if (path === '/settings') return { shop_name: 'Demo', language: 'en', receipt_paper_size: '80mm' };
    if (path === '/price-types') return { items: [], rules: [] };
    if (path === '/data/status') return { ok: true, total_records: 0 };
    return {};
  });
});
afterEach(() => configureTimezone({ business: { timezone: 'Asia/Yangon' }, storage_timezone: 'Asia/Yangon' }));

it('saves only the business timezone and updates the active session', async () => {
  const onSaved = vi.fn(), updated = vi.fn();
  window.addEventListener('mkpos:session-updated', updated);
  render(<BusinessTimezoneSettings onSaved={onSaved} onCancel={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  expect(screen.getByLabelText('Business time zone')).toHaveValue('Asia/Yangon');
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(apiRequest).toHaveBeenCalledWith('/settings/timezone', { method: 'PUT', body: JSON.stringify({ timezone: 'Asia/Bangkok', expected_timezone: 'Asia/Yangon' }) });
  expect(getBusinessTimezone()).toBe('Asia/Bangkok');
  expect(updated.mock.calls[0][0].detail).toEqual(session);
  expect(apiRequest.mock.calls.some(([path, options]) => path === '/settings' && options?.method === 'PUT')).toBe(false);
  window.removeEventListener('mkpos:session-updated', updated);
});

it('preserves a failed selection and supports a successful retry', async () => {
  const onSaved = vi.fn();
  apiRequest.mockImplementation(async (_path, options = {}) => {
    if (options.method === 'PUT') throw Object.assign(new Error('Invalid'), { payload: { errors: { timezone: ['Choose a valid time zone.'] } } });
    return meta;
  });
  render(<BusinessTimezoneSettings onSaved={onSaved} onCancel={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
  expect(await screen.findByText('Choose a valid time zone.')).toBeInTheDocument();
  expect(screen.getByLabelText('Business time zone')).toHaveValue('Asia/Bangkok');
  expect(screen.getByLabelText('Business time zone')).toHaveAttribute('aria-invalid', 'true');
  apiRequest.mockResolvedValue({ timezone: 'Asia/Bangkok', session });
  fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});

it('prevents duplicate submissions while a save is pending', async () => {
  let resolve;
  apiRequest.mockImplementation(async (_path, options = {}) => options.method === 'PUT' ? new Promise(done => { resolve = done; }) : meta);
  render(<BusinessTimezoneSettings onCancel={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.submit(screen.getByRole('form', { name: 'Business time zone settings' }));
  fireEvent.submit(screen.getByRole('form', { name: 'Business time zone settings' }));
  expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  resolve({ timezone: 'Asia/Yangon', session: { ...session, business: { ...session.business, timezone: 'Asia/Yangon' } } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
});

it('handles an old server and retries loading without losing access to Cancel', async () => {
  const onCancel = vi.fn();
  apiRequest.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));
  render(<BusinessTimezoneSettings onCancel={onCancel} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Update the backend');
  expect(screen.getByRole('button', { name: 'Save time zone' })).toBeDisabled();
  apiRequest.mockResolvedValue(meta);
  fireEvent.click(screen.getByRole('button', { name: 'Reload time zones' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
});

it('uses a full-page route and returns to the retained Settings source on Back or Save', async () => {
  const onNavigate = vi.fn();
  const view = pathname => <LocaleProvider><SettingsScreen pathname={pathname} onNavigate={onNavigate} /></LocaleProvider>;
  const ui = render(view('/settings'));
  fireEvent.click(await screen.findByRole('button', { name: /Time zone/ }));
  expect(onNavigate).toHaveBeenLastCalledWith('/settings/timezone');
  const loads = () => apiRequest.mock.calls.filter(([path]) => path === '/settings').length;
  const initialLoads = loads();
  ui.rerender(view('/settings/timezone'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back to settings' }));
  expect(onNavigate).toHaveBeenLastCalledWith('/settings');
  ui.rerender(view('/settings'));
  expect(loads()).toBe(initialLoads);
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  ui.rerender(view('/settings/timezone'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save time zone' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Asia/Bangkok' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
  await waitFor(() => expect(onNavigate).toHaveBeenLastCalledWith('/settings', { replace: true }));
  ui.rerender(view('/settings'));
  expect(screen.getByText('Business time zone saved.')).toBeInTheDocument();
  expect(loads()).toBe(initialLoads);
});

it('rejects a staff deep link before requesting owner-only timezone metadata', async () => {
  const original = apiRequest.getMockImplementation();
  apiRequest.mockImplementation((path, options) => path === '/auth/me' ? Promise.resolve({ ...session, user: { ...session.user, role: 'staff' } }) : original(path, options));
  render(<LocaleProvider><SettingsScreen pathname="/settings/timezone" onNavigate={vi.fn()} /></LocaleProvider>);
  expect(await screen.findByText('Owner access required')).toBeInTheDocument();
  expect(apiRequest.mock.calls.some(([path]) => path === '/settings/timezone')).toBe(false);
});
