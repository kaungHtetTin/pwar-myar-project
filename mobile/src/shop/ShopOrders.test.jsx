import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiRequest } from '../api/client';
import { RetainedViews } from '../navigation/RetainedViews';
import { ShopOrderAction, ShopOrderDetail, ShopOrders, ShopRequestReview } from './ShopOrders';
import { ShopLocationGate } from './ShopLocation';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
const session = { user: { role: 'owner' }, business: { timezone: 'Asia/Rangoon' } };
const order = { id: 8, reference: 'SHOP-8', customer_name: 'Alice', status: 'pending', fulfillment: 'pickup', payment_status: 'unpaid', total: 32000, currency: 'Ks', payment_method: { name: 'Cash', provider: 'manual' }, items: [], payments: [], events: [], customer_requests: [] };
beforeEach(() => { vi.clearAllMocks(); apiRequest.mockImplementation(async path => path.includes('/owner-location') ? { submitted: true } : /orders\/8/.test(path) ? order : { items: [order], total: 1 }); });
afterEach(() => vi.restoreAllMocks());

describe('mobile shop screens', () => {
  it('keeps sorting staged while Reset applies defaults and closes the drawer', async () => {
    render(<ShopOrders session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    expect(screen.queryByRole('button', { name: 'More order actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sort orders' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    const initialReads = apiRequest.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Sort orders'), { target: { value: 'oldest' } });
    expect(apiRequest.mock.calls).toHaveLength(initialReads);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    expect(screen.getByLabelText('Sort orders')).toHaveValue('newest');
    fireEvent.change(screen.getByLabelText('Sort orders'), { target: { value: 'oldest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiRequest.mock.calls.at(-1)[0]).toContain('sort=oldest'));
    fireEvent.click(screen.getByRole('button', { name: 'Filters, 1 active filters' }));
    expect(screen.getByLabelText('Sort orders')).toHaveValue('oldest');
    fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(apiRequest.mock.calls.at(-1)[0]).toContain('sort=newest'));
    expect(screen.getByRole('button', { name: 'Filters', exact: true })).toBeInTheDocument();
  });
  it('closes an action with Android Back without navigation, refetching or losing detail state', async () => {
    apiRequest.mockResolvedValue({ ...order, events: [{ id: 1, event: 'created', reason: 'Order placed' }] });
    const navigate = vi.fn();
    render(<ShopOrderDetail id="8" session={session} onNavigate={navigate} />);
    const heading = await screen.findByRole('heading', { name: 'SHOP-8' });
    const trigger = screen.getByRole('button', { name: 'Accept order' });
    trigger.focus();
    const requestCount = apiRequest.mock.calls.length;
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Accept order' });
    expect(within(dialog).getByRole('button', { name: 'Close Accept order' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(within(dialog).getByRole('button', { name: 'Accept order' })).toHaveFocus();
    const back = new CustomEvent('mkpos:hardware-back', { cancelable: true });
    fireEvent(window, back);
    expect(back.defaultPrevented).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SHOP-8' })).toBe(heading);
    expect(screen.getByText('Order placed', { selector: 'p' })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(navigate).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledTimes(requestCount);
  });

  it('saves once in the modal, blocks busy dismissal and updates the existing detail without navigation', async () => {
    let complete;
    apiRequest.mockImplementation(async (_path, options) => options?.method === 'POST' ? new Promise(resolve => { complete = resolve; }) : order);
    const navigate = vi.fn();
    render(<ShopOrderDetail id="8" session={session} onNavigate={navigate} />);
    const heading = await screen.findByRole('heading', { name: 'SHOP-8' });
    fireEvent.click(screen.getByRole('button', { name: 'Accept order' }));
    const dialog = screen.getByRole('dialog');
    const form = within(dialog).getByRole('button', { name: 'Accept order' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(apiRequest).toHaveBeenCalledWith('/shop-admin/orders/8/transition', { method: 'POST', body: JSON.stringify({ status: 'accepted', reason: '', return_confirmed: false }) });
    expect(within(dialog).getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    complete({ ...order, status: 'accepted' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'SHOP-8' })).toBe(heading);
    expect(screen.getByRole('button', { name: 'Start packing' })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(apiRequest.mock.calls.filter(([, options]) => !options?.method)).toHaveLength(1);
  });

  it('reviews a customer request on its mapped page and returns to the updated detail', async () => {
    const request = { id: 3, type: 'return', status: 'pending', reason: 'Damaged' };
    apiRequest.mockImplementation(async (_path, options) => ({ ...order, customer_requests: [{ ...request, status: options?.method ? 'approved' : 'pending' }] }));
    const navigate = vi.fn();
    render(<ShopRequestReview id="8" requestId="3" session={session} onNavigate={navigate} />);
    fireEvent.change(await screen.findByLabelText('Review note'), { target: { value: 'Return approved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save decision', exact: true }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/orders/8', { replace: true }));
    expect(apiRequest).toHaveBeenCalledWith('/shop-admin/orders/8/requests/3', { method: 'POST', body: JSON.stringify({ status: 'approved', staff_note: 'Return approved', return_confirmed: false }) });
  });

  it('preserves detail links, order actions, proof selection, request photos and history', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:proof');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    apiDownload.mockResolvedValue({ blob: async () => new Blob(['image']) });
    apiRequest.mockResolvedValue({
      ...order, payment_status: 'proof_submitted', customer_key: 'account:3', sale_id: 12,
      phone: '09123456', email: 'alice@example.com', address: 'Main street',
      items: [{ product_id: 1, name: 'Tea', quantity: 2, unit_name: 'pack', unit_price: 16000, line_total: 32000 }],
      customer_requests: [{ id: 3, type: 'return', status: 'pending', reason: 'Damaged package', has_photo: true }],
      payments: [{ id: 10, type: 'proof', status: 'pending' }, { id: 11, type: 'proof', status: 'pending' }],
      events: [{ id: 1, event: 'created', reason: 'Order placed' }],
    });
    const navigate = vi.fn();
    render(<ShopOrderDetail id="8" session={session} onNavigate={navigate} />);
    await screen.findByRole('heading', { name: 'SHOP-8' });
    expect(within(document.querySelector('.shop-orders-header')).getByRole('button', { name: 'Print order' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More order actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More', exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
    for (const [name, path] of [
      ['View customer', '/shop/customers/account%3A3'], ['View POS sale', '/sales/12'],
    ]) {
      const previousCalls = navigate.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name }));
      expect(navigate).toHaveBeenCalledTimes(previousCalls + 1);
      expect(navigate).toHaveBeenLastCalledWith(path);
    }
    for (const name of ['Accept order', 'Cancel order', 'Approve full payment', 'Reject proof']) {
      fireEvent.click(screen.getByRole('button', { name }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAccessibleName(({ 'Cancel order': 'Cancel order?', 'Approve full payment': 'Confirm payment' })[name] || name);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel', exact: true }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    expect(navigate).toHaveBeenCalledTimes(2);
    await screen.findByRole('img', { name: 'Customer payment proof' });
    fireEvent.click(screen.getByRole('button', { name: 'Proof #10 / pending' }));
    await waitFor(() => expect(apiDownload).toHaveBeenCalledWith('/shop-admin/orders/8/proofs/10', expect.anything()));
    expect(screen.getByRole('button', { name: 'Proof #10 / pending' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'View return photo' }));
    await screen.findByRole('img', { name: 'Customer return evidence' });
    fireEvent.click(screen.getByRole('button', { name: 'Close return photo' }));
    expect(screen.queryByRole('img', { name: 'Customer return evidence' })).not.toBeInTheDocument();
    expect(screen.getByText('Order placed', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide order history' }));
    expect(screen.queryByText('Order placed', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('keeps protected detail controls hidden and completion disabled before payment', async () => {
    apiRequest.mockResolvedValue({ ...order, status: 'ready_for_pickup', sale_id: 12, customer_requests: [{ id: 3, type: 'return', status: 'pending', reason: 'Damaged' }] });
    const { rerender } = render(<ShopOrderDetail id="8" session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('heading', { name: 'SHOP-8' });
    expect(screen.getByRole('button', { name: 'Complete order' })).toBeDisabled();
    rerender(<ShopOrderDetail id="8" session={{ user: { role: 'staff' }, permissions: ['ecommerce_orders'] }} onNavigate={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Payment review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review request #3' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View POS sale' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete order' })).not.toBeInTheDocument();
  });

  it('opens order details once when clicking the card content or its view label', async () => {
    const navigate = vi.fn();
    render(<ShopOrders session={session} onNavigate={navigate} />);
    const card = await screen.findByRole('button', { name: 'View order SHOP-8' });
    expect(card.querySelector('button')).toBeNull();
    fireEvent.click(screen.getByText('Alice'));
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/shop/orders/8');
    fireEvent.click(screen.getByRole('button', { name: 'View order SHOP-8', exact: true }));
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith('/shop/orders/8');
  });

  it('exports every matching page using applied filters and preserves the list', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:orders');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    apiRequest.mockImplementation(async (path, options) => {
      if (options?.timeoutMs) {
        const offset = new URL(path, 'http://localhost').searchParams.get('offset');
        return { items: [offset === '0' ? order : { ...order, id: 9, reference: 'SHOP-9', customer_name: '=Alice', payment_method: { name: 'Bank' } }], total: 2 };
      }
      return { items: [order], total: 2 };
    });
    render(<ShopOrders session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search orders' }), { target: { value: 'Alice' } });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('q=Alice'), expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'pending' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('status=pending'), expect.anything()));
    const source = await screen.findByRole('button', { name: 'View order SHOP-8' });
    fireEvent.click(screen.getByRole('button', { name: 'Filters, 1 active filters' }));
    fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'completed' } });
    const listRequests = apiRequest.mock.calls.filter(([, options]) => options?.signal).length;
    fireEvent.click(screen.getByRole('button', { name: 'Export orders' }));
    await screen.findByText('Exported 2 matching records.');
    const exports = apiRequest.mock.calls.filter(([, options]) => options?.timeoutMs);
    expect(exports).toHaveLength(2);
    for (const [path] of exports) {
      expect(path).toContain('q=Alice');
      expect(path).toContain('status=pending');
      expect(path).toContain('limit=100');
      expect(path).not.toContain('status=completed');
    }
    expect(exports[1][0]).toContain('offset=1');
    expect(apiRequest.mock.calls.filter(([, options]) => options?.signal)).toHaveLength(listRequests);
    expect(screen.getByRole('button', { name: 'View order SHOP-8' })).toBe(source);
    const file = createUrl.mock.calls[0][0];
    expect(file.name).toMatch(/^mkpos-online-orders-.*\.csv$/);
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
    expect(content).toContain('SHOP-9');
    expect(content).toContain("'=Alice");
    expect(content).toContain('Bank');
  });

  it('reports an empty export without downloading and allows a retry', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:orders');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let empty = true;
    apiRequest.mockImplementation(async (_path, options) => options?.timeoutMs && empty ? { items: [], total: 0 } : { items: [order], total: 1 });
    render(<ShopOrders session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    fireEvent.click(screen.getByRole('button', { name: 'Export orders' }));
    await screen.findByText('No orders match the current filters.');
    expect(createUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Export orders' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    empty = false;
    fireEvent.click(screen.getByRole('button', { name: 'Export orders' }));
    await screen.findByText('Exported 1 matching record.');
    expect(createUrl).toHaveBeenCalledOnce();
  });

  it('shows the filtered total separately from requests in displayed orders', async () => {
    apiRequest.mockResolvedValue({ items: [{ ...order, request_count: 2 }], total: 40 });
    render(<ShopOrders session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    expect(screen.getByText('1 of 40 orders')).toBeInTheDocument();
    expect(screen.queryByText('Matching orders')).not.toBeInTheDocument();
  });

  it('clears the debounced search and restores the unsearched request', async () => {
    render(<ShopOrders session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search orders' }), { target: { value: 'Alice' } });
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('q=Alice'), expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Clear order search' }));
    expect(screen.getByRole('searchbox', { name: 'Search orders' })).toHaveValue('');
    await waitFor(() => expect(apiRequest.mock.calls.at(-1)[0]).toContain('q=&'));
  });

  it('retains search and loaded source cards without a new list request after Back', async () => {
    function Flow() {
      const [route, navigate] = useState('/shop/orders');
      return <><button type="button" onClick={() => navigate('/shop/orders')}>Test Back</button><RetainedViews activeKey={route}>{route === '/shop/orders' ? <ShopOrders session={session} onNavigate={navigate} /> : <ShopOrderDetail id="8" session={session} onNavigate={navigate} />}</RetainedViews></>;
    }
    render(<Flow />);
    const user = { click: element => fireEvent.click(element), type: (element, value) => fireEvent.change(element, { target: { value } }), selectOptions: (element, value) => fireEvent.change(element, { target: { value } }) };
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    await user.type(screen.getByRole('searchbox', { name: 'Search orders' }), 'Alice');
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('q=Alice'), expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    fireEvent.change(screen.getByLabelText('Sort orders'), { target: { value: 'oldest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiRequest.mock.calls.at(-1)[0]).toContain('sort=oldest'));
    const count = apiRequest.mock.calls.filter(([path]) => path.startsWith('/shop-admin/orders?')).length;
    await user.click(screen.getByRole('button', { name: 'View order SHOP-8' }));
    await screen.findByRole('heading', { name: 'SHOP-8' });
    await user.click(screen.getByRole('button', { name: 'Test Back' }));
    expect(screen.getByRole('searchbox', { name: 'Search orders' })).toHaveValue('Alice');
    fireEvent.click(screen.getByRole('button', { name: 'Filters, 1 active filters' }));
    expect(screen.getByLabelText('Sort orders')).toHaveValue('oldest');
    expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/shop-admin/orders?'))).toHaveLength(count);
  });
  it('requires verified full payment and saves once using the exact total', async () => {
    const navigate = vi.fn();
    render(<ShopOrderAction id="8" action="confirm" session={session} onNavigate={navigate} />);
    const user = { click: element => fireEvent.click(element), type: (element, value) => fireEvent.change(element, { target: { value } }), selectOptions: (element, value) => fireEvent.change(element, { target: { value } }) };
    await screen.findByRole('heading', { name: 'Confirm payment' });
    const modal = within(screen.getByRole('dialog'));
    expect(modal.getByRole('button', { name: 'Confirm paid' })).toBeDisabled();
    await user.type(screen.getByLabelText('Payment / refund reference (optional)'), 'TXN-1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(modal.getByRole('button', { name: 'Confirm paid' }));
    expect(apiRequest).toHaveBeenCalledWith('/shop-admin/orders/8/payments/confirm', { method: 'POST', body: JSON.stringify({ amount: 32000, reference: 'TXN-1', verified: true, review_note: '' }) });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/orders/8', { replace: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps cancellation input after a validation failure and supports retry', async () => {
    apiRequest.mockImplementation(async (path, options) => {
      if (options?.method === 'POST') throw Object.assign(new Error('Reason rejected'), { payload: { errors: { reason: ['Explain the cancellation'] } } });
      return order;
    });
    const navigate = vi.fn();
    render(<ShopOrderAction id="8" action="cancelled" session={session} onNavigate={navigate} />);
    const user = { click: element => fireEvent.click(element), type: (element, value) => fireEvent.change(element, { target: { value } }), selectOptions: (element, value) => fireEvent.change(element, { target: { value } }) };
    await screen.findByRole('heading', { name: 'Cancel order?' });
    const modal = within(screen.getByRole('dialog'));
    await user.type(screen.getByLabelText('Reason for cancellation'), 'Buyer requested cancellation');
    await user.click(modal.getByRole('button', { name: 'Confirm cancellation' }));
    await screen.findByText('Explain the cancellation');
    expect(screen.getByLabelText('Reason for cancellation')).toHaveValue('Buyer requested cancellation');
    expect(screen.getByLabelText('Reason for cancellation')).toHaveAttribute('aria-invalid', 'true');
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(navigate).toHaveBeenCalledWith('/shop/orders/8', { back: true });
  });
  it('blocks action deep links without processing permission', async () => {
    render(<ShopOrderAction id="8" action="cancelled" session={{ user: { role: 'staff' }, permissions: ['ecommerce_orders'] }} onNavigate={vi.fn()} />);
    await screen.findByText('This action is unavailable for this order or your permissions.');
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });
  it('filters orders and rejects reversed dates before requesting', async () => {
    render(<ShopOrders session={session} onNavigate={vi.fn()} />);
    const user = { click: element => fireEvent.click(element), type: (element, value) => fireEvent.change(element, { target: { value } }), selectOptions: (element, value) => fireEvent.change(element, { target: { value } }) };
    await screen.findByRole('button', { name: 'View order SHOP-8' });
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Order status'), 'pending');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('status=pending'), expect.anything()));
  });
  it('prevents resolution before sale void and refund', async () => {
    apiRequest.mockResolvedValue({ ...order, customer_requests: [{ id: 3, type: 'return', status: 'approved', reason: 'Damaged' }] });
    render(<ShopRequestReview id="8" requestId="3" session={session} onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'Resolve request' });
    expect(screen.getByRole('button', { name: 'Resolve request' })).toBeDisabled();
  });
  it('resolves a change request with a note without using return or payment approval', async () => {
    apiRequest.mockResolvedValue({ ...order, customer_requests: [{ id: 3, type: 'change', status: 'pending', reason: 'Please change delivery address', requested_changes: { address: 'New address' } }] });
    const navigate = vi.fn(); render(<ShopRequestReview id="8" requestId="3" session={session} onNavigate={navigate} />);
    await screen.findByRole('heading', { name: 'Order change request' });
    expect(screen.getByRole('radio', { name: 'Mark resolved' })).toBeChecked();
    expect(screen.queryByText('Goods have physically returned')).not.toBeInTheDocument();
    const note = screen.getByRole('textbox');
    fireEvent.change(note, { target: { value: 'Customer contacted and change arranged separately.' } });
    fireEvent.submit(note.closest('form'));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/shop-admin/orders/8/requests/3', expect.objectContaining({ method: 'POST' })));
    const data = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body);
    expect(data.status).toBe('resolved');
    expect(data.staff_note).toBe('Customer contacted and change arranged separately.');
  });
  it('holds staff behind the location prerequisite', async () => {
    apiRequest.mockResolvedValue({ submitted: false });
    render(<ShopLocationGate session={{ user: { role: 'staff' } }}><p>Orders workspace</p></ShopLocationGate>);
    await screen.findByText('Ask the business owner to submit the shop location.');
    expect(screen.queryByText('Orders workspace')).not.toBeInTheDocument();
  });
});

it('reconciles a cross-device status change in the orders list without remounting the card', async () => {
  let current = order;
  apiRequest.mockImplementation(async () => ({ items: [current], total: 1 }));
  render(<ShopOrders session={session} onNavigate={vi.fn()} />);
  const card = await screen.findByRole('button', { name: 'View order SHOP-8' });
  current = { ...order, status: 'accepted' };
  fireEvent(window, new CustomEvent('mkpos:shop-order-changed', { detail: { orderIds: [8] } }));
  await within(card).findByText(/^accepted$/i);
  expect(screen.getByRole('button', { name: 'View order SHOP-8' })).toBe(card);
});

it('updates open order detail after another device acts', async () => {
  let current = order;
  apiRequest.mockImplementation(async () => current);
  render(<ShopOrderDetail id={8} session={session} onNavigate={vi.fn()} />);
  await screen.findByRole('heading', { name: 'SHOP-8' });
  current = { ...order, status: 'accepted' };
  fireEvent(window, new CustomEvent('mkpos:shop-order-changed', { detail: { orderIds: [8] } }));
  await screen.findByRole('button', { name: 'Start packing', exact: true });
  expect(screen.queryByRole('button', { name: 'Accept order', exact: true })).not.toBeInTheDocument();
});
