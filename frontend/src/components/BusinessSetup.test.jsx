import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessSetup } from './BusinessSetup';
import { request } from '../api';

vi.mock('../api', () => ({ request: vi.fn() }));
const session = { user: { id: 1, role: 'owner' }, business: { id: 2, name: 'Fixture' } };
const fixture = (step = 1) => ({ progress: { step, status: 'pending' }, business: { id: 2, name: 'Fixture', currency: 'Ks' }, basics: { name: 'Fixture', currency: 'Ks', timezone: 'Asia/Yangon' }, payment_methods: ['Cash'], product_count: 0, can_products: true, can_sell: true, timezones: ['Asia/Yangon'] });

beforeEach(() => { request.mockReset(); sessionStorage.clear(); window.history.replaceState({}, '', '/'); });
const renderSetup = () => render(<BusinessSetup session={session} onNavigate={vi.fn()}><button>Retained workspace</button></BusinessSetup>);

describe('business setup', () => {
  it('saves business basics and restores the saved slide after reopening', async () => {
    let model = fixture();
    request.mockImplementation(async (path, options) => {
      if (options?.method) {
        const { name, address, phone, currency, timezone } = JSON.parse(options.body);
        model = { ...fixture(2), basics: { name, address, phone, currency, timezone } };
      }
      return model;
    });
    const view = renderSetup();
    fireEvent.change(await screen.findByLabelText('Business name'), { target: { value: 'New name' } });
    fireEvent.change(screen.getByLabelText('Business phone (optional)'), { target: { value: '09123456789' } });
    fireEvent.change(screen.getByLabelText('Business address (optional)'), { target: { value: 'No. 12, Market Road\nYangon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    const saved = request.mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(JSON.parse(saved[1].body)).toEqual({ action: 'basics', name: 'New name', address: 'No. 12, Market Road\nYangon', phone: '09123456789', currency: 'Ks', timezone: 'Asia/Yangon' });
    view.unmount(); renderSetup();
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Business basics/ }));
    expect(await screen.findByLabelText('Business phone (optional)')).toHaveValue('09123456789');
    expect(screen.getByLabelText('Business address (optional)')).toHaveValue('No. 12, Market Road\nYangon');
  });

  it('uploads, replaces and removes an optional logo without changing business details', async () => {
    const logo = 'data:image/png;base64,bG9nbw==';
    request.mockImplementation(async (path, options) => path === '/settings/logo'
      ? { receipt_logo_data_url: options.method === 'DELETE' ? '' : logo }
      : fixture());
    renderSetup();
    const name = await screen.findByLabelText('Business name');
    fireEvent.change(name, { target: { value: 'Unsaved name' } });
    const chooser = screen.getByLabelText('Business logo file');
    const image = new File(['image'], 'logo.png', { type: 'image/png' });
    fireEvent.change(chooser, { target: { files: [image] } });
    expect(await screen.findByAltText('Current business logo')).toHaveAttribute('src', logo);
    const upload = request.mock.calls.find(([path]) => path === '/settings/logo');
    expect(upload[1].method).toBe('POST');
    expect(upload[1].body.get('logo')).toBe(image);
    expect(name).toHaveValue('Unsaved name');
    expect(screen.getByRole('button', { name: 'Replace logo' })).toBeInTheDocument();
    fireEvent.change(chooser, { target: { files: [new File(['replacement'], 'new.png', { type: 'image/png' })] } });
    await waitFor(() => expect(request.mock.calls.filter(([path]) => path === '/settings/logo')).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove logo' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    await waitFor(() => expect(screen.queryByAltText('Current business logo')).not.toBeInTheDocument());
    expect(request).toHaveBeenCalledWith('/settings/logo', expect.objectContaining({ method: 'DELETE' }));
    expect(name).toHaveValue('Unsaved name');
  });

  it('keeps an existing logo when an upload fails and allows continuing without a logo', async () => {
    const logo = 'data:image/png;base64,bG9nbw==';
    request.mockImplementation(async (path, options) => {
      if (path === '/settings/logo') throw new Error('Upload failed. Try again.');
      return { ...fixture(options?.method ? 2 : 1), receipt_logo_data_url: logo };
    });
    renderSetup();
    expect(await screen.findByAltText('Current business logo')).toHaveAttribute('src', logo);
    fireEvent.change(screen.getByLabelText('Business logo file'), { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WebP');
    expect(request.mock.calls.filter(([path]) => path === '/settings/logo')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Business logo file'), { target: { files: [new File(['image'], 'logo.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
    expect(screen.getByAltText('Current business logo')).toHaveAttribute('src', logo);
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
  });

  it('allows finishing when product management is unavailable', async () => {
    request.mockImplementation(async (path, options) => ({ ...(options?.method ? { ...fixture(4), progress: { step: 4, status: 'complete' } } : fixture(3)), can_products: false }));
    renderSetup();
    await screen.findByText('Product management is not enabled for this business. You can finish setup now.');
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(await screen.findByRole('heading', { name: 'Your business is ready' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open workspace', exact: true })).toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path === '/business-setup/product')).toBe(false);
  });

  it('shows only the product form without import or skip options', async () => {
    request.mockResolvedValue(fixture(3));
    renderSetup();
    expect(await screen.findByLabelText('Product name')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import CSV|Do this later|Choose CSV/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save product & finish' })).toBeInTheDocument();
  });

  it('converts pack entries and retries completion without creating another product', async () => {
    let saved = false, finished = false;
    request.mockImplementation(async (path, options) => {
      if (path === '/business-setup/product') { saved = true; return { ...fixture(3), progress: { step: 3, status: 'pending', product_id: 12 }, product_count: 1 }; }
      if (options?.method) {
        if (!finished) { finished = true; throw new Error('Please retry completion'); }
        return { ...fixture(4), progress: { step: 4, status: 'complete', product_id: 12 }, product_count: 1 };
      }
      return fixture(3);
    });
    renderSetup();
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
    expect(JSON.parse(request.mock.calls.find(([path]) => path === '/business-setup/product')[1].body)).toMatchObject({ stock: 24, cost: 1000, price: 1500 });
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Your business is ready' })).toBeInTheDocument();
    expect(request.mock.calls.filter(([path]) => path === '/business-setup/product')).toHaveLength(1);
  });

  it('does not start onboarding for existing businesses, including the old launch event', async () => {
    request.mockResolvedValue({ ...fixture(), progress: null });
    renderSetup();
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
    await act(async () => window.dispatchEvent(new Event('mkpos:business-setup')));
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retained workspace' })).toBeVisible();
    expect(request.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  });

  it.each([null, { step: 4, status: 'complete' }])('does not reopen onboarding from a direct link when progress is %s', async progress => {
    window.history.replaceState({}, '', '/?setup=1&setupStep=1');
    request.mockResolvedValue({ ...fixture(), progress });
    renderSetup();
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retained workspace' })).toBeVisible();
  });

  it('ignores an older initial response after the owner explicitly resumes setup', async () => {
    let releaseInitial;
    request.mockImplementationOnce(() => new Promise(resolve => { releaseInitial = resolve; })).mockResolvedValue(fixture(2));
    renderSetup();
    await act(async () => window.dispatchEvent(new Event('mkpos:business-setup')));
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    await act(async () => releaseInitial(fixture(1)));
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
  });

  it('does not request setup or interrupt staff', async () => {
    render(<BusinessSetup session={{ ...session, user: { id: 3, role: 'staff' } }} onNavigate={vi.fn()}><p>Staff workspace</p></BusinessSetup>);
    expect(screen.getByText('Staff workspace')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('cancels a pending transition when browser navigation returns to the current draft', async () => {
    request.mockResolvedValue(fixture(3));
    renderSetup();
    const name = await screen.findByLabelText('Product name');
    fireEvent.change(name, { target: { value: 'Unfinished product' } });
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    const cancel = vi.fn(() => finish());
    name.closest('form').animate = vi.fn(() => ({ finished, cancel }));
    fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(screen.getByRole('button', { name: 'Save product & finish' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Add a product' })).toBeInTheDocument();
    await act(async () => {
      window.history.replaceState({}, '', '/?setup=1&setupStep=3');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Product name')).toBe(name);
    expect(name).toHaveValue('Unfinished product');
    expect(screen.getByRole('button', { name: 'Save product & finish' })).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
