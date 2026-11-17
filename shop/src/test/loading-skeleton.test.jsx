import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoadingSkeleton } from '../LoadingSkeleton';
import { ProductMedia } from '../ShoppingComponents';
import { App } from '../main';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['products', 'shop-products', 'shops', 'shop', 'product', 'checkout', 'order', 'orders', 'account', 'profile', 'auth', 'report', 'addresses', 'notifications', 'alerts', 'chats', 'conversation', 'reviews', 'cart-status', 'image'])(
  'keeps the %s skeleton decorative, labelled, and free of fake interactive controls', variant => {
    const { container } = render(<LoadingSkeleton variant={variant} message="Loading content" />);
    const status = screen.getByRole('status', { name: 'Loading content' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.querySelector('.sk-layout')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('button, input, a, select, textarea, [tabindex]')).toBeNull();
    expect(container.querySelector('.shop-skeleton-block')).toBeInTheDocument();
  },
);

it('replaces image skeletons on load, restarts for a new source, and falls back after a failure', () => {
  const view = render(<ProductMedia src="/first.jpg" name="Rice" />);
  expect(view.container.querySelector('.shop-image-skeleton')).toBeInTheDocument();
  fireEvent.load(screen.getByRole('img', { name: 'Rice' }));
  expect(view.container.querySelector('.shop-image-skeleton')).toBeNull();
  view.rerender(<ProductMedia src="/second.jpg" name="Rice" />);
  expect(view.container.querySelector('.shop-image-skeleton')).toBeInTheDocument();
  fireEvent.error(screen.getByRole('img', { name: 'Rice' }));
  expect(view.container.querySelector('.shop-image-skeleton')).toBeNull();
  expect(view.container.querySelector('.product-placeholder')).toBeInTheDocument();
});

it('keeps one shop skeleton until both shop and product requests finish', async () => {
  window.history.replaceState({}, '', '#/store/demo');
  let resolveShop, resolveProducts;
  vi.stubGlobal('fetch', vi.fn(url => {
    if (url.endsWith('/stores/demo')) return new Promise(resolve => { resolveShop = resolve; });
    if (url.includes('/products?')) return new Promise(resolve => { resolveProducts = resolve; });
    return Promise.resolve({ ok: true, json: async () => ({ items: [], has_more: false, summary: { average: 0, count: 0 } }) });
  }));
  render(<App />);
  const skeleton = screen.getByRole('status');
  expect(skeleton).toHaveClass('shop-skeleton-shop');
  await act(async () => resolveShop({ ok: true, json: async () => ({ display_name: 'Local Groceries', accepting_orders: true, categories: [] }) }));
  expect(screen.getByRole('status')).toBe(skeleton);
  expect(screen.queryByRole('heading', { name: 'Local Groceries' })).toBeNull();
  await act(async () => resolveProducts({ ok: true, json: async () => ({ items: [], has_more: false }) }));
  expect(await screen.findByRole('heading', { name: 'Local Groceries' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).toBeNull();
});

it('replaces failed product loading with a retry action rather than leaving a skeleton running', async () => {
  window.history.replaceState({}, '', '#/store/demo/products/1');
  let rejectProduct;
  vi.stubGlobal('fetch', vi.fn(() => new Promise((_, reject) => { rejectProduct = reject; })));
  render(<App />);
  expect(screen.getByRole('status')).toHaveClass('shop-skeleton-product');
  expect(document.querySelector('main')).toHaveClass('is-product-page', 'has-purchase-bar');
  await act(async () => rejectProduct(new Error('Network unavailable')));
  await screen.findByRole('alert');
  expect(screen.queryByRole('status')).toBeNull();
  expect(document.querySelector('main')).toHaveClass('is-product-page');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('uses one home skeleton while marketplace sections prepare in the background', async () => {
  window.history.replaceState({}, '', '#/marketplace');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  render(<App />);
  await waitFor(() => expect(document.querySelector('.shop-skeleton-shops')).toBeInTheDocument());
  expect(document.querySelector('.shop-skeleton-products')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Shop Now' })).toBeNull();
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveClass('shop-skeleton-home');
  expect(screen.getAllByRole('link', { name: 'Cart' }).length).toBeGreaterThan(0);
});
