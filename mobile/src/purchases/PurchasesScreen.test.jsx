import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { PurchasesScreen } from './PurchasesScreen';
import { RetainedViews } from '../navigation/RetainedViews';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

const product = {
  id: 4, name: 'Drinking Water', sku: 'WATER-1', category: 'Drinks', stock: 12,
  base_unit: 'Bottle', purchase_unit: 'Carton', purchase_conversion_factor: 24,
  cost: 800, price: 1200, prices: [{ name: 'Retail', price: 1200, is_manual: true }],
};

const purchase = {
  id: 7, supplier_id: 2, supplier_name: 'MM Supplier', note: 'Weekly stock', total_cost: 19200,
  status: 'completed', created_at: '2026-08-07 10:00:00',
  items: [{ id: 20, product_id: 4, product_name: 'Drinking Water', unit_name: 'Carton', conversion_factor: 24, quantity: 1, foc_quantity: 0, base_quantity: 24, base_foc_quantity: 0, unit_cost: 19200, effective_unit_cost: 800, line_total: 19200 }],
};
let adminPinSet = '1';

function RetainedPurchases() {
  const [path, setPath] = useState('/purchases');
  return <RetainedViews activeKey={path}><PurchasesScreen pathname={path} onNavigate={setPath} /></RetainedViews>;
}

function purchaseApi(path, options = {}) {
  if (path.startsWith('/purchases?')) return Promise.resolve({ items: [purchase], total: 1 });
  if (path === '/settings') return Promise.resolve({ admin_pin_set: adminPinSet });
  if (path === '/purchases/7' && !options.method) return Promise.resolve(purchase);
  if (path === '/products/4') return Promise.resolve(product);
  if (path.startsWith('/products?')) return Promise.resolve({ items: [product], total: 1 });
  if (path === '/categories') return Promise.resolve(['Drinks']);
  if (path.startsWith('/suppliers?')) return Promise.resolve({ items: [{ id: 2, name: 'MM Supplier' }], total: 1 });
  if (path === '/purchases' && options.method === 'POST') return Promise.resolve({ ...purchase, price_changes: [] });
  if (path === '/purchases/7' && options.method === 'PUT') return Promise.resolve({ ...purchase, price_changes: [] });
  if (path === '/purchases/7' && options.method === 'DELETE') return Promise.resolve({ id: 7, deleted: true });
  return Promise.resolve({});
}

beforeEach(() => {
  adminPinSet = '1';
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: vi.fn() });
  apiRequest.mockReset();
  apiRequest.mockImplementation(purchaseApi);
});

