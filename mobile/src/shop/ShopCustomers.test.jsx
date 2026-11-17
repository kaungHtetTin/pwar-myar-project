import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopCustomers, ShopCustomerDetail, ShopCustomerAction } from './ShopCustomers';
vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it('loads the shop customer profile photo and falls back when it cannot load', async () => {
  apiRequest.mockImplementation(async path => path.includes('/history?') ? { items: [], total: 0 } : {
    customer: { customer_key: 'account:3', customer_name: 'Alice Morgan', avatar_url: '/avatars/alice.jpg', account_type: 'account' }, report: {},
  });
  const { container } = render(<ShopCustomerDetail customerKey="account:3" session={{ user: { role: 'owner' } }} onNavigate={vi.fn()} />);
  await screen.findByText('Purchase statistics');
  const avatar = container.querySelector('.shop-customer-avatar');
  expect(avatar.querySelector('img')).toHaveAttribute('src', '/avatars/alice.jpg');
  fireEvent.error(avatar.querySelector('img'));
  expect(avatar).toHaveTextContent('AM');
});
it('shows purchase details in statistics and keeps More in the profile only', async () => {
  apiRequest.mockImplementation(async path => path.includes('/history?') ? { items: [], total: 0 } : {
    customer: { customer_name: 'Buyer', account_type: 'account' },
    report: { total_orders: 0, completed_orders: 0, active_orders: 0, cancelled_orders: 0, expired_orders: 0, currencies: [{ currency: 'Ks', completed_spend: 0, average_purchase: 12500, refunded: 0, refund_pending: 1000 }] },
  });
  const { container } = render(<ShopCustomerDetail customerKey="account:3" session={{ user: { role: 'owner' } }} onNavigate={vi.fn()} />);
  const heading = await screen.findByRole('heading', { name: 'Purchase statistics' });
  const stats = heading.closest('section');
  expect(within(stats).getByRole('heading', { name: 'Purchase details' })).toBeVisible();
  expect(within(stats).getByText('Total orders').nextElementSibling).toHaveTextContent('0');
  expect(within(stats).getByText('First purchase').nextElementSibling).toHaveTextContent('—');
  expect(within(stats).getByText('Average purchase').nextElementSibling).toHaveTextContent('12,500 Ks');
  expect(within(container.querySelector('.shop-buyer-header')).queryByRole('button', { name: 'More', exact: true })).not.toBeInTheDocument();
  const reads = apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'More', exact: true }));
  const options = screen.getByRole('dialog', { name: 'Customer options' });
  expect(options).toHaveClass('mobile-sheet--action-menu');
  expect(within(options).queryByText('Purchase details')).not.toBeInTheDocument();
  expect(within(options).getByRole('button', { name: 'Link credit contact' })).toBeEnabled();
  fireEvent.click(within(options).getByRole('button', { name: 'Close Customer options' }));
  expect(apiRequest.mock.calls).toHaveLength(reads);
});
it('applies customer filters and resets the applied filters while closing the drawer', async () => {
  apiRequest.mockResolvedValue({ items: [], total: 0 });
  render(<ShopCustomers onNavigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  fireEvent.click(screen.getByRole('radio', { name: 'Guest', exact: true }));
  expect(apiRequest.mock.calls.some(([path]) => path.includes('account=guest'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters', exact: true }));
  await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('account=guest'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Filters, 1 active filters', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  expect(screen.getByRole('radio', { name: 'Guest', exact: true })).not.toBeChecked();
});
it('rejects reversed history dates without fetching or applying the draft', async () => {
  apiRequest.mockImplementation(async path => path.includes('/history?') ? { items: [], total: 0 } : { customer: { customer_name: 'Buyer' }, report: {} });
  render(<ShopCustomerDetail customerKey="account:3" session={{ user: { role: 'staff' }, permissions: [] }} onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Filters', exact: true }));
  const before = apiRequest.mock.calls.filter(([path]) => path.includes('/history?')).length;
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-31' } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters', exact: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date.');
  expect(apiRequest.mock.calls.filter(([path]) => path.includes('/history?'))).toHaveLength(before);
  fireEvent.click(screen.getByRole('button', { name: 'Close filters', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  expect(screen.getByLabelText('From date')).toHaveValue('');
});
it('keeps explicit credit-contact linking recoverable after a conflict', async () => {
  let attempts = 0;
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      expect(path).toBe('/shop-admin/customers/account%3A3/credit-contact');
      expect(JSON.parse(options.body)).toEqual({ create_new: true });
      if (++attempts === 1) throw new Error('Resolve matching contacts before retrying.');
    }
    if (path.endsWith('/credit-options')) return { matches: [] };
    return { customer: { customer_name: 'Buyer', phone: '0912345' } };
  });
  const navigate = vi.fn();
  render(<ShopCustomerAction customerKey="account:3" action="credit" session={{ user: { role: 'owner' } }} onNavigate={navigate} />);
  fireEvent.click(await screen.findByRole('radio', { name: /Create new credit contact/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Link contact', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Resolve matching contacts before retrying.');
  fireEvent.click(screen.getByRole('button', { name: 'Link contact', exact: true }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/customers/account%3A3', { replace: true }));
});
it('submits a selected existing credit contact without requesting creation', async () => {
  apiRequest.mockImplementation(async path => path.endsWith('/credit-options') ? { matches: [{ id: 42, name: 'Existing contact', phone: '0912345' }] } : { customer: { customer_name: 'Buyer' } });
  render(<ShopCustomerAction customerKey="account:3" action="credit" session={{ user: { role: 'owner' } }} onNavigate={vi.fn()} />);
  const submit = await screen.findByRole('button', { name: 'Link contact', exact: true });
  expect(submit).toBeDisabled();
  fireEvent.click(await screen.findByRole('radio', { name: /Existing contact/ }));
  fireEvent.click(submit);
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/shop-admin/customers/account%3A3/credit-contact', { method: 'POST', body: '{"contact_id":42}' }));
});
it('preserves an optional block reason after failure and never submits on Cancel', async () => {
  let attempts = 0;
  apiRequest.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') { attempts++; throw new Error('Try again.'); }
    return { customer: { customer_name: 'Buyer', blocked: false } };
  });
  const navigate = vi.fn();
  render(<ShopCustomerAction customerKey="account:3" action="block" session={{ user: { role: 'owner' } }} onNavigate={navigate} />);
  const reason = await screen.findByRole('textbox', { name: /Reason/ });
  fireEvent.change(reason, { target: { value: 'Repeated fraud' } });
  fireEvent.click(screen.getByRole('button', { name: 'Block customer', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again.');
  expect(reason).toHaveValue('Repeated fraud');
  expect(apiRequest).toHaveBeenCalledWith('/shop-admin/customers/account%3A3/block', { method: 'PUT', body: '{"blocked":true,"reason":"Repeated fraud"}' });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  expect(attempts).toBe(1);
  expect(navigate).toHaveBeenCalledWith('/shop/customers/account%3A3', { back: true });
});
