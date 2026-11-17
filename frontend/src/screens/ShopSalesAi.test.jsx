import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { request, requestDownload } from '../api';
import { ShopSalesAi } from './ShopSalesAi';

vi.mock('../api', () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const settings = { enabled: false, name: 'Mia', instructions: 'Help customers', soul: 'Friendly', tool_permissions: ['search_products'], version: 1 };
const response = { settings, tools: [{ name: 'search_products', description: 'Public catalog only' }], wallet: { available: '500.000000', reserved: '0' }, pricing: { usd_to_mmk_rate: '4000', markup_percent: '5' } };
const topups = { items: [], has_more: false, payment_methods: [{ id: 1, bank: 'KBZPay', account_no: '0912345', account_name: 'Platform' }] };
it('opens a notification top-up outside the loaded list and updates its status and wallet in place', async () => {
  const row = { id: 147, amount: '1000', status: 'pending', transaction_reference: 'TEST-147', version: 1 };
  request.mockImplementation(async path => path.endsWith('/topups/147') ? { request: row } : path.includes('/topups') ? topups : response);
  const close = vi.fn(); render(<ShopSalesAi section="topups" topupId={147} onTopupClose={close} />);
  const dialog = await screen.findByRole('dialog', { name: 'Top-up #147' });
  expect(within(dialog).getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: {
    requests: [{ ...row, status: 'approved', version: 2 }], wallet: { available: '1500', reserved: '0' }, wallet_changed: true,
  } })));
  expect(within(dialog).getByText(/approved/)).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
  expect(screen.getByText('1,500 MMK')).toBeInTheDocument();
  const reads = request.mock.calls.length;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close', exact: true }));
  expect(close).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledTimes(reads);
});

it('updates live credit without overwriting an unsaved settings draft', async () => {
  render(<ShopSalesAi />);
  fireEvent.change(await screen.findByLabelText('Representative name'), { target: { value: 'Unsaved helper name' } });
  act(() => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: { wallet: { available: '2500', reserved: '0' }, requests: [] } })));
  expect(screen.getByLabelText('Representative name')).toHaveValue('Unsaved helper name');
  expect(screen.getByText('2,500 MMK')).toBeInTheDocument();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IntersectionObserver', undefined);
  const OriginalURL = URL;
  vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = () => 'blob:proof'; static revokeObjectURL = vi.fn(); });
  request.mockImplementation(async path => path.includes('/wallet') ? { items: [], has_more: false, wallet: response.wallet } : path.includes('/topups') ? topups : response);
  requestDownload.mockResolvedValue({ blob: new Blob(['image'], { type: 'image/png' }) });
});
afterEach(() => vi.unstubAllGlobals());

