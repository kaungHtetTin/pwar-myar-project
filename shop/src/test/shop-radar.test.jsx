import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ShopRadar } from '../ShopRadar';

const shop = { slug: 'near-shop', display_name: 'Nearby Grocery', distance_km: 0.3, location: { latitude: 16.842, longitude: 96.171 } };
const ListEnd = ({ list }) => <div ref={list.sentinel}>{list.error && <p role="alert">{list.error}</p>}{list.error || list.more ? <button onClick={list.retry}>{list.error ? 'Try again' : 'Load more'}</button> : null}</div>;
const response = data => ({ ok: true, json: async () => data });
let locate;
beforeEach(() => {
  locate = vi.fn(); vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
  vi.stubGlobal('fetch', vi.fn(async () => response({ items: [shop], has_more: false })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const show = () => render(<ShopRadar ListEnd={ListEnd} />);
async function position() {
  await act(async () => locate.mock.calls.at(-1)[0]({ coords: { latitude: 16.84, longitude: 96.17, accuracy: 15 } }));
  await screen.findByRole('link', { name: /Nearby Grocery/ });
}
it('automatically requests location once on opening and shows distances, map and directions', async () => {
  const view = show(); expect(fetch).not.toHaveBeenCalled();
  expect(locate).toHaveBeenCalledTimes(1);
  view.rerender(<ShopRadar ListEnd={ListEnd} />);
  expect(locate).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Update my location' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Find shops near me' })).not.toBeInTheDocument();
  await act(async () => locate.mock.calls[0][0]({ coords: { latitude: 16.84, longitude: 96.17, accuracy: 15 } }));
  await screen.findByText('300 m away');
  expect(fetch.mock.calls[0][0]).toContain('latitude=16.84&longitude=96.17&radius_km=5');
  fireEvent.click(screen.getByRole('button', { name: 'Show on map' }));
  expect(screen.getByTitle('Shop Radar map').getAttribute('src')).toContain(encodeURIComponent('16.842,96.171'));
  const directions = new URL(screen.getByRole('link', { name: 'Directions' }).href);
  expect(directions.searchParams.get('origin')).toBe('16.84,96.17'); expect(directions.searchParams.get('destination')).toBe('16.842,96.171');
  fireEvent.click(screen.getByRole('button', { name: 'Center on my location' })); expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument();
});
it('recovers from automatic location permission denial using the error retry', async () => {
  show();
  await act(async () => locate.mock.calls[0][1]({ code: 1 }));
  expect(screen.getByRole('alert')).toHaveTextContent('Allow location access'); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(locate).toHaveBeenCalledTimes(2);
  await position();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('filters by radius and submitted shop name, clears search and resets selected map on filter changes', async () => {
  show(); await position(); fireEvent.click(screen.getByRole('button', { name: 'Show on map' }));
  fireEvent.change(screen.getByLabelText('Distance range'), { target: { value: '10' } });
  await waitFor(() => expect(fetch.mock.calls.at(-1)[0]).toContain('radius_km=10'));
  expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument();
  const search = screen.getByRole('searchbox', { name: 'Search nearby shops' });
  fireEvent.change(search, { target: { value: 'Grocery' } }); fireEvent.submit(search.closest('form'));
  await waitFor(() => expect(fetch.mock.calls.at(-1)[0]).toContain('q=Grocery'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await waitFor(() => expect(fetch.mock.calls.at(-1)[0]).not.toContain('q=Grocery'));
});
it('retries a failed page while preserving the existing shops and supports an empty result', async () => {
  let next = 0;
  fetch.mockImplementation(async url => {
    if (url.includes('radius_km=1&')) return response({ items: [], has_more: false });
    if (url.includes('offset=0')) return response({ items: [shop], has_more: true });
    next++; return next === 1 ? { ok: false, status: 503, json: async () => ({ message: 'Temporary radar failure' }) } : response({ items: [{ ...shop, slug: 'second', display_name: 'Second shop', distance_km: 1.2 }], has_more: false });
  });
  show(); await position(); fireEvent.click(screen.getByRole('button', { name: 'Load more' })); await screen.findByRole('alert');
  expect(screen.getByRole('link', { name: /Nearby Grocery/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await screen.findByRole('link', { name: /Second shop/ });
  fireEvent.change(screen.getByLabelText('Distance range'), { target: { value: '1' } }); await screen.findByText('No shops found nearby');
});
