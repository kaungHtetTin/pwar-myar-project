import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformUsersPage } from './PlatformUsersPage';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const customer = { id: 7, name: 'Shop Customer', email: 'customer@example.com', phone: '09123', address: 'Yangon', is_active: true, created_at: '2026-10-10T00:00:00Z' };
beforeEach(() => {
  window.history.replaceState({}, ''); api.mockReset();
  api.mockImplementation((path, options) => {
    if (path.endsWith('/email') && options?.method === 'POST') return Promise.resolve({ message: `Email sent to ${customer.email}.` });
    if (options?.method === 'DELETE') return Promise.resolve({ ok: true });
    if (options?.method) return Promise.resolve({ ...customer, ...JSON.parse(options.body) });
    if (path === '/office/platform-users/7') return Promise.resolve(customer);
    return Promise.resolve({ items: [customer], total: 26, page: Number(new URLSearchParams(path.split('?')[1]).get('page') || 1), last_page: 2 });
  });
});
const mount = () => render(<div className="office-content"><PlatformUsersPage scope={1} /></div>);
async function edit() {
  await screen.findByText('Shop Customer'); fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop Customer' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View / edit' })); await screen.findByDisplayValue('customer@example.com');
}
const listRequests = () => api.mock.calls.filter(([path]) => path.startsWith('/office/platform-users?')).length;

