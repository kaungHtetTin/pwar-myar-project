import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './settingsUtils';

vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));

it('switches pricing modes and saves the supported automatic rule', async () => {
  apiRequest.mockImplementation(async path => {
    if (path === '/auth/me') return { user: { role: 'owner' } };
    if (path === '/settings') return DEFAULT_SETTINGS;
    if (path === '/price-types') return { items: ['Retail'], rules: [] };
    return {};
  });
  const onNavigate = vi.fn();
  render(<SettingsScreen pathname="/settings/prices/new" onNavigate={onNavigate} />);
  const markup = await screen.findByLabelText('Markup %');
  expect(markup).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'Automatic', exact: true }));
  expect(markup).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Price type name'), { target: { value: 'Wholesale' } });
  fireEvent.change(markup, { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Round up to'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Minimum profit'), { target: { value: '500' } });
  expect(screen.getByText('Calculated price').parentElement).toHaveTextContent('1,500');
  fireEvent.click(screen.getByRole('button', { name: 'Save price type' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/price-types', expect.objectContaining({ method: 'POST' })));
  const [, request] = apiRequest.mock.calls.find(([path, options]) => path === '/price-types' && options?.method === 'POST');
  expect(JSON.parse(request.body)).toMatchObject({ name: 'Wholesale', pricing_mode: 'automatic', markup_percent: 20, rounding: 100, minimum_profit: 500 });
  expect(onNavigate).toHaveBeenCalledWith('/settings/prices', { replace: true });
  expect(screen.getByLabelText('Price type name')).toHaveValue('');
  expect(screen.getByRole('radio', { name: 'Manual', exact: true })).toBeChecked();
  expect(screen.getByLabelText('Markup %')).toHaveValue(0);
});
