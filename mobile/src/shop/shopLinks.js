// The existing customer app is hosted beside /api at /shop in Laravel builds.
// An explicit URL still supports an independent customer domain.
function shopBase() {
  if (import.meta.env.VITE_SHOP_URL?.trim()) return import.meta.env.VITE_SHOP_URL.trim().replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://127.0.0.1:5177';
  try {
    const api = new URL(import.meta.env.VITE_API_URL || '/api', window.location.origin);
    if (!/^https?:$/.test(api.protocol) || !api.pathname.replace(/\/$/, '').endsWith('/api')) return '';
    return `${api.origin}${api.pathname.replace(/\/api\/?$/, '/shop')}`;
  } catch { return ''; }
}
const SHOP_URL = shopBase();
export function customerShopLink(slug, productId) {
  if (!SHOP_URL) return '';
  return `${SHOP_URL}/#/store/${encodeURIComponent(slug)}${productId ? `/products/${productId}` : ''}`;
}
