import { requestAllPages } from '../utils/csvExport';

export const SHOP_ORDER_COLUMNS = [
  { label: 'Order ID', value: row => row.id },
  { label: 'Reference', value: row => row.reference },
  { label: 'Customer', value: row => row.customer_name },
  { label: 'Created at (UTC)', value: row => row.created_at },
  { label: 'Order status', value: row => row.status },
  { label: 'Payment status', value: row => row.payment_status },
  { label: 'Fulfillment', value: row => row.fulfillment },
  { label: 'Payment method', value: row => row.payment_method?.name || '' },
  { label: 'Currency', value: row => row.currency },
  { label: 'Total', value: row => row.total },
  { label: 'Requests needing review', value: row => row.request_count || 0 },
];

export function loadShopOrderExport(path) {
  return requestAllPages(path, { pageSize: 100 });
}
