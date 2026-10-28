import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiDownload, apiRequest } from '../api/client';
import { ShopSalesAi } from './ShopSalesAi';
vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
const settings = { enabled: false, name: 'Mia', instructions: 'Help customers', soul: 'Friendly', tool_permissions: ['search_products'], version: 1 };
const response = { settings, tools: [{ name: 'search_products', description: 'Public products only' }], wallet: { available: '500', reserved: '0' }, pricing: { usd_to_mmk_rate: '4000', markup_percent: '5' } };
it('updates an open top-up from realtime review data and keeps Back on the source route', async () => {
  const row = { id: 147, amount: '1000', status: 'pending', payment_account: { bank: 'KPay', account_no: '1234' }, version: 1 };
  apiRequest.mockResolvedValue({ request: row });
  const navigate = vi.fn(); render(<ShopSalesAi pathname="/shop/sales-ai/topups/147" onNavigate={navigate} />);
  await screen.findByText('Pending approval');
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: { requests: [{ ...row, status: 'rejected', review_note: 'Transfer not received.', version: 2 }] } })));
  expect(screen.getByText('Rejected')).toBeInTheDocument();
  expect(screen.getByText('Transfer not received.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: { requests: [row] } })));
  expect(screen.getByText('Rejected')).toBeInTheDocument();
  const reads = apiRequest.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/shop/sales-ai/topups', { back: true });
  expect(apiRequest).toHaveBeenCalledTimes(reads);
});

