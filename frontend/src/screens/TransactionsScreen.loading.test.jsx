import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { SalesHistoryScreen } from './SalesHistoryScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { KeepAliveModules } from '../components/KeepAliveModules';

vi.mock('../api', () => ({ request: vi.fn() }));
beforeEach(() => { request.mockReset(); });
const sale = { id: 1, created_at: '2026-10-31 09:00:00', receipt_no: 'LOAD-001',
  customer_name: 'Customer', payment_type: 'cash', payment_method: 'Cash',
  total: 1000, paid_amount: 1000, credit_amount: 0 };
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function view(child = <SalesHistoryScreen />) {
  return render(<NotificationProvider><ConfirmationProvider>{child}</ConfirmationProvider></NotificationProvider>);
}
const table = container => container.querySelector('.transaction-table-wrap');

it('keeps the sales header and uses nine skeleton cells per row only inside the initial table', async () => {
  const pending = deferred();
  request.mockImplementation(path => path === '/settings' ? Promise.resolve({}) : pending.promise);
  const { container } = view();
  expect(table(container)).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelectorAll('.transaction-table-sales thead th')).toHaveLength(9);
  const skeletons = container.querySelectorAll('.transaction-skeleton-row');
  expect(skeletons).toHaveLength(6);
  skeletons.forEach(row => { expect(row.children).toHaveLength(9); expect(row).toHaveAttribute('aria-hidden', 'true'); });
  expect(screen.getByText('Loading sales…')).toBeInTheDocument();
  expect(container.querySelector('.page-loading-skeleton')).toBeNull();
  expect(screen.queryByText('No transactions found')).not.toBeInTheDocument();
  await act(async () => pending.resolve({ items: [sale], total: 1 }));
  expect(table(container)).toHaveAttribute('aria-busy', 'false');
  expect(container.querySelector('.transaction-skeleton-row')).toBeNull();
  expect(screen.getByText('LOAD-001')).toBeInTheDocument();
});

it('preserves loaded rows and pagination during a subsequent request with a small refresh status', async () => {
  const next = deferred(); let reads = 0;
  request.mockImplementation(path => path === '/settings' ? Promise.resolve({})
    : ++reads === 1 ? Promise.resolve({ items: [sale], total: 100 }) : next.promise);
  const { container } = view();
  await screen.findByText('LOAD-001');
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  expect(screen.getByText('LOAD-001')).toBeInTheDocument();
  expect(screen.getByText('Refreshing sales…')).toHaveAttribute('role', 'status');
  expect(screen.getByText('1-50 of 100')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  expect(container.querySelector('.transaction-skeleton-row')).toBeNull();
  expect(container.querySelector('.page-loading-skeleton')).toBeNull();
  await act(async () => next.resolve({ items: [{ ...sale, id: 2, receipt_no: 'LOAD-002' }], total: 100 }));
  expect(screen.queryByText('LOAD-001')).not.toBeInTheDocument();
  expect(screen.getByText('LOAD-002')).toBeInTheDocument();
  expect(screen.getByText('51-100 of 100')).toBeInTheDocument();
  expect(screen.queryByText('Refreshing sales…')).not.toBeInTheDocument();
});

it('keeps the table busy when settings fail before the sales response', async () => {
  const pending = deferred();
  request.mockImplementation(path => path === '/settings' ? Promise.reject(new Error('Settings unavailable')) : pending.promise);
  let result;
  await act(async () => { result = view(); });
  expect(table(result.container)).toHaveAttribute('aria-busy', 'true');
  expect(result.container.querySelector('.transaction-skeleton-row')).not.toBeNull();
  expect(screen.queryByText('No transactions found')).not.toBeInTheDocument();
  await act(async () => pending.resolve({ items: [sale], total: 1 }));
  expect(table(result.container)).toHaveAttribute('aria-busy', 'false');
  expect(screen.getByText('LOAD-001')).toBeInTheDocument();
});

it('shows completed sales without waiting for slower settings', async () => {
  const settings = deferred();
  request.mockImplementation(path => path === '/settings' ? settings.promise : Promise.resolve({ items: [sale], total: 1 }));
  const { container } = view();
  await screen.findByText('LOAD-001');
  expect(table(container)).toHaveAttribute('aria-busy', 'false');
  expect(container.querySelector('.transaction-skeleton-row')).toBeNull();
  await act(async () => settings.resolve({}));
});

it('shows a retryable request error instead of an empty result and succeeds on retry', async () => {
  const retry = deferred(); let reads = 0;
  request.mockImplementation(path => path === '/settings' ? Promise.resolve({})
    : ++reads === 1 ? Promise.reject(new Error('Sales unavailable')) : retry.promise);
  const { container } = view();
  await screen.findByText('Cannot load sales');
  expect(screen.queryByText('No transactions found')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
  expect(table(container)).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelector('.transaction-skeleton-row')).not.toBeNull();
  await act(async () => retry.resolve({ items: [sale], total: 1 }));
  expect(screen.getByText('LOAD-001')).toBeInTheDocument();
  expect(screen.queryByText('Cannot load sales')).not.toBeInTheDocument();
});

it('retains successful rows and counts if a refresh fails', async () => {
  let reads = 0;
  request.mockImplementation(path => path === '/settings' ? Promise.resolve({})
    : ++reads === 1 ? Promise.resolve({ items: [sale], total: 100 }) : Promise.reject(new Error('Refresh unavailable')));
  const { container } = view();
  await screen.findByText('LOAD-001');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true })));
  expect(screen.getByText('LOAD-001')).toBeInTheDocument();
  expect(screen.getByText('1-50 of 100')).toBeInTheDocument();
  expect(table(container)).toHaveAttribute('aria-busy', 'false');
  expect(screen.queryByText('Refreshing sales…')).not.toBeInTheDocument();
});

