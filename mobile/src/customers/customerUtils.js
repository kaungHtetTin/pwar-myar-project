export const EMPTY_CUSTOMER_SUMMARY = {
  total_customers: 0,
  receivable_total: 0,
  payable_total: 0,
  open_accounts: 0,
};

export function blankCustomerForm() {
  return { name: '', phone: '', email: '', address: '', note: '' };
}

export function blankCustomerHistoryFilters() {
  return { start: '', end: '' };
}

export function blankCustomerPaymentForm() {
  return { id: null, direction: 'customer_to_shop', payment_method: 'Cash', amount: '', note: '' };
}

export function customerPageFromPath(pathname) {
  if (pathname === '/customers/new') return { kind: 'new', customerId: null, paymentId: null };
  const paymentEdit = pathname.match(/^\/customers\/(\d+)\/payments\/(\d+)\/edit$/);
  if (paymentEdit) return { kind: 'payment-edit', customerId: Number(paymentEdit[1]), paymentId: Number(paymentEdit[2]) };
  const paymentNew = pathname.match(/^\/customers\/(\d+)\/payments\/new$/);
  if (paymentNew) return { kind: 'payment-new', customerId: Number(paymentNew[1]), paymentId: null };
  const edit = pathname.match(/^\/customers\/(\d+)\/edit$/);
  if (edit) return { kind: 'edit', customerId: Number(edit[1]), paymentId: null };
  const detail = pathname.match(/^\/customers\/(\d+)$/);
  if (detail) return { kind: 'detail', customerId: Number(detail[1]), paymentId: null };
  return { kind: 'list', customerId: null, paymentId: null };
}

export function customerPayload(form) {
  return {
    name: String(form.name || '').trim(),
    phone: String(form.phone || '').trim(),
    email: String(form.email || '').trim().toLowerCase(),
    address: String(form.address || '').trim(),
    note: String(form.note || '').trim(),
  };
}

export function paymentPayload(form) {
  return {
    direction: form.direction || 'customer_to_shop',
    payment_method: String(form.payment_method || 'Cash').trim() || 'Cash',
    amount: Number(form.amount),
    note: String(form.note || '').trim(),
  };
}

export function cleanPaymentMethods(settings) {
  const methods = String(settings?.payment_methods || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item.toLowerCase() !== 'credit');
  return methods.length ? methods : ['Cash'];
}

export function customerHistoryPath(customerId, type, filters, limit, offset) {
  const params = new URLSearchParams({ with_total: 'true', limit: String(limit), offset: String(offset) });
  if (type === 'sales' && filters.q) params.set('q', filters.q);
  if (type === 'sales') params.set('with_items', 'true');
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  return `/customers/${customerId}/${type}?${params}`;
}

export function customerStatementPath(customerId, filters) {
  const params = new URLSearchParams();
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  const query = params.toString();
  return `/customers/${customerId}/statement${query ? `?${query}` : ''}`;
}

export function balanceState(value) {
  const balance = Number(value || 0);
  if (balance > 0) return { key: 'receivable', label: 'Receivable', amount: balance };
  if (balance < 0) return { key: 'payable', label: 'Payable', amount: Math.abs(balance) };
  return { key: 'settled', label: 'Settled', amount: 0 };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('en-US')} Ks`;
}

export function customerStatementHtml(statement, settings = {}) {
  const sales = (statement.sales || []).map((sale) => `<tr><td>${escapeHtml(sale.created_at)}</td><td>${escapeHtml(sale.receipt_no || '-')}</td><td class="amount">${escapeHtml(formatMoney(sale.credit_amount))}</td></tr>`).join('');
  const payments = (statement.payments || []).map((payment) => `<tr><td>${escapeHtml(payment.created_at)}</td><td>${payment.direction === 'shop_to_customer' ? 'Shop payout' : 'Customer payment'}</td><td>${escapeHtml(payment.note || '-')}</td><td class="amount">${escapeHtml(formatMoney(payment.amount))}</td></tr>`).join('');
  const summary = statement.summary || {};
  const dateRange = `${statement.start || 'Beginning'} to ${statement.end || 'Today'}`;
  return `<!doctype html><html><head><title>Customer Statement</title><style>body{font-family:Arial,"Noto Sans Myanmar",sans-serif;color:#13231d;margin:24px;font-size:13px;line-height:1.55}h1,h2,p{margin:0}.shop{text-align:center;margin-bottom:20px}.shop h1{font-size:20px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #0f4c3a}h2{font-size:14px;margin:16px 0 6px;color:#0f4c3a}table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #dfe7e3;text-align:left}th{background:#edf4f1}.amount{text-align:right;white-space:nowrap}.totals{margin:18px 0 0 auto;width:340px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.balance{font-size:16px;font-weight:700;border-top:2px solid #0f4c3a;margin-top:4px;padding-top:8px!important}@media print{body{margin:10mm}}</style></head><body><div class="shop"><h1>${escapeHtml(settings.shop_name || 'PwarMyar Shop')}</h1><p>${escapeHtml(settings.shop_title || '')}</p><p>${escapeHtml(settings.shop_address || '')}</p><p>${escapeHtml(settings.shop_phone || '')}</p></div><div class="meta"><strong>Customer</strong><span>${escapeHtml(statement.customer?.name)}</span><strong>Phone</strong><span>${escapeHtml(statement.customer?.phone || '-')}</span><strong>Address</strong><span>${escapeHtml(statement.customer?.address || '-')}</span><strong>Date range</strong><span>${escapeHtml(dateRange)}</span></div><h2>Credit Sales</h2><table><thead><tr><th>Date</th><th>Receipt</th><th class="amount">Credit</th></tr></thead><tbody>${sales || '<tr><td colspan="3">No credit sales.</td></tr>'}</tbody></table><h2>Payments and Payouts</h2><table><thead><tr><th>Date</th><th>Direction</th><th>Note</th><th class="amount">Amount</th></tr></thead><tbody>${payments || '<tr><td colspan="4">No payments or payouts.</td></tr>'}</tbody></table><div class="totals"><div><span>Credit sales</span><strong>${escapeHtml(formatMoney(summary.credit_total))}</strong></div><div><span>Customer payments</span><strong>${escapeHtml(formatMoney(summary.paid_total))}</strong></div><div><span>Shop payouts</span><strong>${escapeHtml(formatMoney(summary.payout_total))}</strong></div><div class="balance"><span>Current balance</span><strong>${escapeHtml(formatMoney(summary.current_balance ?? summary.balance))}</strong></div></div><script>window.addEventListener('afterprint',()=>window.close());window.onload=()=>{window.focus();window.print();}</script></body></html>`;
}

export function customerInitials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'C';
}

export function customerDate(value, withTime = false) {
  if (!value) return 'Not available';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

