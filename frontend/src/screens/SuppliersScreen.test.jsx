import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { emitDataChange } from '../dataEvents';
import { SuppliersScreen } from './SuppliersScreen';

vi.mock('../api', () => ({ request: vi.fn() }));

const supplier = {
  id: 3,
  name: 'Green Wholesale',
  phone: '0912345678',
  contact_person: 'Mya Mya',
  address: 'Yangon',
  purchase_count: 1,
  total_purchase: 25000,
  balance: 12000,
  last_purchase: '2026-08-28',
};

beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  request.mockImplementation((path) => {
    if (path.startsWith('/suppliers?')) return Promise.resolve({
      items: [supplier],
      total: 1,
      account_summary: { total_suppliers: 4, payable_total: 12000, credit_total: 2500, open_accounts: 3 },
    });
    if (path.startsWith('/supplier-payments?')) {
      return Promise.resolve({
        items: [{ id: 5, created_at: '2026-08-29', direction: 'shop_to_supplier', payment_method: 'Cash', amount: 3000, note: 'Part payment' }],
        total: 75,
      });
    }
    if (path.startsWith('/suppliers/3?')) {
      return Promise.resolve({
        supplier,
        summary: { purchase_count: 75, total_purchase: 25000, credit_purchase_total: 12000, paid_total: 3000, refund_total: 0, balance: 12000 },
        purchases: [{ id: 8, created_at: '2026-08-28', total_cost: 25000, paid_amount: 13000, credit_amount: 12000, note: 'Credit stock' }],
        payments: [{ id: 5, created_at: '2026-08-29', direction: 'shop_to_supplier', payment_method: 'Cash', amount: 3000, note: 'Part payment' }],
        filtered_stats: { purchase_count: 75, total_purchase: 25000 },
      });
    }
    return Promise.resolve({ items: [], total: 0 });
  });
});

