import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopConversation, ShopChatInbox } from './ShopChat';
import { PageActivityContext } from '../navigation/pageRefresh';
import { AppNavigationContext } from '../navigation/AppNavigationContext';
import { connectMobileShopChat } from './shopChatRealtime';
vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
vi.mock('./shopChatRealtime', () => ({ connectMobileShopChat: vi.fn(() => ({ close() {}, typing() {} })) }));
const uuid = '12345678-1234-1234-1234-123456789abc';
const session = { user: { role: 'owner' } };
beforeEach(() => vi.clearAllMocks());
it('labels AI replies and allows human takeover while preserving the composer draft', async () => {
  const ai = { enabled: true, name: 'Mia', mode: 'ai', version: 1, responding: true };
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : path.endsWith('/handoff') ? { thread: { customer_name: 'Alice', sales_ai: { ...ai, mode: 'human', version: 2 } } } : { thread: { customer_name: 'Alice', sales_ai: ai }, items: [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'How can I help?', created_at: '2026-10-25T10:00:00Z' }], has_more: false });
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  await screen.findByText('Mia (AI)', { selector: 'small' });
  expect(screen.getByRole('status', { name: 'AI is preparing a reply' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'I can help' } });
  fireEvent.click(screen.getByRole('switch', { name: 'AI replies' }));
  await waitFor(() => expect(screen.getByRole('switch', { name: 'AI replies' })).not.toBeChecked());
  expect(screen.queryByRole('status', { name: 'AI is preparing a reply' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('I can help');
  expect(apiRequest).toHaveBeenCalledWith(`/shop-admin/chat/${uuid}/handoff`, { method: 'POST', body: JSON.stringify({ mode: 'human', version: 1 }) });
});
it('updates AI thinking from realtime refreshes even when no new message ID arrives', async () => {
  let responding = false;
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { thread: { customer_name: 'Alice', sales_ai: { enabled: true, name: 'Kaung Kaung', mode: 'ai', version: 1, responding } }, items: path.includes('?') ? [] : [{ id: 1, sender: 'customer', body: 'Hello', created_at: '2026-10-26T05:00:00Z' }], has_more: false });
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  await screen.findByText('Hello');
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Retain my draft' } });
  responding = true;
  await act(async () => connectMobileShopChat.mock.calls.at(-1)[2].change());
  expect(screen.getByRole('status', { name: 'AI is preparing a reply' })).toHaveTextContent('Kaung Kaung');
  expect(screen.getAllByText('Hello')).toHaveLength(1);
  responding = false;
  await act(async () => connectMobileShopChat.mock.calls.at(-1)[2].change());
  expect(screen.queryByRole('status', { name: 'AI is preparing a reply' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('Retain my draft');
});
it('keeps one header, hides shortcut icons and toggles both directions without refetching the conversation', async () => {
  let mode = 'ai', version = 1;
  const thread = () => ({ customer_name: 'Alice', sales_ai: { enabled: true, name: 'Mia', mode, version } });
  apiRequest.mockImplementation(async (path, options) => {
    if (path.endsWith('/config')) return { enabled: true };
    if (path.endsWith('/handoff')) { const data = JSON.parse(options.body); mode = data.mode; version++; return { thread: thread() }; }
    return { thread: thread(), items: [], has_more: false };
  });
  const shortcuts = { openNavigation: vi.fn(), aiAssistant: { open: vi.fn() }, shopChat: { open: vi.fn(), unreadCount: 4 } };
  const { container } = render(<AppNavigationContext.Provider value={shortcuts}><ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} /></AppNavigationContext.Provider>);
  const toggle = await screen.findByRole('switch', { name: 'AI replies' });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep this draft' } });
  expect(container.querySelectorAll('header')).toHaveLength(1);
  expect(container.querySelector('.sales-ai-mobile-chat-status')).toBeNull();
  expect(toggle.closest('.shop-chat-conversation-header')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'PwarMyar AI assistant' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Shop chat/ })).not.toBeInTheDocument();
  const reads = apiRequest.mock.calls.filter(([path]) => path.endsWith('/messages')).length;
  fireEvent.click(toggle); await waitFor(() => expect(toggle).not.toBeChecked());
  fireEvent.click(toggle); await waitFor(() => expect(toggle).toBeChecked());
  expect(screen.getByLabelText('Message')).toHaveValue('Keep this draft');
  expect(apiRequest.mock.calls.filter(([path]) => path.endsWith('/messages'))).toHaveLength(reads);
  expect(apiRequest.mock.calls.filter(([path]) => path.endsWith('/handoff')).map(([, options]) => JSON.parse(options.body))).toEqual([{ mode: 'human', version: 1 }, { mode: 'ai', version: 2 }]);
});

