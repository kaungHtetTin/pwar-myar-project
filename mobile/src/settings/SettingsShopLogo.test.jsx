import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './settingsUtils';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

const originalLogo = 'data:image/png;base64,b2xk';
const updatedLogo = 'data:image/png;base64,bmV3';

function settingsResponse(logo = originalLogo) {
  return { ...DEFAULT_SETTINGS, shop_name: 'Demo Store', receipt_logo_data_url: logo };
}

describe('mobile Shop logo settings', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation(async (path, options = {}) => {
      if (path === '/auth/me') return { user: { name: 'Owner', email: 'owner@example.com', role: 'owner' } };
      if (path === '/settings/logo' && options.method === 'POST') return settingsResponse(updatedLogo);
      if (path === '/settings/logo' && options.method === 'DELETE') return settingsResponse('');
      if (path === '/settings') return settingsResponse();
      if (path === '/price-types') return { items: ['Retail'], usage: {}, rules: [] };
      if (path === '/data/status') return { ok: true, total_records: 0 };
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('uploads and previews a replacement shop logo', async () => {
    const logoUpdated = vi.fn();
    window.addEventListener('mkpos:shop-logo-updated', logoUpdated);
    render(<LocaleProvider><SettingsScreen pathname="/settings/shop" onNavigate={vi.fn()} /></LocaleProvider>);

    expect(await screen.findByRole('img', { name: 'Demo Store logo' })).toHaveAttribute('src', originalLogo);
    const file = new File(['logo'], 'shop.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose shop logo'), { target: { files: [file] } });

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/settings/logo', expect.objectContaining({ method: 'POST', body: expect.any(FormData) })));
    expect(await screen.findByRole('img', { name: 'Demo Store logo' })).toHaveAttribute('src', updatedLogo);
    expect(logoUpdated).toHaveBeenCalled();
    window.removeEventListener('mkpos:shop-logo-updated', logoUpdated);
  });

  it('removes the current shop logo and restores the placeholder', async () => {
    render(<LocaleProvider><SettingsScreen pathname="/settings/shop" onNavigate={vi.fn()} /></LocaleProvider>);

    await screen.findByRole('img', { name: 'Demo Store logo' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/settings/logo', { method: 'DELETE' }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Demo Store logo' })).not.toBeInTheDocument());
  });
});
