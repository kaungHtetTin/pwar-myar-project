import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatAlerts } from './components/ChatAlerts';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });
const item = (id, uuid = 'one') => ({ id, uuid, name: uuid, preview: `Message ${id}` });
async function refresh() { await act(async () => { window.dispatchEvent(new Event('online')); }); }

it('merges bursts by message ID and sends a multi-conversation summary to the inbox', async () => {
  vi.useFakeTimers();
  let feed = { enabled: true, cursor: 10, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : {}), open = vi.fn();
  render(<ChatAlerts apiRequest={api} basePath="/shop-admin/chat" onOpen={open} />);
  await act(async () => {});
  feed = { enabled: true, cursor: 12, unread_count: 2, items: [item(11), item(12)] }; await refresh();
  expect(screen.getByRole('status')).toHaveTextContent('2');
  expect(screen.getByRole('status')).toHaveTextContent('Message 12');
  feed = { ...feed, cursor: 13, unread_count: 3, items: [item(12), item(13, 'two')] }; await refresh();
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('3 new messages · 2 conversations');
  fireEvent.click(screen.getByRole('button', { name: 'Open chat inbox' }));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ uuid: undefined, messageCount: 3, conversationCount: 2 }));
  await refresh(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('clears on chat entry and dialogs, consumes suppressed messages, and keeps the badge feed running', async () => {
  vi.useFakeTimers();
  let feed = { enabled: true, cursor: 10, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : {}), activity = vi.fn(), unread = vi.fn();
  const view = (suppressed = false, dialog = false) => <><ChatAlerts apiRequest={api} basePath="/shop-admin/chat" onActivity={activity} onUnread={unread} suppressed={suppressed} />{dialog && <div role="dialog">Payment form</div>}</>;
  const result = render(view()); await act(async () => {});
  feed = { ...feed, cursor: 11, unread_count: 1, items: [item(11)] }; await refresh();
  expect(screen.getByRole('status')).toBeInTheDocument();
  const before = api.mock.calls.length;
  result.rerender(view(true)); await act(async () => {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(api.mock.calls.length).toBe(before);
  feed = { ...feed, cursor: 12, unread_count: 2, items: [item(12)] }; await refresh();
  expect(activity.mock.calls.length + unread.mock.calls.length).toBeGreaterThan(2);
  result.rerender(view()); await refresh(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  feed = { ...feed, cursor: 13, unread_count: 3, items: [item(13)] }; await refresh();
  expect(screen.getByRole('status')).toBeInTheDocument();
  result.rerender(view(false, true)); await act(async () => {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  feed = { ...feed, cursor: 14, unread_count: 4, items: [item(14)] }; await refresh();
  result.rerender(view()); await refresh(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('expires automatically, pauses for keyboard focus and caps a continuous burst at twelve seconds', async () => {
  vi.useFakeTimers();
  let feed = { enabled: true, cursor: 10, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : {});
  render(<ChatAlerts apiRequest={api} basePath="/shop-admin/chat" />); await act(async () => {});
  feed = { ...feed, cursor: 11, unread_count: 1, items: [item(11)] }; await refresh();
  fireEvent.focus(screen.getByRole('button', { name: 'Dismiss chat notification' }));
  await act(async () => vi.advanceTimersByTimeAsync(6500)); expect(screen.getByRole('status')).toBeInTheDocument();
  fireEvent.blur(screen.getByRole('button', { name: 'Dismiss chat notification' }), { relatedTarget: document.body });
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  feed = { ...feed, cursor: 12, unread_count: 2, items: [item(12)] }; await refresh();
  for (const id of [13, 14]) {
    await act(async () => vi.advanceTimersByTimeAsync(5000)); feed = { ...feed, cursor: id, unread_count: id - 10, items: [item(id)] }; await refresh();
  }
  await act(async () => vi.advanceTimersByTimeAsync(2001)); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await refresh(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('clears stale notifications on local read and never displays in a hidden document', async () => {
  vi.useFakeTimers();
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  let feed = { enabled: true, cursor: 10, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : {});
  render(<ChatAlerts apiRequest={api} basePath="/shop-admin/chat" />); await act(async () => {});
  feed = { ...feed, cursor: 11, unread_count: 1, items: [item(11)] }; await refresh();
  expect(screen.getByRole('status')).toBeInTheDocument();
  await act(async () => window.dispatchEvent(new Event('mkpos:shop-chat-read'))); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  feed = { ...feed, cursor: 12, unread_count: 2, items: [item(12)] }; await refresh();
  hidden = true; await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  hidden = false; await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('does not replay a paginated saved-cursor backlog on login', async () => {
  vi.useFakeTimers(); localStorage.setItem('mkpos.chat-alert-cursor:/shop-admin/chat:login', '10');
  let latest = false;
  const api = vi.fn(async path => {
    if (!path.includes('/notifications')) return {};
    const previous = Number(new URLSearchParams(path.split('?')[1]).get('after_id'));
    const cursor = latest ? 15 : Math.min(14, previous + 1);
    return { enabled: true, cursor, unread_count: latest ? 5 : 4, items: [item(cursor)], has_more: cursor < 14 };
  });
  render(<ChatAlerts apiRequest={api} basePath="/shop-admin/chat" scope="login" />); await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  latest = true; await refresh(); expect(screen.getByRole('status')).toHaveTextContent('Message 15');
});

it('ignores hidden retained chat screens and clears messages read elsewhere', async () => {
  vi.useFakeTimers();
  let feed = { enabled: true, cursor: 10, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : {});
  const view = hidden => <><div hidden={hidden}><div className="shop-chat-inbox shop-chat-workspace" /></div><ChatAlerts apiRequest={api} basePath="/shop-admin/chat" /></>;
  const result = render(view(true)); await act(async () => {});
  feed = { ...feed, cursor: 11, unread_count: 3, items: [item(11)] }; await refresh();
  expect(screen.getByRole('status')).toBeInTheDocument();
  feed = { ...feed, unread_count: 2, items: [] }; await refresh();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  feed = { ...feed, cursor: 12, unread_count: 3, items: [item(12)] }; await refresh();
  result.rerender(view(false)); await act(async () => {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
