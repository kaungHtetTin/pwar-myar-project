import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MarketplaceHome } from '../MarketplaceHome';
import { LocaleContext } from '../i18n';

const root = { id: 10, name_en: 'Groceries & Food', name_my: 'စားသောက်ကုန်များ', path: 'Groceries & Food', path_my: 'စားသောက်ကုန်များ' };
const child = { id: 11, name_en: 'Rice & Grains', name_my: 'ဆန်', path: 'Groceries & Food / Rice & Grains', path_my: 'စားသောက်ကုန်များ / ဆန်', parent_id: 10 };
const response = data => ({ ok: true, json: async () => data });
const t = { search: 'Search', products: 'Products', shops: 'Shops' };
const ProductCard = ({ product }) => <a href={`#/store/demo/products/${product.id}`}>{product.name}</a>;
const ShopCard = () => null;
const ListEnd = ({ list }) => <div>{list.error}{list.items.length === 0 && !list.busy && 'No products'}<div ref={list.sentinel} /></div>;
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url.includes('/marketplace/categories')) return response({ items: url.includes('level=root') ? [root] : [root, child], has_more: false });
    return response({ items: [], has_more: false });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const home = locale => render(<LocaleContext.Provider value={locale || 'en'}><MarketplaceHome t={t} ProductCard={ProductCard} ShopCard={ShopCard} ListEnd={ListEnd} carts={[]} add={() => true} /></LocaleContext.Provider>);

it('loads Office categories independently of products and filters by marketplace category ID', async () => {
  home();
  fireEvent.click(await screen.findByRole('button', { name: root.name_en }));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('marketplace_category_id=10'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(await screen.findByRole('button', { name: root.path })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove category filter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(fetch.mock.calls.at(-1)[0]).toContain('marketplace_category_id=&'));
});

it('browses/searches the complete tree, selects a subcategory and restores focus on close', async () => {
  home(); const more = await screen.findByRole('button', { name: 'More', exact: true }); fireEvent.click(more);
  const panel = screen.getByRole('region', { name: 'All categories' });
  await within(panel).findByRole('button', { name: child.path });
  const search = within(panel).getByRole('textbox', { name: 'Search categories' });
  fireEvent.change(search, { target: { value: 'Rice' } }); fireEvent.submit(search.closest('form'));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('/marketplace/categories?q=Rice'))).toBe(true));
  fireEvent.click(await within(panel).findByRole('button', { name: child.path }));
  expect(fetch.mock.calls.some(([url]) => url.includes('marketplace_category_id=11'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('marketplace_category_id=11'))).toBe(true));
  expect(screen.queryByRole('region', { name: 'All categories' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  const trigger = screen.getByRole('button', { name: 'Filters' });
  expect(await screen.findByRole('button', { name: child.path })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Close filters' })); expect(trigger).toHaveFocus();
});

it('uses Myanmar category names and paths when the customer switches language', async () => {
  home('my'); fireEvent.click(await screen.findByRole('button', { name: root.name_my }));
  fireEvent.click(document.querySelector('.catalog-drawer-trigger'));
  expect(await screen.findByRole('button', { name: root.path_my })).toBeInTheDocument();
});

it('loads later category pages and retries errors without losing the existing list', async () => {
  let failNext = true;
  fetch.mockImplementation(async url => {
    if (url.includes('level=root')) return response({ items: [root], has_more: false });
    if (!url.includes('/marketplace/categories')) return response({ items: [], has_more: false });
    if (url.includes('offset=0')) return response({ items: [root], has_more: true });
    if (failNext) { failNext = false; return { ok: false, status: 503, json: async () => ({ message: 'Temporary category failure' }) }; }
    return response({ items: [child], has_more: false });
  });
  home(); fireEvent.click(await screen.findByRole('button', { name: 'More', exact: true }));
  const panel = screen.getByRole('region', { name: 'All categories' });
  fireEvent.click(await within(panel).findByRole('button', { name: 'Load more' }));
  await within(panel).findByRole('alert');
  expect(within(panel).getByRole('button', { name: root.path })).toBeInTheDocument();
  await act(async () => fireEvent.click(within(panel).getByRole('button', { name: 'Try again' })));
  await within(panel).findByRole('button', { name: child.path });
  expect(fetch.mock.calls.some(([url]) => url.includes('offset=1'))).toBe(true);
});
