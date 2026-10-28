import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { CustomersScreen } from './CustomersScreen';

function response(payload) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
}

const customer = {
  id: 7,
  name: 'Statement Customer',
  phone: '09123',
  address: 'Yangon Downtown',
  note: 'Preferred customer',
  balance: 1600,
  sale_count: 1,
  total_sales: 2000,
  last_sale: '2026-07-15 10:30:00',
};

const sale = {
  id: 9,
  customer_id: 7,
  created_at: '2026-07-15 10:30:00',
  receipt_no: 'R260715-0001',
  customer_name: customer.name,
  payment_type: 'credit',
  payment_method: 'Credit',
  status: 'completed',
  subtotal: 2000,
  discount: 0,
  total: 2000,
  paid_amount: 0,
  credit_amount: 2000,
  items: [{ id: 1, product_id: 4, product_name: 'Apple', unit_name: 'Piece', price_type: 'Retail', quantity: 1, foc_quantity: 0, unit_price: 2000, unit_cost: 1000, line_total: 2000 }],
};

const payment = {
  id: 14,
  created_at: '2026-07-15 11:00:00',
  direction: 'customer_to_shop',
  payment_method: 'Cash',
  amount: 500,
  note: 'Part payment',
};

function customerDetail() {
  return {
    customer,
    summary: {
      balance: 1600,
      credit_total: 2000,
      paid_total: 500,
      payout_total: 100,
      total_sales: 2000,
      sale_count: 1,
      last_sale: customer.last_sale,
    },
    statement: { current_balance: 1600 },
    sales: [],
    payments: [],
    history: { sales_count: 1, payment_count: 1 },
  };
}

function renderCustomers(props = {}) {
  return render(
    <NotificationProvider>
      <ConfirmationProvider><CustomersScreen {...props} /></ConfirmationProvider>
    </NotificationProvider>,
  );
}

async function openCustomerDetail() {
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Statement Customer' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View customer' }));
  return screen.findByText('Customer profile');
}