describe('SuppliersScreen layout', () => {
  it('keeps the loading state inside the table viewport', () => {
    const { container } = render(
      <NotificationProvider>
        <ConfirmationProvider><SuppliersScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    const panel = container.querySelector('.supplier-main-panel');
    const tableCard = container.querySelector('.supplier-table-card');
    const loadingState = screen.getByRole('status');

    expect(panel?.children).toHaveLength(3);
    expect(tableCard).toContainElement(loadingState);
    expect(screen.getByRole('table')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add Supplier/i }));
    expect(screen.getByRole('dialog', { name: 'Add Supplier' })).toBeInTheDocument();
    expect(screen.getByLabelText('Supplier Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
  });

  it('opens supplier details as a separate scrollable page and returns to the list', async () => {
    let backAction = null;
    const { container } = render(
      <NotificationProvider>
        <ConfirmationProvider><SuppliersScreen onDetailChange={(action) => { backAction = action; }} /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Green Wholesale');
    fireEvent.change(screen.getByLabelText('Search suppliers'), { target: { value: 'Green' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Green Wholesale' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /View supplier/i }));

    expect(await screen.findByText('Supplier profile')).toBeInTheDocument();
    expect(container.querySelector('.supplier-profile-name')).toHaveTextContent('Green Wholesale');
    expect(container.querySelector('.supplier-detail-page')).toBeInTheDocument();
    expect(container.querySelector('.supplier-detail-page-heading')).not.toBeInTheDocument();
    expect(container.querySelector('.supplier-detail-page-content')).toBeInTheDocument();
    expect(backAction?.label).toBe('Back to Suppliers');
    const purchaseHistoryTable = container.querySelector('.purchase-history-table');
    expect(purchaseHistoryTable).toBeInTheDocument();
    expect(within(purchaseHistoryTable).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Date', 'Supplier', 'Total', 'Paid', 'Credit', 'Status', 'Actions',
    ]);
    expect(within(purchaseHistoryTable).getByText('Green Wholesale')).toBeInTheDocument();
    expect(within(purchaseHistoryTable).getByText('completed')).toBeInTheDocument();
    expect(within(purchaseHistoryTable).getByRole('button', { name: 'Actions for purchase 8' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Supplier Detail' })).not.toBeInTheDocument();
    expect(screen.getAllByText('12,000 Ks').length).toBeGreaterThan(0);
    expect(container.querySelector('.supplier-profile-card')).toBeInTheDocument();
    expect(container.querySelectorAll('.supplier-stat-card')).toHaveLength(6);
    expect(within(container.querySelector('.supplier-profile-card')).getByText('Yangon')).toBeInTheDocument();
    expect(within(container.querySelector('.supplier-stat-row')).getByText('Current Balance')).toBeInTheDocument();
    expect(container.querySelector('.supplier-history-filter')).not.toBeInTheDocument();

    const supplierDetailRequests = request.mock.calls.filter(([path]) => path.startsWith('/suppliers/3?')).length;
    const supplierPaymentRequests = request.mock.calls.filter(([path]) => path.startsWith('/supplier-payments?')).length;
    act(() => emitDataChange(['*'], 'navigation', 'suppliers'));
    await waitFor(() => {
      expect(request.mock.calls.filter(([path]) => path.startsWith('/suppliers/3?')).length).toBeGreaterThan(supplierDetailRequests);
      expect(request.mock.calls.filter(([path]) => path.startsWith('/supplier-payments?')).length).toBeGreaterThan(supplierPaymentRequests);
    });

    const historySearch = screen.getByRole('textbox', { name: 'Search supplier purchases' });
    fireEvent.change(historySearch, { target: { value: 'invoice' } });
    const filterButton = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(filterButton);
    const filterDrawer = await screen.findByRole('dialog', { name: 'Purchase history filters' });
    expect(within(filterDrawer).queryByLabelText('Search purchases')).not.toBeInTheDocument();
    fireEvent.change(within(filterDrawer).getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.click(within(filterDrawer).getByRole('button', { name: 'Apply Filter' }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/suppliers/3?') && path.includes('purchase_q=invoice') && path.includes('date_from=2026-08-01'))).toBe(true));
    expect(screen.queryByRole('dialog', { name: 'Purchase history filters' })).not.toBeInTheDocument();
    expect(filterButton.querySelector('.filter-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/suppliers/3?') && path.includes('offset=50'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /Payment records/i }));
    expect(container.querySelector('.supplier-detail-page')).not.toBeVisible();
    expect(container.querySelector('.supplier-payments-page')).toBeInTheDocument();
    expect(within(container.querySelector('.supplier-payments-page .supplier-profile-card')).getByText('Payment records')).toBeInTheDocument();
    expect(within(container.querySelector('.supplier-payments-page .supplier-profile-card')).getByText('Current balance')).toBeInTheDocument();
    expect(within(container.querySelector('.supplier-payments-page .supplier-profile-card')).queryByText('Last purchase')).not.toBeInTheDocument();
    expect(container.querySelector('.supplier-payments-page-heading')).not.toBeInTheDocument();
    expect(backAction?.label).toBe('Back to Green Wholesale');
    expect(screen.queryByRole('button', { name: /Filters/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search supplier purchases' })).not.toBeInTheDocument();
    expect(container.querySelector('.supplier-payment-records-table')).toBeInTheDocument();
    expect(container.querySelector('.supplier-payments-page .supplier-profile-card')).toBeInTheDocument();
    expect(await screen.findByText('Part payment')).toBeInTheDocument();
    expect(container.querySelector('.supplier-payments-table-card')).toHaveClass('has-records');
    expect(screen.getByText('1-50 of 75')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/supplier-payments?') && path.includes('offset=50'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }));
    expect(screen.getByRole('dialog', { name: 'Record Supplier Payment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const requestsBeforeBack = request.mock.calls.length;
    act(() => backAction.onClick());
    await waitFor(() => expect(container.querySelector('.supplier-detail-page')).toBeVisible());
    expect(historySearch).toBe(screen.getByRole('textbox', { name: 'Search supplier purchases' }));
    expect(historySearch).toHaveValue('invoice');
    expect(container.querySelector('.supplier-payments-page')).not.toBeVisible();
    expect(backAction?.label).toBe('Back to Suppliers');
    act(() => backAction.onClick());
    await waitFor(() => expect(backAction).toBeNull());
    expect(request.mock.calls.length).toBe(requestsBeforeBack);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByLabelText('Search suppliers')).toHaveValue('Green');
    expect(backAction).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Green Wholesale' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Payments' }));
    expect(await screen.findByRole('region', { name: 'Supplier payment records' })).toBeInTheDocument();
    expect(container.querySelector('.supplier-payments-page')).toBeInTheDocument();
    expect(backAction?.label).toBe('Back to Suppliers');
  });

  it('shows account stats and applies supplier filters from the drawer', async () => {
    render(
      <NotificationProvider>
        <ConfirmationProvider><SuppliersScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Green Wholesale');
    const stats = screen.getByLabelText('Supplier account statistics');
    expect(within(stats).getByText('Total Suppliers').nextSibling).toHaveTextContent('4');
    expect(within(stats).getByText('Supplier Payable').nextSibling).toHaveTextContent('12,000 Ks');
    expect(within(stats).getByText('Supplier Credit').nextSibling).toHaveTextContent('2,500 Ks');
    expect(within(stats).getByText('Open Accounts').nextSibling).toHaveTextContent('3');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const drawer = await screen.findByRole('dialog', { name: 'Supplier filters' });
    fireEvent.change(within(drawer).getByLabelText('Account status'), { target: { value: 'payable' } });
    fireEvent.change(within(drawer).getByLabelText('Purchase activity'), { target: { value: 'with_purchases' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Apply Filter' }));

    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/suppliers?') && path.includes('account_status=payable') && path.includes('purchase_activity=with_purchases'))).toBe(true));
    expect(screen.getByRole('button', { name: /Filters/ }).querySelector('.filter-count')).toHaveTextContent('2');
  });

  it('records a supplier payment directly from the supplier row menu', async () => {
    const { container } = render(
      <NotificationProvider>
        <ConfirmationProvider><SuppliersScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Green Wholesale');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Green Wholesale' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Record payment' }));

    const dialog = screen.getByRole('dialog', { name: 'Record Supplier Payment' });
    expect(within(dialog).getByText(/Green Wholesale/)).toBeInTheDocument();
    expect(container.querySelector('.supplier-payments-page')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '2400' } });
    fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: 'Direct row payment' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/suppliers/3/payments', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Direct row payment'),
    })));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Record Supplier Payment' })).not.toBeInTheDocument());
    expect(container.querySelector('.supplier-main-panel')).toBeInTheDocument();
  });

  it('creates, updates, and deletes supplier payment records from the standalone page', async () => {
    const { container } = render(
      <NotificationProvider>
        <ConfirmationProvider><SuppliersScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Green Wholesale');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Green Wholesale' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Payments' }));
    expect(await screen.findByText('Part payment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }));
    const createDialog = screen.getByRole('dialog', { name: 'Record Supplier Payment' });
    fireEvent.change(within(createDialog).getByLabelText('Amount'), { target: { value: '4500' } });
    fireEvent.change(within(createDialog).getByLabelText('Note'), { target: { value: 'Monthly settlement' } });
    fireEvent.click(within(createDialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/suppliers/3/payments', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Monthly settlement'),
    })));

    await screen.findByText('Part payment');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for payment 5' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit payment' }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit Supplier Payment' });
    expect(within(editDialog).getByLabelText('Amount')).toHaveValue(3000);
    fireEvent.change(within(editDialog).getByLabelText('Amount'), { target: { value: '3500' } });
    fireEvent.change(within(editDialog).getByLabelText('Note'), { target: { value: 'Corrected payment' } });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Update payment' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/supplier-payments/5', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('Corrected payment'),
    })));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Supplier Payment' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Actions for payment 5' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete payment' }));
    const deleteDialog = await screen.findByRole('dialog', { name: 'Delete supplier payment' });
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Delete Payment' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/supplier-payments/5', { method: 'DELETE' }));

    expect(container.querySelector('.supplier-payment-records-table')).toBeInTheDocument();
  });
});
