import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShopReviews } from './ShopReviews';
import { request } from '../api';
vi.mock('../api', () => ({ request: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const row = { id: 2, rating: 5, target_id: 0, customer_name: 'Buyer', comment: 'Great shop', reply: null };

it('preserves list data on cancel and saves replies in place after a retry', async () => {
  let fail = true;
  request.mockImplementation(async (path, options) => {
    if (options?.method) { if (fail) throw new Error('Reply failed'); return { reply: 'Thank you', replied_at: '2026-10-08 01:00:00' }; }
    return { items: [row], total: 1 };
  });
  render(<ShopReviews canReply />);
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Buyer - Shop review' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Buyer - Shop review' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }));
  fireEvent.change(screen.getByLabelText('Your public reply'), { target: { value: 'Thank you' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reply' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reply failed');
  expect(screen.getByLabelText('Your public reply')).toHaveValue('Thank you');
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Save reply' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Buyer - Shop review' }));
  await screen.findByRole('menuitem', { name: 'Edit reply' });
  expect(screen.getByText('Thank you')).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(3);
});

it('filters reviews and hides reply controls for read-only staff', async () => {
  request.mockResolvedValue({ items: [row], total: 1 });
  render(<ShopReviews />);
  await screen.findByText('Buyer');
  const table = screen.getByRole('table', { name: 'Ratings and reviews' });
  expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Customer', 'Review for', 'Rating', 'Review', 'Your reply']);
  expect(within(table).queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Review type' }), { target: { value: 'product' } });
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request.mock.calls.at(-1)[0]).toContain('type=product'));
  expect(screen.getByRole('button', { name: 'Filters1' })).toBeInTheDocument();
});

it('uses app-bar slots and preserves search and pagination when cancelling the filter drawer', async () => {
  request.mockResolvedValue({ items: [row], total: 41 });
  render(<><div id="workspace-app-bar-search" /><div id="workspace-app-bar-actions" /><ShopReviews /></>);
  const search = screen.getByRole('textbox', { name: 'Search reviews' });
  fireEvent.change(search, { target: { value: 'Buyer' } });
  await waitFor(() => expect(request.mock.calls.at(-1)[0]).toContain('q=Buyer'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('21-40 of 41');
  const count = request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  const drawer = screen.getByRole('dialog', { name: 'Review filters' });
  fireEvent.change(within(drawer).getByRole('combobox', { name: 'Review type' }), { target: { value: 'shop' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Review filters' })).not.toBeInTheDocument());
  expect(search).toHaveValue('Buyer');
  expect(screen.getByText('21-40 of 41')).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByRole('combobox', { name: 'Review type' })).toHaveValue('');
  fireEvent.change(screen.getByRole('combobox', { name: 'Review type' }), { target: { value: 'product' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request.mock.calls.at(-1)[0]).toContain('type=product&q=Buyer&offset=0'));
  fireEvent.click(screen.getByRole('button', { name: 'Filters1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(request.mock.calls.at(-1)[0]).toContain('type=&q=&offset=0'));
  expect(search).toHaveValue('');
});

it('applies combined filters, validates dates, and clears the complete filter scope', async () => {
  request.mockResolvedValue({ items: [row], total: 41 });
  render(<ShopReviews />);
  await screen.findByText('Buyer');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  for (const [name, value] of [['Review type', 'product'], ['Star rating', '2'], ['Reply status', 'unreplied'], ['Review content', 'written'], ['Sort reviews', 'rating_low']]) {
    fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
  }
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-09' } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-08' } });
  expect(screen.getByRole('button', { name: 'Apply Filter' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('From date cannot be later');
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-10' } });
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  const params = new URLSearchParams(request.mock.calls.at(-1)[0].split('?')[1]);
  expect(Object.fromEntries(params)).toMatchObject({ type: 'product', rating: '2', reply_status: 'unreplied', content: 'written', date_from: '2026-10-09', date_to: '2026-10-10', sort: 'rating_low', offset: '0' });
  fireEvent.click(screen.getByRole('button', { name: 'Filters6' }));
  expect(screen.getByRole('combobox', { name: 'Star rating' })).toHaveValue('2');
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  const cleared = new URLSearchParams(request.mock.calls.at(-1)[0].split('?')[1]);
  for (const name of ['type', 'rating', 'reply_status', 'content', 'date_from', 'date_to']) expect(cleared.get(name)).toBe('');
  expect(cleared.get('sort')).toBe('newest');
});

it('refills only the affected filtered page when a reply changes row membership', async () => {
  let replied = false;
  request.mockImplementation(async (path, options) => {
    if (options?.method) { replied = true; return { reply: 'Thank you', replied_at: '2026-10-09 01:00:00' }; }
    return { items: replied ? [] : [row], total: replied ? 0 : 1 };
  });
  render(<ShopReviews canReply />);
  await screen.findByText('Buyer');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Reply status' }), { target: { value: 'unreplied' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Buyer - Shop review' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }));
  fireEvent.change(screen.getByLabelText('Your public reply'), { target: { value: 'Thank you' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reply' }));
  await waitFor(() => expect(screen.queryByText('Buyer')).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledTimes(4);
  expect(request.mock.calls.at(-1)[0]).toContain('reply_status=unreplied');
  expect(screen.getByText('0-0 of 0')).toBeInTheDocument();
});
