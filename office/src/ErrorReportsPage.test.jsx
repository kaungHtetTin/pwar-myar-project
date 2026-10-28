import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ErrorReportsPage } from './ErrorReportsPage';
import { api, apiBlob } from './api';

vi.mock('./api', () => ({ api: vi.fn(), apiBlob: vi.fn() }));
let report;
beforeEach(() => {
  report = { id: 1, reference: 'ERR-000001', business_id: 10, business_name: 'Demo shop', reporter_name: 'Owner', contact_channel: 'telegram', contact_value: '@shopowner', title: 'Checkout failed', description: 'Checkout shows an error.', app: 'business_mobile', priority: 'normal', status: 'open', attempted_steps: 'Checked the payment fields.', resolution: '', internal_note: '', screenshots: [{ name: 'error.png', path: '/office/error-reports/1/images/0' }], version: 'v1', created_at: '2026-10-25T10:00:00Z' };
  api.mockReset(); apiBlob.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:error-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  api.mockImplementation((path, options) => {
    if (path.includes('/businesses?')) return Promise.resolve({ items: [{ id: 10, name: 'Demo shop' }], has_more: false });
    if (options?.method) return Promise.resolve(report);
    if (path.includes('?')) return Promise.resolve({ items: [report], total: 1, page: 1, per_page: 25, last_page: 1 });
    return Promise.resolve(report);
  });
});
function Page() {
  const [open, setOpen] = useState(false);
  return <ErrorReportsPage filterOpen={open} onFilterOpen={() => setOpen(true)} onFilterClose={() => setOpen(false)} />;
}
async function action(name) {
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for error report 1' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
  await screen.findByRole('dialog');
}
const reads = () => api.mock.calls.filter(([path, options]) => path.includes('/error-reports?') && !options?.method).length;

it('opens the report business once without fetching or changing the list', async () => {
  const openBusiness = vi.fn();
  render(<ErrorReportsPage onOpenBusiness={openBusiness} />);
  await screen.findByRole('button', { name: 'Actions for error report 1' });
  const table = screen.getByRole('table'), count = reads();
  fireEvent.click(screen.getByRole('button', { name: 'Actions for error report 1' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View business' }));
  expect(openBusiness).toHaveBeenCalledExactlyOnceWith(10);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBe(table);
  expect(reads()).toBe(count);
});

it('views the screenshot and closes over the retained list without refetching', async () => {
  render(<Page />); await screen.findByRole('table'); const table = screen.getByRole('table');
  const count = reads(); await action('View report');
  expect(await screen.findByText('Checked the payment fields.')).toBeInTheDocument();
  expect(screen.getByText('Telegram', {exact:true})).toBeInTheDocument();
  expect(screen.getByText('@shopowner', {exact:true})).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: 'error.png' })).toHaveAttribute('src', 'blob:error-preview');
  fireEvent.click(screen.getByRole('button', { name: 'Close error report' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBe(table); expect(reads()).toBe(count);
});

it('preserves failed edit values, guards duplicate saves and deletes only after confirmation', async () => {
  let finish, writes = 0;
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => {
    if (options?.method === 'PUT') { writes++; return writes === 1 ? Promise.reject(new Error('Save unavailable')) : new Promise(resolve => { finish = resolve; }); }
    return original(path, options);
  });
  render(<Page />); await action('Edit report');
  const title = await screen.findByLabelText('Title');
  fireEvent.change(title, { target: { value: 'Checkout payment failure' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_review' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
  await screen.findByText('Save unavailable'); expect(title).toHaveValue('Checkout payment failure');
  fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
  fireEvent.submit(title.closest('form')); expect(writes).toBe(2);
  report = { ...report, title: 'Checkout payment failure', status: 'in_review', version: 'v2' };
  await act(async () => finish(report));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await action('Delete report');
  await screen.findByText(/and its saved screenshots/);
  expect(api.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
  await waitFor(() => expect(api.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(true));
});

it('creates a manual report and applies status filters while preserving search', async () => {
  render(<Page />); await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: 'New error report' }));
  await screen.findByRole('option', { name: 'Demo shop' });
  fireEvent.change(screen.getByLabelText('Business'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Printer error' } });
  fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Printer is not available.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const write = api.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(write[1].body)).toMatchObject({ business_id: '10', title: 'Printer error', status: 'open', priority: 'normal' });
  const search = screen.getByRole('searchbox', { name: 'Search error reports' });
  fireEvent.change(search, { target: { value: 'Checkout' } }); fireEvent.submit(search.closest('form'));
  await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('q=Checkout'))).toBe(true));
  await waitFor(() => expect(screen.getByRole('button', { name: /Filters/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Status'), { target: { value: 'resolved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('status=resolved'));
  expect(api.mock.calls.at(-1)[0]).toContain('q=Checkout');
});
