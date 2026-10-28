import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { SalesHistoryScreen } from './SalesHistoryScreen';
import { TransactionsScreen } from './TransactionsScreen';

vi.mock('../api', () => ({ request: vi.fn() }));

function renderScreen(screenComponent) {
  return render(
    <NotificationProvider>
      <ConfirmationProvider>{screenComponent}</ConfirmationProvider>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path) => {
    if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash,Wallet Pay,Credit' });
    if (path.startsWith('/customer-payments?')) return Promise.resolve({
      items: [{ id: 11, customer_id: 2, created_at: '2026-09-20 10:00:00', customer_name: 'Customer One', direction: 'customer_to_shop', payment_method: 'Cash', amount: 5000, note: 'Account payment' }],
      total: 1,
    });
    if (path.startsWith('/supplier-payments?')) return Promise.resolve({
      items: [{ id: 12, supplier_id: 3, created_at: '2026-09-20 11:00:00', supplier_name: 'Supplier One', direction: 'shop_to_supplier', payment_method: 'Cash', amount: 2500, note: 'Supplier payment' }],
      total: 1,
    });
    if (path.startsWith('/sales?')) return Promise.resolve({
      items: [{ id: 7, created_at: '2026-09-20 09:00:00', receipt_no: 'R260920-0007', customer_name: 'Customer One', payment_type: 'cash', payment_method: 'Cash', total: 7500, paid_amount: 7500, credit_amount: 0 }],
      total: 1,
    });
    if (path === '/sales/7') return Promise.resolve({
      id: 7, created_at: '2026-09-20 09:00:00', receipt_no: 'R260920-0007', customer_id: 2, customer_name: 'Customer One', payment_type: 'cash', payment_method: 'Cash', status: 'completed', subtotal: 7500, discount: 0, total: 7500, paid_amount: 7500, credit_amount: 0,
      items: [{ id: 71, product_id: 3, product_name: 'Tea', unit_name: 'Piece', price_type: 'Retail', quantity: 1, foc_quantity: 0, unit_price: 7500, unit_cost: 5000, line_total: 7500 }],
    });
    if (path === '/sales/7/receipt') return Promise.resolve({ text: 'Receipt R260920-0007', html: '<strong>Receipt R260920-0007</strong>', paper_size: '80mm' });
    if (path === '/sales/7/print') return Promise.resolve({ ok: true, message: 'Receipt print requested.' });
    if (path.startsWith('/products?')) return Promise.resolve({
      items: [{ id: 9, name: 'Coffee', base_unit: 'Bag', price: 2500, prices: [{ name: 'Retail', price: 2500 }] }],
      total: 1,
    });
    return Promise.resolve({ items: [], total: 0 });
  });
});

