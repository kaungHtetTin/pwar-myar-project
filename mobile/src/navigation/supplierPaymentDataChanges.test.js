import { afterEach, expect, it, vi } from 'vitest';
import { DATA_CHANGED_EVENT, publishDataChange } from './dataChanges';

afterEach(() => vi.restoreAllMocks());

it.each([
  ['/suppliers/2/payments', 'POST'],
  ['/supplier-payments/7', 'PUT'],
  ['/supplier-payments/7', 'DELETE'],
])('refreshes the purchase balance after %s %s', (path, method) => {
  const dispatch = vi.spyOn(window, 'dispatchEvent');
  publishDataChange(path, method);
  expect(dispatch).toHaveBeenCalledOnce();
  expect(dispatch.mock.calls[0][0].type).toBe(DATA_CHANGED_EVENT);
  expect(dispatch.mock.calls[0][0].detail.modules).toContain('purchases');
});
