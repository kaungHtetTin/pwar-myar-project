import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { PurchasesScreen } from './PurchasesScreen';

function renderPurchases(props = {}) {
  return render(
    <NotificationProvider>
      <ConfirmationProvider><PurchasesScreen {...props} /></ConfirmationProvider>
    </NotificationProvider>,
  );
}

function jsonResponse(payload) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
}

describe('PurchasesScreen', () => {
  it('keeps purchase history visible and opens the four-step new purchase modal', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/categories')) return jsonResponse([]);
      if (String(url).includes('/products?')) return jsonResponse({ items: [], total: 0 });
      return new Promise(() => {});
    });
    const { container } = renderPurchases();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.purchase-history-card')).toContainElement(screen.getByRole('status'));
    expect(container.querySelector('.purchase-wizard-page')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New Purchase/i }));
    const dialog = screen.getByRole('dialog', { name: 'New Purchase' });
    const progress = screen.getByRole('navigation', { name: 'Purchase form progress' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('.mkpos-modal-header-content')).toContainElement(progress);
    expect(dialog.querySelector('.mkpos-modal-footer')).toContainElement(screen.getByRole('button', { name: /Continue/i }));
    expect(dialog).not.toContainElement(screen.queryByRole('button', { name: 'Cancel' }));
    expect(dialog.querySelector('.purchase-modal-form-skeleton')).toBeInTheDocument();
    expect(dialog.querySelector('.page-loading-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Basic information' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it('opens an existing purchase in the four-step editor modal', async () => {
    const product = { id: 7, name: 'Desk Phone', category: 'Devices', stock: 4, cost: 12000, base_unit: 'Unit', prices: [] };
    globalThis.fetch = vi.fn((url) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      if (requestUrl.pathname.endsWith('/purchases/17')) return jsonResponse({
        id: 17,
        supplier_id: 3,
        supplier_name: 'ABC Supply',
        payment_method: 'Cash',
        paid_amount: 12000,
        total_cost: 12000,
        note: '',
        items: [{ id: 70, product_id: 7, product_name: 'Desk Phone', unit_name: 'Unit', conversion_factor: 1, quantity: 1, foc_quantity: 0, unit_cost: 12000, line_total: 12000 }],
      });
      if (requestUrl.pathname.endsWith('/purchases')) return jsonResponse({
        items: [{ id: 17, created_at: '2026-08-08', supplier_name: 'ABC Supply', total_cost: 12000, status: 'completed' }],
        total: 1,
      });
      if (requestUrl.pathname.endsWith('/categories')) return jsonResponse(['Devices']);
      if (requestUrl.pathname.endsWith('/products')) return jsonResponse({ items: [product], total: 1 });
      return jsonResponse({ items: [] });
    });
    renderPurchases();

    await waitFor(() => expect(screen.getByText('ABC Supply')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Actions for purchase 17' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit purchase 17' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Purchase' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('navigation', { name: 'Purchase form progress' })).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByDisplayValue('ABC Supply')).toBeInTheDocument());
    expect(globalThis.fetch.mock.calls.some(([url]) => {
      const requestUrl = new URL(String(url), 'http://localhost');
      return requestUrl.pathname.endsWith('/products') && requestUrl.searchParams.get('limit') === '500';
    })).toBe(true);
    expect(globalThis.fetch.mock.calls.some(([url]) => new URL(String(url), 'http://localhost').searchParams.get('ids') === '7')).toBe(true);
    expect(globalThis.fetch.mock.calls.some(([url]) => /\/products\/\d+$/.test(new URL(String(url), 'http://localhost').pathname))).toBe(false);
  });
});
