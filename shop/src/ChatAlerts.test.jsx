import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatAlerts } from './ChatAlerts';
import { ShopAlertProvider } from './ShopAlertProvider';

afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('shows incoming messages outside chat, dismisses once, and alerts for a newer message', async () => {
  vi.useFakeTimers();
  let feed = { enabled: true, cursor: 10, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : { ok: true });
  const open = vi.fn();
  render(<ShopAlertProvider scope="test" customerId={7}><ChatAlerts apiRequest={api} basePath="/chat" onOpen={open} /></ShopAlertProvider>);
  await act(async () => {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/chat/presence', { method: 'POST', body: '{}' });
  feed = { enabled: true, cursor: 11, unread_count: 1, items: [{ id: 11, name: 'Buyer', preview: 'Hello', uuid: 'thread' }] };
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.getByRole('status')).toHaveTextContent('New message');
  expect(screen.getByRole('button', { name: 'Open chat' })).toHaveTextContent('Buyer');
  expect(api).toHaveBeenCalledWith('/chat/notifications?after_id=10');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  feed = { ...feed, cursor: 12, items: [{ id: 12, name: 'Buyer', preview: 'A second message', uuid: 'thread' }] };
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 12, uuid: 'thread' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('keeps existing unread messages in the badge without replaying an alert on login', async () => {
  vi.useFakeTimers();
  let unread = 3;
  const api = vi.fn(async path => path.includes('/notifications') ? { enabled: true, cursor: 7, unread_count: unread, items: [] } : {});
  render(<ShopAlertProvider scope="test" customerId={7}><ChatAlerts apiRequest={api} basePath="/chat" /></ShopAlertProvider>);
  await act(async () => {});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  unread = 0;
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('summarizes missed messages on reconnect, preserves unread counts and auto-hides', async () => {
  vi.useFakeTimers();
  let feed = { enabled: true, cursor: 0, unread_count: 0, items: [] };
  const api = vi.fn(async path => path.includes('/notifications') ? feed : {});
  const unread = vi.fn();
  render(<ShopAlertProvider scope="recovery" customerId={7}><ChatAlerts apiRequest={api} basePath="/chat" onUnread={unread} /></ShopAlertProvider>);
  await act(async () => {});
  act(() => window.dispatchEvent(new Event('offline')));
  feed = { enabled: true, cursor: 3, unread_count: 3, items: [1, 2, 3].map(id => ({ id, uuid: 'thread' })) };
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(screen.getByRole('status')).toHaveTextContent('While you were away');
  expect(screen.getByRole('status')).toHaveTextContent('3 new messages');
  expect(unread).toHaveBeenLastCalledWith(3);
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(api.mock.calls.some(([path]) => path.endsWith('/read'))).toBe(false);
});
