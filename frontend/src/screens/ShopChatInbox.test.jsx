import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopChatInbox } from './ShopChatInbox';

vi.mock('../api', () => ({ request: vi.fn() }));
const buyer = (id, unread = 0) => ({ uuid: `thread-${id}`, customer_name: `Buyer ${id}`, unread, updated_at: `2026-10-06 10:0${id}:00` });
let observers;
beforeEach(() => {
  request.mockReset(); observers = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback, options) { this.callback = callback; this.root = options.root; observers.push(this); }
    observe() {} disconnect() {}
  });
});
afterEach(() => vi.unstubAllGlobals());

it('queues a socket refresh received while the inbox request is in flight', async () => {
  let finish;
  request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ items: [{ ...buyer(2, 1), last_message: { body: 'Latest socket message' } }], next_cursor: null });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  view.rerender(<ShopChatInbox {...props} refresh={1} />);
  await act(async () => finish({ items: [buyer(1)], next_cursor: null }));
  await screen.findByText('Latest socket message');
  expect(request).toHaveBeenCalledTimes(2);
});

it('reconciles an older loaded page when a socket refresh changes its preview', async () => {
  let updated = false;
  const rows = Array.from({ length: 50 }, (_, id) => buyer(id + 1));
  request.mockImplementation(async path => {
    const offset = path.includes('cursor=tail') || path.includes('offset=25') ? 25 : 0;
    return { items: rows.slice(offset, offset + 25).map(row => row.uuid === 'thread-30' && updated
      ? { ...row, last_message: { body: 'Updated older thread' } } : row), next_cursor: offset === 0 ? 'tail' : null };
  });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  await screen.findByRole('button', { name: 'Buyer 25' });
  await waitFor(() => expect(observers.length).toBeGreaterThan(0));
  act(() => observers.at(-1).callback([{ isIntersecting: true }]));
  await screen.findByRole('button', { name: 'Buyer 50' });
  updated = true;
  view.rerender(<ShopChatInbox {...props} refresh={1} />);
  await screen.findByText('Updated older thread');
  expect(request).toHaveBeenLastCalledWith('/shop-admin/chat?q=&limit=25&offset=25');
});

