import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomerOrderAlerts } from './CustomerOrderAlerts';
import { monitorCustomerOrders } from './customerOrderRealtime';
import { ShopAlertProvider, useShopAlerts } from './ShopAlertProvider';
import { go } from './shopNavigation';
vi.mock('./customerOrderRealtime', () => ({ monitorCustomerOrders: vi.fn() }));
vi.mock('./shopNavigation', () => ({ go: vi.fn(), goBack: vi.fn() }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
let receive, chat;
function ChatSource() { chat = useShopAlerts().publish; return null; }
function setup(customerId = 7) {
  monitorCustomerOrders.mockImplementation((api, scope, callback) => { receive = callback; return vi.fn(); });
  return render(<ShopAlertProvider scope={`test:${customerId}`} customerId={customerId}><ChatSource /><CustomerOrderAlerts customerId={customerId} reference="O-GUEST" credential="secret" /></ShopAlertProvider>);
}
const order = (id, event = 'accepted') => ({ id, event, reference: `O-${id}`, store_name: 'Demo shop' });
it('shows the latest live update and dismisses the entire batch without a queue', () => {
  setup();
  act(() => receive([order(1), order(2, 'packing')]));
  expect(screen.getByRole('status')).toHaveTextContent('Your order is being packed');
  fireEvent.click(screen.getByRole('button', { name: 'View order' }));
  expect(go).toHaveBeenCalledExactlyOnceWith('/orders/track?reference=O-2');
  expect(JSON.parse(sessionStorage.getItem('mkpos.shop.tracking'))).toEqual({ reference: 'O-2' });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => receive([order(3), order(4)]));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('merges paginated missed orders and chat into one summary and deduplicates', () => {
  setup();
  act(() => {
    receive([order(1), order(2)], { catchUp: true });
    receive([order(2), order(3)], { catchUp: true });
    chat({ kind: 'chat', items: [{ id: 8 }, { id: 9 }], catchUp: true });
  });
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('While you were away');
  expect(screen.getByRole('status')).toHaveTextContent('3 order updates and 2 new messages');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  act(() => receive([order(1), order(3)], { catchUp: true }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('opens updates without marking anything read and prevents replay on remount', () => {
  const view = setup();
  act(() => receive([order(1)], { catchUp: true }));
  fireEvent.click(screen.getByRole('button', { name: 'View updates' }));
  expect(go).toHaveBeenCalledExactlyOnceWith('/account/notifications');
  expect(sessionStorage.getItem('mkpos.shop.tracking')).toBeNull();
  view.unmount(); setup();
  act(() => receive([order(1)], { catchUp: true }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('auto-hides summaries after five seconds without replaying every event', async () => {
  vi.useFakeTimers(); setup();
  act(() => receive(Array.from({ length: 100 }, (_, i) => order(i + 1)), { catchUp: true }));
  expect(screen.getByRole('status')).toHaveTextContent('100 order updates');
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(30000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('opens a guest summary with the existing private tracking credential', () => {
  setup(null);
  act(() => receive([{ ...order(1), reference: 'O-GUEST' }], { catchUp: true }));
  fireEvent.click(screen.getByRole('button', { name: 'View updates' }));
  expect(go).toHaveBeenCalledExactlyOnceWith('/orders/track?reference=O-GUEST');
  expect(JSON.parse(sessionStorage.getItem('mkpos.shop.tracking'))).toEqual({ reference: 'O-GUEST', credential: 'secret' });
});

it('dismisses the whole recovery including pages that arrive later, but allows new live events', () => {
  setup();
  act(() => receive([order(1)], { catchUp: true, recoveryId: 'recovery' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  act(() => receive([order(2)], { catchUp: true, recoveryId: 'recovery' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => receive([order(3)], { catchUp: false }));
  expect(screen.getByRole('status')).toHaveTextContent('Order accepted');
});

it('preserves the source tracking reference and history state before opening another order', () => {
  setup();
  const state = { mkposShopNavigation: { key: 'source-key' }, custom: 'retained' };
  window.history.replaceState(state, '', '#/orders/track');
  sessionStorage.setItem('mkpos.shop.tracking', JSON.stringify({ reference: 'O-SOURCE' }));
  act(() => receive([order(8)]));
  fireEvent.click(screen.getByRole('button', { name: 'View order' }));
  expect(window.location.hash).toBe('#/orders/track?reference=O-SOURCE');
  expect(window.history.state).toEqual(state);
  expect(go).toHaveBeenCalledExactlyOnceWith('/orders/track?reference=O-8');
  window.history.replaceState(null, '', '#/marketplace');
});

it('waits until foreground before showing and auto-hiding a recovery summary', async () => {
  vi.useFakeTimers();
  let hidden = true;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  setup();
  act(() => receive([order(1)], { catchUp: true }));
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  hidden = false;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.getByRole('status')).toHaveTextContent('While you were away');
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
