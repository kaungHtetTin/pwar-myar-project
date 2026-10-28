import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './settingsUtils';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = 'en';
  apiRequest.mockReset();
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === '/settings' && options.method === 'PUT') {
      return Promise.resolve({ ...DEFAULT_SETTINGS, ...JSON.parse(options.body), language: 'my' });
    }
    if (path === '/settings') return Promise.resolve({ ...DEFAULT_SETTINGS, language: 'en' });
    if (path === '/auth/me') return Promise.resolve({ user: { name: 'Owner', email: 'owner@example.com', role: 'owner' } });
    if (path === '/price-types') return Promise.resolve({ items: ['Retail'], rules: [] });
    if (path === '/data/status') return Promise.resolve({ ok: true, total_records: 0 });
    if (path === '/settings/printers') return Promise.resolve({ items: [] });
    return Promise.resolve({});
  });
});

describe('mobile language setting', () => {
  it('activates and persists Myanmar locale immediately after saving', async () => {
    const onNavigate = vi.fn();
    render(<LocaleProvider><SettingsScreen pathname="/settings/language" onNavigate={onNavigate} /></LocaleProvider>);

    const selector = await screen.findByRole('radio', { name: 'မြန်မာ' });
    expect(selector.closest('.settings-language-choices')).not.toBeNull();
    fireEvent.click(selector);
    fireEvent.click(screen.getByRole('button', { name: 'Save language' }));

    await waitFor(() => expect(document.documentElement.lang).toBe('my'));
    expect(window.localStorage.getItem('mkpos.language')).toBe('my');
    expect(onNavigate).toHaveBeenCalledWith('/settings', { replace: true });
  });
});
