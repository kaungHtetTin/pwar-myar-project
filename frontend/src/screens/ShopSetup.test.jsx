import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ShopSetup } from './ShopSetup';
import { ShopScreen } from './ShopScreen';
import { request } from '../api';
import { setupDisplayStep, setupServerStage, nextSetupProgress } from '../shopSetupProgress';

vi.mock('../api', () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const settings = { id: 1, display_name: 'My shop', slug: 'my-shop', slug_locked: false, phone: '09123', address: 'Main street', currency: 'Ks', price_type: 'Retail', price_types: ['Retail', 'Wholesale'], description: '', storefront_enabled: false, accepting_orders: true, marketplace_enabled: false, pickup_instructions: 'At counter', pickup_address: '', pickup_hours: '', opening_hours: [], announcement: '', closed_until: null, timezone: 'Asia/Yangon', location: { latitude: 16, longitude: 96 }, delivery_zones: [], payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash', provider: 'manual', is_active: true, instructions: '' }] };
const ai = { settings: { name: 'Mia', instructions: 'Help customers', soul: 'Friendly', enabled: false, version: 1, tool_permissions: ['search_products'], sales_policies: {} }, wallet: { available: '0', reserved: '0' }, tools: [{ name: 'search_products', description: 'Search published products' }, { name: 'create_cart', description: 'Build a confirmed cart' }] };
let stored, aiStored, onboarding;
beforeEach(() => {
  history.replaceState({}, '', '/');
  onboarding = null; stored = structuredClone(settings); aiStored = structuredClone(ai);
  request.mockReset();
  request.mockImplementation(async (path, options) => {
    if (path === '/shop-admin/settings') { if (options) stored = { ...stored, ...JSON.parse(options.body) }; return structuredClone(stored); }
    if (path === '/shop-admin/sales-ai') { if (options) aiStored.settings = { ...JSON.parse(options.body), version: aiStored.settings.version + 1 }; return structuredClone(aiStored); }
    if (path === '/shop-admin/setup') { onboarding = JSON.parse(options.body); return { setup: onboarding }; }
    if (path === '/auth/me') return { user: { id: 1, role: 'owner' }, business: { id: 1, timezone: 'Asia/Yangon' }, subscription: { is_valid: true } };
    if (path === '/shop-admin/owner-location') return { submitted: true, setup: onboarding };
    return { items: [], total: 0, published_count: 0, has_more: false };
  });
});
function Harness({ initial = 1, close = vi.fn(), saved = vi.fn(), manage = vi.fn(), persistProgress = false, onCompleted }) {
  const [step, setStep] = useState(initial);
  return <ShopSetup step={step} onStep={setStep} onClose={close} onSaved={saved} onManage={manage} persistProgress={persistProgress} onCompleted={onCompleted} renderProducts={() => <div>Publication controls</div>} />;
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^(Save & continue|Save shop setup)$/ }));
const writes = path => request.mock.calls.filter(([url, options]) => url === path && options?.method === 'PUT');

it('uses five display steps while preserving shared progress IDs', () => {
  expect([1, 2, 3, 4, 5, 6, 7].map(setupDisplayStep)).toEqual([1, 2, 2, 2, 3, 4, 5]);
  expect([1, 2, 3, 4, 5].map(setupServerStage)).toEqual([1, 4, 5, 6, 7]);
  expect(nextSetupProgress(1)).toEqual({ status: 'pending', step: 4, version: 2 });
  expect(nextSetupProgress(5)).toEqual({ status: 'complete', step: 7, version: 2 });
});
it('matches each visible setup tab to its address-bar step number', async () => {
  onboarding = { status: 'pending', step: 1, version: 2 };
  render(<ShopScreen />);
  await screen.findByLabelText('Public shop name');
  const wizard = screen.getByRole('region', { name: 'Shop setup' });
  const tabs = within(wizard).getByRole('list', { name: 'Shop setup steps' });
  for (const [index, label] of ['Shop details', 'Payments', 'Products', 'Sales AI', 'Review'].entries()) {
    fireEvent.click(within(tabs).getAllByRole('button')[index]);
    await within(wizard).findByRole('heading', { name: label, exact: true });
    expect(new URLSearchParams(location.search).get('shopSetupStep')).toBe(String(index + 1));
  }
});

