import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { RetainedActivityContext } from './retainedActivity';
import ShopDistributionPage from './ShopDistributionPage';

vi.mock('./api', () => ({ api: vi.fn() }));
vi.mock('./ShopDistributionMap', () => ({ ShopDistributionMap: ({ points, onSelect }) => <div aria-label="Map fixture">{points.map(point => <button key={point.id} type="button" onClick={() => onSelect(point)}>Marker {point.id}</button>)}</div> }));
const shop = { id: 1, business_name: 'River Supplies', address: 'Jetty road', latitude: 0, longitude: 96, status: 'active' };
const response = { items: [shop, { id: 2, business_name: 'Unlocated shop', latitude: null, longitude: null }], points: [shop], summary: { total: 26, located: 1, missing: 25 }, total: 26, page: 1, per_page: 25, last_page: 2, map_total: 1 };
beforeEach(() => { api.mockReset(); api.mockResolvedValue(response); });

it('selects a saved location including latitude zero and opens the correct business once', async () => {
  const open = vi.fn();
  render(<ShopDistributionPage onOpenBusiness={open} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Show on map' }));
  const selected = screen.getByRole('region', { name: 'Selected shop' });
  expect(selected).toHaveTextContent('0.000000, 96.000000');
  expect(screen.getAllByRole('button', { name: 'Show on map' })).toHaveLength(1);
  fireEvent.click(selected.querySelector('button'));
  expect(open).toHaveBeenCalledExactlyOnceWith(1);
  expect(selected.querySelector('a')).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=0,96');
});

it('searches explicitly, resets pagination, and clears only the search', async () => {
  render(<ShopDistributionPage />);
  await screen.findByText('Unlocated shop');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search shops' }), { target: { value: ' River ' } });
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=River')));
  fireEvent.click(screen.getByRole('button', { name: 'Clear search shops' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=&location=all&page=1')));
});

it('dismisses filter drafts and applies location filters without losing search', async () => {
  render(<ShopDistributionPage />);
  await screen.findByText('Unlocated shop');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Saved location'), { target: { value: 'missing' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByLabelText('Saved location')).toHaveValue('all');
  fireEvent.change(screen.getByLabelText('Saved location'), { target: { value: 'missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('location=missing')));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps the selected shop and data when hidden and shown again without a new request', async () => {
  const view = active => <RetainedActivityContext.Provider value={active}><ShopDistributionPage /></RetainedActivityContext.Provider>;
  const { rerender } = render(view(true));
  fireEvent.click(await screen.findByRole('button', { name: 'Marker 1' }));
  rerender(view(false)); rerender(view(true));
  expect(screen.getByRole('region', { name: 'Selected shop' })).toHaveTextContent('River Supplies');
  expect(api).toHaveBeenCalledTimes(1);
});

it('applies all shop filters together, counts them, and clears them while retaining search', async () => {
  render(<ShopDistributionPage />);
  await screen.findByText('Unlocated shop');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search shops' }), { target: { value: 'River' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=River')));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Shop status'), { target: { value: 'enabled' } });
  fireEvent.change(screen.getByLabelText('Marketplace status'), { target: { value: 'enabled' } });
  fireEvent.change(screen.getByLabelText('Order acceptance'), { target: { value: 'open' } });
  fireEvent.change(screen.getByLabelText('Paid status'), { target: { value: 'paid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('shop=enabled&marketplace=enabled&orders=open&access=paid')));
  expect(screen.getByRole('button', { name: 'Filters4' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters4' }));
  expect(screen.getByLabelText('Paid status')).toHaveValue('paid');
  fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('shop=all&marketplace=all&orders=all&access=all')));
  expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=River&location=all&page=1'));
  expect(screen.getByRole('searchbox', { name: 'Search shops' })).toHaveValue('River');
});

it('reconciles storefront changes in the retained map without resetting search or filters', async () => {
  render(<ShopDistributionPage />);
  await screen.findByText('Unlocated shop');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search shops' }), { target: { value: 'River' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  api.mockResolvedValue({ ...response, items: [{ ...shop, shop_enabled: false }], points: [{ ...shop, shop_enabled: false }] });
  act(() => window.dispatchEvent(new CustomEvent('mkpos:office-storefront-changed', { detail: { businessId: 1 } })));
  await screen.findByText('Shop disabled');
  expect(api).toHaveBeenCalledTimes(3);
  expect(api).toHaveBeenLastCalledWith(expect.stringContaining('q=River&location=all&page=1'));
  expect(screen.getByRole('searchbox', { name: 'Search shops' })).toHaveValue('River');
});

it('recovers from request failure with Retry and handles an empty result', async () => {
  api.mockRejectedValueOnce(new Error('Could not fetch locations')).mockResolvedValueOnce({ ...response, items: [], points: [], total: 0, map_total: 0 });
  render(<ShopDistributionPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not fetch locations');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No shops match these filters.');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('ignores an older response after a new search and requests bounded next pages', async () => {
  let resolveOld;
  api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue(response);
  render(<ShopDistributionPage />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search shops' }), { target: { value: 'River' } });
  fireEvent.submit(screen.getByRole('search'));
  await screen.findByText('Unlocated shop');
  resolveOld({ ...response, items: [{ id: 9, business_name: 'Stale result' }] });
  await waitFor(() => expect(screen.queryByText('Stale result')).not.toBeInTheDocument());
  api.mockResolvedValue({ ...response, page: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('page=2&per_page=25')));
});