it('saves explicit tool permissions and keeps unsaved configuration while visiting history', async () => {
  render(<ShopSalesAi />);
  fireEvent.change(await screen.findByLabelText('Representative name'), { target: { value: 'Shop helper' } });
  fireEvent.click(screen.getByRole('button', { name: 'Balance book' }));
  fireEvent.click(screen.getByRole('button', { name: 'Configuration' }));
  expect(screen.getByLabelText('Representative name')).toHaveValue('Shop helper');
  fireEvent.change(screen.getByLabelText('Return policy'), { target: { value: 'Contact us within seven days.' } });
  fireEvent.click(screen.getByLabelText(/search products/));
  fireEvent.click(screen.getByRole('button', { name: 'Save Sales AI' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/shop-admin/sales-ai', expect.objectContaining({ method: 'PUT' })));
  const saved = JSON.parse(request.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
  expect(saved).toMatchObject({ name: 'Shop helper', tool_permissions: [], version: 1, sales_policies: { returns: 'Contact us within seven days.' } });
});

it('previews proof, preserves a failed top-up and reuses its request key on retry', async () => {
  let failed = false;
  const attempts = [];
  request.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      attempts.push(options.body);
      if (!failed) { failed = true; throw new Error('Connection interrupted'); }
      return { request: { id: 7, amount: '1000', status: 'pending', version: 1, created_at: '2026-10-25T10:00:00Z' } };
    }
    return path.includes('/wallet') ? { items: [], has_more: false, wallet: response.wallet } : path.includes('/topups') ? topups : response;
  });
  render(<ShopSalesAi />);
  fireEvent.click(await screen.findByRole('button', { name: 'Top up' }));
  const modal = await screen.findByRole('dialog', { name: 'Top up Sales AI' });
  fireEvent.change(within(modal).getByLabelText('Amount (MMK)'), { target: { value: '1000' } });
  fireEvent.change(within(modal).getByLabelText('Payment proof'), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  expect(await within(modal).findByAltText('Selected payment proof')).toHaveAttribute('src', 'blob:proof');
  fireEvent.submit(modal.querySelector('form'));
  await within(modal).findByText('Connection interrupted');
  expect(within(modal).getByLabelText('Amount (MMK)')).toHaveValue(1000);
  fireEvent.submit(modal.querySelector('form'));
  await screen.findByText('Top-up submitted for manual approval.');
  expect(attempts).toHaveLength(2);
  expect(attempts[0].get('request_key')).toBe(attempts[1].get('request_key'));
  expect(screen.getByRole('button', { name: 'Top-up #7' })).toBeInTheDocument();
});

it('shows receipt checking and retains the form and image when AI requests correction', async () => {
  let rejectCheck;
  request.mockImplementation(async (path, options) => options?.method === 'POST' ? new Promise((_, reject) => { rejectCheck = reject; }) : path.includes('/topups') ? topups : response);
  render(<ShopSalesAi />);
  fireEvent.click(await screen.findByRole('button', { name: 'Top up' }));
  const modal = await screen.findByRole('dialog', { name: 'Top up Sales AI' });
  fireEvent.change(within(modal).getByLabelText('Amount (MMK)'), { target: { value: '1000' } });
  fireEvent.change(within(modal).getByLabelText('Payment proof'), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
  fireEvent.submit(modal.querySelector('form'));
  fireEvent.submit(modal.querySelector('form'));
  expect(await within(modal).findByText('Checking your receipt. Please wait.')).toBeInTheDocument();
  rejectCheck(Object.assign(new Error('Amount mismatch. Expected 1,000 MMK.'), { payload: { errors: { payment_screenshot: ['Amount mismatch. Expected 1,000 MMK.'] } } }));
  await waitFor(() => expect(within(modal).getByRole('button', { name: 'Submit top-up' })).not.toBeDisabled());
  expect(within(modal).getByLabelText('Amount (MMK)')).toHaveValue(1000);
  expect(within(modal).getByAltText('Selected payment proof')).toBeInTheDocument();
  expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it('splits controlled navigation sections while retaining the draft and loaded data', async () => {
  const view = render(<ShopSalesAi section="settings" onSectionChange={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Representative name'), { target: { value: 'Retained representative' } });
  expect(screen.queryByRole('navigation', { name: 'Sales AI sections' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Delivery policy')).not.toBeInTheDocument();
  view.rerender(<ShopSalesAi section="policies" onSectionChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Delivery policy'), { target: { value: 'Within two business days' } });
  expect(screen.queryByLabelText('Representative name')).not.toBeInTheDocument();
  view.rerender(<ShopSalesAi section="tools" onSectionChange={vi.fn()} />);
  fireEvent.click(screen.getByLabelText(/search products/));
  view.rerender(<ShopSalesAi section="settings" onSectionChange={vi.fn()} />);
  expect(screen.getByLabelText('Representative name')).toHaveValue('Retained representative');
  fireEvent.click(screen.getByRole('button', { name: 'Save Sales AI' }));
  await waitFor(() => expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
  const data = JSON.parse(request.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
  expect(data).toMatchObject({ name: 'Retained representative', sales_policies: { delivery: 'Within two business days' }, tool_permissions: [] });
  expect(request.mock.calls.filter(([path, options]) => path === '/shop-admin/sales-ai' && !options?.method)).toHaveLength(1);
});

it('reconciles assistant updates while preserving other unsaved Sales AI edits', async () => {
  render(<ShopSalesAi />);
  const name = await screen.findByLabelText('Representative name');
  fireEvent.change(name, { target: { value: 'My unsaved name' } });
  fireEvent(window, new CustomEvent('mkpos:sales-ai-updated', { detail: { ...response, settings: { ...settings, soul: 'Updated by assistant', version: 2 } } }));
  await waitFor(() => expect(screen.getByLabelText('Soul / personality')).toHaveValue('Updated by assistant'));
  expect(name).toHaveValue('My unsaved name');
});
