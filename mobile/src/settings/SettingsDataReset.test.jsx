import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { DEFAULT_SETTINGS } from './settingsUtils';
import { SettingsScreen } from './SettingsScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

describe('mobile business data reset', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === '/settings') return { ...DEFAULT_SETTINGS, admin_pin_set: '1' };
      if (path === '/auth/me') return { user: { role: 'owner' }, subscription: { is_valid: true, access_type: 'trial' } };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/data/status') return { ok: true, schema_version: 9, total_records: 42 };
      if (path === '/data/reset') {
        expect(options).toMatchObject({ method: 'POST', timeoutMs: 120000 });
        expect(JSON.parse(options.body)).toEqual({ confirmation: 'RESET', admin_pin: '2468' });
        return { ok: true, records_cleared: 42, safety_backup_created: true };
      }
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('requires typed confirmation and a final confirmation before clearing data', async () => {
    const onNavigate = vi.fn();
    render(<LocaleProvider><SettingsScreen pathname="/settings/data/reset" onNavigate={onNavigate} /></LocaleProvider>);

    const confirmation = await screen.findByLabelText('Type RESET to confirm');
    const resetButton = screen.getByRole('button', { name: 'Clear business data' });
    expect(resetButton).toBeDisabled();
    expect(screen.getByText(/safety backup is created/i)).toBeInTheDocument();
    expect(screen.getByText('Business account, users and passwords')).toBeInTheDocument();
    expect(screen.getByText('Access roles')).toBeInTheDocument();
    expect(screen.getByText('Subscription and billing records')).toBeInTheDocument();

    fireEvent.change(confirmation, { target: { value: 'RESET' } });
    fireEvent.change(screen.getByLabelText('Admin PIN'), { target: { value: '2468' } });
    fireEvent.click(resetButton);

    const dialog = await screen.findByRole('dialog', { name: 'Start with a fresh business?' });
    expect(apiRequest).not.toHaveBeenCalledWith('/data/reset', expect.anything());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear business data' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/data/reset', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/settings/data', { replace: true }));
  });
});
