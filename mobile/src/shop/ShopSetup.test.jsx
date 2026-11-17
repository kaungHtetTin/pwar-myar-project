import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopSetup } from './ShopSetup';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { shopSetupPayload, mobileShopSetupStep, nextShopSetupProgress } from './shopSetupModel';
import { appBarRoute } from '../navigation/appBarRoute';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const session = { user: { id: 3, role: 'owner' }, business: { id: 8 }, subscription: { is_valid: true } };
const navigate = vi.fn();
const fixture = () => ({ display_name: 'Corner Shop', slug: 'corner-shop', currency: 'Ks', price_type: 'Retail', price_types: ['Retail'], phone: '0912345', address: 'Yangon', description: '', pickup_address: '', pickup_hours: '', pickup_instructions: '', delivery_zones: [], payment_methods: [{ id: 'cash', type: 'cash', name: 'Cash', is_active: true }], storefront_enabled: false, accepting_orders: false, marketplace_enabled: false, announcement: 'Preserve me', opening_hours: { monday: [] } });
let settings, ai, location, failProgress;
function Harness({ path = '/shop', ...props }) {
  const [pathname, setPath] = useState(path);
  return <LocaleProvider><ShopSetup session={session} pathname={pathname} onNavigate={(next, options) => { navigate(next, options); setPath(next); }} onBack={setPath} {...props} /></LocaleProvider>;
}
beforeEach(() => {
  navigate.mockClear(); apiRequest.mockReset(); localStorage.clear(); sessionStorage.clear();
  settings = fixture(); ai = { settings: { enabled: false, name: 'Shop assistant', instructions: 'Keep instructions', soul: 'Keep soul', tool_permissions: { search: true }, sales_policies: {}, version: 3 }, wallet: { available: 5 } };
  location = { submitted: true, setup: { status: 'pending', step: 1, version: 2 } }; failProgress = false;
  apiRequest.mockImplementation(async (path, options) => {
    if (path === '/shop-admin/owner-location') return location;
    if (path === '/shop-admin/settings') { if (options?.method) settings = { ...settings, ...JSON.parse(options.body) }; return settings; }
    if (path === '/shop-admin/sales-ai') { if (options?.method) ai = { ...ai, settings: JSON.parse(options.body) }; return ai; }
    if (path === '/shop-admin/setup') { if (failProgress) { failProgress = false; throw new Error('Progress failed. Retry.'); } return { setup: JSON.parse(options.body) }; }
    if (path.startsWith('/shop-admin/publications')) return { items: [{ id: 1, name: 'Tea', base_unit: 'Piece', stock: 8, base_price: 1500, currency: 'Ks', unit: 'base', published: false }], total: 1, has_more: false };
    throw new Error(`Unexpected ${path}`);
  });
});