it('keeps the toggle state and draft after handoff failure and permits retry', async () => {
  let fail = true;
  const ai = { enabled: true, name: 'Mia', mode: 'ai', version: 1 };
  apiRequest.mockImplementation(async path => {
    if (path.endsWith('/config')) return { enabled: true };
    if (path.endsWith('/handoff')) { if (fail) { fail = false; throw new Error('Handover failed. Try again.'); } return { thread: { sales_ai: { ...ai, mode: 'human', version: 2 } } }; }
    return { thread: { sales_ai: ai }, items: [], has_more: false };
  });
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  const toggle = await screen.findByRole('switch', { name: 'AI replies' });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Saved draft' } });
  fireEvent.click(toggle); await screen.findByText('Handover failed. Try again.');
  expect(toggle).toBeChecked(); expect(screen.getByLabelText('Message')).toHaveValue('Saved draft');
  fireEvent.click(toggle); await waitFor(() => expect(toggle).not.toBeChecked());
});

it('shows a read-only mode without a handover switch for staff lacking processing permission', async () => {
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { thread: { sales_ai: { enabled: true, mode: 'waiting_owner' } }, items: [], has_more: false });
  render(<ShopConversation uuid={uuid} session={{ user: { role: 'staff' }, permissions: ['ecommerce_orders'] }} onNavigate={vi.fn()} />);
  await screen.findByText('Waiting for a person');
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
it('loads customer photos in the inbox while keeping presence and navigation', async () => {
  const thread = { uuid, customer_key: 'account:3', customer_name: 'Alice Morgan', avatar_url: '/avatars/alice.jpg', customer_active: true };
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [thread], total: 1 });
  const navigate = vi.fn();
  const { container } = render(<ShopChatInbox session={session} onNavigate={navigate} />);
  await screen.findByText('Alice Morgan');
  const avatar = container.querySelector('.shop-chat-avatar');
  expect(avatar.querySelector('img')).toHaveAttribute('src', thread.avatar_url);
  expect(avatar.querySelector('i')).not.toBeNull();
  fireEvent.error(avatar.querySelector('img'));
  expect(avatar).toHaveTextContent('AM');
  fireEvent.click(screen.getByRole('button', { name: /Alice Morgan/ }));
  expect(navigate).toHaveBeenCalledWith(`/shop/chat/${uuid}`);
});

it('loads the conversation customer photo and retains the customer profile action', async () => {
  const thread = { customer_key: 'account:3', customer_name: 'Alice Morgan', avatar_url: '/avatars/alice.jpg' };
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [], thread, has_more: false });
  const navigate = vi.fn();
  const { container } = render(<ShopConversation uuid={uuid} session={session} onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Keep draft' } });
  await waitFor(() => expect(container.querySelector('.shop-chat-avatar img')).toHaveAttribute('src', thread.avatar_url));
  fireEvent.click(screen.getByRole('button', { name: 'View customer' }));
  expect(navigate).toHaveBeenCalledWith('/shop/customers/account%3A3');
  expect(screen.getByLabelText('Message')).toHaveValue('Keep draft');
});
it('uses source-aware Back with a conversation-list fallback', async () => {
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [], thread: {}, has_more: false });
  const navigate = vi.fn();
  render(<ShopConversation uuid={uuid} session={session} onNavigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Back', exact: true }));
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/shop/chat', { back: true });
});
it('retries a lost send response with the same client ID and keeps the draft', async () => {
  let attempts = 0;
  apiRequest.mockImplementation(async (path, options) => {
    if (path.endsWith('/config')) return { enabled: true };
    if (options?.method === 'POST' && path.endsWith('/messages')) {
      if (++attempts === 1) throw new Error('Connection interrupted');
      return { message: { id: 2, sender: 'owner', body: 'Hello', created_at: '2026-10-13T00:00:00Z' } };
    }
    return { items: [], thread: { customer_name: 'Alice' }, has_more: false };
  });
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
  await screen.findByText('Connection interrupted');
  expect(screen.getByLabelText('Message')).toHaveValue('Hello');
  fireEvent.click(screen.getByRole('button', { name: 'Retry send', exact: true }));
  await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue(''));
  const sends = apiRequest.mock.calls.filter(([path, options]) => options?.method === 'POST' && path.endsWith('/messages')).map(([, options]) => JSON.parse(options.body));
  expect(sends).toHaveLength(2);
  expect(sends[0].client_id).toBe(sends[1].client_id);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
it('retains the conversation draft and skips initial reload when returning to its mounted page', async () => {
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [], thread: {}, has_more: false });
  const view = active => <PageActivityContext.Provider value={active}><ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} /></PageActivityContext.Provider>;
  const result = render(view(true));
  fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Draft' } });
  await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('/messages'))).toBe(true));
  const count = apiRequest.mock.calls.length;
  result.rerender(view(false)); result.rerender(view(true));
  expect(screen.getByLabelText('Message')).toHaveValue('Draft');
  expect(apiRequest.mock.calls).toHaveLength(count);
});
it('does not load conversation messages when chat is disabled', async () => {
  apiRequest.mockResolvedValue({ enabled: false });
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  await screen.findByText('Chat is currently unavailable.');
  expect(apiRequest.mock.calls.some(([path]) => path.includes('/messages'))).toBe(false);
});

