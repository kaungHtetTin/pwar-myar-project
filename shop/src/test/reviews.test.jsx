import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Reviews, RatingSummary } from '../Reviews';
import { RetainedViews } from '../RetainedViews';
import { request } from '../api';
const account = vi.hoisted(() => ({ customer: { id: 8 }, loading: false }));
vi.mock('../CustomerAccount', () => ({ useCustomer: () => account }));
vi.mock('../api', () => ({ request: vi.fn() }));
const row = { id: 1, target_id: 7, rating: 4, comment: 'Excellent quality', customer_name: 'Buyer', created_at: '2026-10-08 01:00:00', reply: 'Thanks!' };
let mine, items, failure;
beforeEach(() => {
  account.customer = { id: 8 }; mine = null; items = []; failure = false;
  request.mockReset();
  request.mockImplementation(async (path, options = {}) => {
    if (options.method === 'PUT') {
      if (failure) throw new Error('Please try again.');
      mine = { ...row, ...JSON.parse(options.body) }; items = [mine];
      return { review: mine, summary: { count: 1, average: mine.rating } };
    }
    if (options.method === 'DELETE') { mine = null; items = []; return { summary: { count: 0, average: null } }; }
    if (path.endsWith('/mine')) return { review: mine, can_review: true };
    return { items, has_more: false, summary: { count: items.length, average: items[0]?.rating || null } };
  });
});
afterEach(cleanup);

it('preserves a failed review draft, retries once and updates the visible average', async () => {
  render(<><RatingSummary slug="demo" productId={7} rating={{ count: 0, average: null }} /><Reviews slug="demo" productId={7} /></>);
  fireEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a rating');
  fireEvent.click(screen.getByRole('radio', { name: '4 stars' }));
  fireEvent.change(screen.getByLabelText('Your review (optional)'), { target: { value: '<script>plain text</script>' } });
  failure = true; fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
  expect(screen.getByLabelText('Your review (optional)')).toHaveValue('<script>plain text</script>');
  failure = false; fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  await screen.findByRole('button', { name: 'Edit your review' });
  expect(screen.getAllByText('4.0 / 5 (1)')).toHaveLength(2);
  expect(screen.getByText('<script>plain text</script>')).toBeInTheDocument();
  expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(2);
});

it('cancels editing and deletion without writes or refetch, then deletes only after confirmation', async () => {
  mine = row; items = [row]; render(<Reviews slug="demo" productId={7} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit your review' }));
  fireEvent.change(screen.getByLabelText('Your review (optional)'), { target: { value: 'Unsaved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete your review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(request).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Delete your review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete review' }));
  await screen.findByRole('button', { name: 'Write a review' });
  expect(request.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1);
});

it('keeps own review actions on the matching row when it is outside the public page', async () => {
  mine = row; items = [{ ...row, id: 2, customer_name: 'Another Buyer' }];
  const view = render(<Reviews slug="demo" productId={7} />);
  const editButton = await screen.findByRole('button', { name: 'Edit your review' });
  expect(editButton.closest('.review-card')).toHaveTextContent('Buyer');
  expect(editButton.closest('.review-card')).not.toHaveTextContent('Another Buyer');
  expect(screen.getByRole('button', { name: 'Delete your review' }).closest('.review-card')).toBe(editButton.closest('.review-card'));
  expect(screen.getAllByRole('article')).toHaveLength(2);
  view.rerender(<Reviews slug="demo" productId={7} />);
  expect(screen.getAllByRole('button', { name: 'Edit your review' })).toHaveLength(1);
});

it('shows sign-in and completed-purchase requirements and reads public replies', async () => {
  account.customer = null; items = [row];
  const view = render(<Reviews slug="demo" />);
  expect(await screen.findByRole('link', { name: 'Sign in to write a review' })).toHaveAttribute('href', '#/account/login?next=%2Fstore%2Fdemo');
  expect(screen.getByText('Thanks!')).toBeInTheDocument();
  account.customer = { id: 9 };
  request.mockImplementation(async path => path.endsWith('/mine') ? { review: null, can_review: false } : { items, has_more: false, summary: { count: 1, average: 4 } });
  view.rerender(<Reviews slug="demo" />);
  expect(await screen.findByText('Complete a purchase before reviewing this shop or product.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Write a review' })).not.toBeInTheDocument();
});

it('retains the draft when leaving a product and returning without initial requests', async () => {
  const view = render(<RetainedViews activeKey="product"><Reviews slug="demo" productId={7} /></RetainedViews>);
  fireEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
  fireEvent.change(screen.getByLabelText('Your review (optional)'), { target: { value: 'My draft' } });
  view.rerender(<RetainedViews activeKey="shop"><div>Shop list</div></RetainedViews>);
  view.rerender(<RetainedViews activeKey="product"><Reviews slug="demo" productId={7} /></RetainedViews>);
  await waitFor(() => expect(screen.getByLabelText('Your review (optional)')).toHaveValue('My draft'));
  expect(request).toHaveBeenCalledTimes(2);
});

it('loads another review page without losing previously loaded reviews', async () => {
  request.mockImplementation(async path => {
    if (path.endsWith('/mine')) return { review: null, can_review: true };
    return path.includes('offset=1') ? { items: [{ ...row, id: 2, customer_name: 'Second Buyer' }], has_more: false, summary: { count: 2, average: 4 } }
      : { items: [row], has_more: true, summary: { count: 2, average: 4 } };
  });
  render(<Reviews slug="demo" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Load more reviews' }));
  await screen.findByText('Second Buyer');
  expect(screen.getByText('Buyer')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Load more reviews' })).not.toBeInTheDocument();
});
