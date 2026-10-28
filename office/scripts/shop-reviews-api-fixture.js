let rows = Array.from({ length: 28 }, (_, index) => ({ id: index + 1, business_id: 11, product_id: 0, customer_id: index + 1, shop_name: 'Demo Shop 01', shop_slug: 'demo-shop-01', product_name: null, customer_name: `Customer ${index + 1}`, customer_email: `buyer${index + 1}@example.com`, rating: index % 5 + 1, comment: index % 4 === 0 ? null : 'Helpful service and an order delivered on time.', reply: index % 3 === 0 ? 'Thank you for sharing your experience.' : null, replied_at: null, created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z', version: 'a'.repeat(64) }));
window.reviewCalls = [];
export async function api(path, options) {
 window.reviewCalls.push({ path, ...options });
 const params = new URL(path, 'http://fixture').searchParams;
 if (path.includes('/options?')) {
  const lookup = { shops: [{ id: 11, label: 'Demo Shop 01' }], products: [{ id: 21, label: 'Premium Rice' }], customers: [{ id: 99, label: 'Mya Mya', detail: 'mya@example.com' }] };
  return { items: lookup[params.get('kind')], has_more: false, selected: null };
 }
 if (options) {
  const body = JSON.parse(options.body);
  if (options.method === 'POST') { const row = { ...rows[0], ...body, id: 100, customer_name: 'Mya Mya', customer_email: 'mya@example.com' }; rows.unshift(row); return row; }
  const id = Number(path.split('/').at(-1));
  if (options.method === 'PUT') { rows = rows.map(row => row.id === id ? { ...row, ...body } : row); return rows.find(row => row.id === id); }
  if (options.method === 'DELETE') { rows = rows.filter(row => row.id !== id); return { ok: true }; }
 }
 let items = rows;
 if (params.get('q')) { const q = params.get('q').toLowerCase(); items = items.filter(row => [row.product_name, row.shop_name, row.customer_name, row.comment, row.reply].some(value => value?.toLowerCase().includes(q))); }
 if (params.get('rating')) items = items.filter(row => row.rating === Number(params.get('rating')));
 if (params.get('reply_status') === 'replied') items = items.filter(row => row.reply);
 if (params.get('reply_status') === 'unreplied') items = items.filter(row => !row.reply);
 const total = items.length, per_page = Number(params.get('per_page') || 25), last_page = Math.max(1, Math.ceil(total / per_page)), page = Math.min(Number(params.get('page') || 1), last_page);
 return structuredClone({ items: items.slice((page - 1) * per_page, page * per_page), total, page, per_page, last_page });
}
