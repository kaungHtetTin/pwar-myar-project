import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessSetup } from './BusinessSetup';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { RefreshRegistrationContext } from '../navigation/pageRefresh';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const session = { user: { id: 3, role: 'owner' }, business: { id: 8, name: 'Mobile Store' } };
const fixture = (step = 1) => ({ progress: { step, status: step === 4 ? 'complete' : 'pending' }, business: { id: 8, name: 'Mobile Store', currency: 'Ks' }, basics: { name: 'Mobile Store', address: '', phone: '', currency: 'Ks', timezone: 'Asia/Yangon' }, payment_methods: ['Cash'], can_products: true, can_sell: true, product_count: 0, timezones: ['Asia/Yangon'] });
const navigate = vi.fn();
function Harness({ path = '/setup/business', ...props }) {
  const [pathname, setPathname] = useState(path);
  return <LocaleProvider><BusinessSetup session={session} pathname={pathname} onNavigate={(next, options) => { navigate(next, options); setPathname(next); }} onBack={setPathname} {...props} /></LocaleProvider>;
}
beforeEach(() => { apiRequest.mockReset(); navigate.mockClear(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState({}, '', '/setup/business'); });

describe('mobile business onboarding', () => {
  it('saves contact details and retains unsaved values, payments and locale through step navigation', async () => {
    let data = fixture();
    apiRequest.mockImplementation(async (_path, options) => {
      if (options?.method) {
        const payload = JSON.parse(options.body);
        if (payload.action === 'basics') data = { ...fixture(2), basics: { ...data.basics, ...payload } };
        else data = { ...data, progress: { step: 3, status: 'pending' }, payment_methods: payload.payment_methods };
      }
      return data;
    });
    render(<Harness />);
    fireEvent.change(await screen.findByLabelText('Business name'), { target: { value: 'My mobile shop' } });
    fireEvent.change(screen.getByLabelText('Business phone (optional)'), { target: { value: '09123456789' } });
    fireEvent.change(screen.getByLabelText('Business address (optional)'), { target: { value: 'Market Road\nYangon' } });
    fireEvent.click(screen.getByRole('switch', { name: 'English / မြန်မာ' }));
    expect(await screen.findByLabelText('လုပ်ငန်းအမည်')).toHaveValue('My mobile shop');
    fireEvent.click(screen.getByRole('switch', { name: 'English / မြန်မာ' }));
    await screen.findByLabelText('Business name');
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByRole('heading', { name: 'Payments' });
    const saved = apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(JSON.parse(saved[1].body)).toMatchObject({ action: 'basics', name: 'My mobile shop', address: 'Market Road\nYangon', phone: '09123456789' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'KPay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(await screen.findByLabelText('Business phone (optional)')).toHaveValue('09123456789');
    expect(screen.getByLabelText('Business address (optional)')).toHaveValue('Market Road\nYangon');
    fireEvent.click(screen.getByRole('button', { name: /Payments/ }));
    await screen.findByRole('heading', { name: 'Payments' });
    expect(screen.getByRole('checkbox', { name: 'KPay' })).toBeChecked();
    expect(apiRequest.mock.calls.filter(([, options]) => !options?.method)).toHaveLength(1);
  });

  it('converts purchase units and retries finishing without creating another product', async () => {
    let saved = false, attempts = 0;
    apiRequest.mockImplementation(async (path, options) => {
      if (path === '/business-setup/product') { saved = true; return { ...fixture(3), product_count: 1, progress: { step: 3, status: 'pending', product_id: 77 } }; }
      if (options?.method === 'PUT') {
        if (++attempts === 1) throw new Error('Please retry completion');
        return { ...fixture(4), product_count: 1 };
      }
      return fixture(3);
    });
    render(<Harness path="/setup/product" />);
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Water' } });
    fireEvent.change(screen.getByLabelText('Selling price per Piece (Ks)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Buy in a different unit?' }));
    fireEvent.change(screen.getByLabelText('Purchase unit'), { target: { value: 'Carton' } });
    fireEvent.change(screen.getByLabelText('How many Piece in 1 Carton?'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Stock entry unit'), { target: { value: 'purchase' } });
    fireEvent.change(screen.getByLabelText('Cost entry unit'), { target: { value: 'purchase' } });
    fireEvent.change(screen.getByLabelText('Opening stock (Carton)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Purchase cost per Carton (Ks)'), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product & finish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please retry completion');
    expect(saved).toBe(true);
    const productCall = apiRequest.mock.calls.find(([path]) => path === '/business-setup/product');
    expect(JSON.parse(productCall[1].body)).toMatchObject({ name: 'Water', stock: 24, cost: 1000, purchase_conversion_factor: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup', exact: true }));
    await screen.findByRole('heading', { name: 'Your business is ready' });
    expect(apiRequest.mock.calls.filter(([path]) => path === '/business-setup/product')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Start selling' }));
    expect(navigate).toHaveBeenLastCalledWith('/sell', { replace: true });
  });

  it.each([{ role: 'staff' }, { offline: true }])('does not load onboarding for excluded users %j', async ({ role, offline }) => {
    render(<Harness session={{ ...session, user: { ...session.user, role: role || 'owner' } }} offlineMode={offline} />);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it.each([null, { step: 4, status: 'complete' }])('does not open old setup links for progress %j', async progress => {
    apiRequest.mockResolvedValue({ ...fixture(), progress });
    render(<Harness />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/sell', { replace: true }));
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
  });

  it('keeps field validation and drafts when saving fails', async () => {
    apiRequest.mockImplementation(async (_path, options) => {
      if (options?.method) throw Object.assign(new Error('Check the phone'), { payload: { errors: { phone: ['Invalid phone'] } } });
      return fixture();
    });
    render(<Harness />);
    fireEvent.change(await screen.findByLabelText('Business phone (optional)'), { target: { value: 'bad phone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByText('Invalid phone');
    expect(screen.getByLabelText('Business phone (optional)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Business phone (optional)')).toHaveValue('bad phone');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('registers shared refresh and preserves an edited draft during refresh', async () => {
    apiRequest.mockResolvedValue(fixture());
    let refresh;
    const register = fn => { refresh = fn; return () => {}; };
    render(<RefreshRegistrationContext.Provider value={register}><Harness /></RefreshRegistrationContext.Provider>);
    fireEvent.change(await screen.findByLabelText('Business name'), { target: { value: 'Unsaved draft' } });
    await act(async () => refresh());
    expect(screen.getByLabelText('Business name')).toHaveValue('Unsaved draft');
    expect(apiRequest.mock.calls.filter(([path]) => path === '/business-setup')).toHaveLength(2);
  });

  it('shows validation for an individual payment method beside the custom methods input', async () => {
    apiRequest.mockImplementation(async (_path, options) => {
      if (options?.method) throw Object.assign(new Error('Payment invalid'), { payload: { errors: { 'payment_methods.1': ['Use a shorter payment name'] } } });
      return fixture(2);
    });
    render(<Harness path="/setup/payments" />);
    const methods = await screen.findByLabelText('Other payment methods (optional)');
    fireEvent.change(methods, { target: { value: 'A long custom payment method' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    await screen.findByText('Use a shorter payment name');
    expect(methods).toHaveAttribute('aria-invalid', 'true');
    expect(methods).toHaveValue('A long custom payment method');
  });

  it('resumes deferred onboarding from its reminder without a navigation-drawer entry', async () => {
    sessionStorage.setItem('mkpos-mobile-setup-deferred:8:3', '1');
    apiRequest.mockResolvedValue(fixture(2));
    render(<Harness path="/products" />);
    await screen.findByRole('button', { name: 'Resume setup' });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume setup' }));
    await screen.findByRole('heading', { name: 'Payments' });
    fireEvent.click(screen.getByRole('button', { name: 'Finish later' }));
    expect(navigate).toHaveBeenLastCalledWith('/products', { replace: true });
    expect(sessionStorage.getItem('mkpos-mobile-setup-deferred:8:3')).toBe('1');
  });

  it('retries initial loading and permits completion without product permission', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Setup unavailable')).mockResolvedValue({ ...fixture(3), can_products: false });
    render(<Harness path="/setup/product" />);
    await screen.findByText('Setup unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Product management is not enabled for this business. You can finish setup now.');
    apiRequest.mockResolvedValue({ ...fixture(4), can_products: false });
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup', exact: true }));
    await screen.findByRole('heading', { name: 'Your business is ready' });
    expect(apiRequest.mock.calls.some(([path]) => path === '/business-setup/product')).toBe(false);
  });
});
