import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { NewPurchaseScreen } from './NewPurchaseScreen';

function jsonResponse(payload) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
}

function renderNewPurchase(props = {}) {
  return render(
    <NotificationProvider>
      <ConfirmationProvider><NewPurchaseScreen requestKey={1} {...props} /></ConfirmationProvider>
    </NotificationProvider>,
  );
}

describe('NewPurchaseScreen', () => {
  it('is a standalone four-step purchase wizard', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/categories')) return jsonResponse(['Devices']);
      if (String(url).includes('/products?')) {
        return jsonResponse([{
          id: 7,
          name: 'Desk Phone',
          category: 'Devices',
          stock: 4,
          cost: 10000,
          base_unit: 'Unit',
          prices: [{ name: 'Retail', price: 15000 }],
        }]);
      }
      return jsonResponse({ items: [] });
    });

    const { container } = renderNewPurchase();
    expect(screen.getByRole('navigation', { name: 'Purchase form progress' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Basic information' })).toBeInTheDocument();
    expect(container.querySelector('.purchase-history-card')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Purchase History' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByRole('region', { name: 'Product selection' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select Desk Phone' })).toBeInTheDocument());
    const productRequestCount = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/products?')).length;
    fireEvent.change(screen.getByPlaceholderText('Search name, SKU, barcode, or category'), { target: { value: 'Desk' } });
    expect(screen.getByRole('checkbox', { name: 'Select Desk Phone' })).toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/products?'))).toHaveLength(productRequestCount);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Desk Phone' }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByRole('region', { name: 'Quantity form' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByRole('region', { name: 'Review and submit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Purchase/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Purchase review summary')).toHaveClass('purchase-wizard-totals', 'purchase-review-total');
    expect(screen.getByLabelText('Purchase review summary').previousElementSibling).toHaveClass('purchase-review-scroll');
  });

  it('loads more products when the modal product list reaches its scroll boundary', async () => {
    const products = Array.from({ length: 21 }, (_, index) => ({
      id: index + 1,
      name: `Product ${index + 1}`,
      category: 'Devices',
      stock: 4,
      cost: 10000,
      base_unit: 'Unit',
      prices: [{ name: 'Retail', price: 15000 }],
    }));
    globalThis.fetch = vi.fn((url) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      if (requestUrl.pathname.endsWith('/categories')) return jsonResponse(['Devices']);
      if (requestUrl.pathname.endsWith('/products')) {
        const offset = Number(requestUrl.searchParams.get('offset') || 0);
        const limit = Number(requestUrl.searchParams.get('limit') || 20);
        return jsonResponse({ items: products.slice(offset, offset + limit), total: products.length });
      }
      return jsonResponse({ items: [] });
    });

    const { container } = renderNewPurchase({ modal: true });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(await screen.findByRole('checkbox', { name: 'Select Product 1' })).toBeInTheDocument();

    const picker = container.querySelector('.purchase-product-picker');
    Object.defineProperties(picker, {
      scrollHeight: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 240 },
      scrollTop: { configurable: true, value: 350 },
    });
    fireEvent.scroll(picker);

    expect(await screen.findByRole('checkbox', { name: 'Select Product 21' })).toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('offset=20'))).toBe(true);
  });

  it('selects every product matching the current search and category, including unloaded pages', async () => {
    const products = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `Product ${index + 1}`,
      category: 'Devices',
      stock: 4,
      cost: 10000,
      base_unit: 'Unit',
      prices: [],
    }));
    globalThis.fetch = vi.fn((url) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      if (requestUrl.pathname.endsWith('/categories')) return jsonResponse(['Devices']);
      if (requestUrl.pathname.endsWith('/products')) {
        const offset = Number(requestUrl.searchParams.get('offset') || 0);
        const limit = Number(requestUrl.searchParams.get('limit') || 20);
        return jsonResponse({ items: products.slice(offset, offset + limit), total: products.length });
      }
      return jsonResponse({ items: [] });
    });

    renderNewPurchase({ modal: true });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('checkbox', { name: 'Select Product 1' });
    fireEvent.change(screen.getByPlaceholderText('Search name, SKU, barcode, or category'), { target: { value: 'Product' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Devices' } });

    const selectAll = screen.getByRole('checkbox', { name: 'Select all matching products' });
    await waitFor(() => expect(selectAll).not.toBeDisabled());
    fireEvent.click(selectAll);

    expect(await screen.findByRole('checkbox', { name: 'Select Product 25' })).toBeChecked();
    await waitFor(() => expect(selectAll).toBeChecked());
    expect(globalThis.fetch.mock.calls.some(([url]) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      return requestUrl.pathname.endsWith('/products')
        && requestUrl.searchParams.get('q') === 'Product'
        && requestUrl.searchParams.get('category') === 'Devices'
        && requestUrl.searchParams.get('limit') === '500';
    })).toBe(true);
  });

  it('shows only products selected in step 2 on the step 3 quantity table', async () => {
    const products = [
      { id: 1, name: 'Selected Product', category: 'Devices', stock: 4, cost: 10000, base_unit: 'Unit', prices: [] },
      { id: 2, name: 'Unselected Product', category: 'Devices', stock: 8, cost: 12000, base_unit: 'Unit', prices: [] },
    ];
    globalThis.fetch = vi.fn((url) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      if (requestUrl.pathname.endsWith('/categories')) return jsonResponse(['Devices']);
      if (requestUrl.pathname.endsWith('/products')) return jsonResponse({ items: products, total: products.length });
      return jsonResponse({ items: [] });
    });

    renderNewPurchase({ modal: true });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Selected Product' }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    const quantityStep = screen.getByRole('region', { name: 'Quantity form' });
    expect(within(quantityStep).getByText('Selected Product')).toBeInTheDocument();
    expect(within(quantityStep).queryByText('Unselected Product')).not.toBeInTheDocument();
    const quantity = within(quantityStep).getByRole('spinbutton', { name: 'Selected Product paid quantity' });
    fireEvent.change(quantity, { target: { value: '3' } });
    const requests = globalThis.fetch.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Previous', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Select Selected Product' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Unselected Product' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Previous', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Select Selected Product' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    expect(screen.getByRole('spinbutton', { name: 'Selected Product paid quantity' })).toHaveValue(3);
    expect(globalThis.fetch.mock.calls.length).toBe(requests);
  });

  it('toggles product selection from the whole row with mouse or keyboard', async () => {
    const product = { id: 1, name: 'Row Select Product', category: 'Devices', stock: 4, cost: 10000, base_unit: 'Unit', prices: [] };
    globalThis.fetch = vi.fn((url) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      if (requestUrl.pathname.endsWith('/categories')) return jsonResponse(['Devices']);
      if (requestUrl.pathname.endsWith('/products')) return jsonResponse({ items: [product], total: 1 });
      return jsonResponse({ items: [] });
    });

    renderNewPurchase({ modal: true });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    const productRow = await screen.findByRole('option', { name: 'Row Select Product' });
    const productCheckbox = screen.getByRole('checkbox', { name: 'Select Row Select Product' });
    fireEvent.click(productRow);
    expect(productCheckbox).toBeChecked();
    fireEvent.click(productRow);
    expect(productCheckbox).not.toBeChecked();
    fireEvent.keyDown(productRow, { key: ' ' });
    expect(productCheckbox).toBeChecked();
  });

  it('allows an empty FOC quantity and records it as zero', async () => {
    const product = { id: 1, name: 'Apple', category: 'Fruit', stock: 4, cost: 1000, base_unit: 'Piece', prices: [] };
    globalThis.fetch = vi.fn((url, options = {}) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      if (requestUrl.pathname.endsWith('/categories')) return jsonResponse(['Fruit']);
      if (requestUrl.pathname.endsWith('/products')) return jsonResponse({ items: [product], total: 1 });
      if (requestUrl.pathname.endsWith('/purchases') && options.method === 'POST') return jsonResponse({ price_changes: [] });
      return jsonResponse({ items: [] });
    });

    renderNewPurchase({ modal: true });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select Apple' }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    const focInput = screen.getByRole('spinbutton', { name: 'Apple FOC quantity' });
    fireEvent.change(focInput, { target: { value: '' } });
    expect(focInput.value).toBe('');
    expect(within(screen.getByLabelText('Purchase quantity summary')).getByText('0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Submit Purchase/i }));

    await waitFor(() => {
      const saveCall = globalThis.fetch.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(saveCall).toBeTruthy();
      expect(JSON.parse(saveCall[1].body).items[0].foc_quantity).toBe(0);
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Submit Purchase/i })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(await screen.findByRole('checkbox', { name: 'Select Apple' })).not.toBeChecked();
  });
});
