import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerChats } from '../CustomerChats';
import { request } from '../api';
let account;
vi.mock('../api', () => ({ request: vi.fn(), requestChatImage: vi.fn(), API: '/api' }));
vi.mock('../CustomerAccount', () => ({ useCustomer: () => account }));
beforeEach(() => {
  account = { customer: { id: 1 }, loading: false };
  request.mockReset();
  window.history.replaceState({ mkposShopNavigation: { key: 'chat-entry', source: 'order-entry' } }, '', '#/chats?shop=demo');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('opens the shop conversation page and preserves the original Back entry', async () => {
  request.mockResolvedValue({ thread: { uuid: 'demo-thread' } });
  render(<CustomerChats slug="demo" />);
  await waitFor(() => expect(window.location.hash).toBe('#/chats/demo-thread'));
  expect(request).toHaveBeenCalledExactlyOnceWith('/stores/demo/chat', { method: 'POST', body: '{}', customerAuth: true });
  expect(window.history.state.mkposShopNavigation).toEqual({ key: 'chat-entry', source: 'order-entry' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('retries a failed shop conversation lookup on the page', async () => {
  request.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce({ thread: { uuid: 'demo-thread' } });
  render(<CustomerChats slug="demo" />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(window.location.hash).toBe('#/chats/demo-thread'));
  expect(request).toHaveBeenCalledTimes(2);
});
it('does not navigate after the user leaves during a pending lookup', async () => {
  let resolve;
  request.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<CustomerChats slug="demo" />);
  view.unmount();
  resolve({ thread: { uuid: 'demo-thread' } });
  await Promise.resolve();
  expect(window.location.hash).toBe('#/chats?shop=demo');
});
it('preserves the selected shop through guest sign in without opening a session', () => {
  account.customer = null;
  render(<CustomerChats slug="demo shop" />);
  expect(screen.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '#/account/login?next=%2Fchats%3Fshop%3Ddemo%2520shop');
  expect(request).not.toHaveBeenCalled();
});