describe('mobile purchases workspace', () => {
  it('clears the retained create form after success and submits the next purchase with fresh defaults', async () => {
    render(<RetainedPurchases />);
    fireEvent.click(await screen.findByRole('button', { name: 'New purchase', exact: true }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'First purchase note' } });
    fireEvent.change(screen.getByLabelText('Reference number'), { target: { value: 'FIRST-INVOICE' } });
    fireEvent.focus(screen.getByRole('textbox', { name: 'Supplier', exact: true }));
    const picker = await screen.findByRole('dialog', { name: 'Select supplier' });
    fireEvent.click(await within(picker).findByRole('radio', { name: 'MM Supplier' }));
    fireEvent.click(within(picker).getByRole('button', { name: 'Use supplier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search purchase products' }), { target: { value: 'Water' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Select Drinking Water' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('FOC for Drinking Water'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'KPay' } });
    fireEvent.change(screen.getByLabelText('Paid now'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
    await screen.findByRole('heading', { name: 'Purchases' });
    fireEvent.click(screen.getByRole('button', { name: 'New purchase', exact: true }));
    expect(screen.getByRole('button', { name: 'Basic information' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText('Note')).toHaveValue('');
    expect(screen.getByLabelText('Reference number')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Supplier', exact: true })).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('textbox', { name: 'Search purchase products' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Select Drinking Water' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Select Drinking Water' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('FOC for Drinking Water')).toHaveValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Payment method')).toHaveValue('Cash');
    fireEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
    await screen.findByRole('heading', { name: 'Purchases' });
    const posts = apiRequest.mock.calls.filter(([path, options]) => path === '/purchases' && options?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[1][1].body)).toMatchObject({ reference_no: null, supplier_id: null, supplier_name: '', note: '', payment_method: 'Cash', paid_amount: 19200, items: [{ quantity: 1, foc_quantity: 0 }] });
  });

  it('keeps purchase data and the review step when submission fails', async () => {
    apiRequest.mockImplementation((path, options) => path === '/purchases' && options?.method === 'POST' ? Promise.reject(new Error('Purchase save failed')) : purchaseApi(path, options));
    render(<PurchasesScreen pathname="/purchases/new" onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Retry this purchase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Drinking Water' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('FOC for Drinking Water'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
    await screen.findByText('Purchase save failed');
    expect(screen.getByRole('heading', { name: 'Review and submit' })).toBeInTheDocument();
    expect(screen.getByText('Retry this purchase')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByLabelText('FOC for Drinking Water')).toHaveValue(2);
  });

  it('clears a submitted invoice-draft reference without changing other navigation state', async () => {
    const originalState = window.history.state;
    const draftId = '11111111-1111-4111-8111-111111111111';
    window.history.replaceState({ mkposHistoryIndex: 18, aiPurchaseDraftIndex: 18, aiPurchaseDraftId: draftId, sourceMarker: 'preserve' }, '', window.location.href);
    apiRequest.mockImplementation((path, options) => path === `/ai-assistant/purchase-drafts/${draftId}`
      ? Promise.resolve({ form: { supplier_name: '', note: 'Imported invoice', items: [{ product, unit_name: 'Carton', quantity: 1, foc_quantity: 0, unit_cost: 19200 }] } }) : purchaseApi(path, options));
    try {
      render(<PurchasesScreen pathname="/purchases/new" onNavigate={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText('Note')).toHaveValue('Imported invoice'));
      for (let step = 1; step < 4; step++) fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
      await waitFor(() => expect(screen.getByLabelText('Note')).toHaveValue(''));
      expect(window.history.state).toEqual({ mkposHistoryIndex: 18, sourceMarker: 'preserve' });
    } finally { window.history.replaceState(originalState, '', window.location.href); }
  });
  it('shows current supplier debt rather than original credit, independently of loaded history', async () => {
    apiRequest.mockImplementation((path, options) => path.startsWith('/purchases?')
      ? Promise.resolve({ items: [{ ...purchase, credit_amount: 16000 }], total: 40, current_payable_total: 2500 })
      : purchaseApi(path, options));
    render(<PurchasesScreen />);
    const card = (await screen.findByText('Current unpaid balance')).parentElement;
    await waitFor(() => expect(card).toHaveTextContent('2,500 Ks'));
    expect(card).toHaveTextContent('All suppliers / all dates');
    expect(card).not.toHaveTextContent('16,000');
    expect(screen.getByText('Loaded purchase amount')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more', exact: true }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('offset=1'))).toBe(true));
    expect(card).toHaveTextContent('2,500 Ks');
  });

  it('shows zero after settlement and never falls back to historical credit on old servers', async () => {
    apiRequest.mockImplementation((path, options) => path.startsWith('/purchases?')
      ? Promise.resolve({ items: [{ ...purchase, credit_amount: 16000 }], total: 1, current_payable_total: 0 })
      : purchaseApi(path, options));
    const view = render(<PurchasesScreen />);
    await waitFor(() => expect(screen.getByText('Current unpaid balance').parentElement).toHaveTextContent('0 Ks'));
    view.unmount();
    apiRequest.mockImplementation(purchaseApi);
    render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');
    expect(screen.getByText('Current unpaid balance').parentElement.querySelector('strong')).toHaveTextContent('\u2014');
  });

  it('requires below-cost confirmation and saves without changing manual selling prices', async () => {
    render(<PurchasesScreen pathname="/purchases/new" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Drinking Water' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    fireEvent.change(screen.getByLabelText('Cost for Drinking Water'), { target: { value: '48000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save purchase', exact: true }));
    await screen.findByRole('dialog', { name: 'Review selling prices' });
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway', exact: true }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/purchases', expect.objectContaining({ method: 'POST' })));
    expect(product.prices[0].price).toBe(1200);
  });
  it('keeps supplier choice pending until Use supplier and supports cancellation', async () => {
    render(<PurchasesScreen pathname="/purchases/new" />);
    const input = screen.getByRole('textbox', { name: 'Supplier', exact: true });
    fireEvent.focus(input);
    fireEvent.click(await screen.findByRole('radio', { name: 'MM Supplier', exact: true }));
    expect(input).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Use supplier', exact: true }));
    expect(screen.getByRole('button', { name: 'Change supplier', exact: true })).toHaveTextContent('MM Supplier');
    fireEvent.click(screen.getByRole('button', { name: 'Change supplier', exact: true }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Select supplier' })).getByRole('button', { name: 'Cancel', exact: true }));
    expect(screen.getByRole('button', { name: 'Change supplier', exact: true })).toHaveTextContent('MM Supplier');
  });

  it('does not apply date or payment drafts until Apply', async () => {
    render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today', exact: true }));
    fireEvent.click(screen.getByRole('radio', { name: 'Part paid', exact: true }));
    expect(apiRequest.mock.calls.some(([path]) => path.includes('payment_status=partial'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Apply filters/ }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('payment_status=partial') && path.includes('date_from='))).toBe(true));
  });
  it('preserves purchase selections and drafts through Previous and completed-step navigation without refetching', async () => {
    render(<PurchasesScreen pathname="/purchases/new" onNavigate={vi.fn()} />);
    const page = await screen.findByRole('heading', { name: 'New purchase' });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Retained purchase note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: 'Select Drinking Water' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search purchase products' }), { target: { value: 'Water' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Water'))).toBe(true));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Drinking Water' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('FOC for Drinking Water'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByLabelText('FOC for Drinking Water')).toHaveValue(2);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('textbox', { name: 'Search purchase products' })).toHaveValue('Water');
    expect(screen.getByRole('button', { name: 'Deselect Drinking Water' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Basic information', exact: true }));
    expect(screen.getByLabelText('Note')).toHaveValue('Retained purchase note');
    expect(screen.getByRole('heading', { name: 'New purchase' })).toBe(page);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('renders purchase history as an endless card list', async () => {
    render(<PurchasesScreen />);

    expect(await screen.findByText('MM Supplier')).toBeInTheDocument();
    expect(screen.getAllByText('19,200 Ks').length).toBeGreaterThan(0);
    expect(screen.getByText('1 records')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for purchase 7' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/purchases?') && path.includes('with_total=true'))).toBe(true);
  });

  it('uses the product-page filter layout and applies purchase filters', async () => {
    const { container } = render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');

    const toggle = screen.getByRole('button', { name: 'Filters' });
    expect(toggle).toHaveClass('product-toolbar-toggle');
    const toolbar = container.querySelector('.purchase-control-row');
    expect(toolbar).toContainElement(toggle);
    expect(screen.getByRole('button', { name: 'Export CSV' }).closest('header')).toBeInTheDocument();
    fireEvent.click(toggle);

    const panel = container.querySelector('.purchase-filter-panel');
    expect(panel).toHaveClass('product-filter-panel');
    expect(panel.querySelectorAll('.product-filter-field')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 'MM Supplier' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters (2)' }));

    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('supplier=MM+Supplier') && path.includes('date_from=2026-08-01'))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Apply filters (2)' })).not.toBeInTheDocument();
  });

  it('opens the native date picker from the whole outlined date field', async () => {
    render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const fromInput = screen.getByLabelText('From');
    fireEvent.click(fromInput.closest('label'));

    expect(HTMLInputElement.prototype.showPicker).toHaveBeenCalledTimes(1);
    expect(fromInput).toHaveFocus();
  });

  it('creates a purchase on a dedicated full page', async () => {
    render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');
    fireEvent.click(screen.getByRole('button', { name: 'New purchase' }));

    expect(screen.getByRole('heading', { name: 'New purchase' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const progress = screen.getByRole('navigation', { name: 'Purchase form progress' });
    expect(progress).toHaveClass('purchase-wizard-progress');
    expect(screen.getByRole('button', { name: 'Basic information' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Select products' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Basic information' })).toHaveClass('completed');
    expect(screen.getByRole('button', { name: 'Select products' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Select products' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('heading', { name: 'Product selection' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Select Drinking Water' }));
    expect(screen.getByRole('button', { name: 'Deselect Drinking Water' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Drinking Water selected.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Quantity define' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Drinking Water' })).toBeInTheDocument();
    const focInput = screen.getByLabelText('FOC for Drinking Water');
    fireEvent.change(focInput, { target: { value: '' } });
    expect(focInput).toHaveValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Review and submit' })).toBeInTheDocument();
    expect(screen.getByText('Received 24 bottles')).toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path, options]) => path === '/purchases' && options?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save purchase' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/purchases', expect.objectContaining({ method: 'POST' })));
    const createCall = apiRequest.mock.calls.find(([path, options]) => path === '/purchases' && options?.method === 'POST');
    expect(JSON.parse(createCall[1].body).items[0].foc_quantity).toBe(0);
    expect(await screen.findByRole('heading', { name: 'Purchases' })).toBeInTheDocument();
  });

  it('deep-links to detail and edit pages', async () => {
    const navigate = vi.fn();
    const { rerender } = render(<PurchasesScreen pathname="/purchases/7" onNavigate={navigate} />);
    expect(await screen.findByRole('heading', { name: 'PUR0007' })).toBeInTheDocument();
    expect(screen.getByText('Weekly stock')).toBeInTheDocument();

    rerender(<PurchasesScreen pathname="/purchases/7/edit" onNavigate={navigate} />);
    expect(await screen.findByRole('heading', { name: 'Edit purchase' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/products/4', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('reloads purchase detail after the development Strict Mode effect replay', async () => {
    render(<React.StrictMode><PurchasesScreen pathname="/purchases/7" onNavigate={vi.fn()} /></React.StrictMode>);

    expect(await screen.findByRole('heading', { name: 'PUR0007' })).toBeInTheDocument();
    expect(apiRequest.mock.calls.filter(([path]) => path === '/purchases/7')).toHaveLength(2);
  });

  it('requires an admin PIN when deleting a purchase', async () => {
    render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for purchase 7' }));
    expect(screen.getByRole('dialog', { name: 'Purchase actions' })).toHaveClass('mobile-sheet--action-menu');
    expect(document.querySelector('.mobile-action-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.change(screen.getByLabelText('Admin PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete purchase' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/purchases/7', { method: 'DELETE', body: JSON.stringify({ admin_pin: '1234' }) }));
  });

  it('deletes without showing a PIN field when protection is not configured', async () => {
    adminPinSet = '0';
    render(<PurchasesScreen />);
    await screen.findByText('MM Supplier');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for purchase 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await screen.findByRole('button', { name: 'Delete purchase' });
    expect(screen.queryByLabelText('Admin PIN')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete purchase' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/purchases/7', { method: 'DELETE' }));
  });
});
