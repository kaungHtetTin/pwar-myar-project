import { apiRequest } from '../api/client';
import {
  getOfflineBootstrap,
  listOfflineSales,
  markOfflineSaleFailed,
  markOfflineSalePending,
  markOfflineSaleSynced,
  markOfflineSaleSyncing,
  offlineStorageAvailable,
  replaceOfflineCache,
} from './offlineStore';

export const OFFLINE_STATE_EVENT = 'mkpos:mobile-offline-state';
export const OFFLINE_DETECTED_EVENT = 'mkpos:mobile-offline-detected';

export function isRecordRejection(error) {
  return [404, 409, 422].includes(Number(error?.status));
}

export function isConnectionFailure(error) {
  return !error?.status || Number(error.status) >= 500;
}

export function announceOfflineState(detail = {}) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OFFLINE_STATE_EVENT, { detail }));
}

export function announceOfflineDetected(error) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_DETECTED_EVENT, { detail: { message: error?.message || 'Server unavailable' } }));
  }
}

async function allProducts() {
  const items = [];
  let offset = 0;
  const limit = 500;
  let total = null;
  do {
    const payload = await apiRequest(`/products?with_total=true&limit=${limit}&offset=${offset}`, { timeoutMs: 30000 });
    const rows = Array.isArray(payload) ? payload : payload.items || [];
    items.push(...rows);
    total = Array.isArray(payload) ? rows.length : Number(payload.total || 0);
    offset += rows.length;
    if (!rows.length || rows.length < limit || items.length >= total) break;
  } while (items.length < 50000);
  return items;
}

export async function refreshMobileOfflineCache(session, appConfig = {}) {
  if (!offlineStorageAvailable()) return null;
  const [products, settings, categories] = await Promise.all([
    allProducts(),
    apiRequest('/settings', { timeoutMs: 30000 }),
    apiRequest('/categories', { timeoutMs: 30000 }),
  ]);
  const cachedSession = {
    ...session,
    permissions: appConfig.permissions || session.permissions || [],
  };
  const bootstrap = await replaceOfflineCache({ session: cachedSession, appConfig, products, settings, categories });
  announceOfflineState({ bootstrap, reason: 'cache-refreshed' });
  return bootstrap;
}

export async function syncMobileOfflineSales({
  businessId = null,
  interactive = false,
  sendSale = (payload) => apiRequest('/sales/offline-sync', {
    adminPinPrompt: interactive,
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  }),
  onProgress = () => {},
} = {}) {
  if (!offlineStorageAvailable()) return { processed: 0, synced: 0, failed: 0, interrupted: false, blocked: false };
  const page = await listOfflineSales({ statuses: ['pending'], limit: 2000, ascending: true });
  const foreignSale = businessId === null ? null : page.items.find((sale) => Number(sale.business_id) !== Number(businessId));
  const result = { processed: 0, synced: 0, failed: 0, interrupted: false, blocked: Boolean(foreignSale) };
  if (foreignSale) {
    const bootstrap = await getOfflineBootstrap();
    announceOfflineState({ bootstrap, reason: 'sync-business-mismatch', result });
    return result;
  }
  for (const localSale of page.items) {
    await markOfflineSaleSyncing(localSale.id);
    onProgress({ current: localSale, result: { ...result }, total: page.total });
    try {
      const serverSale = await sendSale(localSale.payload);
      await markOfflineSaleSynced(localSale.id, serverSale);
      result.synced += 1;
      result.processed += 1;
    } catch (error) {
      if (isRecordRejection(error)) {
        await markOfflineSaleFailed(localSale.id, error.message);
        result.failed += 1;
        result.processed += 1;
      } else {
        await markOfflineSalePending(localSale.id, error.message);
        result.interrupted = true;
        onProgress({ current: localSale, result: { ...result }, total: page.total, error });
        break;
      }
    }
    onProgress({ current: localSale, result: { ...result }, total: page.total });
  }
  const bootstrap = await getOfflineBootstrap();
  announceOfflineState({ bootstrap, reason: 'sync-complete', result });
  return result;
}