it('removes unused details and defaults to Retail while preserving hidden configuration', async () => {
  stored.price_type = 'Wholesale'; stored.description = 'Keep description'; stored.currency = 'MMK';
  stored.delivery_zones = [{ id: 'city', name: 'City', fee: 500 }]; stored.pickup_address = 'Saved pickup';
  render(<Harness />);
  await screen.findByLabelText('Public shop name');
  expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Online price type')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Shop description')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Fulfillment|Delivery zones/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Address').tagName).toBe('TEXTAREA');
  submit(); await screen.findByRole('button', { name: 'Add payment method' });
  expect(stored).toMatchObject({ price_type: 'Retail', currency: 'MMK', description: 'Keep description', pickup_address: 'Saved pickup', delivery_zones: [{ id: 'city', name: 'City', fee: 500 }] });
});

it.each([2, 3])('resumes removed server stage %s at Payments', async step => {
  onboarding = { status: 'pending', step, version: 2 };
  render(<ShopScreen />);
  await screen.findByRole('button', { name: 'Add payment method' });
  expect(screen.getByRole('heading', { name: 'Payments', exact: true })).toBeInTheDocument();
});

it('preserves hidden names and instructions for saved payment methods', async () => {
  stored.payment_methods.push({ id: 'wallet', name: 'Saved wallet', type: 'transfer', bank: 'KPay', instructions: 'Keep instructions', is_active: true });
  render(<Harness initial={2} />);
  await screen.findByLabelText('Bank / wallet');
  expect(screen.queryByLabelText('Method name')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Method type')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Customer instructions')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Account number / phone'), { target: { value: '0999999' } });
  submit(); await screen.findByText('Publication controls');
  expect(stored.payment_methods[1]).toMatchObject({ name: 'Saved wallet', instructions: 'Keep instructions', account_no: '0999999' });
});

