import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { SalesTelegramPage } from './SalesTelegramPage';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const settings = { version: 2, enabled: true, groups_enabled: true, daily_limit: 200, per_user_limit: 20, token_configured: true, webhook_url: 'https://fixture.test/webhook', bot_username: 'fixture_bot' };
const group = { id: 1, version: 1, chat_id: -100123, title: 'Shop customers', status: 'pending', is_member: true, reply_mentions: true, reply_to_bot: true, daily_limit: 100, per_user_limit: 20 };
beforeEach(() => { vi.clearAllMocks(); apiRequest.mockImplementation(async path => path.endsWith('/groups/1') ? { group } : path.includes('/groups?') ? { items: [group], total: 1 } : { settings }); });
function Harness() { const [path, setPath] = useState('/shop/sales-ai/telegram'); return <SalesTelegramPage pathname={path} onNavigate={setPath} />; }
it('keeps the connection draft and loaded groups when cancelling a full-page group editor', async () => {
  render(<Harness />);
  await screen.findByText('Shop customers');
  fireEvent.change(screen.getByLabelText('Bot token'), { target: { value: 'unsaved-secret' } });
  fireEvent.click(screen.getByRole('button', { name: /Shop customers/ }));
  await screen.findByLabelText('Group name');
  expect(screen.queryByRole('button', { name: 'Save Telegram settings' })).not.toBeInTheDocument();
  const reads = apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  expect(screen.getByLabelText('Bot token')).toHaveValue('unsaved-secret');
  expect(apiRequest).toHaveBeenCalledTimes(reads);
  expect(screen.getByRole('button', { name: 'Register webhook' })).toBeDisabled();
});
it('shows validation next to the field and keeps edits after a failed save', async () => {
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') throw Object.assign(new Error('Invalid group'), { payload: { errors: { title: ['Choose a name'] } } });
    return path.endsWith('/groups/1') ? { group } : path.includes('/groups?') ? { items: [group], total: 1 } : { settings };
  });
  render(<SalesTelegramPage pathname="/shop/sales-ai/telegram/groups/1" onNavigate={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Group name'), { target: { value: 'Retained group' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
  await waitFor(() => expect(screen.getByLabelText('Group name')).toHaveAttribute('aria-describedby', 'tg-group-title-error'));
  expect(screen.getByText('Choose a name')).toBeInTheDocument();
  expect(screen.getByLabelText('Group name')).toHaveValue('Retained group');
});

it('keeps local settings edits while applying confirmed assistant settings', async () => {
  render(<Harness />);
  await screen.findByText('Shop customers');
  fireEvent.change(screen.getByLabelText('Bot token'), { target: { value: 'keep-private-draft' } });
  fireEvent.change(screen.getByLabelText('Daily Telegram AI requests'), { target: { value: '333' } });
  const reads = apiRequest.mock.calls.length;
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-telegram-updated', { detail: { settings: { ...settings, version: 3, groups_enabled: false, daily_limit: 400, per_user_limit: 30 } } })));
  expect(screen.getByLabelText('Bot token')).toHaveValue('keep-private-draft');
  expect(screen.getByLabelText('Daily Telegram AI requests')).toHaveValue(333);
  expect(screen.getByLabelText('Daily AI requests per Telegram user')).toHaveValue(30);
  expect(screen.getByLabelText('Enable replies in approved groups')).not.toBeChecked();
  expect(apiRequest).toHaveBeenCalledTimes(reads);
});
