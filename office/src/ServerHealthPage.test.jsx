import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ServerHealthPage } from './ServerHealthPage';
import { RetainedActivityContext } from './retainedActivity';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const snapshot = { status: 'unhealthy', checked_at: '2026-10-26T08:00:00Z', checks: [
  { id: 'database', group: 'Data & storage', label: 'Database', status: 'healthy', scope: 'live', required: true, message: 'Database accepted a read query.' },
  { id: 'cache', group: 'Data & storage', label: 'Cache', status: 'unhealthy', scope: 'live', required: true, message: 'Cache is unavailable.' },
  { id: 'telegram', group: 'Integrations', label: 'Telegram', status: 'disabled', scope: 'configuration', required: false, message: 'Telegram is disabled.' },
] };
beforeEach(() => { api.mockReset(); api.mockResolvedValue(snapshot); });
afterEach(() => { vi.useRealTimers(); });

it('shows dense grouped checks with explicit statuses and configuration scope', async () => {
  render(<ServerHealthPage/>);
  await screen.findByText('Cache is unavailable.');
  expect(screen.getByRole('list', { name: 'Data & storage' }).children).toHaveLength(2);
  expect(screen.getByText('Telegram is disabled.')).toBeVisible();
  expect(screen.getByText('Configuration')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Data & storage/ }));
  expect(screen.getByText('Cache is unavailable.')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Data & storage/ }));
  expect(screen.getByText('Cache is unavailable.')).toBeVisible();
});

it('searches, clears, applies and clears status filters locally without another request', async () => {
  render(<ServerHealthPage/>); await screen.findByText('Cache is unavailable.');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search server health' }), { target: { value: 'cache' } });
  expect(screen.queryByText('Database accepted a read query.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search server health' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'attention' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.queryByText('Database accepted a read query.')).not.toBeInTheDocument();
  expect(screen.getByText('Cache is unavailable.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.getByText('Database accepted a read query.')).toBeVisible();
  expect(api).toHaveBeenCalledTimes(1);
});

it('marks failed refresh as unavailable, keeps prior results and retries once while blocking double clicks', async () => {
  render(<ServerHealthPage/>); await screen.findByText('Cache is unavailable.');
  let reject;
  api.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();
  reject(new Error('Network interrupted'));
  await screen.findByRole('alert');
  expect(screen.getByText('Unavailable')).toBeVisible();
  expect(screen.getByText('Cache is unavailable.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(api).toHaveBeenCalledTimes(3);
});

it('retains search and group state on return without fetching again and closes the drawer when leaving', async () => {
  const view = render(<RetainedActivityContext.Provider value={true}><ServerHealthPage/></RetainedActivityContext.Provider>);
  await screen.findByText('Cache is unavailable.');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cache' } });
  fireEvent.click(screen.getByRole('button', { name: /Data & storage/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  view.rerender(<RetainedActivityContext.Provider value={false}><ServerHealthPage/></RetainedActivityContext.Provider>);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await new Promise(resolve => setTimeout(resolve, 10));
  view.rerender(<RetainedActivityContext.Provider value={true}><ServerHealthPage/></RetainedActivityContext.Provider>);
  expect(screen.getByRole('searchbox')).toHaveValue('cache');
  expect(screen.getByText('Cache is unavailable.')).not.toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(1);
});

it('polls only while active and refreshes explicitly through the shared refresh token', async () => {
  const view = render(<RetainedActivityContext.Provider value={true}><ServerHealthPage/></RetainedActivityContext.Provider>);
  await screen.findByText('Cache is unavailable.');
  vi.useFakeTimers();
  view.rerender(<RetainedActivityContext.Provider value={false}><ServerHealthPage/></RetainedActivityContext.Provider>);
  await vi.advanceTimersByTimeAsync(60000);
  expect(api).toHaveBeenCalledTimes(1);
  view.rerender(<RetainedActivityContext.Provider value={true}><ServerHealthPage refreshToken={1}/></RetainedActivityContext.Provider>);
  await vi.advanceTimersByTimeAsync(1);
  expect(api).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60000);
  expect(api).toHaveBeenCalledTimes(3);
});
