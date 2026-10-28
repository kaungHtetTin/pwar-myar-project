import React, { useState } from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessesPage, initialBusinessQuery } from './BusinessesPage';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const response = (page = 1) => ({ items: [{ id: page, name: `Shop ${page}`, owner_name: 'Owner', owner_email: 'owner@example.com', product_count: 8, sales_30d: 6, selling_days_30d: 2, prospect: 'engaged', subscription: { is_valid: true, access_type: 'trial', days_remaining: 4 } }], total: 30, summary: { total: 90 }, page, last_page: 2, per_page: 25 });
function Harness() { const [query, setQuery] = useState(initialBusinessQuery); const [filterOpen, setFilterOpen] = useState(false); return <><button onClick={() => setFilterOpen(true)}>Filters</button><BusinessesPage query={query} onQueryChange={setQuery} onOpen={vi.fn()} filterOpen={filterOpen} onFilterClose={() => setFilterOpen(false)} /></>; }
beforeEach(() => { api.mockReset(); });
describe('Business pagination', () => {
  it('refreshes request signals in place and ignores an older in-flight response', async () => {
    let finishInitial, finishRefresh;
    api.mockImplementationOnce(() => new Promise(resolve => { finishInitial = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }))
      .mockResolvedValueOnce({ ...response(), items: [{ ...response().items[0], pending_requests: 1 }] });
    render(<Harness />);
    act(() => window.dispatchEvent(new Event('mkpos:office-request-reviewed')));
    await act(async () => finishRefresh(response()));
    const table = screen.getByRole('table');
    await act(async () => finishInitial(response(2)));
    expect(screen.getByText('Shop 1')).toBeInTheDocument();
    expect(screen.queryByText('Shop 2')).not.toBeInTheDocument();
    act(() => window.dispatchEvent(new CustomEvent('mkpos:office-activity', { detail: [{ event: 'subscription.requested' }] })));
    expect(screen.getByRole('table')).toBe(table);
    await screen.findByText('1 pending request(s)');
    expect(screen.getByRole('table')).toBe(table);
  });
  it('emails the owner from the row menu without replacing or refetching the businesses list', async () => {
    api.mockImplementation((path, options) => Promise.resolve(options ? { message: 'Email sent to owner@example.com.' } : response()));
    render(<Harness />); await screen.findByText('Shop 1');
    const table = screen.getByRole('table'), count = api.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop 1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send email' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('owner@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('table')).toBe(table); expect(api).toHaveBeenCalledTimes(count);
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Shop 1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send email' }));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Business update' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello owner.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await screen.findByText('Email sent to owner@example.com.');
    expect(api).toHaveBeenLastCalledWith('/office/businesses/1/email', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(api.mock.calls.at(-1)[1].body)).toMatchObject({ recipient_email: 'owner@example.com', subject: 'Business update' });
    expect(screen.getByRole('table')).toBe(table); expect(api).toHaveBeenCalledTimes(count + 1);
  });
  it('loads server pages and applies draft filters on submit, resetting the page', async () => {
    api.mockImplementation(path => Promise.resolve(response(Number(new URLSearchParams(path.split('?')[1]).get('page')))));
    render(<Harness />);
    await screen.findByText('Shop 1');
    expect(screen.getByText(/30 matching businesses/)).toHaveTextContent('90 total');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Shop 2');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    const calls = api.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Access'), { target: { value: 'trial' } });
    expect(api).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('Shop 1');
    const params = new URLSearchParams(api.mock.calls.at(-1)[0].split('?')[1]);
    expect(params.get('page')).toBe('1'); expect(params.get('access')).toBe('trial');
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '10' } });
    await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('per_page=10'));
  });
  it('shows an error with retry and an empty result without stale rows', async () => {
    api.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ ...response(), items: [], total: 0, last_page: 1 });
    render(<Harness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText(/No matching businesses/);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
  it('ignores an obsolete response after query changes', async () => {
    let finish;
    api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(response(2));
    const { rerender } = render(<BusinessesPage query={initialBusinessQuery} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    rerender(<BusinessesPage query={{ ...initialBusinessQuery, page: 2 }} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    await screen.findByText('Shop 2');
    finish(response(1));
    await waitFor(() => expect(screen.queryByText('Shop 1')).not.toBeInTheDocument());
  });
});
