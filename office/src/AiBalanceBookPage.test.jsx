import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AiBalanceBookPage } from './AiBalanceBookPage';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const data = { currency: 'USD', balance: '0.000000000', can_use_ai: false, total_top_ups: '0.000000000', total_usage: '0.000000000', items: [], total: 0, page: 1, last_page: 1, per_page: 25 };
beforeEach(() => { api.mockReset(); api.mockResolvedValue(data); });
const open = async () => { await screen.findByRole('table', { name: 'AI balance entries' }); fireEvent.click(screen.getByRole('button', { name: 'Top up', exact: true })); };
const fill = () => {
  fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '5.25' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'AI budget' } });
  fireEvent.change(screen.getByLabelText('Reference (optional)'), { target: { value: 'ALLOC-1' } });
};

it('shows paused internal credit and cancels top-ups without replacing the source or refetching', async () => {
  render(<AiBalanceBookPage />);
  await open();
  const table = screen.getByRole('table', { name: 'AI balance entries' });
  const calls = api.mock.calls.length;
  expect(screen.getByText('Paused')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveTextContent('does not send a payment');
  fill(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'AI balance entries' })).toBe(table);
  expect(api).toHaveBeenCalledTimes(calls);
  fireEvent.click(screen.getByRole('button', { name: 'Top up', exact: true }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Top up', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(calls);
});

it('retains a failed top-up and reuses its key on retry, then reconciles balance', async () => {
  render(<AiBalanceBookPage />); await open(); fill();
  api.mockRejectedValueOnce(new Error('Connection interrupted'));
  fireEvent.click(screen.getByRole('button', { name: 'Record top-up' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  expect(screen.getByLabelText('Amount (USD)')).toHaveValue(5.25);
  api.mockResolvedValueOnce({ entry: { id: 1 } }).mockResolvedValue({ ...data, balance: '5.250000000', total_top_ups: '5.250000000', can_use_ai: true });
  fireEvent.click(screen.getByRole('button', { name: 'Record top-up' }));
  await screen.findByText('Internal AI top-up recorded.');
  await screen.findByText('Funded');
  const writes = api.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(writes[0][1].body).toBe(writes[1][1].body);
  expect(JSON.parse(writes[1][1].body)).toEqual({ amount: '5.25', description: 'AI budget', reference: 'ALLOC-1', request_key: expect.any(String) });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('prevents duplicate submission and dismissal while recording a top-up', async () => {
  render(<AiBalanceBookPage />); await open(); fill();
  let finish;
  api.mockImplementation((path, options) => options?.method === 'POST' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(data));
  const form = screen.getByLabelText('Amount (USD)').closest('form');
  fireEvent.submit(form); fireEvent.submit(form);
  expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  finish({ entry: { id: 1 } });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('searches, clears and paginates using server boundaries and shared page sizes', async () => {
  api.mockImplementation(path => {
    const params = new URLSearchParams(path.split('?')[1]);
    return Promise.resolve({ ...data, total: 26, page: Number(params.get('page')), per_page: Number(params.get('per_page')), last_page: Number(params.get('per_page')) === 25 ? 2 : 1 });
  });
  render(<AiBalanceBookPage />);
  await screen.findByText('Page 1 of 2');
  expect(screen.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  await screen.findByText('Page 2 of 2');
  expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Search AI balance entries'), { target: { value: 'ALLOC-1' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/office/ai-balance-book?q=ALLOC-1&page=1&per_page=25'));
  fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
  await screen.findByText('Page 1 of 1');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search ai balance entries' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/office/ai-balance-book?q=&page=1&per_page=50'));
  expect(within(screen.getByRole('navigation', { name: 'AI balance entries pagination' })).getByRole('button', { name: 'Last' })).toBeDisabled();
});

it('retries a failed balance-book load', async () => {
  api.mockRejectedValueOnce(new Error('Setup required'));
  render(<AiBalanceBookPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Setup required');
  fireEvent.click(screen.getByRole('button', { name: 'Reload balance book' }));
  await screen.findByRole('table', { name: 'AI balance entries' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows reported cache hits and labels historical usage with no cache data', async () => {
  const usage = { type: 'usage', description: 'Estimated AI request cost', amount: '-0.000184800', balance_after: '0.999815200', input_tokens: 1000, output_tokens: 100, model: 'deepseek-flash', business_id: 1, user_id: 2, created_at: '2026-10-25T03:00:00Z' };
  api.mockResolvedValue({ ...data, items: [{ ...usage, id: 1, run_id: 'cached-run', cached_input_tokens: 800 }, { ...usage, id: 2, run_id: 'legacy-run', cached_input_tokens: null }], total: 2 });
  render(<AiBalanceBookPage />);
  await screen.findByText('800 cached / 200 uncached input');
  expect(screen.getByText('Cache usage unreported; uncached estimate')).toBeInTheDocument();
  expect(screen.getAllByText('0.0001848')).toHaveLength(2);
});
