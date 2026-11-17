import { request, requestAllPages } from './api';

export const PURCHASE_LINE_COLUMNS = [
  { label: 'Purchase ID', value: ({ purchase }) => purchase.id },
  { label: 'Date', value: ({ purchase }) => purchase.created_at },
  { label: 'Supplier', value: ({ purchase }) => purchase.supplier_name || '' },
  { label: 'Product', value: ({ item }) => item?.product_name || '' },
  { label: 'Product ID', value: ({ item }) => item?.product_id || '' },
  { label: 'Unit', value: ({ item }) => item?.unit_name || '' },
  { label: 'Paid Quantity', value: ({ item }) => item?.quantity ?? '' },
  { label: 'FOC Quantity', value: ({ item }) => item?.foc_quantity ?? 0 },
  { label: 'Received Base Quantity', value: ({ item }) => item ? Number(item.base_quantity || 0) + Number(item.base_foc_quantity || 0) : '' },
  { label: 'Unit Cost', value: ({ item }) => item?.unit_cost ?? '' },
  { label: 'Effective Unit Cost', value: ({ item }) => item?.effective_unit_cost ?? item?.unit_cost ?? '' },
  { label: 'Line Total', value: ({ item }) => item?.line_total ?? '' },
  { label: 'Purchase Total', value: ({ purchase }) => purchase.total_cost },
  { label: 'Purchase Paid', value: ({ purchase }) => purchase.paid_amount },
  { label: 'Purchase Credit', value: ({ purchase }) => purchase.credit_amount },
  { label: 'Payment Method', value: ({ purchase }) => purchase.payment_method || '' },
  { label: 'Status', value: ({ purchase }) => purchase.status || 'completed' },
  { label: 'Note', value: ({ purchase }) => purchase.note || '' },
];

export async function expandPurchaseLineItems(purchases, fetchPurchase = (id) => request(`/purchases/${id}`), concurrency = 6) {
  const details = new Array(purchases.length);
  let cursor = 0;
  async function worker() {
    while (cursor < purchases.length) {
      const index = cursor++;
      const purchase = purchases[index];
      details[index] = Array.isArray(purchase.items) ? purchase : await fetchPurchase(purchase.id);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, purchases.length) }, worker));
  return details.flatMap((purchase) => {
    const items = purchase.items?.length ? purchase.items : [null];
    return items.map((item) => ({ purchase, item }));
  });
}

export async function loadPurchaseLineItems(path) {
  return expandPurchaseLineItems(await requestAllPages(path, { pageSize: 500 }));
}