describe('mobile shop setup', () => {
  it('maps the five mobile stages to the shared server progress contract', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(mobileShopSetupStep)).toEqual([1, 2, 2, 2, 3, 4, 5]);
    expect([1, 2, 3, 4, 5].map(nextShopSetupProgress)).toEqual([
      { status: 'pending', step: 4, version: 2 }, { status: 'pending', step: 5, version: 2 },
      { status: 'pending', step: 6, version: 2 }, { status: 'pending', step: 7, version: 2 },
      { status: 'complete', step: 7, version: 2 },
    ]);
  });
  it('uses Shop details as the Payments Back destination', () => {
    expect(appBarRoute('/shop/setup/payments').backPath).toBe('/shop/setup/details');
  });
  it.each(['/shop/setup/pickup', '/shop/setup/delivery'])('redirects removed setup route %s to payments', async path => {
    render(<Harness path={path} />);
    await screen.findByRole('heading', { name: 'Payments' });
    expect(navigate).toHaveBeenCalledWith('/shop/setup/payments', { replace: true });
    expect(screen.queryByRole('button', { name: 'Fulfillment', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delivery zones', exact: true })).not.toBeInTheDocument();
  });
  it('preserves existing pickup and delivery settings without exposing their tabs', async () => {
    settings.pickup_address = 'Saved pickup'; settings.delivery_zones = [{ id: 'zone', name: 'Downtown', fee: 2000 }];
    render(<Harness path="/shop/setup/details" />);
    await screen.findByLabelText('Phone');
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Payments' });
    expect(settings.pickup_address).toBe('Saved pickup');
    expect(settings.delivery_zones).toEqual([{ id: 'zone', name: 'Downtown', fee: 2000 }]);
    const progress = apiRequest.mock.calls.find(([path]) => path === '/shop-admin/setup');
    expect(JSON.parse(progress[1].body)).toEqual({ status: 'pending', step: 4, version: 2 });
  });
  it('enters pending setup by data, preserves drafts and locale through step navigation without return fetches', async () => {
    render(<Harness />);
    fireEvent.change(await screen.findByLabelText('Public shop name'), { target: { value: 'My Shop Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Payments', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add payment method' }));
    fireEvent.change(screen.getByLabelText('Bank / wallet'), { target: { value: 'Draft KPay' } });
    fireEvent.click(screen.getByRole('button', { name: 'Shop details', exact: true }));
    expect(await screen.findByLabelText('Public shop name')).toHaveValue('My Shop Draft');
    fireEvent.click(screen.getByRole('switch', { name: 'English / မြန်မာ' }));
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'my');
    expect(apiRequest.mock.calls.filter(([path]) => path === '/shop-admin/settings')).toHaveLength(1);
    expect(apiRequest.mock.calls.filter(([path]) => path === '/shop-admin/owner-location')).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith('/shop/setup/details', undefined);
  });
  it.each([{ role: 'staff' }, { offline: true }, { enabled: false }])('excludes ineligible users %j', props => {
    render(<Harness session={{ ...session, user: { ...session.user, role: props.role || 'owner' } }} offlineMode={props.offline} enabled={props.enabled ?? true} />);
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it.each([null, { status: 'complete', step: 7 }])('does not automatically open configured shop %j', async setup => {
    location.setup = setup;
    render(<Harness />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
  it('starts immediately after scoped location approval and resumes the saved stage', async () => {
    location = { submitted: false, setup: null };
    render(<Harness />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    await act(async () => window.dispatchEvent(new CustomEvent('mkpos:shop-location-updated', { detail: { businessId: 99, submitted: true, setup: { status: 'pending', step: 3 } } })));
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => window.dispatchEvent(new CustomEvent('mkpos:shop-location-updated', { detail: { businessId: 8, submitted: true, setup: { status: 'pending', step: 3 } } })));
    await screen.findByRole('heading', { name: 'Payments' });
    expect(navigate).toHaveBeenCalledWith('/shop/setup/payments', undefined);
  });
  it('ignores an old location read after GPS approval', async () => {
    let resolveLocation;
    const original = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => path === '/shop-admin/owner-location' ? new Promise(resolve => { resolveLocation = resolve; }) : original(path, options));
    render(<Harness />);
    await act(async () => window.dispatchEvent(new CustomEvent('mkpos:shop-location-updated', { detail: { businessId: 8, submitted: true, setup: { status: 'pending', step: 1 } } })));
    await screen.findByLabelText('Public shop name');
    await act(async () => resolveLocation({ submitted: false, setup: null }));
    expect(screen.getByLabelText('Public shop name')).toBeVisible();
    expect(navigate).not.toHaveBeenCalledWith('/shop/location', expect.anything());
  });
  it('redirects a direct setup URL to location approval when needed', async () => {
    location = { submitted: false, setup: null };
    render(<Harness path="/shop/setup/review" />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shop/location', { replace: true }));
    expect(apiRequest.mock.calls.some(([path]) => path === '/shop-admin/settings')).toBe(false);
  });
  it('closes a direct setup entry to Shop instead of its preceding wizard step', async () => {
    render(<Harness path="/shop/setup/payments" />);
    await screen.findByRole('button', { name: 'Add payment method' });
    fireEvent.click(screen.getByRole('button', { name: 'Close setup' }));
    expect(navigate).toHaveBeenLastCalledWith('/shop', { replace: true });
  });
  it('cancels from the bottom action bar without saving the current step', async () => {
    render(<Harness path="/shop/setup/payments" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add payment method' }));
    fireEvent.change(screen.getByLabelText('Bank / wallet'), { target: { value: 'Unsaved bank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(navigate).toHaveBeenLastCalledWith('/shop', { replace: true });
    expect(apiRequest.mock.calls.some(([, options]) => options?.method)).toBe(false);
  });
  it('saves only current-step fields and never opens the shop before final review', async () => {
    render(<Harness path="/shop/setup/details" />);
    fireEvent.change(await screen.findByLabelText('Phone'), { target: { value: '099999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Payments' });
    expect(settings).toMatchObject({ phone: '099999', storefront_enabled: false, accepting_orders: false, marketplace_enabled: false, announcement: 'Preserve me' });
    expect(screen.queryByText('Announcement')).not.toBeInTheDocument();
    expect(screen.queryByText('Review products')).not.toBeInTheDocument();
  });
  it('preserves cash and existing Sales AI fields while exposing only its toggle and name', async () => {
    render(<Harness path="/shop/setup/payments" />);
    await screen.findByRole('button', { name: 'Add payment method' });
    expect(screen.queryByText('Cash')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Products' });
    expect(settings.payment_methods).toEqual(fixture().payment_methods);
    fireEvent.click(screen.getByRole('button', { name: 'Sales AI', exact: true }));
    fireEvent.click(await screen.findByRole('switch', { name: 'Enable Sales AI' }));
    fireEvent.change(screen.getByLabelText('Representative name'), { target: { value: 'Mya' } });
    expect(screen.queryByLabelText('Instructions')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Review' });
    expect(ai.settings).toMatchObject({ enabled: true, name: 'Mya', instructions: 'Keep instructions', soul: 'Keep soul', version: 3 });
  });
  it('adds and removes transfer methods and saves checkout availability', async () => {
    render(<Harness path="/shop/setup/payments" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add payment method' }));
    fireEvent.change(screen.getByLabelText('Bank / wallet'), { target: { value: 'Unwanted draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove new payment method' }));
    expect(screen.queryByLabelText('Bank / wallet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add payment method' }));
    fireEvent.change(screen.getByLabelText('Bank / wallet'), { target: { value: 'KPay' } });
    fireEvent.change(screen.getByLabelText('Account number / phone'), { target: { value: '0999999' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Available at checkout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Products' });
    expect(settings.payment_methods[0]).toMatchObject({ type: 'cash', is_active: true });
    expect(settings.payment_methods[1]).toMatchObject({ name: 'KPay', type: 'transfer', account_no: '0999999', is_active: false });
  });
  it('hides payment names and customer instructions while preserving existing values', async () => {
    settings.payment_methods.push({ id: 'wallet', type: 'transfer', name: 'Existing wallet', bank: 'KPay', instructions: 'Keep saved instructions', is_active: true });
    render(<Harness path="/shop/setup/payments" />);
    await screen.findByLabelText('Bank / wallet');
    expect(screen.queryByLabelText('Method name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Customer instructions')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account number / phone'), { target: { value: '099999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Products' });
    expect(settings.payment_methods[1]).toMatchObject({ name: 'Existing wallet', instructions: 'Keep saved instructions', account_no: '099999' });
  });
  it('provides a valid default name for a new transfer without a bank label', () => {
    const data = fixture();
    const result = shopSetupPayload(data, { ...data, payment_methods: [...data.payment_methods, { id: 'new', type: 'transfer', bank: '', name: '', instructions: '' }] }, 2);
    expect(result.payment_methods[1].name).toBe('Bank transfer');
  });
  it('reloads AI concurrency conflicts before retrying with the new version', async () => {
    const original = apiRequest.getMockImplementation();
    let conflict = true;
    apiRequest.mockImplementation(async (path, options) => {
      if (path === '/shop-admin/sales-ai' && options?.method && conflict) {
        conflict = false; ai = { ...ai, settings: { ...ai.settings, version: 4, instructions: 'Updated elsewhere' } };
        throw Object.assign(new Error('Version conflict'), { status: 409 });
      }
      return original(path, options);
    });
    render(<Harness path="/shop/setup/sales-ai" />);
    await screen.findByLabelText('Representative name');
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reload Sales AI' }));
    fireEvent.change(await screen.findByLabelText('Representative name'), { target: { value: 'Mya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Review' });
    expect(ai.settings).toMatchObject({ name: 'Mya', version: 4, instructions: 'Updated elsewhere' });
  });
  it('validates upload type before sending the file', async () => {
    render(<Harness path="/shop/setup/details" />);
    const input = await screen.findByLabelText('Cover photo file');
    fireEvent.change(input, { target: { files: [new File(['text'], 'cover.txt', { type: 'text/plain' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('JPEG, PNG or WebP');
    expect(apiRequest.mock.calls.some(([path]) => path === '/shop-admin/cover')).toBe(false);
  });
  it('checks all review options, retains data on progress failure and retries completion', async () => {
    render(<Harness path="/shop/setup/review" />);
    expect(await screen.findByRole('checkbox', { name: /Enable storefront/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Accept new orders/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /List in marketplace/ })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /List in marketplace/ }));
    failProgress = true;
    fireEvent.click(screen.getByRole('button', { name: 'Save shop setup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Progress failed');
    expect(screen.queryByRole('heading', { name: 'Your shop setup is saved' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save shop setup' }));
    await screen.findByRole('heading', { name: 'Your shop setup is saved' });
    expect(settings).toMatchObject({ storefront_enabled: true, accepting_orders: true, marketplace_enabled: false });
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(navigate).toHaveBeenLastCalledWith('/shop', { replace: true, reset: true });
  });
  it('does not render a numeric zero for an unsuspended marketplace', async () => {
    settings.marketplace_suspended = 0;
    render(<Harness path="/shop/setup/review" />);
    await screen.findByRole('checkbox', { name: /Enable storefront/ });
    expect(screen.getByRole('checkbox', { name: /List in marketplace/ })).toBeChecked();
    expect(screen.queryByText('0', { exact: true, selector: 'fieldset' })).not.toBeInTheDocument();
  });
  it('shows only Complete as its completion action and returns to the Shop root', async () => {
    render(<Harness path="/shop/setup/review" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save shop setup' }));
    await screen.findByRole('heading', { name: 'Your shop setup is saved' });
    expect(screen.queryByRole('link', { name: 'Open customer shop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage products' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sales AI balance book' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete', exact: true }));
    expect(navigate).toHaveBeenLastCalledWith('/shop', { replace: true, reset: true });
  });
  it('does not navigate from a late successful save after Back', async () => {
    let resolve;
    const original = apiRequest.getMockImplementation();
    apiRequest.mockImplementation((path, options) => path === '/shop-admin/settings' && options?.method ? new Promise(done => { resolve = done; }) : original(path, options));
    const { rerender } = render(<LocaleProvider><ShopSetup session={session} pathname="/shop/setup/details" onNavigate={navigate} /></LocaleProvider>);
    await screen.findByLabelText('Public shop name');
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    rerender(<LocaleProvider><ShopSetup session={session} pathname="/shop" onNavigate={navigate} /></LocaleProvider>);
    await act(async () => resolve(settings));
    expect(navigate).not.toHaveBeenCalledWith('/shop/setup/payments');
  });
  it('retains all untouched fields in payloads', () => {
    const result = shopSetupPayload(fixture(), { ...fixture(), storefront_enabled: true, description: 'New' }, 1);
    expect(result).toMatchObject({ storefront_enabled: false, description: '', announcement: 'Preserve me' });
    expect(result).not.toHaveProperty('price_types');
  });
  it('omits currency, price selector and description and saves Retail by default', async () => {
    settings.price_type = 'Wholesale'; settings.currency = 'MMK'; settings.description = 'Existing description';
    render(<Harness path="/shop/setup/details" />);
    await screen.findByLabelText('Public shop name');
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Online price type')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Shop description')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Payments' });
    expect(settings).toMatchObject({ price_type: 'Retail', currency: 'MMK', description: 'Existing description' });
  });
});
