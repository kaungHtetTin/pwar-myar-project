import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OverviewPage } from './OverviewPage';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const props = () => ({ businesses: [], businessSummary: { total: 100, access_counts: { paid: 70, trial: 20 } },
  requests: [{ id: 1, status: 'pending', business_name: 'Waiting Shop', plan_name: 'Monthly', price: 10000, currency: 'Ks', created_at: '2026-10-25T03:00:00Z' }, { id: 2, status: 'approved', business_name: 'Approved Shop', plan_name: 'Monthly', price: 10000, currency: 'Ks', created_at: '2026-10-25T03:00:00Z' }],
  financialReport: { currency: 'Ks', summary: { this_month: '150000' } }, canManageAI: true,
  onManageAI: vi.fn(), onManageBusinesses: vi.fn(), onReviewPayments: vi.fn() });
beforeEach(() => { api.mockReset(); api.mockResolvedValue({ currency: 'USD', balance: '5.123456000', can_use_ai: true }); });

it('shows actionable platform totals, pending payments and the internal AI balance', async () => {
  render(<OverviewPage {...props()} />);
  await screen.findByText('USD 5.123456');
  const summary = screen.getByRole('region', { name: 'Platform summary' });
  expect(summary).toHaveTextContent('100');
  expect(summary).toHaveTextContent('90');
  expect(summary).toHaveTextContent('70 paid · 20 trials');
  expect(summary).toHaveTextContent('150,000 Ks');
  const pending = screen.getByRole('table', { name: 'Pending payments' });
  expect(pending).toHaveTextContent('Waiting Shop');
  expect(pending).not.toHaveTextContent('Approved Shop');
  expect(screen.queryByText('Plan catalog')).not.toBeInTheDocument();
  expect(screen.queryByText('Published plans')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Business access' })).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/office/ai-balance-book/summary');
});

it('shows empty credit as paused and opens the correct management actions once', async () => {
  api.mockResolvedValue({ currency: 'USD', balance: '0.000000000', can_use_ai: false });
  const callbacks = props(); render(<OverviewPage {...callbacks} />);
  await screen.findByText('USD 0.00');
  expect(screen.getAllByText('AI paused · Top up required')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Review payments' }));
  fireEvent.click(screen.getByRole('button', { name: /Manage businesses/ }));
  fireEvent.click(screen.getByRole('button', { name: /AI balance book/ }));
  expect(callbacks.onReviewPayments).toHaveBeenCalledOnce();
  expect(callbacks.onManageBusinesses).toHaveBeenCalledOnce();
  expect(callbacks.onManageAI).toHaveBeenCalledOnce();
});

it('updates balance on Refresh and after a top-up, without showing a failed fetch as zero', async () => {
  const defaults = props();
  const { rerender } = render(<OverviewPage {...defaults} refreshToken={0} />);
  await screen.findByText('USD 5.123456');
  api.mockRejectedValueOnce(new Error('Unavailable'));
  rerender(<OverviewPage {...defaults} refreshToken={1} />);
  await screen.findAllByText('Unavailable · Refresh to retry');
  expect(screen.queryByText('USD 0.00')).not.toBeInTheDocument();
  api.mockResolvedValue({ currency: 'USD', balance: '10.000000000', can_use_ai: true });
  fireEvent(window, new Event('mkpos:office-ai-balance-changed'));
  await screen.findByText('USD 10.00');
  await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
});

it('does not expose or request AI balances for regular administrators', async () => {
  render(<OverviewPage {...props()} canManageAI={false} requests={[]} financialReport={null} />);
  expect(screen.queryByText('AI remaining balance')).not.toBeInTheDocument();
  expect(screen.queryByText('AI cost per 100 requests')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /AI balance book/ })).not.toBeInTheDocument();
  expect(screen.getByText('No payments are waiting for review.')).toBeInTheDocument();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

it('shows the all-time cost per 100 requests with useful USD precision and updates it on refresh', async () => {
  api.mockResolvedValue({ balance: '5.000000000', can_use_ai: true, total_requests: 3, average_cost_per_100_requests: '0.133333333' });
  const defaults = props(); const view = render(<OverviewPage {...defaults}/>);
  const card = within(screen.getByText('AI cost per 100 requests').closest('article'));
  await card.findByText('USD 0.133333');
  expect(card.getByText('All-time estimated average')).toBeVisible();
  api.mockResolvedValue({ balance: '5.000000000', can_use_ai: true, total_requests: 4, average_cost_per_100_requests: '0.200000000' });
  view.rerender(<OverviewPage {...defaults} refreshToken={1}/>);
  await card.findByText('USD 0.20');
  expect(api).toHaveBeenCalledTimes(2);
});

it('distinguishes no recorded usage from a true zero cost', async () => {
  api.mockResolvedValue({ balance: '5.000000000', can_use_ai: true, total_requests: 0, average_cost_per_100_requests: null });
  const defaults = props(); const view = render(<OverviewPage {...defaults}/>);
  await screen.findByText('No usage yet');
  const card = within(screen.getByText('AI cost per 100 requests').closest('article'));
  expect(card.getByText('—')).toBeVisible();
  api.mockResolvedValue({ balance: '5.000000000', can_use_ai: true, total_requests: 1, average_cost_per_100_requests: '0.000000000' });
  view.rerender(<OverviewPage {...defaults} refreshToken={1}/>);
  await card.findByText('USD 0.00');
});
