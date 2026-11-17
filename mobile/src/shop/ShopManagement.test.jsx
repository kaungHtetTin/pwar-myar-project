import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopFulfillment } from './ShopFulfillment';
import { ShopCustomerAction } from './ShopCustomers';
import { ShopReviewReply } from './ShopReviews';
import { ShopDatePresets } from './ShopDatePresets';
import { ShopReport } from './ShopReport';
vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
const owner = { user: { role: 'owner' } };
beforeEach(() => vi.clearAllMocks());
it('preserves independently updated delivery zones when saving pickup instructions', async () => {
  let reads = 0;
  apiRequest.mockImplementation(async (_path, options) => options?.method ? { ok: true } : { slug: 'shop', opening_hours: [], pickup_instructions: 'Counter', delivery_zones: [{ id: ++reads, name: 'City', fee: reads * 100 }] });
  const navigate = vi.fn();
  render(<ShopFulfillment onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Instructions for buyers'), { target: { value: 'Front desk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  const saved = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
  expect(saved).toMatchObject({ pickup_instructions: 'Front desk', delivery_zones: [{ id: 2, name: 'City', fee: 200 }] });
  expect(saved).not.toHaveProperty('payment_methods');
});
it('requires explicit customer blocking confirmation and cancel does not mutate', async () => {
  apiRequest.mockResolvedValue({ customer: { customer_name: 'Alice', blocked: false } });
  const navigate = vi.fn();
  render(<ShopCustomerAction action="block" customerKey="account:3" session={owner} onNavigate={navigate} />);
  await screen.findByRole('heading', { name: 'Block this customer?'  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(apiRequest.mock.calls.some(([, options]) => options?.method)).toBe(false);
  expect(navigate).toHaveBeenCalledWith('/shop/customers/account%3A3', { back: true });
});
it('supports removing a public review reply without modifying the review', async () => {
  apiRequest.mockResolvedValue({ id: 2, customer_name: 'Alice', reply: 'Old reply', rating: 5 });
  render(<ShopReviewReply id="2" session={owner} onNavigate={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Public reply'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reply' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/shop-admin/reviews/2/reply', { method: 'PUT', body: '{"reply":""}' }));
});
it('derives date presets from business-local today rather than device-local today', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
  try { const change = vi.fn(); render(<ShopDatePresets timezone="Asia/Rangoon" onChange={change} />); fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'today' } }); expect(change).toHaveBeenCalledWith({ date_from: '2026-10-13', date_to: '2026-10-13' }); } finally { vi.useRealTimers(); }
});
it('provides accessible daily report data alongside charts', async () => {
  apiRequest.mockResolvedValue({ date_from: '2026-10-01', date_to: '2026-10-13', currency: 'Ks', currencies: ['Ks'], summary: { orders: 1 }, previous: {}, trend: [{ date: '2026-10-13', sales: 300, orders: 1 }], top_products: [], buyers: [], outcomes: [], segments: [], follow_up: [] });
  render(<ShopReport onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Show daily table' }));
  expect(screen.getByRole('table')).toHaveTextContent('2026-10-13');
  expect(screen.getByRole('table')).toHaveTextContent('300 Ks');
});

