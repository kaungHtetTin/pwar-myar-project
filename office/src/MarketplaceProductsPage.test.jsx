import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MarketplaceProductsPage } from './MarketplaceProductsPage';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const category = { id: 8, path: 'Food / Rice', name_en: 'Rice', name_my: '', effective_active: true };
const rice = { id: 1, business_id: 10, name: 'Rice bag', sku: 'RICE', barcode: '123', business_category: 'Groceries', shop_name: 'Shop A', price: 2000, currency: 'Ks', stock: 10, is_active: true, published: true, link_version: 0, link_status: 'unlinked', marketplace_category: null };
const tea = { ...rice, id: 2, name: 'Green tea', business_id: 20, shop_name: 'Shop B' };
const listing = { items: [rice, tea], total: 2, page: 1, last_page: 1, summary: { total: 2, linked: 0, unlinked: 2, needs_review: 0 } };
beforeEach(() => {
  window.history.replaceState({}, '', '/'); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); api.mockReset();
  api.mockImplementation(path => Promise.resolve(path.includes('/options') ? { items: [category], has_more: false } : /\/\d+$/.test(path) ? { ...rice, history: [] } : path.includes('/shops') ? { items: [{ id: 10, path: 'Shop A' }], has_more: false } : listing));
});
afterEach(() => vi.restoreAllMocks());
async function manage() {
  await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Rice bag (#1)' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Manage category' }));
  return screen.getByRole('dialog', { name: 'Manage product category' });
}

it('opens a classification modal over the same list and dismisses without a list fetch', async () => {
  render(<MarketplaceProductsPage />); await screen.findByRole('table'); const table = screen.getByRole('table');
  const dialog = await manage(); expect(screen.getByRole('table')).toBe(table);
  expect(within(dialog).getByText('Groceries')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('table')).toBe(table);
  expect(api.mock.calls.filter(([path]) => path.includes('/marketplace-products?'))).toHaveLength(1);
});

it('requires an explicit bulk choice, submits exact products/versions, preserves failed drafts and blocks duplicates', async () => {
  let writes = 0, finish;
  const base = api.getMockImplementation();
  api.mockImplementation((path, options) => {
    if (options?.method === 'POST') {
      writes++; if (writes === 1) return Promise.reject(new Error('Temporary link failure'));
      return new Promise(resolve => { finish = resolve; });
    }
    if (writes > 1 && path.includes('/marketplace-products?')) return new Promise(() => {});
    return base(path, options);
  });
  render(<MarketplaceProductsPage />); await screen.findByRole('table');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all products on this page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Link selected (2)' }));
  expect(screen.getByRole('button', { name: 'Save links' })).toBeDisabled();
  await screen.findByRole('option', { name: 'Food / Rice' });
  fireEvent.change(screen.getByLabelText('Marketplace category'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save links' }));
  await screen.findByText('Temporary link failure');
  expect(screen.getByLabelText('Marketplace category')).toHaveValue('8');
  fireEvent.click(screen.getByRole('button', { name: 'Save links' }));
  fireEvent.submit(screen.getByLabelText('Marketplace category').closest('form'));
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(writes).toBe(2);
  const [, options] = api.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(options.body)).toEqual({ category_id: 8, products: [{ id: 1, version: 0 }, { id: 2, version: 0 }] });
  await act(async () => finish({ changed: 2, items: [rice, tea].map(product => ({ ...product, marketplace_category: category, link_version: 1, link_status: 'linked' })) }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(within(screen.getByRole('table')).getAllByText('Food / Rice')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Link selected (0)' })).toBeDisabled();
  expect(screen.queryByText('Loading marketplace products…')).not.toBeInTheDocument();
});

it('scopes selection to the current query and keeps filters when clearing search', async () => {
  render(<MarketplaceProductsPage />); await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: /^All products:/ }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('link_status=all'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rice bag (#1)' }));
  expect(screen.getByRole('button', { name: 'Link selected (1)' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /Unlinked/ }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('link_status=unlinked'));
  expect(screen.getByRole('button', { name: 'Link selected (0)' })).toBeDisabled();
  const search = screen.getByRole('searchbox', { name: 'Search marketplace products' });
  fireEvent.change(search, { target: { value: 'Rice' } }); fireEvent.submit(search.closest('form'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear search marketplace products' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('link_status=unlinked'));
  expect(api.mock.calls.at(-1)[0]).not.toContain('q=Rice');
});

it('applies shop and category filters and clears only drawer filters', async () => {
  render(<MarketplaceProductsPage />); await screen.findByRole('table');
  expect(api.mock.calls.find(([path]) => path.includes('/marketplace-products?'))[0]).toContain('link_status=unlinked');
  expect(api.mock.calls.find(([path]) => path.includes('/marketplace-products?'))[0]).toContain('publication=published');
  fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  expect(screen.getByLabelText('Link status')).toHaveValue('unlinked');
  expect(screen.getByLabelText('Publication')).toHaveValue('published');
  fireEvent.change(screen.getByLabelText('Link status'), { target: { value: 'linked' } });
  fireEvent.change(screen.getByLabelText('Publication'), { target: { value: 'unpublished' } });
  await screen.findByRole('option', { name: 'Shop A' });
  fireEvent.change(screen.getByLabelText('Shop'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Marketplace category'), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText('Business category'), { target: { value: 'Groceries' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('business_id=10'));
  expect(api.mock.calls.at(-1)[0]).toContain('category_id=8');
  expect(api.mock.calls.at(-1)[0]).toContain('per_page=10');
  expect(api.mock.calls.at(-1)[0]).not.toContain('_label');
  fireEvent.click(screen.getByRole('button', { name: /Filters/ })); fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).not.toContain('business_id=10'));
  expect(api.mock.calls.at(-1)[0]).toContain('per_page=10');
  expect(api.mock.calls.at(-1)[0]).toContain('link_status=unlinked');
  expect(api.mock.calls.at(-1)[0]).toContain('publication=published');
});
