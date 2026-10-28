import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ShopLogo } from './ShopLogo';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const owner = { user: { role: 'owner' } };
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:logo'); URL.revokeObjectURL = vi.fn(); apiRequest.mockResolvedValue({ receipt_logo_data_url: 'data:image/png;base64,saved' }); });
it('stages shared-logo removal and only deletes on Save', async () => {
  render(<ShopLogo session={owner} onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove logo', exact: true }));
  fireEvent.click(screen.getByRole('dialog').querySelector('.mobile-danger'));
  expect(screen.getByText('Logo will be removed')).toBeInTheDocument();
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Undo removal' }));
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove logo', exact: true }));
  fireEvent.click(screen.getByRole('dialog').querySelector('.mobile-danger'));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/settings/logo', { method: 'DELETE', timeoutMs: 30000 }));
});
it('keeps a valid replacement after invalid selection and a failed upload', async () => {
  apiRequest.mockImplementation(async (_path, options) => { if (options?.method === 'POST') throw new Error('Upload interrupted'); return { receipt_logo_data_url: '' }; });
  render(<ShopLogo session={owner} onNavigate={vi.fn()} />);
  const input = await screen.findByLabelText('Business logo file');
  fireEvent.change(input, { target: { files: [new File(['valid'], 'logo.png', { type: 'image/png' })] } });
  fireEvent.change(input, { target: { files: [new File(['text'], 'bad.txt', { type: 'text/plain' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PNG, JPG or WebP up to 512 KB.');
  expect(screen.getByText('logo.png')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload interrupted');
  expect(screen.getByText('logo.png')).toBeInTheDocument();
});
it('does not request settings or offer a logo mutation for staff', () => {
  render(<ShopLogo session={{ user: { role: 'staff' } }} onNavigate={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Only the owner');
  expect(apiRequest).not.toHaveBeenCalled();
});
