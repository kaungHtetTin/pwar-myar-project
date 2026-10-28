import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ProductReviewsPage } from './ProductReviewsPage';
import { RetainedViews } from './RetainedViews';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const original = { id: 7, business_id: 11, product_id: 21, customer_id: 31, shop_name: 'Demo Shop', shop_slug: 'demo-shop', product_name: 'Rice', customer_name: 'Buyer', customer_email: 'buyer@example.test', rating: 4, comment: 'Good rice', reply: null, created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', replied_at: null, version: 'a'.repeat(64) };
let rows, fail, pending;
beforeEach(() => {
  rows = [{ ...original }]; fail = null; pending = null; api.mockReset();
  api.mockImplementation(async (path, options) => {
    if (options) {
      if (fail) { const error = fail; fail = null; throw new Error(error); }
      if (pending) await pending;
      const body = JSON.parse(options.body);
      if (options.method === 'POST') { const item = { ...original, ...body, id: 8 }; rows.push(item); return item; }
      if (options.method === 'PUT') { rows[0] = { ...rows[0], ...body }; return rows[0]; }
      if (options.method === 'DELETE') { rows = []; return { ok: true }; }
    }
    const params = new URL(path, 'http://fixture').searchParams;
    if (path.includes('/options?')) {
      const lookup = { shops: [{ id: 11, label: 'Demo Shop' }], products: [{ id: 21, label: 'Rice' }], customers: [{ id: 31, label: 'Buyer', detail: 'buyer@example.test' }] };
      return { items: lookup[params.get('kind')], has_more: false, selected: null };
    }
    const per_page = Number(params.get('per_page') || 25), last_page = Math.max(1, Math.ceil(rows.length / per_page)), page = Math.min(Number(params.get('page') || 1), last_page);
    return { items: rows.slice((page - 1) * per_page, page * per_page), total: rows.length, page, per_page, last_page };
  });
});
function Harness() {
  const [open, setOpen] = useState(false);
  return <ProductReviewsPage filterOpen={open} onFilterOpen={() => setOpen(true)} onFilterClose={() => setOpen(false)} />;
}
const mount = async () => { render(<Harness />); await screen.findByText('Good rice'); await waitFor(() => expect(screen.getByRole('button', { name: 'New review' })).toBeEnabled()); };
const menu = action => { fireEvent.click(screen.getByRole('button', { name: 'Actions for product review 7' })); fireEvent.click(screen.getByRole('menuitem', { name: action })); };
const listCalls = () => api.mock.calls.filter(([path]) => path.startsWith('/office/product-reviews?')).length;
it('views details and cancels editing without remounting or refetching the source table', async () => {
  await mount(); const table = screen.getByRole('table'), before = listCalls();
  menu('View review'); expect(screen.getByRole('dialog', { name: 'Product review details' })).toHaveTextContent('Good rice');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: 'Actions for product review 7' })).toHaveFocus();
  menu('Edit review'); fireEvent.change(screen.getByLabelText('Customer comment'), { target: { value: 'Unsent draft' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByRole('table')).toBe(table); expect(listCalls()).toBe(before);
  expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveClass('office-action-column');
});
it('creates reviews through scoped shop, product and verified-customer lookups', async () => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: 'New review' }));
  expect(screen.getByLabelText('Product')).toBeDisabled(); expect(screen.getByLabelText('Customer')).toBeDisabled();
  await screen.findByRole('option', { name: 'Demo Shop' }); fireEvent.change(screen.getByLabelText('Shop'), { target: { value: '11' } });
  await screen.findByRole('option', { name: 'Rice' }); fireEvent.change(screen.getByLabelText('Product'), { target: { value: '21' } });
  await screen.findByRole('option', { name: 'Buyer (buyer@example.test)' }); fireEvent.change(screen.getByLabelText('Customer'), { target: { value: '31' } });
  fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Customer comment'), { target: { value: ' Great product ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save review' })); await screen.findByText('Product review saved.');
  const [, options] = api.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(options.body)).toEqual({ business_id: 11, product_id: 21, customer_id: 31, rating: 5, comment: 'Great product', reply: null });
  await screen.findByText('Great product');
});
it('retains failed edits for retry and prevents duplicate saves and busy dismissal', async () => {
  await mount(); menu('Edit review');
  fireEvent.change(screen.getByLabelText('Customer comment'), { target: { value: 'Updated review' } });
  fail = 'This review changed. Refresh before saving.';
  fireEvent.click(screen.getByRole('button', { name: 'Save review' })); await screen.findByRole('alert');
  expect(screen.getByLabelText('Customer comment')).toHaveValue('Updated review');
  let finish; pending = new Promise(resolve => { finish = resolve; });
  fireEvent.click(screen.getByRole('button', { name: 'Save review' })); fireEvent.submit(screen.getByLabelText('Rating').closest('form'));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled(); fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  const writes = api.mock.calls.filter(([, options]) => options?.method === 'PUT'); expect(writes).toHaveLength(2);
  expect(JSON.parse(writes[1][1].body).version).toBe(original.version);
  await act(async () => finish()); await screen.findByText('Product review saved.'); await screen.findByText('Updated review');
});
it('cancels deletion safely and deletes with the original review version', async () => {
  await mount(); menu('Delete review'); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  menu('Delete review'); fail = 'Delete failed'; fireEvent.click(screen.getByRole('button', { name: 'Delete review' }));
  await screen.findByText('Delete failed'); expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete review' })); await screen.findByText('Product review deleted.'); await screen.findByText('No product reviews match these filters.');
  const call = api.mock.calls.find(([, options]) => options?.method === 'DELETE'); expect(JSON.parse(call[1].body)).toEqual({ version: original.version });
});
it('preserves search and page size while applying, dismissing and clearing drawer filters', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText('Search product reviews'), { target: { value: 'rice' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=rice')));
  fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } }); await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('per_page=50')));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Filters' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Filters' })); fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '1' } }); fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Filters' })); expect(screen.getByLabelText('Rating')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '4' } }); fireEvent.change(screen.getByLabelText('Reply status'), { target: { value: 'unreplied' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('rating=4')));
  await waitFor(() => expect(screen.getByRole('button', { name: /Filters/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Filters/ })); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('reply_status=all')));
  const last = api.mock.calls.filter(([path]) => path.startsWith('/office/product-reviews?')).at(-1)[0]; expect(last).toContain('q=rice'); expect(last).toContain('per_page=50'); expect(last).not.toContain('rating=4');
});
it('uses shared pagination controls with correct first and last boundaries', async () => {
  rows = Array.from({ length: 26 }, (_, index) => ({ ...original, id: index + 1, comment: `Review ${index + 1}` }));
  render(<Harness />); await screen.findByText('Review 1');
  expect(screen.getByRole('button', { name: 'First' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Last' })); await screen.findByText('Review 26');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Last' })).toBeDisabled()); expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'First' })); await screen.findByText('Review 1');
});
it('retains edit drafts, data and search across Office section changes without a return fetch', async () => {
  function RetainedHarness() {
    const [tab, setTab] = useState('reviews');
    return <><button onClick={() => setTab('reviews')}>Reviews section</button><button onClick={() => setTab('other')}>Other section</button><RetainedViews activeKey={tab}>{tab === 'reviews' ? <Harness /> : <p>Other page</p>}</RetainedViews></>;
  }
  render(<RetainedHarness />); await screen.findByText('Good rice');
  fireEvent.change(screen.getByLabelText('Search product reviews'), { target: { value: 'Retained search' } });
  menu('Edit review'); fireEvent.change(screen.getByLabelText('Customer comment'), { target: { value: 'Retained draft' } });
  const count = listCalls(); fireEvent.click(screen.getByRole('button', { name: 'Other section' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reviews section' })); expect(screen.getByLabelText('Customer comment')).toHaveValue('Retained draft');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByLabelText('Search product reviews')).toHaveValue('Retained search'); expect(listCalls()).toBe(count);
});