describe('Platform customers', () => {
  it('opens email from row actions without refetching or replacing the source list', async () => {
    mount(); await screen.findByText('Shop Customer');
    const table = screen.getByRole('table'), count = listRequests();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop Customer' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send email' }));
    expect(screen.getByRole('dialog', { name: 'Send email' })).toHaveTextContent(customer.email);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('table')).toBe(table); expect(listRequests()).toBe(count);
    expect(screen.getByRole('button', { name: 'Actions for Shop Customer' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop Customer' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send email' }));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Update' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Account update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await screen.findByText(`Email sent to ${customer.email}.`);
    expect(screen.getByRole('table')).toBe(table); expect(listRequests()).toBe(count);
  });
  it('applies useful filters together, discards cancelled drafts and clears filters while keeping search and page size', async () => {
    mount(); await screen.findByText('Shop Customer');
    fireEvent.change(screen.getByLabelText('Search platform users'), { target: { value: 'Customer' } }); fireEvent.submit(screen.getByRole('search'));
    fireEvent.change(await screen.findByLabelText('Rows per page'), { target: { value: '10' } });
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('per_page=10')));
    const calls = listRequests();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: 'missing' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(listRequests()).toBe(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' })); expect(screen.getByLabelText('Phone number')).toHaveValue('all');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: 'present' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'missing' } });
    fireEvent.change(screen.getByLabelText('Registered from'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Registered to'), { target: { value: '2026-10-15' } });
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('phone=present&address=missing&registered_from=2026-10-01&registered_to=2026-10-15&sort=name&page=1&per_page=10')));
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('Filters5');
    await edit(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByLabelText('Registered from')).toHaveValue('2026-10-01'); expect(screen.getByLabelText('Sort by')).toHaveValue('name');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=Customer&status=all&phone=all&address=all&registered_from=&registered_to=&sort=newest&page=1&per_page=10')));
    expect(screen.getByLabelText('Search platform users')).toHaveValue('Customer');
  });

  it('blocks duplicate saves and modal dismissal while saving', async () => {
    mount(); await edit();
    let finish;
    api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const save = screen.getByRole('button', { name: 'Save customer' });
    fireEvent.click(save); fireEvent.click(save);
    expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Close customer details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => finish(customer));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the existing table behind the edit modal and supports Escape, backdrop, focus trapping and browser Back', async () => {
    mount(); await screen.findByText('Shop Customer');
    const table = screen.getByRole('table', { name: 'Platform users' }), calls = listRequests();
    await edit();
    const modal = screen.getByRole('dialog', { name: 'Edit customer account' });
    expect(table).toBeVisible();
    expect(modal.closest('.office-modal-backdrop')).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Close customer details' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Save customer' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab' }); expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('table', { name: 'Platform users' })).toBe(table);
    expect(screen.getByRole('button', { name: 'Actions for Shop Customer' })).toHaveFocus();
    await edit(); fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await edit(); window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(listRequests()).toBe(calls);
    expect(api.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });

  it('retains edited values after errors and saves the changed row without replacing the list', async () => {
    mount(); await screen.findByText('Shop Customer');
    const table = screen.getByRole('table', { name: 'Platform users' }), calls = listRequests();
    await edit(); fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Customer' } });
    api.mockRejectedValueOnce(new Error('Unable to save.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
    await screen.findByText('Unable to save.'); expect(screen.getByLabelText('Name')).toHaveValue('Updated Customer');
    fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('table', { name: 'Platform users' })).toBe(table);
    expect(screen.getByText('Updated Customer')).toBeVisible(); expect(listRequests()).toBe(calls);
  });

  it('retains search, status and page on cancel and browser forward/back without refetching', async () => {
    mount(); await screen.findByText('Shop Customer');
    fireEvent.change(screen.getByLabelText('Search platform users'), { target: { value: 'Customer' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Customer')));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('Shop Customer'); fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2'); const calls = listRequests();
    const scroller = screen.getByRole('table', { name: 'Platform users' }).closest('.office-content');
    scroller.scrollTop = 220;
    await edit(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByRole('button', { name: 'New customer' });
    expect(screen.getByLabelText('Search platform users')).toHaveValue('Customer'); fireEvent.click(screen.getByRole('button', { name: /Filters/ })); expect(screen.getByLabelText('Status')).toHaveValue('active'); fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(screen.getByText('Page 2 of 2')).toBeVisible(); expect(listRequests()).toBe(calls);
    await waitFor(() => expect(scroller.scrollTop).toBe(220));
    window.history.forward(); await screen.findByRole('heading', { name: 'Edit customer account' });
    window.history.back(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); await screen.findByRole('button', { name: 'New customer' }); expect(listRequests()).toBe(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' })); await screen.findByText('Page 1 of 2');
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '10' } });
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('per_page=10')));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search platform users' })); expect(screen.getByLabelText('Search platform users')).toHaveValue('');
  });

  it('creates an account and preserves values for a failed save and retry', async () => {
    mount(); await screen.findByText('Shop Customer'); fireEvent.click(screen.getByRole('button', { name: 'New customer' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Customer' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    api.mockRejectedValueOnce(new Error('Email already exists.')); fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
    await screen.findByRole('alert'); expect(screen.getByLabelText('Name')).toHaveValue('New Customer');
    fireEvent.click(screen.getByRole('button', { name: 'Save customer' })); await screen.findByText('Customer account saved.');
    expect(api).toHaveBeenCalledWith('/office/platform-users', expect.objectContaining({ method: 'POST', body: expect.stringContaining('new@example.com') }));
  });

  it('updates profile, status and optional password and supports the modal close button', async () => {
    mount(); await edit(); fireEvent.change(screen.getByLabelText('Account status'), { target: { value: 'inactive' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '09999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save customer' })); await screen.findByText('Customer account saved.');
    const options = api.mock.calls.find(([path, options]) => path === '/office/platform-users/7' && options?.method === 'PUT')[1];
    expect(JSON.parse(options.body)).toMatchObject({ is_active: false, phone: '09999', password: '' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await edit(); const calls = listRequests(); fireEvent.click(screen.getByRole('button', { name: 'Close customer details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await screen.findByRole('button', { name: 'New customer' }); expect(listRequests()).toBe(calls);
  });

  it('confirms deletion, supports cancel and allows retry after failure', async () => {
    mount(); await screen.findByText('Shop Customer');
    const open = () => { fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop Customer' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' })); };
    open(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(api.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    open(); api.mockRejectedValueOnce(new Error('Try again.')); fireEvent.click(screen.getByRole('button', { name: 'Delete customer' }));
    await screen.findByText('Try again.'); fireEvent.click(screen.getByRole('button', { name: 'Delete customer' }));
    await screen.findByText('Customer account deleted. Existing orders have been retained.'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('retries list loading errors', async () => {
    api.mockRejectedValueOnce(new Error('Offline')); mount(); await screen.findByText('Offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('Shop Customer');
  });
});
