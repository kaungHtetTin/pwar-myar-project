import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopCustomerChat } from './ShopCustomerChat';

vi.mock('../api', () => ({ request: vi.fn() }));
const customer = { customer_name: 'Platform buyer', account_type: 'account' };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path, options) => {
    if (path.endsWith('/config')) return { enabled: true, realtime_enabled: false };
    if (path.endsWith('/chat')) return { thread: { uuid: 'customer-thread' } };
    if (path.endsWith('/read')) return {};
    if (options?.method === 'POST') return { message: { id: 2, body: JSON.parse(options.body).body, sender: 'owner' } };
    return { items: [{ id: 1, body: 'Hello shop', sender: 'customer' }], thread: {}, has_more: false };
  });
});
it('uses the customer conversation and retains the draft and messages through minimize, close and reopen', async () => {
  render(<ShopCustomerChat customer={customer} customerKey="account:9" />);
  const open = screen.getByRole('button', { name: 'Open chat with Platform buyer' });
  expect(open.closest('.workspace-app-bar-action-group')).not.toBeNull();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(open);
  await screen.findByText('Hello shop');
  expect(request).toHaveBeenCalledWith('/shop-admin/customers/account%3A9/chat', { method: 'POST', body: '{}' });
  const message = screen.getByRole('textbox', { name: 'Message' });
  fireEvent.change(message, { target: { value: 'An unsent reply' } });
  const reads = request.mock.calls.filter(([path]) => path.endsWith('/messages')).length;
  fireEvent.click(screen.getByRole('button', { name: 'Minimize chat' }));
  expect(message).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Expand chat with Platform buyer' }));
  expect(message).toBeVisible();
  expect(message).toHaveValue('An unsent reply');
  fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
  expect(message).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open chat with Platform buyer' }));
  expect(message).toHaveValue('An unsent reply');
  expect(request.mock.calls.filter(([path]) => path.endsWith('/messages'))).toHaveLength(reads);
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('An unsent reply');
  expect(message).toHaveValue('');
  expect(request.mock.calls.filter(([path, options]) => path.endsWith('/messages') && options?.method === 'POST')).toHaveLength(1);
});
it('retries initialization after failure', async () => {
  request.mockRejectedValueOnce(new Error('Chat unavailable'));
  render(<ShopCustomerChat customer={customer} customerKey="account:9" />);
  fireEvent.click(screen.getByRole('button', { name: 'Open chat with Platform buyer' }));
  await screen.findByText('Chat unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry chat' }));
  await screen.findByText('Hello shop');
});
it('does not create a conversation when chat is disabled', async () => {
  request.mockResolvedValue({ enabled: false });
  render(<ShopCustomerChat customer={customer} customerKey="account:9" />);
  fireEvent.click(screen.getByRole('button', { name: 'Open chat with Platform buyer' }));
  await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledTimes(1);
});
