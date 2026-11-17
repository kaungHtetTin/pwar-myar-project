import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShopReportPage } from '../ShopReports';
import { request } from '../api';
const account = vi.hoisted(() => ({ customer: { id: 1 }, loading: false }));
vi.mock('../CustomerAccount', () => ({ useCustomer: () => account, CustomerAuth: ({ next }) => <div>Sign in: {next}</div> }));
vi.mock('../api', () => ({ request: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { account.customer = { id: 1 }; request.mockReset(); });
it('keeps the failed draft and submission key, then reconciles the received report without refetch', async () => {
  let attempts = 0;
  request.mockImplementation(async (path, options = {}) => {
    if (!options.method) return { shop: { name: 'Demo', can_report: true }, items: [], has_more: false };
    if (++attempts === 1) throw new Error('Try again');
    return { created: true, report: { ...JSON.parse(options.body), id: 12, status: 'open', created_at: '2026-10-09 01:00:00' } };
  });
  render(<ShopReportPage slug="demo" />);
  fireEvent.change(await screen.findByLabelText('Report reason'), { target: { value: 'payment_issue' } });
  fireEvent.change(screen.getByLabelText(/What happened/), { target: { value: 'The payment instructions are misleading.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send report to Office' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  expect(screen.getByLabelText(/What happened/)).toHaveValue('The payment instructions are misleading.');
  fireEvent.click(screen.getByRole('button', { name: 'Send report to Office' }));
  await screen.findByText('Report received');
  const writes = request.mock.calls.filter(([, options]) => options?.method);
  expect(JSON.parse(writes[0][1].body).submission_key).toBe(JSON.parse(writes[1][1].body).submission_key);
  expect(request.mock.calls.filter(([, options]) => !options?.method)).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Send report to Office' })).not.toBeInTheDocument();
});
it('shows the Office response on historical reports and allows a new report after closure', async () => {
  request.mockResolvedValue({ shop: { name: 'Demo', can_report: true }, items: [{ id: 3, reason: 'other', details: 'A previous issue', status: 'resolved', office_response: 'This has been corrected.', created_at: '2026-10-09 01:00:00' }], has_more: false });
  render(<ShopReportPage slug="demo" />);
  expect(await screen.findByText('This has been corrected.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send report to Office' })).toBeInTheDocument();
  request.mockResolvedValue({ shop: { name: 'Demo', can_report: true }, items: [{ id: 3, reason: 'other', details: 'A previous issue', status: 'resolved', office_response: 'Office has updated the response.', created_at: '2026-10-09 01:00:00' }], has_more: false });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh reports' }));
  expect(await screen.findByText('Office has updated the response.')).toBeInTheDocument();
  expect(request.mock.calls.at(-1)[0]).toContain('offset=0');
});
it('requires sign in and preserves the destination without requesting report history', () => {
  account.customer = null; render(<ShopReportPage slug="demo" />);
  expect(screen.getByText('Sign in: /store/demo/report')).toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
