import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ShopCatalog } from './ShopCatalog';
import { apiRequest } from '../api/client';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const products = [{ id: 1, name: 'Rice', stock: 10, base_unit: 'Bag', base_price: 1000 }, { id: 2, name: 'Tea', stock: 20, base_unit: 'Piece', base_price: 500 }];
beforeEach(() => { vi.clearAllMocks(); apiRequest.mockImplementation(async path => path.endsWith('/filters') ? { categories: [] } : { items: products, total: 2, published_count: 0 }); });

it('publishes only selected IDs, keeps selection through cancellation and clears it after success', async () => {
  const navigate = vi.fn();
  render(<ShopCatalog onNavigate={navigate} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Rice' }));
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected', exact: true }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel', exact: true }));
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).toBeChecked();
  expect(apiRequest.mock.calls.some(([, options]) => options?.method)).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected', exact: true }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish selected', exact: true }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/shop-admin/publications/bulk', { method: 'PUT', body: JSON.stringify({ published: true, product_ids: [1] }) }));
  await screen.findByRole('button', { name: 'Publish all filtered' });
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).not.toBeChecked();
});

it('preserves selections across search and validation errors and supports select loaded and clear', async () => {
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method) throw new Error('Invalid online price for Rice.');
    if (path.endsWith('/filters')) return { categories: [] };
    const q = new URL(path, 'http://test').searchParams.get('q');
    const items = products.filter(product => !q || product.name.includes(q));
    return { items, total: items.length };
  });
  render(<ShopCatalog onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Rice' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search publication' }), { target: { value: 'Tea' } });
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Select Rice' })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select loaded products' }));
  expect(screen.getByText('2 selected products')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish selected', exact: true }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unpublish selected', exact: true }));
  await screen.findByText('Invalid online price for Rice.');
  expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method)[1].body)).toEqual({ published: false, product_ids: [1, 2] });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(screen.getByRole('button', { name: 'Publish all filtered' })).toBeInTheDocument();
});
