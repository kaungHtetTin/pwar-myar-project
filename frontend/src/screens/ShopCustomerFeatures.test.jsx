import React, { useState } from 'react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ShopOperatingSettings } from './ShopOperatingSettings';
import { ShopRequestReview } from './ShopRequestReview';
import { request } from '../api';
vi.mock('../api', () => ({ request: vi.fn(), requestDownload: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('opening hours controls keep day fields and closure time in shop timezone', () => {
  function Wrapper() { const [form, setForm] = useState({ timezone: 'Asia/Yangon', closed_until: '2026-10-10T02:30:00Z' }); return <ShopOperatingSettings form={form} change={(key, value) => setForm(prev => ({ ...prev, [key]: value }))} />; }
  render(<Wrapper />); expect(screen.getByLabelText(/Temporary closure ends/)).toHaveValue('2026-10-10T09:00');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show weekly opening hours' }));
  expect(screen.getAllByRole('checkbox', { name: /closed$/ })).toHaveLength(7);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Monday closed' })); expect(screen.getByLabelText('Monday opens')).toBeDisabled();
});
it('request review validates notes, preserves errors and requires explicit confirmation', async () => {
  const order = { id: 1, status: 'dispatched', customer_requests: [{ id: 2, type: 'cancellation', status: 'pending', reason: 'Wrong address' }] };
  const onSaved = vi.fn(); request.mockRejectedValueOnce(new Error('Goods have not returned')).mockResolvedValueOnce({ ...order, status: 'cancelled' });
  render(<ShopRequestReview order={order} onSaved={onSaved} canReview />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve request' })); expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Review note'), { target: { value: 'Customer contacted' } });
  window.confirm.mockReturnValue(false); fireEvent.click(screen.getByRole('button', { name: 'Approve request' })); expect(request).not.toHaveBeenCalled();
  window.confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Approve request' })); await screen.findByText('Goods have not returned');
  expect(screen.getByLabelText('Review note')).toHaveValue('Customer contacted');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Goods have physically returned' })); fireEvent.click(screen.getByRole('button', { name: 'Approve request' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce()); expect(JSON.parse(request.mock.calls[1][1].body).return_confirmed).toBe(true);
});
it('return resolution remains disabled until controlled void and refund are recorded', () => {
  const order = { id: 1, sale_id: 3, sale_voided: false, payment_status: 'paid', customer_requests: [{ id: 2, type: 'return', status: 'approved', reason: 'Damaged' }] };
  const { rerender } = render(<ShopRequestReview order={order} canReview />); expect(screen.getByRole('button', { name: 'Resolve request' })).toBeDisabled();
  rerender(<ShopRequestReview order={{ ...order, sale_voided: true, payment_status: 'refunded' }} canReview />); expect(screen.getByRole('button', { name: 'Resolve request' })).not.toBeDisabled();
  rerender(<ShopRequestReview order={order} canReview={false} />); expect(screen.queryByRole('button', { name: 'Resolve request' })).not.toBeInTheDocument();
});
