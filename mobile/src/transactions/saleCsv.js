import { storedTimestamp } from '../timezone';
import { apiRequest } from '../api/client';
import { requestAllPages } from '../utils/csvExport';

export const SALE_LINE_COLUMNS = [
  { label: 'Sale ID', value: ({ sale }) => sale.id },
  { label: 'Date', value: ({ sale }) => storedTimestamp(sale.created_at) },
  { label: 'Receipt', value: ({ sale }) => sale.receipt_no || '' },
  { label: 'Customer', value: ({ sale }) => sale.customer_name || '' },
  { label: 'Product', value: ({ item }) => item?.product_name || '' },
  { label: 'Product ID', value: ({ item }) => item?.product_id || '' },
  { label: 'Price Type', value: ({ item }) => item?.price_type || '' },
  { label: 'Paid Quantity', value: ({ item }) => item?.quantity ?? '' },
  { label: 'FOC Quantity', value: ({ item }) => item?.foc_quantity ?? 0 },
  { label: 'Issued Quantity', value: ({ item }) => item ? Number(item.quantity || 0) + Number(item.foc_quantity || 0) : '' },
  { label: 'Unit Price', value: ({ item }) => item?.unit_price ?? '' },
  { label: 'Unit Cost', value: ({ item }) => item?.unit_cost ?? '' },
  { label: 'Line Total', value: ({ item }) => item?.line_total ?? '' },
  { label: 'Sale Subtotal', value: ({ sale }) => sale.subtotal },
  { label: 'Discount', value: ({ sale }) => sale.discount },
  { label: 'Sale Total', value: ({ sale }) => sale.total },
  { label: 'Sale Paid', value: ({ sale }) => sale.paid_amount },
  { label: 'Sale Credit', value: ({ sale }) => sale.credit_amount },
  { label: 'Payment Type', value: ({ sale }) => sale.payment_type || '' },
  { label: 'Payment Method', value: ({ sale }) => sale.payment_method || '' },
  { label: 'Status', value: ({ sale }) => sale.status || 'completed' },
];

export async function expandSaleLineItems(sales, fetchSale = (id) => apiRequest(`/sales/${id}`), concurrency = 6) {
  const details = new Array(sales.length);
  let cursor = 0;
  async function worker() {
    while (cursor < sales.length) {
      const index = cursor++;
      const sale = sales[index];
      details[index] = Array.isArray(sale.items) ? sale : await fetchSale(sale.id);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sales.length) }, worker));
  return details.flatMap((sale) => {
    const items = sale.items?.length ? sale.items : [null];
    return items.map((item) => ({ sale, item }));
  });
}

export async function loadSaleLineItems(path) {
  return expandSaleLineItems(await requestAllPages(path));
}
