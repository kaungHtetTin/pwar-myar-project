import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ShopReportsPage, initialReportQuery } from './ShopReportsPage';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const row = { id: 7, business_id: 1, shop_name: 'Demo', shop_slug: 'demo', customer_name: 'Buyer', customer_email: 'buyer@example.test', reason: 'payment_issue', details: 'Misleading payment information', status: 'open', version: 1, created_at: '2026-10-09 01:00:00', updates: [] };
function Harness() { const [query, setQuery] = useState(initialReportQuery), [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Filters</button><ShopReportsPage query={query} onQueryChange={setQuery} filterOpen={open} onFilterClose={() => setOpen(false)} onOpenBusiness={vi.fn()} /></>; }
beforeEach(() => { api.mockReset(); history.replaceState(null, '', '/'); });

async function openReview() {
  fireEvent.click(screen.getByRole('button', { name: 'Actions for report 7' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Review report' }));
  return screen.findByRole('dialog', { name: 'Review report #7' });
}

it('shows a modal over the mounted list and retains the review draft on browser Back and Forward', async () => {
  api.mockImplementation(async path => path.includes('?') ? { items: [row], total: 1, page: 1, last_page: 1 } : row);
  render(<div className="office-content"><Harness /></div>);
  const table = await screen.findByRole('table', { name: 'Shop reports' });
  const scroller = table.closest('.office-content'); scroller.scrollTop = 170;
  await openReview();
  expect(table).toBeVisible();
  fireEvent.change(await screen.findByLabelText(/Internal review note/), { target: { value: 'Keep this unfinished draft' } });
  const calls = api.mock.calls.length;
  window.history.back(); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('table', { name: 'Shop reports' })).toBe(table);
  await waitFor(() => expect(scroller.scrollTop).toBe(170));
  window.history.forward(); await screen.findByRole('dialog', { name: 'Review report #7' });
  expect(screen.getByLabelText(/Internal review note/)).toHaveValue('Keep this unfinished draft');
  expect(api.mock.calls).toHaveLength(calls);
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await openReview(); fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.mock.calls).toHaveLength(calls);
});

it('keeps focus in the modal, blocks duplicate saves and prevents dismissal during a save', async () => {
  let finish;
  api.mockImplementation(async (path, options = {}) => options.method
    ? new Promise(resolve => { finish = resolve; }) : path.includes('?') ? { items: [row], total: 1, page: 1, last_page: 1 } : row);
  render(<Harness />); await screen.findByRole('table'); await openReview();
  fireEvent.change(await screen.findByLabelText(/Internal review note/), { target: { value: 'Checking the evidence' } });
  const close = screen.getByRole('button', { name: 'Close report review' }); close.focus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Save review' })).toHaveFocus();
  const save = screen.getByRole('button', { name: 'Save review' }); fireEvent.click(save); fireEvent.click(save);
  expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  expect(close).toBeDisabled(); expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' }); fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await act(async () => finish({ ...row, status: 'in_review', version: 2 }));
  await screen.findByText('Review saved.'); fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('preserves a failed Office draft, then reconciles the source table on Back without refetch', async () => {
  let attempts = 0;
  api.mockImplementation(async (path, options = {}) => {
    if (options.method) { if (++attempts === 1) throw new Error('Network unavailable'); return { ...row, ...JSON.parse(options.body), version: 2, updates: [] }; }
    return path.includes('?') ? { items: [row], total: 1, page: 1, last_page: 1 } : row;
  });
  render(<Harness />);
  const table = await screen.findByRole('table', { name: 'Shop reports' });
  fireEvent.click(screen.getByRole('button', { name: 'Actions for report 7' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Review report' }));
  fireEvent.change(await screen.findByLabelText(/Internal review note/), { target: { value: 'Investigating payment instructions' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
  expect(screen.getByLabelText(/Internal review note/)).toHaveValue('Investigating payment instructions');
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  await screen.findByText('Review saved.');
  fireEvent.click(screen.getByRole('button', { name: 'Close report review' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await screen.findByText('No shop reports match these filters.');
  expect(screen.getByRole('table', { name: 'Shop reports' })).toBe(table);
  expect(api.mock.calls.filter(([path]) => path.includes('?'))).toHaveLength(1);
});
it('applies reason and status filters only on submission', async () => {
  api.mockResolvedValue({ items: [], total: 0, page: 1, last_page: 1 }); render(<Harness />);
  await screen.findByText('No shop reports match these filters.');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'unsafe_products' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_review' } });
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('reason=unsafe_products'));
  expect(api.mock.calls.at(-1)[0]).toContain('status=in_review');
});
