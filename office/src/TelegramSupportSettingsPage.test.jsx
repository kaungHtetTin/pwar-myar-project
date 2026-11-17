import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import TelegramSupportSettingsPage from './TelegramSupportSettingsPage';

vi.mock('./api', () => ({ api: vi.fn(), officeApiBase: '/api' }));
vi.mock('./TelegramSupportGroups', () => ({ default: () => <div>Group settings list</div> }));
const settings = { enabled: true, webhook_url: 'https://example.test/integrations/telegram/customer-service', daily_limit: 200, per_chat_daily_limit: 20, version: 1, token_configured: true, storage_ready: true };
const connection = { bot_username: 'fixture_support_bot', webhook_status: 'not_registered', pending_updates: 0 };
beforeEach(() => { api.mockReset(); api.mockResolvedValue({ settings }); });

it('shows Telegram delivery diagnostics without registering or saving automatically', async () => {
  render(<TelegramSupportSettingsPage/>);
  await screen.findByLabelText(/^Bot token/);
  api.mockResolvedValueOnce({ connection: { ...connection, group_privacy_enabled: true, username_matches_saved: false, message_updates_enabled: false }, message: 'Telegram connection verified.' });
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  await screen.findByText(/Bot username is missing or different/);
  expect(screen.getByText(/Telegram message updates are disabled/)).toBeInTheDocument();
  expect(screen.getByText(/plain mentions may not arrive/)).toBeInTheDocument();
  expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
});

it('preserves image and admin notice drafts on failure and saves the chosen group and topic', async () => {
  const view = render(<TelegramSupportSettingsPage/>);
  await screen.findByLabelText('Image reading');
  expect(screen.getByLabelText('Admin receipt notices')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Image reading'), { target: { value: 'true' } });
  fireEvent.change(screen.getByLabelText('Admin receipt notices'), { target: { value: 'true' } });
  fireEvent.change(screen.getByLabelText('Admin group chat ID'), { target: { value: '-100777' } });
  fireEvent.change(screen.getByLabelText('Admin group topic ID'), { target: { value: '77' } });
  view.rerender(<TelegramSupportSettingsPage active={false}/>);
  view.rerender(<TelegramSupportSettingsPage/>);
  expect(api).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Admin group chat ID')).toHaveValue('-100777');
  api.mockRejectedValueOnce(new Error('Group validation failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Group validation failed');
  expect(screen.getByLabelText('Admin group topic ID')).toHaveValue(77);
  api.mockResolvedValueOnce({ settings: { ...settings, images_enabled: true, receipt_notices_enabled: true, admin_group_chat_id: -100777, admin_group_thread_id: 77, version: 2 }, message: 'Telegram settings saved.' });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Telegram settings saved.');
  const mutations = api.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(mutations[1][1].body)).toMatchObject({ images_enabled: true, receipt_notices_enabled: true, admin_group_chat_id: '-100777', admin_group_thread_id: 77 });
  fireEvent.change(screen.getByLabelText('Image reading'), { target: { value: 'false' } });
  expect(screen.getByLabelText('Admin receipt notices')).toHaveValue('false');
  expect(screen.getByLabelText('Admin receipt notices')).toBeDisabled();
});

it('saves the global group switch separately from each group approval', async () => {
  render(<TelegramSupportSettingsPage/>);
  const toggle = await screen.findByLabelText('Group replies');
  expect(toggle).toHaveValue('false');
  fireEvent.change(toggle, { target: { value: 'true' } });
  api.mockResolvedValueOnce({ settings: { ...settings, groups_enabled: true, version: 2 }, message: 'Telegram settings saved.' });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Telegram settings saved.');
  expect(JSON.parse(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).groups_enabled).toBe(true);
});

it('keeps the saved token hidden and tests a draft without saving or registering', async () => {
  render(<TelegramSupportSettingsPage/>);
  const input = await screen.findByLabelText(/^Bot token/);
  expect(input).toHaveValue(''); expect(input).toHaveAttribute('type', 'password');
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: '123456:fixture_token_12345678901234567890' } });
  expect(screen.getByRole('button', { name: 'Register webhook' })).toBeDisabled();
  api.mockResolvedValueOnce({ connection, message: 'Telegram connection verified.' });
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  await screen.findByText('Telegram connection verified.');
  expect(api).toHaveBeenLastCalledWith('/office/telegram-support/test-connection', { method: 'POST', body: JSON.stringify({ bot_token: input.value }) });
  expect(input).not.toHaveValue(''); expect(api).toHaveBeenCalledTimes(2);
});

