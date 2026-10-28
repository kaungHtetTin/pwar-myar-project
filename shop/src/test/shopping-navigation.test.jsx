import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../main';

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, '', '#/marketplace');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const response = data => ({ ok: true, json: async () => data });
const mobile = () => within(document.querySelector('.mobile-navigation'));

it.each([
  ['login', 'Welcome back'],
  ['register', 'Create customer account'],
])('renders %s as a standalone page', async (route, title) => {
  window.history.replaceState({}, '', `#/account/${route}?next=%2Fchats`);
  render(<App />);
  expect(await screen.findByRole('heading', { name: title, exact: true })).toBeVisible();
  expect(document.querySelector('.mobile-navigation')).toBeNull();
  expect(document.querySelector('.desktop-navigation')).toBeNull();
  expect(document.querySelector('footer')).toBeNull();
  expect(screen.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Change language' })).toBeVisible();
  const switchLink = document.querySelector('.auth-switch a');
  expect(switchLink).toHaveAttribute('href', `#/account/${route === 'login' ? 'register' : 'login'}?next=%2Fchats`);
});

it('offers Chats as a main tab and keeps guests on a sign-in prompt with the inbox return destination', async () => {
  window.history.replaceState({}, '', '#/chats');
  vi.stubGlobal('fetch', vi.fn(async () => response({ items: [], has_more: false })));
  render(<App />);
  expect(mobile().getAllByRole('link')).toHaveLength(5);
  expect(mobile().getByRole('link', { name: 'Chats', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(mobile().getByRole('link', { name: 'Home', exact: true })).not.toHaveAttribute('aria-current');
  expect(await within(document.querySelector('main')).findByRole('heading', { name: 'Chats', exact: true })).toBeVisible();
  expect(within(document.querySelector('main')).getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '#/account/login?next=%2Fchats');
});

it('starts with products and sends guest Orders to private tracking', async () => {
  const fetch = vi.fn(async () => response({ items: [], has_more: false }));
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Products', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await screen.findByText('No results found.');
  expect(fetch.mock.calls.some(([url]) => url.includes('/marketplace/products?') && !url.includes('on_sale=1'))).toBe(true);
  expect(mobile().getByRole('link', { name: 'Orders', exact: true })).toHaveAttribute('href', '#/orders/track');
});

it('resumes the same home search and loaded data after switching to Cart and back', async () => {
  const fetch = vi.fn(async () => response({ items: [], has_more: false }));
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  await screen.findByText('No results found.');
  const search = screen.getByPlaceholderText('Search products or categories');
  fireEvent.change(search, { target: { value: 'Unsubmitted home search' } });
  const initialCalls = fetch.mock.calls.length;
  await act(async () => { window.location.hash = '/cart'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(search.closest('[data-retained-view]')).toHaveAttribute('hidden');
  await act(async () => { window.location.hash = '/marketplace'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(screen.getByPlaceholderText('Search products or categories')).toBe(search);
  expect(search).toHaveValue('Unsubmitted home search');
  expect(fetch.mock.calls.length).toBe(initialCalls);
});

it('waits for the customer session before rendering the Orders destination', async () => {
  localStorage.setItem('mkpos.shop.customerToken', 'test-session');
  window.history.replaceState({}, '', '#/orders');
  let resolveCustomer;
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.endsWith('/customer/me')) return new Promise(resolve => { resolveCustomer = resolve; });
    if (url.includes('/customer/orders')) return response({ items: [{ reference: 'O-1', store_name: 'Demo', store_slug: 'demo', total: 1000, currency: 'Ks', status: 'pending', payment_status: 'unpaid' }], has_more: false });
    return response({ enabled: false, unread_count: 0, items: [] });
  }));
  render(<App />);
  expect(screen.getByRole('status')).toHaveClass('shop-skeleton-orders');
  expect(screen.queryByLabelText('Private tracking credential')).not.toBeInTheDocument();
  await act(async () => resolveCustomer(response({ customer: { id: 1, name: 'Buyer', email: 'buyer@example.test' } })));
  expect(await screen.findByText('#O-1')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'My orders', exact: true })).toBeInTheDocument();
  expect(mobile().getByRole('link', { name: 'Orders', exact: true })).toHaveAttribute('href', '#/orders');
  expect(screen.queryByLabelText('Private tracking credential')).not.toBeInTheDocument();
});

it('offers a standalone password reset page from the customer sign-in flow', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({ items: [], has_more: false })));
  window.history.replaceState({}, '', '#/account/login?next=%2Fchats'); render(<App />);
  const forgot = screen.getByRole('link', { name: 'Forgot password?' });
  expect(forgot).toHaveAttribute('href', '#/account/forgot-password?next=%2Fchats');
  await act(async () => { window.location.hash = '/account/forgot-password?next=%2Fchats'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(screen.getByRole('button', { name: 'Send reset code' })).toBeVisible();
  expect(document.querySelector('.mobile-navigation')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
  await screen.findByRole('heading', { name: 'Welcome back' });
  expect(window.location.hash).toContain('next=%2Fchats');
});
