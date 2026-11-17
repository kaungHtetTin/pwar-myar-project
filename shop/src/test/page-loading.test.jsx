import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PageLoadBoundary } from '../PageLoadBoundary';
import { LoadingSkeleton } from '../LoadingSkeleton';
import { App } from '../main';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const response = data => ({ ok: true, json: async () => data });

it('keeps the same visible skeleton through consecutive stages and reveals content once', () => {
  const page = step => <PageLoadBoundary variant="orders" waiting={step === 0}>
    {step < 2 ? <LoadingSkeleton variant={step === 0 ? 'account' : 'orders'} /> : <h1>Ready orders</h1>}
  </PageLoadBoundary>;
  const view = render(page(0));
  const skeleton = screen.getByRole('status');
  view.rerender(page(1));
  expect(screen.getByRole('status')).toBe(skeleton);
  expect(screen.queryByRole('heading')).toBeNull();
  view.rerender(page(2));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Ready orders' })).toBeVisible();
});

it('does not hide loaded content again for incremental loading', () => {
  const page = more => <PageLoadBoundary variant="orders"><h1>Existing order</h1>{more && <LoadingSkeleton variant="orders" count={1} />}</PageLoadBoundary>;
  const view = render(page(false));
  const existing = screen.getByRole('heading');
  view.rerender(page(true));
  expect(existing).toBeVisible();
  expect(document.querySelector('[data-page-loading]')).toBeNull();
});

it('waits for session and order data behind the same initial skeleton', async () => {
  localStorage.setItem('mkpos.shop.customerToken', 'saved-session');
  window.history.replaceState({}, '', '#/orders');
  let session, orders;
  vi.stubGlobal('fetch', vi.fn(url => {
    if (url.endsWith('/customer/me')) return new Promise(resolve => { session = resolve; });
    if (url.includes('/customer/orders?')) return new Promise(resolve => { orders = resolve; });
    return Promise.resolve(response({ items: [], unread_count: 0, enabled: false }));
  }));
  render(<App />);
  const skeleton = screen.getByRole('status');
  await act(async () => session(response({ customer: { id: 1, name: 'Buyer' } })));
  expect(screen.getByRole('status')).toBe(skeleton);
  expect(screen.queryByRole('heading', { name: 'My orders' })).toBeNull();
  await act(async () => orders(response({ items: [], has_more: false })));
  expect(screen.getByRole('heading', { name: 'My orders' })).toBeVisible();
  expect(screen.queryByRole('status')).toBeNull();
});

it('does not remount public page data after a saved session resolves', async () => {
  localStorage.setItem('mkpos.shop.customerToken', 'saved-session');
  window.history.replaceState({}, '', '#/marketplace');
  let session;
  const fetchMock = vi.fn(url => url.endsWith('/customer/me')
    ? new Promise(resolve => { session = resolve; })
    : Promise.resolve(response({ items: [], has_more: false, enabled: false, unread_count: 0 })));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await act(async () => {});
  const skeleton = screen.getByRole('status');
  const publicCalls = fetchMock.mock.calls.filter(([url]) => url.includes('/marketplace/')).length;
  await act(async () => session(response({ customer: { id: 2, name: 'Buyer' } })));
  expect(screen.queryByRole('status')).toBeNull();
  expect(skeleton).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Shop Now' })).toBeVisible();
  expect(fetchMock.mock.calls.filter(([url]) => url.includes('/marketplace/'))).toHaveLength(publicCalls);
});

it('shows a failed session check as an error instead of a false signed-out page', async () => {
  localStorage.setItem('mkpos.shop.customerToken', 'saved-session');
  window.history.replaceState({}, '', '#/chats');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '60' }), json: async () => ({ message: 'Too many requests. Please try again shortly.' }) })));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  expect(localStorage.getItem('mkpos.shop.customerToken')).toBe('saved-session');
});

it.each([false, true])('keeps a conversation covered through lookup (%s), setup and messages, then marks it read', async viaShop => {
  localStorage.setItem('mkpos.shop.customerToken', 'saved-session');
  window.history.replaceState({}, '', viaShop ? '#/chats?shop=demo' : '#/chats/demo');
  let setup, messages, lookup;
  const fetchMock = vi.fn(url => {
    if (url.endsWith('/customer/me')) return Promise.resolve(response({ customer: { id: 1, name: 'Buyer' } }));
    if (url.endsWith('/stores/demo/chat')) return new Promise(resolve => { lookup = resolve; });
    if (url.endsWith('/chat/demo')) return new Promise(resolve => { setup = resolve; });
    if (url.includes('/chat/demo/messages')) return new Promise(resolve => { messages = resolve; });
    if (url.endsWith('/stores/demo')) return Promise.resolve(response({ display_name: 'Demo' }));
    return Promise.resolve(response({ items: [], enabled: false, realtime_enabled: false, unread_count: 0 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  const skeleton = screen.getByRole('status');
  await act(async () => {});
  if (viaShop) {
    await act(async () => lookup(response({ thread: { uuid: 'demo' } })));
    expect(screen.getByRole('status')).toBe(skeleton);
  }
  await act(async () => setup(response({ thread: { uuid: 'demo', slug: 'demo', shop_name: 'Demo' } })));
  expect(screen.getByRole('status')).toBe(skeleton);
  expect(screen.getByLabelText('Message')).not.toBeVisible();
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/chat/demo/read'))).toBe(false);
  await act(async () => messages(response({ items: [{ id: 9, sender: 'owner', body: 'Hello shopper', created_at: '2026-10-15 10:00:00' }], has_more: false, thread: {} })));
  expect(screen.getByText('Hello shopper')).toBeVisible();
  expect(screen.getByLabelText('Message')).toBeVisible();
  expect(skeleton).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/chat/demo/read'))).toHaveLength(1);
});