it('switches between all and unread, keeps search and removes locally read conversations', async () => {
  request.mockImplementation(async path => path.includes('filter=unread')
    ? { items: [buyer(1, 2)], unread_threads: ['thread-1'], next_cursor: null }
    : { items: [buyer(1, 2), buyer(2)], next_cursor: null });
  const props = { query: 'Buyer', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  await screen.findByRole('button', { name: 'Buyer 2' });
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
  await screen.findByRole('button', { name: 'Buyer 1' });
  expect(request).toHaveBeenLastCalledWith('/shop-admin/chat?q=Buyer&limit=25&filter=unread');
  expect(screen.queryByRole('button', { name: 'Buyer 2' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true');
  view.rerender(<ShopChatInbox {...props} readThread={{ uuid: 'thread-1' }} />);
  expect(screen.getByText('No unread conversations.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  await screen.findByRole('button', { name: 'Buyer 2' });
});

it('refreshes unread membership across already loaded pages', async () => {
  let refreshed = false;
  request.mockImplementation(async path => {
    if (!path.includes('filter=unread')) return { items: [], next_cursor: null };
    return { items: path.includes('cursor=next') ? [buyer(3, 1), buyer(4, 1)] : [buyer(1, 1)],
      unread_threads: refreshed ? ['thread-1', 'thread-4'] : ['thread-1', 'thread-3', 'thread-4'],
      next_cursor: path.includes('cursor=next') ? null : 'next' };
  });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  await screen.findByText('No conversations found.');
  fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
  await screen.findByRole('button', { name: 'Buyer 1' });
  await waitFor(() => expect(observers.length).toBeGreaterThan(0));
  act(() => observers.at(-1).callback([{ isIntersecting: true }]));
  await screen.findByRole('button', { name: 'Buyer 3' });
  refreshed = true;
  view.rerender(<ShopChatInbox {...props} refresh={1} />);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Buyer 3' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Buyer 4' })).toBeInTheDocument();
});

it('shows profile initials, preview, unread highlight and actual outgoing read status', async () => {
  request.mockResolvedValue({ items: [
    { ...buyer(1, 3), customer_name: 'Aung Min', last_message: { id: 7, sender: 'customer', body: 'Can you deliver?', created_at: '2026-10-06 10:00:00' } },
    { ...buyer(2), customer_read_id: 8, last_message: { id: 8, sender: 'owner', body: 'Yes we can', created_at: '2026-10-06 10:00:00' } },
    { ...buyer(3), customer_read_id: 8, last_message: { id: 9, sender: 'owner', body: 'On the way', created_at: '2026-10-06 10:00:00' } },
  ], next_cursor: null });
  render(<ShopChatInbox query="" refresh={0} onSelect={vi.fn()} />);
  expect(await screen.findByRole('button', { name: 'Aung Min' })).toHaveClass('is-unread');
  expect(screen.getByText('AM')).toBeInTheDocument();
  expect(screen.getByText('Can you deliver?')).toBeInTheDocument();
  expect(screen.getByLabelText('3 unread messages')).toBeInTheDocument();
  expect(screen.getByLabelText('Seen').closest('button')).toHaveAttribute('aria-label', 'Buyer 2');
  expect(screen.getByLabelText('Sent').closest('button')).toHaveAttribute('aria-label', 'Buyer 3');
});

it('shows an active profile marker only for customers reported by the realtime server', async () => {
  request.mockResolvedValue({ items: [buyer(1), buyer(2)], next_cursor: null });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} activeCustomers={['thread-1']} />);
  const online = await screen.findByRole('button', { name: 'Buyer 1' });
  expect(online.querySelector('.shop-chat-avatar')).toHaveClass('is-active');
  expect(screen.getByRole('img', { name: 'Active now' })).toHaveClass('is-online');
  expect(screen.getByRole('img', { name: 'Offline' })).toHaveClass('is-offline');
  expect(screen.getByRole('button', { name: 'Buyer 2' }).querySelector('.shop-chat-avatar')).not.toHaveClass('is-active');
  view.rerender(<ShopChatInbox {...props} activeCustomers={[]} />);
  expect(online.querySelector('.shop-chat-avatar')).not.toHaveClass('is-active');
  expect(screen.getAllByRole('img', { name: 'Offline' })).toHaveLength(2);
  view.rerender(<ShopChatInbox {...props} activeCustomers={[]} presenceKnown={false} />);
  expect(screen.getAllByRole('img', { name: 'Presence unavailable' })).toHaveLength(2);
});

it('loads correctly when React restarts mount effects', async () => {
  request.mockResolvedValue({ items: [buyer(1)], next_cursor: null });
  render(<React.StrictMode><ShopChatInbox query="" refresh={0} onSelect={vi.fn()} /></React.StrictMode>);
  await screen.findByRole('button', { name: 'Buyer 1' });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('loads the next cursor inside the inbox, merges duplicates and keeps loaded conversations on refresh', async () => {
  request.mockImplementation(async (path) => path.includes('cursor=next')
    ? { items: [buyer(1), buyer(3)], next_cursor: null }
    : { items: [buyer(1, 2), buyer(2)], next_cursor: 'next' });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  await screen.findByRole('button', { name: 'Buyer 1' });
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  await waitFor(() => expect(observers.length).toBeGreaterThan(0));
  expect(observers.at(-1).root).toHaveClass('shop-chat-thread-list');
  act(() => observers.at(-1).callback([{ isIntersecting: true }]));
  await screen.findByRole('button', { name: 'Buyer 3' });
  expect(screen.getAllByRole('button', { name: 'Buyer 1' })).toHaveLength(1);
  expect(request).toHaveBeenLastCalledWith('/shop-admin/chat?q=&limit=25&cursor=next');
  view.rerender(<ShopChatInbox {...props} refresh={1} />);
  await waitFor(() => expect(screen.getByLabelText('2 unread messages')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Buyer 3' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Buyer 2' }));
  expect(props.onSelect).toHaveBeenCalledWith(buyer(2));
});

it('discards a stale next page when the search changes', async () => {
  let finishPage;
  request.mockImplementation((path) => path.includes('cursor=next') ? new Promise((resolve) => { finishPage = resolve; })
    : Promise.resolve({ items: [path.includes('q=New') ? buyer(9) : buyer(1)], next_cursor: path.includes('q=New') ? null : 'next' }));
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  await screen.findByRole('button', { name: 'Buyer 1' });
  await waitFor(() => expect(observers.length).toBeGreaterThan(0));
  act(() => observers.at(-1).callback([{ isIntersecting: true }]));
  view.rerender(<ShopChatInbox {...props} query="New" />);
  await screen.findByRole('button', { name: 'Buyer 9' });
  await act(async () => finishPage({ items: [buyer(3)], next_cursor: null }));
  expect(screen.queryByRole('button', { name: 'Buyer 3' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Buyer 1' })).not.toBeInTheDocument();
});

it('labels only chats awaiting a human, keeps the label after reading, and clears it on takeover without refetching', async () => {
  const waiting = { ...buyer(1), sales_ai: { enabled: true, mode: 'waiting_owner', version: 1 } };
  request.mockResolvedValue({ items: [waiting, { ...buyer(2), sales_ai: { enabled: true, mode: 'human', version: 1 } }, { ...buyer(3), sales_ai: { enabled: true, mode: 'ai', version: 1 } }], next_cursor: null });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  expect(await screen.findByText('Needs human')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Buyer 1' })).toHaveAccessibleDescription('Needs human');
  view.rerender(<ShopChatInbox {...props} readThread={{ uuid: waiting.uuid, message_id: 1 }} />);
  expect(screen.getAllByText('Needs human')).toHaveLength(1);
  view.rerender(<ShopChatInbox {...props} handlingUpdate={{ uuid: waiting.uuid, sales_ai: { enabled: true, mode: 'human', version: 2 } }} />);
  await waitFor(() => expect(screen.queryByText('Needs human')).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledTimes(1);
});
it('clears loaded human-request labels after bulk handover without resetting the inbox', async () => {
  request.mockResolvedValue({ items: [1, 2].map(id => ({ ...buyer(id), sales_ai: { enabled: true, mode: 'waiting_owner', version: 1 } })), next_cursor: null });
  const props = { query: '', refresh: 0, onSelect: vi.fn() };
  const view = render(<ShopChatInbox {...props} />);
  await waitFor(() => expect(screen.getAllByText('Needs human')).toHaveLength(2));
  const row = screen.getByRole('button', { name: 'Buyer 1' });
  view.rerender(<ShopChatInbox {...props} aiHandoverRevision={1} />);
  await waitFor(() => expect(screen.queryByText('Needs human')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Buyer 1' })).toBe(row);
  expect(request).toHaveBeenCalledTimes(1);
});
