import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import App from "./App";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { publishDataChange } from '../navigation/dataChanges';
import * as offlineStore from '../offline/offlineStore';

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));
vi.mock('@capacitor/core', async (importOriginal) => ({ ...(await importOriginal()), Capacitor: { getPlatform: vi.fn(() => 'web'), isNativePlatform: vi.fn(() => false) } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })), minimizeApp: vi.fn(), exitApp: vi.fn() } }));

const session = {
  user: { id: 1, name: "Moe Myint", email: "moe@example.com", role: "owner" },
  business: { id: 8, name: "Moe Mini Mart" },
  role_name: "Owner",
  permissions: ["products"],
};

function authenticatedApi(path) {
  if (path === "/auth/me") return Promise.resolve(session);
  if (path === "/app-config")
    return Promise.resolve({
      enabled_modules: ["products"],
      permissions: ["products"],
    });
  if (path.startsWith("/products?"))
    return Promise.resolve({ items: [], total: 0 });
  if (path === "/categories") return Promise.resolve([]);
  if (path === "/products/summary")
    return Promise.resolve({
      total_products: 0,
      total_stock_units: 0,
      low_stock: 0,
      out_of_stock: 0,
    });
  if (path === "/price-types")
    return Promise.resolve({ items: ["Retail"], rules: [] });
  return Promise.resolve({});
}

beforeEach(() => {
  apiRequest.mockReset();
  Capacitor.getPlatform.mockReturnValue('web');
  CapacitorApp.addListener.mockClear();
  CapacitorApp.minimizeApp.mockClear();
  CapacitorApp.exitApp.mockClear();
  window.history.replaceState({}, "", "/login");
});

