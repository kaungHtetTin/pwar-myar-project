import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SwipeRefreshShell } from './SwipeRefreshShell';
import { usePageRefresh } from './pageRefresh';

beforeEach(() => { Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 }); });
const start = node => fireEvent.touchStart(node, { touches: [{ clientX: 10, clientY: 10 }] });
const move = (node, x = 10, y = 180) => fireEvent.touchMove(node, { touches: [{ clientX: x, clientY: y }], cancelable: true });
const pull = node => { start(node); move(node); fireEvent.touchEnd(node); };

function Resource({ refresh, fallback, children }) { usePageRefresh(refresh, { fallback }); return children; }

it('uses the visible page handler instead of a parent settings resource, then restores fallback resources', async () => {
  const settings = vi.fn(), list = vi.fn(), other = vi.fn();
  const { rerender } = render(<SwipeRefreshShell><Resource refresh={settings} fallback><Resource refresh={list}>List</Resource></Resource></SwipeRefreshShell>);
  pull(screen.getByRole('region'));
  await waitFor(() => expect(list).toHaveBeenCalledOnce());
  expect(settings).not.toHaveBeenCalled();
  rerender(<SwipeRefreshShell><Resource refresh={settings} fallback><Resource refresh={other} fallback>Details</Resource></Resource></SwipeRefreshShell>);
  await waitFor(() => expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'false'));
  pull(screen.getByRole('region'));
  await waitFor(() => { expect(settings).toHaveBeenCalledOnce(); expect(other).toHaveBeenCalledOnce(); });
  expect(list).toHaveBeenCalledOnce();
});

it('cancels without refreshing when the browser interrupts a completed pull', () => {
  const refresh = vi.fn();
  render(<SwipeRefreshShell onRefresh={refresh}><p>Content</p></SwipeRefreshShell>);
  const shell = screen.getByRole('region');
  start(shell); move(shell);
  expect(screen.getByText('Release to refresh')).toBeInTheDocument();
  fireEvent.touchCancel(shell); fireEvent.touchEnd(shell);
  expect(refresh).not.toHaveBeenCalled();
  expect(shell).not.toHaveClass('is-refreshing');
});

it('does not steal scrolling, form editing, horizontal swipes or multi-touch', () => {
  const refresh = vi.fn();
  render(<SwipeRefreshShell onRefresh={refresh}><input aria-label="Draft" defaultValue="Keep me" /><div data-testid="scroller">List</div><section data-disable-swipe-refresh>Conversation</section></SwipeRefreshShell>);
  const shell = screen.getByRole('region'), scroller = screen.getByTestId('scroller');
  pull(screen.getByRole('textbox'));
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 20 });
  pull(scroller); pull(screen.getByText('Conversation'));
  start(shell); move(shell, 220, 50); fireEvent.touchEnd(shell);
  start(shell); move(shell);
  fireEvent.touchMove(shell, { touches: [{ clientY: 180 }, { clientY: 180 }] }); fireEvent.touchEnd(shell);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 }); pull(shell);
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toHaveValue('Keep me');
});

it('owns the downward touch gesture and ignores duplicate pulls while busy', async () => {
  let finish;
  const refresh = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  render(<SwipeRefreshShell onRefresh={refresh}>Content</SwipeRefreshShell>);
  const shell = screen.getByRole('region');
  start(shell);
  expect(move(shell)).toBe(false); // A non-passive listener prevents native document refresh.
  fireEvent.touchEnd(shell);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(shell).toHaveAttribute('aria-busy', 'true');
  pull(shell);
  expect(refresh).toHaveBeenCalledOnce();
  await act(async () => { finish(); });
  expect(shell).toHaveAttribute('aria-busy', 'false');
});

it('releases the busy state after a failed refresh and allows another pull', async () => {
  const refresh = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce();
  render(<SwipeRefreshShell onRefresh={refresh}>Content</SwipeRefreshShell>);
  const shell = screen.getByRole('region');
  pull(shell);
  await waitFor(() => expect(shell).toHaveAttribute('aria-busy', 'false'));
  pull(shell);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
});
