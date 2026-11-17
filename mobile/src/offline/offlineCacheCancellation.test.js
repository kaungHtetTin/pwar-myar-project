import { expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { refreshMobileOfflineCache } from './offlineSales';
import { replaceOfflineCache } from './offlineStore';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('./offlineStore', () => ({ offlineStorageAvailable: () => true, replaceOfflineCache: vi.fn(),
  getOfflineBootstrap: vi.fn(), listOfflineSales: vi.fn(), markOfflineSaleFailed: vi.fn(), markOfflineSalePending: vi.fn(), markOfflineSaleSynced: vi.fn(), markOfflineSaleSyncing: vi.fn() }));

it('stops paginating and never replaces another workspace cache after account cancellation', async () => {
  let finish; let current = true;
  apiRequest.mockImplementation(path => path.startsWith('/products?') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({}));
  const update = refreshMobileOfflineCache({ permissions: ['sell'] }, {}, { isCurrent: () => current });
  current = false;
  finish({ items: Array.from({ length: 500 }, (_, id) => ({ id })), total: 1000 });
  await update;
  expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?'))).toHaveLength(1);
  expect(replaceOfflineCache).not.toHaveBeenCalled();
});
