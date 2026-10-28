import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEndlessList } from './useEndlessList';

function Harness({ loadPage, queryKey = 'default', pageSize = 2 }) {
  const list = useEndlessList({ loadPage, queryKey, pageSize });
  return (
    <div>
      <div data-testid="items">{list.items.map((item) => item.id).join(',')}</div>
      <div data-testid="total">{String(list.total)}</div>
      <div data-testid="has-more">{String(list.hasMore)}</div>
      <div data-testid="error">{list.error}</div>
      <button type="button" onClick={list.loadMore}>Load next</button>
      <button type="button" onClick={list.retry}>Retry</button>
      <button type="button" onClick={list.reload}>Refresh loaded</button>
    </div>
  );
}

describe('useEndlessList', () => {
  it('reconciles all loaded pages after a mutation while keeping rows visible and the next offset', async () => {
    let revision = 0, release;
    const loadPage = vi.fn(({ offset }) => {
      if (revision && offset === 0) return new Promise((resolve) => { release = () => resolve({ items: [{ id: 10 }, { id: 2 }], total: 6 }); });
      return Promise.resolve({ items: [{ id: offset + 1 }, { id: offset + 2 }], total: 6 });
    });
    render(<Harness loadPage={loadPage} />);
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1,2'));
    fireEvent.click(screen.getByRole('button', { name: 'Load next' }));
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1,2,3,4'));
    revision = 1;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh loaded' }));
    expect(screen.getByTestId('items')).toHaveTextContent('1,2,3,4');
    release();
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('10,2,3,4'));
    fireEvent.click(screen.getByRole('button', { name: 'Load next' }));
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('10,2,3,4,5,6'));
    expect(loadPage).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 4 }));
  });
  it('appends pages, deduplicates stable IDs, and stops at the known total', async () => {
    const loadPage = vi.fn(({ offset }) => Promise.resolve(offset === 0
      ? { items: [{ id: 1 }, { id: 2 }], total: 3 }
      : { items: [{ id: 2 }, { id: 3 }], total: 3 }));
    render(<Harness loadPage={loadPage} />);

    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1,2'));
    fireEvent.click(screen.getByRole('button', { name: 'Load next' }));

    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1,2,3'));
    expect(loadPage).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 2, offset: 2 }));
    expect(screen.getByTestId('has-more')).toHaveTextContent('false');
  });

  it('resets items and offset when the query scope changes', async () => {
    const firstLoader = vi.fn(() => Promise.resolve({ items: [{ id: 1 }], total: 1 }));
    const secondLoader = vi.fn(() => Promise.resolve({ items: [{ id: 7 }], total: 1 }));
    const { rerender } = render(<Harness loadPage={firstLoader} queryKey="all" />);
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1'));

    rerender(<Harness loadPage={secondLoader} queryKey="low-stock" />);

    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('7'));
    expect(secondLoader).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('preserves existing items when loading another page fails and can retry', async () => {
    const loadPage = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 1 }, { id: 2 }], total: 4 })
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({ items: [{ id: 3 }, { id: 4 }], total: 4 });
    render(<Harness loadPage={loadPage} />);
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1,2'));

    fireEvent.click(screen.getByRole('button', { name: 'Load next' }));
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Connection lost'));
    expect(screen.getByTestId('items')).toHaveTextContent('1,2');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1,2,3,4'));
  });

  it('uses a short page as authoritative exhaustion without a total', async () => {
    render(<Harness loadPage={() => Promise.resolve([{ id: 1 }])} />);
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('1'));
    expect(screen.getByTestId('has-more')).toHaveTextContent('false');
  });
});
