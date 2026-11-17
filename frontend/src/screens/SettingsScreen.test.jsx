import { emitDataChange } from '../dataEvents';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from './SettingsScreen';
import { request, requestDownload } from '../api';
import { NotificationProvider } from '../components/notifications';
import { ConfirmationProvider } from '../components/confirmations';

vi.mock('../api', () => ({
  request: vi.fn(),
  requestDownload: vi.fn(),
}));

const settings = {
  shop_name: 'PwarMyar Shop',
  shop_title: '',
  shop_address: '',
  shop_phone: '',
  currency: 'Ks',
  payment_methods: 'Cash',
  receipt_footer: 'Thank you',
  receipt_show_customer: '1',
  receipt_show_payment_method: '1',
  receipt_show_price_type: '1',
  receipt_paper_size: '80mm',
  receipt_header_alignment: 'center',
  receipt_margin_left: 3,
  receipt_margin_right: 3,
  receipt_header_font_size: 11,
  receipt_body_font_size: 8.2,
  receipt_line_height: 1.45,
  printer_name: '',
  language: 'en',
  admin_pin: '',
  admin_pin_set: '0',
};

const session = {
  user: { id: 1, name: 'Current Owner', email: 'owner@example.com', role: 'owner' },
  business: { id: 1, name: 'Current Shop', currency: 'Ks' },
  subscription: { is_valid: true },
};

