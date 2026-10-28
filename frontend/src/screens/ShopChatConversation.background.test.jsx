import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopChatConversation } from './ShopChatConversation';
import { connectShopChat } from '../shopChatRealtime';

vi.mock('../shopChatRealtime', () => ({ connectShopChat: vi.fn(() => () => {}) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
const message = id => ({ id, sender: 'customer', body: `Message ${id}`, created_at: '2026-10-23 12:00:00' });

it('coalesces socket events received during a fetch and catches up without losing messages', async () => {
  vi.useFakeTimers();
  let finish;
  const api = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ items: [message(2)], has_more: false });
  await act(async () => { render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />); });
  const changed = connectShopChat.mock.calls.at(-1)[3];
  await act(async () => { changed(); changed(); changed(); });
  expect(api).toHaveBeenCalledOnce();
  await act(async () => finish({ items: [message(1)], has_more: false }));
  await act(async () => vi.advanceTimersByTimeAsync(999));
  expect(api).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(api).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Message 1')).toBeInTheDocument();
  expect(screen.getByText('Message 2')).toBeInTheDocument();
});

it('keeps sockets immediate while using a two-minute safety sync and a slower outage poll', async () => {
  vi.useFakeTimers();
  const api = vi.fn(async () => ({ items: [message(1)], has_more: false }));
  await act(async () => { render(<ShopChatConversation uuid="thread" apiRequest={api} basePath="/chat" authPath="/auth" selfSender="owner" />); });
  const status = connectShopChat.mock.calls.at(-1)[4];
  status('Live');
  await act(async () => vi.advanceTimersByTimeAsync(105000));
  expect(api).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(api).toHaveBeenCalledTimes(2);
  status('Reconnecting...');
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(api).toHaveBeenCalledTimes(3);
});
