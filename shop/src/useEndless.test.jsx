import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEndless } from './useEndless';

function List({ path = '/items', api, realtime = false }) {
  const list = useEndless(path, api);
  return <>{realtime && <button onClick={list.revalidate}>Reconcile</button>}<ul>{list.items.map(item => <li key={item.favorite_id ?? item.id ?? item.slug}>{item.name}</li>)}</ul><div ref={list.sentinel}>{list.error && <p role="alert">{list.error}</p>}{!list.busy && (list.more || list.error) && <button type="button" onClick={list.retry}>Load more</button>}</div></>;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('reconciles loaded pages without duplicates and advances from the refreshed cursor', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  let rows = Array.from({ length: 50 }, (_, id) => ({ id, name: `Row ${id}` }));
  const api = vi.fn(async url => {
    const offset = Number(new URL(url, 'http://fixture').searchParams.get('offset'));
    return { items: rows.slice(offset, offset + 24), has_more: offset + 24 < rows.length };
  });
  render(<List api={api} realtime />);
  await screen.findByText('Row 23');
  fireEvent.click(screen.getByText('Load more'));
  await screen.findByText('Row 47');
  rows = [{ id: 50, name: 'New conversation' }, ...rows];
  fireEvent.click(screen.getByText('Reconcile'));
  await screen.findByText('New conversation');
  expect(screen.getAllByRole('listitem')).toHaveLength(48);
  fireEvent.click(screen.getByText('Load more'));
  await screen.findByText('Row 49');
  expect(screen.getAllByRole('listitem')).toHaveLength(51);
  expect(api).toHaveBeenLastCalledWith('/items?offset=48&limit=24');
});

it('retains rows on realtime refresh failure and retries reconciliation from the start', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const api = vi.fn().mockResolvedValueOnce({ items: [{ id: 1, name: 'Original' }], has_more: false })
    .mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValueOnce({ items: [{ id: 2, name: 'Updated' }], has_more: false });
  render(<List api={api} realtime />);
  await screen.findByText('Original');
  fireEvent.click(screen.getByText('Reconcile'));
  await screen.findByRole('alert');
  expect(screen.getByText('Original')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Load more'));
  await screen.findByText('Updated');
  expect(screen.queryByText('Original')).not.toBeInTheDocument();
  expect(api).toHaveBeenLastCalledWith('/items?offset=0&limit=24');
});

it('keeps separate shops without numeric IDs and deduplicates by slug', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const api = vi.fn().mockResolvedValueOnce({ items: [{ slug: 'one', name: 'One' }, { slug: 'two', name: 'Two' }], has_more: true })
    .mockResolvedValueOnce({ items: [{ slug: 'two', name: 'Two' }, { slug: 'three', name: 'Three' }], has_more: false });
  render(<List api={api} />);await screen.findByText('Two');fireEvent.click(screen.getByRole('button'));await screen.findByText('Three');expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

it('keeps the manual fallback usable without IntersectionObserver, deduplicates stable row identities and advances by raw page size', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const api = vi.fn().mockResolvedValueOnce({ items: [{ id: 1, favorite_id: 10, name: 'First' }], has_more: true })
    .mockResolvedValueOnce({ items: [{ id: 1, favorite_id: 10, name: 'Updated first' }, { id: 1, favorite_id: 11, name: 'Second saved row' }], has_more: true })
    .mockResolvedValueOnce({ items: [], has_more: false });
  render(<List api={api} />);
  await screen.findByText('First');fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Second saved row');expect(screen.getAllByRole('listitem')).toHaveLength(2);expect(screen.getByText('Updated first')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/items?offset=0&limit=24', '/items?offset=1&limit=24', '/items?offset=3&limit=24']);
});

it('ignores old filter responses and preserves loaded rows when an incremental page fails', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  let resolveOld;
  const api = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ items: [{ id: 2, name: 'New filter' }], has_more: true })
    .mockRejectedValueOnce(new Error('Page failed'))
    .mockResolvedValueOnce({ items: [{ id: 3, name: 'Next row' }], has_more: false });
  const view = render(<List path="/items?q=old" api={api} />);view.rerender(<List path="/items?q=new" api={api} />);
  await screen.findByText('New filter');await act(async () => resolveOld({ items: [{ id: 1, name: 'Stale row' }], has_more: false }));
  expect(screen.queryByText('Stale row')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(screen.getByText('New filter')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));await screen.findByText('Next row');
  expect(api.mock.calls.at(-1)[0]).toBe('/items?q=new&offset=1&limit=24');
});
