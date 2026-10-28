import { getBusinessTimezone } from '../timezone';
import { normalizeReceiptLayout } from '../utils/printing';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
}

function enabled(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function amount(value) {
  return Math.round(Number(value || 0)).toLocaleString();
}

function quantity(value) {
  return Number(value || 0).toFixed(3).replace(/\.?0+$/, '');
}

export function offlineReceiptNumber(sale) {
  return `OFF-${String(sale?.id || 0).padStart(6, '0')}`;
}

export function offlineReceiptPayload(sale, settings = {}, business = {}) {
  const payload = sale?.payload || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const currency = settings.currency || business.currency || 'Ks';
  const subtotal = Math.round(items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0));
  const discount = Math.max(0, Math.round(Number(payload.discount || 0)));
  const total = Number(sale?.local_total ?? Math.max(subtotal - discount, 0));
  const receiptNo = offlineReceiptNumber(sale);
  const date = new Date(sale?.created_at || payload.offline_created_at || Date.now());
  const dateText = Number.isNaN(date.getTime()) ? String(sale?.created_at || '') : date.toLocaleString(undefined, { timeZone: business.timezone || getBusinessTimezone() });
  const showPayment = enabled(settings.receipt_show_payment_method);
  const showPriceType = enabled(settings.receipt_show_price_type);
  const shopName = settings.shop_name || business.name || 'PwarMyar Shop';
  const itemHtml = items.map((item) => `
    <div class="receipt-item">
      <div class="receipt-item-name">${escapeHtml(item.product_name)}</div>
      ${showPriceType ? `<div class="receipt-row"><span>Price type</span><strong>${escapeHtml(item.price_type || 'Retail')}</strong></div>` : ''}
      <div class="receipt-row receipt-item-amount"><span>${quantity(item.quantity)} × ${amount(item.unit_price)}</span><strong>${amount(Number(item.quantity || 0) * Number(item.unit_price || 0))} ${escapeHtml(currency)}</strong></div>
      ${Number(item.foc_quantity || 0) > 0 ? `<div class="receipt-foc">FOC: ${quantity(item.foc_quantity)}</div>` : ''}
    </div>
  `).join('');
  const footer = String(settings.receipt_footer || '').trim();
  const html = `<div class="receipt-document">
    <header class="receipt-shop-header">
      <div class="shop-name">${escapeHtml(shopName)}</div>
      ${settings.shop_title ? `<div class="shop-title">${escapeHtml(settings.shop_title)}</div>` : ''}
      ${settings.shop_address ? `<div class="shop-address">${escapeHtml(settings.shop_address)}</div>` : ''}
      ${settings.shop_phone ? `<div class="shop-phone">${escapeHtml(settings.shop_phone)}</div>` : ''}
    </header>
    <div class="receipt-rule"></div>
    <div class="receipt-meta">
      <div class="receipt-row"><span>Invoice</span><strong>${escapeHtml(receiptNo)}</strong></div>
      ${sale?.receipt_no ? `<div class="receipt-row"><span>Server receipt</span><strong>${escapeHtml(sale.receipt_no)}</strong></div>` : ''}
      <div class="receipt-row"><span>Date</span><strong>${escapeHtml(dateText)}</strong></div>
      <div class="receipt-row"><span>Sale mode</span><strong>Offline</strong></div>
      ${showPayment ? `<div class="receipt-row"><span>Payment</span><strong>${escapeHtml(payload.payment_method || 'Cash')}</strong></div>` : ''}
    </div>
    <div class="receipt-rule"></div>
    <div class="receipt-items">${itemHtml}</div>
    <div class="receipt-rule"></div>
    <div class="receipt-totals">
      <div class="receipt-row"><span>Subtotal</span><strong>${amount(subtotal)} ${escapeHtml(currency)}</strong></div>
      ${discount > 0 ? `<div class="receipt-row"><span>Discount</span><strong>-${amount(discount)} ${escapeHtml(currency)}</strong></div>` : ''}
      <div class="receipt-row receipt-total"><span>Total</span><strong>${amount(total)} ${escapeHtml(currency)}</strong></div>
      <div class="receipt-row"><span>Paid</span><strong>${amount(total)} ${escapeHtml(currency)}</strong></div>
    </div>
    <div class="receipt-rule"></div>
    <div class="receipt-footer">${escapeHtml(footer || 'Thank you')}</div>
  </div>`;

  const textItems = items.flatMap((item) => [
    item.product_name,
    `${quantity(item.quantity)} x ${amount(item.unit_price)}  ${amount(Number(item.quantity || 0) * Number(item.unit_price || 0))} ${currency}`,
    ...(Number(item.foc_quantity || 0) > 0 ? [`FOC: ${quantity(item.foc_quantity)}`] : []),
  ]);
  const text = [shopName, settings.shop_title, settings.shop_address, settings.shop_phone,
    `Invoice: ${receiptNo}`, ...(sale?.receipt_no ? [`Server receipt: ${sale.receipt_no}`] : []), `Date: ${dateText}`, 'Sale mode: Offline',
    ...(showPayment ? [`Payment: ${payload.payment_method || 'Cash'}`] : []), '', ...textItems, '',
    `Subtotal: ${amount(subtotal)} ${currency}`,
    ...(discount > 0 ? [`Discount: -${amount(discount)} ${currency}`] : []),
    `Total: ${amount(total)} ${currency}`, `Paid: ${amount(total)} ${currency}`, '', footer || 'Thank you',
  ].filter((line) => line !== undefined && line !== null).join('\n');

  const normalizedLayout = normalizeReceiptLayout({
    paper_size: settings.receipt_paper_size,
    header_alignment: settings.receipt_header_alignment,
    margin_left: settings.receipt_margin_left,
    margin_right: settings.receipt_margin_right,
    header_font_size: settings.receipt_header_font_size,
    body_font_size: settings.receipt_body_font_size,
    line_height: settings.receipt_line_height,
  }, settings.receipt_paper_size);
  return {
    sale,
    local_receipt_no: receiptNo,
    text,
    html,
    paper_size: normalizedLayout.paperSize,
    layout: {
      paper_size: normalizedLayout.paperSize,
      header_alignment: normalizedLayout.headerAlignment,
      margin_left: normalizedLayout.marginLeft,
      margin_right: normalizedLayout.marginRight,
      header_font_size: normalizedLayout.headerFontSize,
      body_font_size: normalizedLayout.bodyFontSize,
      line_height: normalizedLayout.lineHeight,
    },
  };
}