it('matches the seven-column payment table when switching to an unloaded tab', async () => {
  const pending = deferred();
  request.mockImplementation(path => path === '/settings' ? Promise.resolve({})
    : path.startsWith('/customer-payments?') ? Promise.resolve({ items: [], total: 0 }) : pending.promise);
  const { container } = view(<TransactionsScreen />);
  await screen.findByText('No transactions found');
  fireEvent.click(screen.getByRole('button', { name: 'Supplier Payments', exact: true }));
  expect(container.querySelectorAll('.transaction-skeleton-row')).toHaveLength(6);
  container.querySelectorAll('.transaction-skeleton-row').forEach(row => expect(row.children).toHaveLength(7));
  expect(container.querySelectorAll('.transaction-table-payments thead th')).toHaveLength(7);
  await act(async () => pending.resolve({ items: [], total: 0 }));
  expect(screen.getByText('No transactions found')).toBeInTheDocument();
});

it('returns to the retained sales page without a skeleton, refetch, or loss of page, search and scroll', async () => {
  request.mockImplementation(path => path === '/settings' ? Promise.resolve({})
    : Promise.resolve({ items: [{ ...sale, receipt_no: path.includes('offset=50') ? 'LOAD-002' : 'LOAD-001' }], total: 100 }));
  function Flow() {
    const [active, setActive] = useState('sales');
    return <>
      <button onClick={() => setActive('other')}>Other page</button>
      <button onClick={() => setActive('sales')}>Sales page</button>
      <KeepAliveModules active={active} modules={[{ id: 'sales' }, { id: 'other' }]}
        renderModule={id => id === 'sales' ? <SalesHistoryScreen /> : <p>Other content</p>} />
    </>;
  }
  const { container } = view(<Flow />);
  await screen.findByText('LOAD-001');
  fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  const row = await screen.findByText('LOAD-002');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search sales' }), { target: { value: 'LOAD' } });
  table(container).scrollTop = 120;
  const requests = request.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Other page', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Sales page', exact: true }));
  expect(screen.getByText('LOAD-002')).toBe(row);
  expect(screen.getByText('51-100 of 100')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Search sales' })).toHaveValue('LOAD');
  expect(table(container).scrollTop).toBe(120);
  expect(container.querySelector('.transaction-skeleton-row')).toBeNull();
  expect(request).toHaveBeenCalledTimes(requests);
});
