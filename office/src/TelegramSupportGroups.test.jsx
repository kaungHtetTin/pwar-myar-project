import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import TelegramSupportGroups from './TelegramSupportGroups';

vi.mock('./api', () => ({ api: vi.fn() }));
const group = { id: 1, chat_id: '-1009001', title: 'PwarMyar users', status: 'pending', is_member: true, version: 1,
  daily_limit: 100, per_user_daily_limit: 20, reply_mentions: true, reply_to_bot: true, requests_today: 0 };
const result = { groups: [group], total: 1, page: 1, per_page: 25, last_page: 1 };
beforeEach(() => { api.mockReset(); api.mockResolvedValue(result); });

it('shows why an approved group is blocked and keeps the input check in its editor', async () => {
  api.mockResolvedValue({ ...result, groups: [{ ...group, status: 'approved', reply_blocker: 'bot_username_missing', last_update: { reason: 'bot_username_missing', checked_at: '2026-10-27T00:00:00Z' } }] });
  render(<TelegramSupportGroups active refreshToken={0} botIdentity="fixture" />);
  await screen.findByText('Register webhook to save the bot username');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for PwarMyar users' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Manage group' }));
  expect(within(screen.getByRole('dialog')).getByText('Register webhook to save the bot username')).toBeInTheDocument();
});

it('retains groups and search on return and closing an editor makes no request', async () => {
  const view = render(<TelegramSupportGroups active refreshToken={0} botIdentity="fixture" />);
  await screen.findByText('PwarMyar users');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unsent search' } });
  fireEvent.click(screen.getByRole('button', { name: 'Actions for PwarMyar users' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Manage group' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api).toHaveBeenCalledTimes(1);
  view.rerender(<TelegramSupportGroups active={false} refreshToken={0} botIdentity="fixture" />);
  view.rerender(<TelegramSupportGroups active refreshToken={0} botIdentity="fixture" />);
  expect(screen.getByRole('searchbox')).toHaveValue('unsent search');
  expect(api).toHaveBeenCalledTimes(1);
});

it('applies and clears search and filters and changes page size using shared controls', async () => {
  render(<TelegramSupportGroups active refreshToken={0} botIdentity="fixture" />);
  await screen.findByText('PwarMyar users');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'PwarMyar' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('search=PwarMyar')));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'approved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('status=approved')));
  fireEvent.click(screen.getByRole('button', { name: 'Clear search telegram groups' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('search=&status=approved')));
  fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('per_page=50')));
});

it('preserves failed edits and saves approval with group limits once', async () => {
  render(<TelegramSupportGroups active refreshToken={0} botIdentity="fixture" />);
  await screen.findByText('PwarMyar users');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for PwarMyar users' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Manage group' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'approved' } });
  fireEvent.change(screen.getByLabelText('Daily AI requests'), { target: { value: '70' } });
  api.mockRejectedValueOnce(new Error('Save interrupted'));
  fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
  await screen.findByText('Save interrupted');
  expect(screen.getByLabelText('Daily AI requests')).toHaveValue(70);
  let finish;
  api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await act(async () => finish({ message: 'Group settings saved.' }));
  await screen.findByText('Group settings saved.');
  const mutations = api.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(mutations).toHaveLength(2);
  expect(JSON.parse(mutations[1][1].body)).toMatchObject({ version: 1, status: 'approved', daily_limit: 70, per_user_daily_limit: 20 });
});

it('adds a second group without changing the existing group and supports escape dismissal', async () => {
  render(<TelegramSupportGroups active refreshToken={0} botIdentity="fixture" />);
  await screen.findByText('PwarMyar users');
  fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(screen.getByLabelText('Group ID'), { target: { value: '-1009002' } });
  fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Second group' } });
  api.mockResolvedValueOnce({ message: 'Group added.' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add group' }));
  await screen.findByText('Group added.');
  expect(api).toHaveBeenCalledWith('/office/telegram-support/groups', { method: 'POST', body: JSON.stringify({ chat_id: '-1009002', title: 'Second group' }) });
  fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
