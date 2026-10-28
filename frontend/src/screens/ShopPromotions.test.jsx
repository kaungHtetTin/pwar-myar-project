import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopPromotions } from './ShopPromotions';
import { RetainedViews } from '../components/RetainedViews';

vi.mock('../api', () => ({ request: vi.fn() }));
const coupon = { id: 10, type: 'coupon', name: 'Welcome coupon', code: 'WELCOME', product_id: null, discount_type: 'percentage', discount_value: 10,
  minimum_subtotal: 0, usage_limit: null, quantity_limit: null, used_count: 0, used_quantity: 0, starts_at: null, ends_at: null, enabled: true, status: 'active' };
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); request.mockReset(); request.mockResolvedValue({ items: [], total: 0 }); });

it('defaults new flash-sale hours in shop time and allows clearing optional boundaries', async () => {
  render(<ShopPromotions timezone="Asia/Rangoon" />);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Rangoon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  expect(screen.getByLabelText('Start time (optional)')).toHaveValue(`${date}T00:00`);
  expect(screen.getByLabelText('End time (optional)')).toHaveValue(`${date}T23:59`);
  fireEvent.change(screen.getByLabelText('Start time (optional)'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'No boundaries' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByLabelText('Start time (optional)')).toHaveValue('');
  expect(screen.getByLabelText('End time (optional)')).toHaveValue('');
});

it('creates an unlimited coupon and retains the entered form after a failed save', async () => {
  const writes = [];
  request.mockImplementation(async (path, options) => {
    if (!options) return { items: [], total: 0 };
    writes.push(JSON.parse(options.body));
    if (writes.length === 1) throw new Error('Coupon code already exists');
    return { id: 11, ok: true };
  });
  render(<ShopPromotions />);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add coupon' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Welcome' } });
  fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'welcome' } });
  fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Coupon code already exists');
  expect(screen.getByLabelText('Promotion name')).toHaveValue('Welcome');
  expect(screen.getByLabelText('Coupon code')).toHaveValue('WELCOME');
  fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0]).toMatchObject({ code: 'WELCOME', usage_limit: null, quantity_limit: null, starts_at: null, ends_at: null });
});

it('chooses a publication product and saves flash-sale quantity and shop-local duration', async () => {
  request.mockImplementation(async path => path.includes('/publications?') ? { items: [{ id: 42, name: 'Rice' }] } : { items: [], total: 0 });
  render(<ShopPromotions timezone="Asia/Rangoon" />);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Weekend rice' } });
  fireEvent.change(screen.getByLabelText('Start time (optional)'), { target: { value: '2026-10-08T09:00' } });
  fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '2026-10-09T18:00' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Rice' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.change(screen.getByLabelText('Rice discount (%)'), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText('Rice quantity limit'), { target: { value: '12.5' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/shop-admin/promotions', expect.objectContaining({ method: 'POST' })));
  const write = request.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(write[1].body)).toMatchObject({ items: [{ product_id: 42, discount_type: 'percentage', discount_value: 25, quantity_limit: 12.5 }], starts_at: '2026-10-08T09:00', ends_at: '2026-10-09T18:00' });
});