describe('SettingsScreen', () => {
  beforeEach(() => {
    request.mockReset();
    requestDownload.mockReset();
  });

  afterEach(() => {
    delete window.mkposDesktop;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.showSaveFilePicker;
  });

  it('shows staff only profile, receipt, printer, and about settings', async () => {
    request.mockImplementation(async (path) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return { ...session, user: { ...session.user, role: 'staff' } };
      if (path === '/settings/printers') return { items: [] };
      throw new Error(`Unexpected owner-only request: ${path}`);
    });

    render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);

    expect(await screen.findByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receipt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Printer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Security' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Data' })).not.toBeInTheDocument();
  });

  it('shows a single live barcode sticker preview', async () => {
    request.mockImplementation(async (path) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return { ...session, user: { ...session.user, role: 'staff' } };
      if (path === '/settings/printers') return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
    await screen.findByRole('button', { name: 'Save account' });
    fireEvent.click(await screen.findByRole('button', { name: 'Barcode' }));

    const preview = await screen.findByLabelText('Barcode sticker live preview');
    expect(preview).toHaveTextContent('Sample Product');
    expect(preview).toHaveTextContent('2008934580979');
    expect(preview.querySelectorAll('.barcode-live-preview-label')).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show barcode number' }));
    expect(preview).not.toHaveTextContent('2008934580979');
  });

  it.each(['web', 'desktop'])('separates receipt and printer controls in %s settings', async (mode) => {
    if (mode === 'desktop') window.mkposDesktop = {
      getPrinters: vi.fn().mockResolvedValue(['Canon']),
      getPrinterConfig: vi.fn().mockResolvedValue({ connection: 'windows', windows: { printerName: 'Canon', copies: 1, color: true, landscape: false, silent: false }, documentPrinterName: '', receiptLayout: null }),
    };
    request.mockImplementation(async (path) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return session;
      if (path === '/data/status') return { ok: true, schema_version: 2 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      if (path === '/settings/receipt-preview') return { text: 'Sample', paper_size: '80mm' };
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
    expect(await screen.findByLabelText('Shop Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Receipt Title')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Receipt' }));
    expect(screen.getByLabelText('Receipt Title')).toBeInTheDocument();
    expect(await screen.findByLabelText('Header Alignment')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Printer Name' })).not.toBeInTheDocument();
    const oldPanel = document.querySelector('.settings-panel-content');
    oldPanel.scrollTop = 300;
    fireEvent.click(screen.getByRole('button', { name: 'Printer' }));
    expect(await screen.findByRole('combobox', { name: 'Printer Name' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Header Alignment')).not.toBeInTheDocument();
    expect(document.querySelector('.settings-panel-content').scrollTop).toBe(0);
    expect(screen.getByRole('button', { name: 'Test Print' })).toBeInTheDocument();
  });

  it('disables backup and restore controls for a free trial and links owners to Billing', async () => {
    request.mockImplementation(async (path) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return { ...session, subscription: { is_valid: true, access_type: 'trial' } };
      if (path === '/data/status') return { ok: true, schema_version: 2, total_records: 12 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });
    const navigateBilling = vi.fn();
    window.addEventListener('mkpos:navigate-billing', navigateBilling, { once: true });

    render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Data' }));

    expect(screen.getByRole('status')).toHaveTextContent('Backup download and data restore require a paid plan.');
    expect(screen.getByRole('button', { name: /Save Backup File/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Choose Restore File/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'View Billing' }));
    expect(navigateBilling).toHaveBeenCalledOnce();
  });

  it('shows customizable receipt controls and a current-shop sample preview', async () => {
    const logo = 'data:image/png;base64,aGVsbG8=';
    request.mockImplementation(async (path) => {
      if (path === '/settings') return { ...settings, shop_name: 'Current Shop', receipt_logo_data_url: logo };
      if (path === '/auth/me') return session;
      if (path === '/data/status') return { ok: true, schema_version: 2 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      if (path === '/settings/receipt-preview') {
        return {
          text: 'Current Shop',
          html: '<div class="receipt-document"><header class="receipt-shop-header"><div class="shop-name">Current Shop</div></header></div>',
          paper_size: '80mm',
          layout: {
            paper_size: '80mm',
            header_alignment: 'center',
            margin_left: 3,
            margin_right: 3,
            header_font_size: 11,
            body_font_size: 8.2,
            line_height: 1.45,
          },
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider>
          <SettingsScreen />
        </ConfirmationProvider>
      </NotificationProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Receipt' }));

    expect(await screen.findByLabelText('Header Alignment')).toHaveValue('center');
    expect(screen.getByLabelText('Left Margin (mm)')).toHaveValue(3);
    expect(screen.getByLabelText('Right Margin (mm)')).toHaveValue(3);
    expect(document.querySelector('.settings-receipt-preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Receipt Preview' }));
    expect(screen.getByRole('dialog', { name: 'Receipt Preview' })).toBeInTheDocument();
    const previewShop = await screen.findByText('Current Shop');
    const previewHost = previewShop.closest('.receipt-document-host');
    expect(previewHost).toHaveClass('receipt-align-center', 'receipt-header-size-22', 'receipt-body-size-82');
    expect(previewHost.querySelector('.receipt-logo')).toHaveAttribute('src', logo);

    request.mockImplementation(async (path, options = {}) => {
      if (path === '/settings/receipt-preview') {
        const payload = JSON.parse(options.body);
        return {
          text: 'Current Shop',
          html: '<div class="receipt-document"><header class="receipt-shop-header"><div class="shop-name">Current Shop</div></header></div>',
          paper_size: payload.receipt_paper_size,
          layout: {
            paper_size: payload.receipt_paper_size,
            header_alignment: payload.receipt_header_alignment,
            margin_left: payload.receipt_margin_left,
            margin_right: payload.receipt_margin_right,
            header_font_size: payload.receipt_header_font_size,
            body_font_size: payload.receipt_body_font_size,
            line_height: payload.receipt_line_height,
          },
        };
      }
      if (path === '/settings') return { ...settings, shop_name: 'Current Shop', receipt_logo_data_url: logo };
      if (path === '/data/status') return { ok: true, schema_version: 2 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      throw new Error(`Unexpected request: ${path}`);
    });

    fireEvent.change(screen.getByLabelText('Header Alignment'), { target: { value: 'left' } });
    fireEvent.change(screen.getByLabelText('Header Size (pt)'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Body Size (pt)'), { target: { value: '7' } });

    await waitFor(() => {
      expect(screen.getByText('Current Shop').closest('.receipt-document-host'))
        .toHaveClass('receipt-align-left', 'receipt-header-size-36', 'receipt-body-size-70');
    });

    expect(screen.queryByRole('button', { name: 'Activation' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByText('Stored on the configured Laravel server')).toBeInTheDocument();
    expect(screen.getAllByText('09688683805', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '@moekaungdev' })).toHaveAttribute(
      'href',
      'https://t.me/moekaungdev',
    );
  });

  it('uploads the current business logo from Shop settings', async () => {
    const logo = 'data:image/png;base64,aGVsbG8=';
    request.mockImplementation(async (path, options = {}) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return session;
      if (path === '/data/status') return { ok: true, schema_version: 2 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      if (path === '/settings/logo' && options.method === 'POST') return { ...settings, receipt_logo_data_url: logo };
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
    expect(await screen.findByText('Business logo')).toBeInTheDocument();

    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('.settings-logo-input'), { target: { files: [file] } });

    await waitFor(() => expect(request).toHaveBeenCalledWith('/settings/logo', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    })));
    expect(await screen.findByAltText('Current business logo')).toHaveAttribute('src', logo);
  });

  it('updates the owner profile and password from the Account tab', async () => {
    request.mockImplementation(async (path, options = {}) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return session;
      if (path === '/data/status') return { ok: true, schema_version: 2 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      if (path === '/auth/profile') {
        const payload = JSON.parse(options.body);
        return {
          ...session,
          user: { ...session.user, name: payload.name, email: payload.email },
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider>
          <SettingsScreen />
        </ConfirmationProvider>
      </NotificationProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
    fireEvent.change(screen.getByLabelText('Owner name'), { target: { value: 'Updated Owner' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'updated@example.com' } });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/auth/profile', expect.objectContaining({ method: 'PUT' })));
    expect(await screen.findByDisplayValue('Updated Owner')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('downloads and restores the Laravel per-business backup format', async () => {
    request.mockImplementation(async (path) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return session;
      if (path === '/data/status') return { ok: true, schema_version: 9, total_records: 42 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      if (path === '/data/restore-file') return { ok: true, records_restored: 42, safety_backup_created: true };
      throw new Error(`Unexpected request: ${path}`);
    });
    const write = vi.fn();
    const close = vi.fn();
    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    });
    requestDownload.mockResolvedValue({
      headers: { 'content-disposition': 'attachment; filename="mkpos-current-shop.mkpos-backup"' },
      blob: new Blob(['backup'], { type: 'application/gzip' }),
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider>
          <SettingsScreen />
        </ConfirmationProvider>
      </NotificationProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Data' }));
    expect(await screen.findByText('42')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Backup File' }));
    await waitFor(() => expect(requestDownload).toHaveBeenCalledWith('/data/export', { accept: 'application/gzip' }));
    expect(window.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
      suggestedName: 'mkpos-current-shop.mkpos-backup',
    }));

    const file = new File(['signed backup'], 'shop.mkpos-backup', { type: 'application/gzip' });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Type RESTORE to confirm'), { target: { value: 'RESTORE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restore Chosen File' }));

    await waitFor(() => {
      const restoreCall = request.mock.calls.find(([path]) => path === '/data/restore-file');
      expect(restoreCall).toBeTruthy();
      expect(restoreCall[1]).toMatchObject({ method: 'POST', timeoutMs: 120000 });
      expect(restoreCall[1].body).toBeInstanceOf(FormData);
      expect(restoreCall[1].body.get('confirmation')).toBe('RESTORE');
      expect(restoreCall[1].body.get('backup').name).toBe('shop.mkpos-backup');
    });
  });

  it('clears business data only after typed and final confirmation', async () => {
    request.mockImplementation(async (path, options = {}) => {
      if (path === '/settings') return settings;
      if (path === '/auth/me') return session;
      if (path === '/data/status') return { ok: true, schema_version: 9, total_records: 42 };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/settings/printers') return { items: [] };
      if (path === '/data/reset') {
        expect(options).toMatchObject({ method: 'POST', timeoutMs: 120000 });
        expect(JSON.parse(options.body)).toEqual({ confirmation: 'RESET', admin_pin: '' });
        return { ok: true, records_cleared: 42, safety_backup_created: true };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Data' }));

    const resetButton = screen.getByRole('button', { name: 'Clear Business Data' });
    expect(resetButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type RESET to confirm'), { target: { value: 'RESET' } });
    expect(resetButton).toBeEnabled();
    fireEvent.click(resetButton);

    const dialog = await screen.findByRole('dialog', { name: 'Start with a fresh business' });
    expect(dialog).toHaveTextContent('Your business account, users, access roles, and subscription records will be preserved.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear Business Data' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/data/reset', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(screen.getByLabelText('Type RESET to confirm')).toHaveValue(''));
  });
});

it('preserves dirty settings fields when another device updates settings', async () => {
  let remote = { ...settings };
  request.mockImplementation(async path => {
    if (path === '/settings') return remote;
    if (path === '/auth/me') return session;
    if (path === '/data/status') return { ok: true, schema_version: 2 };
    if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
    if (path === '/settings/printers') return { items: [] };
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<NotificationProvider><ConfirmationProvider><SettingsScreen /></ConfirmationProvider></NotificationProvider>);
  fireEvent.change(await screen.findByLabelText('Shop Name'), { target: { value: 'Unsaved shop name' } });
  remote = { ...settings, shop_name: 'Other device', shop_phone: '0912345' };
  await act(async () => emitDataChange(['settings'], 'realtime'));
  await waitFor(() => expect(screen.getByLabelText('Phone')).toHaveValue('0912345'));
  expect(screen.getByLabelText('Shop Name')).toHaveValue('Unsaved shop name');
});
