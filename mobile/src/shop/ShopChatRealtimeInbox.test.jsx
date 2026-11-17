import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ShopChatInbox } from './ShopChat';
import { apiRequest } from '../api/client';
import { connectMobileShopChat } from './shopChatRealtime';
import { PageActivityContext } from '../navigation/pageRefresh';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
vi.mock('./shopChatRealtime', () => ({ connectMobileShopChat: vi.fn(() => ({ close() {}, typing() {} })) }));
beforeEach(() => vi.clearAllMocks());
const thread = { id: 'one', uuid: 'one', customer_name: 'Buyer', unread: 1, last_message: { body: 'Live message' } };

it('loads a new conversation from the business socket even when the inbox was empty', async () => {
  let incoming = false;
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true, channel: 'private-shop.chat.business.1' } : { items: incoming ? [thread] : [], total: incoming ? 1 : 0 });
  render(<ShopChatInbox onNavigate={vi.fn()} />);
  await screen.findByText('No conversations found.');
  await waitFor(() => expect(connectMobileShopChat).toHaveBeenCalled());
  incoming = true;
  await act(async () => { await connectMobileShopChat.mock.calls.at(-1)[2].change(); });
  await screen.findByText('Live message');
});

it('coalesces events during a request and reconciles hidden inbox changes on return', async () => {
  let finish, calls = 0, latest = false;
  apiRequest.mockImplementation(path => {
    if (path.endsWith('/config')) return Promise.resolve({ enabled: true, channel: 'private-shop.chat.business.1' });
    calls++;
    if (calls === 2) return new Promise(resolve => { finish = resolve; });
    return Promise.resolve({ items: [{ ...thread, last_message: { body: latest ? 'Newest message' : 'Original message' } }], total: 1 });
  });
  const view = active => <PageActivityContext.Provider value={active}><ShopChatInbox onNavigate={vi.fn()} /></PageActivityContext.Provider>;
  const rendered = render(view(true));
  await screen.findByText('Original message');
  const changed = () => { void connectMobileShopChat.mock.calls.at(-1)[2].change(); };
  act(changed);
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  latest = true;
  act(changed); act(changed);
  expect(calls).toBe(2);
  await act(async () => finish({ items: [thread], total: 1 }));
  await screen.findByText('Newest message');
  expect(calls).toBe(3);
  rendered.rerender(view(false));
  act(changed);
  expect(calls).toBe(3);
  rendered.rerender(view(true));
  await waitFor(() => expect(calls).toBe(4));
});
