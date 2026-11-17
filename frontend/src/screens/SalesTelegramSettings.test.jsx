import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { SalesTelegramSettings } from './SalesTelegramSettings';
vi.mock('../api', () => ({ request: vi.fn() }));
const settings = { version: 2, enabled: true, groups_enabled: true, daily_limit: 200, per_user_limit: 20, token_configured: true, webhook_url: 'https://fixture.test/integrations/telegram/sales-ai/uuid', bot_username: 'fixture_bot', registered_at: '2026-10-27' };
const group = { id: 1, version: 1, chat_id: -100123, title: 'Shop customers', status: 'pending', is_member: true, reply_mentions: true, reply_to_bot: true, daily_limit: 100, per_user_limit: 20 };
beforeEach(() => { vi.clearAllMocks(); request.mockImplementation(async path => path.includes('/groups') ? { items: [group], total: 1 } : { settings }); });
it('loads groups in StrictMode and prevents test/register with an unsaved token', async () => {
  render(<StrictMode><SalesTelegramSettings /></StrictMode>);
  await screen.findByText('Shop customers');
  expect(screen.getByRole('button', { name: 'Register webhook' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Bot token'), { target: { value: 'replacement-token' } });
  expect(screen.getByRole('button', { name: 'Register webhook' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled();
  expect(screen.getByLabelText('Webhook URL')).toHaveAttribute('readonly');
});
it('retains group edits after validation failure and submits its version on retry', async () => {
  let attempts = 0;
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') { attempts++; if (attempts === 1) throw Object.assign(new Error('Invalid group'), { payload: { errors: { title: ['Choose a name'] } } }); return { group: { ...group, title: 'Updated group', version: 2 } }; }
    return path.includes('/groups') ? { items: [group], total: 1 } : { settings };
  });
  render(<SalesTelegramSettings />);
  fireEvent.click(await screen.findByRole('button', { name: 'Manage group' }));
  expect(screen.getByRole('dialog', { name: 'Manage group' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Updated group' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
  await screen.findByText('Choose a name');
  expect(screen.getByLabelText('Group name')).toHaveValue('Updated group');
  expect(screen.getByLabelText('Telegram group ID')).toHaveAttribute('readonly');
  fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
  await screen.findByText('Telegram group saved.');
  await waitFor(() => expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument());
  const call = request.mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1);
  expect(JSON.parse(call[1].body)).toMatchObject({ version: 1, title: 'Updated group', chat_id: -100123 });
});

it('opens add and manage modals and closes without refetching or losing the settings draft', async () => {
  render(<SalesTelegramSettings />);
  const trigger = await screen.findByRole('button', { name: 'Manage group' });
  fireEvent.change(screen.getByLabelText('Bot token'), { target: { value: 'unsaved-token' } });
  const reads = request.mock.calls.length;
  trigger.focus(); fireEvent.click(trigger);
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Group name'), { target: { value: 'Discarded edit' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(screen.getByLabelText('Bot token')).toHaveValue('unsaved-token');
  expect(request).toHaveBeenCalledTimes(reads);
  fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
  expect(within(screen.getByRole('dialog', { name: 'Add group' })).getByLabelText('Telegram group ID')).not.toHaveAttribute('readonly');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(reads);
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Close Manage group' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('reconciles assistant changes while preserving the token and locally edited limits', async () => {
  render(<SalesTelegramSettings />);
  await screen.findByText('Shop customers');
  fireEvent.change(screen.getByLabelText('Bot token'), { target: { value: 'keep-private-draft' } });
  fireEvent.change(screen.getByLabelText('Daily Telegram AI requests'), { target: { value: '333' } });
  const reads = request.mock.calls.length;
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-telegram-updated', { detail: { settings: { ...settings, version: 3, groups_enabled: false, daily_limit: 400, per_user_limit: 30 } } })));
  expect(screen.getByLabelText('Bot token')).toHaveValue('keep-private-draft');
  expect(screen.getByLabelText('Daily Telegram AI requests')).toHaveValue(333);
  expect(screen.getByLabelText('Daily AI requests per Telegram user')).toHaveValue(30);
  expect(screen.getByLabelText('Enable replies in approved groups')).not.toBeChecked();
  expect(request).toHaveBeenCalledTimes(reads);
});
