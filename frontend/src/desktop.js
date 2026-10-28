import { request, requestAllPages } from './api';

export function desktopBridge() {
  return typeof window !== 'undefined' ? window.mkposDesktop || null : null;
}

export function cachedProductPrice(product, priceType) {
  const namedPrice = (product?.prices || []).find((row) => row.name === priceType)?.price;
  if (namedPrice !== undefined && namedPrice !== null) return Number(namedPrice);
  return priceType === 'Retail' ? Number(product?.price || 0) : 0;
}

export function offlinePaymentMethods(settings = {}) {
  const methods = String(settings.payment_methods || 'Cash')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item.toLocaleLowerCase() !== 'credit');
  return methods.length ? methods : ['Cash'];
}

export async function refreshDesktopCache(session, bridge = desktopBridge()) {
  if (!bridge) return null;
  const [products, settings, categories] = await Promise.all([
    requestAllPages('/products'),
    request('/settings'),
    request('/categories'),
  ]);
  return bridge.cacheOnlineData({ session, products, settings, categories });
}

function isRecordRejection(error) {
  return error?.status === 404 || error?.status === 409 || error?.status === 422;
}

export async function syncOfflineSales({
  bridge = desktopBridge(),
  sendSale = (payload) => request('/sales/offline-sync', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  }),
  onProgress = () => {},
} = {}) {
  if (!bridge) return { processed: 0, synced: 0, failed: 0, interrupted: false };
  const queue = await bridge.listOfflineSales({ statuses: ['pending'], limit: 2000 });
  const result = { processed: 0, synced: 0, failed: 0, interrupted: false };

  for (const localSale of queue) {
    await bridge.markSaleSyncing(localSale.id);
    onProgress({ current: localSale, result: { ...result }, total: queue.length });
    try {
      const serverSale = await sendSale(localSale.payload);
      await bridge.markSaleSynced(localSale.id, serverSale);
      result.synced += 1;
      result.processed += 1;
    } catch (error) {
      if (isRecordRejection(error)) {
        await bridge.markSaleFailed(localSale.id, error.message);
        result.failed += 1;
        result.processed += 1;
      } else {
        await bridge.markSalePending(localSale.id, error.message);
        result.interrupted = true;
        onProgress({ current: localSale, result: { ...result }, total: queue.length, error });
        break;
      }
    }
    onProgress({ current: localSale, result: { ...result }, total: queue.length });
  }

  return result;
}
