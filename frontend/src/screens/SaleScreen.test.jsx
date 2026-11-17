import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../components/notifications';
import { emitDataChange } from '../dataEvents';
import { SaleScreen } from './SaleScreen';

function response(payload) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
  });
}

describe('SaleScreen payment state', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url) => {
      const path = String(url);
      if (path.includes('/products?')) return response({
        items: [{
          id: 1,
          name: 'Tea',
          category: 'Drinks',
          stock: 10,
          price: 100,
          cost: 70,
          prices: [{ name: 'Retail', price: 100 }],
        }],
        total: 1,
      });
      if (path.endsWith('/categories')) return response([]);
      if (path.endsWith('/settings')) return response({ payment_methods: 'Cash,KPay,Wave Pay' });
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests name sorting from the first page without changing the cart', async () => {
    render(<NotificationProvider><SaleScreen /></NotificationProvider>);
    await screen.findByText('Tea');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'name_desc' } });
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('sort=name_desc') && String(url).includes('offset=0'))).toBe(true));
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'name_asc' } });
    await waitFor(() => expect(String(fetch.mock.calls.filter(([url]) => String(url).includes('/products?')).at(-1)[0])).toContain('sort=name_asc'));
  });

  it('keeps the focused POS toolbar free of navigation, session, and refresh controls', async () => {
    render(<NotificationProvider><SaleScreen /></NotificationProvider>);

    const scanner = screen.getByPlaceholderText('Search name, SKU, or scan barcode');
    await waitFor(() => expect(scanner).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Back to dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('keeps the selected payment method while product search reloads', async () => {
    render(<NotificationProvider><SaleScreen /></NotificationProvider>);

    expect(screen.queryByLabelText('Payment Method')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Tea/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(screen.getByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();

    const paymentSelect = await screen.findByLabelText('Payment Method');
    fireEvent.change(paymentSelect, { target: { value: 'KPay' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close Checkout' }));
    fireEvent.change(screen.getByPlaceholderText('Search name, SKU, or scan barcode'), { target: { value: 'tea' } });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=tea'),
      expect.any(Object),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(await screen.findByLabelText('Payment Method')).toHaveValue('KPay');
  });

  it('reloads Sell data when the app-bar refresh targets the sell module', async () => {
    render(<NotificationProvider><SaleScreen /></NotificationProvider>);
    await screen.findByRole('button', { name: /Tea/ });
    const initialRequests = globalThis.fetch.mock.calls.length;

    act(() => emitDataChange(['*'], 'navigation', 'sell'));

    await waitFor(() => expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(initialRequests));
  });

  it('returns from new customer to the existing checkout values without reloading Sell data', async () => {
    const { container } = render(<NotificationProvider><SaleScreen /></NotificationProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /Tea/ }));
    const source = container.querySelector('.sale-product-grid');
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    fireEvent.change(screen.getByLabelText('Payment Method'), { target: { value: 'KPay' } });
    fireEvent.change(screen.getByLabelText('Paid Amount'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Discount'), { target: { value: '10' } });
    const requests = globalThis.fetch.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'New customer', exact: true }));
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Unsaved customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to checkout' }));
    expect(screen.getByLabelText('Payment Method')).toHaveValue('KPay');
    expect(screen.getByLabelText('Paid Amount')).toHaveValue(60);
    expect(screen.getByLabelText('Discount')).toHaveValue(10);
    expect(container.querySelector('.sale-product-grid')).toBe(source);
    expect(globalThis.fetch).toHaveBeenCalledTimes(requests);
    expect(globalThis.fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('fills the complete sale total from the Pay Full shortcut', async () => {
    render(<NotificationProvider><SaleScreen /></NotificationProvider>);

    fireEvent.click(await screen.findByRole('button', { name: /Tea/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pay Full' }));

    expect(screen.getByLabelText('Paid Amount')).toHaveValue(100);
    expect(screen.getByText('Unpaid').closest('.sale-unpaid-line')).toHaveTextContent('0 Ks');
  });

  it('allows an FOC-only cart to checkout without payment fields', async () => {
    const { container } = render(<NotificationProvider><SaleScreen /></NotificationProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /Tea/ }));
    fireEvent.change(container.querySelector('.sale-qty-controls input'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('FOC'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));

    expect(screen.getByText('FOC sale')).toBeInTheDocument();
    expect(screen.queryByLabelText('Paid Amount')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Payment Method')).not.toBeInTheDocument();
  });

  it('uses the shared skeleton while products load', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    const { container } = render(<NotificationProvider><SaleScreen /></NotificationProvider>);
    const productGrid = container.querySelector('.sale-product-grid');

    expect(productGrid.querySelector('.page-loading-skeleton')).not.toBeNull();
  });

  it('shows a stable placeholder for products without a photo', async () => {
    const { container } = render(<NotificationProvider><SaleScreen /></NotificationProvider>);

    const productButton = await screen.findByRole('button', { name: /Tea/ });
    expect(productButton.querySelector('.sale-product-media')).not.toBeNull();
    expect(productButton.querySelector('.sale-product-image-placeholder')).not.toBeNull();
    expect(container.querySelector('.sale-product-photo')).toBeNull();
  });

  it('loads additional product pages without increasing the API limit', async () => {
    const originalObserver = globalThis.IntersectionObserver;
    let intersectionCallback;
    globalThis.IntersectionObserver = class IntersectionObserverMock {
      constructor(callback) {
        intersectionCallback = callback;
      }
      observe() {}
      disconnect() {}
    };
    globalThis.fetch = vi.fn((url) => {
      const parsed = new URL(String(url), 'http://mkpos.local');
      if (parsed.pathname.endsWith('/products')) {
        const offset = Number(parsed.searchParams.get('offset') || 0);
        const items = Array.from({ length: 40 }, (_, index) => ({
          id: offset + index + 1,
          name: `Product ${offset + index + 1}`,
          stock: 10,
          price: 100,
          prices: [{ name: 'Retail', price: 100 }],
        }));
        return response({ items, total: 600 });
      }
      if (parsed.pathname.endsWith('/categories')) return response([]);
      if (parsed.pathname.endsWith('/settings')) return response({ payment_methods: 'Cash' });
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<NotificationProvider><SaleScreen /></NotificationProvider>);

    await screen.findByText('Product 40');
    expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    act(() => intersectionCallback([{ isIntersecting: true }]));
    await screen.findByText('Product 80');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=40&offset=40'),
      expect.any(Object),
    );
    fireEvent.click(screen.getByText('Product 1').closest('button'));
    act(() => emitDataChange(['products'], 'realtime'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=80&offset=0'), expect.any(Object)));
    await screen.findByText('Product 80');
    expect(screen.getAllByText('Product 1')).toHaveLength(2);
    globalThis.IntersectionObserver = originalObserver;
  });

  it('adds a purchase-pack quantity while keeping the base-unit price', async () => {
    globalThis.fetch = vi.fn((url) => {
      const parsed = new URL(String(url), 'http://mkpos.local');
      if (parsed.pathname.endsWith('/products')) return response({
        items: [{
          id: 1,
          name: 'Water Bottle',
          category: 'Drinks',
          stock: 48,
          base_unit: 'Piece',
          purchase_unit: 'Carton',
          purchase_conversion_factor: 24,
          price: 1000,
          cost: 700,
          prices: [{ name: 'Retail', price: 1000 }],
        }],
        total: 1,
      });
      if (parsed.pathname.endsWith('/categories')) return response(['Drinks']);
      if (parsed.pathname.endsWith('/settings')) return response({ payment_methods: 'Cash', price_types: 'Retail' });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<NotificationProvider><SaleScreen /></NotificationProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /Water Bottle/ }));
    fireEvent.click(screen.getByRole('button', { name: '+1 Carton (×24)' }));

    expect(screen.getAllByText('25,000 Ks').length).toBeGreaterThan(0);
  });
});
