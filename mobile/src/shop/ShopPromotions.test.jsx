import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopPromotionForm, ShopPromotions } from './ShopPromotions';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it('creates a normalized coupon from its full page', async () => {
  apiRequest.mockResolvedValue({ timezone: 'Asia/Rangoon', categories: [] });
  const navigate = vi.fn();
  render(<ShopPromotionForm onNavigate={navigate} />);
  await screen.findByLabelText('Promotion name');
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: ' Summer ' } });
  fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'save10' } });
  const starts = screen.getByLabelText('Starts at (optional)');
  starts.showPicker = vi.fn();
  fireEvent.click(starts);
  expect(starts.showPicker).toHaveBeenCalledOnce();
  fireEvent.change(starts, { target: { value: '2026-10-18' } });
  fireEvent.change(screen.getByLabelText('Ends at (optional)'), { target: { value: '2026-10-20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save coupon' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/promotions', { replace: true }));
  const payload = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body);
  expect(screen.getByLabelText('Promotion name')).toHaveValue('');
  expect(screen.getByLabelText('Coupon code')).toHaveValue('');
  expect(payload).toMatchObject({ name: 'Summer', code: 'SAVE10', usage_limit: null, discount_value: 10, enabled: true, starts_at: '2026-10-18T00:00', ends_at: '2026-10-20T00:00' });
});
it('creates multiple flash sale rows with independent quantity and discount settings', async () => {
  apiRequest.mockImplementation(async path => path.includes('/publications?') ? { items: [{ id: 3, name: 'Rice' }, { id: 4, name: 'Tea' }], total: 2 } : { categories: [], timezone: 'Asia/Rangoon' });
  render(<ShopPromotionForm type="flash_sale" onNavigate={vi.fn()} />);
  await screen.findByLabelText('Promotion name');
  fireEvent.change(screen.getByLabelText('Promotion name'), { target: { value: 'Weekend' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose products' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Select all filtered products' }));
  await screen.findByRole('button', { name: 'Add 2 products' });
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 products' }));
  await screen.findByText('2 products selected');
  fireEvent.change(screen.getAllByLabelText('Discount value')[1], { target: { value: '15' } });
  fireEvent.change(screen.getAllByLabelText('Quantity limit (optional)')[0], { target: { value: '1.5' } });
  fireEvent.change(screen.getByLabelText('Starts at (optional)'), { target: { value: '2026-10-18' } });
  fireEvent.change(screen.getByLabelText('Ends at (optional)'), { target: { value: '2026-10-20' } });
  fireEvent.change(screen.getByLabelText('Ends at (optional)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save flash sale' }));
  await waitFor(() => expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true));
  expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body).items).toEqual([{ product_id: 3, discount_type: 'percentage', discount_value: 10, quantity_limit: 1.5 }, { product_id: 4, discount_type: 'percentage', discount_value: 15, quantity_limit: null }]);
  expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toMatchObject({ starts_at: '2026-10-18T00:00', ends_at: null });
});
it('keeps a used flash sale product locked and converts schedules to business time', async () => {
  apiRequest.mockResolvedValue({ timezone: 'Asia/Rangoon', categories: [], promotion: { ...{ type: 'flash_sale', name: 'Sale', enabled: true, discount_type: 'percentage', discount_value: 10 }, product_id: 4, product_name: 'Tea', used_count: 1, used_quantity: 2, starts_at: '2026-10-13T00:00:00Z', ends_at: null } });
  render(<ShopPromotionForm id="9" onNavigate={vi.fn()} />);
  expect(await screen.findByRole('button', { name: 'Change product' })).toBeDisabled();
  expect(screen.getByLabelText('Starts at (optional)')).toHaveValue('2026-10-13');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
  expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).starts_at).toBe('2026-10-13T06:30');
});
it('canceling bulk deletion leaves every selected promotion untouched', async () => {
  apiRequest.mockResolvedValue({ items: [{ id: 1, type: 'coupon', name: 'Summer', code: 'SAVE10', discount_type: 'percentage', discount_value: 10 }], total: 1 });
  render(<ShopPromotions onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Summer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete selected (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(apiRequest.mock.calls.some(([, options]) => options?.method)).toBe(false);
  expect(screen.getByRole('checkbox', { name: 'Select Summer' })).toBeChecked();
});

it('keeps changes staged until Apply while Reset applies defaults and closes', async () => {
  apiRequest.mockResolvedValue({ items: [], total: 0 });
  render(<ShopPromotions onNavigate={vi.fn()} />);
  await screen.findByText('No matching promotions.');
  const count=apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.click(screen.getByRole('radio',{name:'Coupon',exact:true}));
  expect(apiRequest).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole('button',{name:'Apply filters',exact:true}));
  await waitFor(()=>expect(apiRequest.mock.calls.at(-1)[0]).toContain('type=coupon'));
  fireEvent.click(screen.getByRole('button',{name:/Filters, 1 active/}));
  fireEvent.click(screen.getByRole('button',{name:'Reset',exact:true}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  expect(screen.getByRole('radio',{name:'Coupon',exact:true})).not.toBeChecked();
});

it('discards product-picker drafts on Cancel and preserves each row setting when adding again', async () => {
  apiRequest.mockImplementation(async path=>path.includes('/publications?')?{items:[{id:3,name:'Rice'},{id:4,name:'Tea'}],total:2}:{categories:[],timezone:'Asia/Rangoon'});
  render(<ShopPromotionForm type="flash_sale" onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button',{name:'Choose products'}));
  fireEvent.click(await screen.findByRole('checkbox',{name:'Select Rice'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Cancel',exact:true}));
  expect(screen.getByText('0 products selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Choose products'}));
  fireEvent.click(await screen.findByRole('checkbox',{name:'Select Rice'}));
  fireEvent.click(screen.getByRole('button',{name:'Add 1 products'}));
  fireEvent.change(await screen.findByLabelText('Discount value'),{target:{value:'22'}});
  fireEvent.click(screen.getByRole('button',{name:'Choose products'}));
  expect(await screen.findByRole('checkbox',{name:'Select Rice'})).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox',{name:'Select Tea'}));
  fireEvent.click(screen.getByRole('button',{name:'Add 2 products'}));
  await screen.findByText('2 products selected');
  expect(screen.getAllByLabelText('Discount value')[0]).toHaveValue(22);
  expect(screen.getAllByLabelText('Discount value')[1]).toHaveValue(10);
});

it('disables overlapping products, skips them in bulk selection and rechecks before Add', async () => {
  let stale = false;
  apiRequest.mockImplementation(async path => {
    if (!path.includes('/publications?')) return { timezone: 'Asia/Rangoon', categories: [] };
    const selected = new URL(path, 'http://test').searchParams.has('flash_sale_product_ids[]');
    return { items: [{ id: 3, name: 'Rice', flash_sale_conflict: { id: 10, name: 'Weekend event' } }, { id: 4, name: 'Tea', flash_sale_conflict: selected && stale ? { id: 11, name: 'New event' } : null }], total: 2 };
  });
  render(<ShopPromotionForm type="flash_sale" onNavigate={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Starts at (optional)'), { target: { value: '2026-10-18' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose products' }));
  expect(await screen.findByRole('checkbox', { name: 'Select Rice' })).toBeDisabled();
  expect(screen.getByText('Already in flash sale: Weekend event')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select all filtered products' }));
  await screen.findByRole('button', { name: 'Add 1 products' });
  expect(screen.getByRole('checkbox', { name: 'Select Tea' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Select Rice' })).not.toBeChecked();
  stale = true;
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 products' }));
  await screen.findByText('Unavailable products were removed from this selection.');
  expect(screen.getByRole('checkbox', { name: 'Select Tea' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add 0 products' })).toBeDisabled();
  expect(screen.getByRole('dialog', { name: 'Select products' })).toBeInTheDocument();
  expect(apiRequest.mock.calls.some(([path]) => path.includes('flash_sale_starts_at=2026-10-18T00%3A00'))).toBe(true);
});

it('blocks duplicate saves and keeps coupon values on validation failure', async () => {
  let reject;
  apiRequest.mockImplementation(async (_path,options)=>options?.method?new Promise((_resolve,rejectPromise)=>{reject=rejectPromise;}):{timezone:'Asia/Rangoon'});
  const navigate=vi.fn();render(<ShopPromotionForm onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Promotion name'),{target:{value:'Welcome'}});
  fireEvent.change(screen.getByLabelText('Coupon code'),{target:{value:'save10'}});
  const form=screen.getByRole('button',{name:'Save coupon'}).closest('form');
  fireEvent.submit(form);fireEvent.submit(form);
  expect(apiRequest.mock.calls.filter(([,options])=>options?.method)).toHaveLength(1);
  expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled();
  reject(new Error('Try another code.'));
  await screen.findByText('Try another code.');
  expect(screen.getByLabelText('Coupon code')).toHaveValue('SAVE10');
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(navigate).toHaveBeenCalledWith('/shop/promotions',{back:true});
});

it('rejects an inverted schedule without making a save request', async () => {
  apiRequest.mockResolvedValue({timezone:'Asia/Rangoon'});
  render(<ShopPromotionForm onNavigate={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Promotion name'),{target:{value:'Welcome'}});
  fireEvent.change(screen.getByLabelText('Coupon code'),{target:{value:'SAVE10'}});
  fireEvent.change(screen.getByLabelText('Starts at (optional)'),{target:{value:'2026-10-18'}});
  fireEvent.change(screen.getByLabelText('Ends at (optional)'),{target:{value:'2026-10-17'}});
  fireEvent.click(screen.getByRole('button',{name:'Save coupon'}));
  expect(await screen.findByText('End time must be later than start time.')).toBeInTheDocument();
  expect(apiRequest.mock.calls.some(([,options])=>options?.method)).toBe(false);
});