it('keeps unread filter changes pending until Apply and discards canceled edits', async () => {
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [], total: 0 });
  render(<ShopChatInbox onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Filters', exact: true }));
  fireEvent.change(screen.getByLabelText('Conversation filter'), { target: { value: 'unread' } });
  expect(apiRequest.mock.calls.some(([path]) => path.includes('filter=unread'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters', exact: true }));
  await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('filter=unread'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Filters, 1 active filters', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  expect(screen.getByLabelText('Conversation filter')).toHaveValue('all');
});

it('shows Needs human only for waiting chats and clears it locally after handling changes without reloading', async () => {
  const waiting = { uuid, customer_name: 'Waiting customer', sales_ai: { enabled: true, mode: 'waiting_owner', version: 1 } };
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true } : { items: [waiting, { uuid: 'human-thread', customer_name: 'Human customer', sales_ai: { mode: 'human', version: 1 } }, { uuid: 'ai-thread', customer_name: 'AI customer', sales_ai: { mode: 'ai', version: 1 } }], total: 3 });
  render(<ShopChatInbox session={session} onNavigate={vi.fn()} />);
  expect(await screen.findByText('Needs human')).toBeInTheDocument();
  expect(screen.getAllByText('Needs human')).toHaveLength(1);
  const reads = apiRequest.mock.calls.length;
  act(() => window.dispatchEvent(new CustomEvent('mkpos:shop-chat-handling', { detail: { ...waiting, sales_ai: { ...waiting.sales_ai, mode: 'human', version: 2 } } })));
  await waitFor(() => expect(screen.queryByText('Needs human')).not.toBeInTheDocument());
  expect(apiRequest.mock.calls).toHaveLength(reads);
  expect(screen.getByText('Waiting customer')).toBeInTheDocument();
});

it('shows the inbox bulk AI icon instead of shortcuts, retains search and labels on failure, and reconciles successful handover once', async () => {
  const waiting = { uuid, customer_name: 'Waiting customer', sales_ai: { enabled: true, mode: 'waiting_owner', version: 1 } };
  let rejectRequest, attempts = 0;
  apiRequest.mockImplementation(async (path, options) => {
    if (path.endsWith('/config')) return { enabled: true, sales_ai_enabled: true };
    if (options?.method === 'POST' && path.endsWith('/handoff-all')) {
      attempts++;
      if (attempts === 1) return new Promise((_, reject) => { rejectRequest = reject; });
      return { updated_count: 2 };
    }
    return { items: [waiting], total: 1 };
  });
  const shortcuts = { openNavigation: vi.fn(), aiAssistant: { open: vi.fn() }, shopChat: { open: vi.fn(), unreadCount: 2 } };
  render(<AppNavigationContext.Provider value={shortcuts}><ShopChatInbox session={session} onNavigate={vi.fn()} /></AppNavigationContext.Provider>);
  await screen.findByText('Needs human');
  expect(screen.queryByRole('button', { name: 'PwarMyar AI assistant' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Shop chat/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search chats' }), { target: { value: 'Waiting' } });
  await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Waiting'))).toBe(true));
  const reads = apiRequest.mock.calls.filter(([path]) => path.startsWith('/shop-admin/chat?')).length;
  const button = screen.getByRole('button', { name: 'Hand over all to AI' });
  expect(button.closest('header')).not.toBeNull();
  fireEvent.click(button); fireEvent.click(button);
  expect(attempts).toBe(1);
  await act(async () => { rejectRequest(new Error('Handover interrupted')); });
  await screen.findByText('Handover interrupted');
  expect(screen.getByText('Needs human')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hand over all to AI' }));
  await screen.findByText('2 conversations handed over to AI.');
  expect(screen.queryByText('Needs human')).not.toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: 'Search chats' })).toHaveValue('Waiting');
  expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/shop-admin/chat?'))).toHaveLength(reads);
});
it('hides the bulk handover icon when Sales AI is disabled', async () => {
  apiRequest.mockImplementation(async path => path.endsWith('/config') ? { enabled: true, sales_ai_enabled: false } : { items: [], total: 0 });
  render(<ShopChatInbox session={session} onNavigate={vi.fn()} />);
  await screen.findByText('No conversations found.');
  expect(screen.queryByRole('button', { name: 'Hand over all to AI' })).not.toBeInTheDocument();
});


it('shows Telegram delivery evidence without customer presence, typing or read receipts', async()=>{
  let status='pending', stale=false;
  const row={id:7,sender:'owner',body:'Telegram product',created_at:'2026-10-27T10:00:00Z',telegram_delivery:{status,can_retry:false}};
  const thread={customer_name:'Telegram Buyer',sales_ai_channel:'telegram',customer_active:true,customer_read_id:999,telegram_last_message_at:'2026-10-27T10:00:00Z'};
  apiRequest.mockImplementation(async path=>path.endsWith('/config')?{enabled:true}:{thread,items:path.includes('after_id')?(stale?[{...row,telegram_delivery:{status}}]:[]):[row],has_more:false,
    delivery_updates:path.includes('delivery_ids')?[{id:7,telegram_delivery:{status,can_retry:false}}]:[]});
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  await screen.findByLabelText('Queued for Telegram');
  expect(screen.queryByText('Active now')).not.toBeInTheDocument();
  expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  const events=connectMobileShopChat.mock.calls.at(-1)[2];
  await act(async()=>events.typing(true));
  expect(screen.queryByText(/Customer is typing/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Keep draft'}});
  status='sent'; await act(async()=>events.change());
  expect(screen.getByLabelText('Sent to Telegram')).toBeVisible();
  status='pending'; stale=true; await act(async()=>events.change());
  expect(screen.getByLabelText('Sent to Telegram')).toBeVisible();
  expect(screen.queryByText(/Seen/)).not.toBeInTheDocument();
  expect(screen.getByText('Telegram product')).toBeVisible();
  expect(screen.getByLabelText('Message')).toHaveValue('Keep draft');
});

it('retries a confirmed Telegram failure once and preserves the mobile composer draft', async()=>{
  let finish;
  const row={id:9,sender:'owner',body:'Retry on Telegram',created_at:'2026-10-27T10:00:00Z',telegram_delivery:{status:'failed',can_retry:true}};
  apiRequest.mockImplementation((path,options)=>options?.method==='POST'&&path.endsWith('/retry-telegram')?new Promise(resolve=>{finish=resolve;}):Promise.resolve(path.endsWith('/config')?{enabled:true}:{thread:{sales_ai_channel:'telegram'},items:[row],has_more:false}));
  render(<ShopConversation uuid={uuid} session={session} onNavigate={vi.fn()} />);
  const retry=await screen.findByRole('button',{name:'Retry Telegram message 9'});
  fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Keep mobile draft'}});
  fireEvent.click(retry); fireEvent.click(retry);
  expect(apiRequest.mock.calls.filter(([path])=>path.endsWith('/retry-telegram'))).toHaveLength(1);
  await act(async()=>finish({message:{...row,telegram_delivery:{status:'pending',can_retry:false}}}));
  expect(screen.getByLabelText('Queued for Telegram')).toBeVisible();
  expect(screen.getByLabelText('Message')).toHaveValue('Keep mobile draft');
});
