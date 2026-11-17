import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopReport } from './ShopReport';
import { RetainedViews } from '../components/RetainedViews';
import { ShopScreen } from './ShopScreen';

vi.mock('../api', () => ({ request: vi.fn(), requestDownload: vi.fn() }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: () => <div />, LineChart: () => <div />,
  Bar: () => null, Line: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
const summary = { sales: 3000, completed_orders: 2, average_order_value: 1500, new_buyers: 1, returning_buyers: 1, cancellation_rate: 25, repeat_purchase_rate: 50, completion_rate: 50, paid_order_value: 3000, refund_pending: 1000, refunded: 0, orders: 4 };
const report = { currency: 'Ks', currencies: ['Ks', 'USD'], timezone: 'Asia/Rangoon', date_from: '2026-09-08', date_to: '2026-10-07', previous_from: '2026-08-09', previous_to: '2026-09-07', summary, previous: { ...summary, sales: 1000 },
  trend: [{ date: '2026-10-06', sales: 3000, orders: 2 }], top_products: [{ product_id: 1, name: 'Rice', unit_name: 'Bag', sales: '3000', quantity: 3 }],
  buyers: [{ name: 'New buyers', buyers: 1 }, { name: 'Returning buyers', buyers: 1 }], outcomes: [{ status: 'completed', orders: 2 }], segments: [{ name: 'Loyal buyers', buyers: 1, spend: '5000' }], follow_up: [{ customer_key: 'account:42', name: 'Buyer', purchases: 3, spend: 5000, last_purchase: '2026-07-01 00:00:00' }] };
beforeEach(() => { request.mockReset(); request.mockResolvedValue(report); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => vi.unstubAllGlobals());

it('places Filters in the desktop app bar and removes it when the report is hidden', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const page = active => <><div id="workspace-app-bar-actions" /><div className="module-view"><RetainedViews activeKey={active}>{active === 'report' ? <ShopReport refresh={0} onViewCustomer={vi.fn()} /> : <p>Other page</p>}</RetainedViews></div></>;
  const view = render(page('report'));
  await screen.findByText('Customers to reconnect with');
  const appBar = document.getElementById('workspace-app-bar-actions');
  const filters = within(appBar).getByRole('button', { name: 'Filters' });
  expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  fireEvent.click(filters);
  await screen.findByRole('dialog', { name: 'Shop report filters' });
  expect(filters).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request).toHaveBeenLastCalledWith('/shop-admin/report?analytics=1');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.rerender(page('other'));
  await waitFor(() => expect(within(appBar).queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument());
});

it('shows comparison summaries and opens the customer from marketing follow-up', async () => {
  const onViewCustomer = vi.fn();
  render(<ShopReport refresh={0} onViewCustomer={onViewCustomer} />);
  await screen.findByText('Customers to reconnect with');
  expect(request).toHaveBeenCalledWith('/shop-admin/report?analytics=1');
  const card = screen.getByText('Completed sales').closest('article');
  expect(within(card).getByText('3,000 Ks')).toBeInTheDocument();
  expect(within(card).getByText('+200% vs previous period')).toBeInTheDocument();
  expect(screen.getByText('Customer segments')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View customer Buyer' }));
  expect(onViewCustomer).toHaveBeenCalledWith('account:42');
});

it('applies dates and currency together and retains unapplied edits across navigation', async () => {
  const view = render(<RetainedViews activeKey="report"><ShopReport refresh={0} onViewCustomer={vi.fn()} /></RetainedViews>);
  await screen.findByText('Customers to reconnect with');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
  expect(request).toHaveBeenCalledTimes(1);
  view.rerender(<RetainedViews activeKey="customer"><p>Customer detail</p></RetainedViews>);
  expect(screen.getByLabelText('From')).not.toBeVisible();
  view.rerender(<RetainedViews activeKey="report"><ShopReport refresh={0} onViewCustomer={vi.fn()} /></RetainedViews>);
  expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
  expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request).toHaveBeenLastCalledWith('/shop-admin/report?analytics=1&date_from=2026-10-01&date_to=2026-10-07&currency=USD'));
});

it('offers retry on error and handles an empty report', async () => {
  request.mockRejectedValueOnce(new Error('Connection unavailable'));
  render(<ShopReport refresh={0} onViewCustomer={vi.fn()} />);
  await screen.findByRole('alert');
  request.mockResolvedValue({ ...report, summary: { ...summary, orders: 0, sales: 0 }, top_products: [], follow_up: [], segments: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No orders in this period. Try another date range or currency.');
  expect(screen.getByText('No completed purchase history.')).toBeInTheDocument();
});

it('changes a date preset without fetching until Apply and exposes product quantities', async () => {
  render(<ShopReport refresh={0} onViewCustomer={vi.fn()} />);
  await screen.findByText('Customers to reconnect with');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'today' } });
  expect(screen.getByLabelText('From').value).toBe(screen.getByLabelText('To').value);
  expect(request).toHaveBeenCalledTimes(1);
  const products = screen.getByText('Top products').closest('section');
  fireEvent.click(within(products).getByText('View data'));
  expect(within(products).getByRole('columnheader', { name: 'Quantity' })).toBeInTheDocument();
  expect(within(products).getByText('Rice (Bag)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});

it('ignores a stale response after refreshing and disables invalid ranges', async () => {
  let resolveOld;
  request.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<ShopReport refresh={0} onViewCustomer={vi.fn()} />);
  view.rerender(<ShopReport refresh={1} onViewCustomer={vi.fn()} />);
  await screen.findByText('Customers to reconnect with');
  await act(async () => resolveOld({ ...report, summary: { ...summary, sales: 99999 } }));
  expect(screen.queryByText('99,999 Ks')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-10' } });
  expect(screen.getByRole('button', { name: 'Apply Filter' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('From date cannot be later than To date.');
});

it('returns from customer detail to the same report without refetching or losing filters', async () => {
  history.replaceState(null, '', '/?shopTab=report');
  request.mockImplementation(async path => {
    if (path === '/auth/me') return { user: { role: 'owner' }, business: { timezone: 'Asia/Rangoon' }, subscription: { is_valid: true } };
    if (path === '/shop-admin/owner-location') return { submitted: true };
    if (path.includes('analytics=1')) return report;
    if (path === '/shop-admin/report') return { states: [] };
    if (path.includes('/history?')) return { items: [], total: 0 };
    if (path.includes('/customers/')) return { customer: { customer_key: 'account:42', customer_name: 'Buyer', account_type: 'account', phone: '', email: '', address: '' }, report: { total_orders: 0, completed_orders: 0, active_orders: 0, cancelled_orders: 0, currencies: [] } };
    return { items: [], total: 0 };
  });
  function Workspace() {
    const [back, setBack] = useState(null);
    return <div className="module-view">{back && <button onClick={back.onClick}>{back.label}</button>}<ShopScreen onDetailChange={setBack} /></div>;
  }
  render(<Workspace />);
  await screen.findByText('Customers to reconnect with');
  const periodSection = screen.getByText('Selected Period').closest('section');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  const from = screen.getByLabelText('From');
  fireEvent.change(from, { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  const requestsBefore = request.mock.calls.filter(([path]) => path.includes('analytics=1')).length;
  fireEvent.click(screen.getByRole('button', { name: 'View customer Buyer' }));
  await screen.findByRole('button', { name: 'Back to report' });
  expect(periodSection).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back to report' }));
  await waitFor(() => expect(periodSection).toBeVisible());
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(request.mock.calls.filter(([path]) => path.includes('analytics=1'))).toHaveLength(requestsBefore);
  fireEvent.click(screen.getByRole('button', { name: 'View customer Buyer' }));
  await screen.findByRole('button', { name: 'Back to report' });
  act(() => history.back());
  await waitFor(() => expect(periodSection).toBeVisible());
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
  expect(request.mock.calls.filter(([path]) => path.includes('analytics=1'))).toHaveLength(requestsBefore);
  history.replaceState(null, '', '/');
});
