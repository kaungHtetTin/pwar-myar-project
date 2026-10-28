import { afterEach, expect, it, vi } from 'vitest';
import { DATA_CHANGED_EVENT, publishDataChange } from './dataChanges';

afterEach(() => vi.restoreAllMocks());

it('refreshes all retained date-dependent modules after the business timezone changes', () => {
  const dispatch = vi.spyOn(window, 'dispatchEvent');
  publishDataChange('/settings/timezone', 'PUT');
  expect(dispatch).toHaveBeenCalledOnce();
  expect(dispatch.mock.calls[0][0].type).toBe(DATA_CHANGED_EVENT);
  expect(dispatch.mock.calls[0][0].detail.modules).toEqual(['*']);
});

it('preserves legacy settings notification behavior and does not refresh on a read', () => {
  const dispatch = vi.spyOn(window, 'dispatchEvent');
  publishDataChange('/settings', 'PUT');
  expect(dispatch.mock.calls[0][0].detail.modules).toEqual(['settings', 'sell']);
  dispatch.mockClear();
  publishDataChange('/settings/timezone', 'GET');
  expect(dispatch).not.toHaveBeenCalled();
});
