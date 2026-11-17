import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { SettingsScreen } from './SettingsScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

beforeEach(() => {
  apiRequest.mockImplementation(async (path) => {
    if (path === '/settings') return { language: 'en', payment_methods: 'Cash', admin_pin_set: '0' };
    if (path === '/auth/me') return { user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'trial' } };
    if (path === '/price-types') return { items: [], usage: {}, rules: [] };
    if (path === '/data/status') return { ok: true, schema_version: 2, total_records: 4 };
    if (path === '/settings/printers') return { items: [] };
    throw new Error(`Unexpected request: ${path}`);
  });
});

it('disables data actions during a free trial', async () => {
  render(<LocaleProvider><SettingsScreen pathname="/settings/data" onNavigate={vi.fn()} /></LocaleProvider>);
  expect(await screen.findByRole('status')).toHaveTextContent('Backup download and data restore require a paid plan.');
  expect(screen.getByRole('button', { name: /Download backup/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Restore backup/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'View Billing' })).toBeInTheDocument();
});

it('blocks a direct restore route during a free trial', async () => {
  render(<LocaleProvider><SettingsScreen pathname="/settings/data/restore" onNavigate={vi.fn()} /></LocaleProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable during the free trial');
  expect(screen.queryByRole('button', { name: 'Restore backup' })).not.toBeInTheDocument();
});

it('shows staff only common settings and skips owner-only API requests', async () => {
  apiRequest.mockImplementation(async (path) => {
    if (path === '/settings') return { language: 'en', payment_methods: 'Cash', admin_pin_set: '0' };
    if (path === '/auth/me') return { user: { role: 'staff', name: 'Cashier', email: 'cashier@example.com' }, subscription: { is_valid: true } };
    throw new Error(`Unexpected owner-only request: ${path}`);
  });

  render(<LocaleProvider><SettingsScreen pathname="/settings" onNavigate={vi.fn()} /></LocaleProvider>);

  expect(await screen.findByRole('button', { name: 'Open Account' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Receipt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Printer' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open About' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Shop' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Security' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Data' })).not.toBeInTheDocument();
});

it('shows one live barcode sticker sample and updates its visible content', async () => {
  render(<LocaleProvider><SettingsScreen pathname="/settings/barcode" onNavigate={vi.fn()} /></LocaleProvider>);

  const preview = await screen.findByLabelText('Barcode sticker live preview');
  expect(preview).toHaveTextContent('Sample Product');
  expect(preview).toHaveTextContent('2008934580979');
  expect(preview.querySelectorAll('.barcode-live-preview-label')).toHaveLength(1);

  fireEvent.click(screen.getByRole('switch', { name: 'Show product name' }));
  expect(preview).not.toHaveTextContent('Sample Product');
  fireEvent.change(screen.getByLabelText('Sticker paper format'), { target: { value: 'roll_50x30' } });
  expect(preview).toHaveTextContent('50 × 30 mm sticker');
});
