import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopConfigurationForm, ShopConfigurationList } from './ShopConfiguration';
import { ShopPublicationForm } from './ShopCatalog';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('preserves a failed contact submission and clears the completed draft', async () => {
  let fail = true;
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (options.method === 'POST') { if (fail) throw new Error('Contact save failed'); return {}; }
    return { items: [] };
  });
  const navigate = vi.fn();
  render(<ShopConfigurationForm section="contacts" onNavigate={navigate} />);
  const phone = await screen.findByLabelText('Phone number');
  fireEvent.change(phone, { target: { value: '0912345678' } });
  fireEvent.change(screen.getByLabelText('Label (optional)'), { target: { value: 'First contact' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
  await screen.findByText('Contact save failed');
  expect(phone).toHaveValue('0912345678');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Save contact' }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(phone).toHaveValue('');
  expect(screen.getByLabelText('Label (optional)')).toHaveValue('');
});
it('opens a deep-linked payment method and saves account details on a full page', async () => {
  apiRequest.mockResolvedValue({ items: [{ id: 'bank', name: 'Bank', type: 'transfer', is_active: true, bank: 'KBZ', account_name: 'Shop', account_no: '123', instructions: '', provider: 'manual' }] });
  const navigate = vi.fn();
  render(<ShopConfigurationForm section="methods" id="bank" onNavigate={navigate} />);
  await screen.findByDisplayValue('KBZ');
  fireEvent.change(screen.getByLabelText('Account number / phone'), { target: { value: '456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/shop-admin/payment-methods/bank', { method: 'PUT', body: expect.stringContaining('"account_no":"456"') }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(navigate).toHaveBeenCalledWith('/shop/methods', { replace: true });
});
it('shows the last-active-payment validation and retains entered values', async () => {
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method) throw Object.assign(new Error('Keep an active method'), { payload: { errors: { payment_methods: ['Keep at least one active manual payment method.'] } } });
    return { items: [] };
  });
  render(<ShopConfigurationForm section="methods" onNavigate={vi.fn()} />);
  await screen.findByLabelText('Method name');
  fireEvent.change(screen.getByLabelText('Method name'), { target: { value: 'Wallet' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save method' }));
  await screen.findByText('Keep at least one active manual payment method.');
  expect(screen.getByLabelText('Method name')).toHaveValue('Wallet');
});
it('retains transfer account draft across Cash and guards duplicate pending saves', async () => {
  let resolveSave;
  apiRequest.mockImplementation((_path, options) => options?.method ? new Promise(resolve => { resolveSave = resolve; }) : Promise.resolve({ items: [] }));
  const navigate = vi.fn(); render(<ShopConfigurationForm section="methods" onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Method name'), { target: { value: 'Mobile wallet' } });
  fireEvent.change(screen.getByLabelText('Account number / phone'), { target: { value: '0912345678' } });
  fireEvent.click(screen.getByRole('radio', { name: /^Cash/ }));
  expect(screen.queryByLabelText('Account number / phone')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /^Bank transfer/ }));
  expect(screen.getByLabelText('Account number / phone')).toHaveValue('0912345678');
  const form = screen.getByRole('button', { name: 'Save method' }).closest('form');
  fireEvent.submit(form); fireEvent.submit(form);
  expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  resolveSave({ items: [] });
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/methods', { replace: true }));
});
it('blocks a direct new-method submission when the supported capacity is reached', async () => {
  apiRequest.mockResolvedValue({ items: Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: 'Cash', type: 'cash', is_active: true })) });
  render(<ShopConfigurationForm section="methods" onNavigate={vi.fn()} />);
  await screen.findByText('You have reached the 20 payment method limit.');
  fireEvent.submit(screen.getByRole('button', { name: 'Save method' }).closest('form'));
  expect(screen.getByRole('button', { name: 'Save method' })).toBeDisabled();
  expect(apiRequest.mock.calls.some(([, options]) => options?.method)).toBe(false);
});
it('asks before deleting a delivery zone and cancels without mutation', async () => {
  apiRequest.mockResolvedValue({ items: [{ id: 'city', name: 'City', fee: 500 }] });
  render(<ShopConfigurationList section="delivery" onNavigate={vi.fn()} session={{ business: { currency: 'Ks' } }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete City' }));
  expect(screen.getByRole('dialog', { name: 'Delete delivery zone' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
});
it('loads publication directly and saves the chosen sales unit', async () => {
  apiRequest.mockResolvedValue({ id: 5, name: 'Rice', base_unit: 'Bag', purchase_unit: 'Box', purchase_conversion_factor: 2, base_price: 1000, purchase_price: 2000, currency: 'Ks', price_type: 'Retail', stock: 3, published: false });
  render(<ShopPublicationForm id="5" onNavigate={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Rice' });
  fireEvent.change(screen.getByLabelText('Online selling unit'), { target: { value: 'purchase' } });
  expect(screen.getByText('Retail price: 2,000 Ks')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Publish online' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save publication' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/shop-admin/publications/5', { method: 'PUT', body: JSON.stringify({ published: true, unit: 'purchase', description: '' }) }));
});

it('keeps contact labels associated with their own retained new and edit fields', async () => {
  apiRequest.mockResolvedValue({ items: [{ id: 'phone', platform: 'phone', label: 'Main shop', value: '0912345678' }] });
  render(<><ShopConfigurationForm section="contacts" onNavigate={vi.fn()} /><ShopConfigurationForm section="contacts" id="phone" onNavigate={vi.fn()} /></>);
  await screen.findByDisplayValue('0912345678');
  const numbers = screen.getAllByLabelText('Phone number');
  expect(numbers).toHaveLength(2);
  expect(new Set(numbers.map(input => input.id)).size).toBe(2);
  expect(numbers[0]).toHaveValue('');
  expect(numbers[1]).toHaveValue('0912345678');
  expect(new Set(screen.getAllByLabelText('Platform').map(input => input.id)).size).toBe(2);
});
