import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './settingsUtils';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

describe('mobile receipt title setting', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === '/auth/me') return { user: { name: 'Owner', email: 'owner@example.com', role: 'owner' } };
      if (path === '/settings' && options.method === 'PUT') return { ...DEFAULT_SETTINGS, ...JSON.parse(options.body) };
      if (path === '/settings') return { ...DEFAULT_SETTINGS, shop_title: 'Everyday essentials' };
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/data/status') return { ok: true, total_records: 0 };
      if (path === '/settings/receipt-preview') return { html: '<div>Receipt preview</div>', paper_size: '80mm', layout: {} };
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('removes the receipt title field from Shop settings', async () => {
    render(<LocaleProvider><SettingsScreen pathname="/settings/shop" onNavigate={vi.fn()} /></LocaleProvider>);

    expect(await screen.findByLabelText('Shop name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Receipt title')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Shop title')).not.toBeInTheDocument();
  });

  it('shows and saves the receipt title from Receipt settings', async () => {
    const onNavigate = vi.fn();
    render(<LocaleProvider><SettingsScreen pathname="/settings/receipt" onNavigate={onNavigate} /></LocaleProvider>);

    const title = await screen.findByLabelText('Receipt title');
    expect(title).toHaveValue('Everyday essentials');
    fireEvent.change(title, { target: { value: 'Thank you for shopping' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save receipt' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/settings', expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('"shop_title":"Thank you for shopping"'),
    })));
    expect(onNavigate).toHaveBeenCalledWith('/settings', { replace: true });
  });

  it('saves paper, alignment and content changes from the redesigned controls', async () => {
    render(<LocaleProvider><SettingsScreen pathname="/settings/receipt" onNavigate={vi.fn()} /></LocaleProvider>);
    await screen.findByLabelText('Receipt title');
    fireEvent.click(screen.getByRole('button', { name: '58MM', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Left', exact: true }));
    fireEvent.click(screen.getByRole('switch', { name: 'Show customer', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save receipt' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/settings', expect.objectContaining({
      method: 'PUT',
      body: expect.any(String),
    })));
    const [, request] = apiRequest.mock.calls.find(([path, options]) => path === '/settings' && options?.method === 'PUT');
    expect(JSON.parse(request.body)).toMatchObject({ receipt_paper_size: '58mm', receipt_header_alignment: 'left', receipt_show_customer: '0' });
  });
});