it('preserves a failed save draft, prevents duplicates, and clears the token only after saving', async () => {
  render(<TelegramSupportSettingsPage/>);
  const input = await screen.findByLabelText(/^Bot token/);
  fireEvent.change(input, { target: { value: '123456:fixture_token_12345678901234567890' } });
  fireEvent.change(screen.getByLabelText('Daily AI requests, all chats'), { target: { value: '100' } });
  let reject;
  api.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  reject(new Error('Connection interrupted'));
  await screen.findByRole('alert');
  expect(input).not.toHaveValue(''); expect(screen.getByLabelText('Daily AI requests, all chats')).toHaveValue(100);
  api.mockResolvedValueOnce({ settings: { ...settings, daily_limit: 100, version: 2 }, message: 'Telegram settings saved.' });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Telegram settings saved.');
  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Register webhook' })).toBeEnabled();
  expect(api.mock.calls.filter(([path, options]) => path === '/office/telegram-support' && options?.method === 'PUT')).toHaveLength(2);
});

it('registers the saved configuration only after an explicit click with the replacement choice', async () => {
  render(<TelegramSupportSettingsPage/>);
  await screen.findByLabelText(/^Bot token/);
  api.mockResolvedValueOnce({ settings: { ...settings, version: 2 }, connection: { ...connection, webhook_status: 'registered' }, message: 'Telegram webhook registered.' });
  fireEvent.click(screen.getByLabelText('Replace an existing webhook for this bot'));
  fireEvent.click(screen.getByRole('button', { name: 'Register webhook' }));
  await screen.findByText('Telegram webhook registered.');
  expect(api).toHaveBeenLastCalledWith('/office/telegram-support/register-webhook', { method: 'POST', body: JSON.stringify({ version: 1, replace_existing: true }) });
  expect(screen.getByLabelText('Replace an existing webhook for this bot')).not.toBeChecked();
  expect(screen.getByRole('link', { name: 'Worker health' })).toHaveAttribute('href', '/api/health/workers');
});

it('retains unsaved settings and token when returning to the tab, including after refresh', async () => {
  const view = render(<TelegramSupportSettingsPage/>);
  const input = await screen.findByLabelText(/^Bot token/);
  fireEvent.change(input, { target: { value: '123456:fixture_token_12345678901234567890' } });
  fireEvent.change(screen.getByLabelText('Daily AI requests per chat'), { target: { value: '30' } });
  view.rerender(<TelegramSupportSettingsPage active={false}/>);
  view.rerender(<TelegramSupportSettingsPage/>);
  expect(api).toHaveBeenCalledTimes(1);
  view.rerender(<TelegramSupportSettingsPage refreshToken={1}/>);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(input).not.toHaveValue(''); expect(screen.getByLabelText('Daily AI requests per chat')).toHaveValue(30);
  expect(screen.getByRole('button', { name: 'Register webhook' })).toBeDisabled();
  api.mockRejectedValueOnce(new Error('Refresh interrupted'));
  view.rerender(<TelegramSupportSettingsPage refreshToken={2}/>);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved settings' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(input).not.toHaveValue(''); expect(screen.getByLabelText('Daily AI requests per chat')).toHaveValue(30);
});
