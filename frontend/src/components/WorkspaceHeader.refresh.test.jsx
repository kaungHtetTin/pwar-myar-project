import React, { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceHeader } from './WorkspaceHeader';
import { requestDataRefresh, useDataRefresh } from '../dataEvents';
import { trackRefreshRequest } from '../manualRefresh';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Header(props) { return <WorkspaceHeader onToggleSidebar={() => {}} {...props} />; }
function Listener({ refresh, source = 'products' }) {
  useDataRefresh(['products'], source, refresh);
  return null;
}

it('shows an immediate spinning, disabled and announced refresh state until the slowest page read finishes', async () => {
  vi.useFakeTimers();
  const first = deferred(), second = deferred();
  const refresh = vi.fn(() => Promise.all([first.promise, second.promise]));
  render(<><Header onRefresh={() => requestDataRefresh(['*'], 'navigation', 'products')} /><Listener refresh={refresh} /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  const button = screen.getByRole('button', { name: 'Refreshing page', exact: true });
  expect(button).toBeDisabled(); expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button.querySelector('svg')).toHaveClass('workspace-refresh-spin');
  expect(screen.getByText('Refreshing…')).toBeInTheDocument();
  expect(screen.getByText('Refreshing page…')).toHaveAttribute('role', 'status');
  fireEvent.click(button);
  await act(async () => vi.advanceTimersByTimeAsync(150));
  expect(refresh).toHaveBeenCalledOnce();
  await act(async () => first.resolve());
  expect(button).toBeDisabled();
  await act(async () => second.resolve());
  expect(screen.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  expect(button).toHaveAttribute('aria-busy', 'false');
});

it('waits for both Sell refresh listeners without refreshing unrelated modules', async () => {
  vi.useFakeTimers();
  const catalog = deferred(), settings = deferred(), unrelated = vi.fn();
  render(<><Header onRefresh={() => requestDataRefresh(['*'], 'navigation', 'sell')} />
    <Listener source="sell" refresh={() => catalog.promise} /><Listener source="sell" refresh={() => settings.promise} />
    <Listener source="reports" refresh={unrelated} /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  await act(async () => vi.advanceTimersByTimeAsync(150));
  await act(async () => catalog.resolve());
  expect(screen.getByRole('button', { name: 'Refreshing page', exact: true })).toBeDisabled();
  await act(async () => settings.resolve());
  expect(screen.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  expect(unrelated).not.toHaveBeenCalled();
});

it('includes requests started by revision effects instead of ending after setState', async () => {
  vi.useFakeTimers();
  const pending = deferred(), read = vi.fn(() => trackRefreshRequest(pending.promise));
  function RevisionPage() {
    const [revision, setRevision] = useState(0);
    useDataRefresh(['ecommerce'], 'shop', () => setRevision(value => value + 1));
    useEffect(() => { if (revision) void read(); }, [revision]);
    return <p>Revision {revision}</p>;
  }
  render(<><Header onRefresh={() => requestDataRefresh(['*'], 'navigation', 'shop')} /><RevisionPage /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  await act(async () => vi.advanceTimersByTimeAsync(150));
  expect(read).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Refreshing page', exact: true })).toBeDisabled();
  await act(async () => pending.resolve());
  expect(screen.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
});

it('does not stop on an early rejection while another tracked read is still pending and permits retry', async () => {
  const first = deferred(), second = deferred(), failed = vi.fn();
  const refresh = vi.fn(() => Promise.all([trackRefreshRequest(first.promise), trackRefreshRequest(second.promise)]));
  render(<Header onRefresh={refresh} onRefreshError={failed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  await act(async () => first.reject(new Error('Connection failed')));
  expect(screen.getByRole('button', { name: 'Refreshing page', exact: true })).toBeDisabled();
  await act(async () => second.resolve());
  expect(failed).toHaveBeenCalledWith(expect.objectContaining({ message: 'Connection failed' }));
  refresh.mockResolvedValue(undefined);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true })));
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
});

it('keeps the new page refresh busy when an older page finishes after navigation', async () => {
  const previous = deferred(), current = deferred();
  const view = render(<Header refreshKey="products" onRefresh={() => previous.promise} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  view.rerender(<Header refreshKey="sales" onRefresh={() => current.promise} />);
  expect(screen.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  await act(async () => previous.resolve());
  expect(screen.getByRole('button', { name: 'Refreshing page', exact: true })).toBeDisabled();
  await act(async () => current.resolve());
  expect(screen.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
});

it('finishes safely when navigating away before a queued refresh starts', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  const view = render(<><Header onRefresh={() => requestDataRefresh(['*'], 'navigation', 'products')} /><Listener refresh={refresh} /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  await act(async () => view.unmount());
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(refresh).not.toHaveBeenCalled();
});