describe('CustomersScreen supplier-parity flow', () => {
  let printWindow;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    printWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow);
    globalThis.fetch = vi.fn((url, options = {}) => {
      const path = String(url);
      const method = options.method || 'GET';
      if (path.includes('/sanctum/csrf-cookie')) return response({});
      if (path.endsWith('/customers') && method === 'POST') return response({ id: 8, ...JSON.parse(options.body) });
      if (path.includes('/customers?')) {
        return response({
          items: [customer],
          total: 1,
          account_summary: {
            total_customers: 1,
            receivable_total: 1600,
            payable_total: 0,
            open_accounts: 1,
          },
        });
      }
      if (path.includes('/customers/7/detail')) return response(customerDetail());
      if (path.includes('/customers/7/sales')) return response({ items: [sale], total: 1, limit: 50 });
      if (path.includes('/customers/7/payments') && method === 'POST') return response(payment);
      if (path.includes('/customers/7/payments')) return response({ items: [payment], total: 1, limit: 50 });
      if (path.includes('/customers/7/statement')) return response({
        customer,
        start: null,
        end: null,
        sales: [{ created_at: sale.created_at, receipt_no: sale.receipt_no, credit_amount: sale.credit_amount }],
        payments: [payment],
        summary: { credit_total: 2000, paid_total: 500, payout_total: 100, current_balance: 1600 },
      });
      if (path.endsWith('/sales/9/receipt')) return response({ text: 'Receipt text', html: '<div>Receipt preview</div>', paper_size: '80mm', layout: {} });
      if (path.endsWith('/sales/9/print') && method === 'POST') return response({ ok: true, message: 'Receipt print requested.' });
      if (path.endsWith('/sales/9')) return response(sale);
      if (path.includes('/customer-payments/14') && method === 'PUT') return response(payment);
      if (path.includes('/customer-payments/14') && method === 'DELETE') return response({});
      if (path.endsWith('/settings')) return response({ shop_name: 'PwarMyar Test Shop', payment_methods: 'Cash,Card' });
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('includes an optional email in the customer editor and saves it', async () => {
    renderCustomers();
    fireEvent.click(await screen.findByRole('button', { name: 'Add Customer' }));
    const modal = screen.getByRole('dialog', { name: 'Add Customer' });
    const email = within(modal).getByLabelText('Email (optional)');
    expect(email).not.toBeRequired();
    fireEvent.change(within(modal).getByLabelText('Customer Name'), { target: { value: 'New buyer' } });
    fireEvent.change(email, { target: { value: 'buyer@example.com' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Add Customer' }));
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url, options]) => String(url).endsWith('/customers') && options?.method === 'POST' && JSON.parse(options.body).email === 'buyer@example.com')).toBe(true));
  });

  it('renders the supplier-style profile and the same sale-history columns as the main Sales table', async () => {
    renderCustomers();
    await openCustomerDetail();

    const profile = screen.getByLabelText(customer.name);
    expect(within(profile).getByText('09123')).toBeInTheDocument();
    expect(within(profile).getByText('Yangon Downtown')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer detail statistics').querySelectorAll('.supplier-stat-card')).toHaveLength(6);

    const table = document.querySelector('.customer-sale-history-table');
    expect(table).toHaveClass('transaction-table', 'transaction-table-sales');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Date', 'Receipt', 'Customer', 'Type', 'Method', 'Total', 'Paid', 'Credit', 'Actions',
    ]);
    expect(within(table).getByText('R260715-0001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260715-0001' }));
    expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Print receipt R260715-0001' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit sale R260715-0001' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete sale R260715-0001' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    expect(await screen.findByRole('dialog', { name: 'Transaction Detail' })).toBeInTheDocument();
  });

  it('runs print, edit, and delete from the customer sale-history menu', async () => {
    renderCustomers();
    await openCustomerDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260715-0001' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print receipt R260715-0001' }));
    expect(await screen.findByRole('dialog', { name: 'Receipt Preview' })).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url, options]) => String(url).endsWith('/sales/9/print') && options?.method === 'POST')).toBe(true));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Receipt Preview' })).getByRole('button', { name: 'Close Receipt Preview' }));

    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260715-0001' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit sale R260715-0001' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit Sale' });
    expect(within(editDialog).getByRole('button', { name: 'Update Sale' })).toBeInTheDocument();
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260715-0001' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete sale R260715-0001' }));
    const confirmation = await screen.findByRole('dialog', { name: 'Delete sale' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete Sale' }));
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url, options]) => String(url).endsWith('/sales/9') && options?.method === 'DELETE')).toBe(true));
  });

  it('uses app-bar search and a standard filter drawer for customer sale history', async () => {
    renderCustomers();
    await openCustomerDetail();

    fireEvent.change(screen.getByLabelText('Search customer sales'), { target: { value: 'R260715' } });
    fireEvent.submit(screen.getByLabelText('Search customer sales').closest('form'));
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('q=R260715'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const drawer = await screen.findByRole('dialog', { name: 'Sale history filters' });
    fireEvent.change(within(drawer).getByLabelText('Sale type'), { target: { value: 'credit' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Apply Filter' }));
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('sale_type=credit'))).toBe(true));
  });

  it('returns direct row Payments to the filtered list and resumes its payment table on Forward without requests', async () => {
    let backAction;
    renderCustomers({ onDetailChange: action => { backAction = action; } });
    await screen.findByText('Statement Customer');
    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: 'Statement' } });
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('q=Statement'))).toBe(true));
    const table = document.querySelector('.customer-index-table');
    const sourceAction = screen.getByRole('button', { name: 'Actions for Statement Customer' });
    fireEvent.click(sourceAction);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Payments', exact: true }));
    const payments = await screen.findByRole('region', { name: 'Customer payment records', exact: true });
    await screen.findByText('Part payment');
    expect(backAction.label).toBe('Back to Customers');
    const count = globalThis.fetch.mock.calls.length;
    act(() => backAction.onClick());
    await waitFor(() => expect(screen.getByLabelText('Search customers')).toBeVisible());
    expect(screen.getByLabelText('Search customers')).toHaveValue('Statement');
    expect(document.querySelector('.customer-index-table')).toBe(table);
    expect(screen.getByRole('button', { name: 'Actions for Statement Customer' })).toBe(sourceAction);
    act(() => window.history.forward());
    await waitFor(() => expect(payments).toBeVisible());
    expect(screen.getByRole('region', { name: 'Customer payment records', exact: true })).toBe(payments);
    expect(globalThis.fetch.mock.calls.length).toBe(count);
  });

  it('opens the separate payment-record page and preserves the customer-list state on back navigation', async () => {
    let backAction = null;
    renderCustomers({ onDetailChange: (action) => { backAction = action; } });

    await screen.findByText('Statement Customer');
    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: 'Statement' } });
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('q=Statement'))).toBe(true));
    await openCustomerDetail();
    expect(backAction?.label).toBe('Back to Customers');

    fireEvent.click(screen.getByRole('button', { name: 'Payment records' }));
    expect(await screen.findByRole('region', { name: 'Customer payment records' })).toBeInTheDocument();
    expect(screen.getByText('Customer pays shop')).toBeInTheDocument();
    expect(backAction?.label).toBe('Back to Statement Customer');

    const requestsBeforeBack = globalThis.fetch.mock.calls.length;
    act(() => backAction.onClick());
    await waitFor(() => expect(backAction?.label).toBe('Back to Customers'));
    expect(screen.getByRole('textbox', { name: 'Search customer sales' })).toBeVisible();
    expect(backAction?.label).toBe('Back to Customers');
    act(() => backAction.onClick());
    await waitFor(() => expect(backAction).toBeNull());
    expect(screen.getByLabelText('Search customers')).toBeVisible();
    expect(globalThis.fetch.mock.calls.length).toBe(requestsBeforeBack);
    expect(screen.getByLabelText('Search customers')).toHaveValue('Statement');
    expect(backAction).toBeNull();
  });

  it('prints statements and supports index account filters and direct payment recording', async () => {
    renderCustomers();

    expect(await screen.findByLabelText('Customer account statistics')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const drawer = await screen.findByRole('dialog', { name: 'Customer filters' });
    fireEvent.change(within(drawer).getByLabelText('Account status'), { target: { value: 'receivable' } });
    fireEvent.change(within(drawer).getByLabelText('Sale activity'), { target: { value: 'with_sales' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Apply Filter' }));
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url]) => {
      const value = String(url);
      return value.includes('account_status=receivable') && value.includes('sale_activity=with_sales');
    })).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Statement Customer' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Record payment' }));
    const paymentDialog = await screen.findByRole('dialog', { name: 'Record Customer Payment' });
    fireEvent.change(within(paymentDialog).getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.click(within(paymentDialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url, options]) => String(url).endsWith('/customers/7/payments') && options?.method === 'POST')).toBe(true));

    await openCustomerDetail();
    fireEvent.click(screen.getByRole('button', { name: /Print statement/i }));
    await waitFor(() => expect(printWindow.document.write).toHaveBeenCalled());
    const html = printWindow.document.write.mock.calls[0][0];
    expect(html).toContain('PwarMyar Test Shop');
    expect(html).toContain('Statement Customer');
    expect(html).toContain('1,600 Ks');
  });
});