describe("mobile authentication handoff", () => {
  it.each(['page', 'app-bar', 'hardware'])('returns from an unavailable price type through %s Back to its direct-link parent', async control => {
    if (control === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', '/settings/prices/Missing/edit');
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['settings'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['settings'], permissions: ['settings'] });
      if (path === '/settings') return Promise.resolve({ shop_name: 'Demo shop', price_types: 'Retail', payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    const nativeBack = vi.spyOn(window.history, 'back');
    render(<App />);
    await screen.findByText('Price type not found.');
    if (control === 'page') fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
    else if (control === 'app-bar') fireEvent.click(screen.getByRole('button', { name: 'Back to settings', exact: true }));
    else act(() => CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1]());
    await screen.findByRole('button', { name: 'New price type', exact: true });
    expect(window.location.pathname).toBe('/settings/prices');
    expect(nativeBack).toHaveBeenCalledOnce();
    expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    nativeBack.mockRestore();
  });
  it.each(['page', 'app-bar', 'hardware'])('returns from an unavailable billing plan through %s Back without leaving the app', async control => {
    if (control === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', '/billing/request/99');
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['billing'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['billing'], permissions: ['billing'] });
      if (path === '/subscription/plans') return Promise.resolve({ items: [{ id: 5, name: 'Available package', price: 10000, currency: 'Ks', duration_days: 30 }] });
      if (path === '/subscription/payment-methods') return Promise.resolve({ items: [{ id: 1, bank: 'Demo bank', account_name: 'Demo', account_no: '000' }] });
      if (path.startsWith('/subscription/billing-history?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/subscription') return Promise.resolve({ is_valid: true });
      return authenticatedApi(path);
    });
    const nativeBack = vi.spyOn(window.history, 'back');
    render(<App />);
    await screen.findByText('Plan not found.');
    if (control === 'page') fireEvent.click(screen.getAllByRole('button', { name: 'Back to billing', exact: true }).at(-1));
    else if (control === 'app-bar') fireEvent.click(screen.getAllByRole('button', { name: 'Back to billing', exact: true })[0]);
    else act(() => CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1]());
    await screen.findByRole('heading', { name: 'Billing', exact: true });
    expect(window.location.pathname).toBe('/billing');
    expect(nativeBack).toHaveBeenCalledOnce();
    expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    nativeBack.mockRestore();
  });
  it.each(['page', 'app-bar', 'browser', 'hardware'])('retains a completed receipt and resumes its source through %s Back and Forward', async control => {
    if (control === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', '/sell');
    const product = { id: 4, name: 'Receipt Return Water', stock: 12, base_unit: 'Bottle', price: 1500, cost: 800, prices: [{ name: 'Retail', price: 1500 }] };
    apiRequest.mockImplementation((path, options) => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['sell'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['sell'], permissions: ['sell'] });
      if (path.startsWith('/products?')) return Promise.resolve({ items: [product], total: 1 });
      if (path.startsWith('/customers?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/settings') return Promise.resolve({ price_types: 'Retail', payment_methods: 'Cash' });
      if (path === '/sales' && options?.method === 'POST') return Promise.resolve({ id: 44, receipt_no: 'RETAINED-44' });
      if (path === '/sales/44/receipt') return Promise.resolve({ sale: { receipt_no: 'RETAINED-44' }, html: '<p>Receipt</p>', text: 'Receipt' });
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search sale products', exact: true });
    fireEvent.change(search, { target: { value: 'Receipt Return' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Receipt'))).toBe(true));
    fireEvent.click((await screen.findByText('Receipt Return Water')).closest('button'));
    fireEvent.click(screen.getByRole('button', { name: 'View cart' }));
    await screen.findByRole('heading', { name: 'Cart', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to checkout', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pay full', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale (1,500 Ks)', exact: true }));
    await screen.findByRole('heading', { name: 'Sale complete', exact: true });
    const receipt = document.querySelector('.sale-checkout-complete');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start new sale', exact: true })).toBeEnabled());
    const count = apiRequest.mock.calls.length;
    if (control === 'page') fireEvent.click(screen.getByRole('button', { name: 'Go to previous sale step', exact: true }));
    else if (control === 'app-bar') fireEvent.click(screen.getByRole('button', { name: 'Go to previous sale step', exact: true }));
    else if (control === 'browser') act(() => window.history.back());
    else act(() => CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1]());
    await screen.findByRole('heading', { name: 'Cart', exact: true });
    expect(window.location.pathname).toBe('/sell/cart');
    act(() => window.history.forward());
    await waitFor(() => expect(receipt).toBeVisible());
    expect(document.querySelector('.sale-checkout-complete')).toBe(receipt);
    expect(screen.getByText('RETAINED-44', { exact: true })).toBeVisible();
    act(() => window.history.back());
    await screen.findByRole('heading', { name: 'Cart', exact: true });
    act(() => window.history.back());
    await waitFor(() => expect(search).toBeVisible());
    expect(search).toHaveValue('Receipt Return');
    expect(apiRequest.mock.calls.length).toBe(count);
    expect(apiRequest.mock.calls.filter(([path, options]) => path === '/sales' && options?.method === 'POST')).toHaveLength(1);
    expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
  });
  it('resumes every sale step and its drafts through page Back and browser Forward without requests', async () => {
    window.history.replaceState({}, '', '/sell');
    const product = { id: 4, name: 'Step Return Water', stock: 12, base_unit: 'Bottle', price: 1500, cost: 800, prices: [{ name: 'Retail', price: 1500 }] };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['sell'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['sell'], permissions: ['sell'] });
      if (path.startsWith('/products?')) return Promise.resolve({ items: [product], total: 1 });
      if (path.startsWith('/customers?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/settings') return Promise.resolve({ price_types: 'Retail', payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search sale products', exact: true });
    fireEvent.click((await screen.findByText('Step Return Water')).closest('button'));
    fireEvent.change(search, { target: { value: 'Step Return' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Step'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'View cart' }));
    const quantity = await screen.findByLabelText('Step Return Water quantity');
    fireEvent.change(quantity, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to checkout', exact: true }));
    const paid = await screen.findByLabelText('Paid amount');
    fireEvent.change(paid, { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'New customer', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm selection', exact: true }));
    const customerName = await screen.findByLabelText('Customer name');
    fireEvent.change(customerName, { target: { value: 'Unsubmitted checkout customer' } });
    const count = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(paid).toBeVisible());
    expect(paid).toHaveValue('3,000');
    act(() => window.history.forward());
    await waitFor(() => expect(customerName).toBeVisible());
    expect(customerName).toHaveValue('Unsubmitted checkout customer');
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous sale step', exact: true }));
    await waitFor(() => expect(paid).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous sale step', exact: true }));
    await waitFor(() => expect(quantity).toBeVisible());
    expect(quantity).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Back to products', exact: true }));
    await waitFor(() => expect(search).toBeVisible());
    expect(search).toHaveValue('Step Return');
    act(() => window.history.forward());
    await waitFor(() => expect(quantity).toBeVisible());
    expect(screen.getByLabelText('Step Return Water quantity')).toBe(quantity);
    act(() => window.history.forward());
    await waitFor(() => expect(paid).toBeVisible());
    expect(screen.getByLabelText('Paid amount')).toBe(paid);
    expect(paid).toHaveValue('3,000');
    expect(apiRequest.mock.calls.length).toBe(count);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it.each(['new', 'edit'])('preserves the purchase source and %s draft through page Back and Forward', async mode => {
    window.history.replaceState({}, '', '/purchases');
    const purchase = { id: 12, supplier_name: 'Retained purchase supplier', created_at: '2026-10-06', status: 'completed', total_cost: 2000, paid_amount: 2000, credit_amount: 0, note: 'Original purchase note', items: [] };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['purchases'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['purchases'], permissions: ['purchases'] });
      if (path.startsWith('/purchases?')) return Promise.resolve({ items: [purchase], total: 1 });
      if (path === '/purchases/12') return Promise.resolve(purchase);
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search purchase history', exact: true });
    fireEvent.change(search, { target: { value: 'Retained purchase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply purchase search', exact: true }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Retained'))).toBe(true));
    const row = await screen.findByRole('button', { name: /Retained purchase supplier/ });
    let detail;
    if (mode === 'edit') {
      fireEvent.click(row);
      const edit = await screen.findByRole('button', { name: 'Edit purchase', exact: true });
      detail = edit;
      fireEvent.click(edit);
    } else fireEvent.click(screen.getAllByRole('button', { name: 'New purchase', exact: true })[0]);
    const draft = await screen.findByLabelText('Note');
    fireEvent.change(draft, { target: { value: 'Unsubmitted purchase draft' } });
    const count = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to purchases', exact: true }).at(-1));
    await waitFor(() => expect(mode === 'edit' ? detail : row).toBeVisible());
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Unsubmitted purchase draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(mode === 'edit' ? detail : row).toBeVisible());
    if (mode === 'edit') {
      fireEvent.click(screen.getAllByRole('button', { name: 'Back to purchases', exact: true }).at(-1));
      await waitFor(() => expect(row).toBeVisible());
    }
    expect(search).toHaveValue('Retained purchase');
    expect(screen.getByRole('button', { name: /Retained purchase supplier/ })).toBe(row);
    expect(apiRequest.mock.calls.length).toBe(count);
  });
  it.each(['customers', 'suppliers'])('preserves the filtered %s directory and detail tab through page Back and Forward', async module => {
    const id = module === 'customers' ? 7 : 3;
    window.history.replaceState({}, '', `/${module}`);
    const contact = { id, name: 'Retained directory contact', balance: 1000 };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: [module] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (path.startsWith(`/${module}?`)) return Promise.resolve({ items: [contact], total: 1 });
      if (path === '/customers/7/detail') return Promise.resolve({ customer: contact, summary: { balance: 1000 } });
      if (path.startsWith('/suppliers/3?')) return Promise.resolve({ supplier: contact, purchases: [], summary: {}, total: 0, filtered_stats: {} });
      if (path.startsWith('/customers/7/sales?') || path.startsWith('/customers/7/payments?') || path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: `Search ${module}`, exact: true });
    fireEvent.change(search, { target: { value: 'Retained directory' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Retained'))).toBe(true));
    const source = await screen.findByRole('button', { name: 'View Retained directory contact', exact: true });
    fireEvent.click(source);
    const tab = await screen.findByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ });
    fireEvent.click(tab);
    await waitFor(() => expect(tab).toHaveAttribute('aria-selected', 'true'));
    const count = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: `Back to ${module}`, exact: true }).at(-1));
    await waitFor(() => expect(source).toBeVisible());
    expect(search).toHaveValue('Retained directory');
    expect(screen.getByRole('button', { name: 'View Retained directory contact', exact: true })).toBe(source);
    act(() => window.history.forward());
    await waitFor(() => expect(tab).toBeVisible());
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ })).toBe(tab);
    expect(apiRequest.mock.calls.length).toBe(count);
  });
  it('retains the expense source and edit draft through page Back, Forward and Cancel', async () => {
    window.history.replaceState({}, '', '/expenses');
    const expense = { id: 4, title: 'Retained expense', amount: 500, category: 'General', payment_method: 'Cash', expense_date: '2026-10-06' };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['expenses'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['expenses'], permissions: ['expenses'] });
      if (path.startsWith('/expenses?')) return Promise.resolve({ items: [expense], total: 1 });
      if (path === '/expenses/4') return Promise.resolve(expense);
      if (path === '/expense-categories') return Promise.resolve(['General']);
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search expenses', exact: true });
    fireEvent.change(search, { target: { value: 'Retained expense' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Retained'))).toBe(true));
    const source = await screen.findByRole('button', { name: 'Actions for Retained expense', exact: true });
    fireEvent.click(source);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Retained expense', exact: true }));
    const draft = await screen.findByLabelText('Title');
    fireEvent.change(draft, { target: { value: 'Unsubmitted expense edit' } });
    const count = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to expenses', exact: true }).at(-1));
    await waitFor(() => expect(source).toBeVisible());
    expect(search).toHaveValue('Retained expense');
    expect(screen.getByRole('button', { name: 'Actions for Retained expense', exact: true })).toBe(source);
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Unsubmitted expense edit');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(apiRequest.mock.calls.length).toBe(count);
  });
  it.each([
    ['customers', '/customers/7/edit', '/customers/7'],
    ['customers', '/customers/7', '/customers'],
    ['customers', '/customers/7/payments/new', '/customers/7'],
    ['suppliers', '/suppliers/3/edit', '/suppliers/3'],
    ['suppliers', '/suppliers/3/payments/new', '/suppliers/3'],
    ['purchases', '/purchases/11/edit', '/purchases'],
    ['purchases', '/purchases/11', '/purchases'],
    ['expenses', '/expenses/4/edit', '/expenses'],
  ].flatMap(flow => ['page', 'app-bar', 'hardware'].map(control => [...flow, control])))('returns safely from %s failed deep link %s to %s using %s Back', async (module, route, parent, control) => {
    if (control === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', route);
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: [module] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (/^\/(?:customers\/7|suppliers\/3|purchases\/11|expenses\/4)(?:[/?]|$)/.test(path)) return Promise.reject(new Error('Record unavailable'));
      if (/^\/(?:customers|suppliers|purchases|expenses)\?/.test(path)) return Promise.resolve({ items: [], total: 0 });
      if (path === '/expenses/summary') return Promise.resolve({});
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    await screen.findByText('Record unavailable');
    const back = vi.spyOn(window.history, 'back');
    try {
      if (control === 'hardware') {
        const hardwareBack = CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1];
        act(() => hardwareBack());
      } else {
        const controls = screen.getAllByRole('button', { name: /^Back to / });
        fireEvent.click(control === 'page' ? controls.at(-1) : controls[0]);
      }
      await waitFor(() => expect(window.location.pathname).toBe(parent));
      expect(back).toHaveBeenCalledOnce();
      expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
      expect(apiRequest.mock.calls.some(([, options]) => ['PUT', 'POST', 'DELETE'].includes(options?.method))).toBe(false);
    } finally { back.mockRestore(); }
  });
  it.each(['customers', 'suppliers'].flatMap(module => ['page', 'app-bar', 'hardware'].map(control => [module, control])))('returns a direct %s payment error to its contact using %s Back', async (module, control) => {
    if (control === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    const id = module === 'customers' ? 7 : 3;
    window.history.replaceState({}, '', `/${module}/${id}/payments/18/edit`);
    const contact = { id, name: 'Error Return Contact', balance: 1000 };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: [module] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (path === '/customer-payments/18' || path === '/supplier-payments/18') return Promise.reject(new Error('Payment unavailable'));
      if (path === '/customers/7/detail') return Promise.resolve({ customer: contact, summary: { balance: 1000 } });
      if (path.startsWith('/suppliers/3?')) return Promise.resolve({ supplier: contact, purchases: [], summary: {}, total: 0, filtered_stats: {} });
      if (path.startsWith('/customers/7/sales?') || path.startsWith('/customers/7/payments?') || path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    await screen.findByText('Payment unavailable');
    const back = vi.spyOn(window.history, 'back');
    try {
      const controls = screen.getAllByRole('button', { name: /^Back to (?:customer|supplier)/ });
      if (control === 'hardware') {
        const hardwareBack = CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1];
        act(() => hardwareBack());
      } else fireEvent.click(control === 'page' ? controls.at(-1) : controls[0]);
      await waitFor(() => expect(window.location.pathname).toBe(`/${module}/${id}`));
      await screen.findByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ });
      expect(back).toHaveBeenCalledOnce();
      expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
      expect(apiRequest.mock.calls.some(([, options]) => ['PUT', 'POST', 'DELETE'].includes(options?.method))).toBe(false);
    } finally { back.mockRestore(); }
  });
  it('resumes the sale source after offline-invoice page Back and preserves the invoice page on Forward', async () => {
    window.history.replaceState({}, '', '/sell');
    const bootstrap = vi.spyOn(offlineStore, 'getOfflineBootstrap').mockResolvedValue({ pending_count: 1, failed_count: 0 });
    const invoices = vi.spyOn(offlineStore, 'listOfflineSales').mockResolvedValue({ items: [], total: 0 });
    const product = { id: 4, name: 'Offline Return Water', stock: 12, base_unit: 'Bottle', price: 1500, cost: 800, prices: [{ name: 'Retail', price: 1500 }] };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['sell'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['sell'], permissions: ['sell'] });
      if (path.startsWith('/products?')) return Promise.resolve({ items: [product], total: 1 });
      if (path === '/settings') return Promise.resolve({ price_types: 'Retail', payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    try {
      render(<App />);
      const search = await screen.findByRole('textbox', { name: 'Search sale products', exact: true });
      fireEvent.click((await screen.findByText('Offline Return Water')).closest('button'));
      fireEvent.change(search, { target: { value: 'Offline Return' } });
      await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Offline'))).toBe(true));
      fireEvent.click(screen.getByRole('button', { name: 'View invoices', exact: true }));
      await screen.findByRole('heading', { name: 'Offline sales', exact: true });
      const invoicePage = document.querySelector('.offline-sales-page');
      await waitFor(() => expect(invoices).toHaveBeenCalled());
      const requests = apiRequest.mock.calls.length, offlineReads = invoices.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Back to sell', exact: true }));
      await waitFor(() => expect(search).toBeVisible());
      expect(screen.getByRole('textbox', { name: 'Search sale products', exact: true })).toBe(search);
      expect(search).toHaveValue('Offline Return');
      expect(screen.getByRole('button', { name: 'View cart' }).parentElement).toHaveTextContent('1 lines');
      act(() => window.history.forward());
      await waitFor(() => expect(invoicePage).toBeVisible());
      expect(document.querySelector('.offline-sales-page')).toBe(invoicePage);
      act(() => window.history.back());
      await waitFor(() => expect(search).toBeVisible());
      expect(apiRequest.mock.calls.length).toBe(requests);
      expect(invoices.mock.calls.length).toBe(offlineReads);
    } finally { bootstrap.mockRestore(); invoices.mockRestore(); }
  });
  it('preserves the product source and stock adjustment draft through page Back, Forward and app-bar Back', async () => {
    window.history.replaceState({}, '', '/products');
    const product = { id: 4, name: 'Stock Navigation Product', stock: 12, base_unit: 'Bottle', price: 1500, cost: 800, prices: [{ name: 'Retail', price: 1500 }] };
    apiRequest.mockImplementation(path => {
      if (path.startsWith('/products?')) return Promise.resolve({ items: [product], total: 1 });
      if (path === '/products/4') return Promise.resolve(product);
      if (path.startsWith('/products/4/stock-movements')) return Promise.resolve([]);
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search products', exact: true });
    fireEvent.change(search, { target: { value: 'Stock Navigation' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Stock'))).toBe(true));
    const source = await screen.findByRole('button', { name: 'Actions for Stock Navigation Product', exact: true });
    fireEvent.click(source);
    fireEvent.click(screen.getByRole('button', { name: 'Stock', exact: true }));
    const quantity = await screen.findByRole('spinbutton', { name: /Adjustment quantity/ });
    const reason = screen.getByRole('combobox', { name: /Reason \(optional\)/ });
    fireEvent.click(screen.getByRole('button', { name: /Remove stock/ }));
    fireEvent.change(quantity, { target: { value: '2' } });
    fireEvent.change(reason, { target: { value: 'Unsubmitted stock count' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products', exact: true }).at(-1));
    await waitFor(() => expect(source).toBeVisible());
    expect(search).toHaveValue('Stock Navigation');
    expect(screen.getByRole('textbox', { name: 'Search products', exact: true })).toBe(search);
    act(() => window.history.forward());
    await waitFor(() => expect(quantity).toBeVisible());
    expect(quantity).toHaveValue(2);
    expect(screen.getByRole('button', { name: /Remove stock/ })).toHaveAttribute('aria-pressed', 'true');
    expect(reason).toHaveValue('Unsubmitted stock count');
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products', exact: true })[0]);
    await waitFor(() => expect(source).toBeVisible());
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it.each(['edit', 'stock'].flatMap(mode => ['return', 'page', 'app-bar', 'hardware'].map(control => [mode, control])))('returns safely from a direct product %s load failure using %s with no source entry', async (mode, control) => {
    if (control === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', `/products/4/${mode}`);
    apiRequest.mockImplementation(path => {
      if (path === '/products/4') return Promise.reject(Object.assign(new Error('Product no longer available'), { status: 404 }));
      return authenticatedApi(path);
    });
    render(<App />);
    await screen.findByText('Product no longer available');
    const back = vi.spyOn(window.history, 'back');
    if (control === 'hardware') {
      const hardwareBack = CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1];
      act(() => hardwareBack());
    } else if (control === 'return') fireEvent.click(screen.getByRole('button', { name: 'Return to products', exact: true }));
    else fireEvent.click(screen.getAllByRole('button', { name: 'Back to products', exact: true }).at(control === 'page' ? -1 : 0));
    await screen.findByRole('textbox', { name: 'Search products', exact: true });
    expect(window.location.pathname).toBe('/products');
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });
  it.each(['customer', 'supplier'])('restores the %s transaction source, search and edit draft on Back and Forward', async kind => {
    window.history.replaceState({}, '', '/transactions');
    const payment = { id: 18, customer_id: 7, supplier_id: 3, customer_name: 'Transaction Contact', supplier_name: 'Transaction Contact', amount: 250, payment_method: 'Cash', direction: kind === 'customer' ? 'customer_to_shop' : 'shop_to_supplier' };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['transactions'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['transactions'], permissions: ['transactions'] });
      if (path.startsWith('/customer-payments?') || path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [payment], total: 1 });
      if (path === '/customer-payments/18' || path === '/supplier-payments/18') return Promise.resolve(payment);
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash', admin_pin_set: '0' });
      return authenticatedApi(path);
    });
    render(<App />);
    if (kind === 'supplier') fireEvent.click(await screen.findByRole('button', { name: 'Suppliers', exact: true }));
    const searchLabel = kind === 'customer' ? 'Search transactions' : 'Search supplier payments';
    const search = await screen.findByRole('textbox', { name: searchLabel, exact: true });
    fireEvent.change(search, { target: { value: 'Retained transaction' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Retained'))).toBe(true));
    const sourceLabel = `Actions for ${kind} payment 18`;
    const source = await screen.findByRole('button', { name: sourceLabel, exact: true });
    fireEvent.click(source);
    fireEvent.click(screen.getByRole('button', { name: kind === 'customer' ? 'Edit customer payment' : 'Edit supplier payment' }));
    const draft = await screen.findByLabelText('Amount');
    await waitFor(() => expect(draft).toHaveValue(250));
    fireEvent.change(draft, { target: { value: '375' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to transactions', exact: true }).at(-1));
    await waitFor(() => expect(source).toBeVisible());
    expect(screen.getByRole('textbox', { name: searchLabel, exact: true })).toBe(search);
    expect(search).toHaveValue('Retained transaction');
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue(375);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe('/transactions');
    expect(apiRequest.mock.calls.length).toBe(requests);
  });
  it('reconciles a saved customer on the retained payment tab and does not refetch solely on return', async () => {
    window.history.replaceState({}, '', '/customers/7');
    let customer = { id: 7, name: 'Original Contact', balance: 1000 };
    apiRequest.mockImplementation((path, options) => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['customers'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['customers'], permissions: ['customers'] });
      if (path === '/customers/7/detail') return Promise.resolve({ customer, summary: { balance: 1000 } });
      if (path.startsWith('/customers/7/sales?')) return Promise.resolve({ items: [], total: 0 });
      if (path.startsWith('/customers/7/payments?')) return Promise.resolve({ items: [{ id: 18, amount: 250, note: 'Retained history', direction: 'customer_to_shop' }], total: 1 });
      if (path === '/customers/7' && options?.method === 'PUT') {
        customer = { ...customer, ...JSON.parse(options.body) };
        // The real API client emits this only after a successful mutation.
        publishDataChange(path, options.method);
        return Promise.resolve(customer);
      }
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ }));
    const source = await screen.findByRole('button', { name: 'Actions for payment 18', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit customer', exact: true }));
    const name = await screen.findByLabelText('Customer name');
    await waitFor(() => expect(name).toHaveValue('Original Contact'));
    fireEvent.change(name, { target: { value: 'Updated Contact' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(screen.getByRole('button', { name: 'Actions for payment 18', exact: true })).toBe(source);
    expect(screen.getByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Updated Contact', exact: true })).toBeVisible();
    const requests = apiRequest.mock.calls.length;
    act(() => window.history.forward());
    await waitFor(() => expect(name).toBeVisible());
    act(() => window.history.back());
    await waitFor(() => expect(source).toBeVisible());
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  });
  it('clears retained source pages, form drafts and the sale draft when the account identity changes', async () => {
    window.history.replaceState({}, '', '/products');
    window.sessionStorage.setItem('mkpos-mobile-sale-draft-v1:1:8', JSON.stringify({ cart: [{ product_id: 4 }] }));
    apiRequest.mockImplementation(authenticatedApi);
    render(<App />);
    const search = await screen.findByRole('textbox', { name: 'Search products', exact: true });
    fireEvent.change(search, { target: { value: 'Private source search' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Private'))).toBe(true));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add product', exact: true })[0]);
    const draft = await screen.findByLabelText('Product name');
    fireEvent.change(draft, { target: { value: 'Private form draft' } });
    act(() => window.dispatchEvent(new CustomEvent('mkpos:session-updated', { detail: { ...session, user: { ...session.user, id: 2 }, business: { id: 9, name: 'Other business' } } })));
    await waitFor(() => expect(draft.isConnected).toBe(false));
    const nextDraft = await screen.findByLabelText('Product name');
    expect(nextDraft).toHaveValue('');
    expect(window.sessionStorage.getItem('mkpos-mobile-sale-draft-v1:1:8')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products', exact: true })[0]);
    const nextSearch = await screen.findByRole('textbox', { name: 'Search products', exact: true });
    expect(nextSearch).not.toBe(search);
    expect(nextSearch).toHaveValue('');
    expect(screen.queryByDisplayValue('Private source search')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Private form draft')).not.toBeInTheDocument();
  });
  it('starts with fresh retained pages after logout and signing in as another account', async () => {
    let account = session;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/auth/me') return Promise.resolve(account);
      if (path === '/auth/login' && options?.method === 'POST') {
        account = { ...session, user: { ...session.user, id: 2 }, business: { id: 9, name: 'Other business' } };
        return Promise.resolve(account);
      }
      return authenticatedApi(path);
    });
    render(<App />);
    const source = await screen.findByRole('textbox', { name: 'Search products', exact: true });
    fireEvent.change(source, { target: { value: 'Previous account search' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Previous'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Open app menu', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out', exact: true }));
    const email = await screen.findByLabelText('Email address');
    expect(source.isConnected).toBe(false);
    fireEvent.change(email, { target: { value: 'other@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Demo login password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login', exact: true }));
    const nextSource = await screen.findByRole('textbox', { name: 'Search products', exact: true });
    expect(nextSource).not.toBe(source);
    expect(nextSource).toHaveValue('');
    expect(email.isConnected).toBe(false);
    expect(screen.queryByDisplayValue('Previous account search')).not.toBeInTheDocument();
  });
  it.each([
    ['customers', 7, 'edit', 'Edit customer', 'Customer name'],
    ['customers', 7, 'payment', 'New payment', 'Amount'],
    ['suppliers', 3, 'edit', 'Edit supplier', 'Supplier name'],
  ])('retains the %s profile and %s draft through Cancel, Back and Forward', async (module, id, mode, openLabel, fieldLabel) => {
    window.history.replaceState({}, '', `/${module}/${id}`);
    const contact = { id, name: 'Source Contact', phone: '09123', balance: 1000 };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: [module] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (path === '/customers/7/detail') return Promise.resolve({ customer: contact, summary: { balance: 1000 } });
      if (path.startsWith('/customers/7/sales?') || path.startsWith('/customers/7/payments?') || path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [], total: 0 });
      if (path.startsWith('/suppliers/3?')) return Promise.resolve({ supplier: contact, purchases: [], summary: { balance: 1000 }, total: 0, filtered_stats: {} });
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    if (module === 'suppliers' && mode === 'payment') fireEvent.click(await screen.findByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ }));
    const source = await screen.findByRole('button', { name: openLabel, exact: true });
    fireEvent.click(source);
    const draft = await screen.findByLabelText(fieldLabel);
    const value = mode === 'payment' ? 375 : 'Unsubmitted contact draft';
    fireEvent.change(draft, { target: { value: String(value) } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe(`/${module}/${id}`);
    expect(screen.getByRole('button', { name: openLabel, exact: true })).toBe(source);
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue(value);
    const backButtons = screen.getAllByRole('button', { name: /^Back to (?:customer|supplier)/ });
    fireEvent.click(backButtons.at(-1));
    await waitFor(() => expect(source).toBeVisible());
    if (module === 'suppliers' && mode === 'payment') expect(screen.getByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ })).toHaveAttribute('aria-selected', 'true');
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PUT')).toBe(false);
  });
  it.each(['customers', 'suppliers'])('retains %s payment history and the edit draft through page Back, Forward and Cancel', async module => {
    const id = module === 'customers' ? 7 : 3;
    window.history.replaceState({}, '', `/${module}/${id}`);
    const contact = { id, name: 'Payment Source', balance: 1000 };
    const payment = { id: 18, customer_id: 7, supplier_id: 3, amount: 250, payment_method: 'Cash', direction: module === 'customers' ? 'customer_to_shop' : 'shop_to_supplier', note: 'Original movement' };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: [module] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (path === '/customers/7/detail') return Promise.resolve({ customer: contact, summary: { balance: 1000 } });
      if (path.startsWith('/customers/7/sales?')) return Promise.resolve({ items: [], total: 0 });
      if (path.startsWith('/customers/7/payments?') || path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [payment], total: 1 });
      if (path === '/customer-payments/18' || path === '/supplier-payments/18') return Promise.resolve(payment);
      if (path.startsWith('/suppliers/3?')) return Promise.resolve({ supplier: contact, purchases: [], summary: { balance: 1000 }, total: 0, filtered_stats: {} });
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const tab = await screen.findByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ });
    fireEvent.click(tab);
    const sourceLabel = module === 'customers' ? 'Actions for payment 18' : 'Actions for supplier movement 18';
    const source = await screen.findByRole('button', { name: sourceLabel, exact: true });
    fireEvent.click(source);
    fireEvent.click(screen.getByRole('button', { name: module === 'customers' ? 'Edit payment 18' : /Edit movement/ }));
    const draft = await screen.findByLabelText('Amount');
    await waitFor(() => expect(draft).toHaveValue(250));
    fireEvent.change(draft, { target: { value: '375' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: /^Back to (?:customer|supplier)/ }).at(-1));
    await waitFor(() => expect(source).toBeVisible());
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: sourceLabel, exact: true })).toBe(source);
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue(375);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe(`/${module}/${id}`);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PUT')).toBe(false);
  });
  it.each(['cancel', 'app-bar', 'hardware', 'browser'])('preserves the supplier payment tab when returning from the payment page with %s', async closeMethod => {
    if (closeMethod === 'hardware') Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', '/suppliers/3');
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['suppliers'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['suppliers'], permissions: ['suppliers'] });
      if (path.startsWith('/suppliers/3?')) return Promise.resolve({ supplier: { id: 3, name: 'Source Contact', balance: 1000 }, purchases: [], summary: { balance: 1000 }, total: 0, filtered_stats: {} });
      if (path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const tab = await screen.findByRole('tab', { name: /^Payment records(?: \(\d+\))?$/ });
    fireEvent.click(tab);
    const source = await screen.findByRole('button', { name: 'Pay', exact: true });
    fireEvent.click(source);
    await screen.findByRole('heading', { name: 'New payment', exact: true });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '375' } });
    const requests = apiRequest.mock.calls.length;
    if (closeMethod === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    if (closeMethod === 'app-bar') fireEvent.click(screen.getByRole('button', { name: 'Back to suppliers', exact: true }));
    if (closeMethod === 'browser') act(() => window.history.back());
    if (closeMethod === 'hardware') {
      act(() => CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1]());
    }
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe('/suppliers/3');
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Pay', exact: true })).toBe(source);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PUT')).toBe(false);
  });
  it('retains sign-in and registration drafts on browser Back and Forward', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('Unauthenticated'), { status: 401 }));
    render(<App />);
    const email = await screen.findByLabelText('Email address');
    fireEvent.change(email, { target: { value: 'draft@example.test' } });
    const password = screen.getByLabelText('Password');
    fireEvent.change(password, { target: { value: 'Unsubmitted password' } });
    fireEvent.click(screen.getByRole('link', { name: 'Create account', exact: true }));
    const businessName = await screen.findByLabelText('Business name');
    fireEvent.change(businessName, { target: { value: 'Unsubmitted business' } });
    const requests = apiRequest.mock.calls.length;
    act(() => window.history.back());
    await waitFor(() => expect(email).toBeVisible());
    expect(screen.getByRole('textbox', { name: 'Email address', exact: true })).toBe(email);
    expect(password).toHaveValue('Unsubmitted password');
    expect(email).toHaveValue('draft@example.test');
    act(() => window.history.forward());
    await waitFor(() => expect(businessName).toBeVisible());
    expect(businessName).toHaveValue('Unsubmitted business');
    expect(screen.getByLabelText('Business name')).toBe(businessName);
    expect(apiRequest.mock.calls.length).toBe(requests);
  });
  it.each([
    ['price-new', '/settings/prices', 'New price type', 'Price type name'],
    ['price-edit', '/settings/prices', 'Actions for Retail', 'Price type name'],
    ['restore', '/settings/data', 'Restore backup', 'Confirmation'],
    ['reset', '/settings/data', 'Reset business data', 'Type RESET to confirm'],
  ])('preserves the immediate settings parent and %s draft on Back and Cancel', async (mode, path, openLabel, fieldLabel) => {
    window.history.replaceState({}, '', path);
    apiRequest.mockImplementation(requestPath => {
      if (requestPath === '/auth/me') return Promise.resolve({ ...session, permissions: ['settings'] });
      if (requestPath === '/app-config') return Promise.resolve({ enabled_modules: ['settings'], permissions: ['settings'] });
      if (requestPath === '/settings') return Promise.resolve({ shop_name: 'Settings demo', payment_methods: 'Cash' });
      return authenticatedApi(requestPath);
    });
    render(<App />);
    const source = await screen.findByRole('button', { name: openLabel, exact: true });
    fireEvent.click(source);
    if (mode === 'price-edit') fireEvent.click(screen.getByRole('button', { name: 'Edit Retail', exact: true }));
    const draft = await screen.findByLabelText(fieldLabel, { exact: false });
    fireEvent.change(draft, { target: { value: 'Unsubmitted nested draft' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to settings', exact: true })[0]);
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe(path);
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Unsubmitted nested draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe(path);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PUT')).toBe(false);
  });
  it.each(['edit-role', 'new-staff', 'edit-staff', 'staff-password'])('preserves access source tab and draft for %s Back and Cancel', async mode => {
    window.history.replaceState({}, '', '/access');
    const role = { id: 1, name: 'Cashier', permissions: ['sales'], staff_count: 1 };
    const staff = { id: 2, name: 'Demo Staff', email: 'staff@example.test', is_active: true, access_role_id: 1, access_role: role };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['access'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['access'], permissions: ['access'] });
      if (path.startsWith('/roles?')) return Promise.resolve({ items: [role], total: 1 });
      if (path.startsWith('/staff?')) return Promise.resolve({ items: [staff], total: 1 });
      if (path === '/roles/1') return Promise.resolve(role);
      if (path === '/staff/2') return Promise.resolve(staff);
      return authenticatedApi(path);
    });
    render(<App />);
    await screen.findByRole('button', { name: 'Actions for role Cashier' });
    if (mode !== 'edit-role') fireEvent.click(screen.getByRole('button', { name: 'Staff', exact: true }));
    const sourceName = mode === 'edit-role' ? 'Actions for role Cashier' : mode === 'new-staff' ? 'New staff' : 'Actions for staff Demo Staff';
    const source = await screen.findByRole('button', { name: sourceName, exact: true });
    fireEvent.click(source);
    if (mode !== 'new-staff') fireEvent.click(screen.getByRole('button', { name: mode === 'staff-password' ? /^Reset password/ : /^Edit/ }));
    const field = mode === 'edit-role' ? 'Role name' : mode === 'staff-password' ? 'New password' : 'Staff name';
    const draft = await screen.findByLabelText(field);
    fireEvent.change(draft, { target: { value: 'Unsubmitted access draft' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to access', exact: true }).at(-1));
    await waitFor(() => expect(source).toBeVisible());
    expect(screen.getByRole('button', { name: sourceName, exact: true })).toBe(source);
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Unsubmitted access draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PUT')).toBe(false);
  });
  it.each(['Account', 'Business', 'Receipt', 'Barcode', 'Printer', 'Payment methods', 'Price types', 'Security', 'Data tools', 'Language', 'About'])('returns from %s settings to the same mounted settings menu', async section => {
    window.history.replaceState({}, '', '/settings');
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['settings'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['settings'], permissions: ['settings'] });
      if (path === '/settings') return Promise.resolve({ shop_name: 'Settings demo', payment_methods: 'Cash' });
      if (path === '/settings/receipt-preview') return Promise.resolve({ html: '<p>Preview</p>' });
      return authenticatedApi(path);
    });
    render(<App />);
    const source = await screen.findByRole('button', { name: `Open ${section}`, exact: true });
    fireEvent.click(source);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Back to settings', exact: true })).toHaveLength(1));
    if (section === 'Receipt') await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path === '/settings/receipt-preview')).toBe(true));
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to settings', exact: true })[0]);
    await waitFor(() => expect(source).toBeVisible());
    expect(screen.getByRole('button', { name: `Open ${section}`, exact: true })).toBe(source);
    expect(apiRequest.mock.calls.length).toBe(requests);
    act(() => window.history.forward());
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Back to settings', exact: true })).toHaveLength(1));
    expect(apiRequest.mock.calls.length).toBe(requests);
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to settings', exact: true })[0]);
    await waitFor(() => expect(source).toBeVisible());
    expect(apiRequest.mock.calls.length).toBe(requests);
  });
  it.each([
    ['access', 'New role', 'Role name', 'access'],
    ['settings', 'Open Business', 'Shop name', 'settings'],
    ['billing', 'Request payment', 'Message to office (optional)', 'billing'],
    ['billing', 'Request payment', 'Message to office (optional)', 'billing', 'page'],
    ['billing', 'Request payment', 'Message to office (optional)', 'billing', 'cancel'],
  ])('retains the %s source and draft through Back and browser Forward (%s, %s, %s, %s)', async (module, openLabel, fieldLabel, parent, control = 'app-bar') => {
    window.history.replaceState({}, '', `/${module}`);
    const owner = { ...session, permissions: [module] };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve(owner);
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (path.startsWith('/roles?')) return Promise.resolve({ items: [{ id: 1, name: 'Cashier', permissions: ['sales'] }], total: 1 });
      if (path.startsWith('/staff?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/subscription/plans') return Promise.resolve({ items: [{ id: 5, name: 'Demo package', price: 10000, currency: 'Ks', duration_days: 30 }] });
      if (path === '/subscription/payment-methods') return Promise.resolve({ items: [{ id: 1, bank: 'Demo bank', account_name: 'Demo', account_no: '000' }] });
      if (path.startsWith('/subscription/billing-history?')) return Promise.resolve({ items: [], total: 0 });
      if (path === '/subscription') return Promise.resolve({ is_valid: true });
      if (path === '/settings') return Promise.resolve({ shop_name: 'Demo shop', payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const source = await screen.findByRole('button', { name: openLabel });
    await waitFor(() => expect(source).not.toBeDisabled());
    fireEvent.click(source);
    const draft = await screen.findByLabelText(fieldLabel);
    fireEvent.change(draft, { target: { value: 'Unsubmitted demo draft' } });
    const requests = apiRequest.mock.calls.length;
    if (control === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    else fireEvent.click(screen.getAllByRole('button', { name: `Back to ${parent}`, exact: true }).at(control === 'page' ? -1 : 0));
    await waitFor(() => expect(source).toBeVisible());
    expect(screen.getByRole('button', { name: openLabel })).toBe(source);
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Unsubmitted demo draft');
    expect(screen.getByLabelText(fieldLabel)).toBe(draft);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('returns from purchase detail and edit to the originating supplier history without refetching', async () => {
    window.history.replaceState({}, '', '/suppliers/3');
    const supplier = { id: 3, name: 'Source Supplier', balance: 1000 };
    const purchase = { id: 12, supplier_id: 3, supplier_name: supplier.name, total_cost: 2000, paid_amount: 1000, credit_amount: 1000, created_at: '2026-10-06', note: 'Source purchase', items: [] };
    apiRequest.mockImplementation(path => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['suppliers', 'purchases'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['suppliers', 'purchases'], permissions: ['suppliers', 'purchases'] });
      if (path.startsWith('/suppliers/3?')) return Promise.resolve({ supplier, purchases: [purchase], summary: { balance: 1000 }, total: 1, filtered_stats: {} });
      if (path === '/purchases/12') return Promise.resolve(purchase);
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    await screen.findByRole('button', { name: 'View purchase 12' });
    const historySearch = screen.getByRole('textbox', { name: 'Search supplier purchase history' });
    fireEvent.change(historySearch, { target: { value: 'Source purchase' } });
    const source = await screen.findByRole('button', { name: 'View purchase 12' });
    fireEvent.click(source);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit purchase', exact: true }));
    await screen.findByRole('heading', { name: 'Edit purchase', exact: true });
    const editorSearch = screen.getByLabelText('Note');
    fireEvent.change(editorSearch, { target: { value: 'Unsubmitted editor search' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await screen.findByRole('button', { name: 'Edit purchase', exact: true });
    expect(window.location.pathname).toBe('/purchases/12');
    fireEvent.click(screen.getByRole('button', { name: 'Back to suppliers', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(historySearch).toHaveValue('Source purchase');
    expect(screen.getByRole('button', { name: 'View purchase 12' })).toBe(source);
    act(() => window.history.forward());
    await screen.findByRole('button', { name: 'Edit purchase', exact: true });
    act(() => window.history.forward());
    await waitFor(() => expect(editorSearch).toBeVisible());
    expect(editorSearch).toHaveValue('Unsubmitted editor search');
    expect(apiRequest.mock.calls.length).toBe(requests);
  });
  it.each([
    ['customers', 'New customer', 'Customer name'],
    ['suppliers', 'New supplier', 'Supplier name'],
    ['expenses', 'New expense', 'Title'],
  ])('preserves the %s source and unsaved form through page Back, Cancel and app-bar Back', async (module, addLabel, fieldLabel) => {
    window.history.replaceState({}, '', `/${module}`);
    apiRequest.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: [module] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: [module], permissions: [module] });
      if (path.startsWith(`/${module}?`)) return Promise.resolve({ items: [], total: 0, account_summary: {} });
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      if (path === '/expense-categories') return Promise.resolve([]);
      return authenticatedApi(path);
    });
    render(<App />);
    const search = await screen.findByRole('textbox', { name: `Search ${module}` });
    fireEvent.change(search, { target: { value: 'Retained source search' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Retained'))).toBe(true));
    fireEvent.click(screen.getAllByRole('button', { name: addLabel, exact: true })[0]);
    const draft = await screen.findByLabelText(fieldLabel);
    fireEvent.change(draft, { target: { value: 'Unsubmitted draft' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: `Back to ${module}`, exact: true }).at(-1));
    await waitFor(() => expect(search).toBeVisible());
    expect(search).toHaveValue('Retained source search');
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Unsubmitted draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(search).toBeVisible());
    act(() => window.history.forward());
    await waitFor(() => expect(draft).toBeVisible());
    fireEvent.click(screen.getAllByRole('button', { name: `Back to ${module}`, exact: true })[0]);
    await waitFor(() => expect(search).toBeVisible());
    expect(screen.getByRole('textbox', { name: `Search ${module}` })).toBe(search);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('unwinds a customer-history sale and its editor to the actual retained customer source', async () => {
    window.history.replaceState({}, '', '/customers/7');
    const customer = { id: 7, name: 'History Customer', phone: '09123', balance: 1000 };
    const sale = { id: 11, receipt_no: 'SOURCE-11', customer_id: 7, customer_name: customer.name, total: 1500, subtotal: 1500, discount: 0, paid_amount: 500, credit_amount: 1000, payment_method: 'Cash', created_at: '2026-10-06', items: [{ id: 1, product_id: 4, product_name: 'Tea', unit_name: 'Pack', quantity: 1, foc_quantity: 0, unit_price: 1500, line_total: 1500 }] };
    apiRequest.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ ...session, permissions: ['customers', 'sales'] });
      if (path === '/app-config') return Promise.resolve({ enabled_modules: ['customers', 'sales'], permissions: ['customers', 'sales'] });
      if (path === '/customers/7/detail') return Promise.resolve({ customer, summary: { balance: 1000 } });
      if (path.startsWith('/customers/7/sales?')) return Promise.resolve({ items: [sale], total: 1 });
      if (path === '/sales/11') return Promise.resolve(sale);
      if (path === '/settings') return Promise.resolve({ payment_methods: 'Cash' });
      return authenticatedApi(path);
    });
    render(<App />);
    const source = await screen.findByRole('button', { name: 'View sale SOURCE-11' });
    fireEvent.click(source);
    await screen.findByRole('button', { name: 'Edit sale', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit sale', exact: true }));
    await screen.findByRole('heading', { name: 'Edit sale' });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to sales', exact: true }).at(-1));
    await screen.findByRole('button', { name: 'Edit sale', exact: true });
    expect(window.location.pathname).toBe('/sales/11');
    fireEvent.click(screen.getByRole('button', { name: 'Back to customers', exact: true }));
    await waitFor(() => expect(source).toBeVisible());
    expect(window.location.pathname).toBe('/customers/7');
    expect(screen.getByRole('button', { name: 'View sale SOURCE-11' })).toBe(source);
    expect(apiRequest.mock.calls.length).toBe(requests);
    act(() => window.history.forward());
    await screen.findByRole('button', { name: 'Edit sale', exact: true });
    expect(apiRequest.mock.calls.length).toBe(requests);
  });
  it('uses the app-bar parent fallback for Android Back from a direct detail route', async () => {
    Capacitor.getPlatform.mockReturnValue('android');
    window.history.replaceState({}, '', '/products/new');
    apiRequest.mockImplementation(authenticatedApi);
    render(<App />);
    await screen.findByRole('heading', { name: 'New product' });
    const hardwareBack = CapacitorApp.addListener.mock.calls.find(([event]) => event === 'backButton')[1];
    act(() => hardwareBack());
    await screen.findByRole('heading', { name: 'Products' });
    expect(window.location.pathname).toBe('/products');
    expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
    act(() => hardwareBack());
    expect(CapacitorApp.exitApp).toHaveBeenCalledOnce();
  });
  it("retains the product source on page Back and the form draft on browser Forward", async () => {
    apiRequest.mockImplementation(authenticatedApi);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App />);
    await screen.findByRole('heading', { name: 'Products' });
    const search = screen.getByRole('textbox', { name: 'Search products' });
    fireEvent.change(search, { target: { value: 'Water' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Water'))).toBe(true));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add product' })[0]);
    await screen.findByRole('heading', { name: 'New product' });
    const name = screen.getByLabelText('Product name');
    fireEvent.change(name, { target: { value: 'Unsent product' } });
    const requestCount = apiRequest.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products' }).at(-1));
    await waitFor(() => expect(search).toBeVisible());
    expect(screen.getByRole('textbox', { name: 'Search products' })).toBe(search);
    expect(search).toHaveValue('Water');
    expect(apiRequest.mock.calls.length).toBe(requestCount);
    act(() => window.history.forward());
    await waitFor(() => expect(name).toBeVisible());
    expect(name).toHaveValue('Unsent product');
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products' })[0]);
    await waitFor(() => expect(search).toBeVisible());
    expect(apiRequest.mock.calls.length).toBe(requestCount);
  });
  it("keeps permitted screens navigable for an expired owner", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({
          ...session,
          subscription: {
            is_valid: false,
            access_type: "trial",
            reason: "expired",
            lifecycle_notice: {
              title: "Your free trial has expired.",
              message: "Choose a paid plan to continue using PwarMyar.",
            },
          },
        });
      return authenticatedApi(path);
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Your free trial has expired.")).toBeInTheDocument();
  });

  it("keeps permitted screens navigable for expired staff", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({
          ...session,
          user: { ...session.user, role: "staff" },
          subscription: {
            is_valid: false,
            access_type: "trial",
            reason: "expired",
            lifecycle_notice: { title: "Your free trial has expired." },
          },
        });
      return authenticatedApi(path);
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Your free trial has expired.")).toBeInTheDocument();
  });

  it("keeps the workspace visible after a live entitlement update and follows billing navigation events", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({
          ...session,
          subscription: { is_valid: true, access_type: "trial" },
        });
      return authenticatedApi(path);
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Products" });

    window.dispatchEvent(
      new CustomEvent("mkpos:subscription-entitlement", {
        detail: {
          is_valid: false,
          access_type: "trial",
          reason: "expired",
          lifecycle_notice: {
            title: "Your free trial has expired.",
            message: "Choose a paid plan to continue using PwarMyar.",
          },
        },
      }),
    );

    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    window.dispatchEvent(new CustomEvent("mkpos:navigate-billing"));
    expect(await screen.findByRole("heading", { name: "Billing" })).toBeInTheDocument();
  });

  it("restores an authenticated session into the products workspace", async () => {
    apiRequest.mockImplementation(authenticatedApi);

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your session",
    );
    expect(
      await screen.findByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open app menu" }));
    expect(screen.getByText("Moe Mini Mart")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/products");
  });

  it("uses drawer routes and browser history for permitted modules", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({
          ...session,
          permissions: ["products", "reports"],
        });
      if (path === "/app-config")
        return Promise.resolve({
          enabled_modules: ["products", "reports"],
          permissions: ["products", "reports"],
        });
      return authenticatedApi(path);
    });

    render(<App />);
    await screen.findByRole("heading", { name: "Products" });
    fireEvent.click(screen.getByRole("button", { name: "Open app menu" }));
    fireEvent.click(screen.getByRole("link", { name: /Reports/ }));

    expect(
      await screen.findByRole("heading", { name: "Reports" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/reports");

    window.history.pushState({}, "", "/products");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(
      await screen.findByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();
  });

  it("restores a permitted purchases deep link into the purchases workspace", async () => {
    window.history.replaceState({}, "", "/purchases");
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({ ...session, permissions: ["purchases"] });
      if (path === "/app-config")
        return Promise.resolve({
          enabled_modules: ["purchases"],
          permissions: ["purchases"],
        });
      if (path.startsWith("/purchases?"))
        return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve({});
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Purchases" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/purchases");
  });

  it("restores a permitted suppliers deep link into the supplier directory", async () => {
    window.history.replaceState({}, "", "/suppliers");
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({ ...session, permissions: ["suppliers"] });
      if (path === "/app-config")
        return Promise.resolve({
          enabled_modules: ["suppliers"],
          permissions: ["suppliers"],
        });
      if (path.startsWith("/suppliers?"))
        return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve({});
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Suppliers" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/suppliers");
  });

  it("restores a permitted customers deep link into customer accounts", async () => {
    window.history.replaceState({}, "", "/customers");
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({ ...session, permissions: ["customers"] });
      if (path === "/app-config")
        return Promise.resolve({
          enabled_modules: ["customers"],
          permissions: ["customers"],
        });
      if (path.startsWith("/customers?"))
        return Promise.resolve({ items: [], total: 0, account_summary: {} });
      return Promise.resolve({});
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Customers" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers");
  });

  it("restores a permitted expenses deep link into expense history", async () => {
    window.history.replaceState({}, "", "/expenses");
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me")
        return Promise.resolve({ ...session, permissions: ["expenses"] });
      if (path === "/app-config")
        return Promise.resolve({
          enabled_modules: ["expenses"],
          permissions: ["expenses"],
        });
      if (path.startsWith("/expenses?"))
        return Promise.resolve({ items: [], total: 0 });
      if (path.startsWith("/expenses/summary?")) return Promise.resolve({});
      if (path === "/settings") return Promise.resolve({});
      return Promise.resolve({});
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Expenses" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/expenses");
  });

  it.each([
    ["sell", "Sell"],
    ["sales", "Sales"],
    ["transactions", "Transactions"],
    ["reports", "Reports"],
    ["billing", "Billing"],
    ["settings", "Settings"],
    ["access", "Access"],
  ])(
    "renders the real %s module instead of a placeholder",
    async (moduleId, heading) => {
      window.history.replaceState({}, "", `/${moduleId}`);
      apiRequest.mockImplementation((path) => {
        if (path === "/auth/me")
          return Promise.resolve({ ...session, permissions: [moduleId] });
        if (path === "/app-config")
          return Promise.resolve({
            enabled_modules: [moduleId],
            permissions: [moduleId],
          });
        if (path === "/categories") return Promise.resolve([]);
        if (path === "/settings")
          return Promise.resolve({
            price_types: "Retail",
            payment_methods: "Cash",
          });
        if (path === "/price-types")
          return Promise.resolve({ items: ["Retail"], usage: {}, rules: [] });
        if (path === "/data/status")
          return Promise.resolve({ ok: true, total_records: 0 });
        if (path === "/settings/printers")
          return Promise.resolve({ items: [] });
        if (path === "/subscription")
          return Promise.resolve({
            is_valid: true,
            subscription: null,
            pending_request: null,
          });
        if (
          path === "/subscription/plans" ||
          path === "/subscription/payment-methods"
        )
          return Promise.resolve({ items: [] });
        if (
          path.startsWith("/products?") ||
          path.startsWith("/sales?") ||
          path.startsWith("/subscription/billing-history?") ||
          path.startsWith("/roles?") ||
          path.startsWith("/staff?")
        )
          return Promise.resolve({ items: [], total: 0, modules: [] });
        if (path.startsWith("/reports/summary"))
          return Promise.resolve({
            payment_methods: [],
            top_products: [],
            expense_categories: [],
            current_accounts: {},
            cash_movement: {},
          });
        return Promise.resolve({});
      });

      render(<App />);

      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("This mobile module is ready to be implemented."),
      ).not.toBeInTheDocument();
    },
  );

  it("falls back to login when there is no authenticated session", async () => {
    apiRequest.mockRejectedValueOnce(
      Object.assign(new Error("Unauthenticated."), { status: 401 }),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      "/auth/me",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("starts unauthenticated deep links on the login route", async () => {
    window.history.replaceState({}, "", "/products");
    apiRequest.mockRejectedValueOnce(
      Object.assign(new Error("Unauthenticated."), { status: 401 }),
    );

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("refreshes the current entitlement after connectivity recovery", async () => {
    let sessionLoads = 0;
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me") {
        sessionLoads += 1;
        return Promise.resolve(
          sessionLoads === 1
            ? session
            : {
                ...session,
                business: { ...session.business, name: "Refreshed Mini Mart" },
                subscription: {
                  is_valid: true,
                  access_type: "trial",
                  lifecycle_notice: { stage: "reminder" },
                },
              },
        );
      }
      return authenticatedApi(path);
    });

    render(<App />);
    await screen.findByRole("heading", { name: "Products" });
    window.dispatchEvent(new Event("online"));

    fireEvent.click(screen.getByRole("button", { name: "Open app menu" }));
    expect(await screen.findByText("Refreshed Mini Mart")).toBeInTheDocument();
    expect(sessionLoads).toBe(2);
  });

  it("refreshes the current entitlement when the app resumes", async () => {
    let sessionLoads = 0;
    apiRequest.mockImplementation((path) => {
      if (path === "/auth/me") {
        sessionLoads += 1;
        return Promise.resolve(
          sessionLoads === 1
            ? session
            : {
                ...session,
                business: { ...session.business, name: "Resumed Mini Mart" },
              },
        );
      }
      return authenticatedApi(path);
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    render(<App />);
    await screen.findByRole("heading", { name: "Products" });
    document.dispatchEvent(new Event("visibilitychange"));

    fireEvent.click(screen.getByRole("button", { name: "Open app menu" }));
    expect(await screen.findByText("Resumed Mini Mart")).toBeInTheDocument();
    expect(sessionLoads).toBe(2);
  });
});
