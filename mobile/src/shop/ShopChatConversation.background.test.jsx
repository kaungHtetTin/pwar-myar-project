import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopConversation } from './ShopChat';
import { connectMobileShopChat } from './shopChatRealtime';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
vi.mock('./shopChatRealtime', () => ({ connectMobileShopChat: vi.fn(() => ({ close() {}, typing() {} })) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
const message = id => ({ id, sender: 'customer', body: `Message ${id}`, created_at: '2026-10-23 12:00:00' });
const messageCalls = () => apiRequest.mock.calls.filter(([path]) => path.includes('/messages'));

it('coalesces socket events during a fetch and retains both old and new messages', async () => {
  vi.useFakeTimers();
  let finish, reads = 0;
  apiRequest.mockImplementation(async path => {
    if (path.endsWith('/config')) return { enabled: true };
    if (path.includes('/messages')) {
      if (++reads === 1) return new Promise(resolve => { finish = resolve; });
      return { items: [message(2)], thread: {}, has_more: false };
    }
    return {};
  });
  await act(async () => { render(<ShopConversation uuid="thread" session={{ user: { role: 'owner' } }} onNavigate={vi.fn()} />); });
  const changed = connectMobileShopChat.mock.calls.at(-1)[2].change;
  await act(async () => { changed(); changed(); changed(); });
  expect(messageCalls()).toHaveLength(1);
  await act(async () => finish({ items: [message(1)], thread: {}, has_more: false }));
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(messageCalls()).toHaveLength(2);
  expect(screen.getByText('Message 1')).toBeInTheDocument();
  expect(screen.getByText('Message 2')).toBeInTheDocument();
});

it('uses a two-minute safety sync while live and resumes outage polling after disconnect', async () => {
  vi.useFakeTimers();
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [message(1)], thread: {}, has_more: false });
  await act(async () => { render(<ShopConversation uuid="thread" session={{ user: { role: 'owner' } }} onNavigate={vi.fn()} />); });
  const callbacks = connectMobileShopChat.mock.calls.at(-1)[2];
  await act(async () => callbacks.status('Live'));
  await act(async () => vi.advanceTimersByTimeAsync(105000));
  expect(messageCalls()).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(messageCalls()).toHaveLength(2);
  await act(async () => callbacks.status('Reconnecting...'));
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(messageCalls()).toHaveLength(3);
});
