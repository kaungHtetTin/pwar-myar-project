import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShopBusy, ShopErrorNotice, ShopLoading, ShopLoadState } from './ShopPrimitives';

it('announces loading once without exposing skeleton content or fake controls', () => {
  render(<ShopLoading label="Loading customers…" variant="contacts" />);
  expect(screen.getByRole('status', { name: 'Loading customers…' })).toBeInTheDocument();
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('keeps existing content visible when a background reload fails', () => {
  const { rerender } = render(<ShopLoadState resource={{ data: { id: 8 }, error: '' }}><p>Retained order</p></ShopLoadState>);
  const content = screen.getByText('Retained order');
  rerender(<ShopLoadState resource={{ data: { id: 8 }, error: 'Refresh failed' }}><p>Retained order</p></ShopLoadState>);
  expect(screen.getByText('Retained order')).toBe(content);
  expect(screen.getByRole('alert')).toHaveTextContent('Refresh failed');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('replaces initial loading with a retryable error and then content', () => {
  const reload = vi.fn();
  const { rerender } = render(<ShopLoadState resource={{ data: null, error: '', reload }}><p>Loaded order</p></ShopLoadState>);
  expect(screen.getByRole('status')).toHaveAccessibleName('Loading…');
  rerender(<ShopLoadState resource={{ data: null, error: 'Connection failed', reload }}><p>Loaded order</p></ShopLoadState>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(reload).toHaveBeenCalledOnce();
  rerender(<ShopLoadState resource={{ data: { id: 8 }, error: '', reload }}><p>Loaded order</p></ShopLoadState>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('Loaded order')).toBeInTheDocument();
});

it('preserves the action label and hides the decorative busy icon', () => {
  render(<button type="button" disabled><ShopBusy label="Saving…" /></button>);
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('button').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});

it('guards retry while pending and keeps the error available for a failed retry', async () => {
  let rejectRetry;
  const retry = vi.fn(() => new Promise((_, reject) => { rejectRetry = reject; }));
  render(<ShopErrorNotice message="Request timed out. Check your connection and try again." onRetry={retry} />);
  const button = screen.getByRole('button', { name: 'Retry' });
  fireEvent.click(button); fireEvent.click(button);
  expect(retry).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent('Trying again…');
  rejectRetry(new Error('Still unavailable'));
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(screen.getByRole('alert')).toHaveTextContent('Request timed out. Check your connection and try again.');
});
