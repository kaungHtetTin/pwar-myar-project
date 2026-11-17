export const SHOP_SECTIONS = [
  { id: 'orders', label: 'Orders', description: 'Payments, requests and fulfillment', permission: 'ecommerce_orders' },
  { id: 'customers', label: 'Customers', description: 'Shop purchases and customer accounts', permission: 'ecommerce_orders' },
  { id: 'chat', label: 'Chat', description: 'Customer conversations and product sharing', permission: 'ecommerce_orders' },
  { id: 'reviews', label: 'Reviews', description: 'Shop and product ratings and replies', permission: 'ecommerce_orders' },
  { id: 'report', label: 'Report', description: 'Sales, payments and customer performance', permission: 'ecommerce_orders' },
  { id: 'catalog', label: 'Publication', description: 'Publish products and online prices', permission: 'ecommerce_catalog' },
  { id: 'promotions', label: 'Promotions', description: 'Coupons and product flash sales', permission: 'ecommerce_catalog' },
  { id: 'contacts', label: 'Contacts', description: 'Public phone, email and social links', permission: 'ecommerce_settings' },
  { id: 'delivery', label: 'Delivery zones', description: 'Delivery areas and fees', permission: 'ecommerce_settings' },
  { id: 'methods', label: 'Payment methods', description: 'Receiving accounts and manual payments', permission: 'ecommerce_settings' },
  { id: 'storefront', label: 'Storefront', description: 'Shop details, hours and publication', permission: 'ecommerce_settings' },
  { id: 'fulfillment', label: 'Fulfillment', description: 'Pickup location and instructions', permission: 'ecommerce_settings' },
  { id: 'cover', label: 'Cover photo', description: 'Storefront cover image', permission: 'ecommerce_settings' },
];

export const ORDER_STATES = ['pending', 'accepted', 'packing', 'ready_for_pickup', 'dispatched', 'return_pending', 'completed', 'cancelled', 'expired'];
export const PAYMENT_STATES = ['unpaid', 'proof_submitted', 'paid', 'refund_pending', 'refunded'];
const transitions = {
  pending: ['accepted', 'cancelled'], accepted: ['packing', 'cancelled'],
  packing: ['ready_for_pickup', 'dispatched', 'cancelled'], ready_for_pickup: ['completed', 'cancelled'],
  dispatched: ['completed', 'return_pending'], return_pending: ['cancelled'],
};
export const ACTION_LABELS = {
  accepted: 'Accept order', packing: 'Start packing', ready_for_pickup: 'Ready for pickup',
  dispatched: 'Dispatch order', completed: 'Complete order', cancelled: 'Cancel order',
  return_pending: 'Record failed delivery', reopen: 'Reopen for payment review',
  confirm: 'Approve full payment', reject: 'Reject proof', refund: 'Record full refund',
};
export function canShop(session, permission) {
  return session?.user?.role === 'owner' || !!session?.permissions?.includes(permission);
}
export function shopOrderActions(order, session) {
  const result = [];
  if (canShop(session, 'ecommerce_process')) {
    for (const key of transitions[order.status] || []) {
      if (key === 'ready_for_pickup' && order.fulfillment !== 'pickup') continue;
      if (['dispatched', 'return_pending'].includes(key) && order.fulfillment !== 'delivery') continue;
      result.push({ key, label: ACTION_LABELS[key], disabled: key === 'completed' && order.payment_status !== 'paid' });
    }
    if (order.status === 'expired' && order.payment_status === 'proof_submitted') result.push({ key: 'reopen', label: ACTION_LABELS.reopen });
  }
  if ((order.payment_method?.provider || 'manual') === 'manual') {
    if (canShop(session, 'ecommerce_payments')) {
      const closed = ['cancelled', 'expired'].includes(order.status);
      if ((!closed && order.status !== 'completed' && ['unpaid', 'proof_submitted'].includes(order.payment_status)) || (closed && order.payment_status === 'proof_submitted')) {
        result.push({ key: 'confirm', label: closed ? 'Record payment for refund' : ACTION_LABELS.confirm });
      }
      if (order.payment_status === 'proof_submitted') result.push({ key: 'reject', label: ACTION_LABELS.reject });
    }
    if (canShop(session, 'ecommerce_refunds') && order.payment_status === 'refund_pending') result.push({ key: 'refund', label: ACTION_LABELS.refund });
  }
  return result;
}
export function orderActionRequest(order, action, form) {
  const base = `/shop-admin/orders/${order.id}`;
  if (action === 'reopen') return { path: `${base}/reopen`, payload: {} };
  if (['confirm', 'refund'].includes(action)) return { path: `${base}/payments/${action}`, payload: { amount: Number(order.total), reference: form.reference.trim(), verified: form.verified, review_note: form.review_note.trim() } };
  if (action === 'reject') return { path: `${base}/payments/reject`, payload: { reason: form.reason.trim() } };
  return { path: `${base}/transition`, payload: { status: action, reason: ['cancelled', 'return_pending'].includes(action) ? form.reason.trim() : '', return_confirmed: form.return_confirmed } };
}
export function fieldErrors(error) {
  return Object.fromEntries(Object.entries(error?.payload?.errors || {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)]));
}
export function shopMoney(value, currency = 'Ks') { return `${Number(value || 0).toLocaleString()} ${currency}`; }
export function shopLabel(value = '') { return String(value).replaceAll('_', ' '); }
export function shopDate(value, timezone = 'Asia/Rangoon') {
  if (!value) return '';
  const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { timeZone: timezone });
}
