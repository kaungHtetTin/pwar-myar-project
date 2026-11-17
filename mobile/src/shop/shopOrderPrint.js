import { escapeHtml, printDocumentHtml } from '../utils/printing';
import { shopDate, shopLabel, shopMoney } from './shopUtils';

export function shopOrderPrintDocument(order, timezone) {
  const e = escapeHtml;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(order.reference)}</title><style>body{font:14px sans-serif;max-width:760px;margin:24px auto;padding:12px;color:#102d25}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{padding:10px 6px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}p{white-space:pre-wrap}button{padding:10px 20px}@media print{button{display:none}}</style></head><body><h1>Order ${e(order.reference)}</h1><p>${e(order.store_name || '')}</p><p>${e(shopDate(order.created_at, timezone))}</p><p>${e(shopLabel(order.status))} / ${e(shopLabel(order.payment_status))}</p><p>${e(order.customer_name || 'Guest customer')}\n${e(order.phone || '')}\n${e(order.address || '')}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>${(order.items || []).map(item => `<tr><td>${e(item.name)}</td><td>${e(item.quantity)} ${e(item.unit_name)}</td><td>${e(shopMoney(item.line_total, order.currency))}</td></tr>`).join('')}</tbody></table><p>Total: <strong>${e(shopMoney(order.total, order.currency))}</strong></p><p>${e(shopLabel(order.fulfillment))}\n${e(order.fulfillment_instructions || '')}</p><p>Order record — payment status is shown above.</p><button onclick="window.print()">Print order</button></body></html>`;
}
export function printShopOrder(order, timezone) {
  return printDocumentHtml({ title: `Order ${order.reference}`, documentHtml: shopOrderPrintDocument(order, timezone), kind: 'document' });
}
