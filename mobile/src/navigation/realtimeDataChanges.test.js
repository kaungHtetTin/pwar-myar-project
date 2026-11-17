import { expect, it, vi } from 'vitest';
import { DATA_CHANGED_EVENT, publishResourceChanges } from './dataChanges';

it('combines related realtime resources into one refresh per affected module', () => {
  const receive = vi.fn();
  window.addEventListener(DATA_CHANGED_EVENT, receive);
  try {
    publishResourceChanges(['products', 'sales', 'reports', 'customer-payments']);
    expect(receive).toHaveBeenCalledTimes(1);
    const modules = receive.mock.calls[0][0].detail.modules;
    expect(modules).toEqual(expect.arrayContaining(['products', 'sell', 'sales', 'customers', 'transactions', 'reports']));
    expect(modules.filter(name => name === 'reports')).toHaveLength(1);
    publishResourceChanges(['assistant', 'unknown']);
    expect(receive).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener(DATA_CHANGED_EVENT, receive); }
});
