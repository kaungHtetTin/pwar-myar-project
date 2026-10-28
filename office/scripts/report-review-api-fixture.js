let row = { id: 7, business_id: 1, shop_name: 'Demo Shop 01', shop_slug: 'demo-shop-01', customer_name: 'Aye Aye', customer_email: 'aye@example.test', reason: 'misleading_information', details: 'The product details and delivery information shown in the shop do not match the information given after checkout.', status: 'open', version: 1, created_at: '2026-10-15 10:30:00', office_response: '', updates: [] };
window.reportFixtureCalls = [];
export async function api(path, options = {}) {
  window.reportFixtureCalls.push({ path, method: options.method || 'GET' });
  if (options.method) { row = { ...row, ...JSON.parse(options.body), version: row.version + 1 }; return row; }
  if (!path.includes('?')) return row;
  const status = new URLSearchParams(path.split('?')[1]).get('status');
  const items = status === 'all' || status === row.status ? [row] : [];
  return { items, total: items.length, page: 1, per_page: 25, last_page: 1 };
}