describe('transaction workspace separation', () => {
  it('hides Edit in an online sale detail modal and keeps Reprint', async () => {
    const defaultApi = request.getMockImplementation();
    request.mockImplementation(async (path, options) => {
      const response = await defaultApi(path, options);
      return path === '/sales/7' ? { ...response, source: 'ecommerce' } : response;
    });
    renderScreen(<SalesHistoryScreen />);
    await screen.findByText('R260920-0007');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260920-0007' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transaction Detail' });
    expect(within(dialog).queryByRole('button', { name: 'Edit Sale' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Reprint' })).toBeInTheDocument();
  });

  it('marks online sales, hides Edit, and requests the selected sale channel', async () => {
    const defaultApi = request.getMockImplementation();
    request.mockImplementation((path, options) => path.startsWith('/sales?')
      ? Promise.resolve({ items: [{ id: 8, receipt_no: 'WEB-8', source: 'ecommerce', status: 'completed', payment_type: 'cash', total: 1000 }], total: 1 })
      : defaultApi(path, options));
    renderScreen(<SalesHistoryScreen />);
    expect(await screen.findByText('Online', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale WEB-8' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit sale WEB-8' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Print receipt WEB-8' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText('Sale channel'), { target: { value: 'online' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('sale_channel=online') && path.includes('offset=0'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText('Sale channel'), { target: { value: 'pos' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('sale_channel=pos'))).toBe(true));
    await waitFor(() => expect(screen.queryByText('WEB-8')).not.toBeInTheDocument());
  });

  it('keeps only customer and supplier payment tabs on Transactions', async () => {
    renderScreen(<TransactionsScreen />);

    expect(await screen.findByText('Account payment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customer Payments/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Supplier Payments/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sales/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Purchases/ })).not.toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.startsWith('/purchases?'))).toBe(false);
    expect(request.mock.calls.some(([path]) => path.startsWith('/sales?'))).toBe(false);
  });

  it('keeps the payment person fixed and uses the detail-page payment form layout', async () => {
    renderScreen(<TransactionsScreen />);

    await screen.findByText('Account payment');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for payment 11' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit payment 11' }));
    let dialog = await screen.findByRole('dialog', { name: 'Edit Customer Payment' });
    expect(within(dialog).getByText('Customer One')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Customer')).not.toBeInTheDocument();
    expect(within(dialog).queryByPlaceholderText(/Search customer/i)).not.toBeInTheDocument();
    expect(dialog.querySelector('form')).toHaveClass('supplier-payment-modal-form');
    expect(dialog.querySelector('.supplier-payment-modal-grid')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Direction')).toHaveValue('customer_to_shop');
    expect(within(dialog).getByLabelText('Amount')).toHaveValue(5000);
    expect(within(dialog).getByLabelText('Payment Method')).toHaveValue('Cash');
    expect(within(dialog).getByLabelText('Note').tagName).toBe('TEXTAREA');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update Payment' }));
    await waitFor(() => expect(request.mock.calls.some(([path, options]) => path === '/customer-payments/11' && options?.method === 'PUT')).toBe(true));
    const customerUpdate = request.mock.calls.find(([path, options]) => path === '/customer-payments/11' && options?.method === 'PUT');
    expect(JSON.parse(customerUpdate[1].body).customer_id).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /Supplier Payments/ }));
    await screen.findByText('Supplier payment');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for supplier payment 12' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit supplier payment 12' }));
    dialog = await screen.findByRole('dialog', { name: 'Edit Supplier Payment' });
    expect(within(dialog).getByText('Supplier One')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Supplier')).not.toBeInTheDocument();
    expect(within(dialog).queryByPlaceholderText(/Search supplier/i)).not.toBeInTheDocument();
    expect(dialog.querySelector('form')).toHaveClass('supplier-payment-modal-form');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update Payment' }));
    await waitFor(() => expect(request.mock.calls.some(([path, options]) => path === '/supplier-payments/12' && options?.method === 'PUT')).toBe(true));
    const supplierUpdate = request.mock.calls.find(([path, options]) => path === '/supplier-payments/12' && options?.method === 'PUT');
    expect(JSON.parse(supplierUpdate[1].body).supplier_id).toBe(3);
  });

  it('renders sales history as its own page without transaction tabs', async () => {
    const { container } = renderScreen(<SalesHistoryScreen />);

    expect(await screen.findByText('R260920-0007')).toBeInTheDocument();
    expect(container.querySelector('.transaction-table-sales')).toBeInTheDocument();
    expect(container.querySelector('.transaction-tabs')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search sales' })).toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.startsWith('/sales?'))).toBe(true);
    expect(request.mock.calls.some(([path]) => path.startsWith('/customer-payments?'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260920-0007' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    const detailDialog = await screen.findByRole('dialog', { name: 'Transaction Detail' });
    const footer = detailDialog.querySelector('.mkpos-modal-footer');
    expect(within(footer).getByRole('button', { name: 'Reprint' })).toBeInTheDocument();
    expect(within(footer).getByRole('button', { name: 'Edit Sale' })).toBeInTheDocument();
    expect(within(footer).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(detailDialog.querySelector('.transaction-detail > .sale-receipt-actions')).not.toBeInTheDocument();

    fireEvent.click(within(footer).getByRole('button', { name: 'Edit Sale' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit Sale' });
    await waitFor(() => expect(editDialog).toHaveFocus());
    expect(within(editDialog).getByPlaceholderText('No customer or search name/phone')).not.toHaveFocus();
    const editFooter = editDialog.querySelector('.mkpos-modal-footer');
    expect(within(editFooter).getByLabelText('Sale totals summary')).toBeInTheDocument();
    expect(within(editFooter).getByText('Subtotal')).toBeInTheDocument();
    expect(within(editFooter).getByText('Total')).toBeInTheDocument();
    expect(within(editFooter).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(editFooter).getByRole('button', { name: 'Update Sale' })).toBeInTheDocument();
    expect(editDialog.querySelector('.mkpos-modal-body .transaction-edit-footer')).not.toBeInTheDocument();

    const basicSection = editDialog.querySelector('.transaction-sale-basic-section');
    const paymentGrid = basicSection.querySelector('.transaction-sale-payment-grid');
    expect(basicSection.firstElementChild).toHaveTextContent('Customer');
    expect(Array.from(paymentGrid.children).map((field) => field.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('Payment Status'),
      expect.stringContaining('Payment Method'),
      expect.stringContaining('Discount'),
      expect.stringContaining('Paid Amount'),
    ]));
    expect(paymentGrid.children).toHaveLength(4);

    const editTable = within(editDialog).getByRole('table');
    expect(Array.from(editTable.querySelectorAll('.sale-edit-column-heading th')).map((cell) => cell.textContent)).toEqual(['Product', 'Unit', 'Type', 'Paid Qty', 'FOC Qty', 'Unit Price', 'Total', '']);
    expect(within(editDialog).queryByPlaceholderText('Search product to add')).not.toBeInTheDocument();
    fireEvent.click(within(editTable).getByRole('button', { name: 'Add new item' }));
    const productSearch = await within(editTable).findByPlaceholderText('Search product to add');
    expect(productSearch).toHaveFocus();
    fireEvent.change(productSearch, { target: { value: 'Coffee' } });
    fireEvent.click(await within(editTable).findByRole('option', { name: 'Coffee' }));
    expect(within(editTable).queryByPlaceholderText('Search product to add')).not.toBeInTheDocument();
    const coffeeRow = within(editTable).getByText('Coffee').closest('tr');
    expect(coffeeRow).toBe(editTable.querySelector('tbody tr:first-child'));
    expect(coffeeRow.children[0]).toHaveTextContent('Coffee');
    expect(coffeeRow.children[1]).toHaveTextContent('Bag');
    expect(coffeeRow.children[2].querySelector('select')).toHaveValue('Retail');
    expect(coffeeRow.children[3].querySelector('input')).toHaveValue(1);
    expect(coffeeRow.children[4].querySelector('input')).toHaveValue(0);
    expect(coffeeRow.children[5].querySelector('input')).toHaveValue(2500);
    const teaRow = within(editTable).getByText('Tea').closest('tr');
    expect(teaRow.children[1]).toHaveTextContent('Piece');
    const focInput = teaRow.children[4].querySelector('input');
    fireEvent.change(focInput, { target: { value: '' } });
    expect(focInput).toHaveValue(null);
    fireEvent.click(within(editFooter).getByRole('button', { name: 'Update Sale' }));
    await waitFor(() => expect(request.mock.calls.some(([path, options]) => path === '/sales/7' && options?.method === 'PUT')).toBe(true));
    const updateCall = request.mock.calls.find(([path, options]) => path === '/sales/7' && options?.method === 'PUT');
    const updatedItems = JSON.parse(updateCall[1].body).items;
    expect(updatedItems.find((item) => item.product_id === 3).foc_quantity).toBe(0);
    expect(updatedItems.find((item) => item.product_id === 9)).toMatchObject({ quantity: 1, foc_quantity: 0, unit_price: 2500 });
  });

  it('keeps the receipt print action in the preview footer without a close button', async () => {
    renderScreen(<SalesHistoryScreen />);

    expect(await screen.findByText('R260920-0007')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for sale R260920-0007' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    const detailDialog = await screen.findByRole('dialog', { name: 'Transaction Detail' });
    fireEvent.click(within(detailDialog.querySelector('.mkpos-modal-footer')).getByRole('button', { name: 'Reprint' }));

    const previewDialog = await screen.findByRole('dialog', { name: 'Receipt Preview' });
    const previewFooter = previewDialog.querySelector('.mkpos-modal-footer');
    expect(within(previewFooter).getByRole('button', { name: 'Browser Print' })).toBeInTheDocument();
    expect(within(previewFooter).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(previewDialog.querySelector('.sale-receipt-actions')).not.toBeInTheDocument();
    expect(within(previewDialog).getByRole('button', { name: 'Close Receipt Preview' })).toBeInTheDocument();
  });
});
