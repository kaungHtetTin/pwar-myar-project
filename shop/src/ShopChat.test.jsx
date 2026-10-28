import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShopChat } from './ShopChat';
let account;
vi.mock('./CustomerAccount', () => ({ useCustomer: () => account }));
beforeEach(() => { account = { customer: { id: 42 }, loading: false }; });
afterEach(cleanup);
it('links directly to the full chat page for the selected shop without a dialog', () => {
  render(<ShopChat slug="demo shop" />);
  expect(screen.getByRole('link', { name: 'Chat with shop' })).toHaveAttribute('href', '#/chats?shop=demo%20shop');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('takes guests to the same shop chat destination for sign in', () => {
  account.customer = null;
  render(<ShopChat slug="demo" />);
  expect(screen.getByRole('link', { name: 'Sign in to chat with shop' })).toHaveAttribute('href', '#/chats?shop=demo');
});
it('waits for the account session before showing the chat link', () => {
  account.loading = true;
  render(<ShopChat slug="demo" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});