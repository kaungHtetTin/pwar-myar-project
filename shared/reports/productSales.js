export const productSalesSorts = [
  ['amount_desc', 'Highest sales amount'], ['sales_desc', 'Most sales'],
  ['quantity_desc', 'Most units sold'], ['name_asc', 'Product name'],
];

export function productSalesFilters(period = {}) {
  return { preset: period.preset || 'today', start: period.start || '', end: period.end || '', q: '', category: '', sort: 'amount_desc' };
}

export function productSalesError(filters) {
  if (filters.q.trim().length > 150) return 'Search must be 150 characters or fewer.';
  if (filters.preset === 'all') return '';
  if (!filters.start || !filters.end) return 'Choose both From and To dates.';
  if (filters.start > filters.end) return 'From date cannot be later than To date.';
  return '';
}

export function productSalesPath(filters, limit = 25, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sort: filters.sort });
  if (filters.preset === 'all') params.set('all_time', 'true');
  else { if (filters.start) params.set('start', filters.start); if (filters.end) params.set('end', filters.end); }
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  return `/reports/products?${params}`;
}
