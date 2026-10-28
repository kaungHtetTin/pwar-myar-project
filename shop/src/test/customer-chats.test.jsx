import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomerChats } from '../CustomerChats';
import { RetainedViews } from '../RetainedViews';
import { request } from '../api';
import { goBack } from '../shopNavigation';
import { connectShopChat } from '../chatRealtime';

vi.mock('../api', () => ({ request: vi.fn(), API: '/api' }));
vi.mock('../CustomerAccount', () => ({ useCustomer: () => ({ customer: { id: 1 }, loading: false }) }));
vi.mock('../shopNavigation', () => ({ goBack: vi.fn() }));
vi.mock('../chatRealtime', () => ({ connectShopChat: vi.fn(() => () => {}) }));
vi.mock('../ShopChatConversation', () => ({ ShopChatConversation: ({ onRead }) => {
  const [draft, setDraft] = useState('');
  return <><textarea aria-label="Message" value={draft} onChange={event => setDraft(event.target.value)} /><button onClick={() => onRead(5)}>Mark read</button></>;
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const thread = { uuid: 'demo', shop_name: 'Demo shop', slug: 'demo', preview: 'Hello', updated_at: '2026-10-13 02:00:00', unread_count: 2 };

it('opens conversations and retains list and unsent draft across return navigation', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  request.mockImplementation(async path => path.startsWith('/chat?') ? { items: [thread], has_more: false } : { thread, realtime_enabled: false });
  function Flow() {
    const [route, setRoute] = useState('list');
    return <><button onClick={() => setRoute('list')}>Return list</button><button onClick={() => setRoute('detail')}>Return conversation</button><div onClick={event => { if (event.target.closest('a')?.hash === '#/chats/demo') { event.preventDefault(); setRoute('detail'); } }}><RetainedViews activeKey={route}><CustomerChats uuid={route === 'detail' ? 'demo' : undefined} /></RetainedViews></div></>;
  }
  render(<Flow />);
  const row = await screen.findByRole('link', { name: /Demo shop/ });
  expect(row).toHaveAttribute('href', '#/chats/demo');
  fireEvent.click(row);
  const draft = await screen.findByLabelText('Message');
  fireEvent.change(draft, { target: { value: 'Retained draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
  expect(goBack).toHaveBeenCalledWith('/chats');
  fireEvent.click(screen.getByText('Mark read'));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/chat/demo/read', expect.objectContaining({ method: 'POST', customerAuth: true })));
  const count = request.mock.calls.length;
  fireEvent.click(screen.getByText('Return list'));
  expect(row).toBeVisible();
  expect(screen.queryByLabelText('2 Unread messages')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Return conversation'));
  expect(screen.getByLabelText('Message')).toBe(draft);
  expect(draft).toHaveValue('Retained draft');
  expect(request.mock.calls).toHaveLength(count);
  expect(screen.getByRole('link', { name: 'View shop' })).toHaveAttribute('href', '#/store/demo');
});

it('retries failed list requests', async () => {
  let attempts = 0;
  request.mockImplementation(async path => {
    if (path === '/chat/inbox-config') return {};
    if (++attempts === 1) throw new Error('Offline');
    return { items: [thread], has_more: false };
  });
  render(<CustomerChats />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('link', { name: /Demo shop/ });
  await waitFor(() => expect(attempts).toBe(2));
});

it('updates an empty inbox immediately from an account-wide socket event', async () => {
  let incoming = false;
  request.mockImplementation(async path => path === '/chat/inbox-config'
    ? { channel: 'private-shop.chat.customer.1', realtime_enabled: true }
    : { items: incoming ? [{ ...thread, preview: 'Live reply', unread_count: 3 }] : [], has_more: false });
  render(<CustomerChats />);
  await screen.findByText('No conversations yet');
  await waitFor(() => expect(connectShopChat).toHaveBeenCalled());
  expect(connectShopChat.mock.calls.at(-1)[1]).toBe('private-shop.chat.customer.1');
  incoming = true;
  act(() => connectShopChat.mock.calls.at(-1)[3]({ thread: 'demo', message_id: 7 }));
  await screen.findByText('Live reply');
  expect(screen.getByLabelText('3 Unread messages')).toBeInTheDocument();
});

it('queues incoming changes during initial load and reconciles unread membership', async () => {
  let finish, calls = 0;
  request.mockImplementation(path => {
    if (path === '/chat/inbox-config') return Promise.resolve({ channel: 'private-shop.chat.customer.1', realtime_enabled: true });
    if (++calls === 1) return new Promise(resolve => { finish = resolve; });
    return Promise.resolve({ items: [{ ...thread, uuid: 'new', shop_name: 'New shop', preview: 'Latest reply' }], has_more: false });
  });
  render(<CustomerChats filter="unread" />);
  await waitFor(() => expect(connectShopChat).toHaveBeenCalled());
  act(() => connectShopChat.mock.calls.at(-1)[3]());
  await act(async () => finish({ items: [thread], has_more: false }));
  await screen.findByText('Latest reply');
  expect(screen.queryByRole('link', { name: /Demo shop/ })).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new CustomEvent('mkpos:customer-chat-read', { detail: { uuid: 'new' } })));
  expect(screen.queryByRole('link', { name: /New shop/ })).not.toBeInTheDocument();
  expect(calls).toBe(2);
});

it('polls even an empty list when the realtime configuration is unavailable', async () => {
  const timers = [], nativeInterval = globalThis.setInterval;
  const interval = vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => {
    if (delay === 15000) timers.push(callback);
    return nativeInterval(callback, delay, ...args);
  });
  let incoming = false;
  request.mockImplementation(async path => {
    if (path === '/chat/inbox-config') throw new Error('Old API');
    return { items: incoming ? [thread] : [], has_more: false };
  });
  try {
    render(<CustomerChats />);
    await screen.findByText('No conversations yet');
    incoming = true;
    act(() => { timers[0](); });
    await screen.findByRole('link', { name: /Demo shop/ });
  } finally { interval.mockRestore(); }
});
