import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopChat } from './ShopChat';
import { connectShopChat } from '../shopChatRealtime';

vi.mock('../api', () => ({ request: vi.fn() }));
vi.mock('../shopChatRealtime', () => ({ connectShopChat: vi.fn(() => () => {}) }));
beforeEach(() => {
  request.mockReset();
  connectShopChat.mockClear();
  request.mockImplementation(async (path, options) => {
    if (path.endsWith('/config')) return { realtime_enabled: false, channel: 'private-shop.chat.business.1' };
    if (path.endsWith('/read')) return { ok: true };
    if (path.endsWith('/messages') && options?.method === 'POST') return { message: { ...JSON.parse(options.body), id: 2, sender: 'owner', created_at: '2026-10-05 10:00:00' } };
    if (path.includes('/messages')) return { items: [{ id: 1, body: 'Is this available?', sender: 'customer', created_at: '2026-10-05 09:00:00' }], has_more: false };
    return { items: [{ id: 'thread', uuid: 'thread', customer_name: 'Buyer', unread: 1 }], total: 1 };
  });
});
describe('Shop owner chat', () => {
  it('keeps the open conversation and draft when filtering the inbox', async () => {
    const original = request.getMockImplementation();
    request.mockImplementation((path, options) => path.includes('filter=unread')
      ? Promise.resolve({ items: [], unread_threads: [], next_cursor: null }) : original(path, options));
    render(<ShopChat refresh={0} canSend />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buyer' }));
    await screen.findByText('Is this available?');
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'My draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
    await screen.findByText('No unread conversations.');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('My draft');
    expect(screen.getByText('Is this available?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await screen.findByRole('button', { name: 'Buyer' });
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('My draft');
  });
  it('opens the selected customer profile from the chat header without reloading the page', async () => {
    const original = request.getMockImplementation();
    request.mockImplementation((path, options) => path.startsWith('/shop-admin/chat?') ? Promise.resolve({ items: [{ uuid: 'thread', customer_name: 'Buyer', customer_key: 'account:42', unread: 0 }], total: 1 }) : original(path, options));
    const onViewCustomer = vi.fn();
    render(<ShopChat refresh={0} canSend onViewCustomer={onViewCustomer} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buyer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View customer Buyer' }));
    expect(onViewCustomer).toHaveBeenCalledWith('account:42');
  });
  it('shows customer activity in the inbox and compact conversation header', async () => {
    let active = true;
    const original = request.getMockImplementation();
    request.mockImplementation(async (path, options) => {
      const result = await original(path, options);
      if (path.includes('/messages') && !options?.method) return { ...result, thread: { customer_active: active } };
      if (path.startsWith('/shop-admin/chat?')) return { ...result, items: result.items.map(item => ({ ...item, customer_active: active })) };
      return result;
    });
    render(<ShopChat refresh={0} canSend />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buyer' }));
    await screen.findByText('Active now');
    expect(screen.getByRole('img', { name: 'Active now' })).toBeInTheDocument();
    expect(document.querySelectorAll('.shop-chat-avatar.is-active')).toHaveLength(2);
    const threadPresence = connectShopChat.mock.calls.find(call => call[1] === 'private-shop.chat.thread.thread')[5];
    // Closing the customer's conversation socket does not override app-wide activity.
    await act(async () => threadPresence({ customer_active: false }));
    expect(screen.getByText('Active now')).toBeInTheDocument();
    active = false;
    await act(async () => { threadPresence({ customer_active: false }); connectShopChat.mock.calls.find(call => call[1] === 'private-shop.chat.business.1')[3](); });
    await screen.findByText('Offline');
    expect(screen.getByRole('img', { name: 'Offline' })).toHaveClass('is-offline');
    act(() => threadPresence(null));
    expect(screen.getByText('Presence unavailable')).toBeInTheDocument();
  });
  it('opens a conversation, marks it read and appends the reply without reloading history', async () => {
    render(<ShopChat refresh={0} canSend />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buyer' }));
    await screen.findByText('Is this available?');
    await waitFor(() => expect(request).toHaveBeenCalledWith('/shop-admin/chat/thread/read', { method: 'POST', body: '{"message_id":1}' }));
    const before = request.mock.calls.filter(([path]) => path.includes('/messages')).length;
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Yes, available.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Yes, available.');
    expect(request.mock.calls.filter(([path]) => path.includes('/messages')).length).toBe(before + 1);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  });
  it('shows history without reply controls for staff with read permission only', async () => {
    render(<ShopChat refresh={0} canSend={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Buyer' }));
    await screen.findByText('Is this available?');
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });
});
