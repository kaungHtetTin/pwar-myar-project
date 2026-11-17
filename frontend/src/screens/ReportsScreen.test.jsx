import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../components/notifications';
import { ReportsScreen } from './ReportsScreen';

function response(payload) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
}

describe('ReportsScreen account scopes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('separates selected-period performance from current customer accounts', async () => {
    globalThis.fetch = vi.fn(() => response({
      start: '2026-07-01',
      end: '2026-07-27',
      all_time: false,
      sales_count: 3,
      sales_total: 10000,
      cash_total: 7000,
      credit_total: 3000,
      expense_total: 1000,
      profit_estimate: 2500,
      foc_quantity: 0,
      foc_cost: 0,
      purchase_foc_quantity: 0,
      purchase_foc_value: 0,
      payment_methods: [],
      expense_categories: [],
      top_products: [],
      cash_movement: {
        start: '2026-07-01',
        end: '2026-07-27',
        debt_collected: 500,
        shop_payouts: 200,
        expected_cash_drawer: 1500,
        net_movement: 2900,
      },
      current_accounts: {
        as_of: '2026-07-27',
        receivable_total: 3000,
        payable_total: 500,
        customers_owing: 1,
        open_accounts: 2,
      },
      inventory_valuation: {
        as_of: '2026-07-27',
        product_count: 2,
        stock_units: 12,
        investment_value: 8400,
        potential_sales_value: 15000,
      },
      sales_trends: {
        month: { label: 'July 2026', items: [{ label: '1', total: 10000 }] },
        year: { label: '2026', items: [{ label: 'Jul', total: 10000 }] },
      },
    }));

    render(
      <NotificationProvider>
        <ReportsScreen />
      </NotificationProvider>,
    );

    await waitFor(() => expect(screen.getByText('10,000 Ks')).toBeInTheDocument());
    expect(screen.getByText('Selected Period')).toBeInTheDocument();
    expect(screen.getByText('Paid During Sales')).toBeInTheDocument();
    expect(screen.getByText('Net Profit Estimate')).toBeInTheDocument();
    expect(screen.getByText('Sales of Month')).toBeInTheDocument();
    expect(screen.getByText('Sales of Year')).toBeInTheDocument();
    expect(screen.queryByText('Today Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Debt Collected')).not.toBeInTheDocument();
    expect(screen.queryByText('Shop Payouts')).not.toBeInTheDocument();
    expect(screen.queryByText('Cash Movement')).not.toBeInTheDocument();
    expect(screen.queryByText('Net Movement')).not.toBeInTheDocument();
    expect(screen.getByText('Current Accounts')).toBeInTheDocument();
    expect(screen.getByText('Current Inventory Value')).toBeInTheDocument();
    expect(screen.getByText('Current Stock Investment')).toBeInTheDocument();
    expect(screen.getByText('Potential Sales Value')).toBeInTheDocument();
    expect(screen.getByText('8,400 Ks')).toBeInTheDocument();
    expect(screen.getByText('15,000 Ks')).toBeInTheDocument();
    expect(screen.getByText('Current Receivable')).toBeInTheDocument();
    expect(screen.getByText('Total Payable')).toBeInTheDocument();
    expect(screen.getByText('Customers Owing')).toBeInTheDocument();
    expect(screen.getByText('Open Accounts')).toBeInTheDocument();
    expect(screen.getAllByText('500 Ks').length).toBeGreaterThan(0);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('today-summary'))).toBe(false);
  });
});