it('saves shop details without publishing or replacing fulfillment and payment settings', async () => {
  render(<Harness />);
  fireEvent.change(await screen.findByLabelText('Public shop name'), { target: { value: 'Tea Shop' } });
  expect(screen.queryByLabelText('Online price type')).not.toBeInTheDocument();
  submit();
  await screen.findByRole('button', { name: 'Add payment method' });
  expect(stored).toMatchObject({ display_name: 'Tea Shop', price_type: 'Retail', storefront_enabled: false, accepting_orders: true, payment_methods: settings.payment_methods, pickup_instructions: 'At counter' });
  expect(writes('/shop-admin/settings')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  expect(screen.getByLabelText('Public shop name')).toHaveValue('Tea Shop');
});

it('adds and removes new rows, saves bank details and keeps at least one active method validation visible', async () => {
  render(<Harness initial={2} />);
  await screen.findByRole('button', { name: 'Add payment method' });
  expect(screen.queryByRole('heading', { name: 'Cash', exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add payment method' }));
  fireEvent.change(screen.getByLabelText('Bank / wallet'), { target: { value: 'KPay' } });
  fireEvent.change(screen.getByLabelText('Account number / phone'), { target: { value: '09999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add payment method' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove new payment method' })[1]);
  request.mockRejectedValueOnce(Object.assign(new Error('Check methods'), { payload: { errors: { payment_methods: ['Keep one active method.'] } } }));
  submit(); await screen.findByText('Keep one active method.'); submit();
  await screen.findByText('Publication controls');
  expect(stored.payment_methods).toHaveLength(2);
  expect(stored.payment_methods[0]).toEqual(settings.payment_methods[0]);
  expect(stored.payment_methods[1]).toMatchObject({ type: 'transfer', name: 'KPay', account_no: '09999', is_active: true });
});

it('edits only the AI toggle and name while preserving advanced settings and version', async () => {
  aiStored.settings.sales_policies = { delivery: 'Existing delivery policy' };
  render(<Harness initial={4} />);
  const toggle = await screen.findByRole('switch', { name: 'Enable Sales AI' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText('Representative name'), { target: { value: 'Tea assistant' } });
  expect(screen.queryByLabelText('Agent instructions')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Soul / personality')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Delivery policy')).not.toBeInTheDocument();
  expect(document.querySelector('.shop-setup-slide details')).toBeNull();
  expect(writes('/shop-admin/sales-ai')).toHaveLength(0);
  submit();
  await screen.findByRole('heading', { name: 'Review', exact: true });
  expect(aiStored.settings).toMatchObject({ enabled: true, name: 'Tea assistant', version: 2, instructions: ai.settings.instructions, soul: ai.settings.soul, tool_permissions: ['search_products'], sales_policies: { delivery: 'Existing delivery policy' } });
  expect(writes('/shop-admin/sales-ai')).toHaveLength(1);
  expect(JSON.parse(writes('/shop-admin/sales-ai')[0][1].body).version).toBe(1);
});

it('reloads a conflicting AI version while preserving shop drafts', async () => {
  render(<Harness />);
  fireEvent.change(await screen.findByLabelText('Public shop name'), { target: { value: 'Draft name' } });
  fireEvent.click(screen.getByRole('button', { name: /4Sales AI/ }));
  request.mockRejectedValueOnce(Object.assign(new Error('Changed elsewhere'), { status: 409 }));
  submit();
  await screen.findByText('Sales AI changed elsewhere. Reload its latest settings before saving again.');
  aiStored.settings.version = 3;
  fireEvent.click(screen.getByRole('button', { name: 'Reload Sales AI' }));
  await waitFor(() => expect(request.mock.calls.filter(([url]) => url === '/shop-admin/sales-ai')).toHaveLength(3));
  fireEvent.click(screen.getByRole('button', { name: /Shop details/ }));
  expect(screen.getByLabelText('Public shop name')).toHaveValue('Draft name');
});

it('reviews shop settings without a product summary and only enables the storefront after saving', async () => {
  const manage = vi.fn(); render(<Harness initial={5} manage={manage} />);
  await screen.findByRole('heading', { name: 'Review', exact: true });
  expect(screen.queryByRole('button', { name: 'Review products' })).not.toBeInTheDocument();
  expect(document.querySelector('.shop-setup-publication-summary')).toBeNull();
  expect(request.mock.calls.some(([url]) => url.startsWith('/shop-admin/publications?'))).toBe(false);
  expect(stored.storefront_enabled).toBe(false);
  expect(screen.getByRole('checkbox', { name: /Enable storefront/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /Accept new orders/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /List in marketplace/ })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: /List in marketplace/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: /5Review/ }));
  expect(screen.getByRole('checkbox', { name: /List in marketplace/ })).not.toBeChecked();
  submit();
  await screen.findByRole('heading', { name: 'Your shop setup is saved' });
  expect(stored.storefront_enabled).toBe(true);
  expect(stored.accepting_orders).toBe(true);
  expect(stored.marketplace_enabled).toBe(false);
  expect(screen.queryByRole('link', { name: /Open customer shop/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Manage products' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Review setup again' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Complete', exact: true }));
  expect(manage).toHaveBeenCalledWith('orders');
});

it('retries loading and prevents duplicate submissions while a save is pending', async () => {
  request.mockRejectedValueOnce(new Error('Unavailable'));
  render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry', exact: true }));
  await screen.findByLabelText('Public shop name');
  let finish; request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  submit();
  expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  fireEvent.submit(document.getElementById('shop-setup-form'));
  expect(writes('/shop-admin/settings')).toHaveLength(1);
  await act(async () => finish(stored));
  await screen.findByRole('button', { name: 'Add payment method' });
});

it('automatically opens setup required by empty shop data and resumes its saved step without menu links', async () => {
  onboarding = { status: 'pending', step: 1 };
  const view = render(<ShopScreen />);
  await screen.findByLabelText('Public shop name');
  expect(screen.queryByRole('button', { name: 'Shop setup', exact: true })).not.toBeInTheDocument();
  submit(); await screen.findByRole('button', { name: 'Add payment method' });
  expect(onboarding).toMatchObject({ status: 'pending', step: 4, version: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Close setup' }));
  await screen.findByRole('navigation', { name: 'Shop management sections' });
  expect(screen.queryByRole('region', { name: 'Shop setup' })).not.toBeInTheDocument();
  view.unmount();
  render(<ShopScreen />);
  await screen.findByRole('button', { name: 'Add payment method' });
  expect(screen.getByRole('heading', { name: 'Payments', exact: true })).toBeInTheDocument();
});

it.each([null, { status: 'complete', step: 7 }])('does not reopen configured or completed shops (%j)', async progress => {
  onboarding = progress;
  history.replaceState({}, '', '/?shopTab=setup&shopSetupStep=1');
  render(<ShopScreen />);
  await screen.findByRole('table', { name: 'Online orders' });
  expect(screen.queryByRole('region', { name: 'Shop setup' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Shop setup', exact: true })).not.toBeInTheDocument();
});

it('records completion so a reload cannot reopen the wizard', async () => {
  onboarding = { status: 'pending', step: 7 };
  const view = render(<ShopScreen />);
  await screen.findByRole('heading', { name: 'Review', exact: true });
  submit(); await screen.findByRole('heading', { name: 'Your shop setup is saved' });
  expect(onboarding).toMatchObject({ status: 'complete', step: 7, version: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Close setup' }));
  expect(screen.queryByRole('region', { name: 'Shop setup' })).not.toBeInTheDocument();
  view.unmount(); history.replaceState({}, '', '/?shopTab=setup');
  render(<ShopScreen />); await screen.findByRole('table', { name: 'Online orders' });
  expect(screen.queryByRole('region', { name: 'Shop setup' })).not.toBeInTheDocument();
});

it('does not expose setup to staff even when a setup URL is requested', async () => {
  onboarding = { status: 'pending', step: 6 };
  history.replaceState({}, '', '/?shopTab=setup&shopSetupStep=5');
  const original = request.getMockImplementation();
  request.mockImplementation((url, options) => url === '/auth/me' ? Promise.resolve({ user: { role: 'staff' }, permissions: ['ecommerce_orders'], subscription: { is_valid: true } }) : original(url, options));
  render(<ShopScreen />);
  await screen.findByRole('table', { name: 'Online orders' });
  expect(screen.queryByRole('region', { name: 'Shop setup' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Shop setup' })).not.toBeInTheDocument();
  expect(request.mock.calls.some(([url]) => url === '/shop-admin/sales-ai')).toBe(false);
});

it('does not show completion until durable progress is saved, and permits retry', async () => {
  const completed = vi.fn();
  const original = request.getMockImplementation(); let fail = true;
  request.mockImplementation((url, options) => {
    if (url === '/shop-admin/setup' && fail) { fail = false; return Promise.reject(new Error('Progress could not be saved')); }
    return original(url, options);
  });
  render(<Harness initial={5} persistProgress onCompleted={completed} />);
  await screen.findByRole('button', { name: 'Save shop setup' });
  submit(); await screen.findByText('Progress could not be saved');
  expect(completed).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'Your shop setup is saved' })).not.toBeInTheDocument();
  submit(); await screen.findByRole('heading', { name: 'Your shop setup is saved' });
  expect(onboarding.status).toBe('complete'); expect(completed).toHaveBeenCalledOnce();
});

it('reconciles a product published in setup into the retained source Publication table', async () => {
  onboarding = { status: 'pending', step: 5 };
  const product = { id: 5, name: 'Green tea', stock: 10, base_unit: 'Piece', unit: 'base', currency: 'Ks', base_price: 1000, price_type: 'Retail', published: false };
  const original = request.getMockImplementation();
  request.mockImplementation(async (url, options) => {
    if (url.startsWith('/shop-admin/publications?')) return { items: [{ ...product }], total: 1, published_count: Number(product.published) };
    if (url === '/shop-admin/publications/5') { Object.assign(product, JSON.parse(options.body)); return product; }
    return original(url, options);
  });
  render(<ShopScreen />);
  const setup = await screen.findByRole('region', { name: 'Shop setup' });
  fireEvent.click(await within(setup).findByRole('checkbox', { name: 'Publish Green tea online' }));
  await waitFor(() => expect(product.published).toBe(true));
  fireEvent.click(within(setup).getByRole('button', { name: 'Close setup' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Publication', exact: true }));
  const source = await screen.findByRole('table', { name: 'Product publication' });
  await waitFor(() => expect(within(source).getByRole('checkbox', { name: 'Publish Green tea online' })).toBeChecked());
});


