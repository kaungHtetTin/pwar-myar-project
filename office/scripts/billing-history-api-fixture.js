window.billingFixtureCalls = [];
export async function api(path, options) {
  window.billingFixtureCalls.push({ path, ...options });
  return { billing_history: [{ id: 7, plan_name: 'Professional business subscription', ...JSON.parse(options.body), status: 'active', access_type: 'paid', created_at: '2026-10-01T03:30:00Z', price_paid: 45000, currency: 'Ks', created_by_name: 'Office administrator', duration_days: 30 }] };
}