it('selects multiple products without duplicates, removes products, and retains all steps after a conflict', async () => {
  const products = [{ id: 42, name: 'Rice' }, { id: 43, name: 'Tea' }];
  request.mockImplementation(async (path, options) => {
    if (options) throw new Error('Tea already belongs to an overlapping flash sale');
    return { items: path.includes('/publications?') ? products : [], total: 0 };
  });
  const view = render(<RetainedViews activeKey="promotions"><ShopPromotions /></RetainedViews>);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  expect(screen.getByRole('button', { name: /Review/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Weekend' } });
  fireEvent.change(screen.getByLabelText('Start time (optional)'), { target: { value: '2026-10-09T09:00' } });
  fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '2026-10-08T09:00' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByRole('alert')).toHaveTextContent('End time must be later');
  fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '2026-10-10T09:00' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one product');
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Rice' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tea' }));
  expect(screen.getByText('2 products selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tea' }));
  expect(screen.getByText('1 product selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tea' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.change(screen.getByLabelText('Rice discount (%)'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Tea discount type'), { target: { value: 'fixed' } });
  fireEvent.change(screen.getByLabelText('Tea discount (Ks)'), { target: { value: '500' } });
  fireEvent.change(screen.getByLabelText('Tea quantity limit'), { target: { value: '3.5' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Tea already belongs');
  const retainedReads = request.mock.calls.length;
  view.rerender(<RetainedViews activeKey="other"><p>Another section</p></RetainedViews>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.rerender(<RetainedViews activeKey="promotions"><ShopPromotions /></RetainedViews>);
  expect(screen.getByText('2 selected products')).toBeInTheDocument();
  expect(request.mock.calls).toHaveLength(retainedReads);
  const write = request.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(write[1].body).items).toEqual([{ product_id: 42, discount_type: 'percentage', discount_value: 20, quantity_limit: null }, { product_id: 43, discount_type: 'fixed', discount_value: 500, quantity_limit: 3.5 }]);
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByLabelText('Rice discount (%)')).toHaveValue(20);
  fireEvent.click(screen.getByRole('button', { name: /Event & schedule/ }));
  expect(screen.getByLabelText('Promotion name')).toHaveValue('Weekend');
  expect(screen.getByLabelText('Start time (optional)')).toHaveValue('2026-10-09T09:00');
  const reads = request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(request.mock.calls).toHaveLength(reads);
});

it('edits a used flash sale with its product locked and saves through the single-product contract', async () => {
  const flash = { ...coupon, id: 15, type: 'flash_sale', product_id: 42, product_name: 'Rice', used_count: 1, used_quantity: 2,
    name: 'Rice sale', starts_at: '2026-10-08T02:30:00Z', ends_at: '2026-10-09T02:30:00Z' };
  request.mockResolvedValue({ items: [flash], total: 1 });
  render(<ShopPromotions timezone="Asia/Rangoon" />);
  await screen.findByText('Rice sale');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Rice sale' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(screen.getByLabelText('Start time (optional)')).toHaveValue('2026-10-08T09:00');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByRole('button', { name: 'Remove Rice' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Rice discount (%)'), { target: { value: '30' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const write = request.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(write[0]).toBe('/shop-admin/promotions/15');
  expect(JSON.parse(write[1].body)).toMatchObject({ product_id: 42, discount_value: 30 });
  expect(JSON.parse(write[1].body)).not.toHaveProperty('product_ids');
});

it('selects all matching products across pages and retains filters and row values on Previous', async () => {
  const products = [{ id: 42, name: 'Rice', category: 'Food' }, { id: 43, name: 'Tea', category: 'Food' }];
  request.mockImplementation(async path => {
    if (path.endsWith('/publications/filters')) return { categories: ['Food'] };
    if (path.includes('/publications?')) {
      const params = new URL(path, 'http://localhost').searchParams;
      return { items: [products[params.get('offset') === '0' ? 0 : 1]], total: 2, has_more: params.get('offset') === '0' };
    }
    return { items: [], total: 0 };
  });
  render(<ShopPromotions />);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Food event' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  await screen.findByRole('checkbox', { name: 'Select Rice' });
  fireEvent.change(screen.getByLabelText('Product category'), { target: { value: 'Food' } });
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select all matching products' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all matching products' }));
  await screen.findByText('2 products selected');
  expect(request.mock.calls.some(([path]) => path.includes('offset=1') && path.includes('category=Food'))).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.change(screen.getByLabelText('Rice discount (%)'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Tea discount (%)'), { target: { value: '15' } });
  fireEvent.keyDown(screen.getByLabelText('Rice discount (%)'), { key: 'ArrowDown' });
  expect(screen.getByLabelText('Tea discount (%)')).toHaveFocus();
  const reads = request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getByLabelText('Product category')).toHaveValue('Food');
  expect(screen.getByRole('checkbox', { name: 'Select Tea' })).toBeChecked();
  expect(request.mock.calls).toHaveLength(reads);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByLabelText('Rice discount (%)')).toHaveValue(10);
  expect(screen.getByLabelText('Tea discount (%)')).toHaveValue(15);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Tea' }));
  expect(screen.queryByLabelText('Tea discount (%)')).not.toBeInTheDocument();
});

it('retries catalog failures, loads another page, and rejects selecting more than 100 matching products', async () => {
  let failed = false;
  request.mockImplementation(async path => {
    if (path.includes('/publications?')) {
      if (!failed) { failed = true; throw new Error('Catalog unavailable'); }
      const params = new URL(path, 'http://localhost').searchParams;
      const teaOnly = params.get('q') === 'Tea';
      return { items: [{ id: teaOnly || params.get('offset') !== '0' ? 43 : 42, name: teaOnly || params.get('offset') !== '0' ? 'Tea' : 'Rice' }], total: teaOnly ? 1 : 101, has_more: !teaOnly && params.get('offset') === '0' };
    }
    return { items: [], total: 0, categories: [] };
  });
  render(<ShopPromotions />);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Retry event' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry products' }));
  await screen.findByRole('checkbox', { name: 'Select Rice' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all matching products' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Select up to 100 products');
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).not.toBeChecked();
  // Changing the search clears the error and keeps the selected product state.
  fireEvent.change(screen.getByLabelText('Search flash sale products'), { target: { value: 'Tea' } });
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Select Rice' })).not.toBeInTheDocument());
  fireEvent.keyDown(screen.getByRole('option', { name: 'Tea' }), { key: 'Enter' });
  expect(screen.getByRole('checkbox', { name: 'Select Tea' })).toBeChecked();
  fireEvent.change(screen.getByLabelText('Search flash sale products'), { target: { value: '' } });
  await screen.findByRole('checkbox', { name: 'Select Rice' });
  fireEvent.click(screen.getByRole('button', { name: 'Load more products' }));
  expect(await screen.findByRole('checkbox', { name: 'Select Tea' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rice' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.keyDown(screen.getByLabelText('Rice discount (%)'), { key: 'ArrowUp' });
  expect(screen.getByLabelText('Tea discount (%)')).toHaveFocus();
  fireEvent.keyDown(screen.getByLabelText('Tea discount (%)'), { key: 'Enter' });
  expect(screen.getByLabelText('Rice discount (%)')).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Save promotion' })).not.toBeInTheDocument();
});

it('selects promotions across pages, cancels without refetch, and retries atomic bulk deletion', async () => {
  let writes = 0;
  const second = { ...coupon, id: 11, name: 'Second coupon' };
  request.mockImplementation(async (path, options) => {
    if (options) {
      writes++;
      if (writes === 1) throw new Error('Deletion failed. Try again.');
      return { ok: true, deleted_count: 2 };
    }
    if (writes > 1) return { items: [], total: 0 };
    return { items: path.includes('offset=25') ? [second] : [coupon], total: 26 };
  });
  const view = render(<RetainedViews activeKey="promotions"><ShopPromotions /></RetainedViews>);
  await screen.findByText('Welcome coupon');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all promotions on this page' }));
  expect(screen.getByText('1 selected across pages')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Second coupon');
  expect(screen.getByRole('checkbox', { name: 'Select all promotions on this page' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second coupon (11)' }));
  const reads = request.mock.calls.length;
  view.rerender(<RetainedViews activeKey="other"><p>Another section</p></RetainedViews>);
  view.rerender(<RetainedViews activeKey="promotions"><ShopPromotions /></RetainedViews>);
  expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
  expect(request.mock.calls).toHaveLength(reads);
  fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete selected promotions' });
  expect(within(dialog).getByText('Welcome coupon')).toBeInTheDocument();
  expect(writes).toBe(0);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(request.mock.calls).toHaveLength(reads);
  expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete 2 promotions' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Deletion failed');
  expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete 2 promotions' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await screen.findByText(/No promotions found/);
  const calls = request.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(calls).toHaveLength(2);
  expect(calls[0][0]).toBe('/shop-admin/promotions/bulk-delete');
  expect(JSON.parse(calls[0][1].body)).toEqual({ ids: [10, 11] });
  expect(calls[1][1].body).toBe(calls[0][1].body);
  expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
});

it('shows partial page selection and clears it explicitly or when search and filters change', async () => {
  request.mockResolvedValue({ items: [coupon, { ...coupon, id: 11, name: 'Second coupon' }], total: 2 });
  render(<ShopPromotions />);
  await screen.findByText('Welcome coupon');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Welcome coupon (10)' }));
  expect(screen.getByRole('checkbox', { name: 'Select all promotions on this page' }).indeterminate).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(screen.getByRole('checkbox', { name: 'Select Welcome coupon (10)' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all promotions on this page' }));
  expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all promotions on this page' }));
  expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Welcome coupon (10)' }));
  fireEvent.change(screen.getByLabelText('Search promotions'), { target: { value: 'Welcome' } });
  expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
  await waitFor(() => expect(request.mock.calls.at(-1)[0]).toContain('q=Welcome'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Welcome coupon (10)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'coupon' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
});

it('pauses a coupon, deletes with confirmation, and keeps filters and drafts across retained views', async () => {
  request.mockResolvedValue({ items: [coupon], total: 1 });
  const view = render(<RetainedViews activeKey="promotions"><ShopPromotions /></RetainedViews>);
  await screen.findByText('Welcome coupon');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Welcome coupon' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Pause' }));
  await waitFor(() => expect(request.mock.calls.some(([, options]) => options?.method === 'PUT' && JSON.parse(options.body).enabled === false)).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'coupon' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paused' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request.mock.calls.at(-1)[0]).toContain('type=coupon&status=paused'));
  fireEvent.click(screen.getByRole('button', { name: 'Add coupon' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Keep my draft' } });
  const readCount = request.mock.calls.length;
  view.rerender(<RetainedViews activeKey="other"><p>Another section</p></RetainedViews>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.rerender(<RetainedViews activeKey="promotions"><ShopPromotions /></RetainedViews>);
  expect(screen.getByLabelText('Promotion name')).toHaveValue('Keep my draft');
  expect(request.mock.calls).toHaveLength(readCount);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Welcome coupon' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(request.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete promotion' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/shop-admin/promotions/10', { method: 'DELETE' }));
});


it('disables promoted rows for mouse and keyboard and skips them in bulk selection', async () => {
  request.mockImplementation(async path => path.includes('/publications?') ? { items: [
    { id: 42, name: 'Rice', flash_sale_conflict: { id: 9, name: 'Existing sale' } },
    { id: 43, name: 'Tea', base_unit: 'Piece' },
  ], total: 2, has_more: false } : { items: [], total: 0 });
  render(<ShopPromotions />);
  await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'New event' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(await screen.findByRole('checkbox', { name: 'Select Rice' })).toBeDisabled();
  expect(screen.getByText('Already promoted: Existing sale')).toBeInTheDocument();
  const row = screen.getByRole('option', { name: 'Rice' });
  fireEvent.click(row); fireEvent.keyDown(row, { key: 'Enter' });
  expect(screen.getByText('0 products selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all matching products' }));
  await screen.findByText('1 product selected');
  expect(screen.getByRole('checkbox', { name: 'Select Tea' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).not.toBeChecked();
  expect(request.mock.calls.some(([path]) => path.includes('flash_sale_picker=1') && path.includes('flash_sale_starts_at='))).toBe(true);
});

it('rechecks selected products after schedule changes and allows removing a now-conflicting selection', async () => {
  request.mockImplementation(async path => {
    if (!path.includes('/publications?')) return { items: [], total: 0 };
    const params = new URL(path, 'http://localhost').searchParams;
    return { items: [{ id: 42, name: 'Rice', flash_sale_conflict: params.get('flash_sale_starts_at') === '2026-11-01T00:00' ? { id: 9, name: 'November sale' } : null }], total: 1, has_more: false };
  });
  render(<ShopPromotions />); await screen.findByText(/No promotions found/);
  fireEvent.click(screen.getByRole('button', { name: 'Add flash sale' }));
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'New event' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Rice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  fireEvent.change(screen.getByLabelText('Start time (optional)'), { target: { value: '2026-11-01T00:00' } });
  fireEvent.change(screen.getByLabelText('End time (optional)'), { target: { value: '2026-11-02T00:00' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  await screen.findByText('Already promoted: November sale');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));
  expect(screen.getByRole('alert')).toHaveTextContent('Already in an overlapping flash sale: Rice');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rice' }));
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).toBeDisabled();
  expect(screen.getByText('0 products selected')).toBeInTheDocument();
});
