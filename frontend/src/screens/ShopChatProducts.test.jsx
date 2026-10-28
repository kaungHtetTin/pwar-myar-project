import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ChatProductCard, ChatProductPicker } from './ShopChatProducts';
import { ShopChatConversation } from './ShopChatConversation';

vi.mock('../shopChatRealtime', () => ({ connectShopChat: () => () => {} }));
const product = { id: 42, name: 'Rice', price: 1500, currency: 'Ks', unit_name: 'Bag', store_slug: 'my-shop', photo_url: '/public/rice.jpg' };

it('opens a clickable product card and falls back when the public photo is unavailable', () => {
  const onOpen = vi.fn();
  render(<ChatProductCard product={product} href="#/store/my-shop/products/42" onOpen={onOpen} />);
  const link = screen.getByRole('link', { name: 'View product Rice' });
  expect(link).toHaveAttribute('href', '#/store/my-shop/products/42');
  expect(screen.getByText('1,500 Ks / Bag')).toBeInTheDocument();
  fireEvent.error(link.querySelector('img'));
  expect(link.querySelector('img')).toBeNull();
  fireEvent.click(link);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('searches the public catalog and loads another page without losing the first', async () => {
  const api = vi.fn(async path => ({ items: [path.includes('after_id=42') ? { ...product, id: 43, name: 'Tea' } : product], next_cursor: path.includes('after_id=42') ? null : 42 }));
  const onSelect = vi.fn();
  render(<ChatProductPicker apiRequest={api} path="/chat/thread/products" onSelect={onSelect} onClose={vi.fn()} />);
  await screen.findByRole('button', { name: /Rice/ });
  fireEvent.click(screen.getByRole('button', { name: 'More products' }));
  await screen.findByRole('button', { name: /Tea/ });
  expect(screen.getByRole('button', { name: /Rice/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search chat products' }), { target: { value: 'Rice' } });
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/chat/thread/products?q=Rice&after_id=0'));
  await waitFor(() => expect(screen.queryByRole('button', { name: /Tea/ })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Rice/ }));
  expect(onSelect).toHaveBeenCalledWith(product);
});

it('sends a selected product with an optional message and retains it after a failed send', async () => {
  const payloads = [];
  const api = vi.fn(async (path, options) => {
    if (path.includes('/products?')) return { items: [product], next_cursor: null };
    if (options?.method === 'POST') {
      payloads.push(JSON.parse(options.body));
      if (payloads.length === 1) throw new Error('Try again');
      return { message: { id: 1, sender: 'owner', body: payloads.at(-1).body, product, created_at: '2026-10-07 10:00:00' } };
    }
    return { items: [], has_more: false };
  });
  render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('No messages yet. Start the conversation.');
  fireEvent.click(screen.getByRole('button', { name: 'Share product' }));
  fireEvent.click(await screen.findByRole('button', { name: /Rice/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Here is the product' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText(/Try again/);
  expect(screen.getByRole('button', { name: 'Remove product' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  const card = await screen.findByRole('link', { name: 'View product Rice' });
  expect(card).toHaveAttribute('href', expect.stringContaining('/#/store/my-shop/products/42'));
  expect(card).toHaveAttribute('target', '_blank');
  expect(payloads[0]).toEqual(payloads[1]);
  expect(payloads[0]).toMatchObject({ product_id: 42, body: 'Here is the product' });
  expect(screen.queryByRole('button', { name: 'Remove product' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
});

it('removes a product without sending and hides sharing controls for read-only chat', async () => {
  const api = vi.fn(async path => path.includes('/products?') ? { items: [product], next_cursor: null } : { items: [], has_more: false });
  const view = render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('No messages yet. Start the conversation.');
  fireEvent.click(screen.getByRole('button', { name: 'Share product' }));
  fireEvent.click(await screen.findByRole('button', { name: /Rice/ }));
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove product' }));
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  view.rerender(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" canSend={false} />);
  expect(screen.queryByRole('button', { name: 'Share product' })).not.toBeInTheDocument();
  expect(api.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});


it('overlays the chat and dismisses without losing the message draft', async () => {
  const api = vi.fn(async path => path.includes('/products?') ? { items: [product], next_cursor: null } : { items: [], has_more: false });
  render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />);
  await screen.findByText('No messages yet. Start the conversation.');
  const message = screen.getByRole('textbox', { name: 'Message' });
  const trigger = screen.getByRole('button', { name: 'Share product' });
  fireEvent.change(message, { target: { value: 'Keep this draft' } });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Choose product' })).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('searchbox', { name: 'Search chat products' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(message).toHaveValue('Keep this draft');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Close product picker' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('dialog').parentElement);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(message).toHaveValue('Keep this draft');
  expect(api.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
