import { makeThemePalettes } from './themeRuntime';
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AdminsPage, ActivityLogPage, BankBooksPage, BrandingPage } from './OfficeManagementPages';
import { PaymentApprovalModal } from './SubscriptionBankBook';
import { RetainedViews } from './RetainedViews';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));

const owner = { id: 1, name: 'Founder Owner', email: 'owner@example.test', role: 'super_admin', is_active: true };
const operator = { id: 2, name: 'Payment Admin', email: 'payments@example.test', role: 'admin', is_active: true };
const bankData = { page: 1, per_page: 25, last_page: 1, total: 2, items: [{ id: 1, name: 'Main bank', is_active: true }, { id: 2, name: 'New bank', is_active: true }], subscription_account_id: 1 };
const list = { items: [owner, operator], page: 1, per_page: 25, last_page: 1, total: 2 };
beforeEach(() => { api.mockReset(); api.mockImplementation(path => Promise.resolve(path.startsWith('/office/bank-books') ? bankData : list)); });

function AdminHarness() {
  const [open, setOpen] = useState(false), [active, setActive] = useState(true);
  return <><button onClick={() => setActive(!active)}>Switch section</button><RetainedViews activeKey={active ? 'admins' : 'other'}>{active ? <AdminsPage currentAdminId={1} filterOpen={open} onFilterOpen={() => setOpen(true)} onFilterClose={() => setOpen(false)} /> : <p>Other section</p>}</RetainedViews></>;
}

it('retains the administrators source table across cancel, filters and section Back', async () => {
  render(<AdminHarness />); await screen.findByText('Payment Admin');
  const table = screen.getByRole('table', { name: 'Administrators' });
  fireEvent.change(screen.getByLabelText('Search administrators'), { target: { value: 'Admin' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=Admin')));
  await waitFor(() => expect(screen.getByRole('button', { name: 'New administrator' })).toBeEnabled());
  const count = api.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'New administrator' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsent' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api).toHaveBeenCalledTimes(count); expect(screen.getByRole('table', { name: 'Administrators' })).toBe(table);
  fireEvent.click(screen.getByRole('button', { name: 'Switch section' })); fireEvent.click(screen.getByRole('button', { name: 'Switch section' }));
  expect(screen.getByRole('table', { name: 'Administrators' })).toBe(table); expect(screen.getByLabelText('Search administrators')).toHaveValue('Admin'); expect(api).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('status=inactive')));
});

it('keeps failed admin drafts, retries, and deactivates through a confirmation', async () => {
  render(<AdminHarness />); await screen.findByText('Payment Admin');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for administrator Payment Admin' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Edit administrator' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated admin' } });
  api.mockRejectedValueOnce(new Error('Temporary failure')); fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Temporary failure'); expect(screen.getByLabelText('Name')).toHaveValue('Updated admin');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actions for administrator Payment Admin' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Actions for administrator Payment Admin' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate administrator' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate administrator' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/admins/2', { method: 'DELETE' }));
});

it('changes subscription receiving books and creates new books without resetting the source', async () => {
  render(<BankBooksPage />); await screen.findByText('New bank');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for bank book New bank' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Receive subscriptions here' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use this book' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/subscription-bank-book', { method: 'PUT', body: JSON.stringify({ subscription_account_id: 2 }) }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'New bank book' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'New bank book' })); fireEvent.change(screen.getByLabelText('Bank book name'), { target: { value: 'Fourth book' } }); fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/bank-books', { method: 'POST', body: JSON.stringify({ name: 'Fourth book', is_active: true }) }));
});

it('shows immutable activity details and the recorded actor', async () => {
  api.mockResolvedValue({ ...list, admins: [owner], items: [{ id: 10, admin_name: owner.name, admin_email: owner.email, action: 'BusinessSubscriptionController@approve', path: 'api/office/subscription-requests/9/approve', method: 'POST', created_at: '2026-10-24T03:00:00Z', details: { account_id: 2 } }] });
  render(<ActivityLogPage />); await screen.findByText('Founder Owner');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for activity 10' })); fireEvent.click(screen.getByRole('menuitem', { name: 'View action details' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('"account_id": 2'); fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('submits the selected receiving book once and keeps approval errors for retry', async () => {
  const onAction = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true), onClose = vi.fn();
  render(<PaymentApprovalModal request={{ id: 9, business_name: 'Test shop', plan_name: 'Monthly' }} onAction={onAction} onClose={onClose} />);
  await screen.findByRole('option', { name: 'New bank' });
  fireEvent.change(screen.getByLabelText('Subscription receiving book'), { target: { value: '2' } }); fireEvent.click(screen.getByRole('button', { name: 'Approve payment' }));
  await screen.findByRole('alert'); expect(onClose).not.toHaveBeenCalled(); expect(screen.getByLabelText('Subscription receiving book')).toHaveValue('2');
  fireEvent.click(screen.getByRole('button', { name: 'Approve payment' })); await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onAction).toHaveBeenLastCalledWith('approve-9', '/office/subscription-requests/9/approve', { method: 'POST', body: '{"account_id":2,"transaction_id":null}' });
});

it('saves theme colors, uploads branding assets and restores defaults', async () => {
  const branding = { primary_color: '#0e684e', logo_url: '/api/branding/assets/logo', icon_url: null, favicon_url: null };
  api.mockImplementation(path => Promise.resolve(path === '/office/branding/theme/preview' ? { preview_id: 'theme-preview', primary_color: '#4f46e5', palettes: makeThemePalettes('#4f46e5'), rationale: 'Matching colors' } : branding));
  render(<BrandingPage />); await screen.findByLabelText('Primary theme color');
  fireEvent.change(screen.getByLabelText('Primary theme color'), { target: { value: '#4f46e5' } }); fireEvent.click(screen.getByRole('button', { name: 'Apply theme to all apps' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/branding', { method: 'PUT', body: JSON.stringify({ primary_color:'#4f46e5', theme_mode:'light', theme_version:1, preview_id:'theme-preview' }) }));
  await waitFor(() => expect(screen.getByLabelText('Upload app icon')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Upload app icon'), { target: { files: [new File(['image'], 'icon.png', { type: 'image/png' })] } });
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/branding/icon', { method: 'POST', body: expect.any(FormData) }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Restore default logo' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: 'Restore default logo' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/office/branding/logo', { method: 'DELETE' }));
});
