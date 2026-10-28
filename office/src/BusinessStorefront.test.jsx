import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BusinessStorefront, ShopGpsPosition } from './BusinessStorefront';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
beforeEach(() => { api.mockReset(); });
const store = { display_name: 'Demo Shop', slug: 'demo-shop', storefront_enabled: true, marketplace_enabled: true, marketplace_suspended: false };
it('requires a reason, preserves failed drafts and saves exactly once without replacing the card', async () => {
  const saved = vi.fn(); render(<BusinessStorefront businessId={11} storefront={store} onSaved={saved} />);
  const card = screen.getByRole('region', { name: 'Customer storefront' });
  const reason = screen.getByRole('textbox');
  fireEvent.change(reason, { target: { value: '   ' } }); fireEvent.submit(reason.closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a reason'); expect(api).not.toHaveBeenCalled();
  fireEvent.change(reason, { target: { value: ' Policy violation ' } });
  api.mockRejectedValueOnce(new Error('Try again'));
  fireEvent.click(screen.getByRole('button', { name: 'Suspend marketplace visibility' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again'); expect(reason).toHaveValue(' Policy violation ');
  let finish; api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const submit = screen.getByRole('button', { name: 'Suspend marketplace visibility' });
  fireEvent.click(submit); fireEvent.submit(reason.closest('form'));
  expect(api).toHaveBeenCalledTimes(2); expect(submit).toBeDisabled();
  await act(async () => finish({ ok: true }));
  expect(await screen.findByRole('status')).toHaveTextContent('Marketplace visibility suspended.');
  expect(saved).toHaveBeenCalledWith({ ...store, marketplace_suspended: true, marketplace_suspension_reason: 'Policy violation' });
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ marketplace_suspended: true, reason: 'Policy violation' });
  expect(screen.getByRole('region', { name: 'Customer storefront' })).toBe(card); expect(reason).toHaveValue('');
});
it('restores a suspended storefront with the supplied reason', async () => {
  api.mockResolvedValueOnce({ ok: true });
  render(<BusinessStorefront businessId={11} storefront={{ ...store, marketplace_suspended: true, marketplace_suspension_reason: 'Old reason' }} onSaved={vi.fn()} />);
  expect(screen.getByText('Old reason')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Resolved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Restore marketplace visibility' }));
  await screen.findByRole('status'); expect(JSON.parse(api.mock.calls[0][1].body).marketplace_suspended).toBe(false);
});
it('shows valid saved coordinates including zero and a map link', () => {
  render(<ShopGpsPosition location={{ latitude: 0, longitude: 96.1234567, accuracy: 12, captured_at: '2026-10-15T12:00:00Z' }} />);
  expect(screen.getByText('0.0000000')).toBeInTheDocument(); expect(screen.getByText('96.1234567')).toBeInTheDocument();
  expect(screen.getByText('Within 12 m')).toBeInTheDocument();
  expect(screen.getByTitle('Shop GPS map')).toHaveAttribute('src', expect.stringContaining('0%2C96.1234567'));
  expect(screen.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('target', '_blank');
});
it('shows an empty state without a map when no GPS is saved', () => {
  render(<ShopGpsPosition location={null} />);
  expect(screen.getByText('No GPS position saved')).toBeInTheDocument(); expect(screen.queryByTitle('Shop GPS map')).not.toBeInTheDocument();
});
