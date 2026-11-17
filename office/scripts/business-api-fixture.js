export async function api(path) {
  const params = new URLSearchParams(path.split('?')[1]);
  const page = Number(params.get('page') || 1);
  const perPage = Number(params.get('per_page') || 25);
  return { total: 54, summary: { total: 82 }, page, per_page: perPage, last_page: Math.ceil(54 / perPage), items: Array.from({ length: Math.min(perPage, 54 - (page - 1) * perPage) }, (_, i) => ({
    id: (page - 1) * perPage + i + 1, name: `Example shop ${i + 1}`, owner_name: 'Example owner', owner_email: 'long-owner-address@example.com', created_at: '2026-08-20T00:00:00Z',
    subscription: { access_type: 'trial', is_valid: true, ends_at: '2026-09-12T00:00:00Z', days_remaining: 7 },
    prospect: i % 2 ? 'requested' : 'engaged', product_count: 32, sales_30d: 17, selling_days_30d: 5, pending_requests: i % 2, last_sale_at: '2026-09-05T00:00:00Z',
  })) };
}