it('updates the overview credit immediately without reloading configuration', async () => {
  render(<ShopSalesAi pathname="/shop/sales-ai" onNavigate={vi.fn()} />);
  await screen.findByText('500 MMK');
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: { wallet: { available: '1500', reserved: '0' }, requests: [] } })));
  expect(screen.getByText('1,500 MMK')).toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledOnce();
});
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:proof'); URL.revokeObjectURL = vi.fn(); apiRequest.mockResolvedValue(response); apiDownload.mockResolvedValue({ blob: async () => new Blob(['image'], { type: 'image/png' }) }); });
it('keeps top-up details after cancellation failure, supports dismissal and retries with the version', async () => {
  const row = { id: 147, amount: '30000', status: 'pending', payment_account: { bank: 'KBZ pay', account_no: '09688683805', account_name: 'Demo account' }, transaction_reference: '004314000892184310', message: 'Please review', version: 3 };
  let attempts = 0;
  apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') { attempts++; if (attempts === 1) throw new Error('Connection interrupted'); return { request: { ...row, status: 'cancelled', version: 4 } }; }
    return { request: row };
  });
  render(<ShopSalesAi pathname="/shop/sales-ai/topups/147" onNavigate={vi.fn()} />);
  await screen.findByText('Pending approval');
  expect(screen.getByText(row.transaction_reference)).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Open full image' })).toHaveAttribute('target', '_blank');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request', exact: true }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel', exact: true }));
  expect(attempts).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request', exact: true }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel request', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  expect(screen.getByText(row.transaction_reference)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel request', exact: true }));
  await screen.findByText('Cancelled');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel request', exact: true })).not.toBeInTheDocument();
  expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toEqual({ version: 3 });
});
it('saves the overview toggle once, preserves settings and keeps confirmed status after failure', async () => {
  let resolveSave;
  apiRequest.mockImplementation(async (_path, options) => options?.method === 'PUT' ? new Promise(resolve => { resolveSave = resolve; }) : response);
  render(<ShopSalesAi pathname="/shop/sales-ai" onNavigate={vi.fn()} />);
  const toggle = await screen.findByRole('switch', { name: 'Enable Sales AI' });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  expect(toggle).toBeDisabled();
  expect(screen.getByText('Saving Sales AI status…')).toBeInTheDocument();
  const writes = apiRequest.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body)).toEqual({ ...settings, enabled: true });
  resolveSave({ ...response, settings: { ...settings, enabled: true, version: 2 } });
  await waitFor(() => expect(toggle).toBeChecked());
  expect(screen.getByText('Sales AI enabled')).toBeInTheDocument();
  apiRequest.mockRejectedValueOnce(new Error('Connection lost. Try again.'));
  fireEvent.click(toggle);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost. Try again.');
  expect(toggle).toBeChecked();
  expect(toggle).not.toBeDisabled();
  apiRequest.mockResolvedValueOnce({ ...response, settings: { ...settings, version: 3 } });
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).not.toBeChecked());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('loads a direct configuration page, saves bounded permissions, and returns through the source history', async () => {
  const navigate = vi.fn(); render(<ShopSalesAi pathname="/shop/sales-ai/configure" onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Representative name'), { target: { value: 'Shop helper' } });
  fireEvent.change(screen.getByLabelText('Return policy'), { target: { value: 'Contact us within seven days.' } });
  fireEvent.click(screen.getByLabelText(/search products/));
  fireEvent.click(screen.getByRole('button', { name: 'Save Sales AI' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/sales-ai', { back: true }));
  const submitted = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
  expect(submitted).toMatchObject({ name: 'Shop helper', tool_permissions: [], version: 1, sales_policies: { returns: 'Contact us within seven days.' } });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('previews top-up proof, keeps failed form data and uses the same request key on retry', async () => {
  const navigate = vi.fn(), attempts = []; let fail = true;
  apiRequest.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') { attempts.push(options.body); if (fail) { fail = false; throw new Error('Upload interrupted'); } return { request: { id: 8, status: 'pending' } }; }
    return { items: [], has_more: false, payment_methods: [{ id: 1, bank: 'KBZPay', account_no: '09123', account_name: 'Platform' }] };
  });
  const view = render(<ShopSalesAi pathname="/shop/sales-ai/topups/new" onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Amount (MMK)'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Payment proof'), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  expect(await screen.findByAltText('Selected payment proof')).toHaveAttribute('src', 'blob:proof');
  fireEvent.submit(view.container.querySelector('form'));
  await screen.findByText('Upload interrupted');
  expect(screen.getByLabelText('Amount (MMK)')).toHaveValue(1000);
  fireEvent.submit(view.container.querySelector('form'));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/sales-ai/topups/8', { replace: true }));
  expect(attempts[0].get('request_key')).toBe(attempts[1].get('request_key'));
});

it('keeps loaded balance entries on incremental failure, retries the same offset and deduplicates', async () => {
  let failed = false;
  const usage = { timezone: 'Asia/Yangon', daily: { total: '123.456789', items: [{ key: '2026-10-25', label: 'Oct 25', cost: '123.456789' }] }, monthly: { total: '500', items: [{ key: '2026-10', label: 'Oct 2026', cost: '500' }] } };
  const row = id => ({ id, description: `Usage entry ${id}`, amount: '-1', balance_after: '499', created_at: '2026-10-25T10:00:00Z' });
  apiRequest.mockImplementation(async path => {
    if (path.includes('offset=20')) { if (!failed) { failed = true; throw new Error('History interrupted'); } return { items: [row(20), row(21)], has_more: false }; }
    return { items: Array.from({ length: 20 }, (_, index) => row(index + 1)), has_more: true, usage };
  });
  render(<ShopSalesAi pathname="/shop/sales-ai/wallet" onNavigate={vi.fn()} />);
  await screen.findByText('Usage entry 1');
  expect(screen.getByRole('heading', { name: 'Daily usage' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Monthly usage' })).toBeInTheDocument();
  expect(screen.getByText('123.456789 MMK', { selector: 'strong' })).toBeInTheDocument();
  expect(apiRequest.mock.calls[0][0]).toContain('include_usage=1');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('History interrupted');
  expect(screen.getByRole('heading', { name: 'Daily usage' })).toBeInTheDocument();
  expect(screen.getByText('Usage entry 20')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Usage entry 21');
  expect(screen.getAllByText('Usage entry 20')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  expect(apiRequest.mock.calls.filter(([path]) => path.includes('offset=20'))).toHaveLength(2);
  expect(apiRequest.mock.calls.filter(([path]) => path.includes('offset=20')).every(([path]) => path.includes('include_usage=0'))).toBe(true);
});

it('shows honest zero usage charts and preserves precise daily values in the disclosure', async () => {
  apiRequest.mockResolvedValue({ items: [], usage: { timezone: 'Asia/Yangon', daily: { total: '0', items: [{ key: '2026-10-26', label: 'Oct 26', cost: '0' }] }, monthly: { total: '0', items: [{ key: '2026-10', label: 'Oct 2026', cost: '0' }] } } });
  render(<ShopSalesAi pathname="/shop/sales-ai/wallet" onNavigate={vi.fn()} />);
  expect(await screen.findAllByText('No AI usage in this period.')).toHaveLength(2);
  expect(screen.getByText('No records yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('View daily usage values'));
  expect(screen.getByText('Oct 26', { selector: 'th' })).toBeInTheDocument();
  expect(screen.getByText('AI usage cost · MMK · Asia/Yangon')).toBeInTheDocument();
});

it('copies the selected bank details with feedback and changes receiving accounts with radios', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  apiRequest.mockResolvedValue({ payment_methods: [{ id: 1, bank: 'KBZPay', account_no: '09123', account_name: 'First recipient' }, { id: 2, bank: 'AYA Pay', account_no: '09456', account_name: 'Second recipient' }] });
  render(<ShopSalesAi pathname="/shop/sales-ai/topups/new" onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'AYA Pay 09456' }));
  expect(screen.getByText('Second recipient')).toBeInTheDocument();
  for (const [label, value] of [['bank name', 'AYA Pay'], ['account number', '09456'], ['account name', 'Second recipient']]) {
    fireEvent.click(screen.getByRole('button', { name: `Copy ${label}` }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(value));
  }
  expect(screen.getByRole('status')).toHaveTextContent('Account name copied.');
});

it('shows receipt checking, prevents double submit and retains proof on a validation error', async () => {
  let rejectCheck;
  apiRequest.mockImplementation(async (_path, options) => options?.method === 'POST' ? new Promise((_, reject) => { rejectCheck = reject; }) : { items: [], payment_methods: [{ id: 1, bank: 'KBZPay', account_no: '09123', account_name: 'Platform' }] });
  const navigate = vi.fn();
  const view = render(<ShopSalesAi pathname="/shop/sales-ai/topups/new" onNavigate={navigate} />);
  fireEvent.change(await screen.findByLabelText('Amount (MMK)'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Payment proof'), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  fireEvent.submit(view.container.querySelector('form'));
  fireEvent.submit(view.container.querySelector('form'));
  expect(await screen.findByText('Checking your receipt. Please wait.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit top-up' })).toBeDisabled();
  rejectCheck(Object.assign(new Error('Amount mismatch. Expected 1,000 MMK.'), { payload: { errors: { payment_screenshot: ['Amount mismatch. Expected 1,000 MMK.'] } } }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit top-up' })).not.toBeDisabled());
  expect(screen.getByLabelText('Amount (MMK)')).toHaveValue(1000);
  expect(screen.getByAltText('Selected payment proof')).toBeInTheDocument();
  expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(navigate).not.toHaveBeenCalled();
});

it('reconciles assistant updates while preserving other unsaved Sales AI edits', async () => {
  render(<ShopSalesAi pathname="/shop/sales-ai/configure" onNavigate={vi.fn()} />);
  const name = await screen.findByLabelText('Representative name');
  fireEvent.change(name, { target: { value: 'My unsaved name' } });
  fireEvent(window, new CustomEvent('mkpos:sales-ai-updated', { detail: { ...response, settings: { ...settings, soul: 'Updated by assistant', version: 2 } } }));
  await waitFor(() => expect(screen.getByLabelText('Soul / personality')).toHaveValue('Updated by assistant'));
  expect(name).toHaveValue('My unsaved name');
});
