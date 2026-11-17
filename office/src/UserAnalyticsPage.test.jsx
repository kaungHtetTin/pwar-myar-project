import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import UserAnalyticsPage from './UserAnalyticsPage';
import { RetainedViews } from './RetainedViews';

vi.mock('./api', () => ({ api: vi.fn() }));
const response = {
  from: '2026-11-13', to: '2026-11-14', timezone: 'Asia/Yangon', tracking_since: '2026-11-14',
  summary: { total: 25, enabled: 24, disabled: 1, dau: 3, wau: 7, mau: 10, registered: 2, previous_registered: 1, active: 8, previous_active: 4, stickiness: 30 },
  daily: [{ day: '2026-11-13', active: 0, registered: 1, total: 24 }, { day: '2026-11-14', active: 3, registered: 1, total: 25 }],
};
beforeEach(() => { api.mockReset(); api.mockResolvedValue(response); });

it('renders real counts, explains tracking limits, and exposes keyboard chart details', async () => {
  render(<UserAnalyticsPage />);
  expect(await screen.findByRole('region', { name: 'User analytics summary' })).toHaveTextContent('Daily active users3');
  expect(screen.getByText(/Earlier activity is unavailable/)).toBeInTheDocument();
  const day = screen.getByRole('img', { name: '2026-11-13: Not tracked' });
  fireEvent.focus(day);
  expect(screen.getByRole('region', { name: 'Daily active users' })).toHaveTextContent('Not tracked');
  expect(screen.getByText('30%')).toBeInTheDocument();
});

it('changes the audience and period and preserves both through retained navigation without a refetch', async () => {
  const view = render(<RetainedViews activeKey="analytics"><UserAnalyticsPage /></RetainedViews>);
  await screen.findByText('30%');
  fireEvent.change(screen.getByLabelText('Analytics accounts'), { target: { value: 'customers' } });
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/office/user-analytics?days=30&audience=customers'));
  await screen.findByText('30%');
  fireEvent.change(screen.getByLabelText('Analytics period'), { target: { value: '7' } });
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/office/user-analytics?days=7&audience=customers'));
  await screen.findByText('30%');
  const calls = api.mock.calls.length;
  view.rerender(<RetainedViews activeKey="other"><p>Other page</p></RetainedViews>);
  expect(screen.queryByLabelText('Analytics period')).not.toBeInTheDocument();
  view.rerender(<RetainedViews activeKey="analytics"><UserAnalyticsPage /></RetainedViews>);
  expect(screen.getByLabelText('Analytics period')).toHaveValue('7');
  expect(screen.getByLabelText('Analytics accounts')).toHaveValue('customers');
  expect(api).toHaveBeenCalledTimes(calls);
});

it('retries failed requests and responds to the shared refresh action', async () => {
  api.mockRejectedValueOnce(new Error('Analytics unavailable'));
  const view = render(<UserAnalyticsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry analytics' }));
  await screen.findByText('30%');
  expect(api).toHaveBeenCalledTimes(2);
  view.rerender(<UserAnalyticsPage refreshToken={1} />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
});

it('ignores responses from an earlier account filter', async () => {
  let finish;
  api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<UserAnalyticsPage />);
  fireEvent.change(screen.getByLabelText('Analytics accounts'), { target: { value: 'customers' } });
  await screen.findByText('30%');
  await act(async () => finish({ ...response, summary: { ...response.summary, stickiness: 99 } }));
  expect(screen.queryByText('99%')).not.toBeInTheDocument();
});
